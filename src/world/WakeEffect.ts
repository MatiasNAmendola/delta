import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { WATER_LEVEL, BOAT_LENGTH } from "../utils/constants";

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

  // V-wake trail meshes (Kelvin wake pattern)
  private portTrailNode: TransformNode;
  private starboardTrailNode: TransformNode;
  private portTrail: TrailMesh;
  private starboardTrail: TrailMesh;
  private trailMat: StandardMaterial;

  // Center foam trail
  private centerTrailNode: TransformNode;
  private centerTrail: TrailMesh;
  private centerTrailMat: StandardMaterial;

  // Bow wave mesh
  private bowWaveMesh: Mesh;
  private bowWaveMat: StandardMaterial;

  // Particle systems
  private sternFoam: ParticleSystem; // Dense foam behind stern
  private bowSpray: ParticleSystem; // Bow spray
  private sideSplashPort: ParticleSystem; // Port side splash
  private sideSplashStarboard: ParticleSystem; // Starboard side splash
  private surfaceFoam: ParticleSystem; // Flat surface foam (Y-billboard)

  // Emitter positions
  private sternEmitter: Vector3;
  private bowEmitter: Vector3;
  private portEmitter: Vector3;
  private starboardEmitter: Vector3;
  private surfaceFoamEmitter: Vector3;

  // Procedural textures
  private foamTexture: DynamicTexture;
  private sprayTexture: DynamicTexture;

  // Ripple rings
  private ripples: { mesh: Mesh; life: number; maxLife: number }[] = [];
  private rippleMat: StandardMaterial;
  private rippleTimer = 0;

  constructor(scene: Scene) {
    this.scene = scene;

    // Create textures
    this.foamTexture = this.createFoamTexture();
    this.sprayTexture = this.createSprayTexture();

    // Create emitter positions
    this.sternEmitter = new Vector3(0, WATER_LEVEL + 0.15, 0);
    this.bowEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.portEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.starboardEmitter = new Vector3(0, WATER_LEVEL + 0.1, 0);
    this.surfaceFoamEmitter = new Vector3(0, WATER_LEVEL + 0.08, 0);

    // Create V-wake trails (Kelvin angle ~19.47 degrees)
    this.trailMat = this.createTrailMaterial();
    this.centerTrailMat = this.createCenterTrailMaterial();

    // Port trail node
    this.portTrailNode = new TransformNode("portTrailNode", scene);
    this.portTrailNode.position.set(0, WATER_LEVEL + 0.06, 0);
    this.portTrail = new TrailMesh("portTrail", this.portTrailNode, scene, {
      diameter: 0.3,
      length: 80,
      segments: 80,
      sections: 2,
    });
    this.portTrail.material = this.trailMat;

    // Starboard trail node
    this.starboardTrailNode = new TransformNode("starboardTrailNode", scene);
    this.starboardTrailNode.position.set(0, WATER_LEVEL + 0.06, 0);
    this.starboardTrail = new TrailMesh(
      "starboardTrail",
      this.starboardTrailNode,
      scene,
      { diameter: 0.3, length: 80, segments: 80, sections: 2 }
    );
    this.starboardTrail.material = this.trailMat;

    // Center foam trail
    this.centerTrailNode = new TransformNode("centerTrailNode", scene);
    this.centerTrailNode.position.set(0, WATER_LEVEL + 0.07, 0);
    this.centerTrail = new TrailMesh(
      "centerTrail",
      this.centerTrailNode,
      scene,
      { diameter: 1.5, length: 50, segments: 50, sections: 2 }
    );
    this.centerTrail.material = this.centerTrailMat;

    // Bow wave mesh
    this.bowWaveMat = this.createBowWaveMaterial();
    this.bowWaveMesh = this.createBowWaveMesh();

    // Ripple material
    this.rippleMat = this.createRippleMaterial();

    // Create all particle systems
    this.sternFoam = this.createSternFoamSystem();
    this.bowSpray = this.createBowSpraySystem();
    this.sideSplashPort = this.createSideSplashSystem("port");
    this.sideSplashStarboard = this.createSideSplashSystem("starboard");
    this.surfaceFoam = this.createSurfaceFoamSystem();
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

  /** Semi-transparent white trail material for V-wake */
  private createTrailMaterial(): StandardMaterial {
    const mat = new StandardMaterial("trailMat", this.scene);
    mat.diffuseColor = new Color3(0.95, 0.97, 0.93);
    mat.emissiveColor = new Color3(0.35, 0.4, 0.35);
    mat.specularColor = new Color3(0.3, 0.3, 0.3);
    mat.alpha = 0.4;
    mat.backFaceCulling = false;
    return mat;
  }

  /** Center foam trail material - brighter, more opaque */
  private createCenterTrailMaterial(): StandardMaterial {
    const mat = new StandardMaterial("centerTrailMat", this.scene);
    mat.diffuseColor = new Color3(0.9, 0.93, 0.88);
    mat.emissiveColor = new Color3(0.45, 0.5, 0.43);
    mat.specularColor = new Color3(0.4, 0.4, 0.4);
    mat.alpha = 0.55;
    mat.backFaceCulling = false;
    return mat;
  }

  /** Bow wave material */
  private createBowWaveMaterial(): StandardMaterial {
    const mat = new StandardMaterial("bowWaveMat", this.scene);
    mat.diffuseColor = new Color3(0.9, 0.95, 0.9);
    mat.emissiveColor = new Color3(0.4, 0.45, 0.4);
    mat.specularColor = new Color3(0.5, 0.5, 0.5);
    mat.alpha = 0.5;
    mat.backFaceCulling = false;
    return mat;
  }

  /** Ripple ring material */
  private createRippleMaterial(): StandardMaterial {
    const mat = new StandardMaterial("rippleMat", this.scene);
    mat.diffuseColor = new Color3(0.8, 0.9, 0.85);
    mat.emissiveColor = new Color3(0.3, 0.4, 0.35);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.3;
    mat.backFaceCulling = false;
    return mat;
  }

  /** Create bow wave geometry - a curved wedge shape */
  private createBowWaveMesh(): Mesh {
    const mesh = MeshBuilder.CreateDisc(
      "bowWave",
      { radius: 2.5, tessellation: 12, arc: 0.5 },
      this.scene
    );
    mesh.material = this.bowWaveMat;
    mesh.rotation.x = Math.PI / 2; // Lay flat on water
    mesh.position.y = WATER_LEVEL + 0.08;
    mesh.isVisible = false; // Hidden until boat moves
    return mesh;
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
    ps.minSize = 0.4;
    ps.maxSize = 1.2;
    ps.minScaleX = 1;
    ps.maxScaleX = 2.5;

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

    ps.start();
    return ps;
  }

  /** Surface foam - flat particles that sit on the water surface */
  private createSurfaceFoamSystem(): ParticleSystem {
    const ps = new ParticleSystem("surfaceFoam", 400, this.scene);
    ps.particleTexture = this.foamTexture;
    ps.emitter = this.surfaceFoamEmitter;

    ps.minEmitBox = new Vector3(-1.5, 0, -1.0);
    ps.maxEmitBox = new Vector3(1.5, 0, 1.0);
    ps.emitRate = 0;

    // Spread outward slowly in V pattern
    ps.direction1 = new Vector3(-0.6, 0, -0.8);
    ps.direction2 = new Vector3(0.6, 0.02, -0.2);
    ps.minEmitPower = 0.2;
    ps.maxEmitPower = 1.0;

    // Large flat foam patches
    ps.minSize = 0.6;
    ps.maxSize = 2.0;
    ps.minScaleX = 1.5;
    ps.maxScaleX = 3.0;

    // Long-lived surface foam
    ps.minLifeTime = 3.0;
    ps.maxLifeTime = 7.0;

    ps.color1 = new Color4(0.95, 0.97, 0.92, 0.5);
    ps.color2 = new Color4(0.85, 0.9, 0.83, 0.4);
    ps.colorDead = new Color4(0.4, 0.5, 0.4, 0.0);

    ps.gravity = new Vector3(0, -0.02, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    // Y-billboard: particles lie flat on water
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y;

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
    const halfBoat = BOAT_LENGTH / 2;

    // --- Update emitter positions ---

    // Stern (back of boat)
    this.sternEmitter.copyFromFloats(
      boatX - sinR * halfBoat,
      WATER_LEVEL + 0.15,
      boatZ - cosR * halfBoat
    );

    // Bow (front of boat)
    this.bowEmitter.copyFromFloats(
      boatX + sinR * (halfBoat + 0.5),
      WATER_LEVEL + 0.1,
      boatZ + cosR * (halfBoat + 0.5)
    );

    // Sides (offset perpendicular to heading)
    const sideOffX = cosR * 1.3;
    const sideOffZ = -sinR * 1.3;
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

    // Surface foam emitter (behind stern)
    this.surfaceFoamEmitter.copyFromFloats(
      boatX - sinR * (halfBoat + 1),
      WATER_LEVEL + 0.08,
      boatZ - cosR * (halfBoat + 1)
    );

    // --- Update V-wake trail nodes ---
    // Kelvin wake angle: ~19.47 degrees from path
    const kelvinAngle = 0.34; // ~19.47 degrees in radians
    const trailOffset = halfBoat + 0.5; // Start behind stern

    if (absSpeed > 0.03) {
      // Port trail: offset to the left at Kelvin angle
      const portAngle = boatRotation + Math.PI + kelvinAngle;
      this.portTrailNode.position.copyFromFloats(
        boatX + Math.sin(portAngle) * trailOffset - cosR * 1.0,
        WATER_LEVEL + 0.06,
        boatZ + Math.cos(portAngle) * trailOffset + sinR * 1.0
      );

      // Starboard trail: offset to the right at Kelvin angle
      const stbdAngle = boatRotation + Math.PI - kelvinAngle;
      this.starboardTrailNode.position.copyFromFloats(
        boatX + Math.sin(stbdAngle) * trailOffset + cosR * 1.0,
        WATER_LEVEL + 0.06,
        boatZ + Math.cos(stbdAngle) * trailOffset - sinR * 1.0
      );

      // Center foam trail node
      this.centerTrailNode.position.copyFromFloats(
        boatX - sinR * (halfBoat + 0.3),
        WATER_LEVEL + 0.07,
        boatZ - cosR * (halfBoat + 0.3)
      );

      // Scale trail width with speed
      const trailScale = 0.3 + absSpeed * 4;
      this.portTrail.diameter = trailScale;
      this.starboardTrail.diameter = trailScale;
      this.centerTrail.diameter = 1.0 + absSpeed * 6;

      this.trailMat.alpha = Math.min(0.5, absSpeed * 2);
      this.centerTrailMat.alpha = Math.min(0.6, absSpeed * 2.5);
    } else {
      // When stopped, fade trails
      this.trailMat.alpha = Math.max(0, this.trailMat.alpha - deltaTime * 0.5);
      this.centerTrailMat.alpha = Math.max(
        0,
        this.centerTrailMat.alpha - deltaTime * 0.5
      );
    }

    // --- Update bow wave mesh ---
    if (absSpeed > 0.08) {
      this.bowWaveMesh.isVisible = true;
      const bowScale = 0.5 + absSpeed * 6;
      this.bowWaveMesh.scaling.set(bowScale, 1, bowScale * 1.2);
      this.bowWaveMesh.position.copyFromFloats(
        boatX + sinR * (halfBoat + 1),
        WATER_LEVEL + 0.08,
        boatZ + cosR * (halfBoat + 1)
      );
      this.bowWaveMesh.rotation.y = boatRotation;
      this.bowWaveMat.alpha = Math.min(0.6, (absSpeed - 0.08) * 3);
    } else {
      this.bowWaveMesh.isVisible = false;
    }

    // --- Adjust particle rates based on speed ---

    // Stern foam: heavy churning behind the boat
    if (absSpeed > 0.03) {
      this.sternFoam.emitRate = Math.floor(absSpeed * 500);
      this.sternFoam.minEmitPower = absSpeed * 1.5;
      this.sternFoam.maxEmitPower = absSpeed * 4.0;
      this.sternFoam.minSize = 0.4 + absSpeed * 0.8;
      this.sternFoam.maxSize = 1.2 + absSpeed * 3.0;
    } else {
      this.sternFoam.emitRate = 0;
    }

    // Surface foam: flat foam patches on water
    if (absSpeed > 0.05) {
      this.surfaceFoam.emitRate = Math.floor(absSpeed * 300);
      this.surfaceFoam.minEmitPower = 0.2 + absSpeed * 0.8;
      this.surfaceFoam.maxEmitPower = 0.8 + absSpeed * 2.0;
    } else {
      this.surfaceFoam.emitRate = 0;
    }

    // Bow spray: only at higher speeds
    if (absSpeed > 0.12) {
      const sprayIntensity = (absSpeed - 0.12) / 0.23;
      this.bowSpray.emitRate = Math.floor(sprayIntensity * 120);
      this.bowSpray.minEmitPower = 0.8 + sprayIntensity * 2.0;
      this.bowSpray.maxEmitPower = 1.5 + sprayIntensity * 4.0;
    } else {
      this.bowSpray.emitRate = 0;
    }

    // Side splashes
    if (absSpeed > 0.08) {
      const splashRate = Math.floor(absSpeed * 50);
      this.sideSplashPort.emitRate = splashRate;
      this.sideSplashStarboard.emitRate = splashRate;
    } else {
      this.sideSplashPort.emitRate = 0;
      this.sideSplashStarboard.emitRate = 0;
    }

    // --- Ripple rings ---
    this.rippleTimer += deltaTime;
    if (absSpeed > 0.02 && this.rippleTimer > 0.35) {
      this.rippleTimer = 0;
      this.spawnRipple(
        boatX - sinR * halfBoat,
        boatZ - cosR * halfBoat,
        absSpeed
      );
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
      const scale = 1 + progress * 10;
      r.mesh.scaling.set(scale, 1, scale);
      (r.mesh.material as StandardMaterial).alpha = (1 - progress) * 0.25;
    }

    // Limit ripples
    while (this.ripples.length > 20) {
      this.ripples[0].mesh.dispose();
      this.ripples.shift();
    }
  }

  private spawnRipple(x: number, z: number, speed: number): void {
    const ring = MeshBuilder.CreateTorus(
      "ripple",
      {
        diameter: 2.0 + speed * 3,
        thickness: 0.08 + speed * 0.12,
        tessellation: 24,
      },
      this.scene
    );

    const mat = this.rippleMat.clone("rippleMat_" + Date.now());
    mat.alpha = 0.25;
    ring.material = mat;
    ring.position.set(x, WATER_LEVEL + 0.06, z);

    const maxLife = 2.5 + speed * 2.5;
    this.ripples.push({ mesh: ring, life: maxLife, maxLife });
  }

  public dispose(): void {
    this.sternFoam.dispose();
    this.bowSpray.dispose();
    this.sideSplashPort.dispose();
    this.sideSplashStarboard.dispose();
    this.surfaceFoam.dispose();
    this.portTrail.dispose();
    this.starboardTrail.dispose();
    this.centerTrail.dispose();
    this.portTrailNode.dispose();
    this.starboardTrailNode.dispose();
    this.centerTrailNode.dispose();
    this.bowWaveMesh.dispose();
    for (const r of this.ripples) {
      r.mesh.dispose();
    }
    this.ripples = [];
  }
}
