import { describe, expect, it } from "vitest";
import { coastToward, driftToward, isBraking } from "../src/boat/coasting";
import { BOAT_TYPES } from "../src/boat/boatTypes";

const run = (speed: number, target: number, seconds: number, coastTime: number) => {
  let v = speed;
  for (let t = 0; t < seconds; t += 1 / 60) v = coastToward(v, target, 1 / 60, coastTime, 1e-4);
  return v;
};

describe("coasting in neutral", () => {
  it("keeps way at low speed: a third of a slow glide is left after coastTime", () => {
    const c = BOAT_TYPES.colectiva.coastTime;
    const v = run(0.1, 0, c, c);
    expect(v).toBeGreaterThan(0.03);
    expect(v).toBeLessThan(0.045);
  });

  it("from full speed it loses most of its way fast, then glides on", () => {
    const c = BOAT_TYPES.colectiva.coastTime;
    let v = 1;
    for (let t = 0; t < 2; t += 1 / 60) v = coastToward(v, 0, 1 / 60, c, 1e-4, 1);
    expect(v).toBeLessThan(0.5);
    for (let t = 0; t < 6; t += 1 / 60) v = coastToward(v, 0, 1 / 60, c, 1e-4, 1);
    expect(v).toBeGreaterThan(0.05);
  });

  it("glides astern too, and eventually stops", () => {
    expect(run(-1, 0, 2, 5)).toBeLessThan(-0.5);
    expect(run(-1, 0, 60, 5)).toBe(0);
  });

  it("a heavy colectiva glides longer than a jet ski", () => {
    expect(BOAT_TYPES.colectiva.coastTime).toBeGreaterThan(BOAT_TYPES.moto.coastTime);
    expect(run(1, 0, 3, BOAT_TYPES.colectiva.coastTime)).toBeGreaterThan(run(1, 0, 3, BOAT_TYPES.moto.coastTime));
  });

  it("only the lever against the way is a hard brake", () => {
    expect(isBraking(1, -0.5)).toBe(true);
    expect(isBraking(1, 0)).toBe(false);
    expect(isBraking(1, 0.3)).toBe(false);
    expect(isBraking(-1, 0.5)).toBe(true);
  });
});

describe("drift with the river", () => {
  it("a stopped boat ends up moving with the flood or the ebb", () => {
    let d: [number, number] = [0, 0];
    for (let t = 0; t < 60; t += 0.1) d = driftToward(d, [0.3, -0.1], 0.1, BOAT_TYPES.colectiva.coastTime);
    expect(d[0]).toBeCloseTo(0.3, 2);
    expect(d[1]).toBeCloseTo(-0.1, 2);
  });

  it("a heavy hull picks the current up more slowly than a kayak", () => {
    const after = (coast: number) => driftToward([0, 0], [1, 0], 1, coast)[0];
    expect(after(BOAT_TYPES.colectiva.coastTime)).toBeLessThan(after(BOAT_TYPES.kayak.coastTime));
  });
});
