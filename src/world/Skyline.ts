import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { seededRandom } from "../utils/helpers";
import { METERS_PER_UNIT } from "../utils/constants";

/**
 * The towns on the mainland side, on the horizon (photo 4 of
 * docs/investigacion/11): Tigre, Nordelta, San Fernando, Escobar, Campana and
 * Zárate, and far away the towers of Buenos Aires. They are kilometres away,
 * beyond the fog and the far plane, so each building is drawn on a ring
 * around the camera at the angular size it really has, hazy blue-grey, and
 * the trees in front hide it.
 */
interface Town {
  name: string;
  lat: number;
  lon: number;
  /** Buildings, spread (m), heights (m). */
  count: number;
  spread: number;
  height: [number, number];
}

const TOWNS: Town[] = [
  { name: "Tigre", lat: -34.426, lon: -58.58, count: 40, spread: 1400, height: [12, 45] },
  { name: "Nordelta", lat: -34.405, lon: -58.645, count: 55, spread: 1800, height: [20, 90] },
  { name: "San Fernando", lat: -34.442, lon: -58.556, count: 30, spread: 1200, height: [12, 40] },
  { name: "Escobar", lat: -34.348, lon: -58.795, count: 25, spread: 1500, height: [10, 30] },
  { name: "Campana", lat: -34.163, lon: -58.958, count: 30, spread: 1800, height: [10, 60] },
  { name: "Zárate", lat: -34.098, lon: -59.028, count: 25, spread: 1500, height: [10, 40] },
  { name: "Buenos Aires", lat: -34.585, lon: -58.42, count: 140, spread: 6000, height: [40, 200] },
];

/** Projection origins of the zones (scripts/osm/*.config.json). */
export const ZONE_ORIGINS: Record<string, { lat: number; lon: number }> = {
  "delta-tigre-real": { lat: -34.35, lon: -58.54 },
  "delta-segunda": { lat: -34.2, lon: -58.47 },
  "delta-guazu": { lat: -34.01, lon: -58.5 },
  "delta-escobar": { lat: -34.24, lon: -58.78 },
};

/** Distance of the ring the skyline is drawn on (inside the far plane). */
const RING = 395;

export class Skyline {
  private mesh: Mesh;
  private buildings: Array<{ x: number; z: number; h: number; w: number; d: number; tone: number }> = [];
  private last = { x: Infinity, z: Infinity, y: Infinity };
  private matrices: Float32Array;
  private colors: Float32Array;

  constructor(scene: Scene, origin: { lat: number; lon: number }, private haze: Color3) {
    const mPerLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
    const rng = seededRandom(4242);
    for (const t of TOWNS) {
      const cx = ((t.lon - origin.lon) * mPerLon) / METERS_PER_UNIT;
      const cz = ((t.lat - origin.lat) * 110540) / METERS_PER_UNIT;
      for (let k = 0; k < t.count; k++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * t.spread;
        // Taller towers towards the centre
        const h = t.height[0] + (t.height[1] - t.height[0]) * rng() ** 2 * (1 - (0.5 * r) / t.spread);
        this.buildings.push({
          x: cx + (Math.cos(a) * r) / METERS_PER_UNIT,
          z: cz + (Math.sin(a) * r) / METERS_PER_UNIT,
          h: h / METERS_PER_UNIT,
          w: (12 + rng() * 25) / METERS_PER_UNIT,
          d: (12 + rng() * 25) / METERS_PER_UNIT,
          tone: rng(),
        });
      }
    }
    this.mesh = MeshBuilder.CreateBox("horizonte", { size: 1 }, scene);
    const mat = new StandardMaterial("horizonteMat", scene);
    mat.disableLighting = true;
    mat.emissiveColor = Color3.White();
    mat.fogEnabled = false;
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.matrices = new Float32Array(this.buildings.length * 16);
    this.colors = new Float32Array(this.buildings.length * 4);
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer("color", this.colors, 4, false);
    this.mesh.thinInstanceCount = 0;
  }

  update(camera: Vector3): void {
    if (Math.hypot(camera.x - this.last.x, camera.z - this.last.z) < 4 && Math.abs(camera.y - this.last.y) < 1) return;
    this.last = { x: camera.x, z: camera.z, y: camera.y };
    const m = new Matrix();
    const scale = new Vector3();
    const pos = new Vector3();
    let n = 0;
    for (const b of this.buildings) {
      const dx = b.x - camera.x;
      const dz = b.z - camera.z;
      const D = Math.hypot(dx, dz);
      // Closer than the ring: inside the fog anyway
      if (D < RING * 1.2) continue;
      const k = RING / D;
      // Base on the ground at its real distance, seen from the camera's height
      const baseY = camera.y - camera.y * k;
      scale.set(b.w * k, b.h * k, b.d * k);
      pos.set(camera.x + dx * k, baseY + (b.h * k) / 2, camera.z + dz * k);
      Matrix.ComposeToRef(scale, Quaternion.RotationYawPitchRoll(Math.atan2(dx, dz), 0, 0), pos, m);
      m.copyToArray(this.matrices, n * 16);
      // Aerial perspective: farther = paler, closer to the sky's haze
      const haze = Math.min(0.85, 0.3 + D / 10000);
      const shade = 0.42 + 0.3 * b.tone;
      this.colors.set([shade * (1 - haze) + this.haze.r * haze, shade * (1 - haze) + this.haze.g * haze, (shade + 0.05) * (1 - haze) + this.haze.b * haze, 1], n * 4);
      n++;
    }
    this.mesh.thinInstanceCount = n;
    this.mesh.thinInstanceBufferUpdated("matrix");
    this.mesh.thinInstanceBufferUpdated("color");
  }
}
