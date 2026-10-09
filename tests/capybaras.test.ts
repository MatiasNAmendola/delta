import { describe, expect, it } from "vitest";
import { BOAT_TYPES } from "../src/boat/boatTypes";
import { CapybaraFamily, DIVE_SECONDS, FILE_GAP, SPOOKED_SECONDS, SWIM_SPEED } from "../src/game/capybaraFamily";
import { ALERT_M, COLLIDE_M, CapybaraRespect, MSG_WARN, SCARE_PENALTY, reward, type FamilyView } from "../src/game/capybaraRespect";
import { generateCrossingZones, MAX_CROSSING_M, MIN_CROSSING_M, NATURAL_KR, type CrossingZone, type ZoneInputs } from "../src/game/capybaraZones";
import { probeChannel, RuleBook, START_GRACE } from "../src/game/navigationRules";
import { METERS_PER_UNIT } from "../src/utils/constants";

// A world of three straight arroyos along z at x = 0, 300 and 600 (units); the first is 4 units wide
// (32 m), the second 20 units wide (160 m), the third 4 wide with wooden bulkheads.
const arroyo = (cx: number, half: number) => (x: number) => Math.abs(x - cx) < half;
const waters = [arroyo(0, 2), arroyo(300, 10), arroyo(600, 2)];
const isWater = (x: number, _z: number) => waters.some((w) => w(x));
const line = (x: number): Array<[number, number]> => Array.from({ length: 41 }, (_, i) => [x, -400 + i * 20] as [number, number]);

function world(over: Partial<ZoneInputs> = {}): ZoneInputs {
  return {
    rivers: [
      { name: "Arroyo Uno", points: line(0) },
      { name: "Río Ancho", points: line(300) },
      { name: "Arroyo Tablestacado", points: line(600) },
    ],
    isWater,
    krAt: (x) => (x > 500 ? 0.9 : 0.15),
    avoid: [],
    seed: 42,
    ...over,
  };
}

describe("crossing zones", () => {
  it("are only in narrow arroyos with natural banks", () => {
    const zones = generateCrossingZones(world());
    expect(zones.length).toBeGreaterThan(0);
    for (const z of zones) {
      expect(z.river).toBe("Arroyo Uno");
      expect(z.width * METERS_PER_UNIT).toBeGreaterThanOrEqual(MIN_CROSSING_M);
      expect(z.width * METERS_PER_UNIT).toBeLessThanOrEqual(MAX_CROSSING_M);
      expect(z.calves).toBeGreaterThanOrEqual(2);
      expect(z.calves).toBeLessThanOrEqual(5);
    }
  });

  it("never uses a bulkhead bank (Kr above the natural limit)", () => {
    const zones = generateCrossingZones(world({ krAt: () => NATURAL_KR + 0.1 }));
    expect(zones).toHaveLength(0);
  });

  it("keeps away from docks and the busy center", () => {
    const all = generateCrossingZones(world());
    const hole = { x: 0, z: 0, r: 150 };
    const some = generateCrossingZones(world({ avoid: [hole] }));
    expect(some.length).toBeLessThan(all.length);
    for (const z of some) expect(Math.hypot(z.x - hole.x, z.z - hole.z)).toBeGreaterThanOrEqual(hole.r);
  });

  it("is deterministic and the seed changes the pick", () => {
    const a = generateCrossingZones(world());
    const b = generateCrossingZones(world());
    expect(b).toEqual(a);
    const c = generateCrossingZones(world({ seed: 7 }));
    expect(c.map((z) => `${z.x},${z.z}`)).not.toEqual(a.map((z) => `${z.x},${z.z}`));
  });

  it("keeps only a few per map sector and spaces them out", () => {
    const zones = generateCrossingZones(world());
    const perSector = new Map<string, number>();
    for (const z of zones) perSector.set(z.sector, (perSector.get(z.sector) ?? 0) + 1);
    for (const n of perSector.values()) expect(n).toBeLessThanOrEqual(2);
    for (const a of zones) for (const b of zones) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(60);
  });

  it("puts the banks on the two shores, across the arroyo", () => {
    const [z] = generateCrossingZones(world());
    const across = probeChannel(isWater, z.x, z.z, Math.atan2(z.along[0], z.along[1]));
    expect(Math.abs(z.a[0] - z.b[0])).toBeCloseTo(across.width, 0);
    expect(Math.hypot(z.dir[0], z.dir[1])).toBeCloseTo(1, 5);
  });
});

const zone: CrossingZone = {
  id: 3,
  river: "Arroyo Uno",
  x: 0,
  z: 0,
  a: [-2, 0],
  b: [2, 0],
  dir: [1, 0],
  along: [0, 1],
  width: 4,
  calves: 3,
  sector: "0,0",
};
const near = { playerDist: 20, blocked: false };
const far = { playerDist: 500, blocked: false };

/** Advances a family in steps of 0.25 s. */
function run(f: CapybaraFamily, seconds: number, ctx = near): void {
  for (let t = 0; t < seconds; t += 0.25) f.update(0.25, ctx);
}

/** Runs until `done`, failing if it takes over 3 minutes. */
function runUntil(f: CapybaraFamily, done: () => boolean, ctx = near): void {
  for (let t = 0; t < 180 && !done(); t += 0.25) f.update(0.25, ctx);
  expect(done()).toBe(true);
}

describe("capybara family", () => {
  it("is 2 adults and the zone's calves, in single file", () => {
    const f = new CapybaraFamily(zone);
    expect(f.size).toBe(2 + zone.calves);
    const m = f.members();
    expect(m.map((x) => x.calf)).toEqual([false, true, true, true, false]);
  });

  it("waits on the bank while the player is far, then crosses and ends on the other bank", () => {
    const f = new CapybaraFamily(zone);
    const start = f.side;
    run(f, 20, far);
    expect(f.phase).toBe("bank");
    run(f, 3, near);
    expect(f.phase).toBe("crossing");
    // Swimming: only the middle of the file is in the water at some point
    run(f, (zone.width / SWIM_SPEED) / 2);
    expect(f.members().some((m) => m.wet > 0.9)).toBe(true);
    run(f, zone.width / SWIM_SPEED + 6);
    expect(f.phase).toBe("farBank");
    expect(f.side).not.toBe(start);
    expect(f.crossings).toBe(1);
    // They end on land at the far bank, not in the water
    const m = f.members();
    expect(m.every((x) => x.wet === 0 && !x.hidden)).toBe(true);
    const bankX = f.side === 1 ? zone.b[0] : zone.a[0];
    for (const x of m) expect(Math.abs(x.x - bankX)).toBeLessThan(1);
  });

  it("grazes on the far bank and then crosses back", () => {
    const f = new CapybaraFamily(zone);
    const first = f.side;
    runUntil(f, () => f.crossings === 1);
    expect(f.phase).toBe("farBank");
    expect(f.side).not.toBe(first);
    runUntil(f, () => f.crossings === 2);
    expect(f.side).toBe(first);
  });

  it("does not start crossing with a boat sitting on the line", () => {
    const f = new CapybaraFamily(zone);
    run(f, 20, { playerDist: 3, blocked: true });
    expect(f.phase).toBe("bank");
    run(f, 6, near);
    expect(f.phase).toBe("crossing");
  });

  it("swims in a file: each animal one gap behind the one in front", () => {
    const f = new CapybaraFamily(zone);
    run(f, 4);
    run(f, 6);
    const m = f.members().filter((x) => x.wet > 0.9);
    expect(m.length).toBeGreaterThan(1);
    const sign = f.side === 0 ? 1 : -1;
    for (let i = 1; i < m.length; i++) expect((m[i - 1].x - m[i].x) * sign).toBeCloseTo(FILE_GAP, 1);
  });

  it("dives when scared and comes up on the bank farthest from the player, spooked", () => {
    const f = new CapybaraFamily(zone);
    run(f, 8);
    expect(f.phase).toBe("crossing");
    f.scare(-10, 0); // player on the A side
    expect(f.phase).toBe("dived");
    expect(f.members().every((m) => m.hidden)).toBe(true);
    run(f, DIVE_SECONDS + 0.5);
    expect(f.phase).toBe("farBank");
    expect(f.side).toBe(1);
    expect(f.spooked).toBeGreaterThan(0);
    // Spooked: they do not cross again until it passes, even with the player near
    run(f, 25);
    expect(f.phase).not.toBe("crossing");
    runUntil(f, () => f.phase === "crossing");
    expect(f.spooked).toBe(0);
  });
});

const view = (over: Partial<FamilyView> = {}): FamilyView => ({ id: 3, phase: "crossing", distanceM: 100, calves: 3, ...over });
const slowInputs = (distanceM: number, speedMps = 1, phase: FamilyView["phase"] = "crossing") => ({ speedMps, wakeHeight: 0.01, families: [view({ distanceM, phase })] });

/** The player approaches a crossing family, then it finishes crossing. */
function approach(rule: CapybaraRespect, speeds: number[], wake = 0.01) {
  const events = [];
  const dists = [90, 70, 55, 45, 38, 30, 25, 20, 20];
  for (let i = 0; i < dists.length; i++) {
    events.push(...rule.update(1, { speedMps: speeds[Math.min(i, speeds.length - 1)], wakeHeight: wake, families: [view({ distanceM: dists[i] })] }));
  }
  events.push(...rule.update(1, { speedMps: speeds[speeds.length - 1], wakeHeight: wake, families: [view({ distanceM: 22, phase: "farBank" })] }));
  return events;
}

describe("capybara rule: stopping scores", () => {
  it("warns at the alert distance", () => {
    const r = new CapybaraRespect();
    expect(r.update(1, slowInputs(ALERT_M + 5))).toEqual([]);
    const e = r.update(1, slowInputs(ALERT_M - 5));
    expect(e).toHaveLength(1);
    expect(e[0].message).toBe(MSG_WARN);
    expect(e[0].penalty).toBe(0);
    // Only once per crossing
    expect(r.update(1, slowInputs(ALERT_M - 10))).toEqual([]);
  });

  it("rewards slowing down until they finish crossing", () => {
    const r = new CapybaraRespect();
    const ev = approach(r, [8, 3, 1, 0.5]);
    const win = ev.filter((e) => e.penalty < 0);
    expect(win).toHaveLength(1);
    expect(win[0].penalty).toBe(-reward(3));
    expect(win[0].message).toBe(`¡Respetaste a los carpinchos! +${reward(3)}`);
    expect(ev.some((e) => e.scare)).toBe(false);
  });

  it("fines rushing past close to them, and they dive", () => {
    const r = new CapybaraRespect();
    const ev = approach(r, [8]);
    const fine = ev.filter((e) => e.kind === "fine");
    expect(fine).toHaveLength(1);
    expect(fine[0].penalty).toBe(SCARE_PENALTY);
    expect(fine[0].scare).toBe(true);
    expect(ev.some((e) => e.penalty < 0)).toBe(false);
  });

  it("fines a big wave even at a gentle speed", () => {
    const r = new CapybaraRespect();
    const ev = approach(r, [0.8], 0.2);
    expect(ev.filter((e) => e.kind === "fine")).toHaveLength(1);
  });

  it("is a bump (they dive) under the collision distance, whatever the speed", () => {
    const r = new CapybaraRespect();
    const e = r.update(1, slowInputs(COLLIDE_M - 1, 0.2));
    expect(e.some((x) => x.kind === "fine" && x.scare)).toBe(true);
  });

  it("gives nothing if you never came close, and nothing if you were only far and fast", () => {
    const r = new CapybaraRespect();
    const ev = [];
    for (const d of [200, 150, 100, 95]) ev.push(...r.update(1, { speedMps: 9, wakeHeight: 0.3, families: [view({ distanceM: d })] }));
    ev.push(...r.update(1, { speedMps: 9, wakeHeight: 0.3, families: [view({ distanceM: 95, phase: "farBank" })] }));
    expect(ev).toEqual([]);
  });

  it("does not take a kayak's stroke for rushing", () => {
    const r = new CapybaraRespect();
    // Kayaker paddling in bursts: peaks of 1.8 m/s but around 1 m/s on average
    const ev = [];
    const speeds = [0.8, 1.8, 0.3, 1.8, 0.3, 1.8, 0.3];
    for (let i = 0; i < speeds.length; i++) ev.push(...r.update(0.5, { speedMps: speeds[i], wakeHeight: 0.0, families: [view({ distanceM: 30 })] }));
    ev.push(...r.update(0.5, { speedMps: 1, wakeHeight: 0, families: [view({ distanceM: 30, phase: "farBank" })] }));
    expect(ev.filter((e) => e.kind === "fine")).toHaveLength(0);
    expect(ev.filter((e) => e.penalty < 0)).toHaveLength(1);
  });
});

describe("capybara rule inside the RuleBook", () => {
  const inputs = (distanceM: number, speedMps: number, phase: FamilyView["phase"] = "crossing") => ({
    x: 0,
    z: 0,
    heading: 0,
    speed: 0.05,
    probe: { port: 5, starboard: 5, width: 10 },
    distanceToDock: 100,
    wakes: [],
    wakeHeight: 0.01,
    fauna: { speedMps, families: [view({ distanceM, phase })] },
  });

  for (const id of ["colectiva", "kayak"] as const) {
    it(`rewards stopping, ${id} included, in the classic or realistic mode`, () => {
      for (const strict of [false, true]) {
        const book = new RuleBook(BOAT_TYPES[id], { strict });
        book.update(START_GRACE + 1, inputs(200, 5, "bank"));
        const all = [];
        for (const d of [75, 50, 30, 25]) all.push(...book.update(1, inputs(d, 0.5)));
        all.push(...book.update(1, inputs(25, 0.5, "farBank")));
        const carp = all.filter((e) => e.rule === "carpinchos");
        expect(carp[0].message).toBe(MSG_WARN);
        expect(carp.some((e) => e.penalty === -reward(3))).toBe(true);
      }
    });
  }

  it("sends the family to dive when rushing", () => {
    const book = new RuleBook(BOAT_TYPES.colectiva);
    book.update(START_GRACE + 1, inputs(200, 5, "bank"));
    const ev = [];
    for (const d of [75, 50, 30]) ev.push(...book.update(1, inputs(d, 9)));
    const fine = ev.find((e) => e.rule === "carpinchos" && e.kind === "fine");
    expect(fine?.penalty).toBe(SCARE_PENALTY);
    expect(fine?.scareFamily).toBe(3);
  });
});
