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

export class Environment {
  private scene: Scene;
  private dockMeshes: Map<string, TransformNode> = new Map();

  constructor(scene: Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.createGround();
    this.createSkybox();
    this.createTrees(waterSystem);
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

  private createTree(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const treeNode = new TransformNode(`tree_${seed}`, this.scene);
    treeNode.position.set(x, WATER_LEVEL, z);

    const height = 2 + rng() * 3;
    const trunkWidth = 0.3 + rng() * 0.2;

    // Trunk (blocky)
    const trunk = MeshBuilder.CreateBox(
      `trunk_${seed}`,
      { width: trunkWidth, height: height, depth: trunkWidth },
      this.scene
    );
    trunk.material = this.createMat(`trunkMat_${seed}`, COLORS.wood);
    trunk.parent = treeNode;
    trunk.position.y = height / 2;

    // Leaves (stacked cubes for Minecraft look)
    const leafColors = [COLORS.leaves, COLORS.leavesDark, COLORS.leavesLight];
    const leafSize = 1.5 + rng() * 1.5;

    // Bottom leaf layer
    const leaf1 = MeshBuilder.CreateBox(
      `leaf1_${seed}`,
      { width: leafSize, height: leafSize * 0.6, depth: leafSize },
      this.scene
    );
    leaf1.material = this.createMat(
      `leafMat1_${seed}`,
      leafColors[Math.floor(rng() * 3)]
    );
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
    leaf2.material = this.createMat(
      `leafMat2_${seed}`,
      leafColors[Math.floor(rng() * 3)]
    );
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
        const nearRiver = waterSystem.isWater(x + 10, z) ||
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
