import { describe, expect, it } from "vitest";
import { defaultPolicy, nextResolution } from "../src/utils/AdaptiveResolution";

describe("adaptive resolution", () => {
  const policy = defaultPolicy(3, true); // phone with DPR 3 → 2x at best, never below 1x

  it("caps the pixel ratio at 2x, and phones never go below the screen's CSS resolution", () => {
    expect(defaultPolicy(3, true).minLevel).toBe(0.5);
    expect(defaultPolicy(3, true).maxLevel).toBe(1);
    expect(defaultPolicy(1, false).maxLevel).toBe(1.5);
    expect(defaultPolicy(2, false).minLevel).toBe(0.5);
    expect(defaultPolicy(1, false).minLevel).toBe(1);
  });

  it("lowers resolution immediately when FPS drops, down to the floor", () => {
    let s = { level: policy.minLevel, goodWindows: 0 };
    for (let i = 0; i < 10; i++) s = nextResolution(s, 15, policy);
    expect(s.level).toBe(policy.maxLevel);
  });

  it("sharpens again only after several good windows", () => {
    let s = { level: 1.25, goodWindows: 0 };
    s = nextResolution(s, 60, policy);
    s = nextResolution(s, 60, policy);
    expect(s.level).toBe(1.25);
    s = nextResolution(s, 60, policy);
    expect(s.level).toBe(1);
  });

  it("a mediocre window resets the streak", () => {
    let s = { level: 1.25, goodWindows: 2 };
    s = nextResolution(s, 40, policy);
    expect(s).toEqual({ level: 1.25, goodWindows: 0 });
  });
});
