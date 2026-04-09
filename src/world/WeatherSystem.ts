/**
 * WeatherSystem — Controls sky, lighting, fog, and rain particles.
 * Provides weather presets (morning, noon, sunset, night, storm)
 * with smooth transitions between states.
 */
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { SkyMaterial } from "@babylonjs/materials/sky/skyMaterial";
import { WATER_LEVEL } from "../utils/constants";

export type WeatherPreset = "morning" | "noon" | "sunset" | "night" | "storm";

interface WeatherState {
  sunPosition: Vector3;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  luminance: number;
  fogDensity: number;
  fogColor: Color3;
  ambientIntensity: number;
  ambientDiffuse: Color3;
  ambientGround: Color3;
  sunIntensity: number;
  sunDiffuse: Color3;
  rainRate: number;
}

const PRESETS: Record<WeatherPreset, WeatherState> = {
  morning: {
    sunPosition: new Vector3(-50, 20, 30),
    turbidity: 8, rayleigh: 2, mieCoefficient: 0.005, mieDirectionalG: 0.8, luminance: 1.0,
    fogDensity: 0.0012, fogColor: new Color3(0.75, 0.8, 0.85),
    ambientIntensity: 0.5, ambientDiffuse: new Color3(0.85, 0.8, 0.7), ambientGround: new Color3(0.2, 0.25, 0.2),
    sunIntensity: 0.6, sunDiffuse: new Color3(1, 0.9, 0.7),
    rainRate: 0,
  },
  noon: {
    sunPosition: new Vector3(0, 80, 20),
    turbidity: 5, rayleigh: 1.5, mieCoefficient: 0.003, mieDirectionalG: 0.76, luminance: 1.1,
    fogDensity: 0.0008, fogColor: new Color3(0.7, 0.78, 0.85),
    ambientIntensity: 0.7, ambientDiffuse: new Color3(0.95, 0.95, 0.9), ambientGround: new Color3(0.25, 0.3, 0.2),
    sunIntensity: 0.9, sunDiffuse: new Color3(1, 1, 0.95),
    rainRate: 0,
  },
  sunset: {
    sunPosition: new Vector3(60, 5, -40),
    turbidity: 15, rayleigh: 4, mieCoefficient: 0.02, mieDirectionalG: 0.9, luminance: 1.0,
    fogDensity: 0.002, fogColor: new Color3(0.8, 0.55, 0.35),
    ambientIntensity: 0.4, ambientDiffuse: new Color3(0.9, 0.6, 0.3), ambientGround: new Color3(0.15, 0.1, 0.1),
    sunIntensity: 0.5, sunDiffuse: new Color3(1, 0.6, 0.2),
    rainRate: 0,
  },
  night: {
    sunPosition: new Vector3(0, -20, 30),
    turbidity: 2, rayleigh: 0.5, mieCoefficient: 0.001, mieDirectionalG: 0.7, luminance: 0.01,
    fogDensity: 0.003, fogColor: new Color3(0.03, 0.04, 0.08),
    ambientIntensity: 0.15, ambientDiffuse: new Color3(0.1, 0.12, 0.2), ambientGround: new Color3(0.02, 0.03, 0.05),
    sunIntensity: 0.05, sunDiffuse: new Color3(0.2, 0.25, 0.4),
    rainRate: 0,
  },
  storm: {
    sunPosition: new Vector3(-30, 15, 20),
    turbidity: 25, rayleigh: 3, mieCoefficient: 0.05, mieDirectionalG: 0.65, luminance: 0.6,
    fogDensity: 0.004, fogColor: new Color3(0.35, 0.38, 0.4),
    ambientIntensity: 0.3, ambientDiffuse: new Color3(0.5, 0.52, 0.55), ambientGround: new Color3(0.1, 0.12, 0.1),
    sunIntensity: 0.2, sunDiffuse: new Color3(0.6, 0.6, 0.6),
    rainRate: 800,
  },
};

export class WeatherSystem {
  private scene: Scene;
  private skyMat: SkyMaterial;
  private ambient: HemisphericLight;
  private sun: DirectionalLight;
  private rainSystem: ParticleSystem;
  private current: WeatherState;
  private target: WeatherState;
  private transitioning = false;
  private transitionTime = 0;
  private transitionDuration = 2.0; // seconds

  constructor(scene: Scene) {
    this.scene = scene;

    // --- Sky ---
    const skybox = MeshBuilder_CreateBox("sky", { size: 2000 }, scene);
    this.skyMat = new SkyMaterial("skyMat", scene);
    this.skyMat.backFaceCulling = false;
    this.skyMat.useSunPosition = true;
    skybox.material = this.skyMat;
    skybox.infiniteDistance = true;

    // --- Lights ---
    this.ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    this.sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.5), scene);

    // --- Rain particle system ---
    this.rainSystem = this.createRainSystem();

    // --- Initialize to morning ---
    this.current = { ...PRESETS.morning };
    this.target = { ...PRESETS.morning };
    this.applyState(this.current);

    // Fog
    scene.fogMode = Scene.FOGMODE_EXP2;
  }

  private createRainSystem(): ParticleSystem {
    // Rain drop texture
    const size = 16;
    const tex = new DynamicTexture("rainTex", size, this.scene, false);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, size, size);
    // Vertical streak
    ctx.fillStyle = "rgba(200, 210, 220, 0.6)";
    ctx.fillRect(size / 2 - 1, 0, 2, size);
    tex.update(true);
    tex.hasAlpha = true;

    const ps = new ParticleSystem("rain", 2000, this.scene);
    ps.particleTexture = tex;
    ps.emitter = new Vector3(0, 60, 0);
    ps.minEmitBox = new Vector3(-100, 0, -100);
    ps.maxEmitBox = new Vector3(100, 0, 100);
    ps.direction1 = new Vector3(-0.2, -1, -0.1);
    ps.direction2 = new Vector3(0.2, -1, 0.1);
    ps.minEmitPower = 30;
    ps.maxEmitPower = 50;
    ps.minSize = 0.1;
    ps.maxSize = 0.15;
    ps.minScaleY = 3;
    ps.maxScaleY = 6;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 1.5;
    ps.color1 = new Color4(0.7, 0.75, 0.8, 0.4);
    ps.color2 = new Color4(0.6, 0.65, 0.7, 0.3);
    ps.colorDead = new Color4(0.5, 0.55, 0.6, 0.0);
    ps.gravity = new Vector3(0, -9.8, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.emitRate = 0;
    ps.start();
    return ps;
  }

  /** Set weather preset with smooth transition */
  public setWeather(preset: WeatherPreset): void {
    this.target = { ...PRESETS[preset] };
    this.transitioning = true;
    this.transitionTime = 0;
  }

  /** Update — call each frame with deltaTime */
  public update(deltaTime: number, boatX: number, boatZ: number): void {
    // Move rain emitter to follow the boat
    (this.rainSystem.emitter as Vector3).x = boatX;
    (this.rainSystem.emitter as Vector3).z = boatZ;

    if (!this.transitioning) return;

    this.transitionTime += deltaTime;
    const t = Math.min(1, this.transitionTime / this.transitionDuration);
    // Smooth ease
    const ease = t * t * (3 - 2 * t);

    this.lerpState(this.current, this.target, ease);
    this.applyState(this.current);

    if (t >= 1) {
      this.transitioning = false;
      // Copy target values to current
      Object.assign(this.current, this.target);
    }
  }

  private lerpState(out: WeatherState, target: WeatherState, t: number): void {
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const lerpC3 = (a: Color3, b: Color3) => new Color3(lerp(a.r, b.r), lerp(a.g, b.g), lerp(a.b, b.b));
    const lerpV3 = (a: Vector3, b: Vector3) => new Vector3(lerp(a.x, b.x), lerp(a.y, b.y), lerp(a.z, b.z));

    // Store starting values on first call by comparing with current
    out.sunPosition = lerpV3(out.sunPosition, target.sunPosition);
    out.turbidity = lerp(out.turbidity, target.turbidity);
    out.rayleigh = lerp(out.rayleigh, target.rayleigh);
    out.mieCoefficient = lerp(out.mieCoefficient, target.mieCoefficient);
    out.mieDirectionalG = lerp(out.mieDirectionalG, target.mieDirectionalG);
    out.luminance = lerp(out.luminance, target.luminance);
    out.fogDensity = lerp(out.fogDensity, target.fogDensity);
    out.fogColor = lerpC3(out.fogColor, target.fogColor);
    out.ambientIntensity = lerp(out.ambientIntensity, target.ambientIntensity);
    out.ambientDiffuse = lerpC3(out.ambientDiffuse, target.ambientDiffuse);
    out.ambientGround = lerpC3(out.ambientGround, target.ambientGround);
    out.sunIntensity = lerp(out.sunIntensity, target.sunIntensity);
    out.sunDiffuse = lerpC3(out.sunDiffuse, target.sunDiffuse);
    out.rainRate = lerp(out.rainRate, target.rainRate);
  }

  private applyState(state: WeatherState): void {
    // Sky
    this.skyMat.sunPosition = state.sunPosition;
    this.skyMat.turbidity = state.turbidity;
    this.skyMat.rayleigh = state.rayleigh;
    this.skyMat.mieCoefficient = state.mieCoefficient;
    this.skyMat.mieDirectionalG = state.mieDirectionalG;
    this.skyMat.luminance = state.luminance;

    // Fog
    this.scene.fogDensity = state.fogDensity;
    this.scene.fogColor = state.fogColor;

    // Lights
    this.ambient.intensity = state.ambientIntensity;
    this.ambient.diffuse = state.ambientDiffuse;
    this.ambient.groundColor = state.ambientGround;
    this.sun.intensity = state.sunIntensity;
    this.sun.diffuse = state.sunDiffuse;

    // Rain
    this.rainSystem.emitRate = Math.floor(state.rainRate);

    // Clear color matches fog for seamless horizon
    this.scene.clearColor = new Color4(
      state.fogColor.r, state.fogColor.g, state.fogColor.b, 1
    );
  }

  public dispose(): void {
    this.rainSystem.dispose();
  }
}

// Inline to avoid extra import
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
const MeshBuilder_CreateBox = MeshBuilder.CreateBox;
