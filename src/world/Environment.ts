import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { TerrainMaterial } from "@babylonjs/materials/terrain/terrainMaterial";
import {
  WORLD_SIZE,
  WATER_LEVEL,
  COLORS,
  DOCK_LOCATIONS,
  RIVER_MAP,
  type DockLocation,
} from "../utils/constants";
import { hexToColor3, seededRandom, clamp } from "../utils/helpers";
import { WaterSystem } from "./WaterSystem";

export class Environment {
  private scene: Scene;
  private dockMeshes: Map<string, TransformNode> = new Map();

  constructor(scene: Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.createGround(waterSystem);
    this.createSkybox();
    this.createTrees(waterSystem);
    this.createHouses(waterSystem);
    this.createDocks();
  }

  private createMat(name: string, color: string): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = hexToColor3(color);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    return mat;
  }

  /** Simple value noise for coherent terrain patterns */
  private noise2D(x: number, z: number, seed: number): number {
    // Hash-based pseudo-random
    const hash = (ix: number, iz: number) => {
      let h = ix * 374761393 + iz * 668265263 + seed * 1274126177;
      h = (h ^ (h >> 13)) * 1274126177;
      h = h ^ (h >> 16);
      return (h & 0x7fffffff) / 0x7fffffff;
    };

    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;

    // Smoothstep interpolation
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);

    const v00 = hash(ix, iz);
    const v10 = hash(ix + 1, iz);
    const v01 = hash(ix, iz + 1);
    const v11 = hash(ix + 1, iz + 1);

    return (
      v00 * (1 - sx) * (1 - sz) +
      v10 * sx * (1 - sz) +
      v01 * (1 - sx) * sz +
      v11 * sx * sz
    );
  }

  /** Multi-octave fractal noise */
  private fbm(x: number, z: number, octaves: number, seed: number): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, z * frequency, seed + i * 31) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }

  private createGround(waterSystem: WaterSystem): void {
    // More subdivisions for vertex displacement (hills/terrain)
    const subdivisions = 64;
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: WORLD_SIZE, height: WORLD_SIZE, subdivisions, updatable: true },
      this.scene
    );
    ground.position.y = WATER_LEVEL - 0.3;
    ground.receiveShadows = true;

    // Displace vertices to create terrain elevation
    this.displaceTerrainVertices(ground, waterSystem, subdivisions);

    try {
      const terrainMat = new TerrainMaterial("terrainMat", this.scene);

      // Splatmap: R=grass, G=dirt, B=sand
      terrainMat.mixTexture = this.generateSplatmap(waterSystem);

      // Grass (R channel) - coherent noise texture
      const grassTex = this.createProceduralGrass();
      grassTex.uScale = grassTex.vScale = 80;
      terrainMat.diffuseTexture1 = grassTex;

      // Dirt (G channel) - earthy pattern
      const dirtTex = this.createProceduralDirt();
      dirtTex.uScale = dirtTex.vScale = 80;
      terrainMat.diffuseTexture2 = dirtTex;

      // Sand (B channel) - grainy pattern
      const sandTex = this.createProceduralSand();
      sandTex.uScale = sandTex.vScale = 80;
      terrainMat.diffuseTexture3 = sandTex;

      // Try loading higher-quality CDN textures (replaces procedural on success)
      this.tryLoadCDNTextures(terrainMat);

      terrainMat.specularColor = new Color3(0.05, 0.05, 0.05);
      terrainMat.specularPower = 4;

      ground.material = terrainMat;
    } catch (e) {
      console.warn("TerrainMaterial failed, using fallback:", e);
      const fallback = new StandardMaterial("groundFallback", this.scene);
      fallback.diffuseTexture = this.createProceduralGrass();
      (fallback.diffuseTexture as Texture).uScale = 80;
      (fallback.diffuseTexture as Texture).vScale = 80;
      fallback.specularColor = new Color3(0.05, 0.05, 0.05);
      ground.material = fallback;
    }
  }

  /** Displace terrain vertices — raise land areas, keep river areas flat/low */
  private displaceTerrainVertices(
    ground: Mesh,
    waterSystem: WaterSystem,
    subdivisions: number
  ): void {
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const half = WORLD_SIZE / 2;
    for (let i = 0; i < positions.length; i += 3) {
      const localX = positions[i];
      const localZ = positions[i + 2];

      // World position (ground is centered at origin)
      const worldX = localX;
      const worldZ = localZ;

      // Check if this is a water area — keep flat
      if (waterSystem.isWater(worldX, worldZ)) {
        positions[i + 1] = -0.5; // Slightly below water
        continue;
      }

      // Estimate distance to water for smooth transition
      let nearWater = false;
      for (const d of [3, 6, 10]) {
        for (let dir = 0; dir < 4; dir++) {
          const angle = (dir / 4) * Math.PI * 2;
          if (
            waterSystem.isWater(
              worldX + Math.cos(angle) * d,
              worldZ + Math.sin(angle) * d
            )
          ) {
            nearWater = true;
            break;
          }
        }
        if (nearWater) break;
      }

      if (nearWater) {
        // Near river banks — gentle slope, slight elevation
        const bankHeight = this.fbm(worldX * 0.02, worldZ * 0.02, 3, 42) * 0.8;
        positions[i + 1] = Math.max(0, bankHeight);
      } else {
        // Inland — rolling hills
        const height =
          this.fbm(worldX * 0.008, worldZ * 0.008, 4, 42) * 4.0 +
          this.fbm(worldX * 0.025, worldZ * 0.025, 2, 99) * 1.0;
        positions[i + 1] = Math.max(0.2, height);
      }
    }

    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    ground.createNormals(true);
  }

  /** Generate a splatmap DynamicTexture based on river proximity.
   *  R = grass (far from water), G = dirt (medium), B = sand (near water) */
  private generateSplatmap(waterSystem: WaterSystem): DynamicTexture {
    const size = 256;
    const tex = new DynamicTexture("splatmap", size, this.scene, false);
    const ctx = tex.getContext();

    const checkDists = [2, 5, 9, 14, 20, 28];
    const numDirs = 6;
    const rng = seededRandom(456);

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const worldX = (px / size - 0.5) * WORLD_SIZE;
        const worldZ = (py / size - 0.5) * WORLD_SIZE;

        const onWater = waterSystem.isWater(worldX, worldZ);

        // Find minimum distance to water by sampling in directions
        let minDist = 30;
        if (onWater) {
          minDist = 0;
        } else {
          for (const d of checkDists) {
            let found = false;
            for (let dir = 0; dir < numDirs; dir++) {
              const angle = (dir / numDirs) * Math.PI * 2;
              if (
                waterSystem.isWater(
                  worldX + Math.cos(angle) * d,
                  worldZ + Math.sin(angle) * d
                )
              ) {
                found = true;
                break;
              }
            }
            if (found) {
              minDist = d;
              break;
            }
          }
        }

        // Add noise for natural-looking irregular transitions
        const noise = (rng() - 0.5) * 6;
        const effectiveDist = clamp(minDist + noise, 0, 30);

        // Compute blend weights
        let r: number, g: number, b: number;
        if (effectiveDist <= 3) {
          // Sand zone (very close to or on water)
          r = 0;
          g = 0.15;
          b = 0.85;
        } else if (effectiveDist <= 8) {
          // Sand-to-dirt transition
          const t = (effectiveDist - 3) / 5;
          r = 0;
          g = t * 0.85;
          b = (1 - t) * 0.85;
        } else if (effectiveDist <= 18) {
          // Dirt-to-grass transition
          const t = (effectiveDist - 8) / 10;
          r = t * 0.9;
          g = (1 - t) * 0.8;
          b = 0;
        } else {
          // Full grass
          r = 0.9;
          g = 0.1;
          b = 0;
        }

        ctx.fillStyle = `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`;
        ctx.fillRect(px, py, 1, 1);
      }
    }

    tex.update(true);
    return tex;
  }

  /** Procedural tiling grass texture with coherent noise */
  private createProceduralGrass(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("grassProc", size, this.scene, true);
    const ctx = tex.getContext();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Multi-octave noise for natural grass variation
        const n1 = this.fbm(x * 0.08, y * 0.08, 4, 777);
        const n2 = this.fbm(x * 0.15, y * 0.15, 2, 778);
        const n = (n1 - 0.5) * 0.3 + (n2 - 0.5) * 0.1;

        const cr = Math.floor(clamp((0.28 + n * 0.3) * 255, 0, 255));
        const cg = Math.floor(clamp((0.58 + n * 0.6) * 255, 0, 255));
        const cb = Math.floor(clamp((0.18 + n * 0.15) * 255, 0, 255));
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    tex.update(true);
    return tex;
  }

  /** Procedural tiling dirt/earth texture with coherent noise */
  private createProceduralDirt(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("dirtProc", size, this.scene, true);
    const ctx = tex.getContext();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n1 = this.fbm(x * 0.1, y * 0.1, 4, 888);
        const n2 = this.fbm(x * 0.2, y * 0.2, 2, 889);
        const n = (n1 - 0.5) * 0.25 + (n2 - 0.5) * 0.08;

        const cr = Math.floor(clamp((0.50 + n * 0.8) * 255, 0, 255));
        const cg = Math.floor(clamp((0.36 + n * 0.6) * 255, 0, 255));
        const cb = Math.floor(clamp((0.20 + n * 0.4) * 255, 0, 255));
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    tex.update(true);
    return tex;
  }

  /** Procedural tiling sand texture with coherent noise */
  private createProceduralSand(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("sandProc", size, this.scene, true);
    const ctx = tex.getContext();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n1 = this.fbm(x * 0.12, y * 0.12, 3, 999);
        const n2 = this.fbm(x * 0.3, y * 0.3, 2, 1000);
        const n = (n1 - 0.5) * 0.15 + (n2 - 0.5) * 0.05;

        const cr = Math.floor(clamp((0.80 + n * 0.6) * 255, 0, 255));
        const cg = Math.floor(clamp((0.70 + n * 0.55) * 255, 0, 255));
        const cb = Math.floor(clamp((0.40 + n * 0.4) * 255, 0, 255));
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    tex.update(true);
    return tex;
  }

  /** Try loading higher-quality textures from BabylonJS CDN */
  private tryLoadCDNTextures(terrainMat: TerrainMaterial): void {
    const cdnBase = "https://assets.babylonjs.com/textures/";

    // Grass texture + normal map from CDN
    try {
      const grassCDN = new Texture(
        cdnBase + "grass.png",
        this.scene,
        false,
        true,
        Texture.TRILINEAR_SAMPLINGMODE,
        () => {
          grassCDN.uScale = grassCDN.vScale = 80;
          terrainMat.diffuseTexture1 = grassCDN;

          // Also try loading grass normal map
          try {
            const grassNormal = new Texture(
              cdnBase + "grassn.png",
              this.scene,
              false,
              true,
              Texture.TRILINEAR_SAMPLINGMODE,
              () => {
                grassNormal.uScale = grassNormal.vScale = 80;
                terrainMat.bumpTexture1 = grassNormal;
              }
            );
          } catch {
            /* keep without normal */
          }
        },
        () => {
          /* CDN failed, keep procedural */
        }
      );
    } catch {
      /* keep procedural */
    }

    // Ground/dirt texture from CDN
    try {
      const groundCDN = new Texture(
        cdnBase + "ground.jpg",
        this.scene,
        false,
        true,
        Texture.TRILINEAR_SAMPLINGMODE,
        () => {
          groundCDN.uScale = groundCDN.vScale = 80;
          terrainMat.diffuseTexture2 = groundCDN;
        },
        () => {
          /* CDN failed, keep procedural */
        }
      );
    } catch {
      /* keep procedural */
    }
  }

  private createSkybox(): void {
    // Simple gradient sky using a large sphere
    const sky = MeshBuilder.CreateSphere(
      "sky",
      { diameter: WORLD_SIZE * 2.5, segments: 16 },
      this.scene
    );
    const skyMat = new StandardMaterial("skyMat", this.scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = hexToColor3(COLORS.sky);
    skyMat.emissiveColor = hexToColor3(COLORS.sky);
    skyMat.specularColor = Color3.Black();
    skyMat.disableLighting = true;
    sky.material = skyMat;
    sky.infiniteDistance = true;

    // Set clear color
    this.scene.clearColor = new Color4(0.53, 0.81, 0.92, 1);
    // Fog for atmosphere
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0012;
    this.scene.fogColor = new Color3(0.6, 0.78, 0.85);
  }

  private createTree(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const treeNode = new TransformNode(`tree_${seed}`, this.scene);
    treeNode.position.set(x, WATER_LEVEL, z);

    const height = 2 + rng() * 3;
    const trunkWidth = 0.3 + rng() * 0.2;

    // Trunk with bark-like texture
    const trunk = MeshBuilder.CreateBox(
      `trunk_${seed}`,
      { width: trunkWidth, height: height, depth: trunkWidth },
      this.scene
    );
    const trunkMat = new StandardMaterial(`trunkMat_${seed}`, this.scene);
    const barkShade = 0.08 + rng() * 0.06;
    trunkMat.diffuseColor = new Color3(
      0.35 + barkShade,
      0.22 + barkShade * 0.5,
      0.1 + barkShade * 0.3
    );
    trunkMat.specularColor = new Color3(0.02, 0.02, 0.02);
    trunk.material = trunkMat;
    trunk.parent = treeNode;
    trunk.position.y = height / 2;

    // Leaves - blocky Minecraft style with varied greens
    const leafSize = 1.5 + rng() * 1.5;

    // Bottom leaf layer
    const leaf1 = MeshBuilder.CreateBox(
      `leaf1_${seed}`,
      { width: leafSize, height: leafSize * 0.6, depth: leafSize },
      this.scene
    );
    const leafMat1 = new StandardMaterial(`leafMat1_${seed}`, this.scene);
    const g1 = 0.35 + rng() * 0.3;
    leafMat1.diffuseColor = new Color3(0.1 + rng() * 0.1, g1, 0.08 + rng() * 0.08);
    leafMat1.emissiveColor = new Color3(0.02, 0.06, 0.02);
    leafMat1.specularColor = new Color3(0.03, 0.03, 0.03);
    leaf1.material = leafMat1;
    leaf1.parent = treeNode;
    leaf1.position.y = height;

    // Top leaf layer
    const leaf2 = MeshBuilder.CreateBox(
      `leaf2_${seed}`,
      {
        width: leafSize * 0.7,
        height: leafSize * 0.5,
        depth: leafSize * 0.7,
      },
      this.scene
    );
    const leafMat2 = new StandardMaterial(`leafMat2_${seed}`, this.scene);
    const g2 = 0.4 + rng() * 0.25;
    leafMat2.diffuseColor = new Color3(0.12 + rng() * 0.08, g2, 0.1 + rng() * 0.06);
    leafMat2.emissiveColor = new Color3(0.02, 0.05, 0.02);
    leafMat2.specularColor = new Color3(0.03, 0.03, 0.03);
    leaf2.material = leafMat2;
    leaf2.parent = treeNode;
    leaf2.position.y = height + leafSize * 0.5;

    // Random rotation for variety
    treeNode.rotation.y = rng() * Math.PI * 2;
  }

  private createTrees(waterSystem: WaterSystem): void {
    const rng = seededRandom(42);
    const treeCount = 600;

    for (let i = 0; i < treeCount; i++) {
      const x = (rng() - 0.5) * WORLD_SIZE * 0.9;
      const z = (rng() - 0.5) * WORLD_SIZE * 0.9;

      // Only place on land, not in rivers
      if (!waterSystem.isWater(x, z)) {
        // Place trees more densely near rivers (Delta vegetation)
        const nearRiver =
          waterSystem.isWater(x + 10, z) ||
          waterSystem.isWater(x - 10, z) ||
          waterSystem.isWater(x, z + 10) ||
          waterSystem.isWater(x, z - 10);

        if (nearRiver || rng() < 0.3) {
          this.createTree(x, z, i * 7 + 13);
        }
      }
    }
  }

  private createHouse(
    x: number,
    z: number,
    seed: number,
    near_river: boolean
  ): void {
    const rng = seededRandom(seed);
    const houseNode = new TransformNode(`house_${seed}`, this.scene);
    houseNode.position.set(x, WATER_LEVEL, z);
    houseNode.rotation.y = rng() * Math.PI * 2;

    const w = 2 + rng() * 2;
    const h = 1.5 + rng() * 1.5;
    const d = 2 + rng() * 2;

    // Stilts (Delta houses are often raised on stilts)
    if (near_river) {
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const stilt = MeshBuilder.CreateBox(
            `stilt_${seed}_${sx}_${sz}`,
            { width: 0.2, height: 1.5, depth: 0.2 },
            this.scene
          );
          stilt.material = this.createMat(`stiltMat_${seed}`, COLORS.wood);
          stilt.parent = houseNode;
          stilt.position.set((sx * w) / 2.5, 0.75, (sz * d) / 2.5);
        }
      }
    }

    const baseY = near_river ? 1.5 : 0;

    // Walls with slightly warm tones
    const walls = MeshBuilder.CreateBox(
      `walls_${seed}`,
      { width: w, height: h, depth: d },
      this.scene
    );
    const wallColors = ["#d4c5a0", "#c9b896", "#b8a882", "#e0d5b8"];
    const wallMat = new StandardMaterial(`wallMat_${seed}`, this.scene);
    wallMat.diffuseColor = hexToColor3(
      wallColors[Math.floor(rng() * wallColors.length)]
    );
    wallMat.specularColor = new Color3(0.03, 0.03, 0.03);
    walls.material = wallMat;
    walls.parent = houseNode;
    walls.position.y = baseY + h / 2;

    // Roof
    const roofColors = [COLORS.roof, COLORS.roofBlue, "#8b4513", "#2a6a3a"];
    const roof = MeshBuilder.CreateBox(
      `roof_${seed}`,
      { width: w + 0.5, height: 0.3, depth: d + 0.5 },
      this.scene
    );
    roof.material = this.createMat(
      `roofMat_${seed}`,
      roofColors[Math.floor(rng() * roofColors.length)]
    );
    roof.parent = houseNode;
    roof.position.y = baseY + h + 0.15;

    // Roof peak
    const peak = MeshBuilder.CreateBox(
      `peak_${seed}`,
      { width: w * 0.5, height: 0.5, depth: d + 0.3 },
      this.scene
    );
    peak.material = roof.material;
    peak.parent = houseNode;
    peak.position.y = baseY + h + 0.5;

    // Door
    const door = MeshBuilder.CreateBox(
      `door_${seed}`,
      { width: 0.6, height: 1.0, depth: 0.05 },
      this.scene
    );
    door.material = this.createMat(`doorMat_${seed}`, COLORS.woodDark);
    door.parent = houseNode;
    door.position.set(0, baseY + 0.5, d / 2 + 0.03);
  }

  private createHouses(waterSystem: WaterSystem): void {
    const rng = seededRandom(123);
    const houseCount = 80;

    for (let i = 0; i < houseCount; i++) {
      const x = (rng() - 0.5) * WORLD_SIZE * 0.85;
      const z = (rng() - 0.5) * WORLD_SIZE * 0.85;

      if (!waterSystem.isWater(x, z)) {
        const nearRiver =
          waterSystem.isWater(x + 12, z) ||
          waterSystem.isWater(x - 12, z) ||
          waterSystem.isWater(x, z + 12) ||
          waterSystem.isWater(x, z - 12);

        if (nearRiver) {
          this.createHouse(x, z, i * 13 + 7, true);
        } else if (rng() < 0.15) {
          this.createHouse(x, z, i * 13 + 7, false);
        }
      }
    }
  }

  private createDocks(): void {
    for (const dock of DOCK_LOCATIONS) {
      const dockNode = this.createDockMesh(dock);
      this.dockMeshes.set(dock.name, dockNode);
    }
  }

  private createDockMesh(dock: DockLocation): TransformNode {
    const node = new TransformNode(`dock_${dock.name}`, this.scene);
    node.position.set(dock.x, WATER_LEVEL, dock.z);
    node.rotation.y = dock.rotation;

    // Dock platform
    const platform = MeshBuilder.CreateBox(
      `dockPlat_${dock.name}`,
      { width: 3, height: 0.3, depth: 5 },
      this.scene
    );
    platform.material = this.createMat(`dockMat_${dock.name}`, COLORS.dock);
    platform.parent = node;
    platform.position.y = 0.3;

    // Support posts
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        const post = MeshBuilder.CreateBox(
          `dockPost_${dock.name}_${i}_${j}`,
          { width: 0.25, height: 1.5, depth: 0.25 },
          this.scene
        );
        post.material = this.createMat(
          `postMat_${dock.name}_${i}`,
          COLORS.woodDark
        );
        post.parent = node;
        post.position.set(i * 1.2, -0.2, j * 2);
      }
    }

    // Sign post
    const signPost = MeshBuilder.CreateBox(
      `signPost_${dock.name}`,
      { width: 0.15, height: 2.0, depth: 0.15 },
      this.scene
    );
    signPost.material = this.createMat(`signPostMat_${dock.name}`, "#666666");
    signPost.parent = node;
    signPost.position.set(1.3, 1.2, 0);

    // Sign
    const sign = MeshBuilder.CreateBox(
      `sign_${dock.name}`,
      { width: 1.5, height: 0.6, depth: 0.1 },
      this.scene
    );
    const signMat = new StandardMaterial(`signMat_${dock.name}`, this.scene);
    signMat.diffuseColor = new Color3(0.9, 0.85, 0.7);
    signMat.emissiveColor = new Color3(0.15, 0.12, 0.08);
    sign.material = signMat;
    sign.parent = node;
    sign.position.set(1.3, 2.1, 0);

    // Waiting area roof (small shelter)
    const shelter = MeshBuilder.CreateBox(
      `shelter_${dock.name}`,
      { width: 2.5, height: 0.1, depth: 2.5 },
      this.scene
    );
    shelter.material = this.createMat(
      `shelterMat_${dock.name}`,
      COLORS.roofBlue
    );
    shelter.parent = node;
    shelter.position.set(-0.5, 2.2, -1);

    // Shelter posts
    for (let i = -1; i <= 1; i += 2) {
      const sp = MeshBuilder.CreateBox(
        `shelterPost_${dock.name}_${i}`,
        { width: 0.1, height: 1.8, depth: 0.1 },
        this.scene
      );
      sp.material = this.createMat(`spMat_${dock.name}_${i}`, "#888888");
      sp.parent = node;
      sp.position.set(-0.5 + i * 1, 1.3, -2);
    }

    return node;
  }

  public getDockNode(name: string): TransformNode | undefined {
    return this.dockMeshes.get(name);
  }

  public highlightDock(name: string, highlight: boolean): void {
    const node = this.dockMeshes.get(name);
    if (!node) return;
    // Could add glow or color change - for now handled by UI indicators
  }
}
