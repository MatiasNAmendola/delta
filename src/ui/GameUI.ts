import { Scene } from "@babylonjs/core/scene";
import type { WorldDoc } from "../world/WorldDoc";
import { getPointOnPath } from "../utils/helpers";
import { gsap } from "gsap";
import { METERS_PER_UNIT } from "../utils/constants";
import { StartScreen } from "./StartScreen";
import type { BoatTypeId } from "../boat/boatTypes";
import type { Summary } from "../game/modes";
import { showEndScreen } from "./EndScreen";
import { injectHudTheme } from "./hudTheme";

export class GameUI {
  private hudDiv!: HTMLDivElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private scoreEl!: HTMLElement;
  private secondEl!: HTMLElement;
  private secondLabelEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private locationEl!: HTMLElement;
  private notificationEl!: HTMLElement;
  private notificationTimeout: number | null = null;
  private startScreen: StartScreen | null = null;

  constructor(private scene: Scene, private world: WorldDoc) {
    this.createHUD();
    this.createMinimap();
    // The title screen is shown by the engine once the loader is gone
  }

  private createHUD(): void {
    this.hudDiv = document.createElement("div");
    this.hudDiv.id = "gameHUD";
    this.hudDiv.style.display = "none";
    this.hudDiv.innerHTML = `
      <style>
        #gameHUD {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          pointer-events: none;
          z-index: 50;
          font-family: 'Segoe UI', Tahoma, sans-serif;
        }
        .hud-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 15px;
          background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
        }
        .hud-item {
          color: #e8d5a3;
          font-size: 16px;
          font-weight: bold;
          text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .hud-item .icon {
          font-size: 20px;
        }
        .hud-item .value {
          color: #ffffff;
          font-size: 18px;
        }
        #hud-location {
          position: fixed;
          top: 42px;
          left: 15px;
          color: #7cb8a0;
          font-size: 12px;
          font-family: monospace;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
          pointer-events: none;
          z-index: 51;
        }
        #hud-notification {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.8);
          color: #e8d5a3;
          padding: 15px 30px;
          border-radius: 12px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          z-index: 60;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
          border: 2px solid rgba(232,213,163,0.3);
        }
        #hud-notification.show {
          opacity: 1;
        }
        #hud-nextStop {
          position: fixed;
          bottom: 140px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.6);
          color: #7cb8a0;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 13px;
          z-index: 51;
          pointer-events: none;
          border: 1px solid rgba(100,200,150,0.3);
        }
      </style>
      <div class="hud-bar">
        <div class="hud-item">
          <span class="label">Puntos</span>
          <span class="value" id="hud-score">0</span>
        </div>
        <div class="hud-item">
          <span class="label" id="hud-second-label">Pasajeros</span>
          <span class="value" id="hud-second">0/${this.world.rules.boatCapacity}</span>
        </div>
        <div class="hud-item">
          <span class="label">Tiempo</span>
          <span class="value" id="hud-timer">5:00</span>
        </div>
      </div>
      <div id="hud-location">Delta de Tigre</div>
      <div id="hud-notification"></div>
      <div id="hud-nextStop"></div>
    `;
    document.body.appendChild(this.hudDiv);
    injectHudTheme();

    this.scoreEl = document.getElementById("hud-score")!;
    this.secondEl = document.getElementById("hud-second")!;
    this.secondLabelEl = document.getElementById("hud-second-label")!;
    this.timerEl = document.getElementById("hud-timer")!;
    this.locationEl = document.getElementById("hud-location")!;
    this.notificationEl = document.getElementById("hud-notification")!;
  }

  private createMinimap(): void {
    const container = document.createElement("div");
    container.style.cssText = `
      position:fixed;top:55px;right:10px;
      width:120px;height:120px;
      border:2px solid rgba(232,213,163,0.5);
      border-radius:8px;overflow:hidden;
      background:rgba(0,0,0,0.5);z-index:51;
      pointer-events:none;
    `;

    this.minimapCanvas = document.createElement("canvas");
    this.minimapCanvas.width = 120;
    this.minimapCanvas.height = 120;
    container.appendChild(this.minimapCanvas);
    container.id = "minimap";
    document.body.appendChild(container);

    this.minimapCtx = this.minimapCanvas.getContext("2d")!;
    this.drawMinimapBase();
  }

  /** Static minimap layer (land, water, docks), rendered once and reused every frame. */
  private minimapBase: HTMLCanvasElement | null = null;

  private drawMinimapBase(): void {
    if (!this.minimapBase) {
      this.minimapBase = document.createElement("canvas");
      this.minimapBase.width = 120;
      this.minimapBase.height = 120;
      this.renderMinimapBase(this.minimapBase.getContext("2d")!);
    }
    this.minimapCtx.clearRect(0, 0, 120, 120);
    this.minimapCtx.drawImage(this.minimapBase, 0, 0);
  }

  private renderMinimapBase(ctx: CanvasRenderingContext2D): void {
    const w = 120;
    const h = 120;
    const size = this.world.world.size;
    const mx = (x: number) => ((x + size / 2) / size) * w;
    const my = (z: number) => ((z + size / 2) / size) * h;

    // Background (land)
    ctx.fillStyle = "#2a5a35";
    ctx.fillRect(0, 0, w, h);

    // Real water shapes; islands (holes) cut out with the even-odd rule
    ctx.fillStyle = "#4a9a7a";
    for (const area of this.world.waterAreas ?? []) {
      ctx.beginPath();
      for (const ring of [area.outer, ...area.holes]) {
        ring.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(mx(x), my(z)) : ctx.lineTo(mx(x), my(z))));
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }

    // Draw rivers
    ctx.strokeStyle = "#4a9a7a";
    ctx.lineWidth = 2;

    for (const river of this.world.rivers) {
      ctx.beginPath();
      ctx.lineWidth = Math.max(1, (river.width / this.world.world.size) * w * 0.8);

      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const [rx, rz] = getPointOnPath(river.points, t);
        const mx = ((rx + this.world.world.size / 2) / this.world.world.size) * w;
        const my = ((rz + this.world.world.size / 2) / this.world.world.size) * h;

        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      }
      ctx.stroke();
    }

    // Draw docks
    for (const dock of this.world.docks) {
      const dx = ((dock.x + this.world.world.size / 2) / this.world.world.size) * w;
      const dy = ((dock.z + this.world.world.size / 2) / this.world.world.size) * h;
      ctx.fillStyle = "#e8d5a3";
      ctx.fillRect(dx - 1.5, dy - 1.5, 3, 3);
    }
  }

  public updateMinimap(boatX: number, boatZ: number, boatRot: number): void {
    // Redraw base
    this.drawMinimapBase();

    const ctx = this.minimapCtx;
    const w = 120;
    const h = 120;

    // Draw boat position
    const bx = ((boatX + this.world.world.size / 2) / this.world.world.size) * w;
    const by = ((boatZ + this.world.world.size / 2) / this.world.world.size) * h;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(boatRot);

    // Boat arrow
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-3, 3);
    ctx.lineTo(3, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  public showStartScreen(selected: BoatTypeId, onSelect: (id: BoatTypeId) => void): void {
    this.startScreen = new StartScreen(this.world, selected, onSelect);
  }

  public onPlayClick(callback: () => void): void {
    this.startScreen?.onPlayClick(callback);
  }

  /** The title screen animates itself out; the HUD slides in after it. */
  public hideStartScreen(): void {
    this.startScreen = null;
    this.hudDiv.style.display = "block";
    gsap.from(this.hudDiv.querySelectorAll(".hud-bar > *"), {
      y: -24,
      opacity: 0,
      duration: 0.9,
      delay: 0.45,
      stagger: 0.08,
      ease: "expo.out",
      clearProps: "all",
    });
  }

  public updateScore(score: number): void {
    this.scoreEl.textContent = score.toLocaleString();
  }

  /** Second HUD pill: passengers, energy, corners found or leg time, per boat. */
  public updateSecondary(label: string, value: string): void {
    if (this.secondLabelEl.textContent !== label) this.secondLabelEl.textContent = label;
    if (this.secondEl.textContent !== value) this.secondEl.textContent = value;
  }

  public updateTimer(secondsLeft: number): void {
    const mins = Math.floor(secondsLeft / 60);
    const secs = Math.floor(secondsLeft % 60);
    this.timerEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;

    if (secondsLeft < 30) {
      this.timerEl.style.color = "#ff6b6b";
    } else if (secondsLeft < 60) {
      this.timerEl.style.color = "#ffaa44";
    }
  }

  public updateLocation(name: string): void {
    this.locationEl.textContent = name;
  }

  public updateNextStop(label: string, name: string, distance: number): void {
    const el = document.getElementById("hud-nextStop");
    if (el) {
      // World units are 8 m on the real map
      const meters = distance * METERS_PER_UNIT;
      const far = meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(meters / 10) * 10} m`;
      el.textContent = `${label} · ${name} · ${far}`;
    }
  }

  public showNotification(message: string, duration = 2500): void {
    const el = this.notificationEl;
    el.textContent = message;
    el.classList.add("show");
    gsap.killTweensOf(el);
    gsap.fromTo(el, { y: 12, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "expo.out" });

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    this.notificationTimeout = window.setTimeout(() => {
      gsap.to(el, {
        y: -10,
        opacity: 0,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => el.classList.remove("show"),
      });
    }, duration);
  }

  public showEndScreen(score: number, summary: Summary, boatName: string): void {
    showEndScreen(score, summary, boatName);
  }
}
