import { Scene } from "@babylonjs/core/scene";
import { LanchaColectiva } from "../boat/LanchaColectiva";

export interface ControlState {
  throttle: number; // -1 to 1
  steering: number; // -1 to 1
  action: boolean; // dock action
  gyroSteering: number | null;
}

export class MobileControls {
  private controlState: ControlState = {
    throttle: 0,
    steering: 0,
    action: false,
    gyroSteering: null,
  };

  private isMobile: boolean;
  private gyroEnabled = false;
  private gyroCalibration = 0;
  private controlsDiv!: HTMLDivElement;
  private keysDown = new Set<string>();
  private actionPressed = false;

  constructor(private scene: Scene) {
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || "ontouchstart" in window;

    this.setupKeyboard();

    if (this.isMobile) {
      this.createTouchControls();
      this.setupGyroscope();
    } else {
      this.createDesktopHint();
    }
  }

  private setupKeyboard(): void {
    window.addEventListener("keydown", (e) => {
      this.keysDown.add(e.key.toLowerCase());
      if (e.key === " " || e.key === "e") {
        this.actionPressed = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.key.toLowerCase());
    });
  }

  private createDesktopHint(): void {
    const hint = document.createElement("div");
    hint.id = "desktopHint";
    hint.innerHTML = `
      <div style="position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.7);
        color:#e8d5a3;padding:10px 15px;border-radius:8px;font-size:13px;
        font-family:monospace;z-index:100;pointer-events:none;">
        W/↑ Acelerar &nbsp; S/↓ Reversa &nbsp; A/← D/→ Girar &nbsp; ESPACIO Embarcar/Desembarcar
      </div>
    `;
    document.body.appendChild(hint);
  }

  private createTouchControls(): void {
    this.controlsDiv = document.createElement("div");
    this.controlsDiv.id = "mobileControls";
    this.controlsDiv.innerHTML = `
      <style>
        #mobileControls {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: auto;
          z-index: 100;
          pointer-events: none;
        }
        .ctrl-btn {
          pointer-events: all;
          position: fixed;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 3px solid rgba(232,213,163,0.6);
          background: rgba(0,0,0,0.45);
          color: #e8d5a3;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
          transition: background 0.1s;
        }
        .ctrl-btn:active, .ctrl-btn.active {
          background: rgba(232,213,163,0.4);
          border-color: rgba(232,213,163,0.9);
        }
        .ctrl-btn.action-btn {
          width: 70px;
          height: 70px;
          border-color: rgba(100,200,150,0.7);
          font-size: 14px;
          font-weight: bold;
        }
        .ctrl-btn.action-btn:active, .ctrl-btn.action-btn.active {
          background: rgba(100,200,150,0.4);
        }
        .gyro-toggle {
          pointer-events: all;
          position: fixed;
          top: 60px;
          right: 10px;
          padding: 8px 12px;
          border-radius: 20px;
          border: 2px solid rgba(232,213,163,0.5);
          background: rgba(0,0,0,0.45);
          color: #e8d5a3;
          font-size: 12px;
          z-index: 101;
          touch-action: none;
        }
      </style>
      <!-- Left side: steering -->
      <div class="ctrl-btn" id="btnLeft" style="bottom:40px;left:15px;">◀</div>
      <div class="ctrl-btn" id="btnRight" style="bottom:40px;left:90px;">▶</div>

      <!-- Right side: throttle -->
      <div class="ctrl-btn" id="btnForward" style="bottom:110px;right:45px;">▲</div>
      <div class="ctrl-btn" id="btnReverse" style="bottom:30px;right:45px;">▼</div>

      <!-- Action button (center-right) -->
      <div class="ctrl-btn action-btn" id="btnAction" style="bottom:70px;right:130px;">
        PARADA
      </div>

      <!-- Gyroscope toggle -->
      <div class="gyro-toggle" id="gyroToggle">🔄 Giroscopio: OFF</div>
    `;
    document.body.appendChild(this.controlsDiv);

    this.setupTouchButton("btnForward", () => {
      this.controlState.throttle = 1;
    }, () => {
      this.controlState.throttle = 0;
    });
    this.setupTouchButton("btnReverse", () => {
      this.controlState.throttle = -1;
    }, () => {
      this.controlState.throttle = 0;
    });
    this.setupTouchButton("btnLeft", () => {
      this.controlState.steering = -1;
    }, () => {
      this.controlState.steering = 0;
    });
    this.setupTouchButton("btnRight", () => {
      this.controlState.steering = 1;
    }, () => {
      this.controlState.steering = 0;
    });
    this.setupTouchButton("btnAction", () => {
      this.actionPressed = true;
    }, () => {});

    // Gyro toggle
    const gyroBtn = document.getElementById("gyroToggle")!;
    gyroBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.toggleGyroscope();
    });
    gyroBtn.addEventListener("click", () => {
      this.toggleGyroscope();
    });
  }

  private setupTouchButton(
    id: string,
    onDown: () => void,
    onUp: () => void
  ): void {
    const btn = document.getElementById(id)!;

    const handleStart = (e: Event) => {
      e.preventDefault();
      btn.classList.add("active");
      onDown();
    };
    const handleEnd = (e: Event) => {
      e.preventDefault();
      btn.classList.remove("active");
      onUp();
    };

    btn.addEventListener("touchstart", handleStart, { passive: false });
    btn.addEventListener("touchend", handleEnd, { passive: false });
    btn.addEventListener("touchcancel", handleEnd, { passive: false });
    btn.addEventListener("mousedown", handleStart);
    btn.addEventListener("mouseup", handleEnd);
    btn.addEventListener("mouseleave", handleEnd);
  }

  private async setupGyroscope(): Promise<void> {
    // Check if DeviceOrientation is available
    if (typeof DeviceOrientationEvent === "undefined") return;

    // iOS 13+ requires permission
    if (
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      // Permission will be requested on toggle
      return;
    }
  }

  private async toggleGyroscope(): Promise<void> {
    if (this.gyroEnabled) {
      this.gyroEnabled = false;
      this.controlState.gyroSteering = null;
      this.updateGyroButton();
      return;
    }

    // iOS permission request
    if (
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as any
        ).requestPermission();
        if (permission !== "granted") return;
      } catch {
        return;
      }
    }

    this.gyroEnabled = true;
    this.gyroCalibration = 0;
    let calibrated = false;

    window.addEventListener("deviceorientation", (e) => {
      if (!this.gyroEnabled) return;
      const gamma = e.gamma || 0; // Left/right tilt

      if (!calibrated) {
        this.gyroCalibration = gamma;
        calibrated = true;
      }

      const adjusted = gamma - this.gyroCalibration;
      // Map -30 to 30 degrees to -1 to 1
      this.controlState.gyroSteering = Math.max(
        -1,
        Math.min(1, adjusted / 30)
      );
    });

    this.updateGyroButton();
  }

  private updateGyroButton(): void {
    const btn = document.getElementById("gyroToggle");
    if (btn) {
      btn.textContent = `🔄 Giroscopio: ${this.gyroEnabled ? "ON" : "OFF"}`;
      btn.style.borderColor = this.gyroEnabled
        ? "rgba(100,200,150,0.8)"
        : "rgba(232,213,163,0.5)";
    }
  }

  public update(): ControlState {
    // Keyboard controls (desktop)
    if (!this.isMobile) {
      this.controlState.throttle = 0;
      this.controlState.steering = 0;

      if (this.keysDown.has("w") || this.keysDown.has("arrowup")) {
        this.controlState.throttle = 1;
      }
      if (this.keysDown.has("s") || this.keysDown.has("arrowdown")) {
        this.controlState.throttle = -1;
      }
      if (this.keysDown.has("a") || this.keysDown.has("arrowleft")) {
        this.controlState.steering = -1;
      }
      if (this.keysDown.has("d") || this.keysDown.has("arrowright")) {
        this.controlState.steering = 1;
      }
    }

    // Action button (one-shot)
    this.controlState.action = this.actionPressed;
    this.actionPressed = false;

    return { ...this.controlState };
  }

  public dispose(): void {
    if (this.controlsDiv) {
      this.controlsDiv.remove();
    }
  }
}
