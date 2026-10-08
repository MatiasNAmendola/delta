import { describe, expect, it } from "vitest";
import { BOAT_TYPES } from "../src/boat/boatTypes";
import { Handling, handlingKind, NO_INPUT, type HandlingInput } from "../src/boat/handling";

const run = (h: Handling, seconds: number, input: Partial<HandlingInput>, every?: (t: number) => Partial<HandlingInput>) => {
  let out = h.update(0, { ...NO_INPUT, ...input });
  for (let t = 0; t < seconds; t += 1 / 60) out = h.update(1 / 60, { ...NO_INPUT, ...input, ...(every ? every(t) : {}) });
  return out;
};

describe("realistic handling", () => {
  it("maps each boat to how it is driven", () => {
    expect(handlingKind(BOAT_TYPES.colectiva)).toBe("rueda");
    expect(handlingKind(BOAT_TYPES.pesca)).toBe("cana");
    expect(handlingKind(BOAT_TYPES.runabout)).toBe("volante");
    expect(handlingKind(BOAT_TYPES.moto)).toBe("moto");
    expect(handlingKind(BOAT_TYPES.kayak)).toBe("kayak");
    expect(handlingKind(BOAT_TYPES.single)).toBe("single");
    expect(handlingKind(BOAT_TYPES.travesia)).toBe("timonel");
  });

  it("the colectiva's rudder does nothing without way on, and steers when moving", () => {
    const h = new Handling(BOAT_TYPES.colectiva);
    const still = run(h, 3, { helm: 1 });
    expect(Math.abs(still.yawRate)).toBeLessThan(0.01);
    const moving = run(h, 20, { lever: 1 });
    expect(moving.speed).toBeGreaterThan(0);
    expect(moving.yawRate).toBeGreaterThan(0.05); // the wheel stayed hard over
  });

  it("shifting ahead to astern waits in neutral; astern walks the stern", () => {
    const h = new Handling(BOAT_TYPES.colectiva);
    run(h, 15, { lever: 0.5 });
    h.update(1 / 60, { ...NO_INPUT, lever: -0.5 });
    expect(h.status().gear).toBe(0);
    expect(h.status().shifting).toBeGreaterThan(1);
    const astern = run(h, 25, { lever: -0.5 });
    expect(astern.speed).toBeLessThan(0);
    // Wheel centred, yet it turns: propeller walk (bow to starboard)
    expect(astern.yawRate).toBeGreaterThan(0.01);
  });

  it("a tiller works the other way round", () => {
    const h = new Handling(BOAT_TYPES.pesca);
    const out = run(h, 6, { lever: 0.8, helm: 1 });
    expect(out.yawRate).toBeLessThan(0);
  });

  it("a jet ski doesn't steer without throttle", () => {
    const h = new Handling(BOAT_TYPES.moto);
    run(h, 4, { lever: 1 });
    const coasting = run(h, 3, { lever: 0, helm: 1 });
    const gas = run(new Handling(BOAT_TYPES.moto), 4, { lever: 1, helm: 1 });
    expect(Math.abs(coasting.yawRate)).toBeLessThan(Math.abs(gas.yawRate) * 0.3);
  });

  it("a kayak goes straight alternating strokes and turns stroking one side", () => {
    const alternate = new Handling(BOAT_TYPES.kayak);
    let yawSum = 0;
    let out = alternate.update(0, NO_INPUT);
    for (let i = 0; i < 600; i++) {
      const k = Math.floor(i / 55);
      out = alternate.update(1 / 60, { ...NO_INPUT, strokeLeft: i % 55 === 0 && k % 2 === 0, strokeRight: i % 55 === 0 && k % 2 === 1 });
      yawSum += out.yawRate / 60;
    }
    expect(out.speed).toBeGreaterThan(BOAT_TYPES.kayak.maxSpeed * 60 * 0.5);
    expect(Math.abs(yawSum)).toBeLessThan(0.35);
    const oneSide = new Handling(BOAT_TYPES.kayak);
    let turned = 0;
    for (let i = 0; i < 600; i++) turned += oneSide.update(1 / 60, { ...NO_INPUT, strokeLeft: i % 55 === 0 }).yawRate / 60;
    expect(turned).toBeGreaterThan(1); // left strokes turn the bow to starboard
  });

  it("a single scull rewards rhythm: rushed strokes are weak", () => {
    const steady = run(new Handling(BOAT_TYPES.single), 20, {}, (t) => ({ strokeLeft: Math.abs((t % 2) - 0) < 1 / 120 }));
    const rushed = run(new Handling(BOAT_TYPES.single), 20, {}, (t) => ({ strokeLeft: Math.abs((t % 0.65) - 0) < 1 / 120 }));
    expect(steady.speed).toBeGreaterThan(rushed.speed * 0.9);
    expect(steady.speed).toBeGreaterThan(2);
  });

  it("the coxswain sets the crew's rate; ciar backs the boat", () => {
    const h = new Handling(BOAT_TYPES.travesia);
    expect(run(h, 20, { lever: 0.75 }).speed).toBeGreaterThan(1.5);
    expect(run(h, 20, { lever: -0.5 }).speed).toBeLessThan(0);
  });
});
