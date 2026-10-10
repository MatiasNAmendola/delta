import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { METERS_PER_UNIT, PROP_SCALE, WATER_LEVEL } from "../utils/constants";
import { CapybaraFamily, BLOCKED_UNITS } from "../game/capybaraFamily";
import type { CrossingZone } from "../game/capybaraZones";
import type { FamilyView } from "../game/capybaraRespect";
import { addDistanceFade } from "./distanceFade";
import { buildCapybara } from "./capybaraModel";

/** Families appear when the player gets this close to a crossing (units) and vanish farther than DEACTIVATE. */
export const ACTIVATE_UNITS = 70;
export const DEACTIVATE_UNITS = 95;
/** At most this many families at once (7 animals each: 2 adults and up to 5 calves). */
const MAX_FAMILIES = 3;
/** Fade out before they vanish (units from the camera). */
const FADE_START = 26;
const FADE_END = 38;
/** Game scale: a bit bigger than life (1.2 m) so they read from the boat. */
const ADULT_M = 1.7;
const CALF_RATIO = 0.55;
/** Model height (m) that sinks under the water when swimming: only back and head show. */
const SWIM_SINK = 0.46;
/** Height of the island ground (the same for every bank). */
const GROUND_Y = WATER_LEVEL + 0.6 * PROP_SCALE;

// Reddish brown coats, baked into each mesh's vertex colors (calves lighter)
const ADULT_COAT = new Color3(0.62, 0.36, 0.22);
const CALF_COAT = new Color3(0.74, 0.5, 0.32);

/**
 * Capybara families that cross the arroyos at the generated crossing zones
 * (game/capybaraZones.ts). The animal itself is a placeholder of brown
 * balls until there is a capybara GLB (see capybaraModel.ts). Every animal is a thin instance of one merged mesh
 * (one for adults, one for calves, the coat baked in), so the whole herd costs
 * two draw calls, and families only exist
 * (and are drawn) near the player, dissolving at a distance.
 */
export class Capybaras {
  private adults: Herd;
  private calves: Herd;
  private families = new Map<number, CapybaraFamily>();
  private tmp = new Matrix();
  private time = 0;

  constructor(scene: Scene, readonly zones: CrossingZone[]) {
    this.adults = new Herd(scene, "capybarasAdultos", ADULT_COAT, MAX_FAMILIES * 2);
    this.calves = new Herd(scene, "capybarasCrias", CALF_COAT, MAX_FAMILIES * 5);
  }

  /** Families in view as the rule sees them (distance in meters to the nearest animal). */
  views(px: number, pz: number): FamilyView[] {
    const out: FamilyView[] = [];
    for (const f of this.families.values()) {
      out.push({ id: f.zone.id, phase: f.phase, distanceM: f.distanceM(px, pz), calves: f.zone.calves });
    }
    return out;
  }

  scare(id: number, px: number, pz: number): void {
    this.families.get(id)?.scare(px, pz);
  }

  /** The family of a zone, if it is around now (for tests and debugging). */
  family(id: number): CapybaraFamily | undefined {
    return this.families.get(id);
  }

  /** `level`: the river's current level offset (tide). */
  update(dt: number, px: number, pz: number, level: number): void {
    // A hitch must not make a family jump across the arroyo
    dt = Math.min(dt, 0.25);
    this.time += dt;
    // Which crossings are near enough to have a family
    const near = this.zones
      .map((z) => ({ z, d: Math.hypot(z.x - px, z.z - pz) }))
      .filter((e) => e.d < ACTIVATE_UNITS)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_FAMILIES);
    for (const e of near) if (!this.families.has(e.z.id)) this.families.set(e.z.id, new CapybaraFamily(e.z));
    for (const [id, f] of this.families) {
      if (Math.hypot(f.zone.x - px, f.zone.z - pz) > DEACTIVATE_UNITS) this.families.delete(id);
    }

    this.adults.n = 0;
    this.calves.n = 0;
    const t = this.tmp;
    for (const f of this.families.values()) {
      const z = f.zone;
      f.update(dt, { playerDist: Math.hypot(z.x - px, z.z - pz), blocked: distanceToSegment(px, pz, z.a, z.b) < BLOCKED_UNITS });
      let i = 0;
      for (const m of f.members()) {
        i++;
        const herd = m.calf ? this.calves : this.adults;
        if (m.hidden || herd.n >= herd.capacity) continue;
        const s = (ADULT_M * (m.calf ? CALF_RATIO : 1)) / METERS_PER_UNIT;
        const bob = m.wet > 0 ? Math.sin(this.time * 2.4 + i * 1.3) * 0.012 : 0;
        const y = GROUND_Y * (1 - m.wet) + (WATER_LEVEL + level - SWIM_SINK * s) * m.wet + bob;
        // Grazing: head down. Swimming: nose slightly up.
        const pitch = m.wet > 0.5 ? -0.06 : m.moving ? 0 : 0.28 + Math.sin(this.time * 0.9 + i * 2.1) * 0.06;
        Matrix.ComposeToRef(new Vector3(s, s, s), Quaternion.FromEulerAngles(pitch, m.heading, 0), new Vector3(m.x, y, m.z), t);
        t.copyToArray(herd.matrices, herd.n * 16);
        herd.n++;
      }
    }
    this.adults.flush();
    this.calves.flush();
  }

  /** Draw calls this adds (for the performance panel and the ADR). */
  get drawCalls(): number {
    return 2;
  }
}

/** One merged capybara mesh drawn as thin instances (one draw call). */
class Herd {
  readonly mesh: Mesh;
  readonly matrices: Float32Array;
  n = 0;
  constructor(scene: Scene, name: string, coat: Color3, readonly capacity: number) {
    this.matrices = new Float32Array(capacity * 16);
    this.mesh = buildCapybara(scene, name, coat);
    const mat = new StandardMaterial(name + "Mat", scene);
    mat.diffuseColor = Color3.White();
    mat.specularColor = new Color3(0.03, 0.03, 0.03);
    addDistanceFade(mat, { fadeStart: FADE_START, fadeEnd: FADE_END });
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceCount = 0;
  }
  flush(): void {
    this.mesh.thinInstanceCount = this.n;
    if (this.n > 0) this.mesh.thinInstanceBufferUpdated("matrix");
  }
}

function distanceToSegment(px: number, pz: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
