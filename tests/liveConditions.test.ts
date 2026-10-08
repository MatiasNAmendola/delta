import { describe, expect, it } from "vitest";
import { compassName, isSudestada, levelOffset, parseRiver, windVector, type LiveConditions } from "../src/world/liveConditions";

describe("live conditions", () => {
  it("reads the INA observations: last height and the trend", () => {
    const rows = [
      { timestart: "2026-10-07T00:45:00.000Z", valor: 0.95 },
      { timestart: "2026-10-07T01:45:00.000Z", valor: 1 },
      { timestart: "2026-10-07T02:45:00.000Z", valor: 1.22 },
      { timestart: "2026-10-07T03:45:00.000Z", valor: 1.57 },
    ];
    expect(parseRiver(rows)).toEqual({ height: 1.57, at: "2026-10-07T03:45:00.000Z", rising: true });
    expect(parseRiver([...rows].reverse().map((r, i) => ({ ...r, valor: [0.9, 1.1, 1.3, 1.5][i] })))?.rising).toBe(false);
    expect(parseRiver("nope")).toBeNull();
  });

  it("wind from the south-east blows towards the north-west", () => {
    const w = windVector(22.5, 135);
    expect(w.strength).toBeCloseTo(0.5);
    expect(w.x).toBeLessThan(0);
    expect(w.z).toBeGreaterThan(0);
    expect(compassName(135)).toBe("SE");
  });

  it("detects a sudestada from the wind or the river", () => {
    const base: LiveConditions = { height: 1.2, measuredAt: null, rising: true, windSpeed: 12, windGusts: 20, windFrom: 140, fetchedAt: 0 };
    expect(isSudestada(base)).toBe(false);
    expect(isSudestada({ ...base, windSpeed: 35 })).toBe(true);
    expect(isSudestada({ ...base, height: 2.9 })).toBe(true);
    expect(isSudestada({ ...base, windSpeed: 40, windFrom: 300 })).toBe(false);
  });

  it("maps the real height to a bounded level offset", () => {
    expect(levelOffset(1.1, 8)).toBe(0);
    expect(levelOffset(1.9, 8)).toBeCloseTo(0.1);
    expect(levelOffset(3.5, 8)).toBe(0.15);
    expect(levelOffset(0.1, 8)).toBe(-0.12);
  });
});
