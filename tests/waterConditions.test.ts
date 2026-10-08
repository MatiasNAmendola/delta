import { describe, expect, it } from "vitest";
import { TIDE_PERIOD, WaterConditions, wakeHeight } from "../src/world/waterConditions";
import type { River } from "../src/world/WorldDoc";

// A river along +x (flows towards the south-east, so downstream is +x here), 10 wide
const river: River = { id: "r", name: "Río", width: 10, points: [[-100, 0], [100, 0]] };
const toBank = (_x: number, z: number) => Math.max(0, 5 - Math.abs(z));

function at(phase: number) {
  const c = new WaterConditions([river], toBank, 0);
  c.tidePhase = phase;
  return c;
}

describe("current", () => {
  it("runs along the river, downstream on the ebb", () => {
    const [vx, vz] = at(Math.PI).current(0, 0); // cos < 0: falling tide
    expect(vx).toBeGreaterThan(0.3);
    expect(Math.abs(vz)).toBeLessThan(1e-9);
  });

  it("reverses upstream on the flood", () => {
    const [vx] = at(0).current(0, 0); // cos = 1: rising tide
    expect(vx).toBeLessThan(0);
  });

  it("is strongest mid-channel and dies at the banks", () => {
    const c = at(Math.PI);
    expect(Math.abs(c.current(0, 0)[0])).toBeGreaterThan(Math.abs(c.current(0, 4.5)[0]));
    expect(c.current(0, 5)[0]).toBeCloseTo(0);
  });

  it("runs upstream in a sudestada even on the ebb", () => {
    const c = at(Math.PI);
    c.startSudestada();
    for (let i = 0; i < 60 * 30; i++) c.update(1 / 60);
    expect(c.sudestada.active).toBe(true);
    expect(c.current(0, 0)[0]).toBeLessThan(0);
  });
});

describe("level and waves", () => {
  it("the tide rises and falls over one period", () => {
    const c = new WaterConditions([river], toBank, 0);
    const levels: number[] = [];
    for (let i = 0; i < 8; i++) {
      levels.push(c.level());
      c.update(TIDE_PERIOD / 8);
    }
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.08);
  });

  it("a sudestada raises the river and the waves", () => {
    const calm = new WaterConditions([river], toBank, 0);
    const storm = new WaterConditions([river], toBank, 0);
    storm.startSudestada();
    for (let i = 0; i < 60 * 30; i++) {
      calm.update(1 / 60);
      storm.update(1 / 60);
    }
    expect(storm.level()).toBeGreaterThan(calm.level() + 0.05);
    const spread = (c: WaterConditions) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let x = 0; x < 20; x += 0.37) {
        const h = c.height(x, 1) - c.level();
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      return hi - lo;
    };
    expect(spread(storm)).toBeGreaterThan(spread(calm) * 2);
  });
});

describe("wakes", () => {
  it("are felt behind a passing boat, inside the V, not ahead of it", () => {
    const wake = { x: 0, z: 0, heading: 0, strength: 1, length: 2 }; // heading +z
    let behind = 0;
    // Along a line across the track, 5 units behind: waves inside the Kelvin V
    for (let x = -2; x <= 2; x += 0.05) behind = Math.max(behind, Math.abs(wakeHeight(wake, x, -5)));
    let ahead = 0;
    for (let x = -2; x <= 2; x += 0.05) ahead = Math.max(ahead, Math.abs(wakeHeight(wake, x, 5)));
    let outside = 0;
    for (let x = 4; x <= 6; x += 0.05) outside = Math.max(outside, Math.abs(wakeHeight(wake, x, -5)));
    expect(behind).toBeGreaterThan(0.005);
    expect(outside).toBeLessThan(behind * 0.1);
    expect(ahead).toBe(0);
  });
});

describe("waves bouncing off the shore", () => {
  // A straight wall along z = 6: land beyond it
  const wallAt = (kr: number) => (x: number, z: number) => {
    const d = 6 - z;
    return d > 0 && d < 2 ? { mx: x, mz: z + 2 * d, kr } : null;
  };
  const wake = { x: 0, z: 0, heading: 0, strength: 1, length: 2 };

  it("a wall sends the wake back, a natural bank barely", () => {
    const calm = new WaterConditions([river], toBank, 0);
    const wall = new WaterConditions([river], toBank, 0);
    const bank = new WaterConditions([river], toBank, 0);
    wall.wall = wallAt(0.9);
    bank.wall = wallAt(0.15);
    // Heading -z away from the wall: its wake spreads back towards it
    for (const c of [calm, wall, bank]) c.wakes = [{ ...wake, z: -8, heading: Math.PI }];
    let dWall = 0;
    let dBank = 0;
    for (let x = -3; x <= 3; x += 0.05) {
      const base = calm.height(x, 5) - calm.level();
      dWall = Math.max(dWall, Math.abs(wall.height(x, 5) - wall.level() - base));
      dBank = Math.max(dBank, Math.abs(bank.height(x, 5) - bank.level() - base));
    }
    expect(dWall).toBeGreaterThan(0.001);
    expect(dBank).toBeLessThan(dWall * 0.3);
  });
});
