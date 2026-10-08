import { describe, expect, it } from "vitest";
import { RiverLocator } from "../src/game/riverLocator";
import type { River } from "../src/world/WorldDoc";

// A wide river with vertices 4 km apart, and an arroyo that ends at its bank
const lujan: River = { id: "l", name: "Río Luján", width: 18.75, points: [[-2000, 0], [2000, 0]] };
const arroyo: River = { id: "a", name: "Fulminante Viejo", width: 8, points: [[300, 120], [300, 12]] };
const locator = new RiverLocator([lujan, arroyo]);

describe("river locator", () => {
  it("in the middle of a wide river with far-apart vertices, it is that river", () => {
    expect(locator.at(300, 2)?.name).toBe("Río Luján");
    expect(locator.at(-1500, 0)?.inside).toBe(true);
  });

  it("at the mouth of an arroyo you are still on the river; up the arroyo, on the arroyo", () => {
    expect(locator.at(300, 9)?.name).toBe("Río Luján");
    expect(locator.at(300, 60)?.name).toBe("Fulminante Viejo");
  });

  it("outside every channel, the nearest one, flagged as not inside", () => {
    const hit = locator.at(330, 60)!;
    expect(hit.name).toBe("Fulminante Viejo");
    expect(hit.inside).toBe(false);
  });
});
