import { describe, expect, it } from "vitest";
import { bestFitRotation, moveHull, pointsOnLand } from "../src/boat/hullCollision";

// A straight river 10 units wide running along z (|x| < 5)
const river = (x: number) => Math.abs(x) < 5;
const isWater = (x: number, _z: number) => river(x);

describe("hull collision", () => {
  it("a boat along the river is fully afloat", () => {
    expect(pointsOnLand({ x: 0, z: 0, rotation: 0 }, isWater)).toBe(0);
  });

  it("detects the bow over land even when the center is on the water", () => {
    // Center in the river, pointing across it towards the +x bank: bow at x = 4 + 3
    const pose = { x: 4, z: 0, rotation: Math.PI / 2 };
    expect(isWater(pose.x, pose.z)).toBe(true);
    expect(pointsOnLand(pose, isWater)).toBeGreaterThan(0);
  });

  it("does not let the boat turn its bow onto the bank", () => {
    // Close to the +x bank, pointing along the river; a hard turn to starboard would ground the bow
    const r = moveHull({ x: 3, z: 0, rotation: 0 }, Math.PI / 2, 0, 0, isWater);
    expect(r.turnBlocked).toBe(true);
    expect(r.hit).toBe(false); // a refused turn is not a collision
    expect(r.pose.rotation).toBe(0);
  });

  it("blocks moving into the bank and slides along it instead", () => {
    // Afloat against the +x bank (hull side at 4.85), moving diagonally into it
    const from = { x: 3.75, z: 0, rotation: 0 };
    expect(pointsOnLand(from, isWater)).toBe(0);
    const r = moveHull(from, 0, 0.5, 0.5, isWater);
    expect(r.hit).toBe(true);
    expect(r.slid).toBe(true);
    // Still afloat, carried along the river, no deeper into the bank than allowed
    expect(pointsOnLand(r.pose, isWater)).toBe(0);
    expect(r.pose.z).toBeGreaterThan(0.2);
    expect(r.pose.x).toBeLessThan(3.9);
  });

  it("keeps moving forward when only the turn is blocked", () => {
    const r = moveHull({ x: 3, z: 0, rotation: 0 }, Math.PI / 2, 0, 0.3, isWater);
    expect(r.turnBlocked).toBe(true);
    expect(r.hit).toBe(false);
    expect(r.pose.z).toBeCloseTo(0.3);
  });

  it("a stranded boat can still back out towards the water", () => {
    const stranded = { x: 4.5, z: 0, rotation: Math.PI / 2 };
    const out = moveHull(stranded, 0, -1, 0, isWater);
    expect(out.pose.x).toBe(3.5);
    expect(pointsOnLand(out.pose, isWater)).toBeLessThanOrEqual(pointsOnLand(stranded, isWater));
  });

  it("finds a heading that fits a narrow channel at spawn", () => {
    const narrow = (x: number) => Math.abs(x) < 2; // 4 wide: only fits lengthwise
    const rot = bestFitRotation(0, 0, Math.PI / 2, (x) => narrow(x));
    expect(pointsOnLand({ x: 0, z: 0, rotation: rot }, (x) => narrow(x))).toBe(0);
  });
});

describe("spawn", () => {
  it("moves a boat that would start aground to a fully afloat pose nearby", async () => {
    const { findFloatingPose, pointsOnLand } = await import("../src/boat/hullCollision");
    const narrow = (x: number) => Math.abs(x) < 2.5;
    // Requested across the channel and touching the bank
    const pose = findFloatingPose(1.8, 0, Math.PI / 2, (x) => narrow(x));
    expect(pointsOnLand(pose, (x) => narrow(x))).toBe(0);
    expect(Math.hypot(pose.x - 1.8, pose.z)).toBeLessThan(4);
  });
});
