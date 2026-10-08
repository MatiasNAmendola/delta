import { describe, expect, it } from "vitest";
import { BOAT_TYPES } from "../src/boat/boatTypes";
import { onWrongSide, probeChannel, RuleBook, speedZoneAt, wakeMeeting, type RuleInputs } from "../src/game/navigationRules";

// River 20 wide along z (|x| < 10)
const river = (x: number) => Math.abs(x) < 10;
const isWater = (x: number, _z: number) => river(x);

describe("probeChannel", () => {
  it("measures port and starboard distances across the heading", () => {
    // Heading +z: starboard is +x
    const p = probeChannel(isWater, 4, 0, 0);
    expect(p.starboard).toBeCloseTo(6, 0);
    expect(p.port).toBeCloseTo(14, 0);
    expect(p.width).toBeCloseTo(20, 0);
  });
});

describe("keep right", () => {
  it("is fine on the starboard half, wrong on the port half", () => {
    expect(onWrongSide(probeChannel(isWater, 5, 0, 0), 0.6)).toBe(false); // heading +z, right is +x
    expect(onWrongSide(probeChannel(isWater, -5, 0, 0), 0.6)).toBe(true);
    // Same spot heading the other way: now -x is the right side
    expect(onWrongSide(probeChannel(isWater, -5, 0, Math.PI), 0.6)).toBe(false);
  });

  it("does not apply in arroyos too narrow for two lanes", () => {
    const narrow = (x: number) => Math.abs(x) < 2;
    expect(onWrongSide(probeChannel((x) => narrow(x), -1, 0, 0), 0.6)).toBe(false);
  });
});

describe("speed zones", () => {
  it("flags arroyos and dock fronts", () => {
    expect(speedZoneAt({ port: 1, starboard: 1, width: 2 }, 50)).toBe("arroyo");
    expect(speedZoneAt({ port: 9, starboard: 9, width: 18 }, 2)).toBe("muelle");
    expect(speedZoneAt({ port: 9, starboard: 9, width: 18 }, 50)).toBe(null);
  });
});

describe("wake meeting", () => {
  it("bow into the wake is safe, broadside is not", () => {
    expect(wakeMeeting(0, 0, 0, 0, 5)).toBe("bow"); // lancha ahead
    expect(wakeMeeting(0, 0, 0, 5, 0)).toBe("broadside"); // lancha abeam
    expect(wakeMeeting(0, 0, 0, 0, -5)).toBe("stern");
  });
});

describe("RuleBook", () => {
  const base = (over: Partial<RuleInputs>): RuleInputs => ({
    x: 0, z: 0, heading: 0, speed: 0, probe: { port: 9, starboard: 9, width: 18 }, distanceToDock: 99, wakes: [], ...over,
  });

  it("warns, then fines a boat that keeps going on the wrong side", () => {
    const book = new RuleBook(BOAT_TYPES.colectiva);
    const wrong = base({ speed: 0.15, probe: { port: 3, starboard: 15, width: 18 } });
    const events = [];
    for (let i = 0; i < 8 * 60; i++) events.push(...book.update(1 / 60, wrong));
    expect(events.map((e) => e.kind)).toEqual(["warn", "fine"]);
  });

  it("fines speeding in an arroyo once, then rests", () => {
    const book = new RuleBook(BOAT_TYPES.open);
    const fast = base({ speed: 0.3, probe: { port: 1, starboard: 1, width: 2 } });
    const events = [];
    for (let i = 0; i < 60; i++) events.push(...book.update(1 / 60, fast));
    expect(events).toHaveLength(1);
    expect(events[0].rule).toBe("speedZones");
  });

  it("kayaks lose points taking a wake broadside and gain taking it bow first", () => {
    const side = new RuleBook(BOAT_TYPES.kayak).update(1 / 60, base({ wakes: [{ x: 4, z: 0 }] }));
    const bow = new RuleBook(BOAT_TYPES.kayak).update(1 / 60, base({ wakes: [{ x: 0, z: 4 }] }));
    expect(side[0].penalty).toBeGreaterThan(0);
    expect(bow[0].penalty).toBeLessThan(0);
  });

  it("only applies the boat's own rules", () => {
    // Kayaks have no speed zones
    const book = new RuleBook(BOAT_TYPES.kayak);
    expect(book.update(1 / 60, base({ speed: 0.07, probe: { port: 1, starboard: 1, width: 2 } }))).toEqual([]);
  });
});
