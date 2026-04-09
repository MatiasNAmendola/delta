import { Scene } from "@babylonjs/core/scene";

export interface ControlState {
  throttle: number; // -1 to 1
  steering: number; // -1 to 1
  action: boolean; // dock action
  gyroSteering: number | null;
  cameraAngleOffset: number; // radians offset from behind-boat
  cameraPitchOffset: number; // up/down offset
}

export class MobileControls {
  private controlState: ControlState = {
    throttle: 0,
    steering: 0,
    action: false,
    gyroSteering: null,
    cameraAngleOffset: 0,
    cameraPitchOffset: 0,
  };

  private isMobile: boolean;
  private gyroEnabled = false;
  private gyroCalibration = 0;
  private gyroCalibrated = false;
  private gyroListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private controlsDiv!: HTMLDivElement;
  private keysDown = new Set<string>();
  private actionPressed = false;

  // Camera drag state
  private cameraDragActive = false;
  private cameraDragStartX = 0;
  private cameraDragStartY = 0;
  private cameraDragBaseAngle = 0;
  private cameraDragBasePitch = 0;
  private cameraAutoReturn = 0; // timer to auto-return camera behind boat

  // Track active button touches to avoid conflicts with camera drag
  private buttonTouchIds = new Set<number>();

  constructor(private scene: Scene) {
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || "ontouchstart" in window;

    this.setupKeyboard();
    this.setupCameraDrag();

    if (this.isMobile) {
      this.createTouchControls();
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

  private setupCameraDrag(): void {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    // Touch camera drag (on the canvas, not on buttons)
    canvas.addEventListener("touchstart", (e) => {
      // Only start camera drag if the touch is NOT on a control button
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && (target.classList.contains("ctrl-btn") ||
            target.classList.contains("gyro-toggle") ||
            target.id === "playBtn" || target.id === "replayBtn")) {
          this.buttonTouchIds.add(touch.identifier);
          continue;
        }
        // This touch is on the canvas — use for camera
        if (!this.cameraDragActive) {
          this.cameraDragActive = true;
          this.cameraDragStartX = touch.clientX;
          this.cameraDragStartY = touch.clientY;
          this.cameraDragBaseAngle = this.controlState.cameraAngleOffset;
          this.cameraDragBasePitch = this.controlState.cameraPitchOffset;
          this.cameraAutoReturn = 0;
        }
      }
    }, { passive: true });

    canvas.addEventListener("touchmove", (e) => {
      if (!this.cameraDragActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.buttonTouchIds.has(touch.identifier)) continue;
        const dx = touch.clientX - this.cameraDragStartX;
        const dy = touch.clientY - this.cameraDragStartY;
        this.controlState.cameraAngleOffset = this.cameraDragBaseAngle + dx * 0.008;
        this.controlState.cameraPitchOffset = Math.max(-8, Math.min(12,
          this.cameraDragBasePitch - dy * 0.04));
      }
    }, { passive: true });

    const endDrag = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.buttonTouchIds.delete(e.changedTouches[i].identifier);
      }
      // Check if any non-button touches remain
      let hasCanvasTouch = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (!this.buttonTouchIds.has(e.touches[i].identifier)) {
          hasCanvasTouch = true;
        }
      }
      if (!hasCanvasTouch) {
        this.cameraDragActive = false;
        this.cameraAutoReturn = 3.0; // auto-return after 3 seconds
      }
    };

    canvas.addEventListener("touchend", endDrag, { passive: true });
    canvas.addEventListener("touchcancel", endDrag, { passive: true });

    // Mouse camera drag (desktop)
    let mouseDown = false;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let mouseBaseAngle = 0;
    let mouseBasePitch = 0;

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2 || e.button === 1) { // right or middle click
        mouseDown = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        mouseBaseAngle = this.controlState.cameraAngleOffset;
        mouseBasePitch = this.controlState.cameraPitchOffset;
        this.cameraAutoReturn = 0;
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!mouseDown) return;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      this.controlState.cameraAngleOffset = mouseBaseAngle + dx * 0.005;
      this.controlState.cameraPitchOffset = Math.max(-8, Math.min(12,
        mouseBasePitch - dy * 0.03));
    });
    canvas.addEventListener("mouseup", () => {
      if (mouseDown) {
        mouseDown = false;
        this.cameraAutoReturn = 3.0;
      }
    });

    // Prevent context menu on right-click
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private createDesktopHint(): void {
    const hint = document.createElement("div");
    hint.id = "desktopHint";
    hint.innerHTML = `
      <div style="position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.7);
        color:#e8d5a3;padding:10px 15px;border-radius:8px;font-size:13px;
        font-family:monospace;z-index:100;pointer-events:none;">
        W/↑ Acelerar &nbsp; S/↓ Reversa &nbsp; A/← D/→ Girar &nbsp; ESPACIO Parada &nbsp; Click-derecho Cámara
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
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 3px solid rgba(232,213,163,0.6);
          background: rgba(0,0,0,0.5);
          color: #e8d5a3;
          font-size: 26px;
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
          transform: scale(0.92);
        }
        .ctrl-btn.action-btn {
          width: 72px;
          height: 72px;
          border-color: rgba(100,200,150,0.7);
          font-size: 13px;
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
          padding: 8px 14px;
          border-radius: 20px;
          border: 2px solid rgba(232,213,163,0.5);
          background: rgba(0,0,0,0.5);
          color: #e8d5a3;
          font-size: 12px;
          z-index: 101;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }
        .gyro-toggle.on {
          border-color: rgba(100,200,150,0.8);
          background: rgba(100,200,150,0.2);
        }
        .cam-hint {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: rgba(232,213,163,0.4);
          font-size: 11px;
          pointer-events: none;
          z-index: 49;
          text-align: center;
        }
      </style>
      <!-- Left side: steering -->
      <div class="ctrl-btn" id="btnLeft" style="bottom:35px;left:15px;">◀</div>
      <div class="ctrl-btn" id="btnRight" style="bottom:35px;left:95px;">▶</div>

      <!-- Right side: throttle -->
      <div class="ctrl-btn" id="btnForward" style="bottom:110px;right:40px;">▲</div>
      <div class="ctrl-btn" id="btnReverse" style="bottom:25px;right:40px;">▼</div>

      <!-- Action button -->
      <div class="ctrl-btn action-btn" id="btnAction" style="bottom:65px;right:125px;">
        PARADA
      </div>

      <!-- Gyroscope toggle -->
      <div class="gyro-toggle" id="gyroToggle">Giroscopio: OFF</div>

      <!-- Camera hint -->
      <div class="cam-hint" id="camHint">Arrastrá la pantalla para mover la cámara</div>
    `;
    document.body.appendChild(this.controlsDiv);

    // Hide camera hint after a few seconds
    setTimeout(() => {
      const hint = document.getElementById("camHint");
      if (hint) hint.style.opacity = "0";
      setTimeout(() => hint?.remove(), 1000);
    }, 5000);

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
    }, { passive: false });
    gyroBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggleGyroscope();
    });
  }

  private setupTouchButton(
    id: string,
    onDown: () => void,
    onUp: () => void
  ): void {
    const btn = document.getElementById(id)!;

    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("active");
      // Track this touch as a button touch
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.buttonTouchIds.add(e.changedTouches[i].identifier);
      }
      onDown();
    }, { passive: false });

    const handleEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("active");
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.buttonTouchIds.delete(e.changedTouches[i].identifier);
      }
      onUp();
    };

    btn.addEventListener("touchend", handleEnd, { passive: false });
    btn.addEventListener("touchcancel", handleEnd, { passive: false });

    // Mouse fallback
    btn.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      btn.classList.add("active");
      onDown();
    });
    btn.addEventListener("mouseup", (e) => {
      e.stopPropagation();
      btn.classList.remove("active");
      onUp();
    });
    btn.addEventListener("mouseleave", () => {
      btn.classList.remove("active");
      onUp();
    });
  }

  private async toggleGyroscope(): Promise<void> {
    if (this.gyroEnabled) {
      // Turn OFF
      this.gyroEnabled = false;
      this.controlState.gyroSteering = null;
      if (this.gyroListener) {
        window.removeEventListener("deviceorientation", this.gyroListener);
        this.gyroListener = null;
      }
      this.updateGyroButton();
      return;
    }

    // iOS 13+ permission
    if (
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as any
        ).requestPermission();
        if (permission !== "granted") {
          this.showGyroError("Permiso de giroscopio denegado");
          return;
        }
      } catch {
        this.showGyroError("Error al pedir permiso de giroscopio");
        return;
      }
    }

    // Check if device actually has gyro
    this.gyroEnabled = true;
    this.gyroCalibrated = false;
    this.gyroCalibration = 0;

    let gotEvent = false;

    this.gyroListener = (e: DeviceOrientationEvent) => {
      if (!this.gyroEnabled) return;
      gotEvent = true;

      // Use gamma for landscape orientation (tilt left/right)
      // In landscape, gamma maps to left/right tilt
      const gamma = e.gamma || 0;
      // Also try beta for devices held differently
      const beta = e.beta || 0;

      // Detect orientation: use gamma primarily
      // In landscape-left, gamma tilts correctly
      // In portrait, gamma is also left-right
      const tilt = gamma;

      if (!this.gyroCalibrated) {
        this.gyroCalibration = tilt;
        this.gyroCalibrated = true;
      }

      const adjusted = tilt - this.gyroCalibration;
      // Dead zone of 3 degrees to prevent drift
      const deadZone = 3;
      let mapped = 0;
      if (Math.abs(adjusted) > deadZone) {
        mapped = (adjusted - Math.sign(adjusted) * deadZone) / 25;
      }
      this.controlState.gyroSteering = Math.max(-1, Math.min(1, mapped));
    };

    window.addEventListener("deviceorientation", this.gyroListener);

    // Check after a moment if we actually got events
    setTimeout(() => {
      if (!gotEvent && this.gyroEnabled) {
        this.gyroEnabled = false;
        this.controlState.gyroSteering = null;
        if (this.gyroListener) {
          window.removeEventListener("deviceorientation", this.gyroListener);
          this.gyroListener = null;
        }
        this.showGyroError("Giroscopio no disponible en este dispositivo");
        this.updateGyroButton();
      }
    }, 1500);

    this.updateGyroButton();
  }

  private showGyroError(msg: string): void {
    const btn = document.getElementById("gyroToggle");
    if (btn) {
      btn.textContent = msg;
      setTimeout(() => this.updateGyroButton(), 2500);
    }
  }

  private updateGyroButton(): void {
    const btn = document.getElementById("gyroToggle");
    if (btn) {
      btn.textContent = `Giroscopio: ${this.gyroEnabled ? "ON" : "OFF"}`;
      if (this.gyroEnabled) {
        btn.classList.add("on");
      } else {
        btn.classList.remove("on");
      }
    }
  }

  /** Call to recalibrate gyro to current position */
  public recalibrateGyro(): void {
    this.gyroCalibrated = false;
  }

  public update(dt: number): ControlState {
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

      // Q/E for camera rotation on desktop
      if (this.keysDown.has("q")) {
        this.controlState.cameraAngleOffset -= 0.03;
        this.cameraAutoReturn = 3.0;
      }
      if (this.keysDown.has("e")) {
        // Only camera if action not needed
      }
    }

    // Auto-return camera behind boat
    if (this.cameraAutoReturn > 0 && !this.cameraDragActive) {
      this.cameraAutoReturn -= dt;
      if (this.cameraAutoReturn <= 0) {
        // Smoothly return, handled in update via lerp flag
        this.cameraAutoReturn = -1; // signal: returning
      }
    }
    if (this.cameraAutoReturn < 0 && !this.cameraDragActive) {
      this.controlState.cameraAngleOffset *= 0.93;
      this.controlState.cameraPitchOffset *= 0.93;
      if (Math.abs(this.controlState.cameraAngleOffset) < 0.01 &&
          Math.abs(this.controlState.cameraPitchOffset) < 0.01) {
        this.controlState.cameraAngleOffset = 0;
        this.controlState.cameraPitchOffset = 0;
        this.cameraAutoReturn = 0;
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
    if (this.gyroListener) {
      window.removeEventListener("deviceorientation", this.gyroListener);
    }
  }
}
