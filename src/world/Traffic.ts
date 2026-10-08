import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { BOAT_LENGTH, WATER_LEVEL } from "../utils/constants";
import { seededRandom } from "../utils/helpers";
import type { WorldDoc, Vec2 } from "./WorldDoc";
import type { WaterSystem } from "./WaterSystem";
import { offsetPolyline, PingPongRoute } from "./rowingRoute";
import type { Wake } from "./waterConditions";

interface Lancha {
  node: TransformNode;
  route: PingPongRoute;
  traveled: number;
  speed: number;
  x: number;
  z: number;
  heading: number;
  cooldown: number;
}

const COUNT = 5;
/** World units per second (the player's colectiva tops at ~10). */
const SPEED = 5.5;
/** Within this distance a passing lancha's wake reaches you. */
const WAKE_REACH = 3.2;

/**
 * Other lanchas colectivas on the big rivers near the start, keeping to
 * the right of the channel both ways (that is the rule). Their wake is
 * what kayaks and rowing boats must take bow first, and they are solid.
 */
export class Traffic {
  private boats: Lancha[] = [];

  constructor(private scene: Scene, world: WorldDoc, waterSystem: WaterSystem, start: { x: number; z: number }) {
    const rng = seededRandom(77);
    const routes = world.rivers
      .filter((r) => r.width >= 14)
      .map((river) => {
        let near = Infinity;
        for (const [x, z] of river.points) near = Math.min(near, Math.hypot(x - start.x, z - start.z));
        return { river, near };
      })
      .sort((a, b) => a.near - b.near)
      .slice(0, COUNT)
      .map(({ river }) => loopKeepingRight(river.points, river.width, (x, z) => waterSystem.isWater(x, z)))
      .filter((r): r is PingPongRoute => r !== null);
    void this.spawn(routes, rng);
  }

  private async spawn(routes: PingPongRoute[], rng: () => number): Promise<void> {
    if (routes.length === 0) return;
    const base = document.querySelector("base")?.href || window.location.href;
    try {
      const asset = await SceneLoader.LoadAssetContainerAsync(new URL("models/", base).href, "lancha-optimized.glb", this.scene);
      routes.forEach((route, k) => {
        const copy = asset.instantiateModelsToScene((n) => `trafico${k}_${n}`, false);
        const node = new TransformNode(`trafico${k}`, this.scene);
        for (const root of copy.rootNodes) root.parent = node;
        const { min, max } = node.getHierarchyBoundingVectors(true);
        const s = BOAT_LENGTH / (Math.max(max.x - min.x, max.z - min.z) || 1);
        node.scaling.setAll(s);
        for (const root of copy.rootNodes) (root as TransformNode).position.y -= min.y + BOAT_LENGTH * 0.035 / s;
        node.getChildMeshes().forEach((m) => (m.isPickable = false));
        this.boats.push({ node, route, traveled: rng() * route.length, speed: SPEED * (0.8 + rng() * 0.4), x: 0, z: 0, heading: 0, cooldown: 0 });
      });
    } catch (error) {
      console.warn("Traffic disabled (no lancha model):", error);
    }
  }

  /** `level`: the river's current level offset (tide). */
  update(dt: number, level = 0): void {
    for (const b of this.boats) {
      b.traveled += b.speed * dt;
      b.cooldown = Math.max(0, b.cooldown - dt);
      const p = b.route.at(b.traveled % b.route.length);
      b.x = p.x;
      b.z = p.z;
      b.heading = p.heading;
      b.node.position.set(p.x, WATER_LEVEL + level, p.z);
      b.node.rotation.y = p.heading;
    }
  }

  /** The wakes of the lanchas within `radius` of (x, z), for the water surface. */
  wakes(x: number, z: number, radius: number): Wake[] {
    return this.boats
      .filter((b) => Math.hypot(b.x - x, b.z - z) < radius)
      .map((b) => ({ x: b.x, z: b.z, heading: b.heading, strength: Math.min(1, b.speed / SPEED), length: BOAT_LENGTH }));
  }

  /** Lanchas close enough for their wake to reach (x, z). */
  wakesNear(x: number, z: number): Array<{ x: number; z: number }> {
    return this.boats.filter((b) => Math.hypot(b.x - x, b.z - z) < WAKE_REACH).map((b) => ({ x: b.x, z: b.z }));
  }

  /** True once per close call when a boat of the given length runs into a lancha. */
  collides(x: number, z: number, length: number): boolean {
    for (const b of this.boats) {
      if (b.cooldown === 0 && Math.hypot(b.x - x, b.z - z) < (BOAT_LENGTH + length) * 0.4) {
        b.cooldown = 3;
        return true;
      }
    }
    return false;
  }
}

/**
 * A round trip along a river keeping to the right both ways: out along
 * the starboard side of the channel, back along the other side.
 */
function loopKeepingRight(points: Vec2[], width: number, isWater: (x: number, z: number) => boolean): PingPongRoute | null {
  const offset = width * 0.22;
  const out = offsetPolyline(points, offset);
  const back = offsetPolyline([...points].reverse(), offset);
  const loop = [...out, ...back];
  if (loop.length < 4 || !loop.every(([x, z]) => isWater(x, z))) return null;
  return new PingPongRoute(loop);
}
