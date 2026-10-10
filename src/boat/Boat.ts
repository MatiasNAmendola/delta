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
import { PROP_SCALE, WATER_LEVEL, COLORS } from "../utils/constants";
import { hexToColor3, clamp } from "../utils/helpers";
import { WaterSystem } from "../world/WaterSystem";
import { findFloatingPose, hullOutline, moveHull, type Hull } from "./hullCollision";
import type { BoatSpec, BoatTypeId } from "./boatTypes";
import { Buoyancy, type BuoyancyParams } from "./buoyancy";
import { NO_INPUT, type Handling, type HandlingInput } from "./handling";
import { buildClasica, buildSingle, buildKayak, buildMoto, buildPesca, buildRunabout, buildSemirrigido, buildTravesia, type BoatModel } from "./boatModels";
import { coastToward, driftToward, isBraking } from "./coasting";
import { leeway, seaway } from "./seaway";

/** Turn rates in the specs were tuned for twitchy arcade turns; real boats turn slower. */
const TURN_SCALE = 0.6;

/** How deep a GLB model's keel sits under the water, relative to the boat's length. */
const MODEL_DRAFT = 0.035;

/** GLB per boat type in public/models; the small boats fall back to procedural models. */
const MODEL_FILES: Record<string, string> = {
  colectiva: "lancha-optimized.glb",
  travesia: "bote-travesia.glb",
  kayak: "kayak.glb",
};

/**
 * Any boat of the game: physics, hull collision and model come from its
 * BoatSpec. Human-powered boats have energy: pulling hard drains it and
 * lowers top speed, easing off lets the crew recover.
 */
export class Boat {
  public rootNode: TransformNode;
  public position: Vector3;
  public rotation = 0; // Y-axis rotation, heading atan2(dx, dz)
  public speed = 0;
  /** Motion the river has given the hull (world units/s), on top of its way through the water. */
  private drift: [number, number] = [0, 0];
  /** Clock of the swell's rocking (seaway.ts) and this boat's own phase in it. */
  private seaTime = 0;
  private readonly seaPhase = Math.random() * Math.PI * 2;
  public throttle = 0; // -1 to 1
  public steering = 0; // -1 to 1
  public passengers = 0;
  /** 0..1, human-powered boats only. */
  public energy = 1;
  public modelLoaded = false;

  private meshes: Mesh[] = [];
  private strokePhase = 0;
  /** Realistic handling (optional); null = the simple arcade controls. */
  private handling: Handling | null = null;
  /** This frame's orders for the realistic handling. */
  handlingInput: HandlingInput = NO_INPUT;
  /** -1..1, follows the steering input with some lag. */
  private rudder = 0;
  private buoyancy: Buoyancy;
  private floatParams: BuoyancyParams;
  private hull: Hull;
  private procedural: BoatModel | null = null;
  private modelContainer: TransformNode | null = null;

  constructor(
    private scene: Scene,
    readonly spec: BoatSpec,
    startX: number,
    startZ: number,
    private readonly capacity: number
  ) {
    this.hull = hullOutline(spec.length, spec.width);
    this.floatParams = { length: spec.length, width: spec.width, hull: spec.hull };
    this.buoyancy = new Buoyancy(this.floatParams);
    this.position = new Vector3(startX, WATER_LEVEL, startZ);
    this.rootNode = new TransformNode(`bote_${spec.id}`, scene);
    this.rootNode.position = this.position.clone();

    if (spec.id === "colectiva") this.buildFallbackLancha();
    else this.buildProcedural();
    void this.loadModel();
  }

  private buildProcedural(): void {
    const builders: Record<Exclude<BoatTypeId, "colectiva">, (scene: Scene, spec: BoatSpec) => BoatModel> = {
      kayak: buildKayak,
      travesia: buildTravesia,
      single: buildSingle,
      runabout: buildRunabout,
      pesca: buildPesca,
      clasica: buildClasica,
      semirrigido: buildSemirrigido,
      moto: buildMoto,
    };
    const build = builders[this.spec.id as Exclude<BoatTypeId, "colectiva">];
    this.procedural = build(this.scene, this.spec);
    this.procedural.root.parent = this.rootNode;
  }

  /** Loads the boat's GLB when there is one; it replaces the stand-in or procedural model. */
  private async loadModel(): Promise<void> {
    const file = MODEL_FILES[this.spec.id];
    const base = document.querySelector("base")?.href || window.location.href;
    const url = new URL("models/", base).href;
    try {
      if (!file) return;
      if (this.spec.id !== "colectiva") {
        // Optional model: skip quietly when it isn't there
        const head = await fetch(url + file, { method: "HEAD" });
        if (!head.ok || !(head.headers.get("content-type") ?? "").match(/gltf|octet|model/)) return;
      }
      const result = await SceneLoader.ImportMeshAsync("", url, file, this.scene);
      if (this.rootNode.isDisposed()) {
        result.meshes.forEach((m) => m.dispose());
        return;
      }
      // Measured at the origin first: bounding vectors are in world space
      const container = new TransformNode(`modelo_${this.spec.id}`, this.scene);
      for (const mesh of result.meshes) {
        if (!mesh.parent) mesh.parent = container;
        mesh.isPickable = false;
      }
      const { min, max } = container.getHierarchyBoundingVectors(true);
      const length = Math.max(max.x - min.x, max.z - min.z) || 1;
      const scale = this.spec.length / length;
      container.scaling.setAll(scale);
      // Keel slightly under the water, the rest above
      container.position.y = -min.y * scale - this.spec.length * MODEL_DRAFT;
      container.parent = this.rootNode;
      this.modelContainer = container;

      for (const mesh of this.meshes) mesh.dispose();
      this.meshes = [];
      this.procedural?.root.dispose();
      this.procedural = null;
      this.modelLoaded = true;
    } catch (error) {
      console.warn(`No model for ${this.spec.id}, keeping the built-in one:`, error);
    }
  }

  /** Blocky lancha shown until the GLB loads (design size, scaled down). */
  private buildFallbackLancha(): void {
    const fallback = new TransformNode("lanchaProvisoria", this.scene);
    fallback.parent = this.rootNode;
    fallback.scaling.setAll(PROP_SCALE);
    fallback.position.y = 0.6 * PROP_SCALE;
    const mat = (name: string, color: string) => {
      const m = new StandardMaterial(name, this.scene);
      m.diffuseColor = hexToColor3(color);
      m.specularColor = new Color3(0.1, 0.1, 0.1);
      return m;
    };
    const part = (name: string, size: [number, number, number], pos: [number, number, number], color: string) => {
      const m = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene);
      m.material = mat(name, color);
      m.parent = fallback;
      m.position.set(...pos);
      this.meshes.push(m);
    };
    part("casco", [2.6, 0.8, 7], [0, 0, 0], COLORS.boatHull);
    part("cubierta", [2.4, 0.1, 6.6], [0, 0.45, 0], COLORS.boatDeck);
    part("cabina", [2, 1.2, 3.5], [0, 1.1, -0.3], COLORS.boatCabin);
    part("techo", [2.5, 0.15, 4.1], [0, 1.8, -0.3], COLORS.boatRoof);
  }

  public update(deltaTime: number, waterSystem: WaterSystem, gyroSteering: number | null): void {
    const spec = this.spec;
    const steering = gyroSteering !== null ? gyroSteering : this.steering;

    // Tuning constants are per 60 fps frame; scale by real elapsed time.
    // Clamped so a stalled frame (tab switch) can't teleport the boat.
    const frames = Math.min(deltaTime, 0.1) * 60;

    let turn: number;
    let turnFactor = 1;
    if (this.handling) {
      // Realistic handling: wheel, lever, gears, strokes (handling.ts)
      const out = this.handling.update(Math.min(deltaTime, 0.1), this.handlingInput, this.energy);
      if (spec.humanPowered) {
        this.energy = clamp(this.energy + (out.effort > 0.5 ? -0.04 : 0.1) * deltaTime, 0, 1);
      }
      this.speed = out.speed / 60;
      this.rudder = out.rudder;
      this.throttle = out.effort;
      turn = out.yawRate * Math.min(deltaTime, 0.1);
    } else {
      // Crews tire: effort drains energy, easing off recovers it
      let topSpeed = spec.maxSpeed;
      if (spec.humanPowered) {
        const effort = Math.abs(this.throttle);
        this.energy = clamp(this.energy + (effort > 0 ? -0.05 * effort : 0.12) * deltaTime, 0, 1);
        topSpeed *= 0.45 + 0.55 * this.energy;
      }

      // The throttle lever sets the speed to reach (a fraction of top speed, or of reverse)
      const target = this.throttle >= 0 ? this.throttle * topSpeed : this.throttle * spec.maxSpeed * spec.reverse;
      // Easing off or in neutral the hull keeps its way (coasting.ts); only the
      // lever against the way brakes hard
      const dtc = Math.min(deltaTime, 0.1);
      if (isBraking(this.speed, target)) {
        this.speed += Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), spec.deceleration * 2 * frames);
      } else if (Math.abs(target) > Math.abs(this.speed)) {
        this.speed += Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), spec.acceleration * frames);
      } else {
        this.speed = coastToward(this.speed, target, dtc, spec.coastTime, spec.maxSpeed * 0.004, spec.maxSpeed);
      }

      // The rudder (or paddle stroke) takes time to come over: taps are small corrections
      const rudderRate = (Math.abs(steering) > Math.abs(this.rudder) && Math.sign(steering) !== -Math.sign(this.rudder) ? 2.2 : 4) * Math.min(deltaTime, 0.1);
      this.rudder += Math.max(-rudderRate, Math.min(rudderRate, steering - this.rudder));

      // Rudder boats need way on to turn; paddled ones pivot almost in place
      turnFactor = spec.turnsInPlace
        ? 0.6 + 0.4 * Math.min(1, Math.abs(this.speed) / (spec.maxSpeed * 0.3))
        : Math.min(1, Math.abs(this.speed) / (spec.maxSpeed * 0.3));
      turn = this.rudder * spec.turnSpeed * TURN_SCALE * turnFactor * frames;
    }

    const heading = this.rotation + turn;
    // The river carries every boat (the flood or the ebb, even stopped): a
    // heavy hull takes longer to pick the water's motion up (coasting.ts)
    const dtd = Math.min(deltaTime, 0.1);
    // ...and the wind pushes it sideways too (leeway), lighter and higher hulls more
    const [cx, cz] = waterSystem.conditions.current(this.position.x, this.position.z);
    const wind = waterSystem.conditions.wind;
    const lee = leeway(spec.length, spec.id === "colectiva") * wind.strength;
    this.drift = driftToward(this.drift, [cx + wind.x * lee, cz + wind.z * lee], dtd, spec.coastTime);
    const dx = Math.sin(heading) * this.speed * frames + this.drift[0] * dtd;
    const dz = Math.cos(heading) * this.speed * frames + this.drift[1] * dtd;
    const result = moveHull(
      { x: this.position.x, z: this.position.z, rotation: this.rotation },
      turn,
      dx,
      dz,
      (x, z) => waterSystem.isWater(x, z),
      this.hull
    );
    this.position.x = result.pose.x;
    this.position.z = result.pose.z;
    this.rotation = result.pose.rotation;
    if (result.hit) {
      // Scraping along the bank slows the boat; a head-on hit bounces it back
      this.speed *= result.slid ? 0.85 : -0.3;
      this.handling?.scaleSpeed(result.slid ? 0.85 : -0.3);
    }

    const ratio = Math.abs(this.speed) / spec.maxSpeed;
    this.strokePhase += deltaTime * (spec.humanPowered ? 2 + 3 * Math.abs(this.throttle) : 0);
    this.procedural?.animate(this.strokePhase, spec.humanPowered ? Math.abs(this.throttle) : ratio);

    // Afloat: the water under bow, stern and both sides sets heave, pitch
    // and roll; springs give the hull its weight (see buoyancy.ts)
    const float = this.buoyancy.update(deltaTime, this.floatTarget(waterSystem, Math.sign(this.speed) * ratio, this.rudder * turnFactor));
    this.position.y = WATER_LEVEL + float.y;
    // Never still: the swell rocks it, the bow wanders, the hull sways (seaway.ts, visual only)
    this.seaTime += Math.min(deltaTime, 0.1);
    const sea = seaway(this.seaTime, waterSystem.conditions.wind.strength, spec.length, ratio, this.seaPhase);
    this.rootNode.position.copyFrom(this.position);
    this.rootNode.position.x += Math.cos(this.rotation) * sea.sway;
    this.rootNode.position.z -= Math.sin(this.rotation) * sea.sway;
    this.rootNode.rotation.y = this.rotation + sea.yaw;
    // Babylon: +x rotation dips the bow, +z rotation lifts starboard
    this.rootNode.rotation.x = -(float.pitch + sea.pitch);
    this.rootNode.rotation.z = -(float.roll + sea.roll);
  }

  private floatTarget(waterSystem: WaterSystem, speedRatio: number, turn: number) {
    return Buoyancy.targets(
      this.floatParams,
      (x, z) => waterSystem.heightAt(x, z),
      this.position.x,
      this.position.z,
      this.rotation,
      speedRatio,
      turn
    );
  }

  /** Switches between the realistic handling and the simple controls. */
  setHandling(handling: Handling | null): void {
    this.handling = handling;
    this.speed = 0;
  }

  get realistic(): Handling | null {
    return this.handling;
  }

  /** Places the boat at a spawn point, turned so the whole hull fits on the water. */
  public placeAt(x: number, z: number, preferredRotation: number, waterSystem: WaterSystem): void {
    const pose = findFloatingPose(x, z, preferredRotation, (px, pz) => waterSystem.isWater(px, pz), this.hull);
    this.position.x = pose.x;
    this.position.z = pose.z;
    this.rotation = pose.rotation;
    this.speed = 0;
    this.drift = [0, 0];
    this.handling?.reset();
    this.buoyancy.reset(this.floatTarget(waterSystem, 0, 0));
    this.rootNode.position.copyFrom(this.position);
    this.rootNode.rotation.y = this.rotation;
  }

  public addPassengers(count: number): number {
    const actual = Math.min(count, this.capacity - this.passengers);
    this.passengers += actual;
    return actual;
  }

  public dropPassengers(): number {
    const dropped = this.passengers;
    this.passengers = 0;
    return dropped;
  }

  public dispose(): void {
    this.rootNode.dispose(false, true);
    this.modelContainer = null;
  }
}
