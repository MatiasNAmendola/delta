import { describe, expect, it } from "vitest";
import { WaterDistanceField } from "../src/world/WaterDistanceField";

describe("WaterDistanceField", () => {
  // 100x100 world, 1 unit per cell, a straight river along x = 0 (|x| < 5)
  const field = new WaterDistanceField(100, 100, (x) => Math.abs(x) < 5);

  it("is zero on water", () => {
    expect(field.at(0, 0)).toBe(0);
    expect(field.at(4.5, -30)).toBe(0);
  });

  it("grows with the distance to the bank", () => {
    expect(field.at(5.5, 0)).toBeCloseTo(1, 5);
    expect(field.at(15.5, 10)).toBeCloseTo(11, 5);
    expect(field.at(-25.5, 40)).toBeCloseTo(21, 5);
  });

  it("approximates euclidean distance on diagonals within a few percent", () => {
    // Single water cell at the origin corner area
    const dot = new WaterDistanceField(100, 100, (x, z) => Math.hypot(x - 0.5, z - 0.5) < 0.5);
    const d = dot.at(30.5, 40.5);
    expect(Math.abs(d - 50) / 50).toBeLessThan(0.08);
  });

  it("treats points outside the world as far from water", () => {
    expect(field.at(500, 0)).toBe(Infinity);
  });

  it("uses the same orientation as world coordinates (no mirrored z)", () => {
    // Water only in the north-east quadrant
    const ne = new WaterDistanceField(100, 100, (x, z) => x > 20 && z > 20);
    expect(ne.at(30, 30)).toBe(0);
    expect(ne.at(30, -30)).toBeGreaterThan(40);
  });
});
