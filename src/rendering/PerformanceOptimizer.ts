/**
 * PerformanceOptimizer — Measures FPS, auto-adjusts quality, and provides
 * a preset system (low / medium / high) for mobile performance tuning.
 *
 * Usage:
 *   const optimizer = new PerformanceOptimizer(renderer, scene, camera);
 *   // In game loop:
 *   optimizer.update(deltaTime);
 *   // Read current quality:
 *   optimizer.quality          // "low" | "medium" | "high"
 *   optimizer.settings         // per-effect on/off flags
 */
import * as THREE from "three";

export type QualityPreset = "low" | "medium" | "high";

export interface QualitySettings {
  /** Enable grass rendering */
  grass: boolean;
  /** Enable rain particles */
  rain: boolean;
  /** Enable wake foam particles */
  wakeFoam: boolean;
  /** Enable wake trail ribbons */
  wakeTrails: boolean;
  /** Max pixel ratio sent to the renderer */
  maxPixelRatio: number;
  /** Shadow map size (0 = shadows off) */
  shadowMapSize: number;
  /** Camera far plane */
  cameraFar: number;
  /** Fog density multiplier (1 = default; higher = more fog, hides distant objects) */
  fogDensityMultiplier: number;
  /** Max rain particles (0 = off) */
  maxRainParticles: number;
  /** Max foam particles */
  maxFoamParticles: number;
  /** Enable vegetation models (bushes, flowers) */
  vegetation: boolean;
  /** Enable antialias (only at init; stored for reference) */
  antialias: boolean;
}

const PRESET_SETTINGS: Record<QualityPreset, QualitySettings> = {
  low: {
    grass: false,
    rain: false,
    wakeFoam: false,
    wakeTrails: true,
    maxPixelRatio: 1,
    shadowMapSize: 0,
    cameraFar: 400,
    fogDensityMultiplier: 2.0,
    maxRainParticles: 0,
    maxFoamParticles: 0,
    vegetation: false,
    antialias: false,
  },
  medium: {
    grass: true,
    rain: true,
    wakeFoam: true,
    wakeTrails: true,
    maxPixelRatio: 1.5,
    shadowMapSize: 512,
    cameraFar: 600,
    fogDensityMultiplier: 1.2,
    maxRainParticles: 1000,
    maxFoamParticles: 200,
    vegetation: true,
    antialias: true,
  },
  high: {
    grass: true,
    rain: true,
    wakeFoam: true,
    wakeTrails: true,
    maxPixelRatio: 2,
    shadowMapSize: 1024,
    cameraFar: 800,
    fogDensityMultiplier: 1.0,
    maxRainParticles: 2000,
    maxFoamParticles: 400,
    vegetation: true,
    antialias: true,
  },
};

/** Number of recent frames to average for FPS measurement */
const FPS_SAMPLE_COUNT = 60;

/** If average FPS drops below this for DOWNGRADE_FRAMES consecutive samples, downgrade */
const FPS_LOW_THRESHOLD = 28;
/** If average FPS is above this for UPGRADE_FRAMES consecutive samples, upgrade */
const FPS_HIGH_THRESHOLD = 50;

const DOWNGRADE_AFTER_SECONDS = 3;
const UPGRADE_AFTER_SECONDS = 8;

export class PerformanceOptimizer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private _quality: QualityPreset = "high";
  private _settings: QualitySettings;

  // FPS tracking
  private frameTimes: number[] = [];
  private frameIndex = 0;
  private currentFps = 60;

  // Auto-adjust timers
  private lowFpsTime = 0;
  private highFpsTime = 0;
  private autoAdjust = true;

  // Debug
  private debugLogTimer = 0;
  private debugEnabled = false;

  // Callbacks that systems register so the optimizer can toggle them
  private onSettingsChange: Array<(s: QualitySettings) => void> = [];

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    startingPreset?: QualityPreset
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Detect mobile / low-end GPU and pick a sensible default
    const preset = startingPreset ?? this.detectBestPreset();
    this._quality = preset;
    this._settings = { ...PRESET_SETTINGS[preset] };

    this.applySettings();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get quality(): QualityPreset {
    return this._quality;
  }

  get settings(): Readonly<QualitySettings> {
    return this._settings;
  }

  get fps(): number {
    return this.currentFps;
  }

  /** Register a callback invoked whenever quality settings change */
  public onChange(cb: (s: QualitySettings) => void): void {
    this.onSettingsChange.push(cb);
  }

  /** Manually set a quality preset (disables auto-adjust for 10 s) */
  public setQuality(preset: QualityPreset): void {
    if (preset === this._quality) return;
    this._quality = preset;
    this._settings = { ...PRESET_SETTINGS[preset] };
    this.applySettings();
    this.notifyListeners();
    // Pause auto for a bit so we don't immediately override the user's choice
    this.lowFpsTime = 0;
    this.highFpsTime = 0;
  }

  /** Enable or disable auto quality adjustment */
  public setAutoAdjust(enabled: boolean): void {
    this.autoAdjust = enabled;
  }

  /** Enable debug logging (renderer.info every 5 s) */
  public setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  /** Call once per frame */
  public update(dt: number): void {
    // Track frame times
    if (this.frameTimes.length < FPS_SAMPLE_COUNT) {
      this.frameTimes.push(dt);
    } else {
      this.frameTimes[this.frameIndex % FPS_SAMPLE_COUNT] = dt;
    }
    this.frameIndex++;

    // Compute average FPS
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    this.currentFps = this.frameTimes.length / sum;

    // Auto-adjust
    if (this.autoAdjust) {
      if (this.currentFps < FPS_LOW_THRESHOLD) {
        this.lowFpsTime += dt;
        this.highFpsTime = 0;
        if (this.lowFpsTime > DOWNGRADE_AFTER_SECONDS) {
          this.downgrade();
          this.lowFpsTime = 0;
        }
      } else if (this.currentFps > FPS_HIGH_THRESHOLD) {
        this.highFpsTime += dt;
        this.lowFpsTime = 0;
        if (this.highFpsTime > UPGRADE_AFTER_SECONDS) {
          this.upgrade();
          this.highFpsTime = 0;
        }
      } else {
        this.lowFpsTime = 0;
        this.highFpsTime = 0;
      }
    }

    // Debug logging
    if (this.debugEnabled) {
      this.debugLogTimer += dt;
      if (this.debugLogTimer > 5) {
        this.debugLogTimer = 0;
        this.logRendererInfo();
      }
    }
  }

  /** Log renderer.info for profiling draw calls, triangles, textures */
  public logRendererInfo(): void {
    const info = this.renderer.info;
    console.log(
      `[PerfOptimizer] FPS: ${this.currentFps.toFixed(1)} | ` +
        `Quality: ${this._quality} | ` +
        `Draw calls: ${info.render.calls} | ` +
        `Triangles: ${info.render.triangles} | ` +
        `Textures: ${info.memory.textures} | ` +
        `Geometries: ${info.memory.geometries}`
    );
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private detectBestPreset(): QualityPreset {
    // Use a handful of heuristics to pick a starting quality
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    const maxTex = this.renderer.capabilities.maxTextureSize;
    const dpr = window.devicePixelRatio || 1;
    const screenPixels = window.innerWidth * dpr * window.innerHeight * dpr;

    if (isMobile || screenPixels < 1_000_000 || maxTex <= 4096) {
      return "low";
    }
    if (screenPixels < 2_500_000) {
      return "medium";
    }
    return "high";
  }

  private downgrade(): void {
    const order: QualityPreset[] = ["high", "medium", "low"];
    const idx = order.indexOf(this._quality);
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      console.log(
        `[PerfOptimizer] Downgrading quality: ${this._quality} -> ${next} (FPS: ${this.currentFps.toFixed(1)})`
      );
      this.setQuality(next);
    }
  }

  private upgrade(): void {
    const order: QualityPreset[] = ["low", "medium", "high"];
    const idx = order.indexOf(this._quality);
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      console.log(
        `[PerfOptimizer] Upgrading quality: ${this._quality} -> ${next} (FPS: ${this.currentFps.toFixed(1)})`
      );
      this.setQuality(next);
    }
  }

  private applySettings(): void {
    const s = this._settings;

    // Pixel ratio
    const dpr = Math.min(window.devicePixelRatio || 1, s.maxPixelRatio);
    this.renderer.setPixelRatio(dpr);

    // Camera far plane
    this.camera.far = s.cameraFar;
    this.camera.updateProjectionMatrix();

    // Fog density multiplier — applied by consumers via onChange callback
  }

  private notifyListeners(): void {
    for (const cb of this.onSettingsChange) {
      cb(this._settings);
    }
  }
}
