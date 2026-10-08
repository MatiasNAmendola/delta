import { describe, expect, it } from "vitest";
import {
  buildRegions,
  pointInRing,
  signedArea2,
  simplifyRing,
  smoothRing,
  traceShorelines,
  triangulate,
} from "../src/world/shoreline";

// 20x20 world, 1 unit cells: a 12x12 lake with a 4x4 island in the middle
const res = 20;
const lake = (i: number, j: number) => i >= 4 && i < 16 && j >= 4 && j < 16;
const island = (i: number, j: number) => i >= 8 && i < 12 && j >= 8 && j < 12;
const grid = { res, size: 20, wet: (i: number, j: number) => lake(i, j) && !island(i, j) };

const triArea = (v: Float32Array, idx: Uint32Array) => {
  let a = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [p, q, r] = [idx[t], idx[t + 1], idx[t + 2]].map((k) => [v[k * 2], v[k * 2 + 1]]);
    a += Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2;
  }
  return a;
};

describe("traceShorelines", () => {
  const rings = traceShorelines(grid);

  it("finds the lake shore (counter-clockwise) and the island shore (clockwise)", () => {
    expect(rings).toHaveLength(2);
    const areas = rings.map((r) => signedArea2(r) / 2).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(-16); // island 4x4, water outside it
    expect(areas[1]).toBeCloseTo(144); // lake 12x12
  });

  it("puts the rings exactly on the cell edges", () => {
    const lakeRing = rings.find((r) => signedArea2(r) > 0)!;
    const xs = lakeRing.map(([x]) => x);
    expect(Math.min(...xs)).toBe(-6);
    expect(Math.max(...xs)).toBe(6);
  });
});

describe("buildRegions", () => {
  const { water, land } = buildRegions(traceShorelines(grid), 20);

  it("makes one water polygon with the island as a hole", () => {
    expect(water).toHaveLength(1);
    expect(water[0].holes).toHaveLength(1);
    const { vertices, indices } = triangulate(water);
    expect(triArea(vertices, indices)).toBeCloseTo(144 - 16);
  });

  it("makes the land: the world around the lake plus the island", () => {
    expect(land).toHaveLength(2);
    const { vertices, indices } = triangulate(land);
    expect(triArea(vertices, indices)).toBeCloseTo(400 - 144 + 16);
  });
});

describe("ring smoothing", () => {
  it("keeps the shape while removing staircase points", () => {
    const ring = traceShorelines(grid).find((r) => signedArea2(r) > 0)!;
    const smooth = simplifyRing(smoothRing(ring, 2), 0.05);
    expect(smooth.length).toBeLessThan(smoothRing(ring, 2).length);
    expect(Math.abs(signedArea2(smooth) / 2 - 144)).toBeLessThan(144 * 0.05);
    expect(pointInRing(0, 0, smooth)).toBe(true);
  });
});
