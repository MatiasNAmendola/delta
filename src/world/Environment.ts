import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  WORLD_SIZE,
  WATER_LEVEL,
  COLORS,
  DOCK_LOCATIONS,
  RIVER_MAP,
  type DockLocation,
} from "../utils/constants";
import { seededRandom } from "../utils/helpers";
import { WaterSystem } from "./WaterSystem";
import { createProcTreeMesh, TREE_PRESETS } from "./ProcTreeMesh";

export class Environment {
  private scene: THREE.Scene;
  private dockMeshes: Map<string, THREE.Group> = new Map();
  private matCache: Map<string, THREE.MeshStandardMaterial> = new Map();
  private waterSystem: WaterSystem;

  constructor(scene: THREE.Scene, waterSystem: WaterSystem) {
    this.scene = scene;
    this.waterSystem = waterSystem;
    this.createGround(waterSystem);
    this.createTrees(waterSystem);
    this.createHouses(waterSystem);
    this.createDocks();
    this.loadVegetationModels();
  }

  private createMat(color: string): THREE.MeshStandardMaterial {
    const cached = this.matCache.get(color);
    if (cached) return cached;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.85,
      metalness: 0.05,
    });
    this.matCache.set(color, mat);
    return mat;
  }

  // --- Noise functions (pure math) ---
  private noise2D(x: number, z: number, seed: number): number {
    const hash = (ix: number, iz: number) => {
      let h = ix * 374761393 + iz * 668265263 + seed * 1274126177;
      h = (h ^ (h >> 13)) * 1274126177;
      h = h ^ (h >> 16);
      return (h & 0x7fffffff) / 0x7fffffff;
    };
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    return hash(ix, iz) * (1 - sx) * (1 - sz) + hash(ix + 1, iz) * sx * (1 - sz) +
      hash(ix, iz + 1) * (1 - sx) * sz + hash(ix + 1, iz + 1) * sx * sz;
  }

  private fbm(x: number, z: number, octaves: number, seed: number): number {
    let value = 0, amplitude = 0.5, frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, z * frequency, seed + i * 31) * amplitude;
      amplitude *= 0.5; frequency *= 2;
    }
    return value;
  }

  // --- Terrain ---
  private createGround(waterSystem: WaterSystem): void {
    const subdivisions = 200;
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, subdivisions, subdivisions);
    geometry.rotateX(-Math.PI / 2);

    this.buildTerrainGeometry(geometry, waterSystem);

    // Procedural bump map
    const bumpTex = this.createTerrainBumpMap();
    bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(120, 120);

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0,
      roughness: 0.92,
      bumpMap: bumpTex,
      bumpScale: 0.6,
      envMapIntensity: 0.4,
    });

    const ground = new THREE.Mesh(geometry, mat);
    ground.position.y = WATER_LEVEL - 0.3;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildTerrainGeometry(geometry: THREE.BufferGeometry, waterSystem: WaterSystem): void {
    const positions = geometry.attributes.position.array as Float32Array;
    const vertexCount = positions.length / 3;
    const colors = new Float32Array(vertexCount * 3);
    const half = WORLD_SIZE / 2;

    const grassColors = [
      [0.25, 0.50, 0.12], [0.30, 0.55, 0.15], [0.22, 0.45, 0.10],
      [0.28, 0.48, 0.11], [0.33, 0.52, 0.14], [0.20, 0.42, 0.09],
    ];
    const dirtColors = [
      [0.42, 0.32, 0.18], [0.48, 0.36, 0.20], [0.38, 0.28, 0.15],
      [0.45, 0.34, 0.19], [0.40, 0.30, 0.16],
    ];
    const sandColors = [
      [0.65, 0.55, 0.35], [0.70, 0.58, 0.38], [0.60, 0.50, 0.30],
      [0.55, 0.45, 0.28], [0.62, 0.52, 0.32],
    ];

    for (let i = 0; i < vertexCount; i++) {
      const worldX = positions[i * 3];
      const worldZ = positions[i * 3 + 2];

      const inWater = waterSystem.isWater(worldX, worldZ);
      let waterDist = inWater ? 0 : 999;
      if (!inWater) {
        for (const d of [2, 4, 7, 12, 20, 30]) {
          for (let dir = 0; dir < 8; dir++) {
            const angle = (dir / 8) * Math.PI * 2;
            if (waterSystem.isWater(worldX + Math.cos(angle) * d, worldZ + Math.sin(angle) * d)) {
              waterDist = d; break;
            }
          }
          if (waterDist < 999) break;
        }
      }

      // Height
      let height: number;
      if (inWater) {
        height = -0.5;
      } else if (waterDist < 10) {
        const bankNoise = this.fbm(worldX * 0.02, worldZ * 0.02, 3, 42);
        const t = waterDist / 10;
        height = -0.1 + t * t * 0.9 + bankNoise * 0.3 * t;
      } else {
        const edgeFade = 1 - Math.max(Math.abs(worldX) / half, Math.abs(worldZ) / half);
        const h = this.fbm(worldX * 0.008, worldZ * 0.008, 4, 42) * 4.0
          + this.fbm(worldX * 0.025, worldZ * 0.025, 2, 99) * 1.0;
        height = Math.max(0.2, h * Math.max(0, edgeFade));
      }
      positions[i * 3 + 1] = height;

      // Color
      const n1 = this.noise2D(worldX * 0.03, worldZ * 0.03, 7);
      const n2 = this.noise2D(worldX * 0.1, worldZ * 0.1, 19);
      const n3 = this.noise2D(worldX * 0.25, worldZ * 0.25, 41);
      const md = (n3 - 0.5) * 0.08;
      let r: number, g: number, b: number;

      if (inWater) {
        r = 0.25 + md; g = 0.20 + md; b = 0.10;
      } else if (waterDist < 4) {
        const t = Math.max(0, Math.min(1, waterDist / 4 + (n1 - 0.5) * 0.3));
        const sc = sandColors[Math.floor(n2 * sandColors.length) % sandColors.length];
        const dc = dirtColors[Math.floor(n1 * dirtColors.length) % dirtColors.length];
        r = sc[0] + (dc[0] - sc[0]) * t + md; g = sc[1] + (dc[1] - sc[1]) * t + md; b = sc[2] + (dc[2] - sc[2]) * t + md;
      } else if (waterDist < 15) {
        const t = Math.max(0, Math.min(1, (waterDist - 4) / 11 + (n1 - 0.5) * 0.2));
        const dc = dirtColors[Math.floor(n2 * dirtColors.length) % dirtColors.length];
        const gc = grassColors[Math.floor(n2 * grassColors.length) % grassColors.length];
        r = dc[0] + (gc[0] - dc[0]) * t + md; g = dc[1] + (gc[1] - dc[1]) * t + md; b = dc[2] + (gc[2] - dc[2]) * t + md;
      } else {
        const gc = grassColors[Math.floor(n1 * grassColors.length) % grassColors.length];
        const shade = 0.85 + n2 * 0.3;
        r = gc[0] * shade + md; g = gc[1] * shade + md; b = gc[2] * shade + md;
        if (n1 > 0.68 && n2 < 0.4) { r *= 0.7; g *= 0.8; b *= 0.65; }
        if (n2 > 0.75) { r += 0.08; g += 0.04; b -= 0.02; }
      }

      colors[i * 3] = Math.max(0, Math.min(1, r));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, g));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, b));
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
  }

  private createTerrainBumpMap(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const h00 = this.fbm(px * 0.15, py * 0.15, 3, 501) + this.noise2D(px * 0.6, py * 0.6, 601) * 0.3;
        const h10 = this.fbm((px + 1) * 0.15, py * 0.15, 3, 501) + this.noise2D((px + 1) * 0.6, py * 0.6, 601) * 0.3;
        const h01 = this.fbm(px * 0.15, (py + 1) * 0.15, 3, 501) + this.noise2D(px * 0.6, (py + 1) * 0.6, 601) * 0.3;
        const dx = (h10 - h00) * 2.0, dy = (h01 - h00) * 2.0;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const idx = (py * size + px) * 4;
        data[idx] = Math.floor((-dx / len * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((-dy / len * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor((1 / len * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- Trees ---
  private createWeepingWillow(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const trunkMat = this.createMat(COLORS.wood);
    const leafMat = this.createMat(COLORS.willowLeaf);
    const scale = 1.8 + rng() * 1.5;
    const tree = createProcTreeMesh(`willow_${seed}`, this.scene, trunkMat, leafMat,
      { ...TREE_PRESETS.willow, seed }, scale);
    tree.position.set(x, WATER_LEVEL, z);
    tree.rotation.y = rng() * Math.PI * 2;
  }

  private createPoplar(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const trunkMat = this.createMat(COLORS.woodDark);
    const leafMat = this.createMat(COLORS.poplarLeaf);
    const scale = 1.5 + rng() * 1.2;
    const tree = createProcTreeMesh(`poplar_${seed}`, this.scene, trunkMat, leafMat,
      { ...TREE_PRESETS.poplar, seed }, scale);
    tree.position.set(x, WATER_LEVEL, z);
    tree.rotation.y = rng() * Math.PI * 2;
  }

  private createRegularTree(x: number, z: number, seed: number): void {
    const rng = seededRandom(seed);
    const leafColors = [COLORS.leaves, COLORS.leavesDark, COLORS.leavesLight];
    const trunkMat = this.createMat(COLORS.wood);
    const leafMat = this.createMat(leafColors[seed % 3]);
    const scale = 1.5 + rng() * 1.5;
    const tree = createProcTreeMesh(`tree_${seed}`, this.scene, trunkMat, leafMat,
      { ...TREE_PRESETS.regular, seed }, scale);
    tree.position.set(x, WATER_LEVEL, z);
    tree.rotation.y = rng() * Math.PI * 2;
  }

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
        const d = Math.sqrt((x - rx) ** 2 + (z - rz) ** 2) - river.width / 2;
        if (d < minDist) minDist = d;
      }
    }
    return minDist;
  }

  private createTrees(waterSystem: WaterSystem): void {
    const rng = seededRandom(42);
    for (let i = 0; i < 400; i++) {
      const x = (rng() - 0.5) * WORLD_SIZE * 0.9;
      const z = (rng() - 0.5) * WORLD_SIZE * 0.9;
      if (waterSystem.isWater(x, z)) continue;
      const dist = this.distToRiver(x, z);
      let chance = dist < 8 ? 0.95 : dist < 25 ? 0.7 : dist < 60 ? 0.35 : 0.15;
      if (rng() > chance) continue;
      const seed = i * 7 + 13;
      const tv = seededRandom(seed + 99)();
      if (dist < 12 && tv < 0.3) this.createWeepingWillow(x, z, seed);
      else if (tv < 0.5) this.createPoplar(x, z, seed);
      else this.createRegularTree(x, z, seed);
    }
  }

  // --- Vegetation GLB ---
  private async loadVegetationModels(): Promise<void> {
    const modelNames = [
      { file: "bush1.glb", type: "bush" }, { file: "bush2.glb", type: "bush" }, { file: "bush3.glb", type: "bush" },
      { file: "flower1.glb", type: "flower" }, { file: "flower2.glb", type: "flower" }, { file: "flower3.glb", type: "flower" },
      { file: "grass1.glb", type: "grass" },
    ];
    const base = document.querySelector("base")?.href || window.location.href;
    const modelsUrl = new URL("models/vegetation/", base).href;
    const loader = new GLTFLoader();

    const templates: { group: THREE.Group; type: string }[] = [];
    await Promise.allSettled(modelNames.map(async (m) => {
      try {
        const gltf = await loader.loadAsync(modelsUrl + m.file);
        gltf.scene.visible = false;
        gltf.scene.name = `vegTemplate_${m.file}`;
        templates.push({ group: gltf.scene, type: m.type });
      } catch (e) { console.warn(`Failed to load ${m.file}:`, e); }
    }));

    if (templates.length === 0) return;
    const bushT = templates.filter(t => t.type === "bush");
    const flowerT = templates.filter(t => t.type === "flower");
    const grassT = templates.filter(t => t.type === "grass");

    const rng = seededRandom(777);
    let placed = 0;

    for (const river of RIVER_MAP) {
      const totalSamples = (river.points.length - 1) * 3;
      for (let i = 0; i < totalSamples; i++) {
        const t = i / totalSamples;
        const totalSeg = river.points.length - 1;
        const segT = t * totalSeg;
        const seg = Math.min(Math.floor(segT), totalSeg - 1);
        const lt = segT - seg;
        const p1 = river.points[seg], p2 = river.points[Math.min(river.points.length - 1, seg + 1)];
        const cx = p1[0] + (p2[0] - p1[0]) * lt, cz = p1[1] + (p2[1] - p1[1]) * lt;
        const pLen = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) || 1;
        const nx = -(p2[1] - p1[1]) / pLen, nz = (p2[0] - p1[0]) / pLen;
        const halfW = river.width / 2;

        for (const side of [-1, 1]) {
          if (bushT.length > 0 && rng() < 0.4) {
            const dist = halfW + 2 + rng() * 6;
            const px = cx + nx * dist * side + (rng() - 0.5) * 3;
            const pz = cz + nz * dist * side + (rng() - 0.5) * 3;
            if (!this.waterSystem.isWater(px, pz)) {
              const clone = bushT[Math.floor(rng() * bushT.length)].group.clone();
              clone.visible = true;
              const s = 0.4 + rng() * 0.6;
              clone.scale.setScalar(s);
              clone.position.set(px, WATER_LEVEL + 0.3, pz);
              clone.rotation.y = rng() * Math.PI * 2;
              this.scene.add(clone); placed++;
            }
          }
          if (flowerT.length > 0 && rng() < 0.3) {
            const dist = halfW + 1 + rng() * 4;
            const px = cx + nx * dist * side + (rng() - 0.5) * 2;
            const pz = cz + nz * dist * side + (rng() - 0.5) * 2;
            if (!this.waterSystem.isWater(px, pz)) {
              const clone = flowerT[Math.floor(rng() * flowerT.length)].group.clone();
              clone.visible = true;
              const s = 0.2 + rng() * 0.4;
              clone.scale.setScalar(s);
              clone.position.set(px, WATER_LEVEL + 0.2, pz);
              clone.rotation.y = rng() * Math.PI * 2;
              this.scene.add(clone); placed++;
            }
          }
          if (grassT.length > 0 && rng() < 0.5) {
            const dist = halfW + 2 + rng() * 2;
            const px = cx + nx * dist * side + (rng() - 0.5) * 1.5;
            const pz = cz + nz * dist * side + (rng() - 0.5) * 1.5;
            if (!this.waterSystem.isWater(px, pz)) {
              const clone = grassT[Math.floor(rng() * grassT.length)].group.clone();
              clone.visible = true;
              const s = 0.3 + rng() * 0.5;
              clone.scale.setScalar(s);
              clone.position.set(px, WATER_LEVEL + 0.1, pz);
              clone.rotation.y = rng() * Math.PI * 2;
              this.scene.add(clone); placed++;
            }
          }
        }
      }
    }
    console.log(`Vegetation: ${placed} instances placed`);
  }

  // --- Helper: create box mesh ---
  private makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }
  private makeCylinder(dia: number, h: number, mat: THREE.Material, seg = 8): THREE.Mesh {
    return new THREE.Mesh(new THREE.CylinderGeometry(dia / 2, dia / 2, h, seg), mat);
  }

  // --- Houses ---
  private createHouse(x: number, z: number, seed: number, nearRiver: boolean): void {
    const rng = seededRandom(seed);
    const node = new THREE.Group();
    node.position.set(x, WATER_LEVEL, z);
    node.rotation.y = rng() * Math.PI * 2;
    this.scene.add(node);

    const w = 2 + rng() * 2, h = 1.5 + rng() * 1.5, d = 2 + rng() * 2;

    if (nearRiver) {
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const stilt = this.makeBox(0.2, 1.5, 0.2, this.createMat(COLORS.wood));
          stilt.position.set((sx * w) / 2.5, 0.75, (sz * d) / 2.5);
          node.add(stilt);
        }
      }
    }
    const baseY = nearRiver ? 1.5 : 0;

    const wallColors = ["#d4c5a0", "#c9b896", "#b8a882", "#e0d5b8"];
    const walls = this.makeBox(w, h, d, this.createMat(wallColors[Math.floor(rng() * wallColors.length)]));
    walls.position.y = baseY + h / 2; node.add(walls);

    const roofColors = [COLORS.roof, COLORS.roofBlue, "#8b4513", "#2a6a3a"];
    const roof = this.makeBox(w + 0.5, 0.3, d + 0.5, this.createMat(roofColors[Math.floor(rng() * roofColors.length)]));
    roof.position.y = baseY + h + 0.15; node.add(roof);

    const peak = this.makeBox(w * 0.5, 0.5, d + 0.3, roof.material as THREE.Material);
    peak.position.y = baseY + h + 0.5; node.add(peak);

    const door = this.makeBox(0.6, 1.0, 0.05, this.createMat(COLORS.woodDark));
    door.position.set(0, baseY + 0.5, d / 2 + 0.03); node.add(door);
  }

  private createHouses(waterSystem: WaterSystem): void {
    const rng = seededRandom(123);
    for (let i = 0; i < 80; i++) {
      const x = (rng() - 0.5) * WORLD_SIZE * 0.85;
      const z = (rng() - 0.5) * WORLD_SIZE * 0.85;
      if (!waterSystem.isWater(x, z)) {
        const near = waterSystem.isWater(x + 12, z) || waterSystem.isWater(x - 12, z) ||
          waterSystem.isWater(x, z + 12) || waterSystem.isWater(x, z - 12);
        if (near) this.createHouse(x, z, i * 13 + 7, true);
        else if (rng() < 0.15) this.createHouse(x, z, i * 13 + 7, false);
      }
    }
  }

  // --- Docks ---
  private createDocks(): void {
    for (const dock of DOCK_LOCATIONS) {
      const node = this.createDockMesh(dock);
      this.dockMeshes.set(dock.name, node);
    }
  }

  private createDockMesh(dock: DockLocation): THREE.Group {
    const node = new THREE.Group();
    node.position.set(dock.x, WATER_LEVEL, dock.z);
    node.rotation.y = dock.rotation;
    this.scene.add(node);

    const rng = seededRandom(Math.abs(dock.x * 73 + dock.z * 137 + dock.name.length * 51));
    const platW = 3.5 + rng() * 1.5, platD = 5 + rng() * 2;
    const platThick = 0.2, platHeight = 1.8 + rng() * 0.6;
    const woodMat = this.createMat(COLORS.dock);
    const woodDarkMat = this.createMat(COLORS.woodDark);
    const woodLightMat = this.createMat(COLORS.woodLight);

    // Stilts
    const stiltH = platHeight + 1.5;
    for (const sx of [-platW / 2 + 0.4, platW / 2 - 0.4]) {
      for (const sz of [-platD / 2 + 0.5, 0, platD / 2 - 0.5]) {
        const stilt = this.makeCylinder(0.24, stiltH, woodDarkMat);
        stilt.position.set(sx, platHeight - stiltH / 2, sz);
        node.add(stilt);
      }
    }

    // Platform
    const platform = this.makeBox(platW, platThick, platD, woodMat);
    platform.position.y = platHeight; node.add(platform);

    // Planks
    const plankCount = Math.floor(platD / 0.5);
    for (let p = 0; p < plankCount; p++) {
      const plank = this.makeBox(platW - 0.1, 0.02, 0.05, woodDarkMat);
      plank.position.set(0, platHeight + platThick / 2 + 0.01, -platD / 2 + 0.25 + p * (platD / plankCount));
      node.add(plank);
    }

    // Stairs
    const stairW = 1.2, stairStepH = platHeight / 4, stairStepD = 0.4;
    for (let s = 0; s < 4; s++) {
      const step = this.makeBox(stairW, 0.1, stairStepD, s % 2 === 0 ? woodMat : woodLightMat);
      step.position.set(0, platHeight - stairStepH * (s + 0.5), platD / 2 + stairStepD * (s + 0.5));
      node.add(step);
    }

    // Roof
    const roofColors = ["#2a9d8f", "#3a8a5c", "#6b8f71", "#d4534a", "#4a7aaa", "#5f8a8b"];
    const roofMat = this.createMat(roofColors[Math.floor(rng() * roofColors.length)]);
    const roofW = platW + 0.8, roofD = platD * 0.65;
    const roofBaseY = platHeight + 2.2, roofPeakH = 0.7 + rng() * 0.4;
    const roofZ0 = -platD / 2 + roofD / 2;

    // Roof posts
    const roofPostH = 2.2;
    for (const [rpx, rpz] of [
      [-platW / 2 + 0.3, roofZ0 - roofD / 2 + 0.3], [platW / 2 - 0.3, roofZ0 - roofD / 2 + 0.3],
      [-platW / 2 + 0.3, roofZ0 + roofD / 2 - 0.3], [platW / 2 - 0.3, roofZ0 + roofD / 2 - 0.3],
    ]) {
      const post = this.makeCylinder(0.12, roofPostH, woodDarkMat);
      post.position.set(rpx, platHeight + roofPostH / 2, rpz);
      node.add(post);
    }

    if (rng() > 0.3) {
      // Gable roof
      const halfSpan = roofW / 2;
      const panelLen = Math.sqrt(halfSpan ** 2 + roofPeakH ** 2);
      for (const side of [-1, 1]) {
        const panel = this.makeBox(panelLen + 0.1, 0.06, roofD + 0.3, roofMat);
        panel.rotation.z = -side * Math.atan2(roofPeakH, halfSpan);
        panel.position.set((side * halfSpan) / 2, roofBaseY + roofPeakH / 2, roofZ0);
        node.add(panel);
      }
    } else {
      const flat = this.makeBox(roofW, 0.06, roofD + 0.3, roofMat);
      flat.rotation.x = 0.05;
      flat.position.set(0, roofBaseY, roofZ0);
      node.add(flat);
    }

    // Railings
    const railH = 0.9;
    for (const side of [-1, 1]) {
      const numPosts = Math.max(2, Math.floor(platD / 1.2) + 1);
      for (let rp = 0; rp < numPosts; rp++) {
        const pz = -platD / 2 + rp * (platD / (numPosts - 1));
        const post = this.makeCylinder(0.08, railH, woodDarkMat, 6);
        post.position.set((side * platW) / 2, platHeight + railH / 2, pz);
        node.add(post);
      }
      const bar = this.makeBox(0.06, 0.06, platD, woodLightMat);
      bar.position.set((side * platW) / 2, platHeight + railH * 0.85, 0);
      node.add(bar);
    }

    // Sign
    const signPost = this.makeBox(0.12, 1.8, 0.12, this.createMat("#666666"));
    signPost.position.set(platW / 2 - 0.3, platHeight + 0.9, -platD / 2 + 0.5);
    node.add(signPost);

    const signMat = new THREE.MeshStandardMaterial({ color: 0xe0d5b8, emissive: 0x251e10, roughness: 0.9 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.08), signMat);
    sign.position.set(platW / 2 - 0.3, platHeight + 1.7, -platD / 2 + 0.5);
    node.add(sign);

    return node;
  }

  public getDockNode(name: string): THREE.Group | undefined {
    return this.dockMeshes.get(name);
  }

  public highlightDock(name: string, highlight: boolean): void {
    // Could add glow or color change
  }
}
