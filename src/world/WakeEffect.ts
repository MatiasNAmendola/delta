import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { WATER_LEVEL } from "../utils/constants";

interface Ripple {
  mesh: Mesh;
  life: number;
  maxLife: number;
}

export class WakeEffect {
  private scene: Scene;

  // Particle systems
  private wakeParticles: ParticleSystem;   // Foam trail behind boat
  private sprayParticles: ParticleSystem;  // Bow spray
  private splashParticles: ParticleSystem; // Side splashes

  // Emitter positions (follow the boat)
  private sternEmitter: Vector3;
  private bowEmitter: Vector3;
  private portEmitter: Vector3;
  private starboardEmitter: Vector3;

  // Ripple rings
  private ripples: Ripple[] = [];
  private rippleMat: StandardMaterial;
  private rippleTimer = 0;

  // Procedural particle texture
  private particleTexture: DynamicTexture;

  constructor(scene: Scene) {
    this.scene = scene;

    // Create emitter positions
    this.sternEmitter = new Vector3(0, WATER_LEVEL + 0.15, 0);
    this.bowEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.portEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.starboardEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);

    // Create procedural textures
    this.particleTexture = this.createParticleTexture();
    this.rippleMat = this.createRippleMaterial();

    // Create all particle systems
    this.wakeParticles = this.createWakeSystem();
    this.sprayParticles = this.createSpraySystem();
    this.splashParticles = this.createSplashSystem();
  }

  /** Generate a soft circular gradient texture for particles */
  private createParticleTexture(): DynamicTexture {
    const size = 64;
    const tex = new DynamicTexture("particleTex", size, this.scene, false);
    const ctx = tex.getContext();

    // Radial gradient: white center fading to transparent
    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy) / center;
        const alpha = Math.max(0, 1 - dist * dist);
        const val = Math.floor(alpha * 255);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
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

  /** Foam/wake trail behind the boat */
  private createWakeSystem(): ParticleSystem {
    const ps = new ParticleSystem("wake", 300, this.scene);
    ps.particleTexture = this.particleTexture;
    ps.emitter = this.sternEmitter;

    // Emission
    ps.minEmitBox = new Vector3(-0.8, 0, -0.5);
    ps.maxEmitBox = new Vector3(0.8, 0, 0.5);
    ps.emitRate = 0;

    // Direction: spread backwards and sideways
    ps.direction1 = new Vector3(-0.5, 0.05, -0.8);
    ps.direction2 = new Vector3(0.5, 0.1, -0.3);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 1.0;

    // Size: start small, grow (foam expands)
    ps.minSize = 0.3;
    ps.maxSize = 0.8;
    ps.minScaleX = 1;
    ps.maxScaleX = 2;

    // Life
    ps.minLifeTime = 1.5;
    ps.maxLifeTime = 3.0;

    // Colors: white foam fading to transparent water color
    ps.color1 = new Color4(0.9, 0.95, 0.92, 0.6);
    ps.color2 = new Color4(0.7, 0.85, 0.78, 0.5);
    ps.colorDead = new Color4(0.3, 0.5, 0.4, 0.0);

    // Gravity: slight downward to keep on water surface
    ps.gravity = new Vector3(0, -0.1, 0);

    // Blending
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    ps.start();
    return ps;
  }

  /** Bow spray — water splashing at the front */
  private createSpraySystem(): ParticleSystem {
    const ps = new ParticleSystem("spray", 150, this.scene);
    ps.particleTexture = this.particleTexture;
    ps.emitter = this.bowEmitter;

    // Emission from a narrow area at the bow
    ps.minEmitBox = new Vector3(-0.3, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.3, 0, 0.2);
    ps.emitRate = 0;

    // Direction: upward and forward spray
    ps.direction1 = new Vector3(-0.6, 0.8, 0.3);
    ps.direction2 = new Vector3(0.6, 1.5, 0.8);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 2.0;

    // Size: small droplets
    ps.minSize = 0.1;
    ps.maxSize = 0.35;

    // Life: short-lived spray
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;

    // Colors: bright white water spray
    ps.color1 = new Color4(1, 1, 1, 0.7);
    ps.color2 = new Color4(0.85, 0.95, 0.9, 0.6);
    ps.colorDead = new Color4(0.6, 0.8, 0.7, 0.0);

    // Gravity: drops fall back to water
    ps.gravity = new Vector3(0, -4, 0);

    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    ps.start();
    return ps;
  }

  /** Side splashes when turning */
  private createSplashSystem(): ParticleSystem {
    const ps = new ParticleSystem("splash", 100, this.scene);
    ps.particleTexture = this.particleTexture;
    ps.emitter = this.portEmitter; // will switch sides dynamically

    ps.minEmitBox = new Vector3(-0.2, 0, -1);
    ps.maxEmitBox = new Vector3(0.2, 0, 1);
    ps.emitRate = 0;

    ps.direction1 = new Vector3(-1, 0.5, -0.3);
    ps.direction2 = new Vector3(1, 1.0, 0.3);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 1.2;

    ps.minSize = 0.15;
    ps.maxSize = 0.4;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.0;

    ps.color1 = new Color4(0.9, 0.95, 0.92, 0.5);
    ps.color2 = new Color4(0.7, 0.85, 0.78, 0.4);
    ps.colorDead = new Color4(0.4, 0.6, 0.5, 0.0);

    ps.gravity = new Vector3(0, -3, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

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
    // Stern (back of boat)
    this.sternEmitter.copyFromFloats(
      boatX - sinR * 3.5,
      WATER_LEVEL + 0.15,
      boatZ - cosR * 3.5
    );

    // Bow (front of boat)
    this.bowEmitter.copyFromFloats(
      boatX + sinR * 3.5,
      WATER_LEVEL + 0.1,
      boatZ + cosR * 3.5
    );

    // Sides
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

    // --- Adjust particle rates based on speed ---

    // Wake foam: proportional to speed
    if (absSpeed > 0.03) {
      this.wakeParticles.emitRate = Math.floor(absSpeed * 250);
      this.wakeParticles.minEmitPower = absSpeed * 1.0;
      this.wakeParticles.maxEmitPower = absSpeed * 3.0;
      this.wakeParticles.minSize = 0.3 + absSpeed * 0.5;
      this.wakeParticles.maxSize = 0.8 + absSpeed * 1.5;
    } else {
      this.wakeParticles.emitRate = 0;
    }

    // Bow spray: only at higher speeds
    if (absSpeed > 0.12) {
      const sprayIntensity = (absSpeed - 0.12) / 0.23; // 0 to 1
      this.sprayParticles.emitRate = Math.floor(sprayIntensity * 80);
      this.sprayParticles.minEmitPower = 0.5 + sprayIntensity * 1.5;
      this.sprayParticles.maxEmitPower = 1.0 + sprayIntensity * 3.0;
    } else {
      this.sprayParticles.emitRate = 0;
    }

    // Side splash: when turning at speed
    // (We'd need steering info — approximate from rotation change)
    if (absSpeed > 0.08) {
      this.splashParticles.emitRate = Math.floor(absSpeed * 30);
    } else {
      this.splashParticles.emitRate = 0;
    }

    // --- Ripple rings ---
    this.rippleTimer += deltaTime;
    if (absSpeed > 0.02 && this.rippleTimer > 0.4) {
      this.rippleTimer = 0;
      this.spawnRipple(boatX, boatZ, absSpeed);
    }

    // Update ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life -= deltaTime;
      if (r.life <= 0) {
        r.mesh.dispose();
        this.ripples.splice(i, 1);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      // Expand ring
      const scale = 1 + progress * 8;
      r.mesh.scaling.set(scale, 1, scale);
      // Fade out
      (r.mesh.material as StandardMaterial).alpha = (1 - progress) * 0.25;
    }

    // Limit ripples
    while (this.ripples.length > 15) {
      this.ripples[0].mesh.dispose();
      this.ripples.shift();
    }
  }

  private spawnRipple(x: number, z: number, speed: number): void {
    // Create a torus (ring) for the ripple
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
    for (const r of this.ripples) {
      r.mesh.dispose();
    }
    this.ripples = [];
  }
}
