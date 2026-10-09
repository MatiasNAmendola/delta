/**
 * Way and drift (docs/adr/0009):
 * - In neutral, or easing off, a boat keeps its way: water drag takes the
 *   speed down exponentially over the hull's `coastTime`, ahead or astern.
 *   Only pushing against the way (astern while going ahead) brakes hard.
 * - The river carries every boat: its speed through the water is added to
 *   the water's own motion. A heavy hull takes `coastTime` to pick that
 *   motion up; then, engine off, it drifts with the flood or the ebb.
 */

/**
 * Speed after `dt` seconds of easing off toward `target` (same units as
 * speed). Hull drag grows with speed, so the time constant shrinks at speed:
 * from full speed most of the way goes in a couple of seconds, then the hull
 * glides on slowly for `coastTime`.
 */
export function coastToward(speed: number, target: number, dt: number, coastTime: number, snap: number, maxSpeed = Infinity): number {
  const excess = Math.min(1, Math.abs(speed - target) / maxSpeed);
  const tau = Math.max(0.1, coastTime * (0.15 + 0.85 * (1 - excess)));
  const next = target + (speed - target) * Math.exp(-dt / tau);
  return Math.abs(next - target) < snap ? target : next;
}

/** Is the lever asking to go the other way from the boat's way (a hard brake)? */
export function isBraking(speed: number, target: number): boolean {
  return target !== 0 && speed !== 0 && Math.sign(target) !== Math.sign(speed);
}

/** The boat's drift (world units/s) after `dt` seconds, easing into the water's motion. */
export function driftToward(drift: [number, number], current: [number, number], dt: number, coastTime: number): [number, number] {
  const k = 1 - Math.exp(-dt / Math.max(0.1, coastTime));
  return [drift[0] + (current[0] - drift[0]) * k, drift[1] + (current[1] - drift[1]) * k];
}
