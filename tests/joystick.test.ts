import { describe, expect, it } from "vitest";
import { DEAD_ZONE, engagesThrottle, readStick, releaseStick, snapToTelegraph } from "../src/controls/joystick";

const R = 65;

describe("readStick", () => {
  it("reads zero in the dead zone", () => {
    const s = readStick(R * DEAD_ZONE * 0.9, 0, R);
    expect(s.throttle).toBe(0);
    expect(s.steering).toBe(0);
    expect(readStick(0, 0, R)).toEqual({ throttle: 0, steering: 0, knobX: 0, knobY: 0 });
  });

  it("pushing up is ahead, down is astern", () => {
    expect(readStick(0, -R, R).throttle).toBe(1);
    expect(readStick(0, R, R).throttle).toBe(-1);
  });

  it("right is positive steering, left negative", () => {
    expect(readStick(R, 0, R).steering).toBe(1);
    expect(readStick(-R, 0, R).steering).toBe(-1);
  });

  it("clips the knob to the circle and stays within [-1, 1]", () => {
    const s = readStick(500, -500, R);
    expect(Math.hypot(s.knobX, s.knobY)).toBeCloseTo(R, 6);
    expect(Math.abs(s.throttle)).toBeLessThanOrEqual(1);
    expect(Math.abs(s.steering)).toBeLessThanOrEqual(1);
    expect(s.throttle).toBeGreaterThan(0);
    expect(s.steering).toBeGreaterThan(0);
  });

  it("rises from zero right after the dead zone and is monotonic", () => {
    let prev = 0;
    for (let y = 0; y <= R; y += 1) {
      const t = readStick(0, -y, R).throttle;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
    expect(readStick(0, -R * (DEAD_ZONE + 0.01), R).throttle).toBeLessThan(0.05);
  });

  it("is safe with a zero radius or NaN", () => {
    expect(readStick(10, 10, 0).throttle).toBe(0);
    expect(readStick(NaN, 10, R).steering).toBe(0);
  });
});

describe("snapToTelegraph", () => {
  it("snaps to the five positions", () => {
    expect(snapToTelegraph(0.2)).toBe(0);
    expect(snapToTelegraph(0.3)).toBe(0.5);
    expect(snapToTelegraph(0.8)).toBe(1);
    expect(snapToTelegraph(-0.7)).toBe(-0.5);
    expect(snapToTelegraph(-0.9)).toBe(-1);
    expect(snapToTelegraph(0.5)).toBe(0.5);
  });
});

describe("releaseStick", () => {
  it("returns the helm to zero and keeps the throttle (cruise)", () => {
    expect(releaseStick(0.37, false)).toEqual({ throttle: 0.37, steering: 0 });
  });
  it("settles on a telegraph position when there is one", () => {
    expect(releaseStick(0.37, true)).toEqual({ throttle: 0.5, steering: 0 });
    expect(releaseStick(-0.1, true).throttle).toBe(0);
  });
});

describe("engagesThrottle", () => {
  it("a sideways touch only steers; a clear push up or down takes the throttle", () => {
    expect(engagesThrottle(false, readStick(50, -5, 65))).toBe(false);
    expect(engagesThrottle(false, readStick(0, -40, 65))).toBe(true);
    expect(engagesThrottle(false, readStick(0, 40, 65))).toBe(true);
  });
  it("once taken, it stays taken for the touch (back to the middle reaches neutral)", () => {
    expect(engagesThrottle(true, readStick(0, 0, 65))).toBe(true);
  });
});
