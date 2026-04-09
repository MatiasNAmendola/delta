import {
  GAME_DURATION,
  MAX_PASSENGERS,
  DOCK_LOCATIONS,
  RIVER_MAP,
  WORLD_SIZE,
} from "../utils/constants";
import { LanchaColectiva } from "../boat/LanchaColectiva";
import { getPointOnPath } from "../utils/helpers";

export class GameUI {
  private hudDiv!: HTMLDivElement;
  private minimapContainer!: HTMLDivElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private scoreEl!: HTMLElement;
  private passengersEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private locationEl!: HTMLElement;
  private notificationEl!: HTMLElement;
  private notificationTimeout: number | null = null;
  private startScreenDiv: HTMLDivElement | null = null;
  private endScreenDiv: HTMLDivElement | null = null;
  private minimapVisible = true;

  constructor() {
    this.createHUD();
    this.createMinimap();
    this.showStartScreen();
  }

  private isMobileScreen(): boolean {
    return window.innerWidth < 600;
  }

  private getMinimapSize(): number {
    return this.isMobileScreen() ? 120 : 150;
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

        /* === Top bar: Score | Passengers | Timer === */
        .hud-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          background: linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.0) 100%);
          min-height: 38px;
          box-sizing: border-box;
        }
        .hud-item {
          color: #e8d5a3;
          font-size: 14px;
          font-weight: bold;
          text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .hud-item .icon {
          font-size: 18px;
        }
        .hud-item .value {
          color: #ffffff;
          font-size: 16px;
        }

        /* === Location name: below top bar, full width === */
        #hud-location {
          padding: 0 12px 4px 12px;
          color: #7cb8a0;
          font-size: 11px;
          font-family: monospace;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
          pointer-events: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* === Top-right panel: minimap + weather + gyro === */
        #hud-topright {
          position: fixed;
          top: 4px;
          right: 8px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          z-index: 55;
          pointer-events: none;
        }

        /* === Minimap toggle row (toggle btn + label) === */
        #hud-minimap-toggle {
          pointer-events: auto;
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.2);
          color: #e8d5a3;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          align-self: flex-end;
          display: none; /* only shown on mobile */
        }

        /* === Weather buttons row === */
        #hud-weather {
          display: flex;
          gap: 3px;
          pointer-events: auto;
        }
        .weather-btn {
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          font-size: 16px;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          padding: 0;
        }
        .weather-btn:hover, .weather-btn.active {
          background: rgba(255,255,255,0.25);
          border-color: rgba(255,255,255,0.5);
        }

        /* === Gyro toggle (placed in weather row on mobile) === */
        #hud-gyro-slot {
          display: flex;
          gap: 3px;
          pointer-events: auto;
        }

        /* === Notification (center screen overlay) === */
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
          max-width: 90vw;
        }
        #hud-notification.show {
          opacity: 1;
        }

        /* === Next stop indicator: bottom-center above controls === */
        #hud-nextStop {
          position: fixed;
          bottom: 150px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.6);
          color: #7cb8a0;
          padding: 5px 14px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 51;
          pointer-events: none;
          border: 1px solid rgba(100,200,150,0.3);
          white-space: nowrap;
        }

        /* === Mobile-specific adjustments === */
        @media (max-width: 600px) {
          .hud-bar {
            padding: 4px 8px;
            min-height: 34px;
          }
          .hud-item {
            font-size: 12px;
            gap: 2px;
          }
          .hud-item .icon {
            font-size: 15px;
          }
          .hud-item .value {
            font-size: 14px;
          }
          #hud-location {
            font-size: 10px;
            padding: 0 8px 2px 8px;
          }
          .weather-btn {
            width: 30px;
            height: 30px;
            font-size: 14px;
          }
          #hud-minimap-toggle {
            display: block;
          }
          #hud-nextStop {
            bottom: 140px;
            font-size: 11px;
            padding: 4px 10px;
          }
        }

        /* === Landscape mobile: tighter spacing === */
        @media (max-height: 450px) {
          .hud-bar {
            padding: 2px 10px;
            min-height: 28px;
          }
          .hud-item { font-size: 11px; }
          .hud-item .icon { font-size: 14px; }
          .hud-item .value { font-size: 13px; }
          #hud-location {
            font-size: 9px;
            padding: 0 10px 1px 10px;
          }
          #hud-nextStop {
            bottom: 100px;
            font-size: 10px;
          }
        }
      </style>

      <!-- Row 1: score / passengers / timer -->
      <div class="hud-bar">
        <div class="hud-item">
          <span class="icon">⭐</span>
          <span>Puntos: </span>
          <span class="value" id="hud-score">0</span>
        </div>
        <div class="hud-item">
          <span class="icon">👥</span>
          <span id="hud-passengers">0/${MAX_PASSENGERS}</span>
        </div>
        <div class="hud-item">
          <span class="icon">⏱</span>
          <span class="value" id="hud-timer">5:00</span>
        </div>
      </div>

      <!-- Row 2: location name -->
      <div id="hud-location">Delta de Tigre</div>

      <!-- Center notification -->
      <div id="hud-notification"></div>

      <!-- Top-right stacked panel: minimap toggle, minimap, weather, gyro slot -->
      <div id="hud-topright">
        <button id="hud-minimap-toggle">Mapa ▼</button>
        <div id="hud-minimap-anchor"></div>
        <div id="hud-weather">
          <button class="weather-btn active" data-weather="morning" title="Mañana">🌅</button>
          <button class="weather-btn" data-weather="noon" title="Mediodía">☀️</button>
          <button class="weather-btn" data-weather="sunset" title="Atardecer">🌇</button>
          <button class="weather-btn" data-weather="night" title="Noche">🌙</button>
          <button class="weather-btn" data-weather="storm" title="Tormenta">⛈️</button>
        </div>
        <div id="hud-gyro-slot"></div>
      </div>

      <!-- Next stop indicator -->
      <div id="hud-nextStop"></div>
    `;
    document.body.appendChild(this.hudDiv);

    this.scoreEl = document.getElementById("hud-score")!;
    this.passengersEl = document.getElementById("hud-passengers")!;
    this.timerEl = document.getElementById("hud-timer")!;
    this.locationEl = document.getElementById("hud-location")!;
    this.notificationEl = document.getElementById("hud-notification")!;

    // Minimap toggle (mobile only)
    const toggleBtn = document.getElementById("hud-minimap-toggle")!;
    const toggleHandler = (e: Event) => {
      e.preventDefault();
      this.minimapVisible = !this.minimapVisible;
      if (this.minimapContainer) {
        this.minimapContainer.style.display = this.minimapVisible ? "block" : "none";
      }
      toggleBtn.textContent = this.minimapVisible ? "Mapa ▲" : "Mapa ▼";
    };
    toggleBtn.addEventListener("click", toggleHandler);
    toggleBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      toggleHandler(e);
    });
  }

  private createMinimap(): void {
    const size = this.getMinimapSize();

    this.minimapContainer = document.createElement("div");
    this.minimapContainer.id = "hud-minimap-container";
    this.minimapContainer.style.cssText = `
      width:${size}px;height:${size}px;
      border:2px solid rgba(232,213,163,0.5);
      border-radius:8px;overflow:hidden;
      background:rgba(0,0,0,0.5);
      pointer-events:none;
    `;

    this.minimapCanvas = document.createElement("canvas");
    this.minimapCanvas.width = size;
    this.minimapCanvas.height = size;
    this.minimapContainer.appendChild(this.minimapCanvas);

    // Insert minimap into the top-right panel's anchor
    const anchor = document.getElementById("hud-minimap-anchor");
    if (anchor) {
      anchor.appendChild(this.minimapContainer);
    }

    this.minimapCtx = this.minimapCanvas.getContext("2d")!;
    this.drawMinimapBase();

    // Resize minimap on orientation / window change
    window.addEventListener("resize", () => this.resizeMinimap());
  }

  private resizeMinimap(): void {
    const size = this.getMinimapSize();
    if (this.minimapCanvas.width !== size) {
      this.minimapCanvas.width = size;
      this.minimapCanvas.height = size;
      this.minimapContainer.style.width = `${size}px`;
      this.minimapContainer.style.height = `${size}px`;
      this.drawMinimapBase();
    }
  }

  private drawMinimapBase(): void {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    // Background (land)
    ctx.fillStyle = "#2a5a35";
    ctx.fillRect(0, 0, w, h);

    // Draw rivers
    ctx.strokeStyle = "#4a9a7a";
    ctx.lineWidth = 2;

    for (const river of RIVER_MAP) {
      ctx.beginPath();
      ctx.lineWidth = Math.max(1, (river.width / WORLD_SIZE) * w * 0.8);

      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const [rx, rz] = getPointOnPath(river.points, t);
        const mx = ((rx + WORLD_SIZE / 2) / WORLD_SIZE) * w;
        const my = ((rz + WORLD_SIZE / 2) / WORLD_SIZE) * h;

        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      }
      ctx.stroke();
    }

    // Draw docks
    for (const dock of DOCK_LOCATIONS) {
      const dx = ((dock.x + WORLD_SIZE / 2) / WORLD_SIZE) * w;
      const dy = ((dock.z + WORLD_SIZE / 2) / WORLD_SIZE) * h;
      ctx.fillStyle = "#e8d5a3";
      ctx.fillRect(dx - 1.5, dy - 1.5, 3, 3);
    }
  }

  public updateMinimap(boatX: number, boatZ: number, boatRot: number): void {
    // Redraw base
    this.drawMinimapBase();

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    // Draw boat position
    const bx = ((boatX + WORLD_SIZE / 2) / WORLD_SIZE) * w;
    const by = ((boatZ + WORLD_SIZE / 2) / WORLD_SIZE) * h;

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

  public showStartScreen(): void {
    this.startScreenDiv = document.createElement("div");
    this.startScreenDiv.id = "startScreen";
    this.startScreenDiv.innerHTML = `
      <style>
        #startScreen {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: linear-gradient(135deg, rgba(10,22,40,0.95), rgba(26,58,42,0.95));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 200;
          color: #e8d5a3;
          font-family: 'Segoe UI', Tahoma, sans-serif;
        }
        #startScreen h1 {
          font-size: 2.5em;
          margin-bottom: 5px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
        #startScreen h2 {
          font-size: 1.1em;
          color: #7cb8a0;
          font-weight: normal;
          margin-bottom: 25px;
        }
        #startScreen .instructions {
          background: rgba(0,0,0,0.3);
          padding: 15px 25px;
          border-radius: 10px;
          margin-bottom: 25px;
          max-width: 400px;
          text-align: left;
          line-height: 1.8;
          font-size: 0.9em;
        }
        #startScreen .play-btn {
          padding: 15px 50px;
          font-size: 1.3em;
          background: linear-gradient(135deg, #4a9a7a, #2d7a5f);
          border: 3px solid #7cb8a0;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          font-weight: bold;
          transition: transform 0.2s, background 0.2s;
        }
        #startScreen .play-btn:hover {
          transform: scale(1.05);
          background: linear-gradient(135deg, #5aaa8a, #3d8a6f);
        }
      </style>
      <div style="font-size:4em;margin-bottom:15px;">🚢</div>
      <h1>Delta de Tigre</h1>
      <h2>Lancha Colectiva Simulator</h2>
      <div class="instructions">
        🎮 <b>Objetivo:</b> Navegá por los ríos del Delta recogiendo y dejando pasajeros en las paradas.<br>
        ⭐ Ganá puntos por cada pasajero entregado.<br>
        ⏱ Tenés 5 minutos para hacer la mayor cantidad de viajes.<br>
        🗺 Ríos: Luján, Tigre, Sarmiento, Capitán, San Antonio y más.<br>
        📱 En móvil: usá los botones táctiles o el giroscopio para manejar.
      </div>
      <button class="play-btn" id="playBtn">▶ JUGAR</button>
    `;
    document.body.appendChild(this.startScreenDiv);
  }

  public onPlayClick(callback: () => void): void {
    const btn = document.getElementById("playBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        callback();
      });
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        callback();
      });
    }
  }

  public onWeatherChange(callback: (preset: string) => void): void {
    const btns = document.querySelectorAll(".weather-btn");
    btns.forEach((btn) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const preset = (btn as HTMLElement).dataset.weather;
        if (!preset) return;
        // Update active state
        btns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        callback(preset);
      };
      btn.addEventListener("click", handler);
      btn.addEventListener("touchstart", handler);
    });
  }

  public hideStartScreen(): void {
    if (this.startScreenDiv) {
      this.startScreenDiv.style.opacity = "0";
      this.startScreenDiv.style.transition = "opacity 0.5s";
      setTimeout(() => {
        this.startScreenDiv?.remove();
        this.startScreenDiv = null;
      }, 500);
    }
    this.hudDiv.style.display = "block";
  }

  public updateScore(score: number): void {
    this.scoreEl.textContent = score.toLocaleString();
  }

  public updatePassengers(current: number): void {
    this.passengersEl.textContent = `${current}/${MAX_PASSENGERS}`;
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

  public updateNextStop(name: string, distance: number): void {
    const el = document.getElementById("hud-nextStop");
    if (el) {
      el.textContent = `→ ${name} (${Math.floor(distance)}m)`;
    }
  }

  public showNotification(message: string, duration = 2500): void {
    this.notificationEl.textContent = message;
    this.notificationEl.classList.add("show");

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    this.notificationTimeout = window.setTimeout(() => {
      this.notificationEl.classList.remove("show");
    }, duration);
  }

  public showEndScreen(score: number, passengersDelivered: number): void {
    this.endScreenDiv = document.createElement("div");
    this.endScreenDiv.innerHTML = `
      <style>
        #endScreen {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(10,22,40,0.92);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 200;
          color: #e8d5a3;
        }
        #endScreen h1 { font-size: 2em; margin-bottom: 10px; }
        #endScreen .stats {
          font-size: 1.2em;
          margin: 20px 0;
          line-height: 2;
          text-align: center;
        }
        #endScreen .replay-btn {
          padding: 15px 50px;
          font-size: 1.2em;
          background: linear-gradient(135deg, #4a9a7a, #2d7a5f);
          border: 3px solid #7cb8a0;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          font-weight: bold;
          margin-top: 15px;
        }
      </style>
      <div id="endScreen">
        <div style="font-size:3em;">🏆</div>
        <h1>¡Fin del recorrido!</h1>
        <div class="stats">
          ⭐ Puntos: <b>${score.toLocaleString()}</b><br>
          👥 Pasajeros entregados: <b>${passengersDelivered}</b><br>
          ${score > 3000 ? "🌟 ¡Excelente capitán!" : score > 1500 ? "👍 ¡Buen trabajo!" : "💪 ¡Seguí practicando!"}
        </div>
        <button class="replay-btn" id="replayBtn">🔄 Jugar de nuevo</button>
      </div>
    `;
    document.body.appendChild(this.endScreenDiv);

    const replayBtn = document.getElementById("replayBtn");
    if (replayBtn) {
      const reload = () => window.location.reload();
      replayBtn.addEventListener("click", reload);
      replayBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        reload();
      });
    }
  }
}
