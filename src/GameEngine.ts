import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gsap } from "gsap";

import { WaterSystem } from "./world/WaterSystem";
import { Environment } from "./world/Environment";
import { WakeEffect } from "./world/WakeEffect";
import { YolaTraffic } from "./world/Yolas";
import { LanchaColectiva } from "./boat/LanchaColectiva";
import { MobileControls } from "./controls/MobileControls";
import { GameUI } from "./ui/GameUI";
import {
  BOAT_MAX_SPEED,
  PROP_SCALE,
  CAMERA_HEIGHT,
  CAMERA_DISTANCE,
  CAMERA_LERP,
} from "./utils/constants";
import { findDock, type Dock, type WaterArea, type WorldDoc } from "./world/WorldDoc";
import { distance2D, lerp } from "./utils/helpers";
import {
  defaultPolicy,
  nextResolution,
  type ResolutionPolicy,
  type ResolutionState,
} from "./utils/AdaptiveResolution";

export class GameEngine {
  private engine: Engine;
  private scene!: Scene;
  private camera!: FreeCamera;
  private waterSystem!: WaterSystem;
  private environment!: Environment;
  private wakeEffect!: WakeEffect;
  private yolas!: YolaTraffic;
  private boat!: LanchaColectiva;
  private controls!: MobileControls;
  private ui!: GameUI;

  private gameStarted = false;
  /** Camera angle around the boat while the title screen is up. */
  private menuOrbit = 0.6;
  private gameOver = false;
  private gameTime = 0;
  private score = 0;
  private totalDelivered = 0;
  private currentTargetDock = 0;
  private dockPassengers: Map<string, number> = new Map();
  private nearDock: string | null = null;
  private resolutionPolicy: ResolutionPolicy;
  private resolution: ResolutionState;
  private fpsWindowTime = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly world: WorldDoc
  ) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      adaptToDeviceRatio: true,
    });

    // Start sharp (capped pixel ratio) and let FPS drive the resolution
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.resolutionPolicy = defaultPolicy(window.devicePixelRatio || 1, isTouch);
    this.resolution = { level: this.resolutionPolicy.minLevel, goodWindows: 0 };
    this.engine.setHardwareScalingLevel(this.resolution.level);

    this.namedAreas = (this.world.waterAreas ?? [])
      .filter((a) => a.name)
      .map((a) => ({ area: a, bounds: ringBounds(a.outer) }));

    void this.init();
  }

  private async init(): Promise<void> {
    await this.updateLoadingBar(10, "Creando escena...");
    this.scene = new Scene(this.engine);

    // Camera
    this.camera = new FreeCamera(
      "camera",
      new Vector3(0, CAMERA_HEIGHT, -CAMERA_DISTANCE),
      this.scene
    );
    this.camera.setTarget(Vector3.Zero());
    this.camera.minZ = 0.05;
    this.camera.maxZ = this.aerialView ? 3000 : 800;

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

    await this.updateLoadingBar(30, "Generando ríos del Delta...");

    // Create water system
    this.waterSystem = new WaterSystem(this.scene, this.world);

    await this.updateLoadingBar(50, "Construyendo islas y vegetación...");

    // Create environment
    this.environment = new Environment(this.scene, this.waterSystem, this.world);

    await this.updateLoadingBar(70, "Preparando la lancha colectiva...");

    // Create boat at the world's spawn dock
    // Start alongside the spawn dock's muelle (docks are moved to the bank);
    // the authored offset is the fallback when no berth was computed
    // `?spawn=<dock-id>`: start at another stop (handy to review docks)
    const spawnParam = new URLSearchParams(window.location.search).get("spawn");
    const startDock = findDock(
      this.world,
      spawnParam && this.world.docks.some((d) => d.id === spawnParam) ? spawnParam : this.world.spawn.dock
    );
    const [offsetX, offsetZ] = this.world.spawn.offset;
    const berth = this.environment.getBerths().get(startDock.id);
    const start = berth ?? { x: startDock.x + offsetX, z: startDock.z + offsetZ };
    this.boat = new LanchaColectiva(
      this.scene,
      start.x,
      start.z,
      this.world.rules.boatCapacity
    );
    this.boat.placeAt(start.x, start.z, berth?.heading ?? 0, this.waterSystem);

    if (this.aerialView) this.scene.fogEnabled = false;

    // Start the camera behind the boat instead of flying in from the origin
    this.updateCamera(0, 0, 0, true);

    // Wake effect
    this.wakeEffect = new WakeEffect(this.scene);

    // Rowing club yolas on the rivers near the start, and moored by the docks
    this.yolas = new YolaTraffic(this.scene, this.world, this.waterSystem, start, this.environment.getMooredYolas());

    await this.updateLoadingBar(85, "Configurando controles...");

    // Controls
    this.controls = new MobileControls(this.scene);

    // Initialize dock passengers
    this.randomizeDockPassengers();

    await this.updateLoadingBar(95, "Preparando interfaz...");

    // UI
    this.ui = new GameUI(this.scene, this.world);

    await this.updateLoadingBar(100, "¡Listo!");

    // The loader lifts away over the live river, then the title screen comes in
    const loading = document.getElementById("loadingScreen");
    const showTitle = () => {
      loading?.remove();
      this.ui.showStartScreen();
      this.ui.onPlayClick(() => this.startGame());
    };
    if (loading) {
      gsap
        .timeline({ delay: 0.3, onComplete: showTitle })
        .to(loading.children, { y: -24, opacity: 0, filter: "blur(6px)", duration: 0.7, stagger: 0.05, ease: "expo.in" })
        .to(loading, { opacity: 0, duration: 0.8, ease: "power2.inOut" }, "-=0.3");
    } else {
      showTitle();
    }

    // Start render loop
    this.engine.runRenderLoop(() => this.gameLoop());

    // Handle resize
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  /** Every 2 s, lower or raise the render resolution based on FPS. */
  private adaptResolution(dt: number): void {
    this.fpsWindowTime += dt;
    if (this.fpsWindowTime < 2) return;
    this.fpsWindowTime = 0;
    const next = nextResolution(this.resolution, this.engine.getFps(), this.resolutionPolicy);
    if (next.level !== this.resolution.level) {
      this.engine.setHardwareScalingLevel(next.level);
    }
    this.resolution = next;
  }

  /** Updates the loader, then yields a frame so it is actually painted between build steps. */
  private async updateLoadingBar(percent: number, text: string): Promise<void> {
    const bar = document.getElementById("loadingBar");
    const loadText = document.getElementById("loadingText");
    if (bar) bar.style.width = `${percent}%`;
    if (loadText) loadText.textContent = text;
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  /** Where the boat has to be to serve a dock: alongside the muelle, on the water. */
  private stopPoint(dock: Dock): { x: number; z: number } {
    return this.environment.getBerths().get(dock.id) ?? dock;
  }

  private randomizeDockPassengers(): void {
    for (const dock of this.world.docks) {
      this.dockPassengers.set(
        dock.id,
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
    this.ui.showNotification("Buen viaje\nSeguí la próxima parada", 2600);

    // Pick first target
    this.pickNextTarget();
  }

  /**
   * Next stop: one of the few closest docks to the boat (not the one it is at
   * now, nor the current target), so every trip fits the clock even on the
   * 22 km real map instead of sending the player across the whole Delta.
   */
  private pickNextTarget(): void {
    const { x, z } = this.boat.position;
    const candidates = this.world.docks
      .map((dock, index) => {
        const stop = this.stopPoint(dock);
        return { index, dist: distance2D(x, z, stop.x, stop.z) };
      })
      .filter(({ index, dist }) =>
        index !== this.currentTargetDock && dist > this.world.rules.pickupRadius * 2
      )
      .sort((a, b) => a.dist - b.dist)
      .slice(0, NEXT_STOP_CHOICES);
    if (candidates.length === 0) return;
    this.currentTargetDock = candidates[Math.floor(Math.random() * candidates.length)].index;
  }

  private gameLoop(): void {
    const dt = this.engine.getDeltaTime() / 1000;
    this.adaptResolution(dt);

    if (this.gameStarted && !this.gameOver) {
      this.gameTime += dt;

      // Check timer
      const timeLeft = this.world.rules.durationSec - this.gameTime;
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

      // Rowers: they keep rowing, and complain about reckless lanchas
      this.yolas.update(dt);
      this.checkRowers();

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
      const targetDock = this.world.docks[this.currentTargetDock];
      const targetStop = this.stopPoint(targetDock);
      const dist = distance2D(
        this.boat.position.x,
        this.boat.position.z,
        targetStop.x,
        targetStop.z
      );
      this.ui.updateNextStop(targetDock.name, dist);
    } else {
      // Still update water and rowers even on menus
      this.waterSystem.update(dt);
      this.yolas.update(dt);
      // Behind the title screen the camera circles the lancha slowly
      if (!this.gameStarted) {
        this.menuOrbit += dt * 0.07;
        this.updateCamera(dt, this.menuOrbit, 0, false, true);
      }
    }

    // Trees and grass stream in around the camera
    this.environment.update(dt, this.camera.position);

    this.scene.render();
  }

  /** Delta etiquette: slow down near rowers, and never hit them. */
  private checkRowers(): void {
    const event = this.yolas.checkLancha(
      this.boat.position.x,
      this.boat.position.z,
      this.boat.speed / BOAT_MAX_SPEED
    );
    if (event === "bump") {
      this.boat.speed *= -0.3;
      this.score = Math.max(0, this.score - BUMP_PENALTY);
      this.ui.showNotification(`¡Chocaste una yola!\n−${BUMP_PENALTY} puntos`, 2200);
    } else if (event === "wake") {
      this.score = Math.max(0, this.score - WAKE_PENALTY);
      this.ui.showNotification(`Despacio cerca de los remeros\nTu ola los mojó: −${WAKE_PENALTY} puntos`, 2500);
    }
  }

  private checkDocks(actionPressed: boolean): void {
    this.nearDock = null;

    for (const dock of this.world.docks) {
      const stop = this.stopPoint(dock);
      const dist = distance2D(
        this.boat.position.x,
        this.boat.position.z,
        stop.x,
        stop.z
      );

      if (dist < this.world.rules.pickupRadius) {
        this.nearDock = dock.name;

        // Auto-slow near dock
        if (Math.abs(this.boat.speed) > 0.1) {
          // Show approach notification
        }

        if (actionPressed && Math.abs(this.boat.speed) < BOAT_MAX_SPEED * 0.4) {
          this.handleDockAction(dock);
        } else if (actionPressed) {
          this.ui.showNotification("¡Reducí la velocidad para parar!", 1500);
        }
        break;
      }
    }
  }

  private handleDockAction(dock: Dock): void {
    const waitingPassengers = this.dockPassengers.get(dock.id) || 0;

    if (this.boat.passengers > 0) {
      // Drop off passengers
      const dropped = this.boat.dropPassengers();
      const points = dropped * this.world.rules.scorePerPassenger;

      // Bonus for target dock
      const isTarget = this.world.docks[this.currentTargetDock].id === dock.id;
      const bonus = isTarget ? this.world.rules.timeBonusPerPassenger * dropped : 0;

      this.score += points + bonus;
      this.totalDelivered += dropped;

      this.ui.showNotification(
        `${dock.name}\n${dropped} pasajeros bajaron · +${points + bonus} puntos${bonus > 0 ? " · bonus de parada" : ""}`,
        2500
      );

      // Regenerate passengers at this dock
      this.dockPassengers.set(
        dock.id,
        Math.floor(Math.random() * 5) + 1
      );

      this.pickNextTarget();
    } else if (waitingPassengers > 0) {
      // Pick up passengers
      const picked = this.boat.addPassengers(waitingPassengers);
      this.dockPassengers.set(dock.id, waitingPassengers - picked);

      this.ui.showNotification(
        `${dock.name}\nSubieron ${picked} pasajeros`,
        2000
      );

      if (this.currentTargetDock === this.world.docks.indexOf(dock)) {
        this.pickNextTarget();
      }
    } else {
      this.ui.showNotification(
        `${dock.name}\nNo hay pasajeros esperando`,
        1500
      );
    }
  }

  private cameraLookTarget = Vector3.Zero();

  private updateCamera(dt: number, angleOffset: number, pitchOffset: number, snap = false, cinematic = false): void {
    // Camera orbits around the boat based on boat rotation + user angle offset
    const cameraAngle = this.boat.rotation + Math.PI + angleOffset;
    // `?view=aerial`: high bird's-eye camera to review the map (e.g. after a map update)
    // Title screen: a wide, low establishing shot circling the boat
    const dist = this.aerialView ? 300 : cinematic ? CAMERA_DISTANCE * 1.8 : CAMERA_DISTANCE;
    // Camera drag offsets were tuned for the old, 3.5x bigger props
    const baseHeight = this.aerialView
      ? 450
      : cinematic
        ? CAMERA_HEIGHT * 1.6
        : Math.max(0.6, CAMERA_HEIGHT + this.boat.speed * 3 + pitchOffset * PROP_SCALE);
    // Snapping (lerp factor 1) jumps straight to the boat, e.g. at spawn.
    // CAMERA_LERP is per 60 fps frame; convert so smoothing feels the same at any FPS.
    const frames = Math.min(dt, 0.1) * 60;
    const follow = snap ? 1 : 1 - Math.pow(1 - CAMERA_LERP, frames);
    const look = snap ? 1 : 1 - Math.pow(1 - CAMERA_LERP * 2, frames);

    let targetX = this.boat.position.x + Math.sin(cameraAngle) * dist;
    let targetZ = this.boat.position.z + Math.cos(cameraAngle) * dist;
    let raise = 0;
    if (!this.aerialView && !cinematic) {
      // Keep the camera over the water: over the bank it ends up inside the
      // trees. Pull it in towards the boat and lift it to keep the view.
      let free = dist;
      for (let d = 0.5; d <= dist; d += 0.5) {
        const x = this.boat.position.x + Math.sin(cameraAngle) * d;
        const z = this.boat.position.z + Math.cos(cameraAngle) * d;
        if (!this.waterSystem.isWater(x, z)) {
          free = Math.max(CAMERA_MIN_DISTANCE, d - 0.5);
          break;
        }
      }
      targetX = this.boat.position.x + Math.sin(cameraAngle) * free;
      targetZ = this.boat.position.z + Math.cos(cameraAngle) * free;
      raise = (dist - free) * 0.35;
    }

    this.camera.position.x = lerp(
      this.camera.position.x,
      targetX,
      follow
    );
    this.camera.position.z = lerp(
      this.camera.position.z,
      targetZ,
      follow
    );
    this.camera.position.y = lerp(
      this.camera.position.y,
      baseHeight + raise,
      follow
    );

    // Look at boat
    this.cameraLookTarget.x = lerp(
      this.cameraLookTarget.x,
      this.boat.position.x,
      look
    );
    this.cameraLookTarget.y = lerp(
      this.cameraLookTarget.y,
      this.boat.position.y + 2,
      look
    );
    this.cameraLookTarget.z = lerp(
      this.cameraLookTarget.z,
      this.boat.position.z,
      look
    );
    this.camera.setTarget(this.cameraLookTarget);
  }

  private updateLocationName(): void {
    // Inside a named water area (real OSM shape)? That name wins
    let nearestRiver = this.namedAreaAt(this.boat.position.x, this.boat.position.z) ?? "Delta de Tigre";
    let minDist = nearestRiver === "Delta de Tigre" ? Infinity : -1;

    for (const river of this.world.rivers) {
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
      const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      this.ui.updateLocation(`${nearestRiver} · Muelle ${this.nearDock} · ${touch ? "tocá PARADA" : "ESPACIO para parar"}`);
    } else {
      this.ui.updateLocation(nearestRiver);
    }
  }

  private readonly aerialView = new URLSearchParams(window.location.search).get("view") === "aerial";
  private namedAreas: Array<{ area: WaterArea; bounds: [number, number, number, number] }> = [];

  private namedAreaAt(x: number, z: number): string | null {
    for (const { area, bounds } of this.namedAreas) {
      if (x < bounds[0] || x > bounds[2] || z < bounds[1] || z > bounds[3]) continue;
      if (pointInRing(x, z, area.outer) && !area.holes.some((h) => pointInRing(x, z, h))) return area.name!;
    }
    return null;
  }

  private endGame(): void {
    this.gameOver = true;
    this.ui.showEndScreen(this.score, this.totalDelivered);
  }
}

const WAKE_PENALTY = 50;
const BUMP_PENALTY = 100;

/** Closest the chase camera gets to the boat when the bank is right behind it. */
const CAMERA_MIN_DISTANCE = 3;

/** How many of the nearest docks the next stop is drawn from. */
const NEXT_STOP_CHOICES = 3;

function ringBounds(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z);
  }
  return [minX, minZ, maxX, maxZ];
}

function pointInRing(x: number, z: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
