/**
 * The throttle lever of a boat: it stays where you leave it, like the real
 * one. A tap moves it one notch (a quarter), holding moves it smoothly, and
 * it stops for a moment at neutral so stopping is easy. Negative is
 * reverse. Pure, so it can be tested.
 */
export const NOTCH = 0.25;
/** Holding longer than this moves the lever smoothly. */
const HOLD_DELAY = 0.3;
/** Lever travel per second while held. */
const HOLD_RATE = 0.6;
/** Pause at neutral when passing through it while held. */
const DETENT = 0.45;

export class ThrottleLever {
  value = 0;
  private dir = 0;
  private held = 0;
  private detent = 0;

  /** Starts pushing the lever forward (+1) or back (-1): moves one notch at once. */
  press(dir: 1 | -1): void {
    this.dir = dir;
    this.held = 0;
    this.value = nextNotch(this.value, dir);
  }

  release(): void {
    this.dir = 0;
  }

  set(value: number): void {
    this.value = Math.max(-1, Math.min(1, value));
    this.dir = 0;
  }

  update(dt: number): number {
    if (this.dir === 0) return this.value;
    this.held += dt;
    if (this.held < HOLD_DELAY) return this.value;
    if (this.detent > 0) {
      this.detent -= dt;
      return this.value;
    }
    const before = this.value;
    this.value = Math.max(-1, Math.min(1, this.value + this.dir * HOLD_RATE * dt));
    // Through neutral: stop there for a moment
    if (before !== 0 && Math.sign(before) !== Math.sign(this.value)) {
      this.value = 0;
      this.detent = DETENT;
    }
    return this.value;
  }
}

/** The next notch from `value` in direction `dir` (a value on a notch moves a whole notch). */
export function nextNotch(value: number, dir: 1 | -1): number {
  const steps = value / NOTCH;
  const next = dir > 0 ? Math.floor(steps + 1e-6) + 1 : Math.ceil(steps - 1e-6) - 1;
  return Math.max(-1, Math.min(1, next * NOTCH));
}
