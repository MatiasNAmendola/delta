import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { WATER_LEVEL } from "../utils/constants";

/** Kelvin wake half-angle in radians (~19.47°) */
const KELVIN_ANGLE = Math.asin(1 / 3);

/** Max trail points per ribbon side */
const TRAIL_LENGTH = 40;

/** Max lifetime for trail points (seconds) */
const TRAIL_MAX_AGE = 4.0;

interface TrailPoint {
  x: number;
  z: number;
  age: number;
  speed: number;
}

interface Ripple {
  mesh: Mesh;
  life: number;
  maxLife: number;
}

export class WakeEffect {
  private scene: Scene;

  // Particle systems
  private sternFoamParticles: ParticleSystem;   // Dense white foam at stern
  private churnParticles: ParticleSystem;        // Brown churned water behind boat
  private sprayParticles: ParticleSystem;        // Bow spray
  private splashParticles: ParticleSystem;       // Side splashes

  // Emitter positions
  private sternEmitter: Vector3;
  private bowEmitter: Vector3;
  private portEmitter: Vector3;
  private starboardEmitter: Vector3;
  private churnEmitter: Vector3;

  // V-shaped wake trail ribbons (much wider, like photos)
  private portTrail: TrailPoint[] = [];
  private starboardTrail: TrailPoint[] = [];
  private portTrailMesh: Mesh;
  private starboardTrailMesh: Mesh;

  // Central churned-water ribbon (the brown turbulent area behind boat)
  private centerTrail: TrailPoint[] = [];
  private centerTrailMesh: Mesh;

  // Ripple rings
  private ripples: Ripple[] = [];
  private rippleMat: StandardMaterial;
  private rippleTimer = 0;

  // Textures
  private foamTexture: DynamicTexture;
  private churnTexture: DynamicTexture;
  private sprayTexture: DynamicTexture;

  constructor(scene: Scene) {
    this.scene = scene;

    // Create emitter positions
    this.sternEmitter = new Vector3(0, WATER_LEVEL + 0.15, 0);
    this.bowEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.portEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.starboardEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.churnEmitter = new Vector3(0, WATER_LEVEL + 0.12, 0);

    // Create textures
    this.foamTexture = this.createFoamTexture();
    this.churnTexture = this.createChurnTexture();
    this.sprayTexture = this.createSprayTexture();
    this.rippleMat = this.createRippleMaterial();

    // Create trail meshes
    this.portTrailMesh = this.createTrailMesh("portTrail");
    this.starboardTrailMesh = this.createTrailMesh("starboardTrail");
    this.centerTrailMesh = this.createCenterTrailMesh();

    // Create particle systems
    this.sternFoamParticles = this.createSternFoamSystem();
    this.churnParticles = this.createChurnSystem();
    this.sprayParticles = this.createSpraySystem();
    this.splashParticles = this.createSplashSystem();
  }

  // --- Procedural Textures ---

  /** White foam texture with noisy edges */
  private createFoamTexture(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("foamTex", size, this.scene, false);
    const ctx = tex.getContext();
    const hash = this.makeHash();
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy) / center;
        const radial = Math.max(0, 1 - dist);
        const noise = this.fbm(hash, (x / size) * 6, (y / size) * 6, 4);
        const foam = radial * (0.4 + noise * 0.6);
        const alpha = Math.pow(Math.max(0, foam), 0.7);
        // White-ish foam
        const bright = 220 + Math.floor(noise * 35);
        ctx.fillStyle = `rgba(${bright}, ${bright}, ${Math.min(255, bright + 5)}, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update(true);
    tex.hasAlpha = true;
    return tex;
  }

  /** Brown churned water texture — the muddy turbulence visible in Delta photos */
  private createChurnTexture(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("churnTex", size, this.scene, false);
    const ctx = tex.getContext();
    const hash = this.makeHash();
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy) / center;
        const radial = Math.max(0, 1 - dist * dist);
        const noise = this.fbm(hash, (x / size) * 5, (y / size) * 5, 3);
        const alpha = radial * (0.5 + noise * 0.3);
        // Brown/tan muddy water colors — matches Delta Tigre
        const r = Math.floor(140 + noise * 60);  // 140-200
        const g = Math.floor(110 + noise * 45);  // 110-155
        const b = Math.floor(60 + noise * 30);   // 60-90
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update(true);
    tex.hasAlpha = true;
    return tex;
  }

  /** Small soft circle for spray droplets */
  private createSprayTexture(): DynamicTexture {
    const size = 64;
    const tex = new DynamicTexture("sprayTex", size, this.scene, false);
    const ctx = tex.getContext();
    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy) / center;
        const alpha = Math.max(0, 1 - dist * dist);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update(true);
    tex.hasAlpha = true;
    return tex;
  }

  private makeHash(): (x: number, y: number) => number {
    return (x: number, y: number): number => {
      let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
      h = ((h >> 13) ^ h) | 0;
      h = (h * (h * h * 15731 + 789221) + 1376312589) | 0;
      return ((h >> 16) & 0x7fff) / 0x7fff;
    };
  }

  /** Fractional Brownian Motion (multi-octave noise) */
  private fbm(
    hash: (x: number, y: number) => number,
    x: number,
    y: number,
    octaves: number
  ): number {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let o = 0; o < octaves; o++) {
      const period = Math.max(1, Math.floor(4 * freq));
      const ix = Math.floor(x * freq) % period;
      const iy = Math.floor(y * freq) % period;
      const fx = x * freq - Math.floor(x * freq);
      const fy = y * freq - Math.floor(y * freq);
      const cx = (1 - Math.cos(fx * Math.PI)) * 0.5;
      const cy = (1 - Math.cos(fy * Math.PI)) * 0.5;
      const ix1 = (ix + 1) % period;
      const iy1 = (iy + 1) % period;
      const v =
        (hash(ix, iy) * (1 - cx) + hash(ix1, iy) * cx) * (1 - cy) +
        (hash(ix, iy1) * (1 - cx) + hash(ix1, iy1) * cx) * cy;
      val += v * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return val / max;
  }

  // --- Materials ---

  private createRippleMaterial(): StandardMaterial {
    const mat = new StandardMaterial("rippleMat", this.scene);
    mat.diffuseColor = new Color3(0.7, 0.65, 0.5);
    mat.emissiveColor = new Color3(0.25, 0.2, 0.15);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.3;
    mat.backFaceCulling = false;
    return mat;
  }

  private createTrailMesh(name: string): Mesh {
    const mesh = new Mesh(name, this.scene);
    const mat = new StandardMaterial(name + "Mat", this.scene);
    // Brownish-white for the wave crest ribbons
    mat.diffuseColor = new Color3(0.8, 0.75, 0.6);
    mat.emissiveColor = new Color3(0.5, 0.48, 0.38);
    mat.specularColor = new Color3(0.2, 0.18, 0.12);
    mat.alpha = 0.55;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mesh.material = mat;
    return mesh;
  }

  private createCenterTrailMesh(): Mesh {
    const mesh = new Mesh("centerTrail", this.scene);
    const mat = new StandardMaterial("centerTrailMat", this.scene);
    // Brown churned water color
    mat.diffuseColor = new Color3(0.6, 0.5, 0.32);
    mat.emissiveColor = new Color3(0.35, 0.28, 0.18);
    mat.specularColor = new Color3(0.15, 0.12, 0.08);
    mat.alpha = 0.5;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mesh.material = mat;
    return mesh;
  }

  // --- Particle Systems ---

  /** Dense white foam right at the stern — the intense churning visible in photos */
  private createSternFoamSystem(): ParticleSystem {
    const ps = new ParticleSystem("sternFoam", 1200, this.scene);
    ps.particleTexture = this.foamTexture;
    ps.emitter = this.sternEmitter;

    // Wide emission area at stern
    ps.minEmitBox = new Vector3(-1.5, 0, -1.0);
    ps.maxEmitBox = new Vector3(1.5, 0, 1.0);
    ps.emitRate = 0;

    // Spread backwards and outward — fills the river width
    ps.direction1 = new Vector3(-1.2, 0.05, -1.5);
    ps.direction2 = new Vector3(1.2, 0.15, -0.2);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 2.0;

    // Large flat foam patches
    ps.minSize = 0.6;
    ps.maxSize = 2.0;
    ps.minScaleX = 2.0;
    ps.maxScaleX = 4.0;
    ps.minScaleY = 0.2;
    ps.maxScaleY = 0.5;

    // Y-billboard keeps particles flat on water
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y;

    ps.minLifeTime = 2.5;
    ps.maxLifeTime = 5.0;

    // White foam with slight brown tint fading to transparent
    ps.color1 = new Color4(1.0, 0.98, 0.92, 0.8);
    ps.color2 = new Color4(0.9, 0.85, 0.75, 0.7);
    ps.colorDead = new Color4(0.5, 0.42, 0.3, 0.0);

    ps.gravity = new Vector3(0, -0.03, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    ps.start();
    return ps;
  }

  /** Brown churned water particles — the muddy turbulence that fills the wake */
  private createChurnSystem(): ParticleSystem {
    const ps = new ParticleSystem("churn", 600, this.scene);
    ps.particleTexture = this.churnTexture;
    ps.emitter = this.churnEmitter;

    ps.minEmitBox = new Vector3(-2.0, 0, -0.5);
    ps.maxEmitBox = new Vector3(2.0, 0, 0.5);
    ps.emitRate = 0;

    // Spread wide and backwards
    ps.direction1 = new Vector3(-2.0, 0.02, -2.0);
    ps.direction2 = new Vector3(2.0, 0.08, -0.3);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 1.5;

    // Large flat patches of churned water
    ps.minSize = 1.0;
    ps.maxSize = 3.5;
    ps.minScaleX = 2.5;
    ps.maxScaleX = 5.0;
    ps.minScaleY = 0.15;
    ps.maxScaleY = 0.3;

    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y;

    ps.minLifeTime = 3.0;
    ps.maxLifeTime = 6.0;

    // Brown/tan muddy water colors
    ps.color1 = new Color4(0.65, 0.52, 0.32, 0.6);
    ps.color2 = new Color4(0.55, 0.45, 0.28, 0.5);
    ps.colorDead = new Color4(0.35, 0.3, 0.2, 0.0);

    ps.gravity = new Vector3(0, -0.02, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    ps.start();
    return ps;
  }

  /** Bow spray — water splashing upward at the front */
  private createSpraySystem(): ParticleSystem {
    const ps = new ParticleSystem("spray", 300, this.scene);
    ps.particleTexture = this.sprayTexture;
    ps.emitter = this.bowEmitter;

    ps.minEmitBox = new Vector3(-0.5, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.5, 0, 0.2);
    ps.emitRate = 0;

    // Strong upward and outward spray
    ps.direction1 = new Vector3(-0.8, 1.0, 0.3);
    ps.direction2 = new Vector3(0.8, 2.0, 1.0);
    ps.minEmitPower = 0.8;
    ps.maxEmitPower = 3.0;

    ps.minSize = 0.05;
    ps.maxSize = 0.25;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.9;

    // Bright white spray droplets
    ps.color1 = new Color4(1, 1, 1, 0.9);
    ps.color2 = new Color4(0.95, 0.92, 0.85, 0.8);
    ps.colorDead = new Color4(0.6, 0.55, 0.4, 0.0);

    ps.gravity = new Vector3(0, -5, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    ps.start();
    return ps;
  }

  /** Side splashes from the hull cutting water */
  private createSplashSystem(): ParticleSystem {
    const ps = new ParticleSystem("splash", 200, this.scene);
    ps.particleTexture = this.sprayTexture;
    ps.emitter = this.portEmitter;

    ps.minEmitBox = new Vector3(-0.3, 0, -1.5);
    ps.maxEmitBox = new Vector3(0.3, 0, 1.5);
    ps.emitRate = 0;

    ps.direction1 = new Vector3(-1.5, 0.5, -0.5);
    ps.direction2 = new Vector3(1.5, 1.2, 0.5);
    ps.minEmitPower = 0.4;
    ps.maxEmitPower = 1.5;

    ps.minSize = 0.1;
    ps.maxSize = 0.4;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.2;

    ps.color1 = new Color4(0.9, 0.85, 0.75, 0.7);
    ps.color2 = new Color4(0.75, 0.68, 0.55, 0.6);
    ps.colorDead = new Color4(0.4, 0.35, 0.25, 0.0);

    ps.gravity = new Vector3(0, -3.5, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    ps.start();
    return ps;
  }

  // --- Update ---

  public update(
    deltaTime: number,
    boatX: number,
    boatZ: number,
    boatRotation: number,
    speed: number
  ): void {
    const absSpeed = Math.abs(speed);
    const sinR = Math.sin(boatRotation);
    const cosR = Math.cos(boatRotation);

    // Update emitter positions
    this.sternEmitter.copyFromFloats(
      boatX - sinR * 3.5,
      WATER_LEVEL + 0.15,
      boatZ - cosR * 3.5
    );
    this.bowEmitter.copyFromFloats(
      boatX + sinR * 3.5,
      WATER_LEVEL + 0.1,
      boatZ + cosR * 3.5
    );
    this.churnEmitter.copyFromFloats(
      boatX - sinR * 4.5,
      WATER_LEVEL + 0.12,
      boatZ - cosR * 4.5
    );

    const sideOffX = cosR * 1.2;
    const sideOffZ = -sinR * 1.2;
    this.portEmitter.copyFromFloats(
      boatX - sideOffX, WATER_LEVEL + 0.1, boatZ - sideOffZ
    );
    this.starboardEmitter.copyFromFloats(
      boatX + sideOffX, WATER_LEVEL + 0.1, boatZ + sideOffZ
    );

    // --- V-shaped wake trail ribbons ---
    if (absSpeed > 0.03) {
      const sternX = boatX - sinR * 3.0;
      const sternZ = boatZ - cosR * 3.0;

      // Port side: Kelvin angle to the left
      const portAngle = boatRotation + Math.PI - KELVIN_ANGLE;
      const spread = 2.0;
      const portX = sternX + Math.sin(portAngle) * spread;
      const portZ = sternZ + Math.cos(portAngle) * spread;
      this.portTrail.unshift({ x: portX, z: portZ, age: 0, speed: absSpeed });

      // Starboard side: Kelvin angle to the right
      const stbdAngle = boatRotation + Math.PI + KELVIN_ANGLE;
      const stbdX = sternX + Math.sin(stbdAngle) * spread;
      const stbdZ = sternZ + Math.cos(stbdAngle) * spread;
      this.starboardTrail.unshift({ x: stbdX, z: stbdZ, age: 0, speed: absSpeed });

      // Center trail (churned water area)
      this.centerTrail.unshift({ x: sternX, z: sternZ, age: 0, speed: absSpeed });
    }

    // Age and trim all trails
    for (const trail of [this.portTrail, this.starboardTrail, this.centerTrail]) {
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age += deltaTime;
        if (trail[i].age > TRAIL_MAX_AGE) {
          trail.splice(i, 1);
        }
      }
      while (trail.length > TRAIL_LENGTH) {
        trail.pop();
      }
    }

    // Rebuild all ribbon meshes
    this.buildWakeRibbon(this.portTrail, this.portTrailMesh, -1);
    this.buildWakeRibbon(this.starboardTrail, this.starboardTrailMesh, 1);
    this.buildCenterRibbon(this.centerTrail, this.centerTrailMesh);

    // --- Particle rates based on speed ---
    // Stern foam: massive at speed (the dense white churning at the back)
    if (absSpeed > 0.03) {
      const intensity = absSpeed / 0.35; // normalized to max speed
      this.sternFoamParticles.emitRate = Math.floor(intensity * 300);
      this.sternFoamParticles.minEmitPower = 0.3 + intensity * 1.0;
      this.sternFoamParticles.maxEmitPower = 0.6 + intensity * 2.0;
      this.sternFoamParticles.minSize = 0.3 + intensity * 0.5;
      this.sternFoamParticles.maxSize = 0.8 + intensity * 1.0;
    } else {
      this.sternFoamParticles.emitRate = 0;
    }

    // Brown churned water: even more particles, wider spread
    if (absSpeed > 0.03) {
      const intensity = absSpeed / 0.35;
      this.churnParticles.emitRate = Math.floor(intensity * 150);
      this.churnParticles.minEmitPower = 0.2 + intensity * 0.5;
      this.churnParticles.maxEmitPower = 0.5 + intensity * 1.2;
      this.churnParticles.minSize = 0.4 + intensity * 0.6;
      this.churnParticles.maxSize = 1.0 + intensity * 1.2;
    } else {
      this.churnParticles.emitRate = 0;
    }

    // Bow spray: only at higher speeds
    if (absSpeed > 0.10) {
      const sprayIntensity = (absSpeed - 0.10) / 0.25;
      this.sprayParticles.emitRate = Math.floor(sprayIntensity * 150);
      this.sprayParticles.minEmitPower = 0.8 + sprayIntensity * 2.0;
      this.sprayParticles.maxEmitPower = 1.5 + sprayIntensity * 4.0;
    } else {
      this.sprayParticles.emitRate = 0;
    }

    // Side splashes
    if (absSpeed > 0.06) {
      this.splashParticles.emitRate = Math.floor(absSpeed * 80);
    } else {
      this.splashParticles.emitRate = 0;
    }

    // --- Ripple rings ---
    this.rippleTimer += deltaTime;
    if (absSpeed > 0.02 && this.rippleTimer > 0.35) {
      this.rippleTimer = 0;
      this.spawnRipple(boatX, boatZ, absSpeed);
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life -= deltaTime;
      if (r.life <= 0) {
        r.mesh.dispose();
        this.ripples.splice(i, 1);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      const scale = 1 + progress * 12;
      r.mesh.scaling.set(scale, 1, scale);
      (r.mesh.material as StandardMaterial).alpha = (1 - progress) * 0.3;
    }

    while (this.ripples.length > 20) {
      this.ripples[0].mesh.dispose();
      this.ripples.shift();
    }
  }

  // --- Ribbon builders ---

  /** Build V-wake side ribbon — wider and more persistent than before */
  private buildWakeRibbon(trail: TrailPoint[], mesh: Mesh, side: number): void {
    if (trail.length < 3) {
      mesh.setEnabled(false);
      return;
    }
    mesh.setEnabled(true);

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const ageFactor = 1 - p.age / TRAIL_MAX_AGE;
      // Wake width grows with speed and age (waves spread as they travel)
      const baseWidth = 0.3 + p.speed * 2.5;
      const ageSpread = 1 + p.age * 0.3;
      const width = baseWidth * ageSpread * ageFactor;

      let dx = 0, dz = 0;
      if (i < trail.length - 1) {
        dx = trail[i + 1].x - p.x;
        dz = trail[i + 1].z - p.z;
      } else if (i > 0) {
        dx = p.x - trail[i - 1].x;
        dz = p.z - trail[i - 1].z;
      }
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const y = WATER_LEVEL + 0.07;

      // Inner edge (center)
      positions.push(p.x, y, p.z);
      normals.push(0, 1, 0);
      // Foam-white at center, fading with age
      const alpha = ageFactor * 0.6;
      colors.push(0.78, 0.72, 0.58, alpha);

      // Outer edge (wave crest, white foam line)
      positions.push(
        p.x + nx * width * side,
        y + 0.04 * ageFactor,
        p.z + nz * width * side
      );
      normals.push(0, 1, 0);
      // Outer edge is whiter (foam crest)
      colors.push(0.92, 0.88, 0.78, alpha * 0.5);

      if (i < trail.length - 1) {
        const vi = i * 2;
        indices.push(vi, vi + 1, vi + 2);
        indices.push(vi + 1, vi + 3, vi + 2);
      }
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.applyToMesh(mesh, true);
    mesh.hasVertexAlpha = true;
  }

  /** Build center churned-water ribbon — the wide brown turbulent area */
  private buildCenterRibbon(trail: TrailPoint[], mesh: Mesh): void {
    if (trail.length < 3) {
      mesh.setEnabled(false);
      return;
    }
    mesh.setEnabled(true);

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const ageFactor = 1 - p.age / TRAIL_MAX_AGE;
      // Center ribbon: wide — the churned brown water
      const halfWidth = (0.8 + p.speed * 2.0) * ageFactor * (1 + p.age * 0.15);

      let dx = 0, dz = 0;
      if (i < trail.length - 1) {
        dx = trail[i + 1].x - p.x;
        dz = trail[i + 1].z - p.z;
      } else if (i > 0) {
        dx = p.x - trail[i - 1].x;
        dz = p.z - trail[i - 1].z;
      }
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const y = WATER_LEVEL + 0.05;

      // Left edge
      positions.push(p.x + nx * halfWidth, y, p.z + nz * halfWidth);
      normals.push(0, 1, 0);
      const alpha = ageFactor * 0.45;
      // Brown muddy water
      colors.push(0.55, 0.45, 0.28, alpha);

      // Right edge
      positions.push(p.x - nx * halfWidth, y, p.z - nz * halfWidth);
      normals.push(0, 1, 0);
      colors.push(0.55, 0.45, 0.28, alpha);

      if (i < trail.length - 1) {
        const vi = i * 2;
        indices.push(vi, vi + 1, vi + 2);
        indices.push(vi + 1, vi + 3, vi + 2);
      }
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.applyToMesh(mesh, true);
    mesh.hasVertexAlpha = true;
  }

  private spawnRipple(x: number, z: number, speed: number): void {
    const ring = MeshBuilder.CreateTorus(
      "ripple",
      {
        diameter: 1.0 + speed * 2,
        thickness: 0.06 + speed * 0.08,
        tessellation: 24,
      },
      this.scene
    );

    const mat = this.rippleMat.clone("rippleMat_" + Date.now());
    mat.alpha = 0.3;
    ring.material = mat;
    ring.position.set(x, WATER_LEVEL + 0.08, z);

    const maxLife = 1.5 + speed * 2;
    this.ripples.push({ mesh: ring, life: maxLife, maxLife });
  }

  public dispose(): void {
    this.sternFoamParticles.dispose();
    this.churnParticles.dispose();
    this.sprayParticles.dispose();
    this.splashParticles.dispose();
    this.portTrailMesh.dispose();
    this.starboardTrailMesh.dispose();
    this.centerTrailMesh.dispose();
    for (const r of this.ripples) {
      r.mesh.dispose();
    }
    this.ripples = [];
  }
}
