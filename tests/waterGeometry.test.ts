import { describe, expect, it } from "vitest";
import { createGrid, isSet, rasterizeAreas, riverCoverage, triangulateAreas, uncoveredRuns } from "../src/world/waterGeometry";
import type { River, WaterArea } from "../src/world/WorldDoc";

// 40x40 lake centered at the origin with a 10x10 island in the middle
const lake: WaterArea = {
  id: "lago",
  outer: [[-20, -20], [20, -20], [20, 20], [-20, 20]],
  holes: [[[-5, -5], [5, -5], [5, 5], [-5, 5]]],
};

describe("water areas geometry", () => {
  const grid = createGrid(100, 100); // 1 unit per cell
  rasterizeAreas(grid, [lake]);

  it("marks the water and keeps islands and land dry", () => {
    expect(isSet(grid, 15, 15)).toBe(true);
    expect(isSet(grid, -12, 3)).toBe(true);
    expect(isSet(grid, 0, 0)).toBe(false); // island
    expect(isSet(grid, 30, 0)).toBe(false); // land
    const wet = grid.cells.reduce((n, c) => n + c, 0);
    expect(wet).toBe(40 * 40 - 10 * 10);
  });

  it("measures how much of a river is already covered by water areas", () => {
    const inside: River = { id: "a", name: "A", width: 8, points: [[-15, -15], [15, -15]] };
    const half: River = { id: "b", name: "B", width: 8, points: [[0, -15], [0, -45]] };
    const outside: River = { id: "c", name: "C", width: 8, points: [[30, 30], [45, 45]] };
    expect(riverCoverage(inside, grid)).toBe(1);
    expect(riverCoverage(half, grid)).toBeCloseTo(1 / 6, 1);
    expect(riverCoverage(outside, grid)).toBe(0);
  });

  it("triangulates areas with holes (triangle area = water area)", () => {
    const { vertices, indices } = triangulateAreas([lake]);
    let area = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]].map((k) => [vertices[k * 2], vertices[k * 2 + 1]]);
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    }
    expect(area).toBeCloseTo(40 * 40 - 10 * 10, 6);
  });
});

describe("uncoveredRuns", () => {
  const grid = createGrid(100, 100);
  rasterizeAreas(grid, [lake]);

  it("returns nothing for a river fully inside a water area", () => {
    const inside: River = { id: "a", name: "A", width: 8, points: [[-15, -15], [15, -15]] };
    expect(uncoveredRuns(inside, grid)).toEqual([]);
  });

  it("returns the dry part, overlapping one sample into the water", () => {
    // Starts inside the lake (z=-15) and leaves it at z=-20 towards z=-45
    const half: River = { id: "b", name: "B", width: 8, points: [[0, -15], [0, -45]] };
    const runs = uncoveredRuns(half, grid, 1);
    expect(runs).toHaveLength(1);
    const zs = runs[0].map(([, z]) => z);
    expect(Math.max(...zs)).toBeGreaterThan(-20.5); // joins the lake edge
    expect(Math.min(...zs)).toBe(-45); // reaches the river end
  });

  it("splits a river that crosses a water area into two runs", () => {
    const across: River = { id: "c", name: "C", width: 8, points: [[-45, -15], [45, -15]] };
    expect(uncoveredRuns(across, grid, 1)).toHaveLength(2);
  });
});
