import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { WaterSystem } from "./world/WaterSystem";
import { Environment } from "./world/Environment";
import { WakeEffect } from "./world/WakeEffect";
import { LanchaColectiva } from "./boat/LanchaColectiva";
import { MobileControls } from "./controls/MobileControls";
import { GameUI } from "./ui/GameUI";
import {
  CAMERA_HEIGHT,
  CAMERA_DISTANCE,
  CAMERA_LERP,
  GAME_DURATION,
  DOCK_LOCATIONS,
  PICKUP_RADIUS,
  SCORE_PER_PASSENGER,
  TIME_BONUS,
  RIVER_MAP,
} from "./utils/constants";
import { distance2D, lerp } from "./utils/helpers";

export class GameEngine {
  private engine: Engine;
  private scene!: Scene;
  private camera!: FreeCamera;
  private waterSystem!: WaterSystem;
  private environment!: Environment;
  private wakeEffect!: WakeEffect;
  private boat!: LanchaColectiva;
  private controls!: MobileControls;
  private ui!: GameUI;

  private gameStarted = false;
  private gameOver = false;
  private gameTime = 0;
  private score = 0;
  private totalDelivered = 0;
  private currentTargetDock = 0;
  private dockPassengers: Map<string, number> = new Map();
  private nearDock: string | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    // Adapt canvas to device pixel ratio for crisp rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      adaptToDeviceRatio: true,
    });

    // 1/dpr = native device resolution, capped at 2.5x to avoid GPU overload
    this.engine.setHardwareScalingLevel(1 / dpr);

    this.init();
  }

  private init(): void {
    this.updateLoadingBar(10, "Creando escena...");
    this.scene = new Scene(this.engine);

    // Camera
    this.camera = new FreeCamera(
      "camera",
      new Vector3(0, CAMERA_HEIGHT, -CAMERA_DISTANCE),
      this.scene
    );
    this.camera.setTarget(Vector3.Zero());
    this.camera.minZ = 0.5;
    this.camera.maxZ = 800;

    // Lighting
    const ambient = new HemisphericLight(
      "ambient",
      new Vector3(0, 1, 0),
      this.scene
    );
    ambient.intensity = 0.6;
    ambient.groundColor = new Color3(0.2, 0.3, 0.2);
    ambient.diffuse = new Color3(0.9, 0.9, 0.8);

    const sun = new DirectionalLight(
      "sun",
      new Vector3(-0.5, -1, 0.5),
      this.scene
    );
    sun.intensity = 0.7;
    sun.diffuse = new Color3(1, 0.95, 0.8);

    this.updateLoadingBar(30, "Generando ríos del Delta...");

    // Create water system
    this.waterSystem = new WaterSystem(this.scene);

    this.updateLoadingBar(50, "Construyendo islas y vegetación...");

    // Create environment
    this.environment = new Environment(this.scene, this.waterSystem);

    this.updateLoadingBar(70, "Preparando la lancha colectiva...");

    // Create boat at Estación Fluvial Tigre
    const startDock = DOCK_LOCATIONS[0];
    this.boat = new LanchaColectiva(
      this.scene,
      startDock.x + 5,
      startDock.z
    );

    // Wake effect
    this.wakeEffect = new WakeEffect(this.scene);

    // Add all scene meshes to water reflection/refraction
    this.waterSystem.addSceneToRenderList();

    this.updateLoadingBar(85, "Configurando controles...");

    // Controls
    this.controls = new MobileControls(this.scene);

    // Initialize dock passengers
    this.randomizeDockPassengers();

    this.updateLoadingBar(95, "Preparando interfaz...");

    // UI
    this.ui = new GameUI(this.scene);
    this.ui.onPlayClick(() => this.startGame());

    this.updateLoadingBar(100, "¡Listo!");

    // Hide loading screen
    setTimeout(() => {
      const loading = document.getElementById("loadingScreen");
      if (loading) {
        loading.style.opacity = "0";
        setTimeout(() => loading.remove(), 500);
      }
    }, 500);

    // Start render loop
    this.engine.runRenderLoop(() => this.gameLoop());

    // Handle resize
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  private updateLoadingBar(percent: number, text: string): void {
    const bar = document.getElementById("loadingBar");
    const loadText = document.getElementById("loadingText");
    if (bar) bar.style.width = `${percent}%`;
    if (loadText) loadText.textContent = text;
  }

  private randomizeDockPassengers(): void {
    for (const dock of DOCK_LOCATIONS) {
      this.dockPassengers.set(
        dock.name,
        Math.floor(Math.random() * 6) + 1
      );
    }
  }

  private startGame(): void {
    this.gameStarted = true;
    this.gameOver = false;
    this.gameTime = 0;
    this.score = 0;
    this.totalDelivered = 0;
    this.ui.hideStartScreen();
    this.ui.showNotification("¡Bienvenido al Delta! Navegá hasta las paradas", 3000);

    // Pick first target
    this.pickNextTarget();
  }

  private pickNextTarget(): void {
    // Pick a random dock that has passengers or is different from current
    const available = DOCK_LOCATIONS.filter((d, i) => {
      return i !== this.currentTargetDock;
    });
    const idx = Math.floor(Math.random() * available.length);
    this.currentTargetDock = DOCK_LOCATIONS.indexOf(available[idx]);
  }

  private gameLoop(): void {
    const dt = this.engine.getDeltaTime() / 1000;

    if (this.gameStarted && !this.gameOver) {
      this.gameTime += dt;

      // Check timer
      const timeLeft = GAME_DURATION - this.gameTime;
      if (timeLeft <= 0) {
        this.endGame();
        return;
      }

      // Update controls
      const controlState = this.controls.update(dt);
      this.boat.throttle = controlState.throttle;
      this.boat.steering = controlState.steering;

      // Update boat
      this.boat.update(
        dt,
        this.waterSystem,
        controlState.gyroSteering
      );

      // Update water
      this.waterSystem.update(dt);

      // Update wake
      this.wakeEffect.update(
        dt,
        this.boat.position.x,
        this.boat.position.z,
        this.boat.rotation,
        this.boat.speed
      );

      // Check dock proximity
      this.checkDocks(controlState.action);

      // Update camera
      this.updateCamera(dt, controlState.cameraAngleOffset, controlState.cameraPitchOffset);

      // Update UI
      this.ui.updateScore(this.score);
      this.ui.updatePassengers(this.boat.passengers);
      this.ui.updateTimer(timeLeft);
      this.ui.updateMinimap(
        this.boat.position.x,
        this.boat.position.z,
        this.boat.rotation
      );

      // Update location name
      this.updateLocationName();

      // Update next stop indicator
      const targetDock = DOCK_LOCATIONS[this.currentTargetDock];
      const dist = distance2D(
        this.boat.position.x,
        this.boat.position.z,
        targetDock.x,
        targetDock.z
      );
      this.ui.updateNextStop(targetDock.name, dist);
    } else {
      // Still update water animation even on menus
      this.waterSystem.update(dt);
    }

    this.scene.render();
  }

  private checkDocks(actionPressed: boolean): void {
    this.nearDock = null;

    for (const dock of DOCK_LOCATIONS) {
      const dist = distance2D(
        this.boat.position.x,
        this.boat.position.z,
        dock.x,
        dock.z
      );

      if (dist < PICKUP_RADIUS) {
        this.nearDock = dock.name;

        // Auto-slow near dock
        if (Math.abs(this.boat.speed) > 0.1) {
          // Show approach notification
        }

        if (actionPressed && Math.abs(this.boat.speed) < 0.15) {
          this.handleDockAction(dock);
        } else if (actionPressed) {
          this.ui.showNotification("¡Reducí la velocidad para parar!", 1500);
        }
        break;
      }
    }
  }

  private handleDockAction(dock: (typeof DOCK_LOCATIONS)[number]): void {
    const waitingPassengers = this.dockPassengers.get(dock.name) || 0;

    if (this.boat.passengers > 0) {
      // Drop off passengers
      const dropped = this.boat.dropPassengers();
      const points = dropped * SCORE_PER_PASSENGER;

      // Bonus for target dock
      const isTarget = DOCK_LOCATIONS[this.currentTargetDock].name === dock.name;
      const bonus = isTarget ? TIME_BONUS * dropped : 0;

      this.score += points + bonus;
      this.totalDelivered += dropped;

      this.ui.showNotification(
        `🚏 ${dock.name}\n👥 ${dropped} pasajeros bajaron\n⭐ +${points + bonus} puntos${bonus > 0 ? " (¡BONUS!)" : ""}`,
        2500
      );

      // Regenerate passengers at this dock
      this.dockPassengers.set(
        dock.name,
        Math.floor(Math.random() * 5) + 1
      );

      this.pickNextTarget();
    } else if (waitingPassengers > 0) {
      // Pick up passengers
      const picked = this.boat.addPassengers(waitingPassengers);
      this.dockPassengers.set(dock.name, waitingPassengers - picked);

      this.ui.showNotification(
        `🚏 ${dock.name}\n👥 ${picked} pasajeros subieron`,
        2000
      );

      if (this.currentTargetDock === DOCK_LOCATIONS.indexOf(dock as any)) {
        this.pickNextTarget();
      }
    } else {
      this.ui.showNotification(
        `🚏 ${dock.name}\nNo hay pasajeros esperando`,
        1500
      );
    }
  }

  private cameraLookTarget = Vector3.Zero();

  private updateCamera(dt: number, angleOffset: number, pitchOffset: number): void {
    // Camera orbits around the boat based on boat rotation + user angle offset
    const cameraAngle = this.boat.rotation + Math.PI + angleOffset;
    const dist = CAMERA_DISTANCE * 0.6;
    const height = CAMERA_HEIGHT + this.boat.speed * 3 + pitchOffset;

    const targetX = this.boat.position.x + Math.sin(cameraAngle) * dist;
    const targetZ = this.boat.position.z + Math.cos(cameraAngle) * dist;

    this.camera.position.x = lerp(
      this.camera.position.x,
      targetX,
      CAMERA_LERP
    );
    this.camera.position.z = lerp(
      this.camera.position.z,
      targetZ,
      CAMERA_LERP
    );
    this.camera.position.y = lerp(
      this.camera.position.y,
      height,
      CAMERA_LERP
    );

    // Look at boat
    this.cameraLookTarget.x = lerp(
      this.cameraLookTarget.x,
      this.boat.position.x,
      CAMERA_LERP * 2
    );
    this.cameraLookTarget.y = lerp(
      this.cameraLookTarget.y,
      this.boat.position.y + 2,
      CAMERA_LERP * 2
    );
    this.cameraLookTarget.z = lerp(
      this.cameraLookTarget.z,
      this.boat.position.z,
      CAMERA_LERP * 2
    );
    this.camera.setTarget(this.cameraLookTarget);
  }

  private updateLocationName(): void {
    // Find nearest river
    let nearestRiver = "Delta de Tigre";
    let minDist = Infinity;

    for (const river of RIVER_MAP) {
      for (const point of river.points) {
        const dist = distance2D(
          this.boat.position.x,
          this.boat.position.z,
          point[0],
          point[1]
        );
        if (dist < minDist) {
          minDist = dist;
          nearestRiver = river.name;
        }
      }
    }

    // Also show dock if nearby
    if (this.nearDock) {
      this.ui.updateLocation(`${nearestRiver} - 🚏 ${this.nearDock} (ESPACIO para parar)`);
    } else {
      this.ui.updateLocation(nearestRiver);
    }
  }

  private endGame(): void {
    this.gameOver = true;
    this.ui.showEndScreen(this.score, this.totalDelivered);
  }
}
