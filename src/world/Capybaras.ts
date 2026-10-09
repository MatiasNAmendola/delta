import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { METERS_PER_UNIT, PROP_SCALE, WATER_LEVEL } from "../utils/constants";
import { CapybaraFamily, BLOCKED_UNITS } from "../game/capybaraFamily";
import type { CrossingZone } from "../game/capybaraZones";
import type { FamilyView } from "../game/capybaraRespect";
import { addDistanceFade } from "./distanceFade";

/** Families appear when the player gets this close to a crossing (units) and vanish farther than DEACTIVATE. */
export const ACTIVATE_UNITS = 70;
export const DEACTIVATE_UNITS = 95;
/** At most this many families at once (7 animals each): one mesh, one draw call. */
const MAX_FAMILIES = 3;
const MAX_MEMBERS = MAX_FAMILIES * 7;
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

const ADULT_TINT = new Color4(0.62, 0.36, 0.22, 1);
const CALF_TINT = new Color4(0.74, 0.5, 0.32, 1);

/**
 * Capybara families that cross the arroyos at the generated crossing zones
 * (game/capybaraZones.ts). Low-poly, made of primitives: a barrel body, a
 * square head, no tail. Every animal is a thin instance of ONE merged mesh,
 * so the whole herd costs a single draw call, and families only exist
 * (and are drawn) near the player, dissolving at a distance.
 */
export class Capybaras {
  private mesh: Mesh;
  private matrices = new Float32Array(MAX_MEMBERS * 16);
  private colors = new Float32Array(MAX_MEMBERS * 4);
  private families = new Map<number, CapybaraFamily>();
  private tmp = new Matrix();
  private time = 0;

  constructor(scene: Scene, readonly zones: CrossingZone[]) {
    this.mesh = buildCapybara(scene);
    const mat = new StandardMaterial("capybaraMat", scene);
    mat.diffuseColor = Color3.White();
    mat.specularColor = new Color3(0.03, 0.03, 0.03);
    addDistanceFade(mat, { fadeStart: FADE_START, fadeEnd: FADE_END });
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer("color", this.colors, 4, false);
    this.mesh.thinInstanceCount = 0;
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

    let n = 0;
    const t = this.tmp;
    for (const f of this.families.values()) {
      const z = f.zone;
      f.update(dt, { playerDist: Math.hypot(z.x - px, z.z - pz), blocked: distanceToSegment(px, pz, z.a, z.b) < BLOCKED_UNITS });
      let i = 0;
      for (const m of f.members()) {
        i++;
        if (m.hidden || n >= MAX_MEMBERS) continue;
        const s = (ADULT_M * (m.calf ? CALF_RATIO : 1)) / METERS_PER_UNIT;
        const bob = m.wet > 0 ? Math.sin(this.time * 2.4 + i * 1.3) * 0.012 : 0;
        const y = GROUND_Y * (1 - m.wet) + (WATER_LEVEL + level - SWIM_SINK * s) * m.wet + bob;
        // Grazing: head down. Swimming: nose slightly up.
        const pitch = m.wet > 0.5 ? -0.06 : m.moving ? 0 : 0.28 + Math.sin(this.time * 0.9 + i * 2.1) * 0.06;
        Matrix.ComposeToRef(new Vector3(s, s, s), Quaternion.FromEulerAngles(pitch, m.heading, 0), new Vector3(m.x, y, m.z), t);
        t.copyToArray(this.matrices, n * 16);
        const tint = m.calf ? CALF_TINT : ADULT_TINT;
        const v = 0.92 + (((f.zone.id * 7 + i * 13) % 10) / 10) * 0.16;
        this.colors.set([tint.r * v, tint.g * v, tint.b * v, 1], n * 4);
        n++;
      }
    }
    this.mesh.thinInstanceCount = n;
    if (n > 0) {
      this.mesh.thinInstanceBufferUpdated("matrix");
      this.mesh.thinInstanceBufferUpdated("color");
    }
  }

  /** Draw calls this adds (for the performance panel and the ADR). */
  get drawCalls(): number {
    return 1;
  }
}

function distanceToSegment(px: number, pz: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

/**
 * One capybara in meters, +z forward, feet at y = 0: a barrel body, a square
 * head with a blunt snout, small ears, short legs, no tail. Vertex colors
 * are tones of the instance color (1 = coat).
 */
function buildCapybara(scene: Scene): Mesh {
  const parts: Mesh[] = [];
  const tone = (v: number) => new Color4(v, v, v, 1);
  const box = (w: number, h: number, d: number, v: number, pos: [number, number, number]) => {
    const m = MeshBuilder.CreateBox("capyPart", { width: w, height: h, depth: d, faceColors: Array(6).fill(tone(v)) }, scene);
    m.position.set(...pos);
    parts.push(m);
  };
  // Barrel body: a cylinder lying along z
  const body = MeshBuilder.CreateCylinder("capyBody", { height: 1.0, diameter: 0.54, tessellation: 8, faceColors: [tone(1), tone(1), tone(0.8)] }, scene);
  body.rotation.x = Math.PI / 2;
  body.scaling.y = 1;
  body.position.set(0, 0.42, -0.05);
  body.bakeCurrentTransformIntoVertices();
  parts.push(body);
  box(0.3, 0.34, 0.34, 1, [0, 0.56, 0.58]); // head
  box(0.26, 0.22, 0.14, 0.55, [0, 0.5, 0.82]); // snout
  box(0.06, 0.07, 0.04, 0.5, [-0.11, 0.76, 0.5]); // ears
  box(0.06, 0.07, 0.04, 0.5, [0.11, 0.76, 0.5]);
  box(0.03, 0.04, 0.03, 0.2, [-0.16, 0.62, 0.7]); // eyes
  box(0.03, 0.04, 0.03, 0.2, [0.16, 0.62, 0.7]);
  for (const [x, z] of [[-0.18, 0.32], [0.18, 0.32], [-0.18, -0.4], [0.18, -0.4]]) box(0.11, 0.22, 0.11, 0.7, [x, 0.11, z]);
  const merged = Mesh.MergeMeshes(parts, true, true)!;
  merged.name = "capybaras";
  return merged;
}
