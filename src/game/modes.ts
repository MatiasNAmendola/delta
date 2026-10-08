import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Boat } from "../boat/Boat";
import type { BoatTypeId } from "../boat/boatTypes";
import type { Berth } from "../world/Environment";
import type { Dock, WorldDoc } from "../world/WorldDoc";
import { WATER_LEVEL } from "../utils/constants";
import { distance2D } from "../utils/helpers";
import { ARROYO_WIDTH, probeChannel } from "./navigationRules";

/** What every mode needs from the game. */
export interface ModeContext {
  scene: Scene;
  world: WorldDoc;
  boat: Boat;
  berths: ReadonlyMap<string, Berth>;
  isWater(x: number, z: number): boolean;
  start: { x: number; z: number };
  notify(message: string, ms?: number): void;
  addScore(points: number): void;
}

export interface Target {
  /** Shown in the HUD pill, e.g. "Próxima parada". */
  label: string;
  name: string;
  x: number;
  z: number;
}

export interface Summary {
  verdict: string;
  stats: Array<{ value: number; label: string }>;
}

export interface GameMode {
  /** The second HUD pill (the first is points, the third time). */
  secondary(): { label: string; value: string };
  start(): void;
  update(dt: number, action: boolean): void;
  target(): Target | null;
  /** Extra text for the location line when something is at hand. */
  hint(): string | null;
  summary(score: number): Summary;
  dispose(): void;
}

const TOUCH = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
const STOP_KEY = TOUCH ? "tocá PARADA" : "ESPACIO para parar";

function stopPoint(ctx: ModeContext, dock: Dock): { x: number; z: number } {
  return ctx.berths.get(dock.id) ?? dock;
}

/** Docks sorted by distance from (x, z), skipping one. */
function nearestDocks(ctx: ModeContext, x: number, z: number, skip: number): number[] {
  return ctx.world.docks
    .map((dock, i) => ({ i, d: distance2D(x, z, stopPoint(ctx, dock).x, stopPoint(ctx, dock).z) }))
    .filter(({ i, d }) => i !== skip && d > ctx.world.rules.pickupRadius * 2)
    .sort((a, b) => a.d - b.d)
    .map(({ i }) => i);
}

/** Floating marker over the current goal: an amber beam and a buoy, gently bobbing. */
class GoalMarker {
  private beam: Mesh;
  private buoy: Mesh;
  private t = 0;

  constructor(scene: Scene) {
    const beamMat = new StandardMaterial("metaHaz", scene);
    beamMat.emissiveColor = new Color3(0.95, 0.7, 0.3);
    beamMat.diffuseColor = Color3.Black();
    beamMat.alpha = 0.28;
    beamMat.disableLighting = true;
    this.beam = MeshBuilder.CreateCylinder("metaHaz", { height: 4, diameterTop: 0.08, diameterBottom: 0.25, tessellation: 12 }, scene);
    this.beam.material = beamMat;
    this.beam.isPickable = false;
    const buoyMat = new StandardMaterial("metaBoya", scene);
    buoyMat.diffuseColor = new Color3(0.95, 0.45, 0.08);
    buoyMat.emissiveColor = new Color3(0.25, 0.1, 0);
    this.buoy = MeshBuilder.CreateSphere("metaBoya", { diameter: 0.22, segments: 10 }, scene);
    this.buoy.material = buoyMat;
    this.buoy.isPickable = false;
    this.hide();
  }

  show(x: number, z: number, dt: number): void {
    this.t += dt;
    this.beam.setEnabled(true);
    this.buoy.setEnabled(true);
    this.beam.position.set(x, WATER_LEVEL + 2, z);
    this.buoy.position.set(x, WATER_LEVEL + 0.04 + Math.sin(this.t * 2) * 0.02, z);
  }

  hide(): void {
    this.beam.setEnabled(false);
    this.buoy.setEnabled(false);
  }

  dispose(): void {
    this.beam.dispose(false, true);
    this.buoy.dispose(false, true);
  }
}

/** Lancha colectiva: pick up passengers and carry them between docks. */
class PassengerMode implements GameMode {
  private waiting = new Map<string, number>();
  private targetIndex = -1;
  private nearDock: Dock | null = null;
  private delivered = 0;
  private marker: GoalMarker;

  constructor(private ctx: ModeContext) {
    this.marker = new GoalMarker(ctx.scene);
    for (const dock of ctx.world.docks) this.waiting.set(dock.id, 1 + Math.floor(Math.random() * 6));
  }

  secondary() {
    return { label: "Pasajeros", value: `${this.ctx.boat.passengers}/${this.ctx.world.rules.boatCapacity}` };
  }

  start(): void {
    this.pickTarget();
  }

  /** One of the 3 nearest docks, so every trip fits the clock. */
  private pickTarget(): void {
    const { x, z } = this.ctx.boat.position;
    const options = nearestDocks(this.ctx, x, z, this.targetIndex).slice(0, 3);
    if (options.length) this.targetIndex = options[Math.floor(Math.random() * options.length)];
  }

  update(dt: number, action: boolean): void {
    const { boat, world } = this.ctx;
    this.nearDock = null;
    for (const dock of world.docks) {
      const p = stopPoint(this.ctx, dock);
      if (distance2D(boat.position.x, boat.position.z, p.x, p.z) < world.rules.pickupRadius) {
        this.nearDock = dock;
        if (action) {
          if (Math.abs(boat.speed) < boat.spec.maxSpeed * 0.4) this.serve(dock);
          else this.ctx.notify("Reducí la velocidad para parar", 1500);
        }
        break;
      }
    }
    const t = this.target();
    if (t) this.marker.show(t.x, t.z, dt);
  }

  private serve(dock: Dock): void {
    const { boat, world } = this.ctx;
    const waiting = this.waiting.get(dock.id) ?? 0;
    if (boat.passengers > 0) {
      const dropped = boat.dropPassengers();
      const isTarget = world.docks[this.targetIndex]?.id === dock.id;
      const points = dropped * world.rules.scorePerPassenger + (isTarget ? world.rules.timeBonusPerPassenger * dropped : 0);
      this.ctx.addScore(points);
      this.delivered += dropped;
      this.ctx.notify(`${dock.name}\n${dropped} pasajeros bajaron · +${points} puntos${isTarget ? " · bonus de parada" : ""}`, 2500);
      this.waiting.set(dock.id, 1 + Math.floor(Math.random() * 5));
      this.pickTarget();
    } else if (waiting > 0) {
      const picked = boat.addPassengers(waiting);
      this.waiting.set(dock.id, waiting - picked);
      this.ctx.notify(`${dock.name}\nSubieron ${picked} pasajeros`, 2000);
      if (world.docks[this.targetIndex]?.id === dock.id) this.pickTarget();
    } else {
      this.ctx.notify(`${dock.name}\nNo hay pasajeros esperando`, 1500);
    }
  }

  target(): Target | null {
    const dock = this.ctx.world.docks[this.targetIndex];
    if (!dock) return null;
    const p = stopPoint(this.ctx, dock);
    return { label: "Próxima parada", name: dock.name, x: p.x, z: p.z };
  }

  hint(): string | null {
    return this.nearDock ? `Muelle ${this.nearDock.name} · ${STOP_KEY}` : null;
  }

  summary(score: number): Summary {
    return {
      verdict: score > 3000 ? "Capitán del Delta" : score > 1500 ? "Buen recorrido" : "Seguí practicando",
      stats: [{ value: this.delivered, label: "pasajeros entregados" }],
    };
  }

  dispose(): void {
    this.marker.dispose();
  }
}

/** Bote de travesía: row a chain of buoys from club to club. */
class RouteMode implements GameMode {
  private route: Array<{ name: string; x: number; z: number }> = [];
  private next = 0;
  private passed = 0;
  private marker: GoalMarker;

  constructor(private ctx: ModeContext) {
    this.marker = new GoalMarker(ctx.scene);
  }

  secondary() {
    return { label: "Energía", value: `${Math.round(this.ctx.boat.energy * 100)}%` };
  }

  start(): void {
    this.planRoute(this.ctx.boat.position.x, this.ctx.boat.position.z);
  }

  /** Greedy chain of the nearest docks: a travesía from one club to the next. */
  private planRoute(x: number, z: number): void {
    const used = new Set<number>();
    this.route = [];
    let cx = x;
    let cz = z;
    for (let k = 0; k < 4; k++) {
      const next = nearestDocks(this.ctx, cx, cz, -1).find((i) => !used.has(i));
      if (next === undefined) break;
      used.add(next);
      const dock = this.ctx.world.docks[next];
      const p = stopPoint(this.ctx, dock);
      this.route.push({ name: dock.name, x: p.x, z: p.z });
      cx = p.x;
      cz = p.z;
    }
    this.next = 0;
  }

  update(dt: number): void {
    const goal = this.route[this.next];
    if (!goal) return;
    const { boat } = this.ctx;
    if (distance2D(boat.position.x, boat.position.z, goal.x, goal.z) < 1.4) {
      this.passed++;
      this.ctx.addScore(150);
      this.next++;
      if (this.next >= this.route.length) {
        this.ctx.addScore(300);
        this.ctx.notify(`¡Travesía completa!\n+300 puntos · arranca otra desde ${goal.name}`, 3000);
        this.planRoute(goal.x, goal.z);
      } else {
        this.ctx.notify(`Boya de ${goal.name}\n+150 · faltan ${this.route.length - this.next}`, 2000);
      }
    }
    const t = this.target();
    if (t) this.marker.show(t.x, t.z, dt);
  }

  target(): Target | null {
    const g = this.route[this.next];
    return g ? { label: `Boya ${this.next + 1}/${this.route.length}`, name: g.name, x: g.x, z: g.z } : null;
  }

  hint(): string | null {
    return this.ctx.boat.energy < 0.25 ? "Los remeros están cansados: aflojá un poco" : null;
  }

  summary(score: number): Summary {
    return {
      verdict: score > 2000 ? "Tripulación de club" : score > 900 ? "Buena remada" : "A entrenar",
      stats: [{ value: this.passed, label: "boyas pasadas" }],
    };
  }

  dispose(): void {
    this.marker.dispose();
  }
}

/** Kayak: find the hidden corners of the narrow arroyos near the start. */
class ExploreMode implements GameMode {
  private spots: Array<{ name: string; x: number; z: number; found: boolean }> = [];
  private foundTotal = 0;
  private marker: GoalMarker;

  constructor(private ctx: ModeContext) {
    this.marker = new GoalMarker(ctx.scene);
  }

  secondary() {
    return { label: "Rincones", value: `${this.spots.filter((s) => s.found).length}/${this.spots.length}` };
  }

  start(): void {
    this.spots = findQuietSpots(this.ctx, 8);
  }

  update(dt: number): void {
    const { boat } = this.ctx;
    for (const s of this.spots) {
      if (!s.found && distance2D(boat.position.x, boat.position.z, s.x, s.z) < 1) {
        s.found = true;
        this.foundTotal++;
        this.ctx.addScore(150);
        const left = this.spots.filter((p) => !p.found).length;
        this.ctx.notify(left ? `Rincón del ${s.name}\n+150 · quedan ${left}` : "¡Encontraste todos los rincones!\n+400", 2400);
        if (!left) {
          this.ctx.addScore(400);
          this.spots = findQuietSpots(this.ctx, 8, this.spots);
        }
      }
    }
    const t = this.target();
    if (t) this.marker.show(t.x, t.z, dt);
  }

  target(): Target | null {
    const { x, z } = this.ctx.boat.position;
    const open = this.spots.filter((s) => !s.found).sort((a, b) => distance2D(x, z, a.x, a.z) - distance2D(x, z, b.x, b.z));
    return open[0] ? { label: "Rincón", name: open[0].name, x: open[0].x, z: open[0].z } : null;
  }

  hint(): string | null {
    return null;
  }

  summary(score: number): Summary {
    return {
      verdict: score > 1500 ? "Baqueano de los arroyos" : score > 600 ? "Buen explorador" : "Quedan rincones por ver",
      stats: [{ value: this.foundTotal, label: "rincones encontrados" }],
    };
  }

  dispose(): void {
    this.marker.dispose();
  }
}

/** Water spots in narrow arroyos near the boat, spread apart. */
function findQuietSpots(ctx: ModeContext, count: number, avoid: Array<{ x: number; z: number }> = []) {
  const { x: bx, z: by } = ctx.boat.position;
  const candidates: Array<{ name: string; x: number; z: number; d: number }> = [];
  for (const river of ctx.world.rivers) {
    for (let i = 0; i < river.points.length; i++) {
      const [x, z] = river.points[i];
      const d = distance2D(bx, by, x, z);
      if (d < 6 || d > 260 || !ctx.isWater(x, z)) continue;
      const w = probeChannel((px, pz) => ctx.isWater(px, pz), x, z, 0).width;
      candidates.push({ name: river.name, x, z, d: d + (w < ARROYO_WIDTH ? 0 : 400) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  const picked: Array<{ name: string; x: number; z: number; found: boolean }> = [];
  for (const c of candidates) {
    if (picked.length >= count) break;
    const clash = [...picked, ...avoid].some((p) => distance2D(p.x, p.z, c.x, c.z) < 18);
    if (!clash) picked.push({ name: c.name, x: c.x, z: c.z, found: false });
  }
  return picked;
}

/** Lancha open: time trial to dock after dock; fines from the rules add up. */
class TimeTrialMode implements GameMode {
  private targetIndex = -1;
  private legTime = 0;
  private legs = 0;
  private best = Infinity;
  private marker: GoalMarker;

  constructor(private ctx: ModeContext) {
    this.marker = new GoalMarker(ctx.scene);
  }

  secondary() {
    const s = Math.floor(this.legTime);
    return { label: "Tramo", value: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` };
  }

  start(): void {
    this.pickTarget();
  }

  private pickTarget(): void {
    const { x, z } = this.ctx.boat.position;
    const options = nearestDocks(this.ctx, x, z, this.targetIndex).slice(1, 4);
    if (options.length) this.targetIndex = options[Math.floor(Math.random() * options.length)];
    this.legTime = 0;
  }

  update(dt: number): void {
    this.legTime += dt;
    const t = this.target();
    if (!t) return;
    const { boat, world } = this.ctx;
    // Arrive and slow down at the dock: no need to stop dead
    if (distance2D(boat.position.x, boat.position.z, t.x, t.z) < world.rules.pickupRadius && Math.abs(boat.speed) < boat.spec.maxSpeed * 0.45) {
      const points = Math.max(60, Math.round(450 - this.legTime * 8));
      this.best = Math.min(this.best, this.legTime);
      this.legs++;
      this.ctx.addScore(points);
      this.ctx.notify(`${t.name} en ${this.legTime.toFixed(1)} s\n+${points} puntos`, 2400);
      this.pickTarget();
    }
    this.marker.show(t.x, t.z, dt);
  }

  target(): Target | null {
    const dock = this.ctx.world.docks[this.targetIndex];
    if (!dock) return null;
    const p = stopPoint(this.ctx, dock);
    return { label: "Destino", name: dock.name, x: p.x, z: p.z };
  }

  hint(): string | null {
    return null;
  }

  summary(score: number): Summary {
    return {
      verdict: score > 2500 ? "Rápido y prolijo" : score > 1000 ? "Buen piloto" : "Ojo con las multas",
      stats: [
        { value: this.legs, label: "tramos" },
        { value: Number.isFinite(this.best) ? Math.round(this.best) : 0, label: "seg. mejor tramo" },
      ],
    };
  }

  dispose(): void {
    this.marker.dispose();
  }
}

export function createMode(id: BoatTypeId, ctx: ModeContext): GameMode {
  switch (id) {
    case "colectiva":
      return new PassengerMode(ctx);
    case "travesia":
      return new RouteMode(ctx);
    case "kayak":
      return new ExploreMode(ctx);
    case "open":
      return new TimeTrialMode(ctx);
  }
}
