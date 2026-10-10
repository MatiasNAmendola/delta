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
import { WakeRibbon } from "./world/WakeRibbon";
import { r8Texture, SHORE_SDF_RANGE } from "./world/WaterSystem";
import { REFLECTIVITY_RES } from "./world/RiverBanks";
import { wakeOptions } from "./boat/boatTypes";
import { YolaTraffic } from "./world/Yolas";
import { Boat } from "./boat/Boat";
import { BOAT_TYPES, parseBoatType, type BoatTypeId, type BoatSpec } from "./boat/boatTypes";
import { currentZone, ZONES } from "./world/loadWorld";
import { COURTESY_SPEED } from "./world/rowingRoute";
import { Handling } from "./boat/handling";
import { compassName, fetchLiveConditions, isSudestada, levelOffset, SAN_FERNANDO_ALERT, windVector, type LiveConditions } from "./world/liveConditions";
import { handlingInput, handlingKeys, handlingMode, touchLabels } from "./controls/handlingInput";
import { controlScheme } from "./controls/MobileControls";
import { NO_WAKE_M, realWidthM, ROWING_ZONE_WAKE_M } from "./game/waterwayRules";
import { RiverLocator } from "./game/riverLocator";
import { froude, wakeAmplitude } from "./world/wakePhysics";
import { createMode, type GameMode } from "./game/modes";
import { probeChannel, RuleBook, ZONE_SPEED, type RuleEvent } from "./game/navigationRules";
import { Traffic } from "./world/Traffic";
import { Capybaras } from "./world/Capybaras";
import { generateCrossingZones } from "./game/capybaraZones";
import { Trash, TRASH_REACH } from "./world/Trash";
import { MobileControls } from "./controls/MobileControls";
import { GameUI } from "./ui/GameUI";
import { PROP_SCALE, CAMERA_LERP, METERS_PER_UNIT } from "./utils/constants";
import { findDock, type WaterArea, type WorldDoc } from "./world/WorldDoc";
import { distance2D, lerp } from "./utils/helpers";
import {
  defaultPolicy,
  nextResolution,
  type ResolutionPolicy,
  type ResolutionState,
} from "./utils/AdaptiveResolution";

/** Show the rowers' speed limit this far from them (their wake zone is 3 units). */
const ROWERS_WARNING = 10;

/** Fog color under a sudestada's low grey sky. */
const STORM_FOG = new Color3(0.52, 0.56, 0.58);

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
  private trash!: Trash;
  private spawn!: { x: number; z: number; heading: number };
  private controls!: MobileControls;
  private ui!: GameUI;

  /** `?fps=30` (remembered) caps the frame rate. */
  private readonly fpsCap = (() => {
    const param = new URLSearchParams(window.location.search).get("fps");
    if (param) safeStore("delta.fps", param);
    return Number(param ?? safeStorage("delta.fps") ?? 60) <= 30 ? 30 : 60;
  })();
  private gameStarted = false;
  /** The full map pauses the game. */
  private mapOpen = false;
  /** Camera angle around the boat while the title screen is up. */
  private menuOrbit = 0.6;
  private gameOver = false;
  private gameTime = 0;
  /** Game time when a sudestada blows in (Infinity: not this trip). */
  private sudestadaAt = Infinity;
  /** Today's real conditions, when the INA / Open-Meteo answered. */
  private live: LiveConditions | null = null;
  /** Shown where no river is named: the section of the Delta. */
  private get zoneName(): string {
    return ZONES.find((z) => z.id === currentZone())?.label.split(" · ")[1] ?? "Delta de Tigre";
  }
  /** Jump the camera to the boat on the next frame (after a teleport). */
  private snapCamera = false;
  private tideNoticeAt = Infinity;
  private baseFog: { color: Color3; density: number } | null = null;
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
    this.resolutionPolicy = defaultPolicy(window.devicePixelRatio || 1, isTouch, this.fpsCap);
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
    // No mouse picking (taps are handled by hand). Not performancePriority
    // Intermediate: it turns off the color clear, which on tile-based phone
    // GPUs makes them reload the previous frame from memory (ADR 0004)
    this.scene.skipPointerMovePicking = true;
    mark("escena");

    // Camera
    this.camera = new FreeCamera(
      "camera",
      new Vector3(0, 3, -8),
      this.scene
    );
    this.camera.setTarget(Vector3.Zero());
    this.camera.minZ = 0.05;
    // The fog hides everything past ~350 units: the far plane culls the chunks beyond
    this.camera.maxZ = this.aerialView ? 3000 : 420;

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
    // Today's real river and wind, if reachable (ADR 0008); ?clima=… keeps the simulation
    if (!new URLSearchParams(window.location.search).get("clima")) {
      void fetchLiveConditions().then((live) => {
        if (!live) return;
        this.live = live;
        const wind = live.windSpeed !== null && live.windFrom !== null ? windVector(live.windSpeed, live.windFrom) : null;
        this.waterSystem.conditions.useReal(
          live.height !== null ? levelOffset(live.height, METERS_PER_UNIT) : 0,
          live.rising ?? true,
          wind
        );
      });
    }

    await this.updateLoadingBar(50, "Construyendo islas y vegetación...");

    // Create environment
    this.environment = new Environment(this.scene, this.waterSystem, this.world, layout);
    this.connectShoreReflections();

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
    this.setupCapybaras(start, params.get("carpinchos") === "cerca"); // ADR 0018

    // `?boat=kayak` (or the last one chosen) preselects a boat
    const saved = params.get("boat") ?? safeStorage("delta.boat");
    this.selectBoat(parseBoatType(saved) ?? "colectiva");

    if (this.aerialView) this.scene.fogEnabled = false;

    // Start the camera behind the boat instead of flying in from the origin
    this.updateCamera(0, 0, 0, true);

    // Rowing club yolas on the rivers near the start, and moored by the docks
    this.yolas = new YolaTraffic(this.scene, this.world, this.waterSystem, start, this.environment.getMooredYolas());
    // Other lanchas colectivas on the big rivers, keeping right
    this.traffic = new Traffic(this.scene, this.world, this.waterSystem, start);
    // Floating trash to fish out with a tap
    this.trash = new Trash(this.scene, (x, z) => this.waterSystem.isWater(x, z));
    this.listenForTaps();

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
    let lastFrame = 0;
    this.engine.runRenderLoop(() => {
      // 30 fps mode (?fps=30): skip display refreshes to save battery and heat
      const now = performance.now();
      if (this.fpsCap <= 30 && now - lastFrame < 1000 / 30 - 4) return;
      lastFrame = now;
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
      ribbon: wakeOptions(this.spec),
    });
  }

  private startGame(): void {
    this.gameStarted = true;
    this.gameOver = false;
    this.gameTime = 0;
    this.score = 0;
    this.ui.hideStartScreen();
    // Optional realistic handling: wheel and telegraph, strokes, gears (ADR 0013),
    // with the Prefectura's per-river rules
    const realistic = handlingMode() === "realista" ? new Handling(this.spec) : null;
    this.rules = new RuleBook(this.spec, { strict: realistic !== null });
    this.controls.lever.set(0);
    this.boat.setHandling(realistic);
    this.controls.lever.notch = realistic?.kind === "rueda" ? 0.5 : 0.25;
    this.controls.setLabels(touchLabels(realistic?.kind ?? null));
    // Buttons, arrows, the ruedita joystick, or the on-screen palanca de mando and rueda de timón
    // (paddles and oars are stroked: they keep the buttons)
    const stroked = realistic?.kind === "kayak" || realistic?.kind === "single";
    const scheme = stroked ? "botones" : controlScheme();
    this.controls.setScheme(scheme, { telegraph: realistic?.kind === "rueda", wheelStays: realistic?.kind === "rueda" });
    // The palanca carries its own gauge; the ruedita only has the ring, so it keeps the HUD speed gauge
    this.ui.setGaugeVisible(scheme !== "palanca");
    this.controls.setKeysHint(handlingKeys(realistic?.kind ?? null));
    this.mode = createMode(this.spec.id, {
      scene: this.scene,
      world: this.world,
      boat: this.boat,
      berths: this.environment.getBerths(),
      isWater: (x, z) => this.waterSystem.isWater(x, z),
      start: this.spawn,
      notify: (message, ms) => this.ui.showNotification(message, ms),
      addScore: (points) => (this.score = Math.max(0, this.score + points)),
      placeBoat: (x, z, heading) => {
        this.boat.placeAt(x, z, heading, this.waterSystem);
        this.controls.lever.set(0);
        this.snapCamera = true;
      },
      current: (x, z) => this.waterSystem.conditions.current(x, z),
      level: () => this.waterSystem.level(),
    });
    this.mode.start();
    this.ui.showNotification(`${this.spec.name}
${this.spec.mission}`, 2800);
    // Some trips get a sudestada; ?clima=sudestada forces one, ?clima=calma none
    const clima = new URLSearchParams(window.location.search).get("clima");
    this.waterSystem.conditions.endSudestada();
    this.sudestadaAt =
      clima === "sudestada" ? 4 : clima === "calma" ? Infinity : this.live ? (isSudestada(this.live) ? 8 : Infinity) : Math.random() < 0.25 ? 50 + Math.random() * 70 : Infinity;
    this.tideNoticeAt = 3.2;
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
      const realistic = this.boat.realistic;
      if (realistic) {
        const helm = controlState.gyroSteering ?? controlState.steering;
        this.boat.handlingInput = handlingInput(realistic.kind, controlState.raw, controlState.throttle, helm, controlState.helmIsPosition);
      }

      // Update boat
      this.boat.update(
        dt,
        this.waterSystem,
        controlState.gyroSteering
      );

      // Update wake
      this.wakeEffect.update(
        dt,
        this.boat.position.x,
        this.boat.position.z,
        this.boat.rotation,
        this.boat.speed,
        this.waterSystem.level()
      );

      // The river, rowers, other lanchas and floating trash keep moving
      this.updateRiver(dt);
      this.checkRowers();
      this.checkTraffic();
      this.applyRules(dt);

      // The boat's own game: passengers, buoys, corners or time trial
      this.mode!.update(dt, controlState.action);

      // Update camera
      this.updateCamera(dt, controlState.cameraAngleOffset, controlState.cameraPitchOffset, this.snapCamera);
      this.snapCamera = false;

      // Update UI
      // Rowers ahead come first: their limit is the one that fines on the spot
      const rowers = this.rules?.has("wakeCourtesy") && this.yolas.nearestCrew(this.boat.position.x, this.boat.position.z) < ROWERS_WARNING;
      const status = this.boat.realistic?.status();
      const zoneLimit = rowers ? COURTESY_SPEED : this.rules?.zone === "sinola" ? this.wakeSpeedLimit(NO_WAKE_M) : this.rules?.zone === "remo" ? this.wakeSpeedLimit(ROWING_ZONE_WAKE_M) : this.rules?.zone ? ZONE_SPEED : null;
      const zoneName = rowers ? "Remeros · despacio" : this.rules?.zone === "sinola" ? "Sin ola" : this.rules?.zone === "remo" ? "Zona de remo" : this.rules?.zone ? `${this.rules.zone === "arroyo" ? "Arroyo" : "Muelle"} · despacio` : null;
      const leverValue = status ? status.lever : this.controls.lever.value;
      this.controls.showLever(
        leverValue,
        this.boat.speed / this.spec.maxSpeed,
        zoneLimit,
        zoneName ?? status?.label ?? (leverValue === 0 ? "Neutro" : leverValue < 0 ? "Atrás" : `${Math.round(leverValue * 100)}%`)
      );
      this.ui.updateThrottle(
        status ? status.lever : this.controls.lever.value,
        this.boat.speed / this.spec.maxSpeed,
        rowers ? "remeros" : (this.rules?.zone ?? null),
        rowers ? COURTESY_SPEED : this.rules?.zone === "sinola" ? this.wakeSpeedLimit(NO_WAKE_M) : this.rules?.zone === "remo" ? this.wakeSpeedLimit(ROWING_ZONE_WAKE_M) : ZONE_SPEED,
        status ? status.label : undefined
      );
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
      this.updateRiver(dt);
      this.boat.update(dt, this.waterSystem, null);
      // Behind the title screen the camera circles the lancha slowly
      if (!this.gameStarted) {
        this.menuOrbit += dt * 0.07;
        this.updateCamera(dt, this.menuOrbit, 0, false, true);
      }
    }

    // Trees and grass stream in around the camera
    this.environment.update(dt, this.camera.position, this.boat.position, this.waterSystem.level());

    this.scene.render();
  }

  /**
   * Waves bounce off the banks (ADR 0012): wooden tablestacados reflect
   * ~90%, natural banks very little. The wake shader and the boats'
   * buoyancy both use it.
   */
  private connectShoreReflections(): void {
    const banks = this.environment.banks;
    if (!banks) return;
    const water = this.waterSystem;
    WakeRibbon.shore = {
      sdf: water.createShoreDistanceTexture(),
      kr: r8Texture(this.scene, "reflectividad", banks.reflectivity, REFLECTIVITY_RES),
      worldSize: this.world.world.size,
      sdfRange: SHORE_SDF_RANGE,
    };
    const range = 2;
    water.conditions.wall = (x, z) => {
      const d = -water.shoreDistance(x, z, range);
      if (d <= 0 || d >= range * 0.95) return null;
      const e = 0.15;
      let nx = water.shoreDistance(x + e, z, range) - water.shoreDistance(x - e, z, range);
      let nz = water.shoreDistance(x, z + e, range) - water.shoreDistance(x, z - e, range);
      const len = Math.hypot(nx, nz) || 1;
      nx /= len;
      nz /= len;
      const kr = banks.krAt(x, z) * (1 - Math.max(0, (d - range * 0.6) / (range * 0.35)));
      return kr > 0.01 ? { mx: x + nx * 2 * d, mz: z + nz * 2 * d, kr } : null;
    };
  }

  /** Tide, current, wind and wakes; everything afloat follows the level. */
  private updateRiver(dt: number): void {
    const { x, z } = this.boat.position;
    const water = this.waterSystem;
    const conditions = water.conditions;
    if (this.gameStarted && !this.gameOver) {
      if (this.gameTime >= this.tideNoticeAt) {
        this.tideNoticeAt = Infinity;
        const live = this.live;
        if (live && (live.height !== null || live.windSpeed !== null)) {
          const parts: string[] = [];
          if (live.height !== null) parts.push(`${live.height.toFixed(2).replace(".", ",")} m, ${live.rising ? "creciente" : "bajante"}`);
          if (live.windSpeed !== null && live.windFrom !== null) parts.push(`viento ${compassName(live.windFrom)} ${Math.round(live.windSpeed)} km/h`);
          const warn = live.height !== null && live.height >= SAN_FERNANDO_ALERT ? "\n¡Río en alerta!" : "";
          this.ui.showNotification(`Hoy en San Fernando: ${parts.join(" · ")}${warn}\n(INA · Open-Meteo)`, 4200);
        } else {
          this.ui.showNotification(
            conditions.tideTrend() === "creciente"
              ? "Marea creciente: la corriente sube el río"
              : "Marea bajante: la corriente baja hacia el Río de la Plata",
            3000
          );
        }
      }
      if (this.gameTime >= this.sudestadaAt) {
        this.sudestadaAt = Infinity;
        conditions.startSudestada();
        this.ui.showNotification("¡Se larga la sudestada!\nEl río crece, la corriente se da vuelta y se pica", 4200);
      }
    }
    // A sudestada greys out the sky
    const scene = this.scene;
    this.baseFog ??= { color: scene.fogColor.clone(), density: scene.fogDensity };
    const storm = conditions.sudestada.intensity;
    Color3.LerpToRef(this.baseFog.color, STORM_FOG, storm, scene.fogColor);
    scene.fogDensity = this.baseFog.density * (1 + storm * 0.9);
    water.update(dt, this.boat.position);
    const level = water.level();
    this.yolas.update(dt, level);
    this.capybaras?.update(dt, x, z, level);
    this.traffic.update(dt, level);
    // Passing lanchas rock the boat with their wake
    water.conditions.wakes = this.traffic.wakes(x, z, 20);
    this.trash.update(dt, x, z, level, (px, pz) => water.conditions.current(px, pz));
  }

  /**
   * A tap or click on the river (not a camera drag: short and still)
   * fishes out the trash under it if it is within reach of the boat.
   */
  private listenForTaps(): void {
    let down: { x: number; y: number; t: number } | null = null;
    this.canvas.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.canvas.addEventListener("pointerup", (e) => {
      const start = down;
      down = null;
      if (!start || !this.gameStarted || this.gameOver || this.mapOpen || e.button > 0) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12 || performance.now() - start.t > 450) return;
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { x, z } = this.boat.position;
      const got = this.trash.tryCollect(px, py, this.camera, x, z);
      if (got) {
        this.score += got.credits;
        this.ui.floatCredits(e.clientX, e.clientY, `+${got.credits}`, got.name);
      } else if (this.trash.outOfReachAt(px, py, this.camera, x, z)) {
        this.ui.floatCredits(e.clientX, e.clientY, "Acercate más", `alcance ${Math.round(TRASH_REACH * 8)} m`);
      }
    });
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
      this.penalize(BUMP_PENALTY, `¡Chocaste un bote de remo!\n−${BUMP_PENALTY} puntos`);
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
      via: this.currentVia,
      wakeHeight: this.wakeNow(),
      fauna: this.capybaras ? { speedMps: this.speedMps(), families: this.capybaras.views(x, z) } : undefined,
    });
    for (const e of events) {
      if (e.scareFamily !== undefined) this.capybaras?.scare(e.scareFamily, x, z);
      this.showRule(e);
    }
  }

  private showRule(e: RuleEvent): void {
    if (e.rule === "carpinchos" && e.penalty < 0) {
      // «¡Respetaste a los carpinchos! +N» already says the points
      this.score -= e.penalty;
      this.ui.showNotification(e.message, 2800);
    } else if (e.penalty > 0) this.penalize(e.penalty, `${e.message}\n−${e.penalty} puntos`);
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
    const { x, z } = this.boat.position;
    // Inside a named water area (real OSM shape)? That name wins
    const area = this.namedAreaAt(x, z);
    // Else the channel the boat is in, by distance to each stretch (riverLocator.ts)
    this.riverLocator ??= new RiverLocator(this.world.rivers);
    const hit = area === null ? this.riverLocator.at(x, z) : null;
    const nearestRiver = area ?? hit?.name ?? this.zoneName;
    const onRiver: string | null = area ?? (hit?.inside ? hit.name : null);
    this.currentVia = onRiver ? { name: onRiver, width: realWidthM(onRiver) } : null;
    this.ui.updateLocation(nearestRiver, this.mode?.hint() ?? null);
  }

  /** Height (m) of the wave the boat makes at its current speed (wakePhysics.ts). */
  private wakeNow(ratio = Math.abs(this.boat.speed) / this.spec.maxSpeed): number {
    const o = wakeOptions(this.spec);
    return wakeAmplitude({ U: Math.max(0, ratio) * o.topSpeed, L: o.length, beam: o.beam, height: o.height, topFroude: froude(o.topSpeed, o.length), hull: o.hull });
  }

  /** Fraction of top speed at which the boat starts making a wave above `limit` (m). */
  private wakeSpeedLimit(limit: number): number {
    for (let r = 0.05; r <= 1; r += 0.01) if (this.wakeNow(r) > limit) return r;
    return 1;
  }

  // --- Capybara families crossing the arroyos (ADR 0018) ---
  private capybaras: Capybaras | null = null;

  /** Real speed of the boat (m/s). */
  private speedMps(): number {
    return (Math.abs(this.boat.speed) / this.spec.maxSpeed) * wakeOptions(this.spec).topSpeed;
  }

  /**
   * Generates the crossing zones from the world (natural banks, narrow,
   * away from docks and the zone's center) and puts the families there.
   * `?carpinchos=cerca` starts the boat a short way upstream of the nearest one.
   */
  private setupCapybaras(start: { x: number; z: number }, near: boolean): void {
    const banks = this.environment.banks;
    const zones = generateCrossingZones({
      rivers: this.world.rivers.map((r) => ({ name: r.name, points: r.points })),
      isWater: (x, z) => this.waterSystem.isWater(x, z),
      krAt: (x, z) => (banks ? banks.krAt(x, z) : 1),
      avoid: [{ x: start.x, z: start.z, r: 40 }, ...this.world.docks.map((d) => ({ x: d.x, z: d.z, r: 14 }))],
      seed: [...this.world.world.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
    });
    this.capybaras = new Capybaras(this.scene, zones);
    if (!near || zones.length === 0) return;
    const zone = zones.reduce((best, z) => (Math.hypot(z.x - start.x, z.z - start.z) < Math.hypot(best.x - start.x, best.z - start.z) ? z : best));
    for (const sign of [-1, 1]) {
      const x = zone.x - zone.along[0] * 26 * sign;
      const z = zone.z - zone.along[1] * 26 * sign;
      if (!this.waterSystem.isWater(x, z)) continue;
      this.spawn = { x, z, heading: Math.atan2(zone.along[0] * sign, zone.along[1] * sign) };
      return;
    }
  }

  private riverLocator: RiverLocator | null = null;
  /** The river or arroyo the boat is on (for its rules). */
  private currentVia: { name: string; width: number } | null = null;
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
    const summary = this.mode!.summary(this.score);
    if (this.trash.collected > 0) summary.stats.push({ value: this.trash.collected, label: "residuos sacados del río" });
    this.ui.showEndScreen(this.score, summary, this.spec.name);
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
