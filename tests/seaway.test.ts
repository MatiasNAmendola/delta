import { describe, expect, it } from "vitest";
import { leeway, liveliness, seaway } from "../src/boat/seaway";
import { BOAT_TYPES } from "../src/boat/boatTypes";

const peak = (fn: (t: number) => number) => {
  let m = 0;
  for (let t = 0; t < 60; t += 0.05) m = Math.max(m, Math.abs(fn(t)));
  return m;
};
const deg = (r: number) => (r * 180) / Math.PI;

describe("seaway: a boat is never still", () => {
  it("rocks, yaws and sways even stopped in a calm", () => {
    const len = BOAT_TYPES.colectiva.length;
    expect(deg(peak((t) => seaway(t, 0, len, 0).roll))).toBeGreaterThan(0.5);
    expect(deg(peak((t) => seaway(t, 0, len, 0).yaw))).toBeGreaterThan(0.8);
    expect(peak((t) => seaway(t, 0, len, 0).sway)).toBeGreaterThan(0.005);
  });

  it("more with the wind, and more for a kayak than the colectiva", () => {
    const c = BOAT_TYPES.colectiva.length;
    const k = BOAT_TYPES.kayak.length;
    expect(peak((t) => seaway(t, 0.8, c, 0).roll)).toBeGreaterThan(peak((t) => seaway(t, 0.1, c, 0).roll) * 2);
    expect(peak((t) => seaway(t, 0.3, k, 0).yaw)).toBeGreaterThan(peak((t) => seaway(t, 0.3, c, 0).yaw) * 1.5);
    expect(liveliness(k)).toBeGreaterThan(liveliness(c));
  });

  it("way on steadies the bow", () => {
    const len = BOAT_TYPES.runabout.length;
    expect(peak((t) => seaway(t, 0.5, len, 1).yaw)).toBeLessThan(peak((t) => seaway(t, 0.5, len, 0).yaw) * 0.5);
  });

  it("stays within believable angles even in a strong wind", () => {
    expect(deg(peak((t) => seaway(t, 1, BOAT_TYPES.kayak.length, 0).roll))).toBeLessThan(10);
    expect(deg(peak((t) => seaway(t, 1, BOAT_TYPES.kayak.length, 0).yaw))).toBeLessThan(15);
  });

  it("the wind pushes high, light hulls more (leeway)", () => {
    expect(leeway(2, true)).toBeGreaterThan(leeway(2, false));
    expect(leeway(0.6, false)).toBeGreaterThan(leeway(2, false));
  });
});
