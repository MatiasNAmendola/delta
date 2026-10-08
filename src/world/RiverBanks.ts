import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PROP_SCALE, WATER_LEVEL } from "../utils/constants";
import { seededRandom } from "../utils/helpers";
import type { Vec2 } from "./WorldDoc";
import { InstancedBoxBatch, propTransform } from "./InstancedBatch";
import { paintPixels } from "./texturePaint";

/** Wall bottom, below the (opaque) water surface. */
const WALL_FOOT = -0.6 * PROP_SCALE;

export interface RiverBankOptions {
  /** Height of the island ground above the water. */
  bankTop: number;
  /** Stretches of shore with a wooden bulkhead (tablestacado) instead of a mud bank. */
  isBulkhead: (x: number, z: number) => boolean;
  /** Shore spots kept clear of floating plants and reeds (docks, berths). */
  keepClear: (x: number, z: number) => boolean;
}

/**
 * The edge of every island, as in the Delta: no beaches, a low vertical
 * bank straight into the water. Either a muddy bank with the grass hanging
 * over it or, in front of houses and docks, a wooden bulkhead. At its foot,
 * clumps of reeds (juncos) and floating water hyacinth (camalotes).
 */
export class RiverBanks {
  constructor(scene: Scene, rings: Vec2[][], options: RiverBankOptions) {
    const mud = new WallBuilder();
    const wood = new WallBuilder();
    const reeds = new InstancedBoxBatch("juncos", scene, { specular: new Color3(0.02, 0.02, 0.02), shape: "cross" });
    const camalotes = new InstancedBoxBatch("camalotes", scene, {
      shape: "blob",
      specular: new Color3(0.08, 0.08, 0.08),
    });
    const rng = seededRandom(31);

    for (const ring of rings) {
      let walked = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const mx = (a[0] + b[0]) / 2;
        const mz = (a[1] + b[1]) / 2;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len === 0) continue;
        const bulkhead = options.isBulkhead(mx, mz);
        (bulkhead ? wood : mud).add(a, b, walked, options.bankTop);

        // Water is on the left of the ring direction
        const nx = -(b[1] - a[1]) / len;
        const nz = (b[0] - a[0]) / len;
        if (!bulkhead && !options.keepClear(mx, mz)) {
          for (let t = 0; t < len; t += 3 * PROP_SCALE) {
            const x = a[0] + ((b[0] - a[0]) * t) / len;
            const z = a[1] + ((b[1] - a[1]) * t) / len;
            const roll = rng();
            if (roll < 0.03) addReeds(reeds, x + nx * 0.3 * PROP_SCALE, z + nz * 0.3 * PROP_SCALE, rng);
            else if (roll < 0.045) addCamalotes(camalotes, x, z, nx, nz, rng);
          }
        }
        walked += len;
      }
    }

    // Where the water surface meets the wall, as a fraction of its height
    const waterline = -WALL_FOOT / (options.bankTop - WALL_FOOT);
    mud.build("barranca", scene, createMudBankMaterial(scene, waterline), 4 * PROP_SCALE);
    wood.build("tablestacado", scene, createBulkheadMaterial(scene, waterline), 2.4 * PROP_SCALE);
    reeds.build();
    camalotes.build();
  }
}

/** Vertical quads along the shore, textured by distance walked along it. */
class WallBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];

  add(a: Vec2, b: Vec2, walked: number, top: number): void {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Faces the water (left of the ring direction)
    const nx = -(b[1] - a[1]) / len;
    const nz = (b[0] - a[0]) / len;
    const base = this.positions.length / 3;
    const y0 = WATER_LEVEL + WALL_FOOT;
    const y1 = WATER_LEVEL + top;
    this.positions.push(a[0], y0, a[1], a[0], y1, a[1], b[0], y0, b[1], b[0], y1, b[1]);
    for (let k = 0; k < 4; k++) this.normals.push(nx, 0, nz);
    this.uvs.push(walked, 0, walked, 1, walked + len, 0, walked + len, 1);
    this.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }

  build(name: string, scene: Scene, material: StandardMaterial, metersPerTile: number): Mesh | null {
    if (this.indices.length === 0) return null;
    for (let i = 0; i < this.uvs.length; i += 2) this.uvs[i] /= metersPerTile;
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.normals = this.normals;
    data.uvs = this.uvs;
    data.indices = this.indices;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    material.freeze();
    return mesh;
  }
}

/** Earth bank: wet dark mud at the waterline, roots and layers, grass hanging over the top. */
function createMudBankMaterial(scene: Scene, waterline: number): StandardMaterial {
  const size = 256;
  const tex = new DynamicTexture("barrancaTex", size, scene, true);
  const rng = seededRandom(5);
  const streaks = Array.from({ length: size }, () => rng());
  paintPixels(tex, size, (x, y, out) => {
    // Canvas row 0 is the top of the wall once uploaded
    const v = 1 - y / size;
    const fromTop = 1 - v;
    const n = streaks[x] * 0.12 + Math.sin(y * 0.35 + streaks[(x * 7) % size] * 6) * 0.03;
    if (fromTop < 0.12 + streaks[x] * 0.18) {
      // Grass curling over the edge, in uneven tufts
      const g = 0.32 + streaks[(x * 3) % size] * 0.2;
      out[0] = 0.18 + n; out[1] = g + n; out[2] = 0.08;
    } else {
      // Packed earth, darker and wet below the waterline
      const wet = v < waterline ? 0.55 : 1;
      out[0] = (0.36 + n) * wet; out[1] = (0.27 + n * 0.8) * wet; out[2] = (0.17 + n * 0.5) * wet;
      // Exposed roots
      if (streaks[(x * 13 + (y >> 3)) % size] > 0.97) {
        out[0] = 0.5; out[1] = 0.42; out[2] = 0.3;
      }
    }
  });
  return wallMaterial(scene, "barrancaMat", tex);
}

/** Wooden bulkhead: vertical weathered planks, a top beam and a dark wet waterline. */
function createBulkheadMaterial(scene: Scene, waterline: number): StandardMaterial {
  const size = 256;
  const tex = new DynamicTexture("tablestacadoTex", size, scene, true);
  const rng = seededRandom(9);
  const planks = 10;
  const tones = Array.from({ length: planks }, () => 0.85 + rng() * 0.3);
  const grain = Array.from({ length: size }, () => rng());
  paintPixels(tex, size, (x, y, out) => {
    const v = 1 - y / size;
    const plank = Math.floor((x / size) * planks);
    const edge = ((x / size) * planks) % 1;
    const gap = edge < 0.05 ? 0.45 : 1;
    const tone = tones[plank] * gap * (0.92 + grain[(x * 5 + plank) % size] * 0.12);
    const wet = v < waterline + 0.06 ? 0.55 : 1;
    // Top cap beam
    if (v > 0.9) {
      out[0] = 0.4 * tone; out[1] = 0.3 * tone; out[2] = 0.2 * tone;
      return;
    }
    out[0] = 0.47 * tone * wet; out[1] = 0.37 * tone * wet; out[2] = 0.26 * tone * wet;
  });
  return wallMaterial(scene, "tablestacadoMat", tex);
}

function wallMaterial(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new StandardMaterial(name, scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.04, 0.04, 0.04);
  mat.backFaceCulling = false;
  return mat;
}

const REED_COLORS = [new Color3(0.5, 0.58, 0.28), new Color3(0.66, 0.63, 0.38), new Color3(0.38, 0.5, 0.22)];
const HYACINTH_COLORS = [new Color3(0.2, 0.42, 0.14), new Color3(0.26, 0.5, 0.18), new Color3(0.17, 0.36, 0.12)];

/** Reeds standing in the shallows at the foot of the bank, taller than it. */
function addReeds(batch: InstancedBoxBatch, x: number, z: number, rng: () => number): void {
  const stalks = 6 + Math.floor(rng() * 6);
  for (let k = 0; k < stalks; k++) {
    const h = 1.1 + rng() * 0.9;
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.8;
    const tone = REED_COLORS[Math.floor(rng() * REED_COLORS.length)];
    const parent = propTransform(
      x + Math.cos(a) * r * PROP_SCALE,
      WATER_LEVEL - 0.3 * PROP_SCALE,
      z + Math.sin(a) * r * PROP_SCALE,
      rng() * Math.PI,
      PROP_SCALE
    );
    batch.add(parent, [0.07, h, 0.07], [0, h / 2, 0], tone, [(rng() - 0.5) * 0.35, 0, (rng() - 0.5) * 0.35]);
  }
}

/** Floating water hyacinth clumps drifting against the bank. */
function addCamalotes(batch: InstancedBoxBatch, x: number, z: number, nx: number, nz: number, rng: () => number): void {
  const count = 2 + Math.floor(rng() * 3);
  for (let k = 0; k < count; k++) {
    const out = 0.5 + rng() * 1.3;
    const side = (rng() - 0.5) * 2.5;
    const px = x + (nx * out - nz * side) * PROP_SCALE;
    const pz = z + (nz * out + nx * side) * PROP_SCALE;
    const tone = HYACINTH_COLORS[Math.floor(rng() * HYACINTH_COLORS.length)];
    const parent = propTransform(px, WATER_LEVEL + 0.05 * PROP_SCALE, pz, rng() * Math.PI, PROP_SCALE);
    batch.add(parent, [0.9 + rng() * 0.9, 0.35, 0.7 + rng() * 0.7], [0, 0, 0], tone);
  }
}
