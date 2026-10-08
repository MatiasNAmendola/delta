import { describe, expect, it } from "vitest";
import { G, KELVIN_ANGLE, kelvinBranches, kelvinElevation, strongestAngle, turbulentWidth, wakeAmplitude, type WakeSource } from "../src/world/wakePhysics";

const at = (fr: number, hull: "planing" | "displacement" = "displacement"): WakeSource => {
  const L = 10;
  return { U: fr * Math.sqrt(G * L), L, beam: 2.5, height: 0.3, topFroude: hull === "planing" ? 1.5 : 0.4, hull };
};
const deg = (r: number) => (r * 180) / Math.PI;

describe("Kelvin wake", () => {
  it("is the 19.47° wedge for slow boats (Kelvin)", () => {
    expect(deg(KELVIN_ANGLE)).toBeCloseTo(19.47, 2);
    for (const fr of [0.3, 0.4, 0.5]) expect(Math.abs(deg(strongestAngle(at(fr))) - 19.47)).toBeLessThan(1);
  });

  it("narrows like 1/Fr for fast boats (Rabaud & Moisy)", () => {
    const a1 = strongestAngle(at(1));
    const a2 = strongestAngle(at(2));
    const a4 = strongestAngle(at(4));
    expect(deg(a1)).toBeLessThan(17);
    expect(a2 / a1).toBeGreaterThan(0.35);
    expect(a2 / a1).toBeLessThan(0.65);
    expect(a4 / a2).toBeGreaterThan(0.35);
    expect(a4 / a2).toBeLessThan(0.65);
  });

  it("transverse waves are as long as 2πU²/g, divergent ones shorter", () => {
    const s = at(0.4);
    const b = kelvinBranches(50, 0.5, s)!;
    expect((2 * Math.PI) / b[0].k).toBeCloseTo((2 * Math.PI * s.U * s.U) / G, 0);
    expect(b[1].k).toBeGreaterThan(b[0].k * 1.5);
  });

  it("leaves calm water ahead of the bow and outside the wedge", () => {
    const s = at(0.4);
    expect(kelvinElevation(-5, 0, s)).toBe(0);
    const inside = Math.max(...Array.from({ length: 40 }, (_, i) => Math.abs(kelvinElevation(60 + i * 0.3, 60 * 0.3, s))));
    const outside = Math.max(...Array.from({ length: 40 }, (_, i) => Math.abs(kelvinElevation(60 + i * 0.3, 60 * 0.6, s))));
    expect(inside).toBeGreaterThan(0.01);
    expect(outside).toBeLessThan(inside * 0.05);
  });

  it("planing hulls make their biggest wake on the hump, less once planing", () => {
    expect(wakeAmplitude(at(0.55, "planing"))).toBeGreaterThan(wakeAmplitude(at(1.5, "planing")) * 1.8);
    // Displacement hulls only grow up to hull speed
    expect(wakeAmplitude(at(0.4))).toBeGreaterThan(wakeAmplitude(at(0.2)) * 4);
  });

  it("the turbulent wake widens slowly with age", () => {
    expect(turbulentWidth(2, 0)).toBeCloseTo(1.1);
    expect(turbulentWidth(2, 60) / turbulentWidth(2, 10)).toBeLessThan(1.8);
  });
});
