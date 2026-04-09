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
const KELVIN_ANGLE = Math.asin(1 / 3); // 19.47 degrees

/** Max trail points per ribbon side */
const TRAIL_LENGTH = 60;

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
  private wakeParticles: ParticleSystem;
  private sprayParticles: ParticleSystem;
  private splashParticles: ParticleSystem;

  // Emitter positions (follow the boat)
  private sternEmitter: Vector3;
  private bowEmitter: Vector3;
  private portEmitter: Vector3;
  private starboardEmitter: Vector3;

  // V-shaped wake trail ribbons
  private portTrail: TrailPoint[] = [];
  private starboardTrail: TrailPoint[] = [];
  private portTrailMesh: Mesh;
  private starboardTrailMesh: Mesh;
  private trailMat: StandardMaterial;

  // Ripple rings
  private ripples: Ripple[] = [];
  private rippleMat: StandardMaterial;
  private rippleTimer = 0;

  // Procedural particle texture
  private particleTexture: DynamicTexture;
  private foamTexture: DynamicTexture;

  constructor(scene: Scene) {
    this.scene = scene;

    // Create emitter positions
    this.sternEmitter = new Vector3(0, WATER_LEVEL + 0.15, 0);
    this.bowEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.portEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.starboardEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);

    // Create procedural textures
    this.particleTexture = this.createParticleTexture();
    this.foamTexture = this.createFoamTexture();
    this.rippleMat = this.createRippleMaterial();

    // Create V-shaped trail meshes
    this.trailMat = this.createTrailMaterial();
    this.portTrailMesh = new Mesh("portTrail", scene);
    this.starboardTrailMesh = new Mesh("starboardTrail", scene);
    this.portTrailMesh.material = this.trailMat;
    this.starboardTrailMesh.material = this.trailMat;

    // Create all particle systems
    this.wakeParticles = this.createWakeSystem();
    this.sprayParticles = this.createSpraySystem();
    this.splashParticles = this.createSplashSystem();
  }

  /** Generate a soft circular gradient texture for spray particles */
  private createParticleTexture(): DynamicTexture {
    const size = 64;
    const tex = new DynamicTexture("particleTex", size, this.scene, false);
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

  /** Generate a foam texture with multi-octave noise for wake particles */
  private createFoamTexture(): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("foamTex", size, this.scene, false);
    const ctx = tex.getContext();

    // Hash-based noise
    const hash = (x: number, y: number): number => {
      let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
      h = ((h >> 13) ^ h) | 0;
      h = (h * (h * h * 15731 + 789221) + 1376312589) | 0;
      return ((h >> 16) & 0x7fff) / 0x7fff;
    };

    const smoothNoise = (x: number, y: number, period: number): number => {
      const ix = Math.floor(x) % period;
      const iy = Math.floor(y) % period;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      const cx = (1 - Math.cos(fx * Math.PI)) * 0.5;
      const cy = (1 - Math.cos(fy * Math.PI)) * 0.5;
      const ix1 = (ix + 1) % period;
      const iy1 = (iy + 1) % period;
      return (
        (hash(ix, iy) * (1 - cx) + hash(ix1, iy) * cx) * (1 - cy) +
        (hash(ix, iy1) * (1 - cx) + hash(ix1, iy1) * cx) * cy
      );
    };

    const turbulence = (x: number, y: number): number => {
      let val = 0, amp = 1, freq = 1, maxVal = 0;
      for (let oct = 0; oct < 4; oct++) {
        const period = Math.max(1, Math.floor(4 * freq));
        val += smoothNoise(x * freq, y * freq, period) * amp;
        maxVal += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return val / maxVal;
    };

    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy) / center;
        // Radial falloff
        const radial = Math.max(0, 1 - dist);
        // Noise-based foam pattern
        const noise = turbulence((x / size) * 6, (y / size) * 6);
        const foam = radial * (0.5 + noise * 0.5);
        const alpha = Math.pow(foam, 0.8);
        const bright = 200 + Math.floor(noise * 55);
        ctx.fillStyle = `rgba(${bright}, ${bright}, ${Math.min(255, bright + 10)}, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update(true);
    tex.hasAlpha = true;
    return tex;
  }

  /** Create material for ripple rings */
  private createRippleMaterial(): StandardMaterial {
    const mat = new StandardMaterial("rippleMat", this.scene);
    mat.diffuseColor = new Color3(0.8, 0.9, 0.85);
    mat.emissiveColor = new Color3(0.3, 0.4, 0.35);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.3;
    mat.backFaceCulling = false;
    return mat;
  }

  /** Create material for V-shaped trail ribbons */
  private createTrailMaterial(): StandardMaterial {
    const mat = new StandardMaterial("trailMat", this.scene);
    mat.diffuseColor = new Color3(0.85, 0.92, 0.88);
    mat.emissiveColor = new Color3(0.35, 0.45, 0.4);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.4;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    return mat;
  }

  /** Foam/wake trail behind the boat — more particles, additive blending */
  private createWakeSystem(): ParticleSystem {
    const ps = new ParticleSystem("wake", 800, this.scene);
    ps.particleTexture = this.foamTexture;
    ps.emitter = this.sternEmitter;

    ps.minEmitBox = new Vector3(-0.8, 0, -0.5);
    ps.maxEmitBox = new Vector3(0.8, 0, 0.5);
    ps.emitRate = 0;

    // Direction: spread backwards and sideways
    ps.direction1 = new Vector3(-0.5, 0.05, -0.8);
    ps.direction2 = new Vector3(0.5, 0.1, -0.3);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 1.0;

    // Larger, flatter foam particles
    ps.minSize = 0.4;
    ps.maxSize = 1.2;
    ps.minScaleX = 1.5;
    ps.maxScaleX = 3.0;
    ps.minScaleY = 0.3;
    ps.maxScaleY = 0.6;

    // Billboard Y-axis only — keeps particles flat on water surface
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y;

    ps.minLifeTime = 2.0;
    ps.maxLifeTime = 4.0;

    // Colors: bright white foam fading out
    ps.color1 = new Color4(0.95, 0.98, 0.96, 0.7);
    ps.color2 = new Color4(0.8, 0.9, 0.85, 0.6);
    ps.colorDead = new Color4(0.3, 0.5, 0.4, 0.0);

    // Keep on water surface
    ps.gravity = new Vector3(0, -0.05, 0);

    // Additive blending for brighter foam
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    ps.start();
    return ps;
  }

  /** Bow spray — water splashing at the front */
  private createSpraySystem(): ParticleSystem {
    const ps = new ParticleSystem("spray", 250, this.scene);
    ps.particleTexture = this.particleTexture;
    ps.emitter = this.bowEmitter;

    ps.minEmitBox = new Vector3(-0.3, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.3, 0, 0.2);
    ps.emitRate = 0;

    // Direction: upward and forward spray
    ps.direction1 = new Vector3(-0.6, 0.8, 0.3);
    ps.direction2 = new Vector3(0.6, 1.5, 0.8);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 2.0;

    ps.minSize = 0.08;
    ps.maxSize = 0.3;

    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;

    // Bright white spray
    ps.color1 = new Color4(1, 1, 1, 0.8);
    ps.color2 = new Color4(0.9, 0.97, 0.93, 0.7);
    ps.colorDead = new Color4(0.6, 0.8, 0.7, 0.0);

    ps.gravity = new Vector3(0, -4, 0);

    // Additive blending
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    ps.start();
    return ps;
  }

  /** Side splashes when turning */
  private createSplashSystem(): ParticleSystem {
    const ps = new ParticleSystem("splash", 200, this.scene);
    ps.particleTexture = this.particleTexture;
    ps.emitter = this.portEmitter;

    ps.minEmitBox = new Vector3(-0.2, 0, -1);
    ps.maxEmitBox = new Vector3(0.2, 0, 1);
    ps.emitRate = 0;

    ps.direction1 = new Vector3(-1, 0.5, -0.3);
    ps.direction2 = new Vector3(1, 1.0, 0.3);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 1.2;

    ps.minSize = 0.12;
    ps.maxSize = 0.35;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.0;

    ps.color1 = new Color4(0.95, 0.98, 0.96, 0.6);
    ps.color2 = new Color4(0.75, 0.88, 0.82, 0.5);
    ps.colorDead = new Color4(0.4, 0.6, 0.5, 0.0);

    ps.gravity = new Vector3(0, -3, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    ps.start();
    return ps;
  }

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

    // Update emitter positions relative to boat
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

    const sideOffX = cosR * 1.2;
    const sideOffZ = -sinR * 1.2;
    this.portEmitter.copyFromFloats(
      boatX - sideOffX,
      WATER_LEVEL + 0.1,
      boatZ - sideOffZ
    );
    this.starboardEmitter.copyFromFloats(
      boatX + sideOffX,
      WATER_LEVEL + 0.1,
      boatZ + sideOffZ
    );

    // --- V-shaped wake trail ribbons ---
    if (absSpeed > 0.03) {
      // Compute stern position
      const sternX = boatX - sinR * 3.0;
      const sternZ = boatZ - cosR * 3.0;

      // Port side: Kelvin angle to the left
      const portAngle = boatRotation + Math.PI - KELVIN_ANGLE;
      const portX = sternX + Math.sin(portAngle) * 1.5;
      const portZ = sternZ + Math.cos(portAngle) * 1.5;
      this.portTrail.unshift({ x: portX, z: portZ, age: 0, speed: absSpeed });

      // Starboard side: Kelvin angle to the right
      const stbdAngle = boatRotation + Math.PI + KELVIN_ANGLE;
      const stbdX = sternX + Math.sin(stbdAngle) * 1.5;
      const stbdZ = sternZ + Math.cos(stbdAngle) * 1.5;
      this.starboardTrail.unshift({ x: stbdX, z: stbdZ, age: 0, speed: absSpeed });
    }

    // Age and trim trail points
    for (const trail of [this.portTrail, this.starboardTrail]) {
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age += deltaTime;
        if (trail[i].age > 5.0) {
          trail.splice(i, 1);
        }
      }
      while (trail.length > TRAIL_LENGTH) {
        trail.pop();
      }
    }

    // Rebuild trail ribbon meshes
    this.buildTrailRibbon(this.portTrail, this.portTrailMesh, -1, boatRotation);
    this.buildTrailRibbon(this.starboardTrail, this.starboardTrailMesh, 1, boatRotation);

    // --- Adjust particle rates based on speed ---
    if (absSpeed > 0.03) {
      this.wakeParticles.emitRate = Math.floor(absSpeed * 500);
      this.wakeParticles.minEmitPower = absSpeed * 1.0;
      this.wakeParticles.maxEmitPower = absSpeed * 3.0;
      this.wakeParticles.minSize = 0.4 + absSpeed * 0.8;
      this.wakeParticles.maxSize = 1.2 + absSpeed * 2.0;
    } else {
      this.wakeParticles.emitRate = 0;
    }

    if (absSpeed > 0.12) {
      const sprayIntensity = (absSpeed - 0.12) / 0.23;
      this.sprayParticles.emitRate = Math.floor(sprayIntensity * 120);
      this.sprayParticles.minEmitPower = 0.5 + sprayIntensity * 1.5;
      this.sprayParticles.maxEmitPower = 1.0 + sprayIntensity * 3.0;
    } else {
      this.sprayParticles.emitRate = 0;
    }

    if (absSpeed > 0.08) {
      this.splashParticles.emitRate = Math.floor(absSpeed * 50);
    } else {
      this.splashParticles.emitRate = 0;
    }

    // --- Ripple rings ---
    this.rippleTimer += deltaTime;
    if (absSpeed > 0.02 && this.rippleTimer > 0.4) {
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
      const scale = 1 + progress * 8;
      r.mesh.scaling.set(scale, 1, scale);
      (r.mesh.material as StandardMaterial).alpha = (1 - progress) * 0.25;
    }

    while (this.ripples.length > 15) {
      this.ripples[0].mesh.dispose();
      this.ripples.shift();
    }
  }

  /** Build a ribbon mesh from trail points */
  private buildTrailRibbon(
    trail: TrailPoint[],
    mesh: Mesh,
    side: number,
    _boatRotation: number
  ): void {
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
      const ageFactor = 1 - p.age / 5.0;
      const width = (0.3 + p.speed * 3.0) * ageFactor;

      // Direction to next/prev point for perpendicular
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

      // Inner edge (center line)
      positions.push(p.x, WATER_LEVEL + 0.06, p.z);
      normals.push(0, 1, 0);
      const alpha = ageFactor * 0.5;
      colors.push(0.85, 0.92, 0.88, alpha);

      // Outer edge (spread outward)
      positions.push(
        p.x + nx * width * side,
        WATER_LEVEL + 0.06,
        p.z + nz * width * side
      );
      normals.push(0, 1, 0);
      colors.push(0.9, 0.95, 0.92, alpha * 0.4);

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
        diameter: 1.5 + speed * 2,
        thickness: 0.08 + speed * 0.1,
        tessellation: 24,
      },
      this.scene
    );

    const mat = this.rippleMat.clone("rippleMat_" + Date.now());
    mat.alpha = 0.25;
    ring.material = mat;
    ring.position.set(x, WATER_LEVEL + 0.08, z);

    const maxLife = 2.0 + speed * 2;
    this.ripples.push({ mesh: ring, life: maxLife, maxLife });
  }

  public dispose(): void {
    this.wakeParticles.dispose();
    this.sprayParticles.dispose();
    this.splashParticles.dispose();
    this.portTrailMesh.dispose();
    this.starboardTrailMesh.dispose();
    for (const r of this.ripples) {
      r.mesh.dispose();
    }
    this.ripples = [];
  }
}
