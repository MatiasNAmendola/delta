import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { WATER_LEVEL, BOAT_LENGTH, PROP_SCALE } from "../utils/constants";
import { WakeRibbon, type WakeRibbonOptions } from "./WakeRibbon";

/**
 * The wake was designed for props 3.5x bigger and the lancha colectiva:
 * its sizes are scaled by this, set for the current boat in the constructor
 * (one wake exists at a time; it is rebuilt when the boat changes).
 */
let S = PROP_SCALE;

export interface WakeOptions {
  /** Boat length and top speed (world units, per 60 fps frame). */
  length: number;
  maxSpeed: number;
  /** How much wake it throws: 1 = lancha colectiva, ~0 = kayak. */
  strength: number;
  /** The physical wake on the water (Kelvin waves, wash, swirls). */
  ribbon: WakeRibbonOptions;
}

/** Brings a particle system designed at the old size down to the boat's scale. */
function scaleParticles(ps: ParticleSystem): void {
  ps.minEmitBox.scaleInPlace(S);
  ps.maxEmitBox.scaleInPlace(S);
  ps.minSize *= S;
  ps.maxSize *= S;
  ps.minEmitPower *= S;
  ps.maxEmitPower *= S;
  ps.gravity.scaleInPlace(S);
}

/** Stored boat position for wake ribbon generation */
interface WakePoint {
  x: number;
  z: number;
  rotation: number;
  speed: number;
  time: number;
}

export class WakeEffect {
  private scene: Scene;




  // Particle systems
  private sternFoam: ParticleSystem; // Dense foam behind stern
  private bowSpray: ParticleSystem; // Bow spray
  private sideSplashPort: ParticleSystem; // Port side splash
  private sideSplashStarboard: ParticleSystem; // Starboard side splash

  // Emitter positions
  private sternEmitter: Vector3;
  private bowEmitter: Vector3;
  private portEmitter: Vector3;
  private starboardEmitter: Vector3;

  // Procedural textures
  private foamTexture: DynamicTexture;
  private sprayTexture: DynamicTexture;


  private ribbon: WakeRibbon;
  private motor: boolean;
  private planing: boolean;
  private length: number;
  private maxSpeed: number;
  private strength: number;

  constructor(scene: Scene, options: WakeOptions) {
    S = PROP_SCALE * (options.length / BOAT_LENGTH) ** 0.7;
    this.length = options.length;
    this.maxSpeed = options.maxSpeed;
    this.strength = options.strength;
    this.scene = scene;

    // Create textures
    this.foamTexture = this.createFoamTexture();
    this.sprayTexture = this.createSprayTexture();

    // Create emitter positions
    this.sternEmitter = new Vector3(0, WATER_LEVEL + 0.15 * S, 0);
    this.bowEmitter = new Vector3(0, WATER_LEVEL + 0.1 * S, 0);
    this.portEmitter = new Vector3(0, WATER_LEVEL + 0.1 * S, 0);
    this.starboardEmitter = new Vector3(0, WATER_LEVEL + 0.1 * S, 0);

    // The waves, the white wash and the swirls: drawn from the physics (WakeRibbon)
    this.ribbon = new WakeRibbon(scene, options.ribbon);
    this.motor = options.ribbon.propulsion === "helice" || options.ribbon.propulsion === "turbina";
    this.planing = options.ribbon.hull === "planing";

    // Create all particle systems
    this.sternFoam = this.createSternFoamSystem();
    this.bowSpray = this.createBowSpraySystem();
    this.sideSplashPort = this.createSideSplashSystem("port");
    this.sideSplashStarboard = this.createSideSplashSystem("starboard");
  }

  /** Soft radial gradient foam blob texture */
  private createFoamTexture(): DynamicTexture {
    const size = 64;
    const tex = new DynamicTexture("foamTex", size, this.scene, false);
    const ctx = tex.getContext();
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy) / center;
        // Soft blob with irregular edges
        const noise = Math.sin(Math.atan2(dy, dx) * 5) * 0.1;
        const alpha = Math.max(0, 1 - (dist + noise) * (dist + noise));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update(true);
    tex.hasAlpha = true;
    return tex;
  }

  /** Elongated spray droplet texture */
  private createSprayTexture(): DynamicTexture {
    const size = 32;
    const tex = new DynamicTexture("sprayTex", size, this.scene, false);
    const ctx = tex.getContext();
    const cx = size / 2;
    const cy = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / (cy * 0.6); // elongated vertically
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.max(0, 1 - dist * dist);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update(true);
    tex.hasAlpha = true;
    return tex;
  }

  /** Dense stern foam - the churning white water behind the boat */
  private createSternFoamSystem(): ParticleSystem {
    const ps = new ParticleSystem("sternFoam", 600, this.scene);
    ps.particleTexture = this.foamTexture;
    ps.emitter = this.sternEmitter;

    ps.minEmitBox = new Vector3(-1.0, 0, -0.8);
    ps.maxEmitBox = new Vector3(1.0, 0.1, 0.8);
    ps.emitRate = 0;

    // Direction: spread backwards and sideways (V shape)
    ps.direction1 = new Vector3(-0.8, 0.05, -1.2);
    ps.direction2 = new Vector3(0.8, 0.15, -0.3);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 2.0;

    // Foam grows and spreads
    ps.minSize = 0.25;
    ps.maxSize = 0.7;
    ps.minScaleX = 1;
    ps.maxScaleX = 1.6;

    // Longer life for lingering foam
    ps.minLifeTime = 2.0;
    ps.maxLifeTime = 5.0;

    // Bright white foam on brown delta water
    ps.color1 = new Color4(1, 1, 0.95, 0.7);
    ps.color2 = new Color4(0.9, 0.95, 0.88, 0.6);
    ps.colorDead = new Color4(0.5, 0.55, 0.45, 0.0);

    ps.gravity = new Vector3(0, -0.05, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    // Billboard Y - particles lie flat on water surface
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y;

    scaleParticles(ps);
    ps.start();
    return ps;
  }

  /** Bow spray - water splashing upward at the front */
  private createBowSpraySystem(): ParticleSystem {
    const ps = new ParticleSystem("bowSpray", 200, this.scene);
    ps.particleTexture = this.sprayTexture;
    ps.emitter = this.bowEmitter;

    ps.minEmitBox = new Vector3(-0.5, 0, -0.3);
    ps.maxEmitBox = new Vector3(0.5, 0, 0.3);
    ps.emitRate = 0;

    // Direction: upward and outward to sides
    ps.direction1 = new Vector3(-1.0, 1.2, 0.3);
    ps.direction2 = new Vector3(1.0, 2.5, 1.0);
    ps.minEmitPower = 0.8;
    ps.maxEmitPower = 3.0;

    ps.minSize = 0.1;
    ps.maxSize = 0.4;

    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.9;

    // Bright white spray
    ps.color1 = new Color4(1, 1, 1, 0.8);
    ps.color2 = new Color4(0.9, 0.95, 0.92, 0.7);
    ps.colorDead = new Color4(0.7, 0.8, 0.75, 0.0);

    ps.gravity = new Vector3(0, -6, 0); // Falls back quickly
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    scaleParticles(ps);
    ps.start();
    return ps;
  }

  /** Side splash particles */
  private createSideSplashSystem(side: string): ParticleSystem {
    const ps = new ParticleSystem(`splash_${side}`, 120, this.scene);
    ps.particleTexture = this.foamTexture;
    ps.emitter =
      side === "port" ? this.portEmitter : this.starboardEmitter;

    ps.minEmitBox = new Vector3(-0.3, 0, -1.5);
    ps.maxEmitBox = new Vector3(0.3, 0, 1.5);
    ps.emitRate = 0;

    const sideDir = side === "port" ? -1 : 1;
    ps.direction1 = new Vector3(sideDir * 0.5, 0.3, -0.5);
    ps.direction2 = new Vector3(sideDir * 1.5, 0.8, 0.5);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 1.5;

    ps.minSize = 0.2;
    ps.maxSize = 0.6;
    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.5;

    ps.color1 = new Color4(0.95, 0.97, 0.92, 0.6);
    ps.color2 = new Color4(0.8, 0.88, 0.8, 0.5);
    ps.colorDead = new Color4(0.5, 0.6, 0.5, 0.0);

    ps.gravity = new Vector3(0, -3, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    scaleParticles(ps);
    ps.start();
    return ps;
  }

  public update(
    deltaTime: number,
    boatX: number,
    boatZ: number,
    boatRotation: number,
    speed: number,
    level = 0
  ): void {
    // The effects were tuned for the old boat (top speed 0.35): keep that feel
    const absSpeed = (Math.abs(speed) / this.maxSpeed) * 0.35;
    const sinR = Math.sin(boatRotation);
    const cosR = Math.cos(boatRotation);
    const halfBoat = this.length / 2;

    // --- Update emitter positions ---

    // Stern (back of boat)
    this.sternEmitter.copyFromFloats(
      boatX - sinR * halfBoat,
      WATER_LEVEL + 0.15 * S,
      boatZ - cosR * halfBoat
    );

    // Bow (front of boat)
    this.bowEmitter.copyFromFloats(
      boatX + sinR * (halfBoat + 0.5 * S),
      WATER_LEVEL + 0.1 * S,
      boatZ + cosR * (halfBoat + 0.5 * S)
    );

    // Sides (offset perpendicular to heading)
    const sideOffX = cosR * 1.3 * S;
    const sideOffZ = -sinR * 1.3 * S;
    this.portEmitter.copyFromFloats(
      boatX - sideOffX,
      WATER_LEVEL + 0.1 * S,
      boatZ - sideOffZ
    );
    this.starboardEmitter.copyFromFloats(
      boatX + sideOffX,
      WATER_LEVEL + 0.1 * S,
      boatZ + sideOffZ
    );

    this.ribbon.update(deltaTime, boatX + sinR * halfBoat, boatZ + cosR * halfBoat, speed / this.maxSpeed, level);

    // --- Adjust particle rates based on speed ---

    // Propeller churn right at the stern (the long white wash is drawn by the
    // ribbon); paddles and oars make no wash
    if (this.motor && absSpeed > 0.03) {
      this.sternFoam.emitRate = Math.floor(absSpeed * 90 * this.strength);
      this.sternFoam.minEmitPower = (absSpeed * 1.0) * S;
      this.sternFoam.maxEmitPower = (absSpeed * 2.5) * S;
      this.sternFoam.minSize = (0.12 + absSpeed * 0.25) * S;
      this.sternFoam.maxSize = (0.3 + absSpeed * 0.5) * S;
    } else {
      this.sternFoam.emitRate = 0;
    }

    // Bow spray: planing hulls throw spray sheets at speed
    if (this.planing && absSpeed > 0.12) {
      const sprayIntensity = (absSpeed - 0.12) / 0.23;
      this.bowSpray.emitRate = Math.floor((sprayIntensity * 120) * this.strength);
      this.bowSpray.minEmitPower = (0.4 + sprayIntensity * 0.8) * S;
      this.bowSpray.maxEmitPower = (0.8 + sprayIntensity * 1.6) * S;
    } else {
      this.bowSpray.emitRate = 0;
    }

    // Side splashes: a displacement hull pushing its bow wave aside
    if (this.motor && !this.planing && absSpeed > 0.08) {
      const splashRate = Math.floor(absSpeed * 18 * this.strength);
      this.sideSplashPort.emitRate = splashRate;
      this.sideSplashStarboard.emitRate = splashRate;
    } else {
      this.sideSplashPort.emitRate = 0;
      this.sideSplashStarboard.emitRate = 0;
    }

  }

  public dispose(): void {
    this.sternFoam.dispose();
    this.bowSpray.dispose();
    this.sideSplashPort.dispose();
    this.sideSplashStarboard.dispose();
    this.ribbon.dispose();
  }
}
