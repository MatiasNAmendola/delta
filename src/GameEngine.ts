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
    // Cap pixel ratio for mobile performance (2 is plenty on high-DPI screens)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: dpr <= 1.5,   // disable AA on high-DPI (pixels already tiny)
      alpha: true,
      stencil: true,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Enable shadow maps with soft shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.clock = new THREE.Clock();

    this.init();
  }

  private init(): void {
    this.updateLoadingBar(10, "Creando escena...");
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.5,
      800
    );
    this.camera.position.set(0, CAMERA_HEIGHT, -CAMERA_DISTANCE);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    // NOTE: No default ambient/directional lights — WeatherSystem manages all lighting
    // (hemisphere light, sun with cascaded shadows, rim back-light).

    // Weather system handles sky, lights, fog, rain, shadows, rim light
    this.weatherSystem = new WeatherSystem(this.scene);

    // Initialize environment map generation (needs renderer for PMREM)
    this.weatherSystem.initEnvironmentMap(this.renderer);

    // Atmospheric effects — god rays and ambient particles
    this.atmosphere = new Atmosphere(this.scene, this.camera, this.renderer);

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

    // Grass system — thin instances with wind shader
    this.grassSystem = new GrassSystem(this.scene, this.waterSystem);

    // Dense instanced forest (8 tree templates, hundreds of thin instances)
    this.forestSystem = new ForestSystem(this.scene, this.waterSystem);

    // Enable castShadow / receiveShadow on all relevant scene objects
    this.enableSceneShadows();

    // Add all scene meshes to water reflection/refraction
    this.waterSystem.addSceneToRenderList();

    this.updateLoadingBar(85, "Configurando controles...");

    // Controls — pass scene as any until MobileControls is migrated
    this.controls = new MobileControls(this.scene as any);

    // Initialize dock passengers
    this.randomizeDockPassengers();

    this.updateLoadingBar(95, "Preparando interfaz...");

    this.ui = new GameUI();
    this.ui.onPlayClick(() => this.startGame());
    this.ui.onWeatherChange((preset) => this.weatherSystem.setWeather(preset as any));

    // Postprocessing pipeline (bloom, DOF, color grading, vignette, SSAO)
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);

    // Performance optimizer — measures FPS, auto-adjusts quality
    this.perfOptimizer = new PerformanceOptimizer(
      this.renderer,
      this.scene,
      this.camera
    );
    this.perfOptimizer.setDebug(true);
    this.perfOptimizer.onChange((settings: QualitySettings) => {
      this.applyQualitySettings(settings);
    });

    this.updateLoadingBar(100, "¡Listo!");

    // Hide loading screen
    setTimeout(() => {
      const loading = document.getElementById("loadingScreen");
      if (loading) {
        loading.style.opacity = "0";
        setTimeout(() => loading.remove(), 500);
      }
    }, 500);

    // Start render loop via requestAnimationFrame
    this.clock.start();
    this.animate();

    // Handle resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postProcessing.setSize(window.innerWidth, window.innerHeight);
      // Re-cap pixel ratio on orientation change / resize
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        this.perfOptimizer.settings.maxPixelRatio
      );
      this.renderer.setPixelRatio(dpr);
    });
  }

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
    this.perfOptimizer.update(dt);

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

      // Update grass wind animation
      this.grassSystem.update(dt);

      // Update weather (transitions, rain follows boat)
      this.weatherSystem.update(dt, this.boat.position.x, this.boat.position.z);

      // Apply humidity fog boost when boat is over water
      this.weatherSystem.applyWaterFogBoost(
        this.waterSystem.isWater(this.boat.position.x, this.boat.position.z)
      );

      // Update atmospheric effects (god rays + ambient particles)
      this.atmosphere.update(
        dt,
        this.weatherSystem.sunPosition,
        this.boat.position.x,
        this.boat.position.z
      );

      // Update shadow camera to follow the boat each frame for optimal shadow quality
      this.weatherSystem.updateShadowCamera(
        this.boat.position.x,
        this.boat.position.y,
        this.boat.position.z
      );

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

    // Render through postprocessing pipeline, or fall back to direct rendering
    if (this.postProcessing.enabled) {
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
