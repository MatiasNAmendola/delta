import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import {
  WORLD_SIZE,
  WATER_LEVEL,
  COLORS,
  DOCK_LOCATIONS,
  RIVER_MAP,
  type DockLocation,
} from "../utils/constants";
import { hexToColor3, seededRandom, isPointInRiver } from "../utils/helpers";
import { WaterSystem } from "./WaterSystem";
import { quickTree } from "./QuickTreeGenerator";

export class Environment {
  private scene: Scene;
  private dockMeshes: Map<string, TransformNode> = new Map();

  constructor(scene: Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.createGround();
    this.createSkybox();
    this.createTrees(waterSystem);
    this.createRiverVegetation(waterSystem);
    this.createHouses(waterSystem);
    this.createDocks();
    this.createRiverBanks(waterSystem);
  }

  private createMat(name: string, color: string): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = hexToColor3(color);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    return mat;
  }

  private createGround(): void {
    // Main ground with subdivisions for height variation
    const subdivisions = 100;
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: WORLD_SIZE, height: WORLD_SIZE, subdivisions },
      this.scene
    );
    const groundMat = this.createMat("groundMat", COLORS.grass);
    ground.material = groundMat;
    ground.position.y = WATER_LEVEL - 0.2;
    ground.receiveShadows = true;

    // Vertex displacement: gentle hills using multi-octave noise
    const positions = ground.getVerticesData("position");
    if (positions) {
      const hash = (x: number, y: number): number => {
        let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
        h = ((h >> 13) ^ h) | 0;
        h = (h * (h * h * 15731 + 789221) + 1376312589) | 0;
        return ((h >> 16) & 0x7fff) / 0x7fff;
      };
      const smoothNoise = (x: number, y: number, period: number): number => {
        const ix = ((Math.floor(x) % period) + period) % period;
        const iy = ((Math.floor(y) % period) + period) % period;
        const fx = x - Math.floor(x);
        const fy = y - Math.floor(y);
        const cx = (1 - Math.cos(fx * Math.PI)) * 0.5;
        const cy = (1 - Math.cos(fy * Math.PI)) * 0.5;
        const ix1 = (ix + 1) % period;
        const iy1 = (iy + 1) % period;
        return (
          (hash(ix, iy) * (1 - cx) + hash(ix1, iy) * cx) * (1 - cy) +
          (hash(ix, iy1) * (1 - cx) + hash(ix1, iy1) * cx) * cy
        );
      };
      const hillNoise = (wx: number, wz: number): number => {
        let val = 0, amp = 1, freq = 0.008, maxVal = 0;
        for (let oct = 0; oct < 4; oct++) {
          const period = Math.max(1, Math.floor(50 * (1 / (freq / 0.008))));
          val += smoothNoise(wx * freq * 50, wz * freq * 50, period) * amp;
          maxVal += amp;
          amp *= 0.45;
          freq *= 2.2;
        }
        return val / maxVal;
      };

      const half = WORLD_SIZE / 2;
      for (let i = 0; i < positions.length; i += 3) {
        const wx = positions[i];
        const wz = positions[i + 2];

        // Check distance to nearest river to suppress hills near water
        let minRiverDist = Infinity;
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
            const dx = wx - rx;
            const dz = wz - rz;
            const d = Math.sqrt(dx * dx + dz * dz) - river.width / 2;
            if (d < minRiverDist) minRiverDist = d;
          }
        }

        // Height: hills that taper to 0 near rivers
        const riverFade = Math.max(0, Math.min(1, (minRiverDist - 5) / 25));
        const edgeFade = 1 - Math.max(
          Math.abs(wx) / half,
          Math.abs(wz) / half
        );
        const noise = hillNoise(wx, wz);
        const height = noise * 6.0 * riverFade * Math.max(0, edgeFade);
        positions[i + 1] = height;
      }
      ground.setVerticesData("position", positions);
      ground.createNormals(true);
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

  // Tree type 0: Weeping willow - tall trunk + drooping curtain branches
  private createWeepingWillow(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const treeNode = new TransformNode(`willow_${seed}`, this.scene);
    treeNode.position.set(x, WATER_LEVEL, z);

    const height = 6 + rng() * 4; // tall: 6-10
    const trunkWidth = 0.5 + rng() * 0.3;

    // Trunk
    const trunk = MeshBuilder.CreateBox(
      `wtrunk_${seed}`,
      { width: trunkWidth, height: height, depth: trunkWidth },
      this.scene
    );
    trunk.material = this.createMat(`wtrunkMat_${seed}`, COLORS.wood);
    trunk.parent = treeNode;
    trunk.position.y = height / 2;

    // Central canopy mass at top
    const canopySize = 3 + rng() * 2;
    const canopy = MeshBuilder.CreateBox(
      `wcanopy_${seed}`,
      { width: canopySize, height: canopySize * 0.5, depth: canopySize },
      this.scene
    );
    const willowColors = [COLORS.willowLeaf, COLORS.willowLeafLight, COLORS.leaves];
    canopy.material = this.createMat(
      `wcanopyMat_${seed}`,
      willowColors[Math.floor(rng() * 3)]
    );
    canopy.parent = treeNode;
    canopy.position.y = height + canopySize * 0.2;

    // Drooping curtain branches hanging down from canopy
    const curtainCount = 5 + Math.floor(rng() * 4); // 5-8 curtains
    for (let c = 0; c < curtainCount; c++) {
      const angle = (c / curtainCount) * Math.PI * 2 + rng() * 0.4;
      const radius = canopySize * 0.4 + rng() * canopySize * 0.2;
      const curtainH = 3 + rng() * 3; // droop length 3-6
      const curtainW = 0.6 + rng() * 0.5;
      const curtainD = 0.4 + rng() * 0.3;

      const curtain = MeshBuilder.CreateBox(
        `wcurt_${seed}_${c}`,
        { width: curtainW, height: curtainH, depth: curtainD },
        this.scene
      );
      curtain.material = this.createMat(
        `wcurtMat_${seed}_${c}`,
        willowColors[Math.floor(rng() * 3)]
      );
      curtain.parent = treeNode;
      curtain.position.set(
        Math.cos(angle) * radius,
        height - curtainH * 0.3,
        Math.sin(angle) * radius
      );
      // Slight outward tilt
      curtain.rotation.z = Math.cos(angle) * 0.15;
      curtain.rotation.x = Math.sin(angle) * 0.15;
    }

    treeNode.rotation.y = rng() * Math.PI * 2;
  }

  // Tree type 1: Tall poplar - thin columnar shape
  private createPoplar(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const treeNode = new TransformNode(`poplar_${seed}`, this.scene);
    treeNode.position.set(x, WATER_LEVEL, z);

    const height = 8 + rng() * 6; // very tall: 8-14
    const trunkWidth = 0.25 + rng() * 0.15;

    // Tall thin trunk
    const trunk = MeshBuilder.CreateBox(
      `ptrunk_${seed}`,
      { width: trunkWidth, height: height, depth: trunkWidth },
      this.scene
    );
    trunk.material = this.createMat(`ptrunkMat_${seed}`, COLORS.woodDark);
    trunk.parent = treeNode;
    trunk.position.y = height / 2;

    // Narrow vertical columnar canopy - stacked narrow boxes
    const poplarColors = [COLORS.poplarLeaf, COLORS.poplarLeafDark, COLORS.leavesDark];
    const canopyWidth = 1.2 + rng() * 0.8;
    const canopySegments = 3 + Math.floor(rng() * 2);
    const segHeight = (height * 0.6) / canopySegments;

    for (let s = 0; s < canopySegments; s++) {
      // Taper: widest in middle, narrower at top and bottom
      const midFrac = Math.abs(s / (canopySegments - 1) - 0.4);
      const taper = 1 - midFrac * 0.6;
      const w = canopyWidth * taper;

      const seg = MeshBuilder.CreateBox(
        `pcanopy_${seed}_${s}`,
        { width: w, height: segHeight * 1.1, depth: w },
        this.scene
      );
      seg.material = this.createMat(
        `pcanopyMat_${seed}_${s}`,
        poplarColors[Math.floor(rng() * 3)]
      );
      seg.parent = treeNode;
      seg.position.y = height * 0.35 + s * segHeight;
    }

    treeNode.rotation.y = rng() * Math.PI * 2;
  }

  // Tree type 2: Regular/eucalyptus — uses QuickTreeGenerator (community extension)
  // Generates organic randomized-sphere canopy + tapered cylinder trunk, flat-shaded
  private createRegularTree(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);

    const leafColors = [COLORS.leaves, COLORS.leavesDark, COLORS.leavesLight];
    const trunkMat = this.createMat(`qtrunkMat_${seed}`, COLORS.wood);
    const leafMat = this.createMat(
      `qleafMat_${seed}`,
      leafColors[Math.floor(rng() * 3)]
    );

    const sizeBranch = 3 + rng() * 3;   // canopy diameter 3-6
    const sizeTrunk = 2.5 + rng() * 4;  // trunk height 2.5-6.5
    const radius = 2 + rng() * 1.5;     // trunk base radius 2-3.5

    const tree = quickTree(sizeBranch, sizeTrunk, radius, trunkMat, leafMat, this.scene);
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
    const treeCount = 1200;

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

  private createRiverVegetation(waterSystem: WaterSystem): void {
    const rng = seededRandom(777);

    // Walk along each river and place reeds + bushes at the water's edge
    for (const river of RIVER_MAP) {
      const pathLen = river.points.length - 1;
      // Sample many points along the river
      const samplesPerSegment = 12;
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

        // Perpendicular direction
        const t2 = Math.min(1, t + 0.01);
        const segT2 = t2 * totalSeg;
        const seg2 = Math.min(Math.floor(segT2), totalSeg - 1);
        const lt2 = segT2 - seg2;
        const p1b = river.points[seg2];
        const p2b = river.points[Math.min(river.points.length - 1, seg2 + 1)];
        const cx2 = p1b[0] + (p2b[0] - p1b[0]) * lt2;
        const cz2 = p1b[1] + (p2b[1] - p1b[1]) * lt2;
        const dx = cx2 - cx;
        const dz = cz2 - cz;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;

        const halfW = river.width / 2;

        // Both sides of the river
        for (const side of [-1, 1]) {
          // --- Reeds at waterline ---
          const reedCount = 2 + Math.floor(rng() * 3);
          for (let r = 0; r < reedCount; r++) {
            const offset = halfW + rng() * 2 - 0.5; // right at waterline, slight variation
            const rx = cx + nx * offset * side + (rng() - 0.5) * 1.5;
            const rz = cz + nz * offset * side + (rng() - 0.5) * 1.5;

            if (waterSystem.isWater(rx, rz)) continue;

            const reedH = 1.0 + rng() * 1.5;
            const reedW = 0.12 + rng() * 0.1;
            const reedSeed = i * 31 + r * 7 + (side > 0 ? 0 : 5000);

            const reed = MeshBuilder.CreateBox(
              `reed_${river.name}_${reedSeed}`,
              { width: reedW, height: reedH, depth: reedW },
              this.scene
            );
            const reedColors = [COLORS.reed, COLORS.reedDark, COLORS.leavesLight];
            reed.material = this.createMat(
              `reedMat_${reedSeed}`,
              reedColors[Math.floor(rng() * 3)]
            );
            reed.position.set(rx, WATER_LEVEL + reedH / 2, rz);
            // Slight random tilt for natural look
            reed.rotation.x = (rng() - 0.5) * 0.2;
            reed.rotation.z = (rng() - 0.5) * 0.2;
          }

          // --- Low bushes between trees near the river (every other sample) ---
          if (i % 2 === 0) {
            const bushCount = 1 + Math.floor(rng() * 2);
            for (let b = 0; b < bushCount; b++) {
              const bOffset = halfW + 2 + rng() * 6; // a bit inland from waterline
              const bx = cx + nx * bOffset * side + (rng() - 0.5) * 3;
              const bz = cz + nz * bOffset * side + (rng() - 0.5) * 3;

              if (waterSystem.isWater(bx, bz)) continue;

              const bushH = 0.6 + rng() * 0.8;
              const bushW = 0.8 + rng() * 1.2;
              const bushSeed = i * 41 + b * 11 + (side > 0 ? 10000 : 15000);

              const bush = MeshBuilder.CreateBox(
                `bush_${river.name}_${bushSeed}`,
                { width: bushW, height: bushH, depth: bushW * (0.8 + rng() * 0.4) },
                this.scene
              );
              const bushColors = [COLORS.bush, COLORS.bushDark, COLORS.leavesDark, COLORS.leaves];
              bush.material = this.createMat(
                `bushMat_${bushSeed}`,
                bushColors[Math.floor(rng() * 4)]
              );
              bush.position.set(bx, WATER_LEVEL + bushH / 2, bz);
              bush.rotation.y = rng() * Math.PI * 2;
            }
          }
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
        panel.rotation.z = side * Math.atan2(roofPeakH, halfSpan);
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

  private createRiverBanks(waterSystem: WaterSystem): void {
    // Create sandy/muddy banks along rivers using simple box strips
    const bankMat = this.createMat("bankMat", COLORS.sand);
    const dirtMat = this.createMat("dirtBankMat", COLORS.dirt);

    for (const river of RIVER_MAP) {
      const samples = river.points.length * 4;
      for (let i = 0; i < samples; i++) {
        const t = i / samples;
        const [x, z] = (() => {
          const totalSegments = river.points.length - 1;
          const segT = t * totalSegments;
          const seg = Math.min(Math.floor(segT), totalSegments - 1);
          const localT = segT - seg;
          const p1 = river.points[seg];
          const p2 = river.points[Math.min(river.points.length - 1, seg + 1)];
          return [
            p1[0] + (p2[0] - p1[0]) * localT,
            p1[1] + (p2[1] - p1[1]) * localT,
          ] as [number, number];
        })();

        // Get direction for perpendicular
        const t2 = Math.min(1, t + 0.02);
        const [x2, z2] = (() => {
          const totalSegments = river.points.length - 1;
          const segT = t2 * totalSegments;
          const seg = Math.min(Math.floor(segT), totalSegments - 1);
          const localT = segT - seg;
          const p1 = river.points[seg];
          const p2 = river.points[Math.min(river.points.length - 1, seg + 1)];
          return [
            p1[0] + (p2[0] - p1[0]) * localT,
            p1[1] + (p2[1] - p1[1]) * localT,
          ] as [number, number];
        })();

        const dx = x2 - x;
        const dz = z2 - z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;

        const halfW = river.width / 2;
        const bankW = 2;

        for (const side of [-1, 1]) {
          const bx = x + nx * (halfW + bankW * 0.5) * side;
          const bz = z + nz * (halfW + bankW * 0.5) * side;

          const bank = MeshBuilder.CreateBox(
            `bank_${river.name}_${i}_${side}`,
            { width: bankW, height: 0.15, depth: WORLD_SIZE / samples + 1 },
            this.scene
          );
          bank.material = i % 2 === 0 ? bankMat : dirtMat;
          bank.position.set(bx, WATER_LEVEL - 0.05, bz);
          bank.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
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
