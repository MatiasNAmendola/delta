import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { TerrainMaterial } from "@babylonjs/materials/terrain/terrainMaterial";
import { WATER_LEVEL, COLORS } from "../utils/constants";
import { degToRad, type Dock, type ScatterRule, type WorldDoc } from "./WorldDoc";
import { hexToColor3, seededRandom, clamp } from "../utils/helpers";
import { WaterSystem } from "./WaterSystem";
import { InstancedBoxBatch, propTransform } from "./InstancedBatch";

export class Environment {
  private scene: Scene;
  private world: WorldDoc;
  private props: PropBatches;
  /** Static meshes worth showing in the water reflection/refraction passes. */
  private reflectedMeshes: AbstractMesh[] = [];

  constructor(scene: Scene, waterSystem: WaterSystem, world: WorldDoc) {
    this.scene = scene;
    this.world = world;
    this.createGround(waterSystem);
    this.createSkybox();
    this.props = createPropBatches(scene);
    for (const rule of world.scatter) {
      this.scatter(rule, waterSystem);
    }
    for (const dock of world.docks) {
      this.addDock(dock);
    }
    for (const batch of Object.values(this.props)) {
      this.reflectedMeshes.push(batch.build());
    }
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
      { width: this.world.world.size, height: this.world.world.size, subdivisions, updatable: true },
      this.scene
    );
    ground.position.y = WATER_LEVEL - 0.3;
    ground.receiveShadows = true;
    this.reflectedMeshes.push(ground);

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

    const half = this.world.world.size / 2;
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
        const worldX = (px / size - 0.5) * this.world.world.size;
        const worldZ = (py / size - 0.5) * this.world.world.size;

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
      { diameter: this.world.world.size * 2.5, segments: 16 },
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
    sky.isPickable = false;
    skyMat.freeze();
    this.reflectedMeshes.push(sky);

    // Set clear color
    this.scene.clearColor = new Color4(0.53, 0.81, 0.92, 1);
    // Fog for atmosphere
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0012;
    this.scene.fogColor = new Color3(0.6, 0.78, 0.85);
  }

  /** Blocky Minecraft-style tree: one trunk and two leaf layers. */
  private addTree(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const p = this.props;

    const height = 2 + rng() * 3;
    const trunkWidth = 0.3 + rng() * 0.2;
    const barkShade = 0.08 + rng() * 0.06;
    const trunkColor = new Color3(0.35 + barkShade, 0.22 + barkShade * 0.5, 0.1 + barkShade * 0.3);

    const leafSize = 1.5 + rng() * 1.5;
    const g1 = 0.35 + rng() * 0.3;
    const leaf1Color = new Color3(0.1 + rng() * 0.1, g1, 0.08 + rng() * 0.08);
    const g2 = 0.4 + rng() * 0.25;
    const leaf2Color = new Color3(0.12 + rng() * 0.08, g2, 0.1 + rng() * 0.06);

    const parent = propTransform(x, WATER_LEVEL, z, rng() * Math.PI * 2);
    p.trunks.add(parent, [trunkWidth, height, trunkWidth], [0, height / 2, 0], trunkColor);
    p.leavesLow.add(parent, [leafSize, leafSize * 0.6, leafSize], [0, height, 0], leaf1Color);
    p.leavesHigh.add(
      parent,
      [leafSize * 0.7, leafSize * 0.5, leafSize * 0.7],
      [0, height + leafSize * 0.5, 0],
      leaf2Color
    );
  }

  /** Delta house; next to the water it stands on stilts. */
  private addHouse(x: number, z: number, seed: number, onStilts: boolean): void {
    const rng = seededRandom(seed);
    const p = this.props;
    const parent = propTransform(x, WATER_LEVEL, z, rng() * Math.PI * 2);

    const w = 2 + rng() * 2;
    const h = 1.5 + rng() * 1.5;
    const d = 2 + rng() * 2;

    if (onStilts) {
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          p.stilts.add(parent, [0.2, 1.5, 0.2], [(sx * w) / 2.5, 0.75, (sz * d) / 2.5], COLOR.wood);
        }
      }
    }
    const baseY = onStilts ? 1.5 : 0;

    const wallColor = WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)];
    p.walls.add(parent, [w, h, d], [0, baseY + h / 2, 0], wallColor);

    const roofColor = ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)];
    p.roofs.add(parent, [w + 0.5, 0.3, d + 0.5], [0, baseY + h + 0.15, 0], roofColor);
    p.roofs.add(parent, [w * 0.5, 0.5, d + 0.3], [0, baseY + h + 0.5, 0], roofColor);

    p.doors.add(parent, [0.6, 1.0, 0.05], [0, baseY + 0.5, d / 2 + 0.03], COLOR.woodDark);
  }

  /**
   * Deterministic placement from a World Doc scatter rule: candidates land
   * only on dry ground; next to water they are always placed, inland only
   * with `inlandChance`.
   */
  private scatter(rule: ScatterRule, waterSystem: WaterSystem): void {
    const rng = seededRandom(rule.seed);
    const range = this.world.world.size * rule.spread;
    const d = rule.nearWaterDistance;

    for (let i = 0; i < rule.attempts; i++) {
      const x = (rng() - 0.5) * range;
      const z = (rng() - 0.5) * range;

      if (waterSystem.isWater(x, z)) continue;

      const nearWater =
        waterSystem.isWater(x + d, z) ||
        waterSystem.isWater(x - d, z) ||
        waterSystem.isWater(x, z + d) ||
        waterSystem.isWater(x, z - d);

      if (!nearWater && rng() >= rule.inlandChance) continue;

      const seed = i * rule.instanceSeed.stride + rule.instanceSeed.offset;
      switch (rule.prefab) {
        case "tree":
          this.addTree(x, z, seed);
          break;
        case "house":
          this.addHouse(x, z, seed, nearWater);
          break;
      }
    }
  }

  /** Bus-boat stop: platform on posts, sign and a small shelter. */
  private addDock(dock: Dock): void {
    const p = this.props;
    const parent = propTransform(dock.x, WATER_LEVEL, dock.z, degToRad(dock.rotationDeg));

    p.dockPlatforms.add(parent, [3, 0.3, 5], [0, 0.3, 0], COLOR.dock);
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        p.dockPosts.add(parent, [0.25, 1.5, 0.25], [i * 1.2, -0.2, j * 2], COLOR.woodDark);
      }
    }
    p.dockPosts.add(parent, [0.15, 2.0, 0.15], [1.3, 1.2, 0], COLOR.signPost);
    p.signs.add(parent, [1.5, 0.6, 0.1], [1.3, 2.1, 0], COLOR.sign);
    p.dockPlatforms.add(parent, [2.5, 0.1, 2.5], [-0.5, 2.2, -1], COLOR.roofBlue);
    for (let i = -1; i <= 1; i += 2) {
      p.dockPosts.add(parent, [0.1, 1.8, 0.1], [-0.5 + i * 1, 1.3, -2], COLOR.shelterPost);
    }
  }

  /** Static meshes worth showing in the water reflection/refraction passes. */
  public getReflectedMeshes(): AbstractMesh[] {
    return this.reflectedMeshes;
  }
}

const COLOR = {
  wood: hexToColor3(COLORS.wood),
  woodDark: hexToColor3(COLORS.woodDark),
  dock: hexToColor3(COLORS.dock),
  roofBlue: hexToColor3(COLORS.roofBlue),
  signPost: hexToColor3("#666666"),
  shelterPost: hexToColor3("#888888"),
  sign: new Color3(0.9, 0.85, 0.7),
};
const WALL_COLORS = ["#d4c5a0", "#c9b896", "#b8a882", "#e0d5b8"].map(hexToColor3);
const ROOF_COLORS = [COLORS.roof, COLORS.roofBlue, "#8b4513", "#2a6a3a"].map(hexToColor3);

/** One draw call per kind of prop part, shared by every instance in the world. */
function createPropBatches(scene: Scene) {
  const matte = new Color3(0.03, 0.03, 0.03);
  return {
    trunks: new InstancedBoxBatch("trunks", scene, { specular: new Color3(0.02, 0.02, 0.02) }),
    leavesLow: new InstancedBoxBatch("leavesLow", scene, { specular: matte, emissive: new Color3(0.02, 0.06, 0.02) }),
    leavesHigh: new InstancedBoxBatch("leavesHigh", scene, { specular: matte, emissive: new Color3(0.02, 0.05, 0.02) }),
    stilts: new InstancedBoxBatch("stilts", scene),
    walls: new InstancedBoxBatch("walls", scene, { specular: matte }),
    roofs: new InstancedBoxBatch("roofs", scene),
    doors: new InstancedBoxBatch("doors", scene),
    dockPlatforms: new InstancedBoxBatch("dockPlatforms", scene),
    dockPosts: new InstancedBoxBatch("dockPosts", scene),
    signs: new InstancedBoxBatch("signs", scene, { emissive: new Color3(0.15, 0.12, 0.08) }),
  };
}
type PropBatches = ReturnType<typeof createPropBatches>;
