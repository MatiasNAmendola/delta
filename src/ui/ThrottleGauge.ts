/**
 * The throttle lever on screen: where the lever is (fill), how fast the
 * boat actually goes (white tick) and, inside a slow zone (arroyo or
 * dock), the speed limit line, turning amber/red when over it. Sits by
 * the ▲▼ buttons on phones and at the right edge on desktop.
 */
export type SlowZone = "arroyo" | "muelle" | "remeros" | "sinola" | "remo" | null;

export class ThrottleGauge {
  private root: HTMLDivElement;
  private fill: HTMLDivElement;
  private tick: HTMLDivElement;
  private limit: HTMLDivElement;
  private label: HTMLDivElement;
  private last = "";

  /** Zero sits this far up the track (below it is reverse). */
  private static readonly ZERO = 0.25;

  constructor(parent: HTMLElement) {
    injectStyles();
    this.root = document.createElement("div");
    this.root.className = "tg";
    this.root.innerHTML = `
      <div class="tg-label"></div>
      <div class="tg-track">
        <div class="tg-zero"></div>
        <div class="tg-fill"></div>
        <div class="tg-limit"></div>
        <div class="tg-tick"></div>
      </div>
      <div class="tg-caption">Acel.</div>`;
    parent.appendChild(this.root);
    this.fill = this.root.querySelector(".tg-fill")!;
    this.tick = this.root.querySelector(".tg-tick")!;
    this.limit = this.root.querySelector(".tg-limit")!;
    this.label = this.root.querySelector(".tg-label")!;
  }

  /** lever and speed in -1..1 (fractions of top speed); limit: fraction allowed in the zone. */
  update(lever: number, speed: number, zone: SlowZone, limit: number, label?: string): void {
    const Z = ThrottleGauge.ZERO;
    const y = (v: number) => (Z + (v >= 0 ? v * (1 - Z) : v * Z)) * 100;
    const lo = Math.min(y(0), y(lever));
    const hi = Math.max(y(0), y(lever));
    const over = zone !== null && Math.abs(speed) > limit;
    const key = `${lever.toFixed(2)}|${speed.toFixed(2)}|${zone}|${over}|${label}`;
    if (key === this.last) return;
    this.last = key;
    this.fill.style.bottom = `${lo}%`;
    this.fill.style.height = `${hi - lo}%`;
    this.fill.classList.toggle("reverse", lever < 0);
    this.tick.style.bottom = `${y(Math.max(-1, Math.min(1, speed)))}%`;
    this.limit.style.display = zone ? "block" : "none";
    this.limit.style.bottom = `${y(limit)}%`;
    this.root.classList.toggle("over", over);
    this.label.textContent = label && !zone ? label : zone === "arroyo" ? "Arroyo · despacio" : zone === "muelle" ? "Muelle · despacio" : zone === "remeros" ? "Remeros · despacio" : zone === "sinola" ? "Sin ola" : zone === "remo" ? "Zona de remo" : lever === 0 ? "Punto muerto" : lever < 0 ? "Reversa" : `${Math.round(lever * 100)}%`;
  }
}

let injected = false;
function injectStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = `
    .tg { position: fixed; right: 20px; bottom: 40px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; pointer-events: none; z-index: 60; font-family: "Inter Variable", Inter, system-ui, sans-serif; }
    .tg-track { position: relative; width: 14px; height: 160px; border-radius: 8px; background: rgba(12, 26, 22, 0.5); border: 1px solid rgba(244, 239, 227, 0.2); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); overflow: visible; }
    .tg-zero { position: absolute; left: -4px; right: -4px; bottom: 25%; height: 2px; background: rgba(244, 239, 227, 0.55); border-radius: 1px; }
    .tg-fill { position: absolute; left: 2px; right: 2px; border-radius: 5px; background: #e9b44c; transition: bottom 0.12s, height 0.12s; }
    .tg-fill.reverse { background: #8fb3c9; }
    .tg-tick { position: absolute; left: -6px; right: -6px; height: 3px; margin-bottom: -1px; background: #fff; border-radius: 2px; box-shadow: 0 0 6px rgba(0,0,0,0.5); }
    .tg-limit { position: absolute; left: -8px; right: -8px; height: 0; border-top: 2px dashed #f4efe3; }
    .tg.over .tg-limit { border-top-color: #ff6b4a; }
    .tg.over .tg-tick { background: #ff6b4a; }
    .tg-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #f4efe3; text-align: center; white-space: nowrap; text-shadow: 0 1px 4px rgba(0,0,0,0.6); }
    .tg.over .tg-label { color: #ffb199; }
    .tg-track, .tg-caption { margin-right: 4px; }
    .tg-caption { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244, 239, 227, 0.6); }
    /* Phones: next to the ▲▼ buttons, clear of them */
    @media (pointer: coarse) { .tg { right: 206px; bottom: 26px; } .tg-track { height: 110px; } }
  `;
  document.head.appendChild(style);
}
