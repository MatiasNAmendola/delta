import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { WATER_LEVEL } from "../utils/constants";
import { seededRandom } from "../utils/helpers";

/**
 * Floating trash to fish out of the river: tap or click an item within
 * reach of your boat and it is collected for credits. Items drift slowly
 * and bob, mostly near the banks where the current leaves them; new ones
 * appear out of sight as you clean, so there is always something nearby.
 * One thin-instance mesh per kind: 5 draw calls for all the trash.
 */
interface Kind {
  name: string;
  credits: number;
  /** Relative frequency. */
  weight: number;
  build(scene: Scene): Mesh;
}

const KINDS: Kind[] = [
  {
    name: "bolsa",
    credits: 10,
    weight: 5,
    build: (scene) => {
      const m = MeshBuilder.CreateSphere("basura_bolsa", { diameter: 0.14, segments: 6 }, scene);
      m.scaling.set(1, 0.35, 0.8);
      m.bakeCurrentTransformIntoVertices();
      m.material = mat(scene, "basura_bolsa", new Color3(0.92, 0.92, 0.88), 0.85);
      return m;
    },
  },
  {
    name: "botella",
    credits: 15,
    weight: 4,
    build: (scene) => {
      const m = MeshBuilder.CreateCylinder("basura_botella", { height: 0.1, diameter: 0.032, tessellation: 8 }, scene);
      m.rotation.z = Math.PI / 2;
      m.bakeCurrentTransformIntoVertices();
      m.material = mat(scene, "basura_botella", new Color3(0.45, 0.7, 0.78), 0.75);
      return m;
    },
  },
  {
    name: "lata",
    credits: 15,
    weight: 3,
    build: (scene) => {
      const m = MeshBuilder.CreateCylinder("basura_lata", { height: 0.05, diameter: 0.026, tessellation: 8 }, scene);
      m.rotation.z = Math.PI / 2;
      m.bakeCurrentTransformIntoVertices();
      m.material = mat(scene, "basura_lata", new Color3(0.78, 0.12, 0.1), 1);
      return m;
    },
  },
  {
    name: "telgopor",
    credits: 20,
    weight: 2,
    build: (scene) => {
      const m = MeshBuilder.CreateBox("basura_telgopor", { width: 0.09, height: 0.03, depth: 0.06 }, scene);
      m.material = mat(scene, "basura_telgopor", new Color3(0.96, 0.96, 0.94), 1);
      return m;
    },
  },
  {
    name: "neumático",
    credits: 50,
    weight: 1,
    build: (scene) => {
      const m = MeshBuilder.CreateTorus("basura_neumatico", { diameter: 0.11, thickness: 0.035, tessellation: 14 }, scene);
      m.material = mat(scene, "basura_neumatico", new Color3(0.06, 0.06, 0.06), 1);
      return m;
    },
  },
];

function mat(scene: Scene, name: string, color: Color3, alpha: number): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.25, 0.25, 0.25);
  // Shine a little so it stands out on the brown water
  m.emissiveColor = color.scale(0.18);
  m.alpha = alpha;
  return m;
}

interface Item {
  kind: number;
  x: number;
  z: number;
  yaw: number;
  phase: number;
  drift: [number, number];
  /** 0 = afloat; > 0 = being collected (seconds into the pop). */
  collecting: number;
}

/** Items kept around the boat. */
const TARGET_COUNT = 45;
const SPAWN_MIN = 8;
const SPAWN_MAX = 70;
/** How far from the boat you can reach to fish an item out (world units, 8 m each). */
export const TRASH_REACH = 9;
const POP_TIME = 0.35;

export interface Collected {
  name: string;
  credits: number;
  /** Where it was, to show the credits there. */
  x: number;
  z: number;
}

export class Trash {
  private meshes: Mesh[];
  private items: Item[] = [];
  private rng = seededRandom(9137);
  private time = 0;
  private tmp = new Matrix();
  private totalWeight = KINDS.reduce((a, k) => a + k.weight, 0);
  private level = 0;
  collected = 0;

  constructor(
    private scene: Scene,
    private isWater: (x: number, z: number) => boolean
  ) {
    this.meshes = KINDS.map((k) => {
      const m = k.build(scene);
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      m.thinInstanceSetBuffer("matrix", new Float32Array(16), 16, false);
      m.setEnabled(false);
      return m;
    });
  }

  /**
   * Keeps the river around the boat stocked, drifts and bobs the items.
   * `level` is the river's level offset (tide); `current` carries the trash.
   */
  update(dt: number, boatX: number, boatZ: number, level = 0, current?: (x: number, z: number) => [number, number]): void {
    this.time += dt;
    this.level = level;
    // Forget items far behind, top up out of sight
    this.items = this.items.filter((it) => it.collecting > 0 || Math.hypot(it.x - boatX, it.z - boatZ) < SPAWN_MAX * 1.4);
    for (let tries = 0; this.items.length < TARGET_COUNT && tries < 40; tries++) this.spawn(boatX, boatZ);

    const perKind: number[][] = KINDS.map(() => []);
    const kept: Item[] = [];
    for (const it of this.items) {
      let scale = 1;
      if (it.collecting > 0) {
        it.collecting += dt;
        if (it.collecting > POP_TIME) continue;
        const t = it.collecting / POP_TIME;
        scale = 1 + Math.sin(t * Math.PI) * 0.6 - t;
      } else {
        const [cx, cz] = current ? current(it.x, it.z) : [0, 0];
        const nx = it.x + (it.drift[0] + cx * 0.8) * dt;
        const nz = it.z + (it.drift[1] + cz * 0.8) * dt;
        if (this.isWater(nx, nz)) {
          it.x = nx;
          it.z = nz;
        } else {
          it.drift = [-it.drift[1], it.drift[0]];
        }
      }
      kept.push(it);
      const bob = Math.sin(this.time * 1.7 + it.phase) * 0.008;
      const lift = it.collecting > 0 ? (it.collecting / POP_TIME) * 0.25 : 0;
      Matrix.ComposeToRef(
        new Vector3(scale, scale, scale),
        Quaternion.FromEulerAngles(Math.sin(this.time + it.phase) * 0.15, it.yaw + this.time * 0.05, Math.cos(this.time * 0.8 + it.phase) * 0.12),
        new Vector3(it.x, WATER_LEVEL + level + 0.03 + bob + lift, it.z),
        this.tmp
      );
      this.tmp.toArray(perKind[it.kind], perKind[it.kind].length);
    }
    this.items = kept;
    perKind.forEach((arr, k) => {
      const mesh = this.meshes[k];
      mesh.setEnabled(arr.length > 0);
      if (arr.length) mesh.thinInstanceSetBuffer("matrix", new Float32Array(arr), 16, false);
    });
  }

  /**
   * A tap at canvas pixel (px, py): the item under it, if afloat and within
   * reach of the boat, is collected.
   */
  tryCollect(px: number, py: number, camera: Camera, boatX: number, boatZ: number): Collected | null {
    const ray = this.scene.createPickingRay(px, py, Matrix.Identity(), camera);
    if (ray.direction.y >= -1e-4) return null;
    const t = (WATER_LEVEL + this.level + 0.03 - ray.origin.y) / ray.direction.y;
    const hx = ray.origin.x + ray.direction.x * t;
    const hz = ray.origin.z + ray.direction.z * t;
    // Forgiving on phones: the tolerance grows with distance from the camera
    const tolerance = Math.max(0.35, t * 0.035);
    let best: Item | null = null;
    let bestD = tolerance;
    for (const it of this.items) {
      if (it.collecting > 0) continue;
      const d = Math.hypot(it.x - hx, it.z - hz);
      if (d < bestD && Math.hypot(it.x - boatX, it.z - boatZ) < TRASH_REACH) {
        best = it;
        bestD = d;
      }
    }
    if (!best) return null;
    best.collecting = 1e-6;
    this.collected++;
    const kind = KINDS[best.kind];
    return { name: kind.name, credits: kind.credits, x: best.x, z: best.z };
  }

  /** True if a tap there would hit trash, but out of reach (to tell the player to get closer). */
  outOfReachAt(px: number, py: number, camera: Camera, boatX: number, boatZ: number): boolean {
    const ray = this.scene.createPickingRay(px, py, Matrix.Identity(), camera);
    if (ray.direction.y >= -1e-4) return false;
    const t = (WATER_LEVEL + this.level + 0.03 - ray.origin.y) / ray.direction.y;
    const hx = ray.origin.x + ray.direction.x * t;
    const hz = ray.origin.z + ray.direction.z * t;
    const tolerance = Math.max(0.35, t * 0.035);
    return this.items.some((it) => it.collecting === 0 && Math.hypot(it.x - hx, it.z - hz) < tolerance && Math.hypot(it.x - boatX, it.z - boatZ) >= TRASH_REACH);
  }

  /** New item on the water around the boat, preferably near a bank. */
  private spawn(bx: number, bz: number): void {
    const r = this.rng;
    const a = r() * Math.PI * 2;
    const d = SPAWN_MIN + r() * (SPAWN_MAX - SPAWN_MIN);
    const x = bx + Math.cos(a) * d;
    const z = bz + Math.sin(a) * d;
    if (!this.isWater(x, z)) return;
    // Trash collects along the banks: accept open water only sometimes
    let nearBank = false;
    for (let k = 0; k < 8 && !nearBank; k++) {
      const b = (k / 8) * Math.PI * 2;
      if (!this.isWater(x + Math.cos(b) * 2.2, z + Math.sin(b) * 2.2)) nearBank = true;
    }
    if (!nearBank && r() > 0.3) return;
    let pick = r() * this.totalWeight;
    let kind = 0;
    while (pick > KINDS[kind].weight) pick -= KINDS[kind++].weight;
    const speed = 0.02 + r() * 0.05;
    const dir = r() * Math.PI * 2;
    this.items.push({ kind, x, z, yaw: r() * Math.PI * 2, phase: r() * 10, drift: [Math.cos(dir) * speed, Math.sin(dir) * speed], collecting: 0 });
  }
}
