import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
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
import { hexToColor3, clamp } from "../utils/helpers";
import { WaterSystem } from "../world/WaterSystem";

export class LanchaColectiva {
  public rootNode: TransformNode;
  public position: Vector3;
  public rotation = 0; // Y-axis rotation
  public speed = 0;
  public throttle = 0; // -1 to 1
  public steering = 0; // -1 to 1
  public passengers = 0;
  public wakeIntensity = 0;
  public modelLoaded = false;

  private scene: Scene;
  private meshes: Mesh[] = [];
  private time = 0;
  private bobPhase = 0;
  private modelContainer: TransformNode | null = null;

  constructor(scene: Scene, startX: number, startZ: number) {
    this.scene = scene;
    this.position = new Vector3(startX, WATER_LEVEL + 0.02, startZ);
    this.rootNode = new TransformNode("lancha", scene);
    this.rootNode.position = this.position.clone();

    // Build fallback blocky boat immediately
    this.buildFallbackBoat();
    // Load GLB model asynchronously
    this.loadGLBModel();
  }

  private async loadGLBModel(): Promise<void> {
    try {
      // Resolve the model URL relative to the page base
      const base = document.querySelector("base")?.href || window.location.href;
      const modelsUrl = new URL("models/", base).href;

      const result = await SceneLoader.ImportMeshAsync(
        "",
        modelsUrl,
        "lancha-optimized.glb",
        this.scene
      );

      // Create container for the GLB model
      this.modelContainer = new TransformNode("lanchaModel", this.scene);
      this.modelContainer.parent = this.rootNode;

      // Parent all loaded meshes to our container
      for (const mesh of result.meshes) {
        if (!mesh.parent) {
          mesh.parent = this.modelContainer;
        }
      }

      // Scale and orient the model to fit the game
      const boundingInfo = result.meshes[0]?.getBoundingInfo();
      if (boundingInfo) {
        const extents = boundingInfo.boundingBox.extendSizeWorld;
        const maxExtent = Math.max(extents.x, extents.y, extents.z) * 2;
        const desiredSize = BOAT_LENGTH;
        const scale = desiredSize / (maxExtent || 1);
        this.modelContainer.scaling.setAll(scale);

        // Center the model on its bounding box and raise it above water
        const center = boundingInfo.boundingBox.centerWorld;
        const minY = boundingInfo.boundingBox.minimumWorld.y;
        this.modelContainer.position.y = -minY * scale - 0.1;
      } else {
        this.modelContainer.scaling.setAll(0.3);
        this.modelContainer.position.y = -0.1;
      }

      // Remove fallback blocky boat
      for (const mesh of this.meshes) {
        mesh.dispose();
      }
      this.meshes = [];

      this.modelLoaded = true;
      console.log("Lancha GLB model loaded successfully");
    } catch (error) {
      console.warn("Could not load GLB model, using fallback:", error);
      // Keep the fallback blocky boat
    }
  }

  private createMat(name: string, color: string): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = hexToColor3(color);
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    return mat;
  }

  private buildFallbackBoat(): void {
    // Hull
    const hull = MeshBuilder.CreateBox(
      "hull",
      { width: BOAT_WIDTH + 0.4, height: 0.8, depth: BOAT_LENGTH },
      this.scene
    );
    hull.material = this.createMat("hullMat", COLORS.boatHull);
    hull.parent = this.rootNode;
    hull.position.y = 0;
    this.meshes.push(hull);

    // Sides
    for (const side of [-1, 1]) {
      const s = MeshBuilder.CreateBox(
        `side_${side}`,
        { width: 0.2, height: 0.6, depth: BOAT_LENGTH - 0.5 },
        this.scene
      );
      s.material = this.createMat(`sideMat_${side}`, COLORS.woodDark);
      s.parent = this.rootNode;
      s.position.set(side * (BOAT_WIDTH / 2 + 0.1), 0.5, 0);
      this.meshes.push(s);
    }

    // Deck
    const deck = MeshBuilder.CreateBox(
      "deck",
      { width: BOAT_WIDTH + 0.2, height: 0.1, depth: BOAT_LENGTH - 0.4 },
      this.scene
    );
    deck.material = this.createMat("deckMat", COLORS.boatDeck);
    deck.parent = this.rootNode;
    deck.position.y = 0.45;
    this.meshes.push(deck);

    // Cabin
    const cabin = MeshBuilder.CreateBox(
      "cabin",
      { width: BOAT_WIDTH - 0.2, height: 1.2, depth: BOAT_LENGTH * 0.5 },
      this.scene
    );
    cabin.material = this.createMat("cabinMat", COLORS.boatCabin);
    cabin.parent = this.rootNode;
    cabin.position.set(0, 1.1, -0.3);
    this.meshes.push(cabin);

    // Roof
    const roof = MeshBuilder.CreateBox(
      "roof",
      { width: BOAT_WIDTH + 0.3, height: 0.15, depth: BOAT_LENGTH * 0.5 + 0.6 },
      this.scene
    );
    roof.material = this.createMat("roofMat", COLORS.boatRoof);
    roof.parent = this.rootNode;
    roof.position.set(0, 1.8, -0.3);
    this.meshes.push(roof);

    // Bow
    const bow = MeshBuilder.CreateBox(
      "bow",
      { width: BOAT_WIDTH * 0.5, height: 0.5, depth: 1.0 },
      this.scene
    );
    bow.material = this.createMat("bowMat", COLORS.boatHull);
    bow.parent = this.rootNode;
    bow.position.set(0, 0.1, BOAT_LENGTH / 2);
    this.meshes.push(bow);

    // Pilot house
    const pilot = MeshBuilder.CreateBox(
      "pilot",
      { width: BOAT_WIDTH - 0.4, height: 1.0, depth: 1.2 },
      this.scene
    );
    pilot.material = this.createMat("pilotMat", COLORS.woodLight);
    pilot.parent = this.rootNode;
    pilot.position.set(0, 1.0, BOAT_LENGTH / 2 - 1.2);
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
    const turnFactor = Math.min(1, Math.abs(this.speed) / (BOAT_MAX_SPEED * 0.3));
    this.rotation += effectiveSteering * BOAT_TURN_SPEED * turnFactor;

    // Move
    const dx = Math.sin(this.rotation) * this.speed;
    const dz = Math.cos(this.rotation) * this.speed;

    const newX = this.position.x + dx;
    const newZ = this.position.z + dz;

    // Check multiple hull points: bow, stern, port, starboard
    const sinR = Math.sin(this.rotation);
    const cosR = Math.cos(this.rotation);
    const halfL = BOAT_LENGTH / 2;
    const halfW = BOAT_WIDTH / 2;
    const bowX = newX + sinR * halfL;
    const bowZ = newZ + cosR * halfL;
    const sternX = newX - sinR * halfL;
    const sternZ = newZ - cosR * halfL;
    const portX = newX - cosR * halfW;
    const portZ = newZ + sinR * halfW;
    const stbdX = newX + cosR * halfW;
    const stbdZ = newZ - sinR * halfW;

    const allInWater =
      waterSystem.isWater(newX, newZ) &&
      waterSystem.isWater(bowX, bowZ) &&
      waterSystem.isWater(sternX, sternZ) &&
      waterSystem.isWater(portX, portZ) &&
      waterSystem.isWater(stbdX, stbdZ);

    if (allInWater) {
      this.position.x = newX;
      this.position.z = newZ;
    } else {
      this.speed *= -0.3;
      // Try sliding along one axis
      const slideX = this.position.x + dx;
      const slideXOk =
        waterSystem.isWater(slideX, this.position.z) &&
        waterSystem.isWater(slideX + sinR * halfL, this.position.z + cosR * halfL);
      const slideZ = this.position.z + dz;
      const slideZOk =
        waterSystem.isWater(this.position.x, slideZ) &&
        waterSystem.isWater(this.position.x + sinR * halfL, slideZ + cosR * halfL);

      if (slideXOk) {
        this.position.x = slideX;
        this.speed *= 0.5;
      } else if (slideZOk) {
        this.position.z = slideZ;
        this.speed *= 0.5;
      }
    }

    // Wave bobbing
    this.bobPhase += deltaTime * 2;
    const waveH = waterSystem.getWaveHeight(
      this.position.x,
      this.position.z,
      this.time
    );
    this.position.y = WATER_LEVEL + 0.02 + waveH;

    this.wakeIntensity = Math.abs(this.speed) / BOAT_MAX_SPEED;

    // Update transform
    this.rootNode.position.copyFrom(this.position);
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
