import { describe, expect, it } from "vitest";
import { nextNotch, ThrottleLever } from "../src/controls/throttleLever";

describe("throttle lever", () => {
  it("a tap moves one notch and stays there", () => {
    const l = new ThrottleLever();
    l.press(1);
    l.release();
    for (let i = 0; i < 60; i++) l.update(1 / 60);
    expect(l.value).toBe(0.25);
    l.press(1);
    l.release();
    expect(l.value).toBe(0.5);
    l.press(-1);
    l.release();
    l.press(-1);
    l.release();
    expect(l.value).toBe(0);
  });

  it("holding moves it smoothly, pausing at neutral", () => {
    const l = new ThrottleLever();
    l.set(0.5);
    l.press(-1);
    let sawNeutralPause = 0;
    for (let i = 0; i < 2 * 60; i++) if (l.update(1 / 60) === 0) sawNeutralPause++;
    expect(sawNeutralPause).toBeGreaterThan(20);
    for (let i = 0; i < 3 * 60; i++) l.update(1 / 60);
    expect(l.value).toBe(-1);
  });

  it("snaps between notches in the direction pushed", () => {
    expect(nextNotch(0.3, 1)).toBe(0.5);
    expect(nextNotch(0.3, -1)).toBe(0.25);
    expect(nextNotch(1, 1)).toBe(1);
    expect(nextNotch(0, -1)).toBe(-0.25);
  });
});
