import { describe, expect, it } from "vitest";
import { ClearanceGrid, planLots } from "../src/world/settlement/lots";
import type { Vec2 } from "../src/world/WorldDoc";

// A square island 200 units across in open water; its ring runs with the water on the left
const H = 100;
const island: Vec2[] = [[-H, -H], [-H, H], [H, H], [H, -H]];
const isWater = (x: number, z: number) => Math.abs(x) > H || Math.abs(z) > H;
const plan = (extra: Partial<Parameters<typeof planLots>[2]> = {}) =>
  planLots([island], isWater, { worldHalf: 400, avoid: [], seed: 7, density: 1, ...extra });

describe("waterfront lots", () => {
  it("puts houses on the island facing the water, docks reaching out over it", () => {
    const lots = plan();
    expect(lots.length).toBeGreaterThan(20);
    for (const l of lots) {
      expect(isWater(l.hx, l.hz)).toBe(false);
      expect(isWater(l.x + l.nx * 0.5, l.z + l.nz * 0.5)).toBe(true);
      // The house is behind the bank point, away from the water
      expect((l.hx - l.x) * l.nx + (l.hz - l.z) * l.nz).toBeLessThan(-1);
      // rotation turns local +z towards the water
      expect(Math.sin(l.rotation)).toBeCloseTo(l.nx, 5);
      expect(Math.cos(l.rotation)).toBeCloseTo(l.nz, 5);
    }
  });

  it("keeps houses apart and out of the places to avoid", () => {
    const lots = plan({ avoid: [{ x: H, z: 0, r: 30 }] });
    for (const a of lots) {
      expect(Math.hypot(a.x - H, a.z)).toBeGreaterThanOrEqual(30);
      for (const b of lots) if (a !== b) expect(Math.hypot(a.hx - b.hx, a.hz - b.hz)).toBeGreaterThan(2);
    }
  });

  it("builds nothing near the world's edge or with no density", () => {
    expect(plan({ worldHalf: 104 })).toHaveLength(0);
    expect(plan({ density: -1 })).toHaveLength(0);
  });

  it("is deterministic", () => {
    expect(plan()).toEqual(plan());
  });
});

describe("clearance grid", () => {
  it("finds circles across cell borders", () => {
    const g = new ClearanceGrid(4);
    g.add(3.9, 0, 1);
    expect(g.blocked(4.5, 0)).toBe(true);
    expect(g.blocked(6, 0)).toBe(false);
    expect(g.blocked(6, 0, 1.5)).toBe(true);
  });
});
