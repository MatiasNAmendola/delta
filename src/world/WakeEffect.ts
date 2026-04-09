import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WATER_LEVEL } from "../utils/constants";

interface WakeParticle {
  mesh: Mesh;
  life: number;
  maxLife: number;
  velocity: Vector3;
}

export class WakeEffect {
  private scene: Scene;
  private particles: WakeParticle[] = [];
  private wakeMat: StandardMaterial;
  private spawnTimer = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.wakeMat = new StandardMaterial("wakeMat", scene);
    this.wakeMat.diffuseColor = new Color3(0.7, 0.85, 0.8);
    this.wakeMat.emissiveColor = new Color3(0.2, 0.3, 0.25);
    this.wakeMat.alpha = 0.4;
    this.wakeMat.specularColor = Color3.Black();
  }

  public update(
    deltaTime: number,
    boatX: number,
    boatZ: number,
    boatRotation: number,
    speed: number
  ): void {
    this.spawnTimer += deltaTime;

    // Spawn new wake particles
    if (Math.abs(speed) > 0.05 && this.spawnTimer > 0.08) {
      this.spawnTimer = 0;
      this.spawnWakeParticle(boatX, boatZ, boatRotation, speed);
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime;

      if (p.life <= 0) {
        p.mesh.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      const lifeRatio = p.life / p.maxLife;
      p.mesh.scaling.x = 1 + (1 - lifeRatio) * 2;
      p.mesh.scaling.z = 1 + (1 - lifeRatio) * 2;

      const mat = p.mesh.material as StandardMaterial;
      mat.alpha = lifeRatio * 0.35;

      p.mesh.position.x += p.velocity.x * deltaTime;
      p.mesh.position.z += p.velocity.z * deltaTime;
    }

    // Limit particles
    while (this.particles.length > 40) {
      this.particles[0].mesh.dispose();
      this.particles.shift();
    }
  }

  private spawnWakeParticle(
    x: number,
    z: number,
    rotation: number,
    speed: number
  ): void {
    // Spawn behind the boat
    const behindX = x - Math.sin(rotation) * 3.5;
    const behindZ = z - Math.cos(rotation) * 3.5;

    const particle = MeshBuilder.CreateBox(
      "wake_" + Date.now(),
      { width: 0.8, height: 0.05, depth: 0.8 },
      this.scene
    );

    const mat = this.wakeMat.clone("wakeMat_" + Date.now());
    mat.alpha = 0.35;
    particle.material = mat;
    particle.position.set(behindX, WATER_LEVEL + 0.08, behindZ);

    // Spread velocity
    const spreadAngle = rotation + Math.PI + (Math.random() - 0.5) * 0.8;
    const spreadSpeed = Math.abs(speed) * 0.3;

    this.particles.push({
      mesh: particle,
      life: 2.0,
      maxLife: 2.0,
      velocity: new Vector3(
        Math.sin(spreadAngle) * spreadSpeed,
        0,
        Math.cos(spreadAngle) * spreadSpeed
      ),
    });
  }

  public dispose(): void {
    for (const p of this.particles) {
      p.mesh.dispose();
    }
    this.particles = [];
  }
}
