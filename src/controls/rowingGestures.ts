/**
 * Pure logic of the touch rowing controls (no DOM, so it can be tested):
 * - "Pala" (kayak): a double-bladed paddle across the bottom of the screen.
 *   Drag the left end down = a forward stroke on the left, the right end
 *   down = on the right; push an end up = a back stroke on that side.
 * - "Remos y carro" (single scull): one oar handle per thumb. Pull both
 *   toward you (down the screen) = a stroke; one harder than the other
 *   turns; push both up = ciar. A sliding seat ("carro") goes toward the
 *   bow during the drive and comes back during the recovery.
 *
 * Positions are in "reach" units: the finger's vertical offset from where it
 * touched, divided by the widget's travel in px (so 1 = a full stroke),
 * positive DOWN the screen (toward the player). Times in seconds.
 *
 * The strokes feed the existing Handling model (handling.ts): strokeLeft /
 * strokeRight / backLeft / backRight, `pressure` to turn the single, and
 * `strength` (0..1) from the drag's length and speed.
 */
import type { HandlingInput } from "../boat/handling";
import { SCULL_MIN_INTERVAL } from "../boat/handling";

/** A drag shorter than this (share of the reach) is not a stroke. */
export const MIN_STROKE = 0.18;
/** Movement that decides the direction of a drag (forward or back). */
export const LOCK = 0.08;
/** Going back this much against the drive ends the stroke (thumb kept down). */
export const REVERSE = 0.15;
/** Full-strength drag speed: the whole reach in 0.4 s. */
export const V_REF = 2.5;
/** Both oars must finish their drive within this to count as one stroke. */
export const PAIR_WINDOW = 0.35;
/** A stroke not taken by the boat within this is dropped. */
const STALE = 0.6;
/** How long a stroke's turn (single) lasts after it, like the drive's pressure. */
export const PRESSURE_HOLD = 0.8;
/** The carro comes back to the stern in this time after the drive. */
export const SEAT_RETURN = SCULL_MIN_INTERVAL - 0.55;

export interface Stroke {
  /** -1 left, 1 right, 0 both oars. */
  side: -1 | 0 | 1;
  /** A back stroke (kayak) or ciar (single). */
  back: boolean;
  /** 0..1 */
  strength: number;
  /** When it finished (s). */
  t: number;
}

/** The orders the touch rowing widgets add to the Handling input. */
export interface RowingOrders {
  strokeLeft: boolean;
  strokeRight: boolean;
  backLeft: boolean;
  backRight: boolean;
  /** Single: -1..1, more on one oar (positive turns to starboard). */
  pressure: number;
  /** 0..1 for this frame's stroke. */
  strength: number;
}

export const NO_ORDERS: RowingOrders = { strokeLeft: false, strokeRight: false, backLeft: false, backRight: false, pressure: 0, strength: 1 };

/** How hard a drag pulls: longer and quicker is stronger (clamped to 0..1). Below MIN_STROKE: 0. */
export function strokeStrength(length: number, seconds: number): number {
  const len = Math.abs(length);
  if (!(len >= MIN_STROKE)) return 0;
  const speed = len / Math.max(0.05, seconds);
  const s = Math.min(1, len) * (0.45 + 0.55 * Math.min(1.2, speed / V_REF));
  return Math.max(0, Math.min(1, s));
}

/**
 * One finger's drag on a blade end or an oar handle. Its first clear move
 * fixes its direction (down = forward, up = back). Going back against it by
 * REVERSE ends the stroke without lifting the thumb (the recovery), and
 * moving the same way again starts a new drive from there.
 */
export class DriveTracker {
  /** 1 forward (down), -1 back (up), 0 not decided yet. */
  dir: 0 | 1 | -1 = 0;
  /** Where the finger is now (reach units, from where it touched). */
  y = 0;
  private start = 0;
  private startT = 0;
  private ext = 0;
  private extT = 0;
  private recovering = false;

  constructor(t: number) {
    this.startT = t;
    this.extT = t;
  }

  /** In the drive now (not deciding, not recovering). */
  get driving(): boolean {
    return this.dir !== 0 && !this.recovering;
  }

  /** How far along the current drive (0..1), for the visuals. */
  get progress(): number {
    return this.driving ? Math.min(1, Math.abs(this.ext - this.start)) : 0;
  }

  /** The finger moved to y at time t: a stroke when the drive just ended. */
  move(y: number, t: number): Stroke | null {
    if (!Number.isFinite(y)) return null;
    this.y = y;
    if (this.dir === 0) {
      if (Math.abs(y - this.start) < LOCK / 2) this.startT = t; // still resting: the drive has not begun
      if (Math.abs(y - this.start) >= LOCK) {
        this.dir = y > this.start ? 1 : -1;
        this.ext = y;
        this.extT = t;
      }
      return null;
    }
    const along = (v: number) => v * this.dir;
    if (this.recovering) {
      // Track the turn of the recovery; going the drive's way again starts a new drive
      if (along(y) < along(this.ext)) {
        this.ext = y;
        this.extT = t;
      } else if (along(y) - along(this.ext) >= LOCK) {
        this.recovering = false;
        this.start = this.ext;
        this.startT = this.extT;
        this.ext = y;
        this.extT = t;
      }
      return null;
    }
    if (along(y) > along(this.ext)) {
      this.ext = y;
      this.extT = t;
      return null;
    }
    if (along(this.ext) - along(y) >= REVERSE) {
      const s = this.finish();
      this.recovering = true;
      this.ext = y;
      this.extT = t;
      return s;
    }
    return null;
  }

  /** The finger lifted: a stroke if a drive was under way. */
  end(): Stroke | null {
    if (!this.driving) return null;
    const s = this.finish();
    this.dir = 0;
    return s;
  }

  private finish(): Stroke | null {
    const strength = strokeStrength(this.ext - this.start, this.extT - this.startT);
    if (strength <= 0) return null;
    return { side: 0, back: this.dir < 0, strength, t: this.extT };
  }
}

/**
 * The kayak's pala: each finger takes the blade end it touched (left or
 * right). A stroke comes out per drive; the boat takes one at a time.
 */
export class PaddleGesture {
  private touches = new Map<number, { side: -1 | 1; drag: DriveTracker }>();
  private queue: Stroke[] = [];

  down(id: number, side: -1 | 1, t: number): void {
    this.touches.set(id, { side, drag: new DriveTracker(t) });
  }

  move(id: number, y: number, t: number): void {
    const touch = this.touches.get(id);
    if (!touch) return;
    const s = touch.drag.move(y, t);
    if (s) this.queue.push({ ...s, side: touch.side });
  }

  up(id: number): void {
    const touch = this.touches.get(id);
    if (!touch) return;
    const s = touch.drag.end();
    if (s) this.queue.push({ ...s, side: touch.side });
    this.touches.delete(id);
  }

  /** Clears every finger (the widget was hidden). */
  cancel(): void {
    this.touches.clear();
    this.queue = [];
  }

  /** Where each blade end is drawn (reach units, clamped to ±1; 0 when free). */
  ends(): { left: number; right: number } {
    const at = (side: -1 | 1) => {
      for (const t of this.touches.values()) if (t.side === side) return Math.max(-1, Math.min(1, t.drag.y));
      return 0;
    };
    return { left: at(-1), right: at(1) };
  }

  /** This frame's orders: the oldest pending stroke (stale ones are dropped). */
  take(t: number): RowingOrders | null {
    this.queue = this.queue.filter((s) => t - s.t <= STALE);
    const s = this.queue.shift();
    if (!s) return null;
    return {
      ...NO_ORDERS,
      strokeLeft: !s.back && s.side < 0,
      strokeRight: !s.back && s.side > 0,
      backLeft: s.back && s.side < 0,
      backRight: s.back && s.side > 0,
      strength: s.strength,
    };
  }
}

/** The pair of strokes of the two oars becomes one stroke of the single. */
export function combineOars(left: Stroke | null, right: Stroke | null): { stroke: Stroke | null; pressure: number } {
  if (left && right) {
    if (left.back === right.back) {
      const strength = (left.strength + right.strength) / 2;
      // Pulling harder on the left oar pushes the bow to starboard (right); backing does the opposite
      const diff = (left.strength - right.strength) / Math.max(0.2, strength);
      const pressure = clamp(left.back ? -diff : diff, -1, 1);
      return { stroke: { side: 0, back: left.back, strength, t: Math.max(left.t, right.t) }, pressure };
    }
    // One oar rows and the other backs: the shell spins on the spot, toward the backing oar
    return { stroke: null, pressure: left.back ? -1 : 1 };
  }
  const one = left ?? right;
  if (!one) return { stroke: null, pressure: 0 };
  const side = left ? -1 : 1;
  // A single oar: half the push and a strong turn (away from it rowing, toward it backing)
  const pressure = one.back ? side : -side;
  return { stroke: { ...one, side, strength: one.strength / 2 }, pressure };
}

/**
 * The single's two oars and the carro. Each oar is its own finger; the two
 * drives become one stroke (combineOars) when they finish together.
 */
export class OarsGesture {
  private oars: Record<"left" | "right", { id: number; drag: DriveTracker } | null> = { left: null, right: null };
  private done: Record<"left" | "right", Stroke | null> = { left: null, right: null };
  private ready: { stroke: Stroke | null; pressure: number; t: number } | null = null;
  private pressureNow = 0;
  private pressureUntil = -1;
  /** When the last stroke finished, and where the carro was then. */
  private lastStroke = -10;
  private seatAtStroke = 0;
  /** The furthest the carro went in this drive. */
  private peakSeat = 0;
  /** This drive began before the carro was back: the stroke will be weak. */
  rushed = false;

  down(id: number, side: -1 | 1, t: number): void {
    const key = side < 0 ? "left" : "right";
    if (this.oars[key]) return;
    this.oars[key] = { id, drag: new DriveTracker(t) };
  }

  move(id: number, y: number, t: number): void {
    for (const key of ["left", "right"] as const) {
      const oar = this.oars[key];
      if (!oar || oar.id !== id) continue;
      const wasDriving = oar.drag.driving;
      const s = oar.drag.move(y, t);
      if (!wasDriving && oar.drag.driving && !this.anyDriving(key)) this.rushed = this.recoverySeat(t) > 0.15;
      this.peakSeat = Math.max(this.peakSeat, this.driveSeat());
      if (s) this.finish(key, s, t);
    }
  }

  up(id: number, t: number): void {
    for (const key of ["left", "right"] as const) {
      const oar = this.oars[key];
      if (!oar || oar.id !== id) continue;
      const s = oar.drag.end();
      this.oars[key] = null;
      if (s) this.finish(key, s, t);
      // A drag too short to be a stroke: the carro goes home
      else if (!this.done.left && !this.done.right && !this.oars.left?.drag.driving && !this.oars.right?.drag.driving) this.peakSeat = 0;
    }
  }

  cancel(): void {
    this.oars = { left: null, right: null };
    this.done = { left: null, right: null };
    this.ready = null;
    this.pressureNow = 0;
  }

  private anyDriving(except: "left" | "right"): boolean {
    const other = this.oars[except === "left" ? "right" : "left"];
    return !!other?.drag.driving;
  }

  private finish(key: "left" | "right", s: Stroke, t: number): void {
    this.done[key] = s;
    this.flush(t);
  }

  /** Pairs the two oars' strokes, or lets one go alone once the other cannot join it. */
  private flush(t: number): void {
    const { left, right } = this.done;
    if (!left && !right) return;
    const first = Math.min(left?.t ?? Infinity, right?.t ?? Infinity);
    const otherBusy = (key: "left" | "right") => !!this.oars[key]?.drag.driving;
    const waiting = (!left && otherBusy("left")) || (!right && otherBusy("right"));
    if (left && right) {
      this.emit(combineOars(left, right), t);
    } else if (!waiting || t - first > PAIR_WINDOW) {
      this.emit(combineOars(left, right), t);
    }
  }

  private emit(c: { stroke: Stroke | null; pressure: number }, t: number): void {
    this.done = { left: null, right: null };
    this.ready = { ...c, t };
    this.pressureNow = c.pressure;
    this.pressureUntil = t + PRESSURE_HOLD;
    if (c.stroke) {
      this.seatAtStroke = Math.max(this.peakSeat, this.recoverySeat(t));
      this.peakSeat = 0;
      this.lastStroke = t;
    }
  }

  private driveSeat(): number {
    return Math.max(this.oars.left?.drag.progress ?? 0, this.oars.right?.drag.progress ?? 0);
  }

  /**
   * Where the carro is: 0 at the stern (the catch, ready), 1 toward the bow
   * (end of the drive). It slides with the drive and comes back during the
   * recovery, in about the time a good rhythm leaves.
   */
  seat(t: number): number {
    return Math.max(this.driveSeat(), this.recoverySeat(t));
  }

  /** The carro on its way back after the last stroke (0 once it is home). */
  private recoverySeat(t: number): number {
    return this.seatAtStroke * Math.max(0, 1 - (t - this.lastStroke) / SEAT_RETURN);
  }

  /** Each oar handle's offset (reach units, ±1; 0 when free). */
  handles(): { left: number; right: number } {
    const at = (key: "left" | "right") => Math.max(-1, Math.min(1, this.oars[key]?.drag.y ?? 0));
    return { left: at("left"), right: at("right") };
  }

  /** This frame's orders (a stroke, ciar, and the turn while both oars drive or just after a stroke). */
  take(t: number): RowingOrders | null {
    if (this.done.left || this.done.right) this.flush(t);
    let orders: RowingOrders | null = null;
    if (this.ready) {
      const r = this.ready;
      this.ready = null;
      if (r.stroke && t - r.t <= STALE) {
        orders = { ...NO_ORDERS, strokeLeft: !r.stroke.back, backLeft: r.stroke.back, strength: r.stroke.strength, pressure: r.pressure };
      }
    }
    // While both oars drive, the one pulled further turns the shell already
    const l = this.oars.left?.drag;
    const r = this.oars.right?.drag;
    let pressure = t <= this.pressureUntil ? this.pressureNow : 0;
    if (l?.driving && r?.driving && l.dir === r.dir) {
      const diff = (l.progress - r.progress) / Math.max(0.2, (l.progress + r.progress) / 2);
      pressure = clamp(l.dir > 0 ? diff : -diff, -1, 1);
    } else if (l?.driving && r?.driving && l.dir !== r.dir) {
      pressure = l.dir < 0 ? -1 : 1;
    }
    if (orders) return { ...orders, pressure: orders.pressure || pressure };
    return pressure ? { ...NO_ORDERS, pressure } : null;
  }
}

/** Adds the touch rowing orders to the input from the keys (keys keep working). */
export function applyRowing(input: HandlingInput, orders: RowingOrders | null): HandlingInput {
  if (!orders) return input;
  const stroke = orders.strokeLeft || orders.strokeRight || orders.backLeft || orders.backRight;
  return {
    ...input,
    strokeLeft: input.strokeLeft || orders.strokeLeft,
    strokeRight: input.strokeRight || orders.strokeRight,
    backLeft: input.backLeft || orders.backLeft,
    backRight: input.backRight || orders.backRight,
    pressure: orders.pressure || input.pressure,
    strength: stroke ? orders.strength : input.strength,
  };
}

/** The touch rowing widget of each boat: the kayak's pala, the single's oars (others: none). */
export type RowingWidgetKind = "pala" | "remos";

export function rowingWidgetFor(boatId: string): RowingWidgetKind | null {
  return boatId === "kayak" ? "pala" : boatId === "single" ? "remos" : null;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
