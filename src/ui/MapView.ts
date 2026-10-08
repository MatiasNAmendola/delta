import { gsap } from "gsap";
import type { WorldDoc } from "../world/WorldDoc";
import type { WorldLayout } from "../world/layout/worldLayout";
import { METERS_PER_UNIT } from "../utils/constants";

/**
 * The map: a small north-up card that follows the boat and, when tapped,
 * a full-screen chart with river names and stops that can be dragged and
 * pinched (or wheel-zoomed). Water comes from the world layout's grid, so
 * the map shows exactly the navigable water.
 */
export interface MapMarker {
  x: number;
  z: number;
  label: string;
}

const MINI = 136;
/** World units shown across the small map. */
const MINI_SPAN = 260;

export class MapView {
  private base: HTMLCanvasElement;
  private mini: HTMLCanvasElement;
  private miniCtx: CanvasRenderingContext2D;
  private root: HTMLDivElement;
  private big: HTMLCanvasElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private boat = { x: 0, z: 0, heading: 0 };
  private target: MapMarker | null = null;
  /** Big map view: center (world) and world units per CSS pixel. */
  private view = { x: 0, z: 0, scale: 4 };
  private labels: Array<{ name: string; x: number; z: number; weight: number }>;
  onToggle: (open: boolean) => void = () => {};

  constructor(private world: WorldDoc, layout: WorldLayout) {
    this.base = renderBase(layout);
    this.labels = riverLabels(world);
    injectStyles();
    this.root = document.createElement("div");
    this.root.id = "minimap";
    this.root.setAttribute("role", "button");
    this.root.setAttribute("aria-label", "Abrir el mapa");
    this.root.tabIndex = 0;
    this.mini = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mini.width = this.mini.height = MINI * dpr;
    this.root.appendChild(this.mini);
    const hint = document.createElement("span");
    hint.className = "map-hint";
    hint.textContent = "Mapa";
    this.root.appendChild(hint);
    document.body.appendChild(this.root);
    this.miniCtx = this.mini.getContext("2d")!;
    this.miniCtx.scale(dpr, dpr);
    const open = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.open();
    };
    this.root.addEventListener("click", open);
    this.root.addEventListener("touchend", open);
    this.root.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && open(e));
  }

  update(x: number, z: number, heading: number, target: MapMarker | null): void {
    this.boat = { x, z, heading };
    this.target = target;
    this.drawMini();
    if (this.big) this.drawBig();
  }

  get isOpen(): boolean {
    return this.overlay !== null;
  }

  private worldToBase(x: number, z: number): [number, number] {
    const s = this.world.world.size;
    // North (+z) up
    return [((x + s / 2) / s) * this.base.width, (1 - (z + s / 2) / s) * this.base.height];
  }

  private drawMini(): void {
    const ctx = this.miniCtx;
    const unitPx = this.base.width / this.world.world.size;
    const [bx, by] = this.worldToBase(this.boat.x, this.boat.z);
    const span = MINI_SPAN * unitPx;
    ctx.clearRect(0, 0, MINI, MINI);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, bx - span / 2, by - span / 2, span, span, 0, 0, MINI, MINI);
    const toMini = (x: number, z: number): [number, number] => {
      const [px, py] = this.worldToBase(x, z);
      return [((px - (bx - span / 2)) / span) * MINI, ((py - (by - span / 2)) / span) * MINI];
    };
    if (this.target) {
      const [tx, ty] = toMini(this.target.x, this.target.z);
      const inside = tx > 6 && tx < MINI - 6 && ty > 6 && ty < MINI - 6;
      if (inside) drawTarget(ctx, tx, ty, 4);
      else drawEdgeArrow(ctx, MINI / 2, MINI / 2, tx, ty, MINI);
    }
    drawBoat(ctx, MINI / 2, MINI / 2, this.boat.heading, 1);
  }

  private open(): void {
    if (this.overlay) return;
    this.view = { x: this.boat.x, z: this.boat.z, scale: 2.2 };
    const overlay = document.createElement("div");
    overlay.id = "mapOverlay";
    overlay.innerHTML = `
      <canvas></canvas>
      <div class="map-top">
        <div class="map-title"><b>Delta de Tigre</b><span>Tocá y arrastrá · pellizcá para acercar</span></div>
        <button type="button" class="map-btn" data-act="center">Centrar</button>
        <button type="button" class="map-btn map-close" data-act="close" aria-label="Cerrar el mapa">✕</button>
      </div>
      <div class="map-zoom">
        <button type="button" class="map-btn" data-act="in" aria-label="Acercar">+</button>
        <button type="button" class="map-btn" data-act="out" aria-label="Alejar">−</button>
      </div>
      <div class="map-scale"><i></i><span></span></div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.big = overlay.querySelector("canvas")!;
    this.resizeBig();
    this.bindGestures(this.big);
    overlay.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === "close") this.close();
        else if (act === "center") this.animateView(this.boat.x, this.boat.z, this.view.scale);
        else this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, act === "in" ? 0.6 : 1 / 0.6, true);
      })
    );
    window.addEventListener("resize", this.resizeBig);
    window.addEventListener("keydown", this.onKey);
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" });
    gsap.fromTo(this.big, { scale: 0.94 }, { scale: 1, duration: 0.6, ease: "expo.out" });
    gsap.from(overlay.querySelectorAll(".map-top > *, .map-zoom, .map-scale"), { y: -12, opacity: 0, duration: 0.6, stagger: 0.05, ease: "expo.out", delay: 0.1 });
    this.onToggle(true);
  }

  private close(): void {
    const overlay = this.overlay;
    if (!overlay) return;
    window.removeEventListener("resize", this.resizeBig);
    window.removeEventListener("keydown", this.onKey);
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => overlay.remove(),
    });
    this.overlay = null;
    this.big = null;
    this.onToggle(false);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key.toLowerCase() === "m") this.close();
  };

  private resizeBig = () => {
    if (!this.big) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.big.width = window.innerWidth * dpr;
    this.big.height = window.innerHeight * dpr;
    this.drawBig();
  };

  private animateView(x: number, z: number, scale: number): void {
    gsap.to(this.view, { x, z, scale, duration: 0.6, ease: "expo.out", onUpdate: () => this.drawBig() });
  }

  /** Zooms keeping the world point under (sx, sy) fixed. */
  private zoomAt(sx: number, sy: number, factor: number, animate = false): void {
    const s = this.world.world.size;
    const scale = Math.min(s / Math.min(window.innerWidth, window.innerHeight) * 1.1, Math.max(0.15, this.view.scale * factor));
    const wx = this.view.x + (sx - window.innerWidth / 2) * this.view.scale;
    const wz = this.view.z - (sy - window.innerHeight / 2) * this.view.scale;
    const x = wx - (sx - window.innerWidth / 2) * scale;
    const z = wz + (sy - window.innerHeight / 2) * scale;
    if (animate) this.animateView(x, z, scale);
    else {
      this.view = { x, z, scale };
      this.drawBig();
    }
  }

  private bindGestures(canvas: HTMLCanvasElement): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const now = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, now);
      if (pointers.size === 1) {
        this.view.x -= (now.x - prev.x) * this.view.scale;
        this.view.z += (now.y - prev.y) * this.view.scale;
        this.drawBig();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / d);
        pinch = d;
      }
    });
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
      },
      { passive: false }
    );
  }

  private drawBig(): void {
    const canvas = this.big;
    if (!canvas || !this.overlay) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = canvas.width / window.innerWidth;
    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#14261f";
    ctx.fillRect(0, 0, W, H);
    const s = this.world.world.size;
    const toScreen = (x: number, z: number): [number, number] => [
      W / 2 + (x - this.view.x) / this.view.scale,
      H / 2 - (z - this.view.z) / this.view.scale,
    ];
    // Base map
    const [x0, y0] = toScreen(-s / 2, s / 2);
    const px = s / this.view.scale;
    ctx.imageSmoothingEnabled = this.view.scale > 1;
    ctx.drawImage(this.base, x0, y0, px, px);

    // River names: bigger rivers first, skipping labels that would overlap
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const placed: Array<[number, number, number, number]> = [];
    for (const l of this.labels) {
      const [lx, ly] = toScreen(l.x, l.z);
      if (lx < -50 || ly < -20 || lx > W + 50 || ly > H + 20) continue;
      const big = l.weight > 30;
      if (!big && this.view.scale > 2.5) continue;
      ctx.font = `${big ? "italic 600 15px" : "italic 500 12px"} "Fraunces Variable", Fraunces, Georgia, serif`;
      const w = ctx.measureText(l.name).width;
      const box: [number, number, number, number] = [lx - w / 2 - 4, ly - 9, lx + w / 2 + 4, ly + 9];
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(10,24,20,0.75)";
      ctx.strokeText(l.name, lx, ly);
      ctx.fillStyle = "#cfe6dc";
      ctx.fillText(l.name, lx, ly);
    }

    // Stops
    ctx.font = `500 11px "Inter Variable", Inter, system-ui, sans-serif`;
    for (const dock of this.world.docks) {
      const [dx, dy] = toScreen(dock.x, dock.z);
      ctx.fillStyle = "#f4efe3";
      ctx.beginPath();
      ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (this.view.scale < 1.6) {
        ctx.fillStyle = "rgba(244,239,227,0.85)";
        ctx.textAlign = "left";
        ctx.fillText(dock.name, dx + 7, dy);
        ctx.textAlign = "center";
      }
    }
    if (this.target) {
      const [tx, ty] = toScreen(this.target.x, this.target.z);
      drawTarget(ctx, tx, ty, 7);
      ctx.font = `600 12px "Inter Variable", Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#e9b44c";
      ctx.textAlign = "left";
      ctx.fillText(this.target.label, tx + 11, ty - 10);
    }
    const [bx, by] = toScreen(this.boat.x, this.boat.z);
    drawBoat(ctx, bx, by, this.boat.heading, 1.8);

    // Scale bar
    const bar = this.overlay.querySelector<HTMLElement>(".map-scale");
    if (bar) {
      const nice = [100, 200, 500, 1000, 2000, 5000];
      const meters = nice.find((m) => m / METERS_PER_UNIT / this.view.scale > 70) ?? 5000;
      bar.querySelector("i")!.style.width = `${meters / METERS_PER_UNIT / this.view.scale}px`;
      bar.querySelector("span")!.textContent = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
    }
  }
}

/** The whole world's water at the layout grid's resolution, north up. */
function renderBase(layout: WorldLayout): HTMLCanvasElement {
  const res = layout.gridRes;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(res, res);
  const land = [34, 74, 47];
  const water = [104, 160, 140];
  for (let gx = 0; gx < res; gx++) {
    for (let gz = 0; gz < res; gz++) {
      const wet = layout.grid[gx * res + gz] === 1;
      const c = wet ? water : land;
      const k = ((res - 1 - gz) * res + gx) * 4;
      img.data[k] = c[0];
      img.data[k + 1] = c[1];
      img.data[k + 2] = c[2];
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** One label per named river, at the middle of its course; long, wide rivers weigh more. */
function riverLabels(world: WorldDoc) {
  const byName = new Map<string, { name: string; x: number; z: number; weight: number }>();
  for (const r of world.rivers) {
    let length = 0;
    for (let i = 1; i < r.points.length; i++) length += Math.hypot(r.points[i][0] - r.points[i - 1][0], r.points[i][1] - r.points[i - 1][1]);
    const [x, z] = r.points[Math.floor(r.points.length / 2)];
    const weight = (length / 40) * Math.sqrt(r.width / 8);
    const prev = byName.get(r.name);
    if (!prev || prev.weight < weight) byName.set(r.name, { name: r.name, x, z, weight });
  }
  return [...byName.values()].sort((a, b) => b.weight - a.weight);
}

function drawBoat(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, k: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = "#e9b44c";
  ctx.strokeStyle = "#1b140a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -7 * k);
  ctx.lineTo(-4.5 * k, 5 * k);
  ctx.lineTo(0, 2.5 * k);
  ctx.lineTo(4.5 * k, 5 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTarget(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.strokeStyle = "#e9b44c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e9b44c";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

/** Off-map target: an arrow at the card's edge pointing to it. */
function drawEdgeArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, tx: number, ty: number, size: number): void {
  const a = Math.atan2(ty - cy, tx - cx);
  const r = size / 2 - 9;
  ctx.save();
  ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  ctx.rotate(a);
  ctx.fillStyle = "#e9b44c";
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

let styled = false;
function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
    #minimap {
      position: fixed; top: 12px; right: 12px; z-index: 51; width: ${MINI}px; height: ${MINI}px;
      border-radius: 18px; overflow: hidden; cursor: pointer; pointer-events: auto;
      border: 1px solid rgba(244,239,227,0.2); box-shadow: 0 10px 30px -12px rgba(0,0,0,0.6);
      transition: transform 0.25s cubic-bezier(.2,.8,.2,1);
    }
    #minimap:hover { transform: scale(1.04); }
    #minimap canvas { width: 100%; height: 100%; display: block; }
    #minimap .map-hint {
      position: absolute; left: 8px; bottom: 7px; padding: 3px 8px; border-radius: 999px;
      font: 600 10px/1 "Inter Variable", Inter, system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase;
      color: #f4efe3; background: rgba(12,26,22,0.6); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    }
    #mapOverlay { position: fixed; inset: 0; z-index: 300; touch-action: none; }
    #mapOverlay canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; touch-action: none; }
    #mapOverlay canvas:active { cursor: grabbing; }
    #mapOverlay .map-top { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; gap: 8px; align-items: center; }
    #mapOverlay .map-title { margin-right: auto; color: #f4efe3; display: flex; flex-direction: column; gap: 2px; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
    #mapOverlay .map-title b { font: 600 22px/1.1 "Fraunces Variable", Fraunces, Georgia, serif; }
    #mapOverlay .map-title span { font: 400 12px/1.2 "Inter Variable", Inter, system-ui, sans-serif; color: rgba(244,239,227,0.7); }
    #mapOverlay .map-btn {
      min-width: 40px; height: 40px; padding: 0 14px; border-radius: 999px; cursor: pointer;
      font: 600 14px/1 "Inter Variable", Inter, system-ui, sans-serif; color: #f4efe3;
      background: rgba(12,26,22,0.6); border: 1px solid rgba(244,239,227,0.2);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
    #mapOverlay .map-close { background: #e9b44c; color: #1b140a; border: 0; }
    #mapOverlay .map-zoom { position: absolute; right: 16px; bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
    #mapOverlay .map-zoom .map-btn { width: 44px; height: 44px; padding: 0; font-size: 20px; }
    #mapOverlay .map-scale { position: absolute; left: 16px; bottom: 20px; display: flex; align-items: center; gap: 8px;
      font: 500 12px/1 "Inter Variable", Inter, system-ui, sans-serif; color: #f4efe3; text-shadow: 0 1px 4px rgba(0,0,0,0.7); }
    #mapOverlay .map-scale i { display: block; height: 4px; border: 2px solid #f4efe3; border-top: 0; }
    @media (max-height: 520px) {
      #minimap { width: 104px; height: 104px; top: 8px; right: 8px; border-radius: 14px; }
    }
  `;
  document.head.appendChild(style);
}
