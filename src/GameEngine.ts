import * as THREE from "three";

import { WaterSystem } from "./world/WaterSystem";
import { Environment } from "./world/Environment";
import { WakeEffect } from "./world/WakeEffect";
import { GrassSystem } from "./world/GrassSystem";
import { WeatherSystem } from "./world/WeatherSystem";
import { Atmosphere } from "./world/Atmosphere";
import { ForestSystem } from "./world/ForestSystem";
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
import { PostProcessing } from "./rendering/PostProcessing";
import { PerformanceOptimizer, type QualitySettings } from "./rendering/PerformanceOptimizer";

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock: THREE.Clock;

  private waterSystem!: WaterSystem;
  private environment!: Environment;
  private wakeEffect!: WakeEffect;
  private grassSystem!: GrassSystem;
  private weatherSystem!: WeatherSystem;
  private atmosphere!: Atmosphere;
  private forestSystem!: ForestSystem;
  private boat!: LanchaColectiva;
  private controls!: MobileControls;
  private ui!: GameUI;
  private postProcessing!: PostProcessing;
  private perfOptimizer!: PerformanceOptimizer;

  private gameStarted = false;
  private gameOver = false;
  private gameTime = 0;
  private score = 0;
  private totalDelivered = 0;
  private currentTargetDock = 0;
  private dockPassengers: Map<string, number> = new Map();
  private nearDock: string | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile && dpr <= 1.5,
      alpha: false,      // opaque = faster compositing
      stencil: false,    // save GPU memory
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Shadows: desktop only (per research: biggest mobile perf killer)
    if (!isMobile) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.clock = new THREE.Clock();
    this.init();
  }

  private dbg(msg: string): void {
    const fn = (window as any).__debugLog;
    if (fn) fn(msg);
    console.log("[init]", msg);
  }

  private init(): void {
    // === ONLY create UI — zero rendering, zero GPU work ===
    this.ui = new GameUI();
    this.ui.onPlayClick(() => this.onJugarPressed());
    this.ui.onWeatherChange((preset) => this.weatherSystem?.setWeather(preset as any));

    // Hide loading screen immediately — we don't need it until world loads
    const loading = document.getElementById("loadingScreen");
    if (loading) loading.remove();
  }

  /** Called when JUGAR is tapped — builds the entire world then starts the game */
  private async onJugarPressed(): Promise<void> {
    const debug = (window as any).__debugLog || console.log;
    debug("JUGAR pressed! Loading world...");

    // Show loading state on button
    const btn = document.getElementById("playBtn");
    if (btn) { btn.textContent = "⏳ Cargando..."; btn.style.pointerEvents = "none"; }

    // Give the browser a frame to update the button text
    await new Promise(r => setTimeout(r, 50));

    const yield_ = () => new Promise<void>(r => setTimeout(r, 16));

    // === MINIMAL SCENE — no fog, no weather, no effects ===
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // sky blue
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 800);
    this.camera.position.set(0, CAMERA_HEIGHT, -CAMERA_DISTANCE);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Simple lights — nothing fancy
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(50, 100, 50);
    this.scene.add(sun);

    debug("scene OK");
    await yield_();

    // Water
    try { this.waterSystem = new WaterSystem(this.scene); debug("water OK"); } catch (e) { debug("WATER FAIL: " + e); }
    await yield_();

    // Environment (terrain + trees + houses + docks)
    try { this.environment = new Environment(this.scene, this.waterSystem); debug("env OK"); } catch (e) { debug("ENV FAIL: " + e); }
    await yield_();

    // Boat
    try {
      const startDock = DOCK_LOCATIONS[0];
      this.boat = new LanchaColectiva(this.scene, startDock.x + 5, startDock.z);
      this.scene.add(this.boat.rootNode);
      debug("boat OK");
    } catch (e) { debug("BOAT FAIL: " + e); }
    await yield_();

    // Controls
    try { this.controls = new MobileControls(this.canvas); debug("controls OK"); } catch (e) { debug("controls: " + e); }

    // Wake (lightweight)
    try { this.wakeEffect = new WakeEffect(this.scene); } catch (e) { /* skip */ }

    this.randomizeDockPassengers();
    debug("World loaded! Starting game...");

    // Handle resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postProcessing?.setSize(window.innerWidth, window.innerHeight);
    });

    // NOW start the game and render loop
    this.startGame();
    this.clock.start();
    this.animate();
  }

  /** Load all world systems in steps, yielding between each to keep the page responsive */
  // loadWorldAsync removed — world is now loaded in onJugarPressed()

  /**
   * Walk the scene graph and enable castShadow / receiveShadow on relevant objects.
   * - Terrain (ground plane): receiveShadow
   * - Dock meshes: receiveShadow + castShadow
   * - Trees (ProcTreeMesh), houses, boat: castShadow
   * - InstancedMesh (forest): castShadow
   */
  private enableSceneShadows(): void {
    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh)) return;

      const name = (obj.name || "").toLowerCase();
      const parentName = (obj.parent?.name || "").toLowerCase();

      // Terrain ground mesh — receive shadows
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
        obj.receiveShadow = true;
      }

      // Dock meshes — receive AND cast shadows
      if (
        parentName.includes("dock") ||
        name.includes("dock") ||
        name.includes("platform") ||
        name.includes("plank") ||
        name.includes("stilt")
      ) {
        obj.receiveShadow = true;
        obj.castShadow = true;
      }

      // Tree meshes (ProcTreeMesh) — cast shadows
      if (
        name.includes("trunk") ||
        name.includes("twig") ||
        name.includes("tree") ||
        name.includes("willow") ||
        name.includes("poplar")
      ) {
        obj.castShadow = true;
      }

      // Forest instanced meshes — cast shadows
      if (obj instanceof THREE.InstancedMesh) {
        obj.castShadow = true;
      }

      // Houses — cast and receive shadows
      if (
        parentName.includes("house") ||
        name.includes("wall") ||
        name.includes("roof") ||
        name.includes("peak") ||
        name.includes("door")
      ) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }

      // Boat meshes — cast and receive shadows
      if (
        parentName === "lancha" ||
        parentName.includes("lanchamodel") ||
        name === "hull" ||
        name === "deck" ||
        name === "cabin" ||
        name === "roof" ||
        name === "bow" ||
        name === "pilot" ||
        name.startsWith("side_")
      ) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }

      // Vegetation GLB clones — cast shadows
      if (parentName.includes("vegtemplate") || parentName.includes("bush") || parentName.includes("flower")) {
        obj.castShadow = true;
      }
    });

    // Explicitly enable shadows on the boat root node children
    this.boat.rootNode.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.gameLoop();
  };

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

  /** Apply quality settings from the performance optimizer to subsystems */
  private applyQualitySettings(s: QualitySettings): void {
    // Grass visibility
    if (this.grassSystem) {
      this.grassSystem.setVisible(s.grass);
    }
    // Fog density multiplier applied to weather system
    if (this.weatherSystem) {
      this.weatherSystem.setFogDensityMultiplier(s.fogDensityMultiplier);
    }
    // Wake effect visibility
    if (this.wakeEffect) {
      this.wakeEffect.setFoamEnabled(s.wakeFoam);
      this.wakeEffect.setTrailsEnabled(s.wakeTrails);
    }
    // Rain limit
    if (this.weatherSystem) {
      this.weatherSystem.setMaxRainParticles(s.maxRainParticles);
    }
    console.log(`[GameEngine] Quality applied: ${this.perfOptimizer.quality}`);
  }

  private gameLoop(): void {
    const dt = this.clock.getDelta();

    // Update performance optimizer every frame
    this.perfOptimizer?.update(dt);

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

      // Update systems (optional chaining for resilience)
      this.boat?.update(dt, this.waterSystem, controlState.gyroSteering);
      this.waterSystem?.update(dt);
      this.grassSystem?.update(dt);
      this.weatherSystem?.update(dt, this.boat?.position?.x ?? 0, this.boat?.position?.z ?? 0);
      this.weatherSystem?.applyWaterFogBoost(
        this.waterSystem?.isWater(this.boat?.position?.x ?? 0, this.boat?.position?.z ?? 0) ?? false
      );
      this.atmosphere?.update(dt, this.weatherSystem?.sunPosition, this.boat?.position?.x ?? 0, this.boat?.position?.z ?? 0);
      this.weatherSystem?.updateShadowCamera(this.boat?.position?.x ?? 0, this.boat?.position?.y ?? 0, this.boat?.position?.z ?? 0);
      this.wakeEffect?.update(dt, this.boat?.position?.x ?? 0, this.boat?.position?.z ?? 0, this.boat?.rotation ?? 0, this.boat?.speed ?? 0);

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
      this.waterSystem?.update(dt);
    }

    // Render through postprocessing pipeline, or fall back to direct rendering
    if (this.postProcessing?.enabled) {
      this.postProcessing.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
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

  private cameraLookTarget = new THREE.Vector3(0, 0, 0);

  private updateCamera(dt: number, angleOffset: number, pitchOffset: number): void {
    // Camera behind and slightly above the boat — third-person chase cam
    const cameraAngle = this.boat.rotation + Math.PI + angleOffset;
    const dist = CAMERA_DISTANCE;
    const height = CAMERA_HEIGHT + this.boat.speed * 1.5 + pitchOffset;

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

    // Look ahead of the boat (not at the boat itself) so the horizon is visible
    const lookAhead = 6 + Math.abs(this.boat.speed) * 15;
    const lookX = this.boat.position.x + Math.sin(this.boat.rotation) * lookAhead;
    const lookZ = this.boat.position.z + Math.cos(this.boat.rotation) * lookAhead;

    this.cameraLookTarget.x = lerp(
      this.cameraLookTarget.x,
      lookX,
      CAMERA_LERP * 2
    );
    this.cameraLookTarget.y = lerp(
      this.cameraLookTarget.y,
      this.boat.position.y + 1.2,
      CAMERA_LERP * 2
    );
    this.cameraLookTarget.z = lerp(
      this.cameraLookTarget.z,
      lookZ,
      CAMERA_LERP * 2
    );
    this.camera.lookAt(this.cameraLookTarget);
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
