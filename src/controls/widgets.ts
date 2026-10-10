/**
 * On-screen controls of the "Palanca y timón" scheme (finger or mouse):
 * - Palanca de mando: a vertical lever you drag; up is ahead, down is
 *   astern, with a detent at neutral. It stays where you leave it and shows
 *   the actual speed and, in slow zones, the limit.
 * - Rueda de timón: a wheel you turn by dragging around it. With the
 *   simple controls it returns to the middle when released; with the
 *   realistic handling of the big launches it stays where you leave it.
 * - Ruedita: a joystick for the thumb (dark glass base, glowing cyan rim, teal knob). Up/down is the throttle (it stays
 *   when you let go, a ring marks it), left/right the helm (it returns to
 *   the middle). The maths lives in joystick.ts.
 */
import { engagesThrottle, readStick, releaseStick } from "./joystick";

const TURN = (135 * Math.PI) / 180; // wheel lock: ±135° = full rudder

export class LeverWidget {
  readonly el: HTMLDivElement;
  private handle: HTMLDivElement;
  private fill: HTMLDivElement;
  private tick: HTMLDivElement;
  private limit: HTMLDivElement;
  private label: HTMLDivElement;
  private dragging = false;
  /** Positions it snaps to on release (e.g. the telegraph's five). */
  snaps: number[] | null = null;

  constructor(parent: HTMLElement, private onChange: (value: number) => void) {
    injectStyles();
    this.el = document.createElement("div");
    this.el.className = "lw";
    this.el.innerHTML = `
      <div class="lw-label"></div>
      <div class="lw-track">
        <div class="lw-mark lw-zero"></div>
        <div class="lw-fill"></div>
        <div class="lw-limit"></div>
        <div class="lw-tick"></div>
        <div class="lw-handle"></div>
      </div>
      <div class="lw-caption">Palanca</div>`;
    parent.appendChild(this.el);
    this.handle = this.el.querySelector(".lw-handle")!;
    this.fill = this.el.querySelector(".lw-fill")!;
    this.tick = this.el.querySelector(".lw-tick")!;
    this.limit = this.el.querySelector(".lw-limit")!;
    this.label = this.el.querySelector(".lw-label")!;
    const track = this.el.querySelector<HTMLDivElement>(".lw-track")!;
    const at = (e: PointerEvent) => {
      const r = track.getBoundingClientRect();
      let v = 1 - ((e.clientY - r.top) / r.height) * 2;
      v = Math.max(-1, Math.min(1, v));
      if (Math.abs(v) < 0.08) v = 0; // detent at neutral
      return v;
    };
    track.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragging = true;
      track.setPointerCapture(e.pointerId);
      this.onChange(at(e));
    });
    track.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      this.onChange(at(e));
    });
    const end = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.snaps) {
        const v = at(e);
        this.onChange(this.snaps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)));
      }
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
  }

  /** Lever and speed in -1..1; limit: allowed speed in a slow zone (or null). */
  show(value: number, speed: number, limit: number | null, label: string): void {
    const y = (v: number) => 50 + v * 50;
    this.handle.style.bottom = `${y(value)}%`;
    this.fill.style.bottom = `${Math.min(y(0), y(value))}%`;
    this.fill.style.height = `${Math.abs(value) * 50}%`;
    this.fill.classList.toggle("reverse", value < 0);
    this.tick.style.bottom = `${y(Math.max(-1, Math.min(1, speed)))}%`;
    this.limit.style.display = limit === null ? "none" : "block";
    if (limit !== null) this.limit.style.bottom = `${y(limit)}%`;
    this.el.classList.toggle("over", limit !== null && Math.abs(speed) > limit);
    if (this.label.textContent !== label) this.label.textContent = label;
  }

  setVisible(on: boolean): void {
    this.el.style.display = on ? "" : "none";
  }
}

export class WheelWidget {
  readonly el: HTMLDivElement;
  private wheel: SVGSVGElement;
  private angle = 0;
  private dragging = false;
  private grab = 0;
  private start = 0;
  /** Back to the middle when released (simple controls), or it stays (realistic wheel). */
  returnToCenter = true;
  /** -1..1 */
  value = 0;

  constructor(parent: HTMLElement) {
    injectStyles();
    this.el = document.createElement("div");
    this.el.className = "ww";
    const spokes = Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      const x = 50 + Math.cos(a) * 46;
      const y = 50 + Math.sin(a) * 46;
      const hx = 50 + Math.cos(a) * 57;
      const hy = 50 + Math.sin(a) * 57;
      return `<line x1="50" y1="50" x2="${x}" y2="${y}" /><line class="ww-handle" x1="${x}" y1="${y}" x2="${hx}" y2="${hy}" />`;
    }).join("");
    this.el.innerHTML = `
      <svg viewBox="-8 -8 116 116" class="ww-wheel" aria-label="Rueda de timón">
        <circle cx="50" cy="50" r="40" class="ww-rim" />
        <circle cx="50" cy="50" r="9" class="ww-hub" />
        ${spokes}
        <circle cx="50" cy="${50 - 40}" r="4" class="ww-top" />
      </svg>
      <div class="ww-caption">Timón</div>`;
    parent.appendChild(this.el);
    this.wheel = this.el.querySelector("svg")!;
    const centre = () => {
      const r = this.wheel.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const pointerAngle = (e: PointerEvent) => {
      const c = centre();
      return Math.atan2(e.clientY - c.y, e.clientX - c.x);
    };
    this.wheel.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragging = true;
      this.wheel.setPointerCapture(e.pointerId);
      this.grab = pointerAngle(e);
      this.start = this.angle;
    });
    this.wheel.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      let d = pointerAngle(e) - this.grab;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // Unwrap as the finger goes round
      this.grab += d;
      this.start += d;
      this.setAngle(this.start);
    });
    const end = () => {
      this.dragging = false;
    };
    this.wheel.addEventListener("pointerup", end);
    this.wheel.addEventListener("pointercancel", end);
  }

  private setAngle(a: number): void {
    this.angle = Math.max(-TURN, Math.min(TURN, a));
    this.value = this.angle / TURN;
    this.wheel.style.transform = `rotate(${this.angle}rad)`;
  }

  update(dt: number): number {
    if (!this.dragging && this.returnToCenter && this.angle !== 0) {
      const back = Math.sign(this.angle) * Math.min(Math.abs(this.angle), dt * 5);
      this.setAngle(this.angle - back);
    }
    return this.value;
  }

  reset(): void {
    this.setAngle(0);
  }

  setVisible(on: boolean): void {
    this.el.style.display = on ? "" : "none";
  }
}

/**
 * Base ~140 px (118 px on short screens), knob 45% of it: the knob centre
 * travels to just past the inner edge, so the knob rides on the glowing rim
 * at full deflection without leaving it. Measured live, so the CSS sets the size.
 */
const STICK_KNOB = 0.45;
const stickRadius = (base: number) => base * ((1 - STICK_KNOB) / 2 + 0.06);

/** The "Ruedita" joystick (see joystick.ts for the maths). */
export class StickWidget {
  readonly el: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private ring: HTMLDivElement;
  private dragging = false;
  private pointerId = -1;
  /** This touch has taken the throttle (see engagesThrottle). */
  private engaged = false;
  private throttle = 0;
  /** Helm, -1..1: zero when the finger is up. */
  steering = 0;
  /** Settle on the telegraph's five positions when released. */
  telegraph = false;

  constructor(parent: HTMLElement, private onThrottle: (value: number) => void) {
    injectStyles();
    this.el = document.createElement("div");
    this.el.className = "sw";
    this.el.innerHTML = `
      <div class="sw-base" aria-label="Ruedita">
        <div class="sw-inner"></div>
        <div class="sw-ring"></div>
        <div class="sw-knob"></div>
      </div>
      <div class="sw-caption">Ruedita</div>`;
    parent.appendChild(this.el);
    this.base = this.el.querySelector(".sw-base")!;
    this.knob = this.el.querySelector(".sw-knob")!;
    this.ring = this.el.querySelector(".sw-ring")!;
    const move = (e: PointerEvent) => {
      const r = this.base.getBoundingClientRect();
      const s = readStick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), stickRadius(r.width));
      this.steering = s.steering;
      // A sideways touch only steers; the throttle moves once the thumb clearly goes up or down
      this.engaged = engagesThrottle(this.engaged, s);
      if (this.engaged) {
        this.throttle = s.throttle;
        this.onThrottle(s.throttle);
      }
      this.placeKnob(s.knobX, s.knobY);
    };
    this.base.addEventListener("pointerdown", (e) => {
      if (this.dragging) return;
      e.preventDefault();
      e.stopPropagation();
      this.dragging = true;
      this.pointerId = e.pointerId;
      this.base.setPointerCapture(e.pointerId);
      this.knob.style.transition = "none";
      this.el.classList.add("active");
      this.engaged = false;
      move(e);
    });
    this.base.addEventListener("pointermove", (e) => {
      if (!this.dragging || e.pointerId !== this.pointerId) return;
      e.preventDefault();
      move(e);
    });
    const end = (e: PointerEvent) => {
      if (!this.dragging || e.pointerId !== this.pointerId) return;
      this.dragging = false;
      // Helm to the middle; the throttle stays (cruise), or settles on the telegraph
      const out = releaseStick(this.throttle, this.telegraph);
      this.steering = out.steering;
      if (out.throttle !== this.throttle) {
        this.throttle = out.throttle;
        this.onThrottle(out.throttle);
      }
      this.knob.style.transition = "transform 0.16s ease-out";
      this.el.classList.remove("active");
      this.placeKnob(0, 0);
    };
    this.base.addEventListener("pointerup", end);
    this.base.addEventListener("pointercancel", end);
  }

  private placeKnob(x: number, y: number): void {
    this.knob.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** The ring marks the actual throttle (-1..1), whoever moved it (keys, PARADA, telegraph). */
  show(value: number): void {
    // The lever may move without the stick (PARADA, keys): release keeps the real value
    if (!this.dragging) this.throttle = value;
    this.ring.style.transform = `translate(0px, ${-value * stickRadius(this.base.offsetWidth || 140)}px)`;
    this.ring.classList.toggle("reverse", value < 0);
  }

  setVisible(on: boolean): void {
    this.el.style.display = on ? "" : "none";
    if (!on) {
      this.dragging = false;
      this.steering = 0;
      this.el.classList.remove("active");
      this.placeKnob(0, 0);
    }
  }
}

let injected = false;
function injectStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = `
    .lw, .ww, .sw { position: fixed; z-index: 102; user-select: none; -webkit-user-select: none; touch-action: none; font-family: "Inter Variable", Inter, system-ui, sans-serif; }
    .lw { right: 22px; bottom: 26px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .lw-track { position: relative; width: 46px; height: 190px; border-radius: 23px; background: rgba(12, 26, 22, 0.55); border: 1px solid rgba(244, 239, 227, 0.25); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); cursor: ns-resize; touch-action: none; }
    .lw-mark { position: absolute; left: 6px; right: 6px; height: 2px; background: rgba(244, 239, 227, 0.55); bottom: 50%; }
    .lw-fill { position: absolute; left: 17px; right: 17px; background: #e9b44c; border-radius: 6px; }
    .lw-fill.reverse { background: #8fb3c9; }
    .lw-tick { position: absolute; left: 4px; right: 4px; height: 3px; margin-bottom: -1px; background: #fff; border-radius: 2px; box-shadow: 0 0 6px rgba(0,0,0,0.5); }
    .lw-limit { position: absolute; left: -6px; right: -6px; height: 0; border-top: 2px dashed #f4efe3; }
    .lw.over .lw-limit { border-top-color: #ff6b4a; }
    .lw.over .lw-tick { background: #ff6b4a; }
    .lw-handle { position: absolute; left: 3px; right: 3px; height: 28px; margin-bottom: -14px; border-radius: 14px; background: linear-gradient(#f4efe3, #cfc6b2); box-shadow: 0 3px 10px rgba(0,0,0,0.45); }
    .lw-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #f4efe3; text-shadow: 0 1px 4px rgba(0,0,0,0.7); white-space: nowrap; min-height: 12px; }
    .lw.over .lw-label { color: #ffb199; }
    .lw-caption, .ww-caption, .sw-caption { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244, 239, 227, 0.7); text-shadow: 0 1px 3px rgba(0,0,0,0.6); }
    .ww { left: 18px; bottom: 18px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .ww-wheel { width: 150px; height: 150px; cursor: grab; touch-action: none; transition: none; }
    .ww-rim { fill: none; stroke: #7a4b25; stroke-width: 7; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
    .ww-wheel line { stroke: #8a5a30; stroke-width: 4; stroke-linecap: round; }
    .ww-wheel line.ww-handle { stroke: #a8743f; stroke-width: 7; }
    .ww-hub { fill: #c8a24a; stroke: #6b3e1c; stroke-width: 2; }
    .ww-top { fill: #e9b44c; }
    .sw { left: 18px; bottom: 22px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    /* Ruedita: dark glass base with a glowing cyan rim, a big teal knob that follows the thumb */
    .sw-base { position: relative; width: 140px; height: 140px; border-radius: 50%; box-sizing: border-box; touch-action: none;
      background: radial-gradient(circle at 50% 45%, rgba(10, 34, 46, 0.5) 0%, rgba(5, 20, 30, 0.66) 62%, rgba(2, 12, 20, 0.78) 100%);
      border: 2px solid rgba(110, 225, 255, 0.9);
      box-shadow: 0 0 10px 1px rgba(70, 205, 255, 0.65), 0 0 26px 6px rgba(40, 150, 255, 0.28), inset 0 0 22px rgba(0, 0, 0, 0.6), inset 0 0 5px rgba(90, 215, 255, 0.45);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: box-shadow 0.15s; }
    .sw.active .sw-base { box-shadow: 0 0 14px 2px rgba(90, 220, 255, 0.85), 0 0 34px 9px rgba(40, 160, 255, 0.36), inset 0 0 22px rgba(0, 0, 0, 0.55), inset 0 0 7px rgba(110, 225, 255, 0.55); }
    .sw-inner { position: absolute; inset: 17%; border-radius: 50%; border: 1px solid rgba(120, 220, 255, 0.14); pointer-events: none; }
    .sw-knob { position: absolute; left: 27.5%; top: 27.5%; width: 45%; height: 45%; box-sizing: border-box; border-radius: 50%; pointer-events: none;
      background: radial-gradient(circle at 38% 30%, rgba(170, 250, 240, 0.72) 0%, rgba(60, 190, 195, 0.56) 42%, rgba(14, 104, 122, 0.6) 100%);
      border: 1.5px solid rgba(140, 238, 255, 0.85);
      box-shadow: 0 0 12px rgba(80, 225, 255, 0.6), 0 4px 10px rgba(0, 0, 0, 0.35), inset 0 -5px 9px rgba(0, 40, 60, 0.45), inset 0 3px 6px rgba(255, 255, 255, 0.28); }
    .sw.active .sw-knob { box-shadow: 0 0 18px rgba(100, 235, 255, 0.85), 0 4px 10px rgba(0, 0, 0, 0.35), inset 0 -5px 9px rgba(0, 40, 60, 0.45), inset 0 3px 6px rgba(255, 255, 255, 0.3); }
    .sw-ring { position: absolute; left: 24.5%; top: 24.5%; width: 51%; height: 51%; box-sizing: border-box; border-radius: 50%; border: 2px solid #e9b44c; box-shadow: 0 0 6px rgba(233, 180, 76, 0.55); pointer-events: none; transition: transform 0.12s linear; }
    .sw-ring.reverse { border-color: #8fd3ff; box-shadow: 0 0 6px rgba(143, 211, 255, 0.55); }
    body.menu-open .lw, body.menu-open .ww, body.menu-open .sw { visibility: hidden; }
    @media (max-height: 420px) { .lw-track { height: 150px; } .ww-wheel { width: 128px; height: 128px; } .sw-base { width: 118px; height: 118px; } .sw { bottom: 16px; } }
  `;
  document.head.appendChild(style);
}
