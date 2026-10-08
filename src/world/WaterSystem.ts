import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Constants } from "@babylonjs/core/Engines/constants";
import { WATER_LEVEL, PROP_SCALE } from "../utils/constants";
import type { Vec2, WorldDoc } from "./WorldDoc";
import { isSet, type WaterGrid } from "./waterGeometry";
import { seededRandom } from "../utils/helpers";
import { DeltaWaterMaterial } from "./DeltaWaterMaterial";
import { mark } from "../utils/perf";
import { ShoreIndex } from "./shoreline";
import { layoutRings, SHORE_RANGE, SHORE_SDF_RANGE, SHORE_SDF_RES, type WorldLayout } from "./layout/worldLayout";

export { SHORE_SDF_RANGE };

export interface Shore {
  /** Closed shoreline rings, water on the left of their direction. */
  rings: Vec2[][];
}

/** A single-channel (R8) texture from layout data: row 0 at the world's -z edge. */
export function r8Texture(scene: Scene, name: string, data: Uint8Array, res: number): RawTexture {
  const tex = new RawTexture(
    data,
    res,
    res,
    Constants.TEXTUREFORMAT_R,
    scene,
    false,
    false,
    Texture.BILINEAR_SAMPLINGMODE,
    Constants.TEXTURETYPE_UNSIGNED_BYTE
  );
  tex.name = name;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

/**
 * The river: water surface, shore textures and the water tests used for
 * collisions and placement. Its shape comes from the precomputed world
 * layout (see layout/worldLayout.ts); this class only builds GPU resources.
 */
export class WaterSystem {
  private water!: DeltaWaterMaterial;
  private time = 0;
  private grid: WaterGrid;
  private shore: Shore;
  private shoreIndex: ShoreIndex;

  constructor(
    private scene: Scene,
    private world: WorldDoc,
    private layout: WorldLayout
  ) {
    this.grid = { size: layout.size, res: layout.gridRes, cells: layout.grid };
    this.shore = { rings: layoutRings(layout) };
    const grid = this.grid;
    this.shoreIndex = new ShoreIndex(this.shore.rings, layout.size, (x, z) => isSet(grid, x, z));
    mark("agua: índice");
    this.createRiverMeshes();
  }

  /** Shoreline rings (water on their left). */
  public getShore(): Shore {
    return this.shore;
  }

  /**
   * Fast approximate test (2-unit grid rasterized from the same shoreline),
   * for shading and texturing; use isWater for collisions and placement.
   */
  public isWaterCoarse(worldX: number, worldZ: number): boolean {
    return isSet(this.grid, worldX, worldZ);
  }

  /** Exact: true when the point is inside the drawn water (same shoreline as the banks). */
  public isWater(worldX: number, worldZ: number): boolean {
    return this.shoreIndex.isWater(worldX, worldZ);
  }

  /**
   * Signed distance to the shore for the whole world (R: 0.5 at the shore,
   * above on land, below on water, spanning +-SHORE_SDF_RANGE). Bilinear
   * filtering keeps the edge accurate below the texel size, so shaders can
   * stop things right at the bank.
   */
  public createShoreDistanceTexture(): RawTexture {
    return r8Texture(this.scene, "distanciaCosta", this.layout.shoreSdf, SHORE_SDF_RES);
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
    mark("agua: normales");
    this.water = new DeltaWaterMaterial(this.scene, {
      normalMap,
      shoreMap: r8Texture(this.scene, "shoreMap", this.layout.shoreMap, this.layout.shoreMapRes),
      worldSize: this.world.world.size,
      shoreRange: SHORE_RANGE,
    });
    this.tryCdnNormalMap();
    this.createWaterMesh();
    mark("agua: malla");
  }

  /** The whole water surface, from the shoreline outline: a single draw call. */
  private createWaterMesh(): Mesh {
    const { points, waterIndices } = this.layout;
    const count = points.length / 2;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = points[i * 2];
      const z = points[i * 2 + 1];
      positions[i * 3] = x;
      positions[i * 3 + 1] = WATER_LEVEL + 0.04;
      positions[i * 3 + 2] = z;
      normals[i * 3 + 1] = 1;
      uvs[i * 2] = x / 20;
      uvs[i * 2 + 1] = z / 20;
    }
    const mesh = new Mesh("water", this.scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = waterIndices;
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
