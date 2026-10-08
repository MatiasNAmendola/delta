import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { WATER_LEVEL, COLORS, PROP_SCALE } from "../utils/constants";
import type { River, Vec2, WorldDoc } from "./WorldDoc";
import {
  createGrid,
  isSet,
  rasterizeAreas,
  riverCoverage,
  uncoveredRuns,
  type WaterGrid,
} from "./waterGeometry";
import { getPointOnPath, hexToColor3, seededRandom } from "../utils/helpers";
import { DeltaWaterMaterial } from "./DeltaWaterMaterial";
import { WaterDistanceField } from "./WaterDistanceField";
import { buildRegions, roughenRing, ShoreIndex, shorelineRings, triangulate, type Polygon } from "./shoreline";

export interface Shore {
  /** Closed shoreline rings, water on the left of their direction. */
  rings: Vec2[][];
  water: Polygon[];
  land: Polygon[];
}

/** Rivers this much inside water areas are drawn only where the areas miss them. */
const STRIP_SKIP_COVERAGE = 0.7;
/**
 * Extra navigable width beside each drawn strip. Kept small so the boat
 * (2 units wide, collision tested at its center) never sails over visible land.
 */
const STRIP_COLLISION_MARGIN = 0.5;
/** Spacing of shoreline points and how far (world units, 8 m each) banks wander in and out. */
const SHORE_STEP = 0.8;
const SHORE_ROUGHNESS = 0.7;
/** Signed shore distance range (world units) of createShoreDistanceTexture. */
export const SHORE_SDF_RANGE = 2;
/** Shore distance (world units) encoded by the brightest shore map value. */
const SHORE_RANGE = 16;

export class WaterSystem {
  private scene: Scene;
  private world: WorldDoc;
  private waterMeshes: Mesh[] = [];
  private water!: DeltaWaterMaterial;
  private time = 0;
  private waterGrid!: WaterGrid;
  /** Cells covered by water areas only (null when the world has none). */
  private areaGrid: WaterGrid | null = null;
  /** River center lines rasterized as water where the OSM polygons miss them (see planStrips). */
  private strips: River[] = [];
  private shore!: Shore;
  private shoreIndex!: ShoreIndex;
  /** Water lookup grid cells per side: ~2 world units per cell (400 for the original 800-unit Delta). */
  private mapResolution: number;

  constructor(scene: Scene, world: WorldDoc) {
    this.scene = scene;
    this.world = world;
    this.mapResolution = Math.min(1600, Math.max(400, Math.round(world.world.size / 2)));
    this.buildCollisionMap();
    this.createRiverMeshes();
  }

  private buildCollisionMap(): void {
    const res = this.mapResolution;
    const size = this.world.world.size;
    this.waterGrid = createGrid(size, res);

    // Real water shapes (OSM polygons) first: they decide which river strips are drawn
    const areas = this.world.waterAreas ?? [];
    if (areas.length > 0) {
      this.areaGrid = createGrid(size, res);
      rasterizeAreas(this.areaGrid, areas);
      this.waterGrid.cells.set(this.areaGrid.cells);
    }
    this.strips = this.planStrips();

    // Navigable water = exactly what is drawn: areas ∪ strips (no hidden water)
    for (const river of this.strips) {
      const samples = river.points.length * 20;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const [rx, rz] = getPointOnPath(river.points, t);
        const halfW = river.width / 2 + STRIP_COLLISION_MARGIN;

        const minX = Math.floor(((rx - halfW + size / 2) / size) * res);
        const maxX = Math.ceil(((rx + halfW + size / 2) / size) * res);
        const minZ = Math.floor(((rz - halfW + size / 2) / size) * res);
        const maxZ = Math.ceil(((rz + halfW + size / 2) / size) * res);

        for (let gx = Math.max(0, minX); gx <= Math.min(res - 1, maxX); gx++) {
          for (let gz = Math.max(0, minZ); gz <= Math.min(res - 1, maxZ); gz++) {
            this.waterGrid.cells[gx * res + gz] = 1;
          }
        }
      }
    }

    // One outline for everything: the water surface, the islands and the
    // river banks are built from these rings, and navigation is re-derived
    // from them so what you see is exactly what you can sail on
    const grid = this.waterGrid;
    // Natural banks: coves and points of a few meters instead of smooth curves
    const room = (x: number, z: number, nx: number, nz: number) => {
      const into = isSet(grid, x + nx * 0.6, z + nz * 0.6);
      for (let t = 0.6; t < 5; t += 0.3) if (isSet(grid, x + nx * t, z + nz * t) !== into) return t;
      return 5;
    };
    const rings = shorelineRings({ res, size, wet: (i, j) => grid.cells[i * res + j] === 1 }).map((r) =>
      roughenRing(r, SHORE_STEP, SHORE_ROUGHNESS, room, size / 2)
    );
    const regions = buildRegions(rings, size);
    this.shore = { rings, water: regions.water, land: regions.land };
    this.waterGrid = createGrid(size, res);
    rasterizeAreas(
      this.waterGrid,
      regions.water.map((poly, i) => ({ id: `agua-${i}`, outer: poly.outer, holes: poly.holes }))
    );
    const coarse = this.waterGrid;
    this.shoreIndex = new ShoreIndex(rings, size, (x, z) => isSet(coarse, x, z));
  }

  /** Shoreline rings (water on their left) and the water/land regions they bound. */
  public getShore(): Shore {
    return this.shore;
  }

  /**
   * River strips to draw: whole rivers, except those already mostly drawn by
   * their real polygon — for those only the stretches the polygons miss, so
   * the channel stays continuous without overlapping (flickering) water.
   */
  private planStrips(): River[] {
    const strips: River[] = [];
    for (const river of this.world.rivers) {
      if (!this.areaGrid || riverCoverage(river, this.areaGrid) < STRIP_SKIP_COVERAGE) {
        strips.push(river);
        continue;
      }
      uncoveredRuns(river, this.areaGrid, 6).forEach((points, k) => {
        strips.push({ ...river, id: `${river.id}-tramo-${k}`, points });
      });
    }
    return strips;
  }

  /**
   * Fast approximate test (2-unit grid rasterized from the same shoreline),
   * for shading and texturing; use isWater for collisions and placement.
   */
  public isWaterCoarse(worldX: number, worldZ: number): boolean {
    return isSet(this.waterGrid, worldX, worldZ);
  }

  /** Exact: true when the point is inside the drawn water (same shoreline as the banks). */
  public isWater(worldX: number, worldZ: number): boolean {
    return this.shoreIndex.isWater(worldX, worldZ);
  }

  /**
   * Signed distance to the shore for the whole world, as a texture: red
   * 0.5 at the shore, above on land, below on water, spanning
   * +-SHORE_SDF_RANGE units. Bilinear filtering of a distance field keeps
   * the edge accurate well below the texel size (2048 texels over the
   * world), so shaders can stop things right at the bank.
   * Texel (u, v) = world (x, z) mapped from -size/2..size/2.
   */
  public createShoreDistanceTexture(): DynamicTexture {
    const res = 2048;
    const size = this.world.world.size;
    const tex = new DynamicTexture("distanciaCosta", res, this.scene, false);
    const ctx = tex.getContext();
    const img = ctx.getImageData(0, 0, res, res);
    const data = img.data;
    const texel = size / res;
    for (let py = 0; py < res; py++) {
      // Canvas row 0 ends up at v = 1 (the +z edge) once uploaded with invertY
      const z = size / 2 - (py + 0.5) * texel;
      for (let px = 0; px < res; px++) {
        const x = -size / 2 + (px + 0.5) * texel;
        const d = this.shoreIndex.signedDistance(x, z, SHORE_SDF_RANGE);
        const k = (py * res + px) * 4;
        data[k] = Math.round((0.5 + d / (2 * SHORE_SDF_RANGE)) * 255);
        data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.update(true);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    return tex;
  }

  /**
   * Swap in Babylon's photographic water normal map when it loads; the
   * procedural one stays if the CDN is unreachable (e.g. offline PWA).
   */
  private tryCdnNormalMap(): void {
    const tex = new Texture(
      "https://assets.babylonjs.com/textures/waterbump.png",
      this.scene,
      false,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
      () => this.water.setNormalMap(tex),
      () => tex.dispose()
    );
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
  }

  /**
   * Distance from every water point to the nearest bank, as a texture the
   * water shader samples for shallows, tree reflections and shore foam.
   */
  private createShoreMap(): DynamicTexture {
    const size = this.world.world.size;
    const res = size <= 800 ? 512 : 1024;
    const field = new WaterDistanceField(size, res, (x, z) => !this.isWaterCoarse(x, z));
    const tex = new DynamicTexture("shoreMap", res, this.scene, true);
    const ctx = tex.getContext();
    const img = ctx.getImageData(0, 0, res, res);
    const data = img.data;
    // Distances are cell center to cell center: the bank itself is half a cell closer
    const half = field.cell / 2;
    for (let py = 0; py < res; py++) {
      // Canvas row 0 ends up at the +z edge once uploaded
      const j = res - 1 - py;
      for (let i = 0; i < res; i++) {
        const d = Math.max(0, field.atCell(i, j) - half);
        const k = (py * res + i) * 4;
        data[k] = Math.min(255, (d / SHORE_RANGE) * 255);
        data[k + 1] = 0;
        data[k + 2] = 0;
        data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.update(true);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    return tex;
  }

  /**
   * Seamless ripple normal map: a sum of directional waves whose wave
   * vectors are whole numbers of cycles per tile, so the texture repeats
   * with no seams (non-integer frequencies drew straight lines on the water).
   */
  private createProceduralBumpTexture(): DynamicTexture {
    const size = 256;
    const tex = new DynamicTexture("waterBump", size, this.scene, true);
    const ctx = tex.getContext();
    const img = ctx.getImageData(0, 0, size, size);
    const data = img.data;

    const rng = seededRandom(7);
    const waves: Array<{ kx: number; ky: number; amp: number; phase: number }> = [];
    for (let i = 0; i < 16; i++) {
      // Mostly along the current, a few crossing chop; shorter waves are weaker
      const cycles = 2 + Math.floor(rng() * 9);
      const angle = (rng() - 0.5) * (i < 10 ? 1.2 : Math.PI * 2) + 0.65;
      const kx = Math.round(Math.cos(angle) * cycles);
      const ky = Math.round(Math.sin(angle) * cycles);
      if (kx === 0 && ky === 0) continue;
      waves.push({ kx, ky, amp: 1 / Math.hypot(kx, ky), phase: rng() * Math.PI * 2 });
    }

    const strength = 0.35;
    const tau = Math.PI * 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Analytic slope of h = sum amp * sin(2pi (kx u + ky v) + phase)
        let du = 0;
        let dv = 0;
        for (const w of waves) {
          const c = Math.cos(tau * (w.kx * u + w.ky * v) + w.phase) * w.amp * tau;
          du += c * w.kx;
          dv += c * w.ky;
        }
        const nx = -du * strength / size * 16;
        const ny = -dv * strength / size * 16;
        const len = Math.hypot(nx, ny, 1);
        const k = (y * size + x) * 4;
        data[k] = (nx / len * 0.5 + 0.5) * 255;
        data[k + 1] = (ny / len * 0.5 + 0.5) * 255;
        data[k + 2] = (1 / len * 0.5 + 0.5) * 255;
        data[k + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    tex.update(false);
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  private createRiverMeshes(): void {
    const normalMap = this.createProceduralBumpTexture();
    this.water = new DeltaWaterMaterial(this.scene, {
      normalMap,
      shoreMap: this.createShoreMap(),
      worldSize: this.world.world.size,
      shoreRange: SHORE_RANGE,
    });
    this.tryCdnNormalMap();

    this.waterMeshes.push(this.createWaterMesh());
  }

  /** The whole water surface, from the shoreline outline: a single draw call. */
  private createWaterMesh(): Mesh {
    const { vertices, indices } = triangulate(this.shore.water);
    const count = vertices.length / 2;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = vertices[i * 2];
      const z = vertices[i * 2 + 1];
      positions.set([x, WATER_LEVEL + 0.04, z], i * 3);
      normals.set([0, 1, 0], i * 3);
      uvs.set([x / 20, z / 20], i * 2);
    }
    const mesh = new Mesh("water", this.scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(mesh);
    mesh.material = this.water.material;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    return mesh;
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.water.update(deltaTime);
  }

  /** Get wave height at a position for boat bobbing */
  public getWaveHeight(x: number, z: number, time: number): number {
    return (
      (Math.sin(x * 0.35 + time * 1.5) * 0.15 +
        Math.sin(z * 0.28 + time * 1.2) * 0.1 +
        Math.sin((x + z) * 0.18 + time * 0.8) * 0.08) *
      PROP_SCALE
    );
  }
}
