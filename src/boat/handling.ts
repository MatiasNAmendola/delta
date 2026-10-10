/**
 * Realistic handling (optional "Realista" mode, ADR 0013): each boat is
 * driven the way it is in the Delta, from docs/investigacion/02-maniobra-
 * y-controles.md (reviewed). Pure, so it can be tested.
 *
 * - Inboard launches (lancha colectiva, clásica): a wheel that turns at a
 *   limited rate and stays where you leave it, and a single lever with five
 *   positions (Atrás toda, Atrás, Neutro, Avante, Avante toda). Shifting
 *   ahead/astern goes through neutral with a pause; the diesel spools up
 *   slowly. The rudder only steers with water flowing past it (way on, or
 *   the propeller's wash), and going astern the propeller walks the stern.
 * - Outboards: wheel + single lever with an idle zone (runabout, RIB), or
 *   a tiller (fishing boat): push the tiller to port and the bow goes to
 *   starboard. The motor itself steers by its thrust.
 * - Jet ski: throttle trigger and handlebar; no throttle, no steering.
 * - Kayak: a stroke on each side; alternate to go straight, the same side
 *   turns away from it, a back stroke brakes and turns towards it.
 * - Single scull: strokes in rhythm (too early is weak), more pressure on
 *   one oar turns, "ciar" backs water.
 * - Bote de travesía: you are the coxswain: rudder, and the crew's rate
 *   (strokes per minute), "¡Ciar!" to back.
 *
 * Speeds in world units per second, yaw rates in radians per second
 * (positive = to starboard, as headings grow clockwise).
 */
import type { BoatSpec } from "./boatTypes";
import { coastToward } from "./coasting";

export type HandlingKind = "rueda" | "volante" | "cana" | "moto" | "kayak" | "single" | "timonel";

export function handlingKind(spec: BoatSpec): HandlingKind {
  switch (spec.id) {
    case "colectiva":
    case "clasica":
      return "rueda";
    case "pesca":
      return "cana";
    case "moto":
      return "moto";
    case "kayak":
      return "kayak";
    case "single":
      return "single";
    case "travesia":
      return "timonel";
    default:
      return "volante";
  }
}

export interface HandlingInput {
  /** Lever (-1..1): telegraph / single lever / crew rate; jet ski: trigger (1) or brake (-1). */
  lever: number;
  /** Helm (-1..1): turn the wheel this way (rueda) or put the tiller/handlebar/rudder here. */
  helm: number;
  /** Strokes started this frame (kayak: per side; single: both oars). */
  strokeLeft: boolean;
  strokeRight: boolean;
  backLeft: boolean;
  backRight: boolean;
  /** Single scull: more pressure on one side while it is held (-1 left turn, 1 right turn). */
  pressure: number;
  /** The helm is a wheel position (on-screen wheel), not "turn it while held". */
  helmIsPosition?: boolean;
  /**
   * How hard this frame's stroke is pulled (0..1, default 1): the touch pala
   * and remos measure it from the length and speed of the drag (rowingGestures.ts).
   */
  strength?: number;
}

/** The fastest racing rate of a single scull (36 strokes/min): a quicker stroke comes out weak. */
export const SCULL_MIN_INTERVAL = 60 / 36;

export const NO_INPUT: HandlingInput = { lever: 0, helm: 0, strokeLeft: false, strokeRight: false, backLeft: false, backRight: false, pressure: 0 };

export interface HandlingOutput {
  /** Forward speed (units/s, negative astern) and yaw rate (rad/s). */
  speed: number;
  yawRate: number;
  /** -1..1, for visuals and heel. */
  rudder: number;
  /** 0..1, how hard the engine or crew works (energy, animation). */
  effort: number;
}

/** What the HUD shows about the controls. */
export interface HandlingStatus {
  label: string;
  /** -1..1 shown on the lever gauge. */
  lever: number;
  /** -1..1 wheel / tiller / rudder position. */
  helm: number;
  gear: -1 | 0 | 1;
  /** Seconds left of the pause in neutral before the gear engages. */
  shifting: number;
  /** Strokes per minute (paddles and oars). */
  cadence: number;
}

/** Telegraph positions of the inboard launches. */
export const TELEGRAPH = ["Atrás toda", "Atrás", "Neutro", "Avante", "Avante toda"];

interface Tuning {
  /** Rudder travel per second (wheel: lock to lock in 2 / rate seconds). */
  helmRate: number;
  /** Seconds of the pause in neutral when shifting. */
  neutralPause: number;
  /** Engine thrust change per second. */
  spool: number;
  /** Yaw response time constant (s): big hulls answer slowly. */
  yawLag: number;
  /** Stern walk going astern (rad/s at full astern thrust, standing still). */
  propWalk: number;
  /** Thrust while idling in gear (fraction). */
  idle: number;
  /** Lever travel with the engine at idle (single-lever controls). */
  idleZone: number;
}

const TUNING: Record<"rueda" | "volante" | "cana" | "moto", Tuning> = {
  // Diesel with a reversing gear: 1-3 s pause in neutral, slow spool, strong walk astern
  rueda: { helmRate: 0.65, neutralPause: 1.6, spool: 0.45, yawLag: 1.1, propWalk: 0.35, idle: 0.12, idleZone: 0 },
  volante: { helmRate: 2.2, neutralPause: 0.7, spool: 1.6, yawLag: 0.35, propWalk: 0.08, idle: 0.08, idleZone: 0.15 },
  cana: { helmRate: 3.5, neutralPause: 0.6, spool: 1.8, yawLag: 0.25, propWalk: 0.06, idle: 0.08, idleZone: 0 },
  moto: { helmRate: 6, neutralPause: 0.3, spool: 3.5, yawLag: 0.18, propWalk: 0, idle: 0, idleZone: 0 },
};

export class Handling {
  readonly kind: HandlingKind;
  private v = 0;
  private yaw = 0;
  private rudder = 0;
  private gear: -1 | 0 | 1 = 0;
  private shift = 0;
  private thrust = 0;
  private time = 0;
  private lastStroke = -10;
  private strokes: number[] = [];
  private nextSide: -1 | 1 = -1;
  private crewTimer = 0;
  private readonly top: number;
  private readonly maxYaw: number;

  constructor(private spec: BoatSpec, turnScale = 0.6) {
    this.kind = handlingKind(spec);
    this.top = spec.maxSpeed * 60;
    this.maxYaw = spec.turnSpeed * turnScale * 60;
  }

  /** Engine/crew speed and turn for this frame. `energy` (0..1) tires human crews. */
  update(dt: number, input: HandlingInput, energy = 1): HandlingOutput {
    this.time += dt;
    switch (this.kind) {
      case "kayak":
        return this.paddle(dt, input, energy);
      case "single":
        return this.scull(dt, input, energy);
      case "timonel":
        return this.cox(dt, input, energy);
      default:
        return this.motor(dt, input, TUNING[this.kind]);
    }
  }

  status(): HandlingStatus {
    const human = this.kind === "kayak" || this.kind === "single" || this.kind === "timonel";
    const cadence = this.cadence();
    let label: string;
    if (this.kind === "rueda") label = this.shift > 0 ? "Neutro…" : TELEGRAPH[Math.round(this.leverShown * 2) + 2];
    else if (this.kind === "moto") label = this.thrust > 0.05 ? "Gas" : this.thrust < -0.05 ? "Reversa" : "Sin gas";
    else if (human) label = this.kind === "timonel" && this.crewRate < 0 ? "¡Ciar!" : cadence > 0 ? `${Math.round(cadence)} pal/min` : "Quietos";
    else label = this.shift > 0 ? "Neutro…" : this.gear === 0 ? "Neutro" : this.gear < 0 ? "Atrás" : `${Math.round(Math.abs(this.thrust) * 100)}%`;
    return { label, lever: this.leverShown, helm: this.rudder, gear: this.gear, shifting: this.shift, cadence };
  }

  private leverShown = 0;
  private crewRate = 0;

  // --- Motor boats --------------------------------------------------------

  private motor(dt: number, input: HandlingInput, t: Tuning): HandlingOutput {
    const top = this.top;
    this.leverShown = input.lever;
    // Helm: the wheel turns while held and stays; tiller, handlebar and outboard wheels go where you put them
    if (this.kind === "rueda" && !input.helmIsPosition) {
      this.rudder = clamp(this.rudder + input.helm * t.helmRate * dt, -1, 1);
    } else {
      const target = this.kind === "cana" ? -input.helm : input.helm;
      this.rudder += clamp(target - this.rudder, -t.helmRate * dt, t.helmRate * dt);
    }

    // Gear and throttle from the lever
    let wantGear: -1 | 0 | 1;
    let throttle: number;
    if (this.kind === "moto") {
      wantGear = input.lever > 0.05 ? 1 : input.lever < -0.05 ? -1 : 0;
      throttle = Math.abs(input.lever);
    } else {
      const dead = 0.12;
      wantGear = input.lever > dead ? 1 : input.lever < -dead ? -1 : 0;
      throttle = Math.max(0, (Math.abs(input.lever) - Math.max(dead, t.idleZone)) / (1 - Math.max(dead, t.idleZone)));
    }
    if (wantGear !== this.gear) {
      if (this.gear !== 0) {
        // Through neutral first, and wait there
        this.gear = 0;
        this.shift = t.neutralPause;
      } else if (this.shift <= 0) {
        this.gear = wantGear;
      }
    }
    this.shift = Math.max(0, this.shift - dt);
    if (this.gear !== 0 && this.gear !== wantGear) this.gear = 0;
    const thrustTarget = this.gear === 0 ? 0 : this.gear * (t.idle + (1 - t.idle) * throttle);
    this.thrust += clamp(thrustTarget - this.thrust, -t.spool * dt, t.spool * dt);
    if (this.gear === 0 && Math.abs(this.thrust) < 0.02) this.thrust = 0;

    // Speed: thrust against drag; astern tops at the boat's reverse fraction
    const limit = this.thrust >= 0 ? this.thrust * top : this.thrust * top * this.spec.reverse;
    // Pushing against the way (astern while going ahead) brakes harder
    const against = Math.sign(this.thrust) !== Math.sign(this.v) && Math.abs(this.v) > 0.01 && Math.abs(this.thrust) > 0.02;
    if (!against && Math.abs(limit) <= Math.abs(this.v)) {
      // Neutral or easing off: the hull keeps its way (coasting.ts)
      this.v = coastToward(this.v, limit, dt, this.spec.coastTime, top * 0.004, top);
    } else {
      const k = (Math.abs(this.thrust) > 0.02 ? this.spec.acceleration : this.spec.deceleration) * 60 / Math.max(1e-6, this.spec.maxSpeed);
      this.v += (limit - this.v) * Math.min(1, k * (against ? 1.8 : 1) * dt);
    }

    // Steering needs water past the rudder: way on, or the propeller's wash
    const wash = this.kind === "moto" ? Math.abs(this.thrust) * top * 0.9 : Math.abs(this.thrust) * top * (this.kind === "rueda" ? 0.3 : 0.45);
    const offThrottle = this.kind === "moto" ? 0.15 * Math.min(1, Math.abs(this.v) / top) * top : Math.abs(this.v);
    const flow = (this.kind === "moto" ? 0 : Math.abs(this.v)) + wash + (this.kind === "moto" ? offThrottle : 0);
    const effect = Math.min(1, (flow / (0.35 * top)) ** 2);
    // Astern the rudder works the other way round
    const direction = this.v < -0.05 * top || (this.thrust < 0 && this.v <= 0.05 * top) ? -1 : 1;
    let yawTarget = this.rudder * effect * this.maxYaw * direction;
    // Prop walk: astern the stern goes to port (right-handed propeller), the bow to starboard
    if (this.thrust < 0) yawTarget += t.propWalk * -this.thrust * (1 - Math.min(1, Math.abs(this.v) / top));
    this.yaw += (yawTarget - this.yaw) * Math.min(1, dt / t.yawLag);
    return { speed: this.v, yawRate: this.yaw, rudder: this.rudder, effort: Math.abs(this.thrust) };
  }

  // --- Paddles and oars -----------------------------------------------------

  private cadence(): number {
    // Strokes in the last 6 s
    const recent = this.strokes.filter((s) => this.time - s < 6);
    if (recent.length < 2) return recent.length ? 0 : 0;
    return ((recent.length - 1) / Math.max(0.5, recent[recent.length - 1] - recent[0])) * 60;
  }

  private stroke(): void {
    this.strokes.push(this.time);
    if (this.strokes.length > 12) this.strokes.shift();
    this.lastStroke = this.time;
  }

  /** Kayak: ~60-70 strokes/min cruising (one per side, alternating). */
  private paddle(dt: number, input: HandlingInput, energy: number): HandlingOutput {
    const top = this.top;
    const drag = 0.8; // 1/s
    // Impulse that gives ~85% of top speed at 65 strokes/min
    const impulse = (drag * top * 0.85) / (65 / 60);
    const ready = this.time - this.lastStroke > 0.32;
    const pull = clamp(input.strength ?? 1, 0, 1);
    const power = (0.4 + 0.6 * energy) * pull;
    // Slow, a stroke turns more (it becomes a sweep); fast, it mostly drives
    const sweep = 1.3 - 0.7 * Math.min(1, Math.abs(this.v) / top);
    // ~18° per stroke from rest, ~8° under way
    const yawKick = this.maxYaw * 0.2;
    if (ready && (input.strokeLeft || input.strokeRight)) {
      const side = input.strokeLeft ? -1 : 1;
      this.v += impulse * power;
      this.yaw += -side * yawKick * sweep * (0.5 + 0.5 * pull); // left stroke turns the bow to starboard
      this.nextSide = side > 0 ? -1 : 1;
      this.stroke();
    } else if (ready && (input.backLeft || input.backRight)) {
      const side = input.backLeft ? -1 : 1;
      this.v -= impulse * power * 0.7;
      this.yaw += side * yawKick * 0.8 * sweep * (0.5 + 0.5 * pull);
      this.stroke();
    }
    this.v -= this.v * drag * dt;
    this.v = clamp(this.v, -top * this.spec.reverse, top);
    this.yaw *= Math.exp(-dt / 0.55);
    const effort = this.time - this.lastStroke < 1.2 ? 1 : 0;
    this.leverShown = Math.min(1, this.cadence() / 70);
    return { speed: this.v, yawRate: this.yaw, rudder: clamp(this.yaw / this.maxYaw, -1, 1), effort };
  }

  /** Single scull: 18-32 strokes/min; each stroke needs its recovery. */
  private scull(dt: number, input: HandlingInput, energy: number): HandlingOutput {
    const top = this.top;
    const drag = 0.35;
    const minInterval = SCULL_MIN_INTERVAL;
    const pull = clamp(input.strength ?? 1, 0, 1);
    const impulse = (drag * top) / (32 / 60);
    const since = this.time - this.lastStroke;
    const stroke = input.strokeLeft || input.strokeRight;
    if (stroke && since > 0.6) {
      // Rushing the recovery: a short, weak stroke
      const timing = Math.min(1, (since / minInterval) ** 2);
      this.v += impulse * timing * (0.4 + 0.6 * energy) * pull;
      this.stroke();
    } else if ((input.backLeft || input.backRight) && since > 0.6) {
      this.v -= impulse * 0.6 * pull;
      this.stroke();
    }
    // Pressure on one oar during the drive turns the shell
    const driving = this.time - this.lastStroke < 0.8;
    const turn = input.pressure * this.maxYaw * (driving ? 1 : 0.35) * Math.min(1, 0.3 + Math.abs(this.v) / top);
    this.yaw += (turn - this.yaw) * Math.min(1, dt / 0.6);
    this.v -= this.v * drag * dt;
    this.v = clamp(this.v, -top * this.spec.reverse, top * 1.1);
    this.leverShown = Math.min(1, this.cadence() / 36);
    // Sitting still before any stroke is no effort (the regatta's false start reads it)
    return { speed: this.v, yawRate: this.yaw, rudder: input.pressure, effort: driving ? 1 : this.time - this.lastStroke < 4 ? 0.2 : 0 };
  }

  /** Coxswain of a touring four: rudder and the crew's rate; negative rate backs water. */
  private cox(dt: number, input: HandlingInput, energy: number): HandlingOutput {
    const top = this.top;
    const drag = 0.45;
    // Lever: 0 = stop rowing, up to 30 strokes/min; below zero "¡Ciar!"
    this.crewRate = input.lever >= 0 ? (input.lever < 0.1 ? 0 : 16 + 14 * input.lever) : -18;
    this.leverShown = input.lever;
    this.crewTimer -= dt;
    if (this.crewRate !== 0 && this.crewTimer <= 0) {
      const impulse = (drag * top) / (28 / 60);
      this.v += Math.sign(this.crewRate) * impulse * (this.crewRate < 0 ? 0.6 : 0.4 + 0.6 * energy);
      this.crewTimer = 60 / Math.abs(this.crewRate);
      this.stroke();
    }
    if (this.crewRate === 0) this.crewTimer = Math.min(this.crewTimer, 0.4);
    this.v -= this.v * drag * dt;
    this.v = clamp(this.v, -top * this.spec.reverse, top * 1.05);
    // The rudder: goes where the coxswain puts it, steers only with way on
    this.rudder += clamp(input.helm - this.rudder, -2 * dt, 2 * dt);
    const effect = Math.min(1, (Math.abs(this.v) / (0.4 * top)) ** 2);
    const yawTarget = this.rudder * effect * this.maxYaw * (this.v < 0 ? -1 : 1);
    this.yaw += (yawTarget - this.yaw) * Math.min(1, dt / 0.7);
    return { speed: this.v, yawRate: this.yaw, rudder: this.rudder, effort: this.crewRate !== 0 ? 1 : 0 };
  }

  /** After a collision or teleport. */
  scaleSpeed(factor: number): void {
    this.v *= factor;
  }

  reset(): void {
    this.v = 0;
    this.yaw = 0;
    this.thrust = 0;
    this.gear = 0;
    this.shift = 0;
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
