import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
// Only the core glTF 2.0 loader: our models use no glTF extensions
import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import {
  BOAT_MAX_SPEED,
  BOAT_ACCELERATION,
  BOAT_DECELERATION,
  BOAT_TURN_SPEED,
  BOAT_LENGTH,
  BOAT_WIDTH,
  WATER_LEVEL,
  COLORS,
} from "../utils/constants";
import { hexToColor3, clamp } from "../utils/helpers";
import { WaterSystem } from "../world/WaterSystem";
import { findFloatingPose, moveHull } from "./hullCollision";

/** The boat's root rides this far above the water (the fallback blocks are built around it). */
const HULL_RIDE_HEIGHT = 0.6;
/** How deep the model's keel sits under the water. */
const MODEL_DRAFT = 0.25;

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

  constructor(
    scene: Scene,
    startX: number,
    startZ: number,
    private readonly capacity: number
  ) {
    this.scene = scene;
    this.position = new Vector3(startX, WATER_LEVEL + HULL_RIDE_HEIGHT, startZ);
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

      // Measured at the origin first: bounding vectors are in world space
      this.modelContainer = new TransformNode("lanchaModel", this.scene);
      for (const mesh of result.meshes) {
        if (!mesh.parent) {
          mesh.parent = this.modelContainer;
        }
        mesh.isPickable = false;
      }

      // Scale the model to the boat's length and float it: keel slightly
      // under the water, the rest above
      const { min, max } = this.modelContainer.getHierarchyBoundingVectors(true);
      const length = Math.max(max.x - min.x, max.z - min.z) || 1;
      const scale = BOAT_LENGTH / length;
      this.modelContainer.scaling.setAll(scale);
      this.modelContainer.position.y = -HULL_RIDE_HEIGHT - min.y * scale - MODEL_DRAFT;
      this.modelContainer.parent = this.rootNode;

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

    // Tuning constants are per 60 fps frame; scale by real elapsed time so the
    // boat handles the same on a 30 fps phone and a 120 Hz screen.
    // Clamped so a stalled frame (tab switch) can't teleport the boat.
    const frames = Math.min(deltaTime, 0.1) * 60;

    // Acceleration / deceleration
    if (this.throttle !== 0) {
      this.speed += this.throttle * BOAT_ACCELERATION * frames;
    } else if (Math.abs(this.speed) > BOAT_DECELERATION * frames) {
      this.speed -= Math.sign(this.speed) * BOAT_DECELERATION * frames;
    } else {
      this.speed = 0;
    }
    this.speed = clamp(this.speed, -BOAT_MAX_SPEED * 0.3, BOAT_MAX_SPEED);

    // Turning
    const turnFactor = Math.min(1, Math.abs(this.speed) / (BOAT_MAX_SPEED * 0.3));
    const turn = effectiveSteering * BOAT_TURN_SPEED * turnFactor * frames;

    // Move (speed is in world units per 60 fps frame); the whole hull must stay afloat
    const heading = this.rotation + turn;
    const dx = Math.sin(heading) * this.speed * frames;
    const dz = Math.cos(heading) * this.speed * frames;
    const isWater = (x: number, z: number) => waterSystem.isWater(x, z);
    const result = moveHull(
      { x: this.position.x, z: this.position.z, rotation: this.rotation },
      turn,
      dx,
      dz,
      isWater
    );
    this.position.x = result.pose.x;
    this.position.z = result.pose.z;
    this.rotation = result.pose.rotation;
    if (result.hit) {
      // Scraping along the bank slows the boat; a head-on hit bounces it back
      this.speed *= result.slid ? 0.85 : -0.3;
    }

    // Wave bobbing
    this.bobPhase += deltaTime * 2;
    const waveH = waterSystem.getWaveHeight(
      this.position.x,
      this.position.z,
      this.time
    );
    this.position.y = WATER_LEVEL + HULL_RIDE_HEIGHT + waveH;

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

  /** Places the boat at a spawn point, turned so the whole hull fits on the water. */
  public placeAt(x: number, z: number, preferredRotation: number, waterSystem: WaterSystem): void {
    const pose = findFloatingPose(x, z, preferredRotation, (px, pz) => waterSystem.isWater(px, pz));
    this.position.x = pose.x;
    this.position.z = pose.z;
    this.rotation = pose.rotation;
    this.speed = 0;
    this.rootNode.position.copyFrom(this.position);
    this.rootNode.rotation.y = this.rotation;
  }

  public canPickup(): boolean {
    return this.passengers < this.capacity;
  }

  public addPassengers(count: number): number {
    const space = this.capacity - this.passengers;
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
