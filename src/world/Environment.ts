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
import { WaterDistanceField } from "./WaterDistanceField";

export class Environment {
  private scene: Scene;
  private world: WorldDoc;
  private props: PropBatches;
  /** Static meshes worth showing in the water reflection/refraction passes. */
  private reflectedMeshes: AbstractMesh[] = [];
  /** Distance to the nearest water, shared by texturing, relief and vegetation. */
  private waterDistance: WaterDistanceField;
  private berths = new Map<string, { x: number; z: number }>();
  private dockSites: Array<{ x: number; z: number }> = [];

  constructor(scene: Scene, waterSystem: WaterSystem, world: WorldDoc) {
    this.scene = scene;
    this.world = world;
    // ~3 world units per cell (256 for the original 800-unit Delta); also the splatmap size
    const res = world.world.size <= 800 ? 256 : 1024;
    this.waterDistance = new WaterDistanceField(world.world.size, res, (x, z) => waterSystem.isWater(x, z));
    this.createGround();
    this.createSkybox();
    this.props = createPropBatches(scene);
    // Docks first: vegetation and houses keep clear of where they end up
    for (const dock of world.docks) {
      this.addDock(dock, waterSystem);
    }
    for (const rule of world.scatter) {
      this.scatter(rule, waterSystem);
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

  private createGround(): void {
    // More subdivisions for vertex displacement (hills/terrain)
    // ~12 world units per terrain quad (64 for the original 800-unit Delta)
    const subdivisions = Math.min(256, Math.max(64, Math.round(this.world.world.size / 12.5)));
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: this.world.world.size, height: this.world.world.size, subdivisions, updatable: true },
      this.scene
    );
    ground.position.y = WATER_LEVEL - 0.3;
    ground.receiveShadows = true;
    this.reflectedMeshes.push(ground);

    // Displace vertices to create terrain elevation
    this.displaceTerrainVertices(ground);

    try {
      const terrainMat = new TerrainMaterial("terrainMat", this.scene);

      // Splatmap: R=grass, G=dirt, B=sand
      terrainMat.mixTexture = this.generateSplatmap();

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

  /** Displace terrain vertices: below the water under rivers, low banks, rolling hills inland. */
  private displaceTerrainVertices(ground: Mesh): void {
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    for (let i = 0; i < positions.length; i += 3) {
      // Ground is centered at the origin, so local = world
      const x = positions[i];
      const z = positions[i + 2];
      const d = this.waterDistance.at(x, z);

      if (d === 0) {
        positions[i + 1] = -0.5; // Under the water surface
        continue;
      }

      // Low muddy bank right at the water, blending into hills further inland
      const bank = this.fbm(x * 0.02, z * 0.02, 3, 42) * 0.8;
      const hills =
        this.fbm(x * 0.008, z * 0.008, 4, 42) * 4.0 +
        this.fbm(x * 0.025, z * 0.025, 2, 99) * 1.0;
      const inland = smoothstep(4, 20, d);
      positions[i + 1] = Math.max(0, bank + (Math.max(0.2, hills) - bank) * inland);
    }

    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    ground.createNormals(true);
  }

  /** Splatmap from the water distance field.
   *  R = grass (far from water), G = dirt (medium), B = sand (near water) */
  private generateSplatmap(): DynamicTexture {
    const field = this.waterDistance;
    const size = field.res;
    const tex = new DynamicTexture("splatmap", size, this.scene, false);

    paintPixels(tex, size, (px, py, out) => {
      // Canvas row 0 is the far (+z) edge of the ground once uploaded
      const j = size - 1 - py;
      const x = -field.size / 2 + (px + 0.5) * field.cell;
      const z = -field.size / 2 + (j + 0.5) * field.cell;

      // Coherent noise makes the mud/grass edges irregular, not banded
      const noise = (this.fbm(x * 0.15, z * 0.15, 2, 456) - 0.5) * 2.5;
      const dist = clamp(field.atCell(px, j) + noise, 0, 30);

      // Delta banks: a thin strip of wet sand and mud, then grass almost to the water
      if (dist <= 1) {
        out[0] = 0; out[1] = 0.25; out[2] = 0.75;
      } else if (dist <= 2.5) {
        // Sand-to-mud transition
        const t = (dist - 1) / 1.5;
        out[0] = 0; out[1] = 0.25 + t * 0.6; out[2] = (1 - t) * 0.75;
      } else if (dist <= 6) {
        // Mud-to-grass transition
        const t = (dist - 2.5) / 3.5;
        out[0] = t * 0.9; out[1] = (1 - t) * 0.85 + t * 0.1; out[2] = 0;
      } else {
        out[0] = 0.9; out[1] = 0.1; out[2] = 0;
      }
    });

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
      out[0] = 0.5 + n * 0.8;
      out[1] = 0.36 + n * 0.6;
      out[2] = 0.2 + n * 0.4;
    });
    return tex;
  }

  /** Procedural tiling sand texture with coherent noise */
  private createProceduralSand(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("sandProc", size, this.scene, true);
    paintPixels(tex, size, (x, y, out) => {
      const n1 = this.fbm(x * 0.12, y * 0.12, 3, 999);
      const n2 = this.fbm(x * 0.3, y * 0.3, 2, 1000);
      const n = (n1 - 0.5) * 0.15 + (n2 - 0.5) * 0.05;
      out[0] = 0.8 + n * 0.6;
      out[1] = 0.7 + n * 0.55;
      out[2] = 0.4 + n * 0.4;
    });
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

      if (waterSystem.isWater(x, z) || this.nearDock(x, z)) continue;

      const nearWater = this.waterDistance.at(x, z) <= d;

      if (!nearWater && rng() >= rule.inlandChance) continue;

      const seed = i * rule.instanceSeed.stride + rule.instanceSeed.offset;
      switch (rule.prefab) {
        case "tree":
          this.addTree(x, z, seed);
          // Delta banks are a wall of vegetation: grow a small grove at the water
          if (nearWater) this.addGrove(x, z, seed, waterSystem);
          break;
        case "house":
          this.addHouse(x, z, seed, nearWater);
          break;
      }
    }
  }

  /** 1-3 extra trees around a bank tree, on dry ground only. */
  private addGrove(x: number, z: number, seed: number, waterSystem: WaterSystem): void {
    const rng = seededRandom(seed * 31 + 7);
    const extra = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < extra; k++) {
      const angle = rng() * Math.PI * 2;
      const r = 1.5 + rng() * 2.5;
      const tx = x + Math.cos(angle) * r;
      const tz = z + Math.sin(angle) * r;
      if (waterSystem.isWater(tx, tz) || this.nearDock(tx, tz)) continue;
      this.addTree(tx, tz, seed * 97 + k);
    }
  }

  /** Keeps vegetation and houses off the bus-boat stops. */
  private nearDock(x: number, z: number): boolean {
    return this.dockSites.some((site) => Math.abs(site.x - x) < 5 && Math.abs(site.z - z) < 5);
  }

  /**
   * Bus-boat stop modeled on real Delta muelles: plank deck raised on piles
   * with cross bracing, white railing, a gable-roofed quincho and stairs down
   * to the water. Local +x is the water side, where the boat comes alongside.
   */
  private addDock(dock: Dock, waterSystem: WaterSystem): void {
    const p = this.props;
    const rng = seededRandom(hashString(dock.id));
    const site = placeOnBank(dock, waterSystem, DOCK_HALF_X);
    this.berths.set(dock.id, site.berth);
    this.dockSites.push({ x: site.x, z: site.z });
    const parent = propTransform(site.x, WATER_LEVEL, site.z, site.rotation);
    const deckTop = 1.3;
    const halfX = DOCK_HALF_X; // deck 4 x 3
    const halfZ = 1.5;

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
  public getBerths(): ReadonlyMap<string, { x: number; z: number }> {
    return this.berths;
  }

  /** Static meshes worth showing in the water reflection/refraction passes. */
  public getReflectedMeshes(): AbstractMesh[] {
    return this.reflectedMeshes;
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

const DOCK_HALF_X = 2.0;
/** How far from the World Doc point a dock may move to reach the bank. */
const MAX_BANK_SEARCH = 40;

interface DockSite {
  x: number;
  z: number;
  /** Y rotation that makes local +x (the open, boarding side) face the water. */
  rotation: number;
  berth: { x: number; z: number };
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
      for (let t = 0.5; t <= MAX_BANK_SEARCH; t += 0.5) {
        const x = dock.x + s * across[0] * t;
        const z = dock.z + s * across[1] * t;
        if (!wet(x, z)) {
          if (t < best) {
            best = t;
            dir = [-s * across[0], -s * across[1]];
            edge = [x - s * across[0] * 0.5, z - s * across[1] * 0.5];
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
      for (let t = 0.5; t <= MAX_BANK_SEARCH && t < best; t += 0.5) {
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
    return { x: dock.x, z: dock.z, rotation, berth: { x: dock.x + Math.cos(rotation) * (halfX + 1.5), z: dock.z - Math.sin(rotation) * (halfX + 1.5) } };
  }

  // Deck center: over the water, its land edge 0.5 units onto the bank
  const inset = halfX - 0.5;
  const x = edge[0] + dir[0] * inset;
  const z = edge[1] + dir[1] * inset;
  // RotationY(r) maps local +x to (cos r, -sin r): solve for +x = dir
  const rotation = Math.atan2(-dir[1], dir[0]);
  const reach = halfX + 1.5;
  return { x, z, rotation, berth: { x: x + dir[0] * reach, z: z + dir[1] * reach } };
}

/** Stable small hash so each dock gets the same look on every load. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 2147483646 + 1;
}
/**
 * Fills a square DynamicTexture in one upload. `shade` writes RGB in 0..1
 * into `out` for pixel (x, y); writing an ImageData is orders of magnitude
 * faster than one fillRect per pixel.
 */
function paintPixels(
  tex: DynamicTexture,
  size: number,
  shade: (x: number, y: number, out: [number, number, number]) => void
): void {
  const ctx = tex.getContext();
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const rgb: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      shade(x, y, rgb);
      const k = (y * size + x) * 4;
      data[k] = clamp(rgb[0], 0, 1) * 255;
      data[k + 1] = clamp(rgb[1], 0, 1) * 255;
      data[k + 2] = clamp(rgb[2], 0, 1) * 255;
      data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update(true);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const WALL_COLORS =["#d4c5a0", "#c9b896", "#b8a882", "#e0d5b8"].map(hexToColor3);
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
    signs: new InstancedBoxBatch("signs", scene, { emissive: new Color3(0.05, 0.05, 0.05) }),
  };
}
type PropBatches = ReturnType<typeof createPropBatches>;
