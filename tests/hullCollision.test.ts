import { describe, expect, it } from "vitest";
import { bestFitRotation, moveHull, pointsOnLand } from "../src/boat/hullCollision";
import { BOAT_LENGTH, BOAT_WIDTH } from "../src/utils/constants";

// A straight river along z, wide enough to sail along but too narrow to turn across:
// half-width H, with the boat 2 x 0.63 (H = 0.7 boat lengths)
const H = BOAT_LENGTH * 0.7;
const river = (x: number) => Math.abs(x) < H;
const isWater = (x: number, _z: number) => river(x);
const L = BOAT_LENGTH;
const W = BOAT_WIDTH;

describe("hull collision", () => {
  it("a boat along the river is fully afloat", () => {
    expect(pointsOnLand({ x: 0, z: 0, rotation: 0 }, isWater)).toBe(0);
  });

  it("detects the bow over land even when the center is on the water", () => {
    // Center in the river, pointing across it towards the +x bank
    const pose = { x: H - L * 0.3, z: 0, rotation: Math.PI / 2 };
    expect(isWater(pose.x, pose.z)).toBe(true);
    expect(pointsOnLand(pose, isWater)).toBeGreaterThan(0);
  });

  it("does not let the boat turn its bow onto the bank", () => {
    // Close to the +x bank, pointing along the river; a hard turn to starboard would ground the bow
    const r = moveHull({ x: H - W, z: 0, rotation: 0 }, Math.PI / 2, 0, 0, isWater);
    expect(r.turnBlocked).toBe(true);
    expect(r.hit).toBe(false); // a refused turn is not a collision
    expect(r.pose.rotation).toBe(0);
  });

  it("blocks moving into the bank and slides along it instead", () => {
    // Afloat right against the +x bank, moving diagonally into it
    const from = { x: H - W / 2 - 0.02, z: 0, rotation: 0 };
    expect(pointsOnLand(from, isWater)).toBe(0);
    const step = L * 0.07;
    const r = moveHull(from, 0, step, step, isWater);
    expect(r.hit).toBe(true);
    expect(r.slid).toBe(true);
    // Still afloat and carried along the river
    expect(pointsOnLand(r.pose, isWater)).toBe(0);
    expect(r.pose.z).toBeGreaterThan(step * 0.4);
  });

  it("keeps moving forward when only the turn is blocked", () => {
    const r = moveHull({ x: H - W, z: 0, rotation: 0 }, Math.PI / 2, 0, 0.1, isWater);
    expect(r.turnBlocked).toBe(true);
    expect(r.hit).toBe(false);
    expect(r.pose.z).toBeCloseTo(0.1);
  });

  it("a stranded boat can still back out towards the water", () => {
    // Across the channel with the bow on the +x bank
    const stranded = { x: H - L * 0.3, z: 0, rotation: Math.PI / 2 };
    expect(pointsOnLand(stranded, isWater)).toBeGreaterThan(0);
    const out = moveHull(stranded, 0, -0.2, 0, isWater);
    expect(out.pose.x).toBeCloseTo(stranded.x - 0.2);
    expect(pointsOnLand(out.pose, isWater)).toBeLessThanOrEqual(pointsOnLand(stranded, isWater));
  });

  it("finds a heading that fits a narrow channel at spawn", () => {
    const narrow = (x: number) => Math.abs(x) < L * 0.4; // fits only lengthwise
    const rot = bestFitRotation(0, 0, Math.PI / 2, (x) => narrow(x));
    expect(pointsOnLand({ x: 0, z: 0, rotation: rot }, (x) => narrow(x))).toBe(0);
  });
});

describe("spawn", () => {
  it("moves a boat that would start aground to a fully afloat pose nearby", async () => {
    const { findFloatingPose, pointsOnLand } = await import("../src/boat/hullCollision");
    const narrow = (x: number) => Math.abs(x) < L * 0.5;
    // Requested across the channel and touching the bank
    const pose = findFloatingPose(L * 0.4, 0, Math.PI / 2, (x) => narrow(x));
    expect(pointsOnLand(pose, (x) => narrow(x))).toBe(0);
    expect(Math.hypot(pose.x - L * 0.4, pose.z)).toBeLessThan(L);
  });
});
