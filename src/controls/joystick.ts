/**
 * Pure logic of the "Ruedita" (on-screen joystick), without DOM so it can be
 * tested. The widget (StickWidget in widgets.ts) only feeds it finger
 * offsets and applies what comes back.
 *
 * - Up/down sets the throttle lever (it stays where it is left, like the
 *   palanca de mando); left/right is the helm, "turn while you push".
 * - Inside the dead zone the stick reads zero; beyond it the value is
 *   rescaled so it still reaches 1 at the rim.
 */

/** Share of the radius where the stick reads neutral. */
export const DEAD_ZONE = 0.12;

/** The five positions of a boat telegraph. */
export const TELEGRAPH = [-1, -0.5, 0, 0.5, 1];

export interface StickReading {
  /** -1 (astern) to 1 (ahead). */
  throttle: number;
  /** -1 (left) to 1 (right). */
  steering: number;
  /** Where the knob is drawn: finger offset clipped to the circle, in px (screen axes, y down). */
  knobX: number;
  knobY: number;
}

/** From the finger offset (dx, dy) in px from the centre and the radius to throttle and steering. */
export function readStick(dx: number, dy: number, radius: number, dead = DEAD_ZONE): StickReading {
  if (!(radius > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return { throttle: 0, steering: 0, knobX: 0, knobY: 0 };
  const dist = Math.hypot(dx, dy);
  const k = dist > radius ? radius / dist : 1; // clip to the circle
  const knobX = dx * k;
  const knobY = dy * k;
  const len = Math.min(1, dist / radius);
  if (len < dead) return { throttle: 0, steering: 0, knobX, knobY };
  const scale = (len - dead) / (1 - dead) / len; // dead zone out, rim still reaches 1
  const nx = (knobX / radius) * scale;
  const ny = (knobY / radius) * scale;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  // Screen y grows downward: pushing up is ahead
  return { throttle: clamp(-ny) + 0, steering: clamp(nx) + 0, knobX, knobY };
}

/** The nearest position of the telegraph. */
export function snapToTelegraph(v: number, positions: number[] = TELEGRAPH): number {
  return positions.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

/**
 * What happens when the finger lifts: the helm goes back to zero and the
 * throttle stays (cruise); with the telegraph it settles on one of its five
 * positions.
 */
export function releaseStick(throttle: number, telegraph: boolean): { throttle: number; steering: number } {
  return { throttle: telegraph ? snapToTelegraph(throttle) : throttle, steering: 0 };
}
