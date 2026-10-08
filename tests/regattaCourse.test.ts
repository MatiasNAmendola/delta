import { describe, expect, it } from "vitest";
import { LANE_WIDTH, laneOffset, planCourse, pointAt, project, resample, rivalSpeed } from "../src/game/regattaCourse";
import type { River } from "../src/world/WorldDoc";

// A straight, wide river running north-west to south-east (downstream)
const lujan: River = { id: "lujan", name: "Río Luján", width: 30, points: [[-300, 300], [300, -300]] };
const arroyo: River = { id: "a", name: "Arroyo", width: 6, points: [[0, 0], [0, 400]] };
const isWater = (x: number, z: number) => Math.abs(x + z) / Math.SQRT2 < 15;

describe("regatta course", () => {
  it("lays 2000 m downstream on a wide river, every lane on the water", () => {
    const c = planCourse([arroyo, lujan], isWater, { x: 0, z: 0 }, 4)!;
    expect(c).not.toBeNull();
    expect(c.river).toBe("Río Luján");
    expect(c.length).toBe(250);
    const [sx, sz] = c.path[0];
    const [ex, ez] = c.path[c.path.length - 1];
    expect(ex - sx).toBeGreaterThan(0); // towards the south-east
    expect(ez - sz).toBeLessThan(0);
    expect(c.lanes).toHaveLength(4);
    for (const lane of c.lanes) for (const [x, z] of lane) expect(isWater(x, z)).toBe(true);
  });

  it("falls back to 1000 m, or nothing, when the river is short", () => {
    const short: River = { ...lujan, points: [[-55, 55], [55, -55]] };
    expect(planCourse([short], isWater, { x: 0, z: 0 })?.length).toBe(125);
    expect(planCourse([arroyo], () => true, { x: 0, z: 0 })).toBeNull();
  });

  it("projects onto the course with the right side positive", () => {
    const path = resample([[0, 0], [0, 100]], 2.5);
    const p = project(path, 2, 40);
    expect(p.s).toBeCloseTo(40);
    expect(p.offset).toBeCloseTo(2); // heading +z: right is +x
    expect(pointAt(path, 50).z).toBeCloseTo(50);
  });

  it("lanes are centred and one lane apart", () => {
    expect(laneOffset(0, 4) + laneOffset(3, 4)).toBeCloseTo(0);
    expect(laneOffset(2, 4) - laneOffset(1, 4)).toBeCloseTo(LANE_WIDTH);
  });

  it("rivals start slower, cruise, and sprint at the end", () => {
    expect(rivalSpeed(4, 0, 250, 0)).toBeLessThan(4);
    expect(rivalSpeed(4, 100, 250, 30)).toBe(4);
    expect(rivalSpeed(4, 240, 250, 60)).toBeGreaterThan(4);
  });
});
