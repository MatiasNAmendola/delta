import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BOAT_MAX_SPEED,
  BOAT_ACCELERATION,
  BOAT_DECELERATION,
  BOAT_TURN_SPEED,
  BOAT_LENGTH,
  BOAT_WIDTH,
  WATER_LEVEL,
  COLORS,
  MAX_PASSENGERS,
} from "../utils/constants";
import { clamp } from "../utils/helpers";
import { WaterSystem } from "../world/WaterSystem";

export class LanchaColectiva {
  public rootNode: THREE.Group;
  public position: THREE.Vector3;
  public rotation = 0; // Y-axis rotation
  public speed = 0;
  public throttle = 0; // -1 to 1
  public steering = 0; // -1 to 1
  public passengers = 0;
  public wakeIntensity = 0;
  public modelLoaded = false;

  private meshes: THREE.Mesh[] = [];
  private time = 0;
  private bobPhase = 0;
  private modelContainer: THREE.Group | null = null;

  constructor(scene: THREE.Scene, startX: number, startZ: number) {
    this.position = new THREE.Vector3(startX, WATER_LEVEL + 0.08, startZ);
    this.rootNode = new THREE.Group();
    this.rootNode.name = "lancha";
    this.rootNode.position.copy(this.position);

    // Build fallback blocky boat immediately
    this.buildFallbackBoat();
    // Load GLB model asynchronously
    this.loadGLBModel();
  }

  private loadGLBModel(): void {
    try {
      const loader = new GLTFLoader();
      const base = document.querySelector("base")?.href || window.location.href;
      const url = new URL("models/lancha-optimized.glb", base).href;

      loader.load(
        url,
        (gltf) => {
          // Create container for the GLB model
          this.modelContainer = gltf.scene;
          this.modelContainer.name = "lanchaModel";

          // Scale and orient the model to fit the game
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const maxExtent = Math.max(size.x, size.y, size.z);
          const scale = BOAT_LENGTH / (maxExtent || 1);
          this.modelContainer.scale.setScalar(scale);

          // Center the model on its bounding box and raise it above water
          const minY = box.min.y;
          this.modelContainer.position.y = -minY * scale - 0.02;

          this.rootNode.add(this.modelContainer);

          // Remove fallback blocky boat
          for (const mesh of this.meshes) {
            this.rootNode.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
              mesh.material.dispose();
            }
          }
          this.meshes = [];

          this.modelLoaded = true;
          console.log("Lancha GLB model loaded successfully");
        },
        undefined,
        (error) => {
          console.warn("Could not load GLB model, using fallback:", error);
          // Keep the fallback blocky boat
        }
      );
    } catch (error) {
      console.warn("Could not load GLB model, using fallback:", error);
      // Keep the fallback blocky boat
    }
  }

  private createMat(color: string): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.1,
      roughness: 0.8,
    });
    return mat;
  }

  private buildFallbackBoat(): void {
    // Hull
    const hullGeo = new THREE.BoxGeometry(BOAT_WIDTH + 0.4, 0.8, BOAT_LENGTH);
    const hull = new THREE.Mesh(hullGeo, this.createMat(COLORS.boatHull));
    hull.name = "hull";
    hull.position.y = 0;
    this.rootNode.add(hull);
    this.meshes.push(hull);

    // Sides
    for (const side of [-1, 1]) {
      const sideGeo = new THREE.BoxGeometry(0.2, 0.6, BOAT_LENGTH - 0.5);
      const s = new THREE.Mesh(sideGeo, this.createMat(COLORS.woodDark));
      s.name = `side_${side}`;
      s.position.set(side * (BOAT_WIDTH / 2 + 0.1), 0.5, 0);
      this.rootNode.add(s);
      this.meshes.push(s);
    }

    // Deck
    const deckGeo = new THREE.BoxGeometry(
      BOAT_WIDTH + 0.2,
      0.1,
      BOAT_LENGTH - 0.4
    );
    const deck = new THREE.Mesh(deckGeo, this.createMat(COLORS.boatDeck));
    deck.name = "deck";
    deck.position.y = 0.45;
    this.rootNode.add(deck);
    this.meshes.push(deck);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(
      BOAT_WIDTH - 0.2,
      1.2,
      BOAT_LENGTH * 0.5
    );
    const cabin = new THREE.Mesh(cabinGeo, this.createMat(COLORS.boatCabin));
    cabin.name = "cabin";
    cabin.position.set(0, 1.1, -0.3);
    this.rootNode.add(cabin);
    this.meshes.push(cabin);

    // Roof
    const roofGeo = new THREE.BoxGeometry(
      BOAT_WIDTH + 0.3,
      0.15,
      BOAT_LENGTH * 0.5 + 0.6
    );
    const roof = new THREE.Mesh(roofGeo, this.createMat(COLORS.boatRoof));
    roof.name = "roof";
    roof.position.set(0, 1.8, -0.3);
    this.rootNode.add(roof);
    this.meshes.push(roof);

    // Bow
    const bowGeo = new THREE.BoxGeometry(BOAT_WIDTH * 0.5, 0.5, 1.0);
    const bow = new THREE.Mesh(bowGeo, this.createMat(COLORS.boatHull));
    bow.name = "bow";
    bow.position.set(0, 0.1, BOAT_LENGTH / 2);
    this.rootNode.add(bow);
    this.meshes.push(bow);

    // Pilot house
    const pilotGeo = new THREE.BoxGeometry(BOAT_WIDTH - 0.4, 1.0, 1.2);
    const pilot = new THREE.Mesh(pilotGeo, this.createMat(COLORS.woodLight));
    pilot.name = "pilot";
    pilot.position.set(0, 1.0, BOAT_LENGTH / 2 - 1.2);
    this.rootNode.add(pilot);
    this.meshes.push(pilot);
  }

  public update(
    deltaTime: number,
    waterSystem: WaterSystem,
    gyroSteering: number | null
  ): void {
    this.time += deltaTime;

    const effectiveSteering =
      gyroSteering !== null ? gyroSteering : this.steering;

    // Acceleration / deceleration
    if (this.throttle !== 0) {
      this.speed += this.throttle * BOAT_ACCELERATION;
    } else {
      if (Math.abs(this.speed) > 0.001) {
        this.speed -= Math.sign(this.speed) * BOAT_DECELERATION;
      } else {
        this.speed = 0;
      }
    }
    this.speed = clamp(this.speed, -BOAT_MAX_SPEED * 0.3, BOAT_MAX_SPEED);

    // Turning
    const turnFactor = Math.min(
      1,
      Math.abs(this.speed) / (BOAT_MAX_SPEED * 0.3)
    );
    this.rotation += effectiveSteering * BOAT_TURN_SPEED * turnFactor;

    // Move
    const dx = Math.sin(this.rotation) * this.speed;
    const dz = Math.cos(this.rotation) * this.speed;

    const newX = this.position.x + dx;
    const newZ = this.position.z + dz;

    // Check 9 hull points using precise distance-to-river check:
    // center, bow, stern, port, starboard, and 4 corners
    const sinR = Math.sin(this.rotation);
    const cosR = Math.cos(this.rotation);
    const halfL = BOAT_LENGTH / 2;
    const halfW = BOAT_WIDTH / 2;

    // Helper: check all 9 hull points are in water for a given position
    const allPointsInWater = (cx: number, cz: number): boolean => {
      // Forward/back along boat axis
      const fwdX = sinR * halfL,
        fwdZ = cosR * halfL;
      // Left/right perpendicular to boat axis
      const sideX = cosR * halfW,
        sideZ = -sinR * halfW;

      return (
        waterSystem.isWaterPrecise(cx, cz) && // center
        waterSystem.isWaterPrecise(cx + fwdX, cz + fwdZ) && // bow
        waterSystem.isWaterPrecise(cx - fwdX, cz - fwdZ) && // stern
        waterSystem.isWaterPrecise(cx + sideX, cz + sideZ) && // starboard
        waterSystem.isWaterPrecise(cx - sideX, cz - sideZ) && // port
        waterSystem.isWaterPrecise(cx + fwdX + sideX, cz + fwdZ + sideZ) && // bow-starboard
        waterSystem.isWaterPrecise(cx + fwdX - sideX, cz + fwdZ - sideZ) && // bow-port
        waterSystem.isWaterPrecise(cx - fwdX + sideX, cz - fwdZ + sideZ) && // stern-starboard
        waterSystem.isWaterPrecise(cx - fwdX - sideX, cz - fwdZ - sideZ) // stern-port
      );
    };

    if (allPointsInWater(newX, newZ)) {
      this.position.x = newX;
      this.position.z = newZ;
    } else {
      // Try sliding along one axis
      if (allPointsInWater(this.position.x + dx, this.position.z)) {
        this.position.x += dx;
        this.speed *= 0.5;
      } else if (allPointsInWater(this.position.x, this.position.z + dz)) {
        this.position.z += dz;
        this.speed *= 0.5;
      } else {
        // Can't move — bounce back
        this.speed *= -0.3;
      }
    }

    // Wave bobbing
    this.bobPhase += deltaTime * 2;
    const waveH = waterSystem.getWaveHeight(
      this.position.x,
      this.position.z,
      this.time
    );
    this.position.y = WATER_LEVEL + 0.08 + waveH;

    this.wakeIntensity = Math.abs(this.speed) / BOAT_MAX_SPEED;

    // Update transform
    this.rootNode.position.copy(this.position);
    this.rootNode.rotation.y = this.rotation;
    this.rootNode.rotation.z =
      -effectiveSteering * turnFactor * 0.08 +
      Math.sin(this.bobPhase * 0.7) * 0.02;
    this.rootNode.rotation.x =
      -this.speed * 0.15 + Math.sin(this.bobPhase) * 0.015;
  }

  public canPickup(): boolean {
    return this.passengers < MAX_PASSENGERS;
  }

  public addPassengers(count: number): number {
    const space = MAX_PASSENGERS - this.passengers;
    const actual = Math.min(count, space);
    this.passengers += actual;
    return actual;
  }

  public dropPassengers(): number {
    const dropped = this.passengers;
    this.passengers = 0;
    return dropped;
  }
}
