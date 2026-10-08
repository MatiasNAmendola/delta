import { describe, expect, it } from "vitest";
import { Buoyancy, type BuoyancyParams } from "../src/boat/buoyancy";

const flat = () => 0;
const lancha: BuoyancyParams = { length: 2, width: 0.63, hull: "displacement" };
const open: BuoyancyParams = { length: 0.8, width: 0.3, hull: "planing" };

describe("buoyancy targets", () => {
  it("sits level on flat, still water", () => {
    const t = Buoyancy.targets(lancha, flat, 0, 0, 0, 0, 0);
    expect(t.y).toBeCloseTo(0);
    expect(t.pitch).toBeCloseTo(0);
    expect(t.roll).toBeCloseTo(0);
  });

  it("follows a wave: bow up when the water is higher ahead", () => {
    // Heading +z; water rises towards +z
    const t = Buoyancy.targets(lancha, (_x, z) => z * 0.05, 0, 0, 0, 0, 0);
    expect(t.pitch).toBeGreaterThan(0);
    expect(t.y).toBeCloseTo(0, 5);
  });

  it("rolls with the water across the hull", () => {
    // Starboard is +x when heading +z; water higher on port (-x) -> starboard down (positive roll)
    const t = Buoyancy.targets(lancha, (x) => -x * 0.05, 0, 0, 0, 0, 0);
    expect(t.roll).toBeGreaterThan(0);
  });

  it("never makes a displacement hull dive when accelerating", () => {
    const fast = Buoyancy.targets(lancha, flat, 0, 0, 0, 1, 0);
    expect(fast.pitch).toBeGreaterThanOrEqual(0); // bow up, not down
    expect(fast.y).toBeGreaterThan(-lancha.length * 0.01); // stern squat stays tiny
  });

  it("planing hulls climb the hump, then rise out of the water", () => {
    const hump = Buoyancy.targets(open, flat, 0, 0, 0, 0.35, 0);
    const planing = Buoyancy.targets(open, flat, 0, 0, 0, 1, 0);
    expect(hump.pitch).toBeGreaterThan(planing.pitch);
    expect(planing.y).toBeGreaterThan(hump.y);
    expect(planing.y).toBeGreaterThan(0);
  });

  it("planing hulls bank into a turn, displacement hulls heel outward", () => {
    const right = 1; // steering to starboard
    expect(Buoyancy.targets(open, flat, 0, 0, 0, 1, right).roll).toBeGreaterThan(0);
    expect(Buoyancy.targets(lancha, flat, 0, 0, 0, 1, right).roll).toBeLessThan(0);
  });
});

describe("buoyancy springs", () => {
  it("settles on the target without blowing up", () => {
    const b = new Buoyancy(lancha);
    let s = { y: 0, pitch: 0, roll: 0 };
    for (let i = 0; i < 600; i++) s = b.update(1 / 60, { y: 0.1, pitch: 0.05, roll: -0.02 });
    expect(s.y).toBeCloseTo(0.1, 3);
    expect(s.pitch).toBeCloseTo(0.05, 3);
    expect(s.roll).toBeCloseTo(-0.02, 3);
  });

  it("a kayak responds faster than a lancha", () => {
    const k = new Buoyancy({ length: 0.62, width: 0.1, hull: "displacement" });
    const l = new Buoyancy(lancha);
    const target = { y: 0.1, pitch: 0, roll: 0 };
    let ky = 0;
    let ly = 0;
    for (let i = 0; i < 12; i++) {
      ky = k.update(1 / 60, target).y;
      ly = l.update(1 / 60, target).y;
    }
    expect(ky).toBeGreaterThan(ly);
  });
});
