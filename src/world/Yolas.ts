import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { PROP_SCALE, WATER_LEVEL } from "../utils/constants";
import { seededRandom } from "../utils/helpers";
import type { WorldDoc } from "./WorldDoc";
import type { WaterSystem } from "./WaterSystem";
import { breaksWakeCourtesy, offsetPolyline, PingPongRoute } from "./rowingRoute";

/** A yola moored along the bank next to a dock. */
export interface MooredSpot {
  x: number;
  z: number;
  heading: number;
}

export type RowerEvent = "wake" | "bump" | null;

interface Rowing {
  route: PingPongRoute;
  traveled: number;
  speed: number;
  phase: number;
  crew: number;
  hull: number; // thin instance index
  firstRower: number;
  firstOar: number;
  /** Seconds before this crew can complain again. */
  cooldown: number;
  x: number;
  z: number;
}

const ROWING_CREWS = 6;
const ROW_SPEED = 0.45; // world units per second (~3.5 m/s)
const MIN_ROUTE_LENGTH = 120;
const HULL_LENGTH = 2.8;
const BUMP_DISTANCE = 2.2 * PROP_SCALE;
const COMPLAINT_COOLDOWN = 4;
/** Oar roll that puts the blade at the waterline. */
const BLADE_DIP = -0.17;

const SHIRTS = [
  new Color3(0.95, 0.95, 0.95), new Color3(0.2, 0.35, 0.7), new Color3(0.75, 0.2, 0.2),
  new Color3(0.95, 0.75, 0.2), new Color3(0.2, 0.55, 0.35), new Color3(0.55, 0.3, 0.6),
];
const SKIN = [new Color3(0.93, 0.76, 0.62), new Color3(0.78, 0.58, 0.42), new Color3(0.55, 0.38, 0.26)];

/**
 * Rowing club yolas, a Tigre classic: varnished wooden shells rowed by 2-3
 * people along the rivers, and others moored along the bank by the docks.
 * Everything is drawn with four thin-instance meshes (hulls, torsos, heads,
 * oars), so the whole fleet costs four draw calls.
 */
export class YolaTraffic {
  private hulls: Mesh;
  private torsos: Mesh;
  private heads: Mesh;
  private oars: Mesh;
  private crews: Rowing[] = [];
  private tmp = Matrix.Identity();

  constructor(scene: Scene, world: WorldDoc, waterSystem: WaterSystem, start: { x: number; z: number }, moored: MooredSpot[]) {
    const mat = new StandardMaterial("yolaMat", scene);
    mat.diffuseColor = Color3.White();
    mat.specularColor = new Color3(0.25, 0.22, 0.18); // varnish shine
    mat.specularPower = 48;

    this.hulls = buildHullMesh(scene, mat);
    this.oars = buildOarMesh(scene, mat);
    this.torsos = MeshBuilder.CreateBox("yolaTorsos", { width: 0.3, height: 0.36, depth: 0.22 }, scene);
    this.heads = MeshBuilder.CreateBox("yolaHeads", { size: 0.19 }, scene);
    this.torsos.material = mat;
    this.heads.material = mat;
    for (const m of [this.hulls, this.oars, this.torsos, this.heads]) m.isPickable = false;

    const rng = seededRandom(2024);
    const routes = pickRoutes(world, waterSystem, start);
    const hullMatrices: number[] = [];
    const torsoMatrices: number[] = [];
    const torsoColors: number[] = [];
    const headMatrices: number[] = [];
    const headColors: number[] = [];
    const oarMatrices: number[] = [];
    const identity = Matrix.Identity().toArray() as number[];

    for (const route of routes) {
      const crew = 2 + Math.floor(rng() * 2);
      const c: Rowing = {
        route,
        traveled: rng() * route.length * 2,
        speed: ROW_SPEED * (0.8 + rng() * 0.4),
        phase: rng() * Math.PI * 2,
        crew,
        hull: hullMatrices.length / 16,
        firstRower: torsoMatrices.length / 16,
        firstOar: oarMatrices.length / 16,
        cooldown: 0,
        x: 0,
        z: 0,
      };
      hullMatrices.push(...identity);
      for (let k = 0; k < crew; k++) {
        torsoMatrices.push(...identity);
        headMatrices.push(...identity);
        oarMatrices.push(...identity);
        const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
        const skin = SKIN[Math.floor(rng() * SKIN.length)];
        torsoColors.push(shirt.r, shirt.g, shirt.b, 1);
        headColors.push(skin.r, skin.g, skin.b, 1);
      }
      this.crews.push(c);
    }

    // Moored yolas: hull only, afloat beside the bank
    for (const spot of moored) {
      const m = Matrix.Compose(
        new Vector3(PROP_SCALE, PROP_SCALE, PROP_SCALE),
        Quaternion.FromEulerAngles(0, spot.heading, 0.02),
        new Vector3(spot.x, WATER_LEVEL + 0.05 * PROP_SCALE, spot.z)
      );
      hullMatrices.push(...(m.toArray() as number[]));
    }

    setInstances(this.hulls, hullMatrices);
    setInstances(this.torsos, torsoMatrices, torsoColors);
    setInstances(this.heads, headMatrices, headColors);
    setInstances(this.oars, oarMatrices);
    this.update(0);
  }

  /** `level`: the river's current level offset (tide). */
  update(dt: number, level = 0): void {
    const t = this.tmp;
    for (const c of this.crews) {
      c.traveled += c.speed * dt;
      c.phase += dt * 3.2;
      c.cooldown = Math.max(0, c.cooldown - dt);
      const { x, z, heading } = c.route.at(c.traveled);
      c.x = x;
      c.z = z;
      // Each stroke surges the boat a little and rocks it
      const bob = Math.sin(c.phase * 2) * 0.02;
      const parent = Matrix.Compose(
        // Designed at the old prop size: the parent scale brings rowers and oars down too
        new Vector3(PROP_SCALE, PROP_SCALE, PROP_SCALE),
        Quaternion.FromEulerAngles(Math.sin(c.phase) * 0.02, heading, 0),
        new Vector3(x, WATER_LEVEL + level + (0.05 + bob) * PROP_SCALE, z)
      );
      this.hulls.thinInstanceSetMatrixAt(c.hull, parent, false);

      for (let k = 0; k < c.crew; k++) {
        const seatZ = (k - (c.crew - 1) / 2) * 0.75;
        // Rowers lean back on the drive and forward on the recovery
        const lean = Math.sin(c.phase) * 0.3;
        Matrix.ComposeToRef(Vector3.One(), Quaternion.FromEulerAngles(-lean, 0, 0), new Vector3(0, 0.33, seatZ), t);
        this.torsos.thinInstanceSetMatrixAt(c.firstRower + k, t.multiply(parent), false);
        Matrix.ComposeToRef(Vector3.One(), Quaternion.Identity(), new Vector3(0, 0.6, seatZ - lean * 0.25), t);
        this.heads.thinInstanceSetMatrixAt(c.firstRower + k, t.multiply(parent), false);

        // Sweep oars on alternating sides; all blades move aft together on the drive
        const side = k % 2 === 0 ? 1 : -1;
        const sweep = Math.sin(c.phase) * 0.45;
        // Roll is applied before the yaw, so the same sign dips both sides; deeper on the drive
        const dip = BLADE_DIP + Math.sin(c.phase) * 0.08;
        Matrix.ComposeToRef(
          Vector3.One(),
          Quaternion.FromEulerAngles(0, (side > 0 ? 0 : Math.PI) + side * sweep, dip),
          new Vector3(side * 0.22, 0.32, seatZ),
          t
        );
        this.oars.thinInstanceSetMatrixAt(c.firstOar + k, t.multiply(parent), false);
      }
    }
    if (this.crews.length > 0) {
      for (const m of [this.hulls, this.torsos, this.heads, this.oars]) m.thinInstanceBufferUpdated("matrix");
    }
  }

  /**
   * Checks the lancha against every crew: a fast pass close by swamps them
   * with the wake ("wake"), touching them is a collision ("bump").
   */
  checkLancha(x: number, z: number, speedRatio: number): RowerEvent {
    for (const c of this.crews) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < BUMP_DISTANCE && c.cooldown === 0) {
        c.cooldown = COMPLAINT_COOLDOWN;
        return "bump";
      }
      if (c.cooldown === 0 && breaksWakeCourtesy(d, speedRatio)) {
        c.cooldown = COMPLAINT_COOLDOWN;
        return "wake";
      }
    }
    return null;
  }
}

/** Rivers near the start (so the player meets the rowers), long enough to row. */
function pickRoutes(world: WorldDoc, waterSystem: WaterSystem, start: { x: number; z: number }): PingPongRoute[] {
  const candidates = world.rivers
    .map((river) => {
      let near = Infinity;
      for (const [x, z] of river.points) near = Math.min(near, Math.hypot(x - start.x, z - start.z));
      return { river, near };
    })
    .sort((a, b) => a.near - b.near);

  const routes: PingPongRoute[] = [];
  for (const { river } of candidates) {
    if (routes.length >= ROWING_CREWS) break;
    // Keep to the right of the channel, like boats do, when there is room
    const shifted = offsetPolyline(river.points, river.width * 0.2);
    const points = shifted.every(([x, z]) => waterSystem.isWater(x, z)) ? shifted : river.points;
    if (!points.every(([x, z]) => waterSystem.isWater(x, z))) continue;
    const route = new PingPongRoute(points);
    if (route.length >= MIN_ROUTE_LENGTH) routes.push(route);
  }
  return routes;
}

function setInstances(mesh: Mesh, matrices: number[], colors?: number[]): void {
  if (matrices.length === 0) {
    mesh.setEnabled(false);
    return;
  }
  mesh.thinInstanceSetBuffer("matrix", new Float32Array(matrices), 16, false);
  if (colors) mesh.thinInstanceSetBuffer("color", new Float32Array(colors), 4, true);
  // Instances move around the map: never cull the batch by a stale bounding box
  mesh.alwaysSelectAsActiveMesh = true;
}

/** Varnished shell with tapered ends, light inside and white bow/stern decks. */
function buildHullMesh(scene: Scene, mat: StandardMaterial): Mesh {
  const varnish = new Color4(0.55, 0.3, 0.15, 1);
  const inside = new Color4(0.8, 0.55, 0.3, 1);
  const deck = new Color4(0.92, 0.92, 0.9, 1);
  const parts: Mesh[] = [];
  const box = (w: number, h: number, d: number, color: Color4, pos: [number, number, number], rotY = 0) => {
    const m = MeshBuilder.CreateBox("yolaPart", { width: w, height: h, depth: d, faceColors: Array(6).fill(color) }, scene);
    m.position.set(...pos);
    m.rotation.y = rotY;
    parts.push(m);
  };
  const half = HULL_LENGTH / 2;
  box(0.55, 0.26, HULL_LENGTH - 0.4, varnish, [0, 0.05, 0]);
  box(0.39, 0.24, 0.39, varnish, [0, 0.05, half - 0.2], Math.PI / 4);
  box(0.39, 0.24, 0.39, varnish, [0, 0.05, -half + 0.2], Math.PI / 4);
  box(0.45, 0.02, HULL_LENGTH - 1.3, inside, [0, 0.18, 0]);
  box(0.42, 0.04, 0.55, deck, [0, 0.19, half - 0.45]);
  box(0.42, 0.04, 0.45, deck, [0, 0.19, -half + 0.4]);
  const hull = Mesh.MergeMeshes(parts, true, true)!;
  hull.name = "yolaHulls";
  hull.material = mat;
  return hull;
}

/** One sweep oar, pivot at the rowlock, blade (Argentine blue and white) at +x. */
function buildOarMesh(scene: Scene, mat: StandardMaterial): Mesh {
  const wood = new Color4(0.85, 0.7, 0.4, 1);
  const blue = new Color4(0.3, 0.55, 0.85, 1);
  const white = new Color4(0.95, 0.95, 0.95, 1);
  const parts: Mesh[] = [];
  const box = (w: number, h: number, d: number, color: Color4, x: number) => {
    const m = MeshBuilder.CreateBox("oarPart", { width: w, height: h, depth: d, faceColors: Array(6).fill(color) }, scene);
    m.position.x = x;
    parts.push(m);
  };
  box(1.7, 0.04, 0.04, wood, 0.6);
  box(0.12, 0.025, 0.16, blue, 1.42);
  box(0.12, 0.025, 0.16, white, 1.54);
  box(0.12, 0.025, 0.16, blue, 1.66);
  const oar = Mesh.MergeMeshes(parts, true, true)!;
  oar.name = "yolaOars";
  oar.material = mat;
  return oar;
}
