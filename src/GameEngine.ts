import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gsap } from "gsap";
import { mark, PERF_ENABLED, showPerfPanel } from "./utils/perf";
import { loadLayout } from "./world/layout/loadLayout";

import { WaterSystem } from "./world/WaterSystem";
import { Environment } from "./world/Environment";
import { WakeEffect } from "./world/WakeEffect";
import { YolaTraffic } from "./world/Yolas";
import { Boat } from "./boat/Boat";
import { BOAT_TYPES, isBoatType, type BoatTypeId, type BoatSpec } from "./boat/boatTypes";
import { createMode, type GameMode } from "./game/modes";
import { probeChannel, RuleBook, type RuleEvent } from "./game/navigationRules";
import { Traffic } from "./world/Traffic";
import { MobileControls } from "./controls/MobileControls";
import { GameUI } from "./ui/GameUI";
import { PROP_SCALE, CAMERA_LERP } from "./utils/constants";
import { findDock, type WaterArea, type WorldDoc } from "./world/WorldDoc";
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
  private boat!: Boat;
  private spec: BoatSpec = BOAT_TYPES.colectiva;
  private mode: GameMode | null = null;
  private rules: RuleBook | null = null;
  private traffic!: Traffic;
  private spawn!: { x: number; z: number; heading: number };
  private controls!: MobileControls;
  private ui!: GameUI;

  private gameStarted = false;
  /** The full map pauses the game. */
  private mapOpen = false;
  /** Camera angle around the boat while the title screen is up. */
  private menuOrbit = 0.6;
  private gameOver = false;
  private gameTime = 0;
  private score = 0;
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
    mark("escena");

    // Camera
    this.camera = new FreeCamera(
      "camera",
      new Vector3(0, 3, -8),
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
    const { layout, origin } = await loadLayout(this.world);
    mark(`mundo (${origin})`);
    this.waterSystem = new WaterSystem(this.scene, this.world, layout);

    await this.updateLoadingBar(50, "Construyendo islas y vegetación...");

    // Create environment
    this.environment = new Environment(this.scene, this.waterSystem, this.world, layout);

    await this.updateLoadingBar(70, "Preparando las embarcaciones...");

    // Start alongside the spawn dock's muelle (docks are moved to the bank);
    // the authored offset is the fallback when no berth was computed.
    // `?spawn=<dock-id>`: start at another stop (handy to review docks)
    const params = new URLSearchParams(window.location.search);
    const spawnParam = params.get("spawn");
    const startDock = findDock(
      this.world,
      spawnParam && this.world.docks.some((d) => d.id === spawnParam) ? spawnParam : this.world.spawn.dock
    );
    const [offsetX, offsetZ] = this.world.spawn.offset;
    const berth = this.environment.getBerths().get(startDock.id);
    const start = berth ?? { x: startDock.x + offsetX, z: startDock.z + offsetZ };
    this.spawn = { x: start.x, z: start.z, heading: berth?.heading ?? 0 };

    // `?boat=kayak` (or the last one chosen) preselects a boat
    const saved = params.get("boat") ?? safeStorage("delta.boat");
    this.selectBoat(isBoatType(saved) ? saved : "colectiva");

    if (this.aerialView) this.scene.fogEnabled = false;

    // Start the camera behind the boat instead of flying in from the origin
    this.updateCamera(0, 0, 0, true);

    // Rowing club yolas on the rivers near the start, and moored by the docks
    this.yolas = new YolaTraffic(this.scene, this.world, this.waterSystem, start, this.environment.getMooredYolas());
    // Other lanchas colectivas on the big rivers, keeping right
    this.traffic = new Traffic(this.scene, this.world, this.waterSystem, start);

    await this.updateLoadingBar(85, "Configurando controles...");

    mark("botes y tráfico");
    // Controls
    this.controls = new MobileControls(this.scene);

    await this.updateLoadingBar(95, "Preparando interfaz...");

    // UI
    this.ui = new GameUI(this.scene, this.world, layout);
    this.ui.onMapToggle((open) => (this.mapOpen = open));
    mark("interfaz");

    await this.updateLoadingBar(100, "¡Listo!");

    // The loader lifts away over the live river, then the title screen comes in
    const loading = document.getElementById("loadingScreen");
    const showTitle = () => {
      loading?.remove();
      this.ui.showStartScreen(this.spec.id, (id) => this.selectBoat(id));
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

    // Start render loop; the first frame compiles every shader
    let firstFrame = true;
    this.engine.runRenderLoop(() => {
      this.gameLoop();
      if (firstFrame) {
        firstFrame = false;
        mark("primer cuadro");
      }
    });
    if (PERF_ENABLED) showPerfPanel(this.engine, this.scene);

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

  /** Swaps the boat at the start (title screen): model, wake, physics. */
  private selectBoat(id: BoatTypeId): void {
    if (this.gameStarted) return;
    this.spec = BOAT_TYPES[id];
    safeStore("delta.boat", id);
    this.boat?.dispose();
    this.wakeEffect?.dispose();
    this.boat = new Boat(this.scene, this.spec, this.spawn.x, this.spawn.z, this.world.rules.boatCapacity);
    this.boat.placeAt(this.spawn.x, this.spawn.z, this.spawn.heading, this.waterSystem);
    this.wakeEffect = new WakeEffect(this.scene, {
      length: this.spec.length,
      maxSpeed: this.spec.maxSpeed,
      strength: this.spec.wake,
    });
  }

  private startGame(): void {
    this.gameStarted = true;
    this.gameOver = false;
    this.gameTime = 0;
    this.score = 0;
    this.ui.hideStartScreen();
    this.rules = new RuleBook(this.spec);
    this.mode = createMode(this.spec.id, {
      scene: this.scene,
      world: this.world,
      boat: this.boat,
      berths: this.environment.getBerths(),
      isWater: (x, z) => this.waterSystem.isWater(x, z),
      start: this.spawn,
      notify: (message, ms) => this.ui.showNotification(message, ms),
      addScore: (points) => (this.score = Math.max(0, this.score + points)),
    });
    this.mode.start();
    this.ui.showNotification(`${this.spec.name}
${this.spec.mission}`, 2800);
  }

  private gameLoop(): void {
    // The full map covers the screen: skip the 3D frame (battery, and the map stays smooth)
    if (this.mapOpen) return;
    const dt = this.engine.getDeltaTime() / 1000;
    this.adaptResolution(dt);

    if (this.gameStarted && !this.gameOver && !this.mapOpen) {
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

      // Rowers and other lanchas keep moving
      this.yolas.update(dt);
      this.traffic.update(dt);
      this.checkRowers();
      this.checkTraffic();
      this.applyRules(dt);

      // The boat's own game: passengers, buoys, corners or time trial
      this.mode!.update(dt, controlState.action);

      // Update camera
      this.updateCamera(dt, controlState.cameraAngleOffset, controlState.cameraPitchOffset);

      // Update UI
      this.ui.updateScore(this.score);
      const second = this.mode!.secondary();
      this.ui.updateSecondary(second.label, second.value);
      this.ui.updateTimer(timeLeft);
      this.updateLocationName();
      const target = this.mode!.target();
      this.ui.updateMap(this.boat.position.x, this.boat.position.z, this.boat.rotation, target ? { x: target.x, z: target.z, label: target.name } : null);
      if (target) {
        this.ui.updateNextStop(target.label, target.name, distance2D(this.boat.position.x, this.boat.position.z, target.x, target.z));
      }
    } else {
      // Still update water, rowers and traffic even on menus
      this.waterSystem.update(dt);
      this.yolas.update(dt);
      this.traffic.update(dt);
      this.boat.update(dt, this.waterSystem, null);
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

  /** Delta etiquette: never hit the rowers; motor boats also slow down passing them. */
  private checkRowers(): void {
    const event = this.yolas.checkLancha(
      this.boat.position.x,
      this.boat.position.z,
      this.rules?.has("wakeCourtesy") ? this.boat.speed / this.spec.maxSpeed : 0
    );
    if (event === "bump") {
      this.boat.speed *= -0.3;
      this.penalize(BUMP_PENALTY, `¡Chocaste una yola!\n−${BUMP_PENALTY} puntos`);
    } else if (event === "wake") {
      this.penalize(WAKE_PENALTY, `Despacio cerca de los remeros\nTu ola los mojó: −${WAKE_PENALTY} puntos`);
    }
  }

  private checkTraffic(): void {
    if (this.traffic.collides(this.boat.position.x, this.boat.position.z, this.spec.length)) {
      this.boat.speed *= -0.3;
      this.penalize(BUMP_PENALTY, `¡Cuidado con las lanchas!\n−${BUMP_PENALTY} puntos`);
    }
  }

  /** Navigation rules of this boat: warnings and fines. */
  private applyRules(dt: number): void {
    if (!this.rules) return;
    const { x, z } = this.boat.position;
    let dockDistance = Infinity;
    for (const b of this.environment.getBerths().values()) dockDistance = Math.min(dockDistance, distance2D(x, z, b.x, b.z));
    const events = this.rules.update(dt, {
      x,
      z,
      heading: this.boat.rotation,
      speed: this.boat.speed,
      probe: probeChannel((px, pz) => this.waterSystem.isWater(px, pz), x, z, this.boat.rotation),
      distanceToDock: dockDistance,
      wakes: this.traffic.wakesNear(x, z),
    });
    for (const e of events) this.showRule(e);
  }

  private showRule(e: RuleEvent): void {
    if (e.penalty > 0) this.penalize(e.penalty, `${e.message}\n−${e.penalty} puntos`);
    else if (e.penalty < 0) {
      this.score -= e.penalty;
      this.ui.showNotification(`${e.message}\n+${-e.penalty} puntos`, 1800);
    } else this.ui.showNotification(e.message, 2200);
  }

  private penalize(points: number, message: string): void {
    this.score = Math.max(0, this.score - points);
    this.ui.showNotification(message, 2400);
  }

  private cameraLookTarget = Vector3.Zero();

  private updateCamera(dt: number, angleOffset: number, pitchOffset: number, snap = false, cinematic = false): void {
    // Camera orbits around the boat based on boat rotation + user angle offset
    const cameraAngle = this.boat.rotation + Math.PI + angleOffset;
    // `?view=aerial`: high bird's-eye camera to review the map (e.g. after a map update)
    // Title screen: a wide, low establishing shot circling the boat
    const { distance: camDistance, height: camHeight } = this.spec.camera;
    const dist = this.aerialView ? 300 : cinematic ? camDistance * 1.8 : camDistance;
    // Camera drag offsets were tuned for the old, 3.5x bigger props
    const baseHeight = this.aerialView
      ? 450
      : cinematic
        ? camHeight * 1.6
        : Math.max(0.3, camHeight + this.boat.speed * 3 + pitchOffset * PROP_SCALE * (camHeight / 2.3));
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
          free = Math.max(camDistance * 0.4, d - 0.5);
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
      this.boat.position.y + camHeight * 0.3,
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

    this.ui.updateLocation(nearestRiver, this.mode?.hint() ?? null);
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
    this.ui.showEndScreen(this.score, this.mode!.summary(this.score), this.spec.name);
  }
}

const WAKE_PENALTY = 50;
const BUMP_PENALTY = 100;

function safeStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: just don't remember */
  }
}

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
