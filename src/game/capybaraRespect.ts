/**
 * The rule for capybara families crossing (ADR 0018): stopping for them
 * earns points, rushing past (or washing them) loses points and sends them
 * under water. Pure: the RuleBook calls it with what the engine knows.
 *
 * All the numbers are design values (docs/investigacion/12-carpinchos.md):
 * the only sourced one is the 10 m minimum distance people are asked to
 * keep on land; a boat makes waves, so the game asks for much more.
 */
import type { FamilyPhase } from "./capybaraFamily";

/** The warning «Carpinchos cruzando — frená» shows within this distance (m). */
export const ALERT_M = 80;
/** Being this close or closer, slowly, counts as respecting them (m). */
export const RESPECT_M = 40;
/** Within this distance (m), a fast boat scares them. */
export const FAST_M = 40;
/** Within this distance (m), a big wave scares them. */
export const WAKE_M = 60;
/** Closer than this (m) it is a bump: they dive whatever the speed. */
export const COLLIDE_M = 6;
/** «Paso de hombre» (m/s): ~5 km/h. */
export const SLOW_MPS = 1.5;
/** Wave height (m) that reaches them swimming with their backs at the surface. */
export const SCARE_WAKE_M = 0.08;
/** Points lost when they are scared. */
export const SCARE_PENALTY = 60;
/** Points won for stopping: a base plus a bit per calf. */
export const reward = (calves: number): number => 100 + 25 * calves;

export const MSG_WARN = "Carpinchos cruzando — frená";
export const MSG_SCARE = "Las olas y el apuro asustan a los carpinchos: se zambulleron.\nCerca de la fauna, a paso de hombre.";
export const MSG_BUMP = "Los carpinchos se asustaron y se zambulleron.\nDejales el paso libre.";
export const msgReward = (n: number): string => `¡Respetaste a los carpinchos! +${n}`;

export interface FamilyView {
  id: number;
  phase: FamilyPhase;
  /** Distance (m) from the boat to the nearest animal. */
  distanceM: number;
  calves: number;
}

export interface RespectInputs {
  /** Speed of the boat over the water (m/s, real scale). */
  speedMps: number;
  /** Height (m) of the wave the boat is making now. */
  wakeHeight: number;
  families: FamilyView[];
}

export interface RespectEvent {
  kind: "warn" | "fine" | "reward";
  familyId: number;
  message: string;
  /** Points lost (positive) or won (negative). */
  penalty: number;
  /** The family should dive. */
  scare?: boolean;
}

interface Track {
  warned: boolean;
  /** Was close and slow while they crossed. */
  polite: boolean;
  failed: boolean;
  wasCrossing: boolean;
}

export class CapybaraRespect {
  private tracks = new Map<number, Track>();
  private speed = 0;
  /** Points earned for respecting them so far. */
  respected = 0;
  /** Families that crossed while the player stopped for them. */
  families = 0;

  private track(id: number): Track {
    let t = this.tracks.get(id);
    if (!t) this.tracks.set(id, (t = { warned: false, polite: false, failed: false, wasCrossing: false }));
    return t;
  }

  update(dt: number, s: RespectInputs): RespectEvent[] {
    const out: RespectEvent[] = [];
    // A smoothed speed: a kayak's stroke or a gust must not count as rushing
    this.speed += (Math.abs(s.speedMps) - this.speed) * (1 - Math.exp(-dt / 1.0));
    const slow = this.speed <= SLOW_MPS;
    for (const f of s.families) {
      const t = this.track(f.id);
      if (f.phase === "crossing") {
        t.wasCrossing = true;
        if (!t.warned && f.distanceM <= ALERT_M) {
          t.warned = true;
          out.push({ kind: "warn", familyId: f.id, message: MSG_WARN, penalty: 0 });
        }
        if (t.failed) continue;
        const bump = f.distanceM <= COLLIDE_M;
        const rush = f.distanceM <= FAST_M && !slow;
        const wave = f.distanceM <= WAKE_M && s.wakeHeight > SCARE_WAKE_M;
        if (bump || rush || wave) {
          t.failed = true;
          out.push({ kind: "fine", familyId: f.id, message: bump ? MSG_BUMP : MSG_SCARE, penalty: SCARE_PENALTY, scare: true });
        } else if (f.distanceM <= RESPECT_M && slow) {
          t.polite = true;
        }
      } else if (t.wasCrossing) {
        // The crossing ended: on the far bank (respected) or under water (scared)
        if (f.phase === "farBank" && t.polite && !t.failed) {
          const n = reward(f.calves);
          this.respected += n;
          this.families++;
          out.push({ kind: "warn", familyId: f.id, message: msgReward(n), penalty: -n });
        }
        this.tracks.delete(f.id);
      } else if (f.phase !== "dived" && f.distanceM <= COLLIDE_M) {
        // Grazing on the bank and a boat right on top of them: they just dive
        out.push({ kind: "warn", familyId: f.id, message: MSG_BUMP, penalty: 0, scare: true });
      }
    }
    // Forget families that are no longer around
    for (const id of [...this.tracks.keys()]) if (!s.families.some((f) => f.id === id)) this.tracks.delete(id);
    return out;
  }
}
