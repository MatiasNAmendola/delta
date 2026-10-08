/**
 * The waves a boat leaves behind (ADR 0012), from the physics of ship
 * wakes, not a look-alike. Pure, shared by the CPU (boats rocking in
 * someone's wake) and, line by line, by the wake shader (WakeRibbon.ts).
 *
 * - Kelvin (1887): a boat at constant speed U in deep water leaves a steady
 *   pattern of two wave families inside a wedge of 19.47° (asin 1/3):
 *   transverse waves across the track and divergent waves fanning out
 *   from the sides, strongest along the wedge edges (cusp waves). A wave
 *   travelling at angle θ to the track has wavenumber k = k0 / cos²θ,
 *   k0 = g / U² (wavelength 2πU²/g · cos²θ), so it keeps pace with the boat.
 * - Rabaud & Moisy (2013), Darmon et al. (2014): a hull of length L cannot
 *   make waves much longer than itself. Above Froude Fr = U / √(gL) ≈ 0.5
 *   the transverse and cusp waves fade and the strongest waves sit at an
 *   angle shrinking like 1/Fr: a fast launch leaves a narrow V, a slow
 *   lancha colectiva the full Kelvin wedge.
 * - Planing hulls make their biggest wake while climbing onto the plane
 *   (the hump, Fr ≈ 0.5); once planing it drops. Transverse waves get lower
 *   with speed (Tavakoli et al. 2022).
 *
 * Coordinates: x metres behind the bow along the track, y metres to the
 * side. Heights in metres.
 */
import type { HullType } from "../boat/buoyancy";

export const G = 9.81;
/** Kelvin half-angle: asin(1/3) ≈ 19.47°. */
export const KELVIN_ANGLE = Math.asin(1 / 3);
export const KELVIN_TAN = 1 / Math.sqrt(8);

export interface WakeSource {
  /** Speed (m/s, real scale). */
  U: number;
  /** Waterline length and beam (m). */
  L: number;
  beam: number;
  /** Wave height (m) at the boat's top speed, close behind it. */
  height: number;
  /** Froude number at top speed (to scale the height to the current speed). */
  topFroude: number;
  hull: HullType;
}

export function froude(U: number, L: number): number {
  return U / Math.sqrt(G * L);
}

/**
 * How big the wake is at Froude number fr, relative to the hull's own
 * scale. Displacement hulls: grows steeply up to hull speed (Fr ≈ 0.4),
 * then levels off. Planing hulls: a hump around Fr 0.55, then about half
 * of it once planing.
 */
export function wakeGrowth(fr: number, hull: HullType): number {
  if (hull === "planing") {
    const hump = Math.exp(-(((fr - 0.55) / 0.3) ** 2));
    const plane = 0.45 * smoothstep(0.6, 1.1, fr);
    return Math.max(hump, plane) + 0.25 * Math.min(1, (fr / 0.35) ** 3) * (1 - smoothstep(0.35, 0.6, fr));
  }
  return Math.min(1, (fr / 0.4) ** 3) * (1 - 0.15 * smoothstep(0.45, 0.9, fr));
}

/** Wave height scale (m) of a source at its current speed. */
export function wakeAmplitude(s: WakeSource): number {
  if (s.U <= 0.05) return 0;
  const fr = froude(s.U, s.L);
  return (s.height * wakeGrowth(fr, s.hull)) / Math.max(1e-3, wakeGrowth(s.topFroude, s.hull));
}

/**
 * The hull as a wave maker: it cannot raise waves much longer than itself
 * (high-pass, Rabaud & Moisy) nor much shorter than its beam (low-pass).
 */
export function hullFilter(k: number, L: number, beam: number): number {
  const u = (k * L) / (2 * Math.PI); // hull lengths per wavelength
  const high = u ** 4 / (u ** 4 + 0.35 ** 4);
  const low = Math.exp(-(((k * beam) / 4) ** 2));
  return high * low;
}

export interface KelvinBranch {
  /** Wavenumber (rad/m) and phase at the point. */
  k: number;
  phase: number;
  /** Relative amplitude (0..~1). */
  weight: number;
}

/**
 * The two Kelvin waves through a point (stationary phase): transverse
 * (θ small) and divergent (θ large). Outside the wedge both fade out.
 */
export function kelvinBranches(x: number, y: number, s: WakeSource): [KelvinBranch, KelvinBranch] | null {
  if (x <= 0 || s.U <= 0.05) return null;
  const T = Math.abs(y) / x; // tan of the angle seen from the bow
  const k0 = G / (s.U * s.U);
  const outside = Math.max(0, T - KELVIN_TAN);
  const disc = Math.max(0, 1 - 8 * T * T);
  const sq = Math.sqrt(disc);
  // tanθ roots of 2T t² − t + T = 0, written to stay finite on the track (T → 0)
  const thetas = [Math.atan((2 * T) / (1 + sq)), Math.atan2(1 + sq, 4 * T)];
  // Cusp: amplitudes pile up where the two branches meet (Airy), capped
  const cusp = Math.min(2.2, (disc + 0.02) ** -0.25);
  const edge = Math.exp(-((outside / 0.035) ** 2));
  const r = Math.hypot(x, y);
  const spread = Math.sqrt(s.L / Math.max(r, s.L)); // waves spread out: 1/√r
  return thetas.map((theta, i) => {
    const c = Math.cos(theta);
    const k = k0 / Math.max(1e-4, c * c);
    const phase = k * (x * c + Math.abs(y) * Math.sin(theta)) + (i === 0 ? Math.PI / 4 : -Math.PI / 4);
    const weight = hullFilter(k, s.L, s.beam) * cusp * edge * spread;
    return { k, phase, weight };
  }) as [KelvinBranch, KelvinBranch];
}

/** Water elevation (m) of the wake at (x behind the bow, y to the side). */
export function kelvinElevation(x: number, y: number, s: WakeSource): number {
  const b = kelvinBranches(x, y, s);
  if (!b) return 0;
  const a = wakeAmplitude(s);
  return softLimit(a * (b[0].weight * Math.cos(b[0].phase) + b[1].weight * Math.cos(b[1].phase)) / 1.3, a);
}

/**
 * Angle (radians from the track) where the wake's waves are strongest, x
 * metres behind the bow: Kelvin's 19.47° for slow boats, narrower for fast
 * ones. For tests and tuning.
 */
export function strongestAngle(s: WakeSource, x = 30 * s.L): number {
  let best = 0;
  let bestW = -1;
  for (let a = 0.005; a < KELVIN_ANGLE + 0.05; a += 0.0025) {
    const b = kelvinBranches(x, x * Math.tan(a), s);
    if (!b) continue;
    const w = Math.max(b[0].weight, b[1].weight);
    if (w > bestW) {
      bestW = w;
      best = a;
    }
  }
  return best;
}

/**
 * The turbulent wake right behind the boat (the white "hilo" of the
 * propeller and hull, not a wave): about a beam wide, widening slowly as
 * t^0.4 with its age, foamy at first and a smooth slick for minutes after.
 */
export function turbulentWidth(beam: number, age: number): number {
  return beam * (0.55 + 0.45 * Math.pow(Math.max(0, age), 0.4));
}

/** Keeps cusp pile-ups near the nominal height without clipping them flat. */
export function softLimit(h: number, a: number): number {
  return a > 0 ? a * Math.tanh(h / a) : 0;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
