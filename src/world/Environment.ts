import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { TerrainMaterial } from "@babylonjs/materials/terrain/terrainMaterial";
import { WATER_LEVEL, COLORS, PROP_SCALE } from "../utils/constants";
import { degToRad, type Dock, type ScatterRule, type Vec2, type WorldDoc } from "./WorldDoc";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { hexToColor3, seededRandom } from "../utils/helpers";
import { SHORE_SDF_RANGE, WaterSystem } from "./WaterSystem";
import { InstancedBoxBatch, propTransform } from "./InstancedBatch";
import { WaterDistanceField } from "./WaterDistanceField";
import { mark } from "../utils/perf";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import type { WorldLayout } from "./layout/worldLayout";
import { fbm } from "./layout/noise";
import { placeDockModels } from "./DockModel";
import { paintPixels } from "./texturePaint";
import { RiverBanks } from "./RiverBanks";
import { Forest, type SpeciesName } from "./vegetation/Forest";
import { Grass } from "./vegetation/Grass";
import type { MooredSpot } from "./Yolas";

export class Environment {
  private scene: Scene;
  private world: WorldDoc;
  private props: PropBatches;
  /** Distance to the nearest water, shared by texturing, relief and vegetation. */
  private waterDistance: WaterDistanceField;
  private berths = new Map<string, Berth>();
  /** Houses next to the water: their shore gets a wooden bulkhead. */
  private waterfrontHouses: Array<{ x: number; z: number }> = [];
  private houses: Array<{ x: number; z: number }> = [];
  private forest: Forest;
  private grass!: Grass;
  private dockSites: Array<{ x: number; z: number; rotation: number; seed: number }> = [];
  private moored: MooredSpot[] = [];

  constructor(
    scene: Scene,
    waterSystem: WaterSystem,
    world: WorldDoc,
    private layout: WorldLayout
  ) {
    this.scene = scene;
    this.world = world;
    this.forest = new Forest(scene);
    // ~3 world units per cell (256 for the original 800-unit Delta); also the splatmap size
    const res = world.world.size <= 800 ? 256 : 1024;
    this.waterDistance = new WaterDistanceField(world.world.size, res, (x, z) => waterSystem.isWaterCoarse(x, z));
    const shore = waterSystem.getShore();
    mark("islas: distancias");
    this.createGround();
    this.createSkybox();
    this.props = createPropBatches(scene);
    // Docks first: vegetation and houses keep clear of where they end up
    for (const dock of world.docks) {
      this.addDock(dock, waterSystem);
    }
    // Houses before trees, so trees keep clear of them
    const rules = [...world.scatter].sort((a, b) => Number(b.prefab === "house") - Number(a.prefab === "house"));
    for (const rule of rules) {
      this.scatter(rule, waterSystem);
    }
    mark("casas y muelles");
    this.plantBanks(shore.rings, waterSystem);
    this.forest.build();
    mark("árboles");
    for (const batch of Object.values(this.props)) {
      batch.build();
    }
    this.grass = new Grass(
      scene,
      // Patches may straddle the bank: the shader drops blades rooted on water
      (x, z) =>
        // Skip patches wholly over the water
        [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].some(([dx, dz]) => !waterSystem.isWater(x + dx, z + dz)) &&
        !this.nearDock(x, z) &&
        !this.houses.some((h) => Math.abs(h.x - x) < 3 * PROP_SCALE && Math.abs(h.z - z) < 3 * PROP_SCALE),
      WATER_LEVEL + BANK_TOP,
      waterSystem.createShoreDistanceTexture(),
      SHORE_SDF_RANGE,
      world.world.size
    );
    mark("pasto");
    void this.buildDocks();

    // Island edges: mud banks, and bulkheads where people live and boats stop
    new RiverBanks(scene, shore.rings, {
      bankTop: BANK_TOP,
      isBulkhead: (x, z) =>
        this.dockSites.some((d) => Math.hypot(d.x - x, d.z - z) < 14 * PROP_SCALE) ||
        this.waterfrontHouses.some((h) => Math.hypot(h.x - x, h.z - z) < 9 * PROP_SCALE) ||
        this.fbm(x * 0.012, z * 0.012, 2, 77) > 0.68,
      keepClear: (x, z) =>
        this.dockSites.some((d) => Math.hypot(d.x - x, d.z - z) < 10 * PROP_SCALE) ||
        [...this.berths.values()].some((b) => Math.hypot(b.x - x, b.z - z) < 6 * PROP_SCALE),
    });
    mark("barrancas");
  }

  private fbm(x: number, z: number, octaves: number, seed: number): number {
    return fbm(x, z, octaves, seed);
  }

  /**
   * The islands: flat ground a little above the river, cut exactly along
   * the shoreline (the Delta has no hills, and its banks drop straight into
   * the water, see RiverBanks). Triangulated from the shoreline regions.
   */
  private createGround(): void {
    const size = this.world.world.size;
    const { points: vertices, landIndices: indices } = this.layout;
    const count = vertices.length / 2;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = vertices[i * 2];
      const z = vertices[i * 2 + 1];
      positions[i * 3] = x;
      positions[i * 3 + 1] = WATER_LEVEL + BANK_TOP;
      positions[i * 3 + 2] = z;
      normals[i * 3 + 1] = 1;
      // Same mapping as the splatmap: u along +x, v along +z over the whole world
      uvs[i * 2] = x / size + 0.5;
      uvs[i * 2 + 1] = z / size + 0.5;
    }
    const ground = new Mesh("ground", this.scene);
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.uvs = uvs;
    data.indices = indices;
    data.applyToMesh(ground);
    ground.isPickable = false;
    ground.freezeWorldMatrix();

    try {
      const terrainMat = new TerrainMaterial("terrainMat", this.scene);

      // Splatmap: R=grass, G=dirt, B=sand
      terrainMat.mixTexture = this.generateSplatmap();
      mark("islas: splatmap");

      // Textures repeat every ~10 m so the lawn has detail up close
      const tiles = size / (10 * PROP_SCALE);

      // Lawn (R channel) - coherent noise texture
      const grassTex = this.createProceduralGrass();
      grassTex.uScale = grassTex.vScale = tiles;
      terrainMat.diffuseTexture1 = grassTex;

      // Dirt (G channel) - earthy pattern
      const dirtTex = this.createProceduralDirt();
      dirtTex.uScale = dirtTex.vScale = tiles;
      terrainMat.diffuseTexture2 = dirtTex;

      // Lush, darker grass (B channel): unmown patches and shade
      const lushTex = this.createProceduralLushGrass();
      lushTex.uScale = lushTex.vScale = tiles;
      terrainMat.diffuseTexture3 = lushTex;

      // Try loading higher-quality CDN textures (replaces procedural on success)
      this.tryLoadCDNTextures(terrainMat, size / (10 * PROP_SCALE));

      terrainMat.specularColor = new Color3(0.05, 0.05, 0.05);
      terrainMat.specularPower = 4;
      // Earcut doesn't guarantee one winding: draw both faces
      terrainMat.backFaceCulling = false;

      ground.material = terrainMat;
      mark("islas: texturas");
    } catch (e) {
      console.warn("TerrainMaterial failed, using fallback:", e);
      const fallback = new StandardMaterial("groundFallback", this.scene);
      fallback.diffuseTexture = this.createProceduralGrass();
      (fallback.diffuseTexture as Texture).uScale = 80;
      (fallback.diffuseTexture as Texture).vScale = 80;
      fallback.specularColor = new Color3(0.05, 0.05, 0.05);
      fallback.backFaceCulling = false;
      ground.material = fallback;
    }
  }

  /** World y of the ground, to stand trees and houses on it (the islands are flat). */
  private groundY(_x: number, _z: number): number {
    return WATER_LEVEL + BANK_TOP;
  }

  /**
   * Splatmap from the precomputed layout: lawn almost everywhere (R), worn
   * earth in spots and along the bank edge (G), lush unmown grass (B).
   */
  private generateSplatmap(): RawTexture {
    const { splat, splatRes: res } = this.layout;
    const rgba = new Uint8Array(res * res * 4);
    for (let k = 0; k < res * res; k++) {
      const dirt = splat[k * 2];
      const lush = splat[k * 2 + 1];
      rgba[k * 4] = Math.max(0, 255 - dirt - lush);
      rgba[k * 4 + 1] = dirt;
      rgba[k * 4 + 2] = lush;
      rgba[k * 4 + 3] = 255;
    }
    const tex = RawTexture.CreateRGBATexture(rgba, res, res, this.scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
    tex.name = "splatmap";
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    return tex;
  }

  /** Procedural tiling grass texture with coherent noise */
  private createProceduralGrass(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("grassProc", size, this.scene, true);
    paintPixels(tex, size, (x, y, out) => {
      const n1 = this.fbm(x * 0.08, y * 0.08, 4, 777);
      const n2 = this.fbm(x * 0.15, y * 0.15, 2, 778);
      const n = (n1 - 0.5) * 0.3 + (n2 - 0.5) * 0.1;
      out[0] = 0.28 + n * 0.3;
      out[1] = 0.58 + n * 0.6;
      out[2] = 0.18 + n * 0.15;
    });
    return tex;
  }

  /** Procedural tiling dirt/earth texture with coherent noise */
  private createProceduralDirt(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("dirtProc", size, this.scene, true);
    paintPixels(tex, size, (x, y, out) => {
      const n1 = this.fbm(x * 0.1, y * 0.1, 4, 888);
      const n2 = this.fbm(x * 0.2, y * 0.2, 2, 889);
      const n = (n1 - 0.5) * 0.25 + (n2 - 0.5) * 0.08;
      // Dark olive soil with leaf litter, clearly different from the river's cafe con leche
      out[0] = 0.34 + n * 0.6;
      out[1] = 0.32 + n * 0.55;
      out[2] = 0.2 + n * 0.35;
    });
    return tex;
  }

  /** Procedural tiling lush grass: darker and denser than the mown lawn */
  private createProceduralLushGrass(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("lushGrassProc", size, this.scene, true);
    paintPixels(tex, size, (x, y, out) => {
      const n1 = this.fbm(x * 0.12, y * 0.12, 4, 990);
      const n2 = this.fbm(x * 0.35, y * 0.35, 2, 991);
      const n = (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2;
      out[0] = 0.2 + n * 0.25;
      out[1] = 0.46 + n * 0.55;
      out[2] = 0.13 + n * 0.12;
    });
    return tex;
  }

  /** Try loading a higher-quality grass texture (and its normal map) from the BabylonJS CDN */
  private tryLoadCDNTextures(terrainMat: TerrainMaterial, tiles: number): void {
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
          grassCDN.uScale = grassCDN.vScale = tiles;
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
                grassNormal.uScale = grassNormal.vScale = tiles;
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

    // Set clear color
    this.scene.clearColor = new Color4(0.53, 0.81, 0.92, 1);
    // Fog for atmosphere
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    // Humid haze of the Delta; also hides where the tree streaming ends
    this.scene.fogDensity = 0.0065;
    this.scene.fogColor = new Color3(0.6, 0.78, 0.85);
  }

  /** A procedural tree, kept clear of houses, docks and moored boats. */
  private addTree(x: number, z: number, seed: number, species: SpeciesName, rotation?: number): void {
    const clear = 3.5 * PROP_SCALE;
    if (this.nearDock(x, z) || this.houses.some((h) => Math.abs(h.x - x) < clear && Math.abs(h.z - z) < clear)) return;
    const rng = seededRandom(seed);
    this.forest.add({
      x,
      y: this.groundY(x, z),
      z,
      rotation: rotation ?? rng() * Math.PI * 2,
      scale: (0.8 + rng() * 0.4) * PROP_SCALE,
      species,
    });
  }

  /** Island woods: a clump of 3-8 trees of one or two species around a scattered seed point. */
  private addGrove(x: number, z: number, seed: number, waterSystem: WaterSystem): void {
    const rng = seededRandom(seed * 7 + 3);
    const main = INLAND_SPECIES[seed % INLAND_SPECIES.length];
    const other = INLAND_SPECIES[(seed >> 3) % INLAND_SPECIES.length];
    const count = 3 + Math.floor(rng() * 6);
    for (let k = 0; k < count; k++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 2.2;
      const tx = x + Math.cos(a) * r;
      const tz = z + Math.sin(a) * r;
      if (waterSystem.isWater(tx, tz)) continue;
      this.addTree(tx, tz, Math.floor(rng() * 1e9), rng() < 0.7 ? main : other);
    }
  }

  /**
   * The wall of vegetation along every bank, as in the photos: willows
   * leaning over the water, rows of casuarinas, broadleaf trees and some
   * poplars, a few meters back from the edge. Rings have water on their
   * left, so land is on the right.
   */
  private plantBanks(rings: Vec2[][], waterSystem: WaterSystem): void {
    const rng = seededRandom(2718);
    let row: SpeciesName | null = null;
    let rowLeft = 0;
    for (const ring of rings) {
      let next = rng() * 4 * PROP_SCALE;
      let walked = 0;
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i];
        const [bx, bz] = ring[(i + 1) % ring.length];
        const len = Math.hypot(bx - ax, bz - az);
        if (len === 0) continue;
        const toWater: [number, number] = [-(bz - az) / len, (bx - ax) / len];
        while (next < walked + len) {
          const t = (next - walked) / len;
          const back = (1.2 + rng() * 2.6) * PROP_SCALE;
          const x = ax + (bx - ax) * t - toWater[0] * back;
          const z = az + (bz - az) * t - toWater[1] * back;
          // Denser than one tree per design spacing: the bank is a wall of trees
          next += (2.6 + rng() * 3.4) * PROP_SCALE * 1.6;
          if (rng() < 0.18 || waterSystem.isWater(x, z) || waterSystem.isWater(x - toWater[0] * 0.2, z - toWater[1] * 0.2)) continue;

          let species: SpeciesName;
          if (rowLeft > 0 && row) {
            species = row;
            rowLeft--;
          } else {
            const roll = rng();
            species = roll < 0.38 ? "sauce" : roll < 0.6 ? "casuarina" : roll < 0.9 ? "fronda" : "alamo";
            // Casuarinas and poplars are planted in rows along the shore
            if (species === "casuarina" || species === "alamo") {
              row = species;
              rowLeft = 3 + Math.floor(rng() * 6);
            }
          }
          // Lean (+x of the generated tree) out over the water
          const lean = Math.atan2(-toWater[1], toWater[0]) + (rng() - 0.5) * 0.5;
          this.addTree(x, z, Math.floor(rng() * 1e9), species, lean);
        }
        walked += len;
      }
    }
  }

  /** Delta house; next to the water it stands on stilts. */
  private addHouse(x: number, z: number, seed: number, onStilts: boolean): void {
    const rng = seededRandom(seed);
    const p = this.props;
    const parent = propTransform(x, this.groundY(x, z), z, rng() * Math.PI * 2, PROP_SCALE);

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

      if (waterSystem.isWater(x, z) || this.nearDock(x, z)) continue;

      const nearWater = this.waterDistance.at(x, z) <= d;

      if (!nearWater && rng() >= rule.inlandChance) continue;

      const seed = i * rule.instanceSeed.stride + rule.instanceSeed.offset;
      switch (rule.prefab) {
        case "tree":
          // The banks are planted along the shoreline; scattered trees are inland
          if (!nearWater) this.addGrove(x, z, seed, waterSystem);
          break;
        case "house":
          this.addHouse(x, z, seed, nearWater);
          this.houses.push({ x, z });
          if (nearWater) this.waterfrontHouses.push({ x, z });
          break;
      }
    }
  }

  /**
   * 2-4 rowing yolas moored bow to stern along the bank beside a dock,
   * floating just off the bank (the Delta has no beaches to pull them up on).
   */
  private moorYolas(site: DockSite, toWater: [number, number], rng: () => number, waterSystem: WaterSystem): void {
    const along: [number, number] = [-toWater[1], toWater[0]];
    const side = rng() < 0.5 ? 1 : -1;
    const count = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < count; k++) {
      // Clear of the deck and of the side stairs, one hull length apart
      const off = side * (DOCK_HALF_ALONG + (3 + k * 3.1) * PROP_SCALE);
      let x = site.x + along[0] * off;
      let z = site.z + along[1] * off;
      // Find this spot's own water's edge across the shore line
      const wetHere = waterSystem.isWater(x, z);
      let found = false;
      for (let t = 0; t < 12 * PROP_SCALE; t += 0.05) {
        const sx = x + (wetHere ? -toWater[0] : toWater[0]) * t;
        const sz = z + (wetHere ? -toWater[1] : toWater[1]) * t;
        if (waterSystem.isWater(sx, sz) !== wetHere) {
          // Last water point before the bank
          x = wetHere ? sx + toWater[0] * 0.05 : sx;
          z = wetHere ? sz + toWater[1] * 0.05 : sz;
          found = true;
          break;
        }
      }
      if (!found) continue;
      this.moored.push({
        x: x + toWater[0] * 0.55 * PROP_SCALE,
        z: z + toWater[1] * 0.55 * PROP_SCALE,
        heading: Math.atan2(along[0] * side, along[1] * side) + (rng() - 0.5) * 0.08,
      });
    }
  }

  /** Streams trees and grass around the camera. */
  public update(dt: number, camera: Vector3): void {
    this.forest.update(camera);
    this.grass.update(dt, camera);
  }

  /** Rowing yolas moored along the bank beside the docks. */
  public getMooredYolas(): MooredSpot[] {
    return this.moored;
  }

  /** Keeps vegetation and houses off the bus-boat stops. */
  private nearDock(x: number, z: number): boolean {
    return (
      this.dockSites.some((site) => Math.abs(site.x - x) < 5 * PROP_SCALE && Math.abs(site.z - z) < 5 * PROP_SCALE) ||
      this.moored.some((spot) => Math.abs(spot.x - x) < 2 * PROP_SCALE && Math.abs(spot.z - z) < 2 * PROP_SCALE)
    );
  }

  /**
   * Places a bus-boat stop on the bank (its berth, and yolas moored
   * beside it). The muelle itself is drawn later by buildDocks; local +x is
   * the open side facing the water, where the boat comes alongside.
   */
  private addDock(dock: Dock, waterSystem: WaterSystem): void {
    const rng = seededRandom(hashString(dock.id));
    const site = placeOnBank(dock, waterSystem, DOCK_HALF_X);
    this.berths.set(dock.id, site.berth);
    this.dockSites.push({ x: site.x, z: site.z, rotation: site.rotation, seed: hashString(dock.id) });
    if (site.toWater && rng() < 0.6) this.moorYolas(site, site.toWater, rng, waterSystem);
  }

  /** The Blender muelle at every dock; box docks if the model can't load. */
  private async buildDocks(): Promise<void> {
    const placements = this.dockSites.map((site) => propTransform(site.x, WATER_LEVEL, site.z, site.rotation, PROP_SCALE));
    try {
      await placeDockModels(this.scene, placements);
    } catch (error) {
      console.warn("Dock model failed to load, using box docks:", error);
      const fallback = createPropBatches(this.scene);
      for (const site of this.dockSites) this.addBoxDock(fallback, site);
      for (const batch of Object.values(fallback)) batch.build();
    }
  }

  /** Box-built muelle (fallback): same layout as the Blender model, coarser. */
  private addBoxDock(p: PropBatches, site: { x: number; z: number; rotation: number; seed: number }): void {
    const rng = seededRandom(site.seed);
    const parent = propTransform(site.x, WATER_LEVEL, site.z, site.rotation, PROP_SCALE);
    const deckTop = 1.3;
    const halfX = BOX_DOCK_HALF_X;
    const halfZ = BOX_DOCK_HALF_ALONG;

    // Piles from the river bottom up to the deck, plus diagonal bracing
    for (const px of [-halfX + 0.15, 0, halfX - 0.15]) {
      for (const pz of [-halfZ + 0.15, halfZ - 0.15]) {
        p.dockPosts.add(parent, [0.22, 2.6, 0.22], [px, deckTop - 1.35, pz], COLOR.pile);
      }
    }
    for (const pz of [-halfZ + 0.15, halfZ - 0.15]) {
      for (const side of [-1, 1]) {
        p.dockPosts.add(parent, [2.2, 0.1, 0.08], [side * 0.92, 0.35, pz], COLOR.pile, [0, 0, side * 0.55]);
      }
    }

    // Deck: separate planks with slightly different tones read as real wood
    for (let k = 0; k < 7; k++) {
      const shade = 0.9 + rng() * 0.2;
      const plank = new Color3(COLOR.deck.r * shade, COLOR.deck.g * shade, COLOR.deck.b * shade);
      p.dockPlatforms.add(parent, [halfX * 2, 0.12, 0.4], [0, deckTop - 0.06, -halfZ + 0.22 + k * 0.43], plank);
    }
    p.dockPlatforms.add(parent, [halfX * 2, 0.18, 0.12], [0, deckTop - 0.2, -halfZ + 0.06], COLOR.pile);
    p.dockPlatforms.add(parent, [halfX * 2, 0.18, 0.12], [0, deckTop - 0.2, halfZ - 0.06], COLOR.pile);

    // Railing on the land side and both ends; the water side stays open for boarding
    const rail = rng() < 0.7 ? COLOR.white : COLOR.railBlue;
    const railY = deckTop + 0.9;
    for (const pz of [-halfZ + 0.05, halfZ - 0.05]) {
      for (const px of [-halfX + 0.05, -halfX / 2, 0, halfX / 2]) {
        p.dockPosts.add(parent, [0.09, 0.9, 0.09], [px, deckTop + 0.45, pz], rail);
      }
      p.dockPosts.add(parent, [halfX * 1.5, 0.08, 0.08], [-halfX * 0.25, railY, pz], rail);
      p.dockPosts.add(parent, [halfX * 1.5, 0.06, 0.06], [-halfX * 0.25, deckTop + 0.45, pz], rail);
    }
    for (const pz of [-halfZ / 2, 0, halfZ / 2]) {
      p.dockPosts.add(parent, [0.09, 0.9, 0.09], [-halfX + 0.05, deckTop + 0.45, pz], rail);
    }
    p.dockPosts.add(parent, [0.08, 0.08, halfZ * 2], [-halfX + 0.05, railY, 0], rail);

    // Quincho: four posts and a gable roof of corrugated sheet metal
    const roof = ROOF_SHEET_COLORS[Math.floor(rng() * ROOF_SHEET_COLORS.length)];
    const postTop = deckTop + 2.0;
    for (const px of [-1.3, 1.3]) {
      for (const pz of [-1.1, 1.1]) {
        p.dockPosts.add(parent, [0.12, 2.0, 0.12], [px, deckTop + 1.0, pz], rail);
      }
    }
    const slope = 0.45;
    const slab = 1.45;
    for (const side of [-1, 1]) {
      p.roofs.add(
        parent,
        [3.3, 0.07, slab],
        [0, postTop + (Math.sin(slope) * slab) / 2, side * (Math.cos(slope) * slab) / 2],
        roof,
        [side * slope, 0, 0]
      );
    }
    p.roofs.add(parent, [3.4, 0.1, 0.12], [0, postTop + Math.sin(slope) * slab, 0], roof);

    // Stop sign hanging under the eave on the water side
    p.signs.add(parent, [0.08, 0.35, 1.3], [1.32, postTop - 0.25, 0], COLOR.sign);

    // Stairs from the deck down into the water at one end
    const stairZ = halfZ + 0.45;
    for (let k = 0; k < 5; k++) {
      p.dockPlatforms.add(parent, [0.8, 0.07, 0.28], [halfX - 0.55, deckTop - 0.25 - k * 0.3, stairZ + k * 0.22], COLOR.deck);
    }
    for (const sx of [halfX - 0.98, halfX - 0.12]) {
      p.dockPosts.add(parent, [0.07, 0.12, 1.8], [sx, deckTop - 0.85, stairZ + 0.45], COLOR.pile, [0.94, 0, 0]);
    }
  }

  /**
   * Where the boat must stop for each dock: on the water just off the
   * muelle's open side (docks are moved from the channel to the bank).
   */
  public getBerths(): ReadonlyMap<string, Berth> {
    return this.berths;
  }
}

const COLOR = {
  wood: hexToColor3(COLORS.wood),
  woodDark: hexToColor3(COLORS.woodDark),
  sign: new Color3(0.12, 0.12, 0.14),
  pile: new Color3(0.33, 0.25, 0.17),
  deck: new Color3(0.55, 0.4, 0.26),
  white: new Color3(0.9, 0.9, 0.86),
  railBlue: new Color3(0.35, 0.55, 0.75),
};
/** Corrugated roofs of Delta quinchos: galvanized grey, green and oxide red. */
const ROOF_SHEET_COLORS = [new Color3(0.62, 0.64, 0.66), new Color3(0.27, 0.4, 0.3), new Color3(0.55, 0.22, 0.18)];

/** Half the muelle's depth out over the water (Blender model: 3 m deep). */
/** Trees scattered away from the water. */
const INLAND_SPECIES: SpeciesName[] = ["fronda", "fronda", "alamo", "casuarina", "fronda"];

const DOCK_HALF_X = 1.5 * PROP_SCALE;
/** Half its length along the shore (4.2 m), stairs not included. */
const DOCK_HALF_ALONG = 2.1 * PROP_SCALE;
/** Design size of the box-built fallback muelle (before PROP_SCALE). */
const BOX_DOCK_HALF_X = 1.5;
const BOX_DOCK_HALF_ALONG = 2.1;
/** Water between the muelle's open side and the boat's center when moored. */
const BERTH_GAP = 1.5 * PROP_SCALE;
/** Island ground height above the river: the low bank of the Delta islands. */
const BANK_TOP = 0.6 * PROP_SCALE;
/** How far from the World Doc point a dock may move to reach the bank. */
const MAX_BANK_SEARCH = 40;

/** Where the lancha stops for a dock, moored alongside it. */
export interface Berth {
  x: number;
  z: number;
  /** Boat heading (atan2(dx, dz) convention) parallel to the shore. */
  heading: number;
}

interface DockSite {
  x: number;
  z: number;
  /** Y rotation that makes local +x (the open, boarding side) face the water. */
  rotation: number;
  berth: Berth;
  /** Unit vector from the bank towards the water (null when no bank was found). */
  toWater: [number, number] | null;
}

/**
 * Puts a dock at the water's edge. Junction stops sit mid-channel, so they
 * move sideways (perpendicular to the river) to the nearest bank; stops on
 * land move to the nearest water. The deck hangs over the water with its
 * land edge on the bank, and the berth is just off its open side.
 */
function placeOnBank(dock: Dock, waterSystem: WaterSystem, halfX: number): DockSite {
  const wet = (x: number, z: number) => waterSystem.isWater(x, z);
  let dir: [number, number] | null = null; // unit vector from the bank towards the water
  let edge: [number, number] = [dock.x, dock.z]; // last water point before the bank

  if (wet(dock.x, dock.z)) {
    // Walk both ways across the river; the closer bank wins
    const a = degToRad(dock.rotationDeg);
    const across: [number, number] = [Math.cos(a), -Math.sin(a)];
    let best = Infinity;
    for (const s of [1, -1]) {
      for (let t = 0.1; t <= MAX_BANK_SEARCH; t += 0.1) {
        const x = dock.x + s * across[0] * t;
        const z = dock.z + s * across[1] * t;
        if (!wet(x, z)) {
          if (t < best) {
            best = t;
            dir = [-s * across[0], -s * across[1]];
            edge = [x - s * across[0] * 0.1, z - s * across[1] * 0.1];
          }
          break;
        }
      }
    }
  } else {
    // On land: find the nearest water around it
    let best = Infinity;
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2;
      const d: [number, number] = [Math.cos(ang), Math.sin(ang)];
      for (let t = 0.1; t <= MAX_BANK_SEARCH && t < best; t += 0.1) {
        if (wet(dock.x + d[0] * t, dock.z + d[1] * t)) {
          best = t;
          dir = d;
          edge = [dock.x + d[0] * t, dock.z + d[1] * t];
          break;
        }
      }
    }
  }

  if (!dir) {
    // Open water everywhere (or nowhere): keep the authored placement
    const rotation = degToRad(dock.rotationDeg);
    return {
      x: dock.x,
      z: dock.z,
      rotation,
      berth: {
        x: dock.x + Math.cos(rotation) * (halfX + BERTH_GAP),
        z: dock.z - Math.sin(rotation) * (halfX + BERTH_GAP),
        heading: -rotation,
      },
      toWater: null,
    };
  }

  // Deck center: over the water, its land edge a little onto the bank
  const inset = halfX - 0.5 * PROP_SCALE;
  const x = edge[0] + dir[0] * inset;
  const z = edge[1] + dir[1] * inset;
  // RotationY(r) maps local +x to (cos r, -sin r): solve for +x = dir
  const rotation = Math.atan2(-dir[1], dir[0]);

  // Berth just off the open side, but never past mid-channel: in a narrow
  // arroyo that would land it on the far bank
  let width = 0;
  while (width < MAX_BANK_SEARCH && wet(edge[0] + dir[0] * (width + 0.1), edge[1] + dir[1] * (width + 0.1))) width += 0.1;
  const reach = Math.min(inset + halfX + BERTH_GAP, Math.max(0.2, width / 2));
  // Moored parallel to the shore: heading along the bank, atan2(dx, dz) convention
  const heading = Math.atan2(-dir[1], dir[0]);
  return { x, z, rotation, berth: { x: edge[0] + dir[0] * reach, z: edge[1] + dir[1] * reach, heading }, toWater: dir };
}

/** Stable small hash so each dock gets the same look on every load. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 2147483646 + 1;
}

const WALL_COLORS =["#d4c5a0", "#c9b896", "#b8a882", "#e0d5b8"].map(hexToColor3);
const ROOF_COLORS = [COLORS.roof, COLORS.roofBlue, "#8b4513", "#2a6a3a"].map(hexToColor3);

/** One draw call per kind of prop part, shared by every instance in the world. */
function createPropBatches(scene: Scene) {
  const matte = new Color3(0.03, 0.03, 0.03);
  return {
    stilts: new InstancedBoxBatch("stilts", scene),
    walls: new InstancedBoxBatch("walls", scene, { specular: matte }),
    roofs: new InstancedBoxBatch("roofs", scene),
    doors: new InstancedBoxBatch("doors", scene),
    dockPlatforms: new InstancedBoxBatch("dockPlatforms", scene),
    dockPosts: new InstancedBoxBatch("dockPosts", scene),
    signs: new InstancedBoxBatch("signs", scene, { emissive: new Color3(0.05, 0.05, 0.05) }),
    reeds: new InstancedBoxBatch("reeds", scene, { specular: new Color3(0.02, 0.02, 0.02) }),
  };
}
type PropBatches = ReturnType<typeof createPropBatches>;
