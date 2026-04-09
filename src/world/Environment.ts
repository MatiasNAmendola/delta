import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
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
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import { hexToColor3, seededRandom } from "../utils/helpers";
import { WaterSystem } from "./WaterSystem";
import { createProcTreeMesh, TREE_PRESETS } from "./ProcTreeMesh";

export class Environment {
  private scene: Scene;
  private dockMeshes: Map<string, TransformNode> = new Map();
  private matCache: Map<string, StandardMaterial> = new Map();

  private waterSystem!: WaterSystem;

  constructor(scene: Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.waterSystem = waterSystem;
    this.createGround(waterSystem);
    this.createTrees(waterSystem);
    this.createHouses(waterSystem);
    this.createDocks();
    // Load GLB vegetation async (replaces procedural boxes)
    this.loadVegetationModels();
  }

  /** Shared material cache — one material per color, reused everywhere */
  private createMat(name: string, color: string): StandardMaterial {
    const cached = this.matCache.get(color);
    if (cached) return cached;
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = hexToColor3(color);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.matCache.set(color, mat);
    return mat;
  }

  /** Simple value noise for coherent terrain patterns */
  private noise2D(x: number, z: number, seed: number): number {
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
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const v00 = hash(ix, iz);
    const v10 = hash(ix + 1, iz);
    const v01 = hash(ix, iz + 1);
    const v11 = hash(ix + 1, iz + 1);
    return v00 * (1 - sx) * (1 - sz) + v10 * sx * (1 - sz) + v01 * (1 - sx) * sz + v11 * sx * sz;
  }

  /** Multi-octave fractal noise */
  private fbm(x: number, z: number, octaves: number, seed: number): number {
    let value = 0, amplitude = 0.5, frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, z * frequency, seed + i * 31) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }

  private createGround(waterSystem: WaterSystem): void {
    const subdivisions = 64;
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: WORLD_SIZE, height: WORLD_SIZE, subdivisions, updatable: true },
      this.scene
    );
    ground.position.y = WATER_LEVEL - 0.3;
    ground.receiveShadows = true;

    // Displace vertices for terrain elevation
    this.displaceTerrainVertices(ground, waterSystem);

    // TerrainMaterial: splatmap (low-res, controls blending) + tiling detail textures (high-res)
    try {
      const terrainMat = new TerrainMaterial("terrainMat", this.scene);

      // Splatmap: R=grass, G=dirt, B=sand — 512px is enough for zone blending
      terrainMat.mixTexture = this.createSplatmap(waterSystem);

      // Grass detail (R channel) — tiling 256x256 texture repeated across terrain
      const grassTex = this.createProceduralDetail("grass", [
        [0.28, 0.52, 0.14], [0.22, 0.45, 0.10], [0.35, 0.58, 0.18], [0.20, 0.40, 0.08]
      ]);
      grassTex.uScale = grassTex.vScale = 80;
      terrainMat.diffuseTexture1 = grassTex;

      // Dirt detail (G channel)
      const dirtTex = this.createProceduralDetail("dirt", [
        [0.47, 0.36, 0.20], [0.40, 0.30, 0.16], [0.52, 0.40, 0.24], [0.44, 0.33, 0.18]
      ]);
      dirtTex.uScale = dirtTex.vScale = 80;
      terrainMat.diffuseTexture2 = dirtTex;

      // Sand detail (B channel)
      const sandTex = this.createProceduralDetail("sand", [
        [0.72, 0.62, 0.38], [0.68, 0.58, 0.34], [0.76, 0.66, 0.42], [0.65, 0.55, 0.30]
      ]);
      sandTex.uScale = sandTex.vScale = 80;
      terrainMat.diffuseTexture3 = sandTex;

      terrainMat.specularColor = new Color3(0.05, 0.05, 0.05);
      terrainMat.specularPower = 4;
      ground.material = terrainMat;
    } catch (e) {
      console.warn("TerrainMaterial failed, using fallback:", e);
      const fallback = new StandardMaterial("groundFallback", this.scene);
      fallback.diffuseColor = hexToColor3(COLORS.grass);
      fallback.specularColor = new Color3(0.05, 0.05, 0.05);
      ground.material = fallback;
    }
  }

  /** Create a 256x256 tiling procedural detail texture for terrain */
  private createProceduralDetail(name: string, palette: number[][]): DynamicTexture {
    const size = 256;
    const tex = new DynamicTexture(`detail_${name}`, size, this.scene, true);
    const ctx = tex.getContext();

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        // Multi-frequency noise for natural detail
        const n1 = this.noise2D(px * 0.08, py * 0.08, 101);
        const n2 = this.noise2D(px * 0.2, py * 0.2, 202);
        const n3 = this.noise2D(px * 0.5, py * 0.5, 303);

        // Pick color from palette based on noise
        const idx = Math.floor(n1 * palette.length) % palette.length;
        const base = palette[idx];
        const variation = (n2 - 0.5) * 0.1 + (n3 - 0.5) * 0.06;

        const r = Math.max(0, Math.min(1, base[0] + variation));
        const g = Math.max(0, Math.min(1, base[1] + variation));
        const b = Math.max(0, Math.min(1, base[2] + variation * 0.5));

        ctx.fillStyle = `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    tex.update();
    return tex;
  }

  /** Displace terrain vertices — raise land, drop water areas */
  private displaceTerrainVertices(ground: Mesh, waterSystem: WaterSystem): void {
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const half = WORLD_SIZE / 2;
    for (let i = 0; i < positions.length; i += 3) {
      const worldX = positions[i];
      const worldZ = positions[i + 2];

      if (waterSystem.isWater(worldX, worldZ)) {
        positions[i + 1] = -0.5;
        continue;
      }

      // Estimate distance to water for smooth transition
      let nearWater = false;
      for (const d of [3, 6, 10]) {
        for (let dir = 0; dir < 4; dir++) {
          const angle = (dir / 4) * Math.PI * 2;
          if (waterSystem.isWater(worldX + Math.cos(angle) * d, worldZ + Math.sin(angle) * d)) {
            nearWater = true;
            break;
          }
        }
        if (nearWater) break;
      }

      if (nearWater) {
        const bankHeight = this.fbm(worldX * 0.02, worldZ * 0.02, 3, 42) * 0.8;
        positions[i + 1] = Math.max(0, bankHeight);
      } else {
        const edgeFade = 1 - Math.max(Math.abs(worldX) / half, Math.abs(worldZ) / half);
        const height =
          this.fbm(worldX * 0.008, worldZ * 0.008, 4, 42) * 4.0 +
          this.fbm(worldX * 0.025, worldZ * 0.025, 2, 99) * 1.0;
        positions[i + 1] = Math.max(0.2, height * Math.max(0, edgeFade));
      }
    }

    ground.setVerticesData(VertexBuffer.PositionKind, positions);
    ground.createNormals(true);
  }

  /** Create splatmap for TerrainMaterial: R=grass, G=dirt, B=sand */
  private createSplatmap(waterSystem: WaterSystem): DynamicTexture {
    const size = 512;
    const tex = new DynamicTexture("splatmap", size, this.scene, false);
    const ctx = tex.getContext();

    const half = WORLD_SIZE / 2;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const worldX = (px / size) * WORLD_SIZE - half;
        const worldZ = (py / size) * WORLD_SIZE - half;

        const inWater = waterSystem.isWater(worldX, worldZ);

        // Estimate distance to nearest water
        let nearWaterDist = 999;
        if (inWater) {
          nearWaterDist = 0;
        } else {
          for (const d of [2, 5, 10, 18, 30]) {
            for (let dir = 0; dir < 8; dir++) {
              const angle = (dir / 8) * Math.PI * 2;
              if (waterSystem.isWater(worldX + Math.cos(angle) * d, worldZ + Math.sin(angle) * d)) {
                nearWaterDist = d;
                break;
              }
            }
            if (nearWaterDist < 999) break;
          }
        }

        // Noise for organic transitions
        const n1 = this.noise2D(worldX * 0.04, worldZ * 0.04, 7);
        const noisyDist = nearWaterDist + (n1 - 0.5) * 8;

        // Blend weights: R=grass, G=dirt, B=sand
        let rGrass = 0, gDirt = 0, bSand = 0;

        if (inWater || noisyDist < 3) {
          // At waterline: sand
          bSand = 1;
        } else if (noisyDist < 8) {
          // Sand -> dirt transition
          const t = (noisyDist - 3) / 5;
          bSand = 1 - t;
          gDirt = t;
        } else if (noisyDist < 18) {
          // Dirt -> grass transition
          const t = (noisyDist - 8) / 10;
          gDirt = 1 - t;
          rGrass = t;
        } else {
          // Full grass
          rGrass = 1;
        }

        ctx.fillStyle = `rgb(${Math.floor(rGrass * 255)},${Math.floor(gDirt * 255)},${Math.floor(bSand * 255)})`;
        ctx.fillRect(px, py, 1, 1);
      }
    }

    tex.update();
    return tex;
  }

  // Tree type 0: Weeping willow — procedural branching with drooping shape
  private createWeepingWillow(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const trunkMat = this.createMat("willowTrunk", COLORS.wood);
    const leafMat = this.createMat("willowLeaf", COLORS.willowLeaf);
    const scale = 1.8 + rng() * 1.5;
    const tree = createProcTreeMesh(`willow_${seed}`, this.scene, trunkMat, leafMat,
      { ...TREE_PRESETS.willow, seed: seed }, scale);
    tree.position.set(x, WATER_LEVEL, z);
    tree.rotation.y = rng() * Math.PI * 2;
  }

  // Tree type 1: Tall poplar — procedural columnar branching
  private createPoplar(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const trunkMat = this.createMat("poplarTrunk", COLORS.woodDark);
    const leafMat = this.createMat("poplarLeaf", COLORS.poplarLeaf);
    const scale = 1.5 + rng() * 1.2;
    const tree = createProcTreeMesh(`poplar_${seed}`, this.scene, trunkMat, leafMat,
      { ...TREE_PRESETS.poplar, seed: seed }, scale);
    tree.position.set(x, WATER_LEVEL, z);
    tree.rotation.y = rng() * Math.PI * 2;
  }

  // Tree type 2: Regular/eucalyptus — procedural branching tree
  private createRegularTree(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const leafColors = [COLORS.leaves, COLORS.leavesDark, COLORS.leavesLight];
    const trunkMat = this.createMat("treeTrunk", COLORS.wood);
    const leafMat = this.createMat("treeLeaf", leafColors[seed % 3]);
    const scale = 1.5 + rng() * 1.5;
    const tree = createProcTreeMesh(`tree_${seed}`, this.scene, trunkMat, leafMat,
      { ...TREE_PRESETS.regular, seed: seed }, scale);
    tree.position.set(x, WATER_LEVEL, z);
    tree.rotation.y = rng() * Math.PI * 2;
  }

  /** Compute approximate distance from a point to the nearest river edge */
  private distToRiver(x: number, z: number): number {
    let minDist = Infinity;
    for (const river of RIVER_MAP) {
      const samples = river.points.length * 3;
      for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        const totalSeg = river.points.length - 1;
        const segT = t * totalSeg;
        const seg = Math.min(Math.floor(segT), totalSeg - 1);
        const lt = segT - seg;
        const p1 = river.points[seg];
        const p2 = river.points[Math.min(river.points.length - 1, seg + 1)];
        const rx = p1[0] + (p2[0] - p1[0]) * lt;
        const rz = p1[1] + (p2[1] - p1[1]) * lt;
        const dx = x - rx;
        const dz = z - rz;
        const d = Math.sqrt(dx * dx + dz * dz) - river.width / 2;
        if (d < minDist) minDist = d;
      }
    }
    return minDist;
  }

  private createTrees(waterSystem: WaterSystem): void {
    const rng = seededRandom(42);
    const treeCount = 400;

    for (let i = 0; i < treeCount; i++) {
      const x = (rng() - 0.5) * WORLD_SIZE * 0.9;
      const z = (rng() - 0.5) * WORLD_SIZE * 0.9;

      // Only place on land, not in rivers
      if (waterSystem.isWater(x, z)) continue;

      const dist = this.distToRiver(x, z);

      // Dense placement near rivers (wall-to-wall vegetation at water's edge)
      // Very close to river (0-8m): almost always place
      // Near river (8-25m): high chance
      // Medium distance (25-60m): moderate chance
      // Far away (>60m): sparse
      let placeChance: number;
      if (dist < 8) {
        placeChance = 0.95;
      } else if (dist < 25) {
        placeChance = 0.7;
      } else if (dist < 60) {
        placeChance = 0.35;
      } else {
        placeChance = 0.15;
      }

      if (rng() > placeChance) continue;

      const seed = i * 7 + 13;
      const typeRng = seededRandom(seed + 99);
      const typeVal = typeRng();

      if (dist < 12 && typeVal < 0.3) {
        // Weeping willows favor riverbanks
        this.createWeepingWillow(x, z, seed);
      } else if (typeVal < 0.5) {
        // Tall poplars scattered throughout
        this.createPoplar(x, z, seed);
      } else {
        // Regular / eucalyptus trees
        this.createRegularTree(x, z, seed);
      }
    }
  }

  /** Load GLB vegetation models (bushes, flowers, grass) and scatter along rivers */
  private async loadVegetationModels(): Promise<void> {
    const modelNames = [
      { file: "bush1.glb", type: "bush" },
      { file: "bush2.glb", type: "bush" },
      { file: "bush3.glb", type: "bush" },
      { file: "flower1.glb", type: "flower" },
      { file: "flower2.glb", type: "flower" },
      { file: "flower3.glb", type: "flower" },
      { file: "grass1.glb", type: "grass" },
    ];

    // Resolve model URL relative to the page base
    const base = document.querySelector("base")?.href || window.location.href;
    const modelsUrl = new URL("models/vegetation/", base).href;

    // Load all models in parallel
    const templates: { mesh: Mesh; type: string }[] = [];
    const results = await Promise.allSettled(
      modelNames.map(async (m) => {
        try {
          const result = await SceneLoader.ImportMeshAsync("", modelsUrl, m.file, this.scene);
          if (result.meshes.length > 0) {
            // Merge all meshes into one for easy cloning
            const root = result.meshes[0] as Mesh;
            root.setEnabled(false); // template hidden
            root.name = `vegTemplate_${m.file}`;
            templates.push({ mesh: root, type: m.type });
          }
        } catch (e) {
          console.warn(`Failed to load ${m.file}:`, e);
        }
      })
    );

    if (templates.length === 0) {
      console.warn("No vegetation models loaded, skipping");
      return;
    }

    const bushTemplates = templates.filter((t) => t.type === "bush");
    const flowerTemplates = templates.filter((t) => t.type === "flower");
    const grassTemplates = templates.filter((t) => t.type === "grass");

    console.log(`Vegetation loaded: ${bushTemplates.length} bushes, ${flowerTemplates.length} flowers, ${grassTemplates.length} grass`);

    // Scatter along rivers
    const rng = seededRandom(777);
    let placed = 0;

    for (const river of RIVER_MAP) {
      const pathLen = river.points.length - 1;
      const samplesPerSegment = 3;
      const totalSamples = pathLen * samplesPerSegment;

      for (let i = 0; i < totalSamples; i++) {
        const t = i / totalSamples;
        const totalSeg = river.points.length - 1;
        const segT = t * totalSeg;
        const seg = Math.min(Math.floor(segT), totalSeg - 1);
        const lt = segT - seg;
        const p1 = river.points[seg];
        const p2 = river.points[Math.min(river.points.length - 1, seg + 1)];
        const cx = p1[0] + (p2[0] - p1[0]) * lt;
        const cz = p1[1] + (p2[1] - p1[1]) * lt;
        const nx = -(p2[1] - p1[1]) / (Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) || 1);
        const nz = (p2[0] - p1[0]) / (Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) || 1);
        const halfW = river.width / 2;

        for (const side of [-1, 1]) {
          // Bushes: 2-8m from water
          if (bushTemplates.length > 0 && rng() < 0.4) {
            const dist = halfW + 2 + rng() * 6;
            const px = cx + nx * dist * side + (rng() - 0.5) * 3;
            const pz = cz + nz * dist * side + (rng() - 0.5) * 3;
            if (!this.waterSystem.isWater(px, pz)) {
              const tpl = bushTemplates[Math.floor(rng() * bushTemplates.length)];
              const clone = tpl.mesh.clone(`bush_${placed}`, null);
              if (clone) {
                clone.setEnabled(true);
                const scale = 0.4 + rng() * 0.6;
                clone.scaling.setAll(scale);
                clone.position.set(px, WATER_LEVEL + 0.3, pz);
                clone.rotation.y = rng() * Math.PI * 2;
                placed++;
              }
            }
          }

          // Flowers: 1-5m from water, smaller
          if (flowerTemplates.length > 0 && rng() < 0.3) {
            const dist = halfW + 1 + rng() * 4;
            const px = cx + nx * dist * side + (rng() - 0.5) * 2;
            const pz = cz + nz * dist * side + (rng() - 0.5) * 2;
            if (!this.waterSystem.isWater(px, pz)) {
              const tpl = flowerTemplates[Math.floor(rng() * flowerTemplates.length)];
              const clone = tpl.mesh.clone(`flower_${placed}`, null);
              if (clone) {
                clone.setEnabled(true);
                const scale = 0.2 + rng() * 0.4;
                clone.scaling.setAll(scale);
                clone.position.set(px, WATER_LEVEL + 0.2, pz);
                clone.rotation.y = rng() * Math.PI * 2;
                placed++;
              }
            }
          }

          // Grass clumps: at water edge
          if (grassTemplates.length > 0 && rng() < 0.5) {
            const dist = halfW + rng() * 2;
            const px = cx + nx * dist * side + (rng() - 0.5) * 1.5;
            const pz = cz + nz * dist * side + (rng() - 0.5) * 1.5;
            if (!this.waterSystem.isWater(px, pz)) {
              const tpl = grassTemplates[Math.floor(rng() * grassTemplates.length)];
              const clone = tpl.mesh.clone(`grass_${placed}`, null);
              if (clone) {
                clone.setEnabled(true);
                const scale = 0.3 + rng() * 0.5;
                clone.scaling.setAll(scale);
                clone.position.set(px, WATER_LEVEL + 0.1, pz);
                clone.rotation.y = rng() * Math.PI * 2;
                placed++;
              }
            }
          }
        }
      }
    }
    console.log(`Vegetation: ${placed} instances placed`);
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

    // Walls
    const walls = MeshBuilder.CreateBox(
      `walls_${seed}`,
      { width: w, height: h, depth: d },
      this.scene
    );
    const wallColors = ["#d4c5a0", "#c9b896", "#b8a882", "#e0d5b8"];
    walls.material = this.createMat(
      `wallMat_${seed}`,
      wallColors[Math.floor(rng() * wallColors.length)]
    );
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

    const rng = seededRandom(
      Math.abs(dock.x * 73 + dock.z * 137 + dock.name.length * 51)
    );

    // --- Dock dimensions (varied per dock) ---
    const platW = 3.5 + rng() * 1.5; // width (x-axis)
    const platD = 5 + rng() * 2; // depth (z-axis)
    const platThick = 0.2;
    const platHeight = 1.8 + rng() * 0.6; // elevation above water

    // --- Shared materials ---
    const woodMat = this.createMat(`dkWood_${dock.name}`, COLORS.dock);
    const woodDarkMat = this.createMat(`dkWoodDk_${dock.name}`, COLORS.woodDark);
    const woodLightMat = this.createMat(`dkWoodLt_${dock.name}`, COLORS.woodLight);

    // =============================================
    // 1. STILTS / PILOTES – cylindrical, into water
    // =============================================
    const stiltRadius = 0.12;
    const stiltDepth = 1.5; // below water line
    const stiltH = platHeight + stiltDepth;
    const colsX = [-platW / 2 + 0.4, platW / 2 - 0.4];
    const rowsZ = [-platD / 2 + 0.5, 0, platD / 2 - 0.5];
    let stiltIdx = 0;
    for (const sx of colsX) {
      for (const sz of rowsZ) {
        const stilt = MeshBuilder.CreateCylinder(
          `dkSt_${dock.name}_${stiltIdx}`,
          { diameter: stiltRadius * 2, height: stiltH, tessellation: 8 },
          this.scene
        );
        stilt.material = woodDarkMat;
        stilt.parent = node;
        stilt.position.set(sx, platHeight - stiltH / 2, sz);
        stiltIdx++;
      }
    }

    // =============================================
    // 2. PLATFORM WITH PLANK LINES
    // =============================================
    const platform = MeshBuilder.CreateBox(
      `dkPlat_${dock.name}`,
      { width: platW, height: platThick, depth: platD },
      this.scene
    );
    platform.material = woodMat;
    platform.parent = node;
    platform.position.y = platHeight;

    // Plank gap lines across the surface
    const plankCount = Math.floor(platD / 0.5);
    for (let p = 0; p < plankCount; p++) {
      const plank = MeshBuilder.CreateBox(
        `dkPl_${dock.name}_${p}`,
        { width: platW - 0.1, height: 0.02, depth: 0.05 },
        this.scene
      );
      plank.material = woodDarkMat;
      plank.parent = node;
      plank.position.set(
        0,
        platHeight + platThick / 2 + 0.01,
        -platD / 2 + 0.25 + p * (platD / plankCount)
      );
    }

    // Cross beams underneath
    for (const sz of rowsZ) {
      const beam = MeshBuilder.CreateBox(
        `dkBm_${dock.name}_${sz}`,
        { width: platW - 0.2, height: 0.15, depth: 0.12 },
        this.scene
      );
      beam.material = woodDarkMat;
      beam.parent = node;
      beam.position.set(0, platHeight - platThick / 2 - 0.08, sz);
    }

    // =============================================
    // 3. STAIRS / ESCALERAS toward the water (+z)
    // =============================================
    const stairCount = 4;
    const stairW = 1.2;
    const stairStepH = platHeight / stairCount;
    const stairStepD = 0.4;
    for (let s = 0; s < stairCount; s++) {
      const step = MeshBuilder.CreateBox(
        `dkStp_${dock.name}_${s}`,
        { width: stairW, height: 0.1, depth: stairStepD },
        this.scene
      );
      step.material = s % 2 === 0 ? woodMat : woodLightMat;
      step.parent = node;
      step.position.set(
        0,
        platHeight - stairStepH * (s + 0.5),
        platD / 2 + stairStepD * (s + 0.5)
      );

      // Riser face
      if (s < stairCount - 1) {
        const riser = MeshBuilder.CreateBox(
          `dkRs_${dock.name}_${s}`,
          { width: stairW, height: stairStepH - 0.1, depth: 0.06 },
          this.scene
        );
        riser.material = woodDarkMat;
        riser.parent = node;
        riser.position.set(
          0,
          platHeight - stairStepH * (s + 1),
          platD / 2 + stairStepD * s + stairStepD * 0.25
        );
      }
    }

    // Stair side stringers
    for (const side of [-1, 1]) {
      const sLen = Math.sqrt(
        (stairCount * stairStepD) ** 2 + platHeight ** 2
      );
      const stringer = MeshBuilder.CreateBox(
        `dkStr_${dock.name}_${side}`,
        { width: 0.08, height: 0.08, depth: sLen },
        this.scene
      );
      stringer.material = woodDarkMat;
      stringer.parent = node;
      stringer.rotation.x = Math.atan2(platHeight, stairCount * stairStepD);
      stringer.position.set(
        (side * stairW) / 2,
        platHeight / 2,
        platD / 2 + (stairCount * stairStepD) / 2
      );
    }

    // =============================================
    // 4. ROOF – colored chapa, triangular or flat
    // =============================================
    const roofColors = ["#2a9d8f", "#3a8a5c", "#6b8f71", "#d4534a", "#4a7aaa", "#5f8a8b"];
    const roofColor = roofColors[Math.floor(rng() * roofColors.length)];
    const roofMat = this.createMat(`dkRf_${dock.name}`, roofColor);

    const roofW = platW + 0.8;
    const roofD = platD * 0.65;
    const roofBaseY = platHeight + 2.2;
    const roofPeakH = 0.7 + rng() * 0.4;
    const hasGableRoof = rng() > 0.3;

    // Roof support posts (4 corners of covered section)
    const roofPostH = 2.2;
    const roofZ0 = -platD / 2 + roofD / 2;
    const rpPos: [number, number][] = [
      [-platW / 2 + 0.3, roofZ0 - roofD / 2 + 0.3],
      [platW / 2 - 0.3, roofZ0 - roofD / 2 + 0.3],
      [-platW / 2 + 0.3, roofZ0 + roofD / 2 - 0.3],
      [platW / 2 - 0.3, roofZ0 + roofD / 2 - 0.3],
    ];
    for (let rp = 0; rp < rpPos.length; rp++) {
      const post = MeshBuilder.CreateCylinder(
        `dkRP_${dock.name}_${rp}`,
        { diameter: 0.12, height: roofPostH, tessellation: 8 },
        this.scene
      );
      post.material = woodDarkMat;
      post.parent = node;
      post.position.set(rpPos[rp][0], platHeight + roofPostH / 2, rpPos[rp][1]);
    }

    if (hasGableRoof) {
      // Two angled panels forming a gable / A-frame
      const halfSpan = roofW / 2;
      const panelLen = Math.sqrt(halfSpan * halfSpan + roofPeakH * roofPeakH);
      for (const side of [-1, 1]) {
        const panel = MeshBuilder.CreateBox(
          `dkRfP_${dock.name}_${side}`,
          { width: panelLen + 0.1, height: 0.06, depth: roofD + 0.3 },
          this.scene
        );
        panel.material = roofMat;
        panel.parent = node;
        panel.rotation.z = -side * Math.atan2(roofPeakH, halfSpan);
        panel.position.set((side * halfSpan) / 2, roofBaseY + roofPeakH / 2, roofZ0);
      }
      // Ridge beam
      const ridge = MeshBuilder.CreateBox(
        `dkRdg_${dock.name}`,
        { width: 0.1, height: 0.1, depth: roofD + 0.4 },
        this.scene
      );
      ridge.material = woodDarkMat;
      ridge.parent = node;
      ridge.position.set(0, roofBaseY + roofPeakH, roofZ0);
    } else {
      // Flat chapa roof with slight rain slope
      const flat = MeshBuilder.CreateBox(
        `dkRfFlat_${dock.name}`,
        { width: roofW, height: 0.06, depth: roofD + 0.3 },
        this.scene
      );
      flat.material = roofMat;
      flat.parent = node;
      flat.rotation.x = 0.05;
      flat.position.set(0, roofBaseY, roofZ0);
    }

    // Chapa corrugation strips
    const corrCount = Math.floor(roofD / 0.4);
    for (let c = 0; c < corrCount; c++) {
      const strip = MeshBuilder.CreateBox(
        `dkCrr_${dock.name}_${c}`,
        { width: roofW - 0.2, height: 0.025, depth: 0.04 },
        this.scene
      );
      strip.material = woodDarkMat;
      strip.parent = node;
      strip.position.set(
        0,
        roofBaseY + (hasGableRoof ? roofPeakH * 0.3 : 0.04),
        roofZ0 - roofD / 2 + 0.2 + c * (roofD / corrCount)
      );
    }

    // =============================================
    // 5. RAILINGS / BARANDAS
    // =============================================
    const railH = 0.9;
    const railPostSpacing = 1.2;

    // Side rails along both x-edges
    for (const side of [-1, 1]) {
      const numPosts = Math.max(2, Math.floor(platD / railPostSpacing) + 1);
      for (let rp = 0; rp < numPosts; rp++) {
        const pz = -platD / 2 + rp * (platD / (numPosts - 1));
        const post = MeshBuilder.CreateCylinder(
          `dkRlP_${dock.name}_${side}_${rp}`,
          { diameter: 0.08, height: railH, tessellation: 6 },
          this.scene
        );
        post.material = woodDarkMat;
        post.parent = node;
        post.position.set((side * platW) / 2, platHeight + railH / 2, pz);
      }
      // Horizontal rail bar
      const railBar = MeshBuilder.CreateBox(
        `dkRlB_${dock.name}_${side}`,
        { width: 0.06, height: 0.06, depth: platD },
        this.scene
      );
      railBar.material = woodLightMat;
      railBar.parent = node;
      railBar.position.set((side * platW) / 2, platHeight + railH * 0.85, 0);
    }

    // Back rail along -z edge
    const backPosts = Math.max(2, Math.floor(platW / railPostSpacing) + 1);
    for (let bp = 0; bp < backPosts; bp++) {
      const px = -platW / 2 + bp * (platW / (backPosts - 1));
      const post = MeshBuilder.CreateCylinder(
        `dkBkP_${dock.name}_${bp}`,
        { diameter: 0.08, height: railH, tessellation: 6 },
        this.scene
      );
      post.material = woodDarkMat;
      post.parent = node;
      post.position.set(px, platHeight + railH / 2, -platD / 2);
    }
    const backBar = MeshBuilder.CreateBox(
      `dkBkB_${dock.name}`,
      { width: platW, height: 0.06, depth: 0.06 },
      this.scene
    );
    backBar.material = woodLightMat;
    backBar.parent = node;
    backBar.position.set(0, platHeight + railH * 0.85, -platD / 2);

    // =============================================
    // 6. SMALL TIED BOAT (on ~65% of docks)
    // =============================================
    if (rng() > 0.35) {
      const boatParent = new TransformNode(`dkBt_${dock.name}`, this.scene);
      boatParent.parent = node;
      const boatSide = rng() > 0.5 ? 1 : -1;
      boatParent.position.set(boatSide * (platW / 2 + 0.8), -0.15, rng() * 2 - 1);
      boatParent.rotation.y = (rng() - 0.5) * 0.3;

      // Hull
      const hull = MeshBuilder.CreateBox(
        `dkBtH_${dock.name}`,
        { width: 0.8, height: 0.35, depth: 2.2 },
        this.scene
      );
      hull.material = this.createMat(`dkBtHM_${dock.name}`, COLORS.boatHull);
      hull.parent = boatParent;

      // Interior seat area
      const interior = MeshBuilder.CreateBox(
        `dkBtI_${dock.name}`,
        { width: 0.6, height: 0.15, depth: 1.8 },
        this.scene
      );
      interior.material = this.createMat(`dkBtIM_${dock.name}`, COLORS.boatDeck);
      interior.parent = boatParent;
      interior.position.y = 0.05;

      // Mooring rope
      const rope = MeshBuilder.CreateBox(
        `dkRp_${dock.name}`,
        { width: 0.03, height: 0.03, depth: 1.2 },
        this.scene
      );
      rope.material = this.createMat(`dkRpM_${dock.name}`, "#8b7355");
      rope.parent = node;
      rope.rotation.y = boatSide * 0.6;
      rope.position.set(boatSide * (platW / 2 + 0.2), platHeight * 0.5, 0);
    }

    // =============================================
    // SIGN POST & SIGN (station name)
    // =============================================
    const signPost = MeshBuilder.CreateBox(
      `dkSP_${dock.name}`,
      { width: 0.12, height: 1.8, depth: 0.12 },
      this.scene
    );
    signPost.material = this.createMat(`dkSPM_${dock.name}`, "#666666");
    signPost.parent = node;
    signPost.position.set(platW / 2 - 0.3, platHeight + 0.9, -platD / 2 + 0.5);

    const sign = MeshBuilder.CreateBox(
      `dkSgn_${dock.name}`,
      { width: 1.4, height: 0.5, depth: 0.08 },
      this.scene
    );
    const signMat = new StandardMaterial(`dkSgnM_${dock.name}`, this.scene);
    signMat.diffuseColor = new Color3(0.9, 0.85, 0.7);
    signMat.emissiveColor = new Color3(0.15, 0.12, 0.08);
    sign.material = signMat;
    sign.parent = node;
    sign.position.set(platW / 2 - 0.3, platHeight + 1.7, -platD / 2 + 0.5);

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
