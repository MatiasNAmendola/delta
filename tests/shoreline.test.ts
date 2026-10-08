import { describe, expect, it } from "vitest";
import {
  buildRegions,
  pointInRing,
  signedArea2,
  simplifyRing,
  smoothRing,
  traceShorelines,
  triangulate,
  ShoreIndex,
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

describe("ShoreIndex", () => {
  const rings = traceShorelines(grid);
  const coarse = (x: number, z: number) => grid.wet(Math.floor(x + 10), Math.floor(z + 10));
  const index = new ShoreIndex(rings, 20, coarse, 2);

  it("matches the exact shore, including just either side of the edge", () => {
    expect(index.isWater(0, -5)).toBe(true); // lake, south of the island
    expect(index.isWater(-5.9, 0)).toBe(true); // 0.1 inside the lake's west shore
    expect(index.isWater(-6.1, 0)).toBe(false); // 0.1 outside it
    expect(index.isWater(-2.1, 0)).toBe(true); // just off the island's west shore (island spans -2..2)
    expect(index.isWater(-1.9, 0)).toBe(false); // just on the island
    expect(index.isWater(0, 0)).toBe(false); // island center
    expect(index.isWater(-9, -9)).toBe(false); // far land
  });

  it("agrees with point-in-polygon everywhere on a fine sample", () => {
    const { water } = buildRegions(rings, 20);
    const exact = (x: number, z: number) =>
      water.some((p) => pointInRing(x, z, p.outer) && !p.holes.some((h) => pointInRing(x, z, h)));
    let mismatches = 0;
    for (let x = -9.95; x < 10; x += 0.37) for (let z = -9.95; z < 10; z += 0.41) if (index.isWater(x, z) !== exact(x, z)) mismatches++;
    expect(mismatches).toBe(0);
  });
});

describe("roughenRing", () => {
  it("makes the shore irregular but keeps it close to the original", async () => {
    const { roughenRing } = await import("../src/world/shoreline");
    const square: [number, number][] = [[-20, -20], [20, -20], [20, 20], [-20, 20]];
    const rough = roughenRing(square, 0.5, 1, () => 10);
    expect(rough.length).toBeGreaterThan(200);
    // Not straight anymore along the bottom edge...
    const bottom = rough.filter(([x, z]) => Math.abs(z + 20) < 2 && Math.abs(x) < 15).map(([, z]) => z);
    expect(Math.max(...bottom) - Math.min(...bottom)).toBeGreaterThan(0.2);
    // ...but within twice the amplitude (the noise octaves add up to ~2), and the area barely changes
    expect(bottom.every((z) => Math.abs(z + 20) <= 2)).toBe(true);
    expect(Math.abs(signedArea2(rough) / 2 - 1600)).toBeLessThan(1600 * 0.05);
  });

  it("never moves the shore more than a fraction of the room it has", async () => {
    const { roughenRing } = await import("../src/world/shoreline");
    const square: [number, number][] = [[-20, -20], [20, -20], [20, 20], [-20, 20]];
    const rough = roughenRing(square, 0.5, 5, () => 1);
    // At most 40% of the room (1 here) away from the original square
    expect(rough.every(([x, z]) => Math.max(Math.abs(x), Math.abs(z)) <= 20.41)).toBe(true);
  });
});

describe("ShoreIndex.signedDistance", () => {
  const rings = traceShorelines(grid);
  const index = new ShoreIndex(rings, 20, (x, z) => grid.wet(Math.floor(x + 10), Math.floor(z + 10)), 2);

  it("is positive on land, negative on water, exact near the shore and clamped far away", () => {
    // Lake west shore at x = -6
    expect(index.signedDistance(-6.5, 0, 3)).toBeCloseTo(0.5, 5);
    expect(index.signedDistance(-5.5, 0, 3)).toBeCloseTo(-0.5, 5);
    expect(index.signedDistance(-9.5, -9.5, 3)).toBe(3);
  });
});
