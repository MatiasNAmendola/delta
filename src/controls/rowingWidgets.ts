/**
 * On-screen rowing controls (touch), drawn in SVG; the gestures' logic is
 * pure and lives in rowingGestures.ts.
 * - PaddleWidget ("Pala", kayak): a double-bladed paddle across the bottom
 *   of the screen. Drag an end down to stroke on that side, up to back
 *   paddle; the paddle tilts with the fingers.
 * - OarsWidget ("Remos y carro", single scull): a handle per thumb near the
 *   bottom corners and the sliding seat between them.
 * Each blade end / oar handle has its own touch pad, so two thumbs work at
 * once and the middle of the screen stays free to drag the camera.
 */
import { OarsGesture, PaddleGesture, type RowingOrders } from "./rowingGestures";

const SVG = "http://www.w3.org/2000/svg";
const now = () => performance.now() / 1000;

/** Finger travel (px) for a full stroke: shorter on short (landscape phone) screens. */
const reach = () => (window.innerHeight <= 420 ? 64 : 84);

interface Pad {
  el: HTMLDivElement;
  side: -1 | 1;
}

/** Shared: a touch pad that reports (id, side, offset in reach units, time). */
function makePad(
  parent: HTMLElement,
  cls: string,
  side: -1 | 1,
  on: { down: (id: number, side: -1 | 1) => void; move: (id: number, y: number) => void; up: (id: number) => void }
): Pad {
  const el = document.createElement("div");
  el.className = `rw-pad ${cls}`;
  parent.appendChild(el);
  const starts = new Map<number, number>();
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    starts.set(e.pointerId, e.clientY);
    on.down(e.pointerId, side);
  });
  el.addEventListener("pointermove", (e) => {
    const y0 = starts.get(e.pointerId);
    if (y0 === undefined) return;
    e.preventDefault();
    on.move(e.pointerId, (e.clientY - y0) / reach());
  });
  const end = (e: PointerEvent) => {
    if (!starts.has(e.pointerId)) return;
    starts.delete(e.pointerId);
    on.up(e.pointerId);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  return { el, side };
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Eases a drawn value toward its target (the ends spring back when released). */
function ease(from: number, to: number, dt: number, rate = 18): number {
  return from + (to - from) * Math.min(1, dt * rate);
}

export interface RowingWidget {
  readonly el: HTMLDivElement;
  setVisible(on: boolean): void;
  /** This frame's orders for the boat, and redraws. */
  take(dt: number): RowingOrders | null;
}

export class PaddleWidget implements RowingWidget {
  readonly el: HTMLDivElement;
  private gesture = new PaddleGesture();
  private svg: SVGSVGElement;
  private shaft: SVGLineElement;
  private shaftHi: SVGLineElement;
  private blades: SVGGElement[];
  private hints: SVGGElement[];
  private shown = { left: 0, right: 0 };

  constructor(parent: HTMLElement) {
    injectStyles();
    this.el = document.createElement("div");
    this.el.className = "rw rw-pala";
    this.svg = svgEl("svg", { class: "rw-svg", "aria-label": "Pala" });
    this.el.appendChild(this.svg);
    this.hints = [-1, 1].map(() => {
      const g = svgEl("g", { class: "rw-hint" });
      g.appendChild(svgEl("circle", { r: 26 }));
      g.appendChild(svgEl("path", { d: "M-7 -4 L0 4 L7 -4", class: "rw-hint-arrow" }));
      this.svg.appendChild(g);
      return g;
    });
    this.shaft = svgEl("line", { class: "rw-shaft" });
    this.shaftHi = svgEl("line", { class: "rw-shaft-hi" });
    this.svg.appendChild(this.shaft);
    this.svg.appendChild(this.shaftHi);
    this.blades = [-1, 1].map((side) => {
      const g = svgEl("g", { class: "rw-blade" });
      // An asymmetric, slightly spooned blade pointing away from the shaft (local +x)
      const path = svgEl("path", { d: "M0 -6 C18 -9 40 -15 62 -12 C72 -10 74 10 62 13 C40 16 18 9 0 6 Z" });
      if (side < 0) path.setAttribute("transform", "scale(-1 1)");
      g.appendChild(path);
      g.appendChild(svgEl("line", { x1: side * 4, y1: 0, x2: side * 60, y2: 0, class: "rw-blade-rib" }));
      this.svg.appendChild(g);
      return g;
    });
    const caption = document.createElement("div");
    caption.className = "rw-caption";
    caption.textContent = "Pala";
    this.el.appendChild(caption);
    const on = {
      down: (id: number, side: -1 | 1) => this.gesture.down(id, side, now()),
      move: (id: number, y: number) => this.gesture.move(id, y, now()),
      up: (id: number) => this.gesture.up(id),
    };
    makePad(this.el, "rw-pad-left", -1, on);
    makePad(this.el, "rw-pad-right", 1, on);
    parent.appendChild(this.el);
    this.draw();
  }

  take(dt: number): RowingOrders | null {
    const target = this.gesture.ends();
    this.shown.left = ease(this.shown.left, target.left, dt);
    this.shown.right = ease(this.shown.right, target.right, dt);
    this.draw();
    return this.gesture.take();
  }

  private draw(): void {
    const w = window.innerWidth;
    const h = this.el.clientHeight || 230;
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const r = reach();
    const y0 = h - r - 26;
    const span = Math.min(w * 0.36, 330);
    const xl = w / 2 - span;
    const xr = w / 2 + span;
    const yl = y0 + this.shown.left * r;
    const yr = y0 + this.shown.right * r;
    for (const line of [this.shaft, this.shaftHi]) {
      line.setAttribute("x1", String(xl));
      line.setAttribute("y1", String(yl));
      line.setAttribute("x2", String(xr));
      line.setAttribute("y2", String(yr));
    }
    const angle = (Math.atan2(yr - yl, xr - xl) * 180) / Math.PI;
    const ends = [
      { x: xl, y: yl, v: this.shown.left },
      { x: xr, y: yr, v: this.shown.right },
    ];
    this.blades.forEach((g, i) => {
      g.setAttribute("transform", `translate(${ends[i].x} ${ends[i].y}) rotate(${angle})`);
      g.classList.toggle("on", Math.abs(ends[i].v) > 0.08);
      g.classList.toggle("back", ends[i].v < -0.08);
    });
    this.hints.forEach((g, i) => {
      g.setAttribute("transform", `translate(${ends[i].x} ${y0})`);
      g.style.opacity = Math.abs(ends[i].v) > 0.08 ? "0" : "";
    });
  }

  setVisible(on: boolean): void {
    this.el.style.display = on ? "" : "none";
    if (!on) {
      this.gesture.cancel();
      this.shown = { left: 0, right: 0 };
    }
    this.draw();
  }
}

export class OarsWidget implements RowingWidget {
  readonly el: HTMLDivElement;
  private gesture = new OarsGesture();
  private svg: SVGSVGElement;
  private oars: Array<{ shaft: SVGLineElement; grip: SVGRectElement }>;
  private seat: SVGRectElement;
  private rail: SVGGElement;
  private caption: HTMLDivElement;
  private shown = { left: 0, right: 0, seat: 0 };

  constructor(parent: HTMLElement) {
    injectStyles();
    this.el = document.createElement("div");
    this.el.className = "rw rw-remos";
    this.svg = svgEl("svg", { class: "rw-svg", "aria-label": "Remos y carro" });
    this.el.appendChild(this.svg);
    this.rail = svgEl("g", { class: "rw-rail" });
    this.rail.appendChild(svgEl("rect", { class: "rw-rail-bed", rx: 8 }));
    this.rail.appendChild(svgEl("line", { class: "rw-rail-track" }));
    this.rail.appendChild(svgEl("line", { class: "rw-rail-track" }));
    this.seat = svgEl("rect", { class: "rw-seat", rx: 7 });
    this.rail.appendChild(this.seat);
    this.svg.appendChild(this.rail);
    this.oars = [-1, 1].map(() => {
      const shaft = svgEl("line", { class: "rw-oar" });
      const grip = svgEl("rect", { class: "rw-grip", rx: 9 });
      this.svg.appendChild(shaft);
      this.svg.appendChild(grip);
      return { shaft, grip };
    });
    this.caption = document.createElement("div");
    this.caption.className = "rw-caption";
    this.caption.textContent = "Carro";
    this.el.appendChild(this.caption);
    const on = {
      down: (id: number, side: -1 | 1) => this.gesture.down(id, side, now()),
      move: (id: number, y: number) => this.gesture.move(id, y, now()),
      up: (id: number) => this.gesture.up(id, now()),
    };
    makePad(this.el, "rw-pad-left rw-pad-corner", -1, on);
    makePad(this.el, "rw-pad-right rw-pad-corner", 1, on);
    parent.appendChild(this.el);
    this.draw();
  }

  take(dt: number): RowingOrders | null {
    const t = now();
    const orders = this.gesture.take(t);
    const h = this.gesture.handles();
    this.shown.left = ease(this.shown.left, h.left, dt);
    this.shown.right = ease(this.shown.right, h.right, dt);
    this.shown.seat = ease(this.shown.seat, this.gesture.seat(t), dt, 12);
    this.draw();
    return orders;
  }

  private draw(): void {
    const w = window.innerWidth;
    const h = this.el.clientHeight || 230;
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const r = reach();
    const y0 = h - r - 26;
    const inset = Math.min(110, w * 0.13);
    const handles = [
      { x: inset, y: y0 + this.shown.left * r, side: -1 },
      { x: w - inset, y: y0 + this.shown.right * r, side: 1 },
    ];
    this.oars.forEach((o, i) => {
      const hd = handles[i];
      // The shaft runs from the handle out to the oarlock at the screen's edge: pulling the handle swings it
      const lockX = hd.side < 0 ? -10 : w + 10;
      const lockY = y0 - r * 0.9;
      const dx = lockX - hd.x;
      const dy = lockY - hd.y;
      const len = Math.hypot(dx, dy);
      o.shaft.setAttribute("x1", String(hd.x));
      o.shaft.setAttribute("y1", String(hd.y));
      o.shaft.setAttribute("x2", String(hd.x + (dx / len) * (len + 40)));
      o.shaft.setAttribute("y2", String(hd.y + (dy / len) * (len + 40)));
      const gw = 64;
      const gh = 18;
      o.grip.setAttribute("x", String(hd.x - gw / 2));
      o.grip.setAttribute("y", String(hd.y - gh / 2));
      o.grip.setAttribute("width", String(gw));
      o.grip.setAttribute("height", String(gh));
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI + (hd.side < 0 ? 180 : 0);
      o.grip.setAttribute("transform", `rotate(${angle} ${hd.x} ${hd.y})`);
      const v = i === 0 ? this.shown.left : this.shown.right;
      o.grip.classList.toggle("on", Math.abs(v) > 0.08);
    });
    // The carro: a seat on two rails between the thumbs; up the screen is toward the bow
    const railH = Math.min(120, h - 40);
    const railW = 40;
    const rx = w / 2 - railW / 2;
    const ry = h - railH - 22;
    const bed = this.rail.querySelector<SVGRectElement>(".rw-rail-bed")!;
    bed.setAttribute("x", String(rx));
    bed.setAttribute("y", String(ry));
    bed.setAttribute("width", String(railW));
    bed.setAttribute("height", String(railH));
    this.rail.querySelectorAll<SVGLineElement>(".rw-rail-track").forEach((l, i) => {
      const x = rx + (i === 0 ? 11 : railW - 11);
      l.setAttribute("x1", String(x));
      l.setAttribute("x2", String(x));
      l.setAttribute("y1", String(ry + 6));
      l.setAttribute("y2", String(ry + railH - 6));
    });
    const seatH = 24;
    const travel = railH - seatH - 8;
    this.seat.setAttribute("x", String(rx + 3));
    this.seat.setAttribute("width", String(railW - 6));
    this.seat.setAttribute("height", String(seatH));
    this.seat.setAttribute("y", String(ry + 4 + travel * (1 - Math.max(0, Math.min(1, this.shown.seat)))));
    const rushed = this.gesture.rushed && this.shown.seat > 0.05;
    this.seat.classList.toggle("rushed", rushed);
    const text = rushed ? "Carro · ¡apurado!" : "Carro";
    if (this.caption.textContent !== text) this.caption.textContent = text;
  }

  setVisible(on: boolean): void {
    this.el.style.display = on ? "" : "none";
    if (!on) {
      this.gesture.cancel();
      this.shown = { left: 0, right: 0, seat: 0 };
    }
    this.draw();
  }
}

let injected = false;
function injectStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = `
    .rw { position: fixed; left: 0; right: 0; bottom: 0; height: 230px; z-index: 102; pointer-events: none; user-select: none; -webkit-user-select: none; font-family: "Inter Variable", Inter, system-ui, sans-serif; }
    .rw-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
    .rw-pad { position: absolute; bottom: 0; height: 100%; width: 180px; pointer-events: auto; touch-action: none; }
    .rw-pala .rw-pad-left { left: calc(50% - min(36vw, 330px) - 90px); }
    .rw-pala .rw-pad-right { left: calc(50% + min(36vw, 330px) - 90px); }
    .rw-remos .rw-pad-left { left: 0; width: min(34vw, 240px); }
    .rw-remos .rw-pad-right { right: 0; width: min(34vw, 240px); }
    .rw-caption { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244, 239, 227, 0.75); text-shadow: 0 1px 3px rgba(0,0,0,0.7); white-space: nowrap; }
    /* Pala: carbon shaft, yellow blades */
    .rw-shaft { stroke: #1d2326; stroke-width: 9; stroke-linecap: round; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.45)); }
    .rw-shaft-hi { stroke: rgba(255,255,255,0.22); stroke-width: 2; stroke-linecap: round; transform: translateY(-2px); }
    .rw-blade path { fill: #f2b33d; stroke: #8a5a12; stroke-width: 2; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.45)); }
    .rw-blade-rib { stroke: rgba(120, 75, 10, 0.6); stroke-width: 2; }
    .rw-blade.on path { fill: #ffd36a; filter: drop-shadow(0 0 8px rgba(255, 210, 110, 0.85)); }
    .rw-blade.back path { fill: #9fd8ff; stroke: #2f6d92; filter: drop-shadow(0 0 8px rgba(140, 210, 255, 0.85)); }
    .rw-hint circle { fill: rgba(12, 26, 22, 0.35); stroke: rgba(244, 239, 227, 0.45); stroke-width: 1.5; stroke-dasharray: 4 4; }
    .rw-hint-arrow { fill: none; stroke: rgba(244, 239, 227, 0.75); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; transform: translateY(14px); }
    .rw-hint { transition: opacity 0.2s; }
    /* Remos y carro: wooden grips, white shafts, a seat on rails */
    .rw-oar { stroke: #f1ece0; stroke-width: 7; stroke-linecap: round; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.45)); }
    .rw-grip { fill: #b77a3e; stroke: #5c3713; stroke-width: 2; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5)); }
    .rw-grip.on { fill: #d99a55; filter: drop-shadow(0 0 8px rgba(255, 200, 120, 0.8)); }
    .rw-rail-bed { fill: rgba(12, 26, 22, 0.55); stroke: rgba(244, 239, 227, 0.3); stroke-width: 1; }
    .rw-rail-track { stroke: rgba(244, 239, 227, 0.55); stroke-width: 2; }
    .rw-seat { fill: #e9e2d0; stroke: #6d6656; stroke-width: 1.5; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); }
    .rw-seat.rushed { fill: #ffb35c; stroke: #8a4a10; }
    body.menu-open .rw { visibility: hidden; }
    @media (max-height: 420px) { .rw { height: 190px; } }
  `;
  document.head.appendChild(style);
}
