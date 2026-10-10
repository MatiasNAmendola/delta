/**
 * The boat is never still on the river (docs/adr/0009): on top of the
 * pitch and roll the hull takes from the chop right under it (buoyancy.ts),
 * the swell rocks it slowly, the bow wanders side to side and the hull
 * sways, more so when it is slow or stopped, with more wind, and the
 * smaller and lighter the boat. Visual only: the heading the player steers
 * and the position the rules see are not touched (the wind's real push,
 * the leeway, is in Boat.ts with the river's drift).
 *
 * Pure (no Babylon) so it can be tested.
 */
export interface SeawayMotion {
  /** Radians. */
  roll: number;
  pitch: number;
  yaw: number;
  /** World units, to the boat's starboard. */
  sway: number;
}

/**
 * How lively a hull of this length (world units, 8 m each) is: a kayak
 * (0.6) about twice the lancha colectiva (2).
 */
export function liveliness(length: number): number {
  return Math.min(1.6, Math.max(0.5, 1.5 / (0.5 + length)));
}

/**
 * The swell's motion at time `t` (s). `wind` 0..1, `speedRatio` 0..1 (way
 * on steadies the bow), `phase` varies boat to boat.
 */
export function seaway(t: number, wind: number, length: number, speedRatio: number, phase = 0): SeawayMotion {
  const k = liveliness(length);
  const sea = 0.35 + 1.4 * Math.min(1, Math.max(0, wind));
  const slow = 1 - 0.65 * Math.min(1, Math.abs(speedRatio));
  // Two periods each, so the rocking never repeats exactly
  const roll = 0.06 * k * sea * (Math.sin(t * 1.9 + phase) * 0.7 + Math.sin(t * 1.23 + phase * 2.1) * 0.4);
  const pitch = 0.016 * k * sea * (Math.sin(t * 1.55 + phase * 1.3) * 0.7 + Math.sin(t * 2.4 + phase * 0.6) * 0.3);
  // The bow wanders slowly; with way on the hull holds its course
  const yaw = 0.09 * k * sea * slow * (Math.sin(t * 0.62 + phase) * 0.7 + Math.sin(t * 0.37 + phase * 1.7) * 0.45);
  const sway = 0.045 * k * sea * slow * Math.sin(t * 0.9 + phase * 0.8);
  return { roll, pitch, yaw, sway };
}

/**
 * Leeway: what the wind pushes a boat sideways, at full wind (world
 * units/s), taken with the river's drift. A few percent of the wind speed,
 * more for light hulls and those with a high cabin (windage).
 */
export function leeway(length: number, cabin: boolean): number {
  return 0.06 * Math.min(1.4, liveliness(length)) * (cabin ? 1.3 : 1);
}
