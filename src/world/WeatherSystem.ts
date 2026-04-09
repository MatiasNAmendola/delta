/**
 * WeatherSystem — Controls sky, lighting, fog, and rain particles.
 * Provides weather presets (morning, noon, sunset, night, storm)
 * with smooth transitions between states.
 *
 * Three.js implementation using Sky shader, HemisphereLight,
 * DirectionalLight, FogExp2, and Points-based rain.
 */
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WATER_LEVEL } from "../utils/constants";

export type WeatherPreset = "morning" | "noon" | "sunset" | "night" | "storm";

interface WeatherState {
  sunPosition: THREE.Vector3;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  luminance: number;
  fogDensity: number;
  fogColor: THREE.Color;
  ambientIntensity: number;
  ambientSkyColor: THREE.Color;
  ambientGroundColor: THREE.Color;
  sunIntensity: number;
  sunColor: THREE.Color;
  rainRate: number;
}

const PRESETS: Record<WeatherPreset, WeatherState> = {
  morning: {
    sunPosition: new THREE.Vector3(-50, 20, 30),
    turbidity: 8, rayleigh: 2, mieCoefficient: 0.005, mieDirectionalG: 0.8, luminance: 1.0,
    fogDensity: 0.0012, fogColor: new THREE.Color(0.75, 0.8, 0.85),
    ambientIntensity: 0.5, ambientSkyColor: new THREE.Color(0.85, 0.8, 0.7), ambientGroundColor: new THREE.Color(0.2, 0.25, 0.2),
    sunIntensity: 0.6, sunColor: new THREE.Color(1, 0.9, 0.7),
    rainRate: 0,
  },
  noon: {
    sunPosition: new THREE.Vector3(0, 80, 20),
    turbidity: 5, rayleigh: 1.5, mieCoefficient: 0.003, mieDirectionalG: 0.76, luminance: 1.1,
    fogDensity: 0.0008, fogColor: new THREE.Color(0.7, 0.78, 0.85),
    ambientIntensity: 0.7, ambientSkyColor: new THREE.Color(0.95, 0.95, 0.9), ambientGroundColor: new THREE.Color(0.25, 0.3, 0.2),
    sunIntensity: 0.9, sunColor: new THREE.Color(1, 1, 0.95),
    rainRate: 0,
  },
  sunset: {
    sunPosition: new THREE.Vector3(60, 5, -40),
    turbidity: 15, rayleigh: 4, mieCoefficient: 0.02, mieDirectionalG: 0.9, luminance: 1.0,
    fogDensity: 0.002, fogColor: new THREE.Color(0.8, 0.55, 0.35),
    ambientIntensity: 0.4, ambientSkyColor: new THREE.Color(0.9, 0.6, 0.3), ambientGroundColor: new THREE.Color(0.15, 0.1, 0.1),
    sunIntensity: 0.5, sunColor: new THREE.Color(1, 0.6, 0.2),
    rainRate: 0,
  },
  night: {
    sunPosition: new THREE.Vector3(0, -20, 30),
    turbidity: 2, rayleigh: 0.5, mieCoefficient: 0.001, mieDirectionalG: 0.7, luminance: 0.01,
    fogDensity: 0.003, fogColor: new THREE.Color(0.03, 0.04, 0.08),
    ambientIntensity: 0.15, ambientSkyColor: new THREE.Color(0.1, 0.12, 0.2), ambientGroundColor: new THREE.Color(0.02, 0.03, 0.05),
    sunIntensity: 0.05, sunColor: new THREE.Color(0.2, 0.25, 0.4),
    rainRate: 0,
  },
  storm: {
    sunPosition: new THREE.Vector3(-30, 15, 20),
    turbidity: 25, rayleigh: 3, mieCoefficient: 0.05, mieDirectionalG: 0.65, luminance: 0.6,
    fogDensity: 0.004, fogColor: new THREE.Color(0.35, 0.38, 0.4),
    ambientIntensity: 0.3, ambientSkyColor: new THREE.Color(0.5, 0.52, 0.55), ambientGroundColor: new THREE.Color(0.1, 0.12, 0.1),
    sunIntensity: 0.2, sunColor: new THREE.Color(0.6, 0.6, 0.6),
    rainRate: 800,
  },
};

/** Maximum number of rain particles */
const MAX_RAIN_PARTICLES = 2000;

export class WeatherSystem {
  private scene: THREE.Scene;
  private sky: Sky;
  private ambient: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fog: THREE.FogExp2;

  // Rain
  private rainPoints: THREE.Points;
  private rainGeometry: THREE.BufferGeometry;
  private rainPositions: Float32Array;
  private rainVelocities: Float32Array;
  private rainAlive: Uint8Array;
  private activeRainCount = 0;
  private rainEmitAccumulator = 0;
  private rainEmitterX = 0;
  private rainEmitterZ = 0;

  // Transition
  private current: WeatherState;
  private target: WeatherState;
  private transitioning = false;
  private transitionTime = 0;
  private transitionDuration = 2.0; // seconds

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // --- Sky ---
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    scene.add(this.sky);

    // --- Lights ---
    this.ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffffff, 0.6);
    this.sun.position.set(-0.5, 1, 0.5).normalize();
    scene.add(this.sun);

    // --- Fog ---
    this.fog = new THREE.FogExp2(0xcccccc, 0.0012);
    scene.fog = this.fog;

    // --- Rain particle system ---
    this.rainPositions = new Float32Array(MAX_RAIN_PARTICLES * 3);
    this.rainVelocities = new Float32Array(MAX_RAIN_PARTICLES * 3);
    this.rainAlive = new Uint8Array(MAX_RAIN_PARTICLES);

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    // Start with 0 drawn particles
    this.rainGeometry.setDrawRange(0, 0);

    const rainTexture = this.createRainTexture();
    const rainMaterial = new THREE.PointsMaterial({
      map: rainTexture,
      size: 0.8,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    this.rainPoints = new THREE.Points(this.rainGeometry, rainMaterial);
    this.rainPoints.frustumCulled = false;
    scene.add(this.rainPoints);

    // --- Initialize to morning ---
    this.current = this.cloneState(PRESETS.morning);
    this.target = this.cloneState(PRESETS.morning);
    this.applyState(this.current);
  }

  private createRainTexture(): THREE.CanvasTexture {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    // Vertical streak
    ctx.fillStyle = "rgba(200, 210, 220, 0.6)";
    ctx.fillRect(size / 2 - 1, 0, 2, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /** Set weather preset with smooth transition */
  public setWeather(preset: WeatherPreset): void {
    this.target = this.cloneState(PRESETS[preset]);
    this.transitioning = true;
    this.transitionTime = 0;
  }

  /** Update — call each frame with deltaTime */
  public update(deltaTime: number, boatX: number, boatZ: number): void {
    // Move rain emitter to follow the boat
    this.rainEmitterX = boatX;
    this.rainEmitterZ = boatZ;

    // Update rain particles
    this.updateRain(deltaTime);

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
      this.copyState(this.current, this.target);
    }
  }

  private updateRain(dt: number): void {
    const rate = Math.floor(this.current.rainRate);

    // Emit new particles
    if (rate > 0) {
      this.rainEmitAccumulator += rate * dt;
      while (this.rainEmitAccumulator >= 1) {
        this.rainEmitAccumulator -= 1;
        this.emitRainParticle();
      }
    }

    // Update existing particles
    let aliveCount = 0;
    for (let i = 0; i < MAX_RAIN_PARTICLES; i++) {
      if (!this.rainAlive[i]) continue;

      const i3 = i * 3;
      // Apply velocity + gravity
      this.rainVelocities[i3 + 1] -= 9.8 * dt; // gravity
      this.rainPositions[i3] += this.rainVelocities[i3] * dt;
      this.rainPositions[i3 + 1] += this.rainVelocities[i3 + 1] * dt;
      this.rainPositions[i3 + 2] += this.rainVelocities[i3 + 2] * dt;

      // Kill particles below water level
      if (this.rainPositions[i3 + 1] < WATER_LEVEL - 1) {
        this.rainAlive[i] = 0;
        // Move off-screen
        this.rainPositions[i3 + 1] = -9999;
      } else {
        aliveCount++;
      }
    }

    this.activeRainCount = aliveCount;
    const posAttr = this.rainGeometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    this.rainGeometry.setDrawRange(0, MAX_RAIN_PARTICLES);
  }

  private emitRainParticle(): void {
    // Find a dead particle slot
    for (let i = 0; i < MAX_RAIN_PARTICLES; i++) {
      if (this.rainAlive[i]) continue;

      const i3 = i * 3;
      // Position: above the boat in a 200x200 area
      this.rainPositions[i3] = this.rainEmitterX + (Math.random() - 0.5) * 200;
      this.rainPositions[i3 + 1] = 60;
      this.rainPositions[i3 + 2] = this.rainEmitterZ + (Math.random() - 0.5) * 200;

      // Velocity: mostly downward with slight horizontal drift
      const power = 30 + Math.random() * 20;
      this.rainVelocities[i3] = (Math.random() - 0.5) * 0.4 * power;
      this.rainVelocities[i3 + 1] = -power;
      this.rainVelocities[i3 + 2] = (Math.random() - 0.5) * 0.2 * power;

      this.rainAlive[i] = 1;
      return;
    }
  }

  private lerpState(out: WeatherState, target: WeatherState, t: number): void {
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const lerpC = (a: THREE.Color, b: THREE.Color) => new THREE.Color(lerp(a.r, b.r), lerp(a.g, b.g), lerp(a.b, b.b));
    const lerpV3 = (a: THREE.Vector3, b: THREE.Vector3) => new THREE.Vector3(lerp(a.x, b.x), lerp(a.y, b.y), lerp(a.z, b.z));

    out.sunPosition = lerpV3(out.sunPosition, target.sunPosition);
    out.turbidity = lerp(out.turbidity, target.turbidity);
    out.rayleigh = lerp(out.rayleigh, target.rayleigh);
    out.mieCoefficient = lerp(out.mieCoefficient, target.mieCoefficient);
    out.mieDirectionalG = lerp(out.mieDirectionalG, target.mieDirectionalG);
    out.luminance = lerp(out.luminance, target.luminance);
    out.fogDensity = lerp(out.fogDensity, target.fogDensity);
    out.fogColor = lerpC(out.fogColor, target.fogColor);
    out.ambientIntensity = lerp(out.ambientIntensity, target.ambientIntensity);
    out.ambientSkyColor = lerpC(out.ambientSkyColor, target.ambientSkyColor);
    out.ambientGroundColor = lerpC(out.ambientGroundColor, target.ambientGroundColor);
    out.sunIntensity = lerp(out.sunIntensity, target.sunIntensity);
    out.sunColor = lerpC(out.sunColor, target.sunColor);
    out.rainRate = lerp(out.rainRate, target.rainRate);
  }

  private applyState(state: WeatherState): void {
    // Sky
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = state.turbidity;
    uniforms['rayleigh'].value = state.rayleigh;
    uniforms['mieCoefficient'].value = state.mieCoefficient;
    uniforms['mieDirectionalG'].value = state.mieDirectionalG;

    // Set sun position in the Sky shader
    const sunDir = state.sunPosition.clone().normalize();
    uniforms['sunPosition'].value.copy(sunDir);

    // Fog
    this.fog.density = state.fogDensity;
    this.fog.color.copy(state.fogColor);

    // Lights
    this.ambient.intensity = state.ambientIntensity;
    this.ambient.color.copy(state.ambientSkyColor);
    this.ambient.groundColor.copy(state.ambientGroundColor);
    this.sun.intensity = state.sunIntensity;
    this.sun.color.copy(state.sunColor);
    // Point directional light from the sun direction
    this.sun.position.copy(state.sunPosition).normalize();

    // Background color matches fog for seamless horizon
    this.scene.background = state.fogColor.clone();
  }

  private cloneState(state: WeatherState): WeatherState {
    return {
      sunPosition: state.sunPosition.clone(),
      turbidity: state.turbidity,
      rayleigh: state.rayleigh,
      mieCoefficient: state.mieCoefficient,
      mieDirectionalG: state.mieDirectionalG,
      luminance: state.luminance,
      fogDensity: state.fogDensity,
      fogColor: state.fogColor.clone(),
      ambientIntensity: state.ambientIntensity,
      ambientSkyColor: state.ambientSkyColor.clone(),
      ambientGroundColor: state.ambientGroundColor.clone(),
      sunIntensity: state.sunIntensity,
      sunColor: state.sunColor.clone(),
      rainRate: state.rainRate,
    };
  }

  private copyState(dest: WeatherState, src: WeatherState): void {
    dest.sunPosition.copy(src.sunPosition);
    dest.turbidity = src.turbidity;
    dest.rayleigh = src.rayleigh;
    dest.mieCoefficient = src.mieCoefficient;
    dest.mieDirectionalG = src.mieDirectionalG;
    dest.luminance = src.luminance;
    dest.fogDensity = src.fogDensity;
    dest.fogColor.copy(src.fogColor);
    dest.ambientIntensity = src.ambientIntensity;
    dest.ambientSkyColor.copy(src.ambientSkyColor);
    dest.ambientGroundColor.copy(src.ambientGroundColor);
    dest.sunIntensity = src.sunIntensity;
    dest.sunColor.copy(src.sunColor);
    dest.rainRate = src.rainRate;
  }

  public dispose(): void {
    this.scene.remove(this.sky);
    this.scene.remove(this.ambient);
    this.scene.remove(this.sun);
    this.scene.remove(this.rainPoints);
    this.rainGeometry.dispose();
    (this.rainPoints.material as THREE.PointsMaterial).dispose();
  }
}
