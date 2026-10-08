/**
 * Navigation rules of the Delta, as plain logic (no Babylon): each boat
 * type follows the ones that apply to it (see BoatSpec.rules).
 *
 * - keepRight: like on a road, boats keep to the starboard (right) half of
 *   the channel, so lanchas meet port to port.
 * - speedZones: reduced speed in arroyos and in front of docks.
 * - wakeCourtesy: slow down passing rowers and kayaks (handled with the
 *   rowing traffic, which knows where they are).
 * - takeWakeBowFirst: a kayak or rowing boat meets a passing lancha's wake
 *   with the bow, not broadside, or it can capsize.
 * - hugTheBank: small craft on big rivers stay near a bank and only leave
 *   it to cross straight to the other side.
 */
import type { BoatSpec, RuleId } from "../boat/boatTypes";

export type WaterTest = (x: number, z: number) => boolean;

/** World units (8 m): narrower channels are arroyos with reduced speed. */
export const ARROYO_WIDTH = 6;
/** Rivers at least this wide are where small craft must stay near a bank. */
export const BIG_RIVER_WIDTH = 14;
/** Max distance to the bank that counts as "near" for small craft. */
export const NEAR_BANK = 3;
/** Fraction of top speed allowed in reduced-speed zones. */
export const ZONE_SPEED = 0.45;
/** Distance to a dock's berth inside which the dock speed zone applies. */
export const DOCK_ZONE = 5;

export interface ChannelProbe {
  /** Distance to the bank on the port (left) and starboard (right) side. */
  port: number;
  starboard: number;
  width: number;
}

/** Measures the channel across the boat's heading (atan2(dx, dz) convention). */
export function probeChannel(isWater: WaterTest, x: number, z: number, heading: number, max = 30): ChannelProbe {
  // Starboard is (cos h, -sin h) for heading h, port the opposite
  const sx = Math.cos(heading);
  const sz = -Math.sin(heading);
  const reach = (dir: number) => {
    for (let t = 0.15; t < max; t += 0.15) {
      if (!isWater(x + sx * t * dir, z + sz * t * dir)) return t;
    }
    return max;
  };
  const starboard = reach(1);
  const port = reach(-1);
  return { port, starboard, width: port + starboard };
}

/** On the wrong (port) half of a channel wide enough to have two lanes. */
export function onWrongSide(p: ChannelProbe, boatWidth: number): boolean {
  if (p.width < Math.max(ARROYO_WIDTH, boatWidth * 6)) return false;
  return p.starboard - p.port > p.width * 0.2;
}

export type SpeedZone = "arroyo" | "muelle" | null;

export function speedZoneAt(p: ChannelProbe, distanceToDock: number): SpeedZone {
  if (distanceToDock < DOCK_ZONE) return "muelle";
  if (p.width < ARROYO_WIDTH) return "arroyo";
  return null;
}

export type WakeMeeting = "bow" | "stern" | "broadside";

/**
 * How a small boat meets the wake of a lancha passing at (tx, tz): the
 * waves come from the lancha's direction. Bow (or stern) into them is
 * safe; broadside rolls the boat.
 */
export function wakeMeeting(x: number, z: number, heading: number, tx: number, tz: number): WakeMeeting {
  const toWake = Math.atan2(tx - x, tz - z);
  let d = Math.abs(toWake - heading) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  if (d < (50 * Math.PI) / 180) return "bow";
  if (d > (130 * Math.PI) / 180) return "stern";
  return "broadside";
}

export interface RuleEvent {
  rule: RuleId;
  /** "warn" first, "fine" if it goes on. */
  kind: "warn" | "fine";
  message: string;
  /** Points lost (or seconds added in time trials). */
  penalty: number;
}

export interface RuleInputs {
  x: number;
  z: number;
  heading: number;
  /** Signed speed, world units per frame. */
  speed: number;
  probe: ChannelProbe;
  distanceToDock: number;
  /** Lanchas passing close enough to throw a wake at us. */
  wakes: Array<{ x: number; z: number }>;
}

const WARN_AFTER: Partial<Record<RuleId, number>> = { keepRight: 3, hugTheBank: 7 };
const FINE_AFTER: Partial<Record<RuleId, number>> = { keepRight: 7, hugTheBank: 12 };
const COOLDOWN = 6;

/**
 * Applies a boat's rules frame by frame. Lasting faults (wrong side, far
 * from the bank) warn after a grace time and fine if they go on; instant
 * ones (speeding in a zone, a wake broadside) fine right away. Each rule
 * then rests for a few seconds so one mistake costs once.
 */
export class RuleBook {
  private timers = new Map<RuleId, number>();
  private cooldown = new Map<RuleId, number>();
  private warned = new Set<RuleId>();

  constructor(private spec: BoatSpec) {}

  has(rule: RuleId): boolean {
    return this.spec.rules.includes(rule);
  }

  update(dt: number, s: RuleInputs): RuleEvent[] {
    const events: RuleEvent[] = [];
    for (const [r, t] of this.cooldown) this.cooldown.set(r, Math.max(0, t - dt));
    const moving = Math.abs(s.speed) > this.spec.maxSpeed * 0.15;
    const ratio = Math.abs(s.speed) / this.spec.maxSpeed;

    if (this.has("keepRight")) {
      // Coming in to or leaving a dock you are at its bank, whichever side it is
      const nearDock = s.distanceToDock < DOCK_ZONE * 2.5;
      this.lasting(dt, "keepRight", moving && !nearDock && onWrongSide(s.probe, this.spec.width), events, {
        warn: "Navegá por la derecha del río",
        fine: "Multa: ibas por la mano contraria",
        penalty: 40,
      });
    }

    if (this.has("hugTheBank")) {
      const farFromBank =
        moving && s.probe.width >= BIG_RIVER_WIDTH && Math.min(s.probe.port, s.probe.starboard) > NEAR_BANK;
      this.lasting(dt, "hugTheBank", farFromBank, events, {
        warn: "En río ancho, quedate cerca de la costa o cruzá derecho",
        fine: "Demasiado tiempo en medio del río",
        penalty: 30,
      });
    }

    if (this.has("speedZones")) {
      const zone = speedZoneAt(s.probe, s.distanceToDock);
      if (zone && ratio > ZONE_SPEED && this.ready("speedZones")) {
        events.push({
          rule: "speedZones",
          kind: "fine",
          message: zone === "arroyo" ? "Multa: velocidad reducida en arroyos" : "Multa: despacio frente a los muelles",
          penalty: 50,
        });
        this.rest("speedZones");
      }
    }

    if (this.has("takeWakeBowFirst") && s.wakes.length > 0 && this.ready("takeWakeBowFirst")) {
      const w = s.wakes[0];
      const meeting = wakeMeeting(s.x, s.z, s.heading, w.x, w.z);
      if (meeting === "broadside") {
        events.push({ rule: "takeWakeBowFirst", kind: "fine", message: "¡La ola te agarró de costado! Recibila de proa", penalty: 60 });
      } else {
        events.push({ rule: "takeWakeBowFirst", kind: "warn", message: "Bien: ola recibida de proa", penalty: -20 });
      }
      this.rest("takeWakeBowFirst");
    }

    return events;
  }

  private lasting(
    dt: number,
    rule: RuleId,
    breaking: boolean,
    events: RuleEvent[],
    text: { warn: string; fine: string; penalty: number }
  ): void {
    if (!breaking) {
      this.timers.set(rule, 0);
      this.warned.delete(rule);
      return;
    }
    const t = (this.timers.get(rule) ?? 0) + dt;
    this.timers.set(rule, t);
    if (!this.warned.has(rule) && t >= (WARN_AFTER[rule] ?? 3)) {
      this.warned.add(rule);
      events.push({ rule, kind: "warn", message: text.warn, penalty: 0 });
    }
    if (t >= (FINE_AFTER[rule] ?? 7) && this.ready(rule)) {
      events.push({ rule, kind: "fine", message: text.fine, penalty: text.penalty });
      this.rest(rule);
      this.timers.set(rule, WARN_AFTER[rule] ?? 3);
    }
  }

  private ready(rule: RuleId): boolean {
    return (this.cooldown.get(rule) ?? 0) === 0;
  }

  private rest(rule: RuleId): void {
    this.cooldown.set(rule, COOLDOWN);
  }
}
