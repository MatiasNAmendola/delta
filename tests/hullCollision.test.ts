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
    expect(r.hit).toBe(true);
    expect(r.pose.rotation).toBe(0);
  });

  it("blocks moving into the bank and slides along it instead", () => {
    // Heading diagonally into the +x bank: x is blocked, z (along the river) is not
    const r = moveHull({ x: 3.9, z: 0, rotation: 0 }, 0, 0.5, 0.5, isWater);
    expect(r.hit).toBe(true);
    expect(r.slid).toBe(true);
    expect(r.pose.x).toBe(3.9);
    expect(r.pose.z).toBe(0.5);
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
