import { describe, expect, it } from "vitest";
import { BOAT_TYPES } from "../src/boat/boatTypes";
import { Handling, NO_INPUT, type HandlingInput } from "../src/boat/handling";
import {
  applyRowing,
  combineOars,
  DriveTracker,
  MIN_STROKE,
  OarsGesture,
  PaddleGesture,
  rowingWidgetFor,
  SEAT_RETURN,
  strokeStrength,
  type RowingOrders,
} from "../src/controls/rowingGestures";
import { parseScheme } from "../src/controls/controlScheme";

/** Drags a finger from 0 to `to` (reach units) in `seconds`, sampled at 60 Hz. */
function drag(move: (y: number, t: number) => void, t0: number, to: number, seconds: number, from = 0): number {
  const n = Math.max(1, Math.round(seconds * 60));
  for (let i = 0; i <= n; i++) move(from + ((to - from) * i) / n, t0 + (seconds * i) / n);
  return t0 + seconds;
}

describe("strokeStrength", () => {
  it("a short drag is no stroke", () => {
    expect(strokeStrength(MIN_STROKE * 0.9, 0.2)).toBe(0);
    expect(strokeStrength(0, 0)).toBe(0);
    expect(strokeStrength(NaN, 0.2)).toBe(0);
  });

  it("longer and quicker is stronger, clamped to 1", () => {
    expect(strokeStrength(1, 0.4)).toBe(1);
    expect(strokeStrength(5, 0.01)).toBe(1);
    expect(strokeStrength(1, 0.4)).toBeGreaterThan(strokeStrength(0.5, 0.2));
    expect(strokeStrength(1, 0.4)).toBeGreaterThan(strokeStrength(1, 1.5));
    expect(strokeStrength(1, 1.5)).toBeGreaterThan(0.4);
  });
});

describe("DriveTracker", () => {
  it("a drag down and release is a forward stroke; up is a back stroke", () => {
    const d = new DriveTracker(0);
    drag((y, t) => d.move(y, t), 0, 0.9, 0.35);
    const s = d.end();
    expect(s?.back).toBe(false);
    expect(s!.strength).toBeGreaterThan(0.8);

    const b = new DriveTracker(0);
    drag((y, t) => b.move(y, t), 0, -0.8, 0.4);
    expect(b.end()?.back).toBe(true);
  });

  it("measures the drive from when the finger starts moving, not from the touch", () => {
    const d = new DriveTracker(0);
    d.move(0, 0.5); // resting 1.5 s
    d.move(0.01, 1.5);
    drag((y, t) => d.move(y, t), 1.5, 1, 0.4);
    expect(d.end()!.strength).toBeGreaterThan(0.95);
  });

  it("keeping the thumb down: coming back ends the stroke, going again starts another", () => {
    const d = new DriveTracker(0);
    const strokes: unknown[] = [];
    const m = (y: number, t: number) => {
      const s = d.move(y, t);
      if (s) strokes.push(s);
    };
    let t = drag(m, 0, 1, 0.4);
    t = drag(m, t, 0, 0.6, 1); // recovery: no back stroke
    expect(strokes).toHaveLength(1);
    t = drag(m, t, 1, 0.4, 0);
    expect(d.end()).not.toBeNull();
    expect(strokes).toHaveLength(1);
  });
});

describe("PaddleGesture (kayak pala)", () => {
  it("the left end down strokes left, the right end down strokes right", () => {
    const p = new PaddleGesture();
    p.down(1, -1, 0);
    drag((y, t) => p.move(1, y, t), 0, 0.9, 0.3);
    expect(p.ends().left).toBeCloseTo(0.9);
    expect(p.ends().right).toBe(0);
    p.up(1);
    const o = p.take(0.31)!;
    expect(o.strokeLeft).toBe(true);
    expect(o.strokeRight || o.backLeft || o.backRight).toBe(false);
    expect(p.take(0.32)).toBeNull();

    p.down(2, 1, 1);
    drag((y, t) => p.move(2, y, t), 1, 0.9, 0.3);
    p.up(2);
    expect(p.take(1.31)!.strokeRight).toBe(true);
  });

  it("pushing an end up is a back stroke on that side", () => {
    const p = new PaddleGesture();
    p.down(1, 1, 0);
    drag((y, t) => p.move(1, y, t), 0, -0.7, 0.3);
    p.up(1);
    const o = p.take(0.3)!;
    expect(o.backRight).toBe(true);
    expect(o.strokeRight).toBe(false);
  });

  it("strength follows the drag; stale strokes are dropped", () => {
    const p = new PaddleGesture();
    p.down(1, -1, 0);
    drag((y, t) => p.move(1, y, t), 0, 0.35, 0.5);
    p.up(1);
    const weak = p.take(0.5)!.strength;
    p.down(1, -1, 1);
    drag((y, t) => p.move(1, y, t), 1, 1, 0.35);
    p.up(1);
    expect(p.take(1.35)!.strength).toBeGreaterThan(weak);
    p.down(1, -1, 2);
    drag((y, t) => p.move(1, y, t), 2, 1, 0.35);
    p.up(1);
    expect(p.take(5)).toBeNull();
  });

  it("alternating strokes go straight, the same side turns (through the Handling model)", () => {
    const run = (sides: Array<-1 | 1>) => {
      const h = new Handling(BOAT_TYPES.kayak);
      const p = new PaddleGesture();
      let heading = 0;
      let t = 0;
      let out = h.update(0, NO_INPUT);
      sides.forEach((side, i) => {
        p.down(i, side, t);
        for (let k = 0; k < 60; k++) {
          t += 1 / 60;
          if (k <= 20) p.move(i, k / 20, t);
          if (k === 21) p.up(i);
          out = h.update(1 / 60, applyRowing(NO_INPUT, p.take(t)));
          heading += out.yawRate / 60;
        }
      });
      return { heading, speed: out.speed };
    };
    const alt = run([-1, 1, -1, 1, -1, 1, -1, 1]);
    const left = run([-1, -1, -1, -1, -1, -1, -1, -1]);
    expect(alt.speed).toBeGreaterThan(0);
    expect(Math.abs(alt.heading)).toBeLessThan(Math.abs(left.heading) / 4);
    expect(left.heading).toBeGreaterThan(0.3); // left strokes swing the bow to starboard
  });
});

describe("combineOars", () => {
  const s = (strength: number, back = false) => ({ side: 0 as const, back, strength, t: 1 });
  it("two even oars: a straight stroke", () => {
    const c = combineOars(s(1), s(1));
    expect(c.stroke!.strength).toBe(1);
    expect(c.pressure).toBe(0);
    expect(c.stroke!.back).toBe(false);
  });
  it("pulling the left oar harder turns to starboard; one oar alone turns hard", () => {
    expect(combineOars(s(1), s(0.6)).pressure).toBeGreaterThan(0.2);
    expect(combineOars(s(0.6), s(1)).pressure).toBeLessThan(-0.2);
    const alone = combineOars(s(1), null);
    expect(alone.pressure).toBe(1);
    expect(alone.stroke!.strength).toBe(0.5);
  });
  it("both up is ciar; one rowing and the other backing spins without pushing", () => {
    expect(combineOars(s(0.8, true), s(0.8, true)).stroke!.back).toBe(true);
    const spin = combineOars(s(1), s(1, true));
    expect(spin.stroke).toBeNull();
    expect(spin.pressure).toBe(1);
  });
});

describe("OarsGesture (remos y carro)", () => {
  /** Both thumbs drive together from t over `seconds`; returns the orders seen. */
  function stroke(g: OarsGesture, t: number, opts: { left?: number; right?: number; seconds?: number } = {}): { t: number; orders: RowingOrders[] } {
    const { left = 1, right = 1, seconds = 0.5 } = opts;
    const orders: RowingOrders[] = [];
    g.down(1, -1, t);
    g.down(2, 1, t);
    const n = Math.round(seconds * 60);
    for (let i = 0; i <= n; i++) {
      const tt = t + (seconds * i) / n;
      g.move(1, (left * i) / n, tt);
      g.move(2, (right * i) / n, tt);
      const o = g.take(tt);
      if (o) orders.push(o);
    }
    t += seconds;
    g.up(1, t);
    g.up(2, t);
    const o = g.take(t);
    if (o) orders.push(o);
    return { t, orders };
  }

  it("both handles down: one stroke, with the strength of the drag", () => {
    const g = new OarsGesture();
    const { orders } = stroke(g, 0);
    const strokes = orders.filter((o) => o.strokeLeft);
    expect(strokes).toHaveLength(1);
    expect(strokes[0].strength).toBeGreaterThan(0.8);
    expect(Math.abs(strokes[0].pressure)).toBeLessThan(0.05);
  });

  it("one handle further than the other turns (already during the drive)", () => {
    const g = new OarsGesture();
    const { orders } = stroke(g, 0, { left: 1, right: 0.5 });
    expect(orders.some((o) => o.pressure > 0.3)).toBe(true);
    const st = orders.find((o) => o.strokeLeft)!;
    expect(st.pressure).toBeGreaterThan(0.3);
  });

  it("both handles up is ciar", () => {
    const g = new OarsGesture();
    const { orders } = stroke(g, 0, { left: -0.8, right: -0.8 });
    expect(orders.some((o) => o.backLeft)).toBe(true);
    expect(orders.some((o) => o.strokeLeft)).toBe(false);
  });

  it("the carro slides toward the bow in the drive and comes back in the recovery", () => {
    const g = new OarsGesture();
    expect(g.seat(0)).toBe(0);
    g.down(1, -1, 0);
    g.down(2, 1, 0);
    g.move(1, 0.6, 0.3);
    g.move(2, 0.6, 0.3);
    expect(g.seat(0.3)).toBeCloseTo(0.6);
    g.move(1, 1, 0.5);
    g.move(2, 1, 0.5);
    g.up(1, 0.5);
    g.up(2, 0.5);
    g.take(0.5);
    expect(g.seat(0.5)).toBeCloseTo(1);
    expect(g.seat(0.5 + SEAT_RETURN / 2)).toBeCloseTo(0.5);
    expect(g.seat(0.5 + SEAT_RETURN + 0.01)).toBe(0);
  });

  it("rushing the recovery is flagged, and the Handling makes that stroke weak", () => {
    const g = new OarsGesture();
    let { t } = stroke(g, 0);
    ({ t } = stroke(g, t + 0.2));
    expect(g.rushed).toBe(true);
    ({ t } = stroke(g, t + SEAT_RETURN + 0.2));
    expect(g.rushed).toBe(false);

    // Through the model: the second stroke after a short recovery adds much less speed
    const gain = (recovery: number) => {
      const h = new Handling(BOAT_TYPES.single);
      const og = new OarsGesture();
      let out = h.update(0, NO_INPUT);
      const first = stroke(og, 0);
      out = h.update(0.5, applyRowing(NO_INPUT, first.orders.find((o) => o.strokeLeft) ?? null));
      for (let f = 0; f < Math.round((recovery + 0.5) * 60); f++) out = h.update(1 / 60, NO_INPUT);
      const second = stroke(og, first.t + recovery);
      const before = out.speed;
      out = h.update(1 / 60, applyRowing(NO_INPUT, second.orders.find((o) => o.strokeLeft) ?? null));
      return out.speed - before;
    };
    expect(gain(0.2)).toBeLessThan(gain(1.3) * 0.5);
    expect(gain(1.3)).toBeGreaterThan(0);
  });
});

describe("applyRowing and the boats", () => {
  it("keys keep working; the widget adds its strokes and strength", () => {
    const keys: HandlingInput = { ...NO_INPUT, strokeRight: true };
    expect(applyRowing(keys, null)).toBe(keys);
    const merged = applyRowing(keys, { strokeLeft: true, strokeRight: false, backLeft: false, backRight: false, pressure: 0.4, strength: 0.6 });
    expect(merged.strokeRight).toBe(true);
    expect(merged.strokeLeft).toBe(true);
    expect(merged.pressure).toBe(0.4);
    expect(merged.strength).toBe(0.6);
  });

  it("only the kayak and the single row on screen (the bote de travesía keeps its coxswain controls)", () => {
    expect(rowingWidgetFor("kayak")).toBe("pala");
    expect(rowingWidgetFor("single")).toBe("remos");
    expect(rowingWidgetFor("travesia")).toBeNull();
    expect(rowingWidgetFor("colectiva")).toBeNull();
  });

  it("a weaker stroke pushes the kayak less", () => {
    const go = (strength: number) => new Handling(BOAT_TYPES.kayak).update(1 / 60, { ...NO_INPUT, strokeLeft: true, strength }).speed;
    expect(go(0.4)).toBeLessThan(go(1));
    expect(go(1)).toBe(new Handling(BOAT_TYPES.kayak).update(1 / 60, { ...NO_INPUT, strokeLeft: true }).speed);
  });
});

describe("control schemes", () => {
  it("the old Botones and Flechas are both today's Flechas; Ruedita and Timón (palanca) keep their ids", () => {
    expect(parseScheme("botones")).toBe("flechas");
    expect(parseScheme("flechas")).toBe("flechas");
    expect(parseScheme(null)).toBe("flechas");
    expect(parseScheme("ruedita")).toBe("ruedita");
    expect(parseScheme("palanca")).toBe("palanca");
  });
});
