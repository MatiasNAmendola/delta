import { describe, expect, it } from "vitest";
import { BOAT_TYPES } from "../src/boat/boatTypes";
import { familyOf, rulesAt, tooNarrow } from "../src/game/waterwayRules";

describe("waterway rules", () => {
  it("groups boats into families", () => {
    expect(familyOf(BOAT_TYPES.colectiva)).toBe("colectiva");
    expect(familyOf(BOAT_TYPES.runabout)).toBe("particular");
    expect(familyOf(BOAT_TYPES.single)).toBe("remo");
    expect(familyOf(BOAT_TYPES.travesia)).toBe("remo");
    expect(familyOf(BOAT_TYPES.kayak)).toBe("kayak");
  });

  it("the 2015 no-wake rule on the Luján applies to motor boats, not to paddlers", () => {
    expect(rulesAt("Río Luján", "particular").map((r) => r.kind)).toContain("sin_ola");
    expect(rulesAt("rio lujan", "colectiva").length).toBeGreaterThan(0);
    expect(rulesAt("Río Luján", "kayak")).toEqual([]);
  });

  it("the Gambado is much worse for a colectiva than for a private launch", () => {
    const col = rulesAt("Arroyo Gambado", "colectiva").find((r) => r.kind === "prohibido")!;
    const part = rulesAt("Arroyo Gambado", "particular").find((r) => r.kind === "prohibido")!;
    expect(col.penalty).toBeGreaterThan(part.penalty * 2);
    expect(col.confidence).toBe("regla_del_juego");
    expect(rulesAt("Arroyo Gambado", "kayak").some((r) => r.kind === "prohibido")).toBe(false);
  });

  it("a colectiva doesn't fit a narrow arroyo, a kayak does", () => {
    expect(tooNarrow(10, "colectiva")).toBe(true);
    expect(tooNarrow(10, "kayak")).toBe(false);
  });
});

import { RuleBook, START_GRACE } from "../src/game/navigationRules";

describe("rules by river in the game", () => {
  const base = { x: 0, z: 0, heading: 0, speed: 0.3, probe: { port: 20, starboard: 20, width: 40 }, distanceToDock: 99, wakes: [] };
  const run = (book: RuleBook, inputs: object, seconds: number) => {
    const events = [];
    for (let i = 0; i < START_GRACE * 60; i++) book.update(1 / 60, { ...base, speed: 0 });
    for (let i = 0; i < seconds * 60; i++) events.push(...book.update(1 / 60, { ...base, ...inputs }));
    return events;
  };

  it("sin ola on the Luján is judged by the wave you make, in the realistic mode only", () => {
    const luj = { via: { name: "Río Luján", width: 150 } };
    expect(run(new RuleBook(BOAT_TYPES.runabout, { strict: true }), { ...luj, wakeHeight: 0.3 }, 6).map((e) => e.rule)).toContain("sinOla");
    expect(run(new RuleBook(BOAT_TYPES.runabout, { strict: true }), { ...luj, wakeHeight: 0.1 }, 6).some((e) => e.rule === "sinOla")).toBe(false);
    expect(run(new RuleBook(BOAT_TYPES.runabout), { ...luj, wakeHeight: 0.3 }, 6).some((e) => e.rule === "sinOla")).toBe(false);
  });

  it("a colectiva in the Gambado is warned, then fined hard, in any mode", () => {
    const events = run(new RuleBook(BOAT_TYPES.colectiva), { via: { name: "Arroyo Gambado", width: 35 }, speed: 0.1 }, 6);
    const fine = events.find((e) => e.rule === "prohibido" && e.kind === "fine");
    expect(events[0].kind).toBe("warn");
    expect(fine?.penalty).toBe(300);
  });
});
