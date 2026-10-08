import { ThrottleGauge, type SlowZone } from "./ThrottleGauge";
import { Scene } from "@babylonjs/core/scene";
import type { WorldDoc } from "../world/WorldDoc";
import { gsap } from "gsap";
import { METERS_PER_UNIT } from "../utils/constants";
import { StartScreen } from "./StartScreen";
import { MapView, type MapMarker } from "./MapView";
import type { WorldLayout } from "../world/layout/worldLayout";
import type { BoatTypeId } from "../boat/boatTypes";
import type { Summary } from "../game/modes";
import { showEndScreen } from "./EndScreen";
import { injectHudTheme } from "./hudTheme";

export class GameUI {
  private hudDiv!: HTMLDivElement;
  private throttle!: ThrottleGauge;
  private scoreEl!: HTMLElement;
  private secondEl!: HTMLElement;
  private secondLabelEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private locationEl!: HTMLElement;
  private notificationEl!: HTMLElement;
  private notificationTimeout: number | null = null;
  private startScreen: StartScreen | null = null;

  private map: MapView;

  constructor(private scene: Scene, private world: WorldDoc, layout: WorldLayout) {
    this.createHUD();
    this.map = new MapView(world, layout);
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
      <div id="hud-river"><span id="hud-river-name">Delta de Tigre</span></div>
      <div id="hud-location"></div>
      <div id="hud-notification"></div>
      <div id="hud-nextStop"></div>
    `;
    document.body.appendChild(this.hudDiv);
    this.throttle = new ThrottleGauge(this.hudDiv);
    injectHudTheme();

    this.scoreEl = document.getElementById("hud-score")!;
    this.secondEl = document.getElementById("hud-second")!;
    this.secondLabelEl = document.getElementById("hud-second-label")!;
    this.timerEl = document.getElementById("hud-timer")!;
    this.locationEl = document.getElementById("hud-location")!;
    this.notificationEl = document.getElementById("hud-notification")!;
  }

  /** Map card in the corner; tap to open the full chart (pauses the game). */
  public updateMap(x: number, z: number, heading: number, target: MapMarker | null): void {
    this.map.update(x, z, heading, target);
  }

  public onMapToggle(callback: (open: boolean) => void): void {
    this.map.onToggle = callback;
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

  public setGaugeVisible(on: boolean): void {
    this.throttle.setVisible(on);
  }

  /** Throttle lever, actual speed and the slow-zone limit (fractions of top speed). */
  public updateThrottle(lever: number, speed: number, zone: SlowZone, limit: number, label?: string): void {
    this.throttle.update(lever, speed, zone, limit, label);
  }

  public updateScore(score: number): void {
    this.scoreEl.textContent = score.toLocaleString();
  }

  /** Credits (or a hint) rising from where the player tapped. */
  public floatCredits(x: number, y: number, text: string, caption: string): void {
    const el = document.createElement("div");
    el.className = "credit-pop";
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector("b")!.textContent = text;
    el.querySelector("span")!.textContent = caption;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    gsap
      .timeline({ onComplete: () => el.remove() })
      .fromTo(el, { y: 0, scale: 0.6, opacity: 0 }, { y: -36, scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.2)" })
      .to(el, { y: -70, opacity: 0, duration: 0.6, ease: "power2.in" }, "+=0.35");
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

  private riverName = "";

  /** River you are on (big, top center, animated when it changes) and what to do here (bottom line). */
  public updateLocation(river: string, hint: string | null): void {
    if (river !== this.riverName) {
      this.riverName = river;
      const el = document.getElementById("hud-river-name")!;
      gsap.killTweensOf(el);
      gsap
        .timeline()
        .to(el, { y: -10, opacity: 0, filter: "blur(4px)", duration: 0.25, ease: "power2.in" })
        .call(() => {
          el.textContent = river;
        })
        .to(el, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out" });
    }
    const text = hint ?? "";
    if (this.locationEl.textContent !== text) this.locationEl.textContent = text;
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
