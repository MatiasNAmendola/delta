import { describe, expect, it } from "vitest";
import { breaksWakeCourtesy, offsetPolyline, PingPongRoute } from "../src/world/rowingRoute";

describe("PingPongRoute", () => {
  // L-shaped river: 10 units north, then 10 units east
  const route = new PingPongRoute([[0, 0], [0, 10], [10, 10]]);

  it("measures the polyline", () => {
    expect(route.length).toBe(20);
  });

  it("rows forward along the segments with the right heading", () => {
    expect(route.at(5)).toMatchObject({ x: 0, z: 5, heading: 0 });
    const p = route.at(15);
    expect(p.x).toBeCloseTo(5);
    expect(p.z).toBeCloseTo(10);
    expect(p.heading).toBeCloseTo(Math.PI / 2);
  });

  it("turns around at the end and comes back", () => {
    const p = route.at(25); // 5 units back from the end
    expect(p.x).toBeCloseTo(5);
    expect(p.z).toBeCloseTo(10);
    expect(p.heading).toBeCloseTo(-Math.PI / 2);
    expect(route.at(40)).toMatchObject({ x: 0, z: 0 }); // full round trip
  });
});

describe("offsetPolyline", () => {
  it("shifts to the right of the travel direction", () => {
    // Travelling north (+z): right is +x
    const shifted = offsetPolyline([[0, 0], [0, 10]], 2);
    expect(shifted[0][0]).toBeCloseTo(2);
    expect(shifted[1][0]).toBeCloseTo(2);
  });
});

describe("breaksWakeCourtesy", () => {
  it("only fast passes close to the rowers break the rule", () => {
    expect(breaksWakeCourtesy(2, 0.9)).toBe(true);
    expect(breaksWakeCourtesy(2, 0.3)).toBe(false); // slowed down: fine
    expect(breaksWakeCourtesy(30, 1)).toBe(false); // far away: fine
  });
});
