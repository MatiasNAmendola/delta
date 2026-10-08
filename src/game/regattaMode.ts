import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { buildSingle, type BoatModel } from "../boat/boatModels";
import { WATER_LEVEL } from "../utils/constants";
import { GoalMarker, type GameMode, type ModeContext, type Summary, type Target } from "./modes";
import { LANE_WIDTH, laneOffset, planCourse, pointAt, project, rivalSpeed, type Course } from "./regattaCourse";

/** Boats in the race, the player included. */
const LANES = 4;
/** Club colors of the rival crews. */
const CLUBS: Array<{ name: string; color: Color3 }> = [
  { name: "Tigre Boat Club", color: new Color3(0.1, 0.25, 0.6) },
  { name: "Buenos Aires Rowing Club", color: new Color3(0.75, 0.12, 0.15) },
  { name: "Club de Regatas Hispano Argentino", color: new Color3(0.95, 0.75, 0.1) },
  { name: "Rowing Club Argentino", color: new Color3(0.15, 0.5, 0.25) },
  { name: "Club Canottieri Italiani", color: new Color3(0.2, 0.6, 0.35) },
  { name: "Club de Remo Teutonia", color: new Color3(0.1, 0.1, 0.1) },
];
const PLAYER_LANE = 1;
const POINTS_BY_PLACE = [500, 300, 180, 100];

interface Rival {
  model: BoatModel;
  lane: number;
  club: string;
  cruise: number;
  s: number;
  phase: number;
  finished: number | null;
}

type Phase = "llamada" | "atencion" | "carrera" | "llegada";

/**
 * Club rowing regattas on the river, as they were run on the Luján: a
 * single (1x) in lane 2 against three club crews over 2000 m, downstream.
 * The starter calls "¡Atención!" and then "¡Ya!": moving before it is a
 * false start. Leaving your lane costs points; the bow over the line first wins.
 */
export class RegattaMode implements GameMode {
  private course: Course | null;
  private rivals: Rival[] = [];
  private phase: Phase = "llamada";
  private clock = 0;
  private setTime = 0;
  private raceTime = 0;
  private falseStarts = 0;
  private outOfLane = 0;
  private laneCooldown = 0;
  private races = 0;
  private wins = 0;
  private best = Infinity;
  private place = 1;
  private marker: GoalMarker;
  private buoys: Mesh | null = null;

  constructor(private ctx: ModeContext) {
    this.marker = new GoalMarker(ctx.scene);
    this.course = planCourse(ctx.world.rivers, ctx.isWater, ctx.start, LANES);
    const course = this.course;
    if (!course) return;
    this.buildBuoys(course);
    const clubs = [...CLUBS].sort(() => Math.random() - 0.5);
    for (let lane = 0, k = 0; lane < LANES; lane++) {
      if (lane === PLAYER_LANE) continue;
      const club = clubs[k++];
      const model = buildSingle(ctx.scene, ctx.boat.spec, club.color, `rival${lane}`);
      this.rivals.push({ model, lane, club: club.name, cruise: 0, s: 0, phase: Math.random() * 6, finished: null });
    }
  }

  /** Lane buoys every 250 m (red and white), the finish ones larger. */
  private buildBuoys(course: Course): void {
    const scene = this.ctx.scene;
    const buoy = MeshBuilder.CreateSphere("regataBoya", { diameter: 0.12, segments: 6 }, scene);
    const mat = new StandardMaterial("regataBoya", scene);
    mat.diffuseColor = new Color3(0.95, 0.3, 0.15);
    mat.emissiveColor = new Color3(0.2, 0.05, 0);
    buoy.material = mat;
    buoy.isPickable = false;
    const matrices: number[] = [];
    const every = course.length / 8;
    for (let s = 0; s <= course.length + 0.01; s += every) {
      const p = pointAt(course.path, s);
      const rx = Math.cos(p.heading);
      const rz = -Math.sin(p.heading);
      const big = s >= course.length - 0.01 || s === 0 ? 2 : 1;
      for (let k = 0; k <= LANES; k++) {
        const off = laneOffset(k, LANES) - LANE_WIDTH / 2;
        const m = Matrix.Scaling(big, big, big).multiply(Matrix.Translation(p.x + rx * off, WATER_LEVEL + 0.02, p.z + rz * off));
        matrices.push(...(m.toArray() as number[]));
      }
    }
    buoy.thinInstanceSetBuffer("matrix", new Float32Array(matrices), 16, true);
    this.buoys = buoy;
  }

  secondary() {
    if (!this.course) return { label: "Regata", value: "—" };
    if (this.phase === "carrera" || this.phase === "llegada") return { label: "Puesto", value: `${this.place}/${LANES}` };
    return { label: "Regata", value: `${this.races + 1}` };
  }

  start(): void {
    if (!this.course) {
      this.ctx.notify("No hay un tramo de río libre para la regata", 3500);
      return;
    }
    this.toStart();
  }

  /** Everyone back at the start pontoons, the starter calls the crews. */
  private toStart(): void {
    const course = this.course!;
    this.phase = "llamada";
    this.clock = 0;
    this.setTime = 2.2 + Math.random() * 1.6;
    this.raceTime = 0;
    this.outOfLane = 0;
    const start = this.lanePoint(PLAYER_LANE, 0);
    this.ctx.placeBoat(start.x, start.z, start.heading);
    // Rivals of about your level; one of them is always good
    this.rivals.forEach((r, i) => {
      r.s = 0;
      r.finished = null;
      r.cruise = this.ctx.boat.spec.maxSpeed * 60 * (i === 0 ? 0.68 : 0.55 + Math.random() * 0.1);
    });
    this.ctx.notify(`Regata en el ${course.river}\n${Math.round(course.length * 8)} m · andarivel ${PLAYER_LANE + 1}`, 2200);
  }

  private lanePoint(lane: number, s: number) {
    const p = pointAt(this.course!.path, s);
    const off = laneOffset(lane, LANES);
    return { x: p.x + Math.cos(p.heading) * off, z: p.z - Math.sin(p.heading) * off, heading: p.heading };
  }

  update(dt: number): void {
    const course = this.course;
    if (!course) return;
    const boat = this.ctx.boat;
    this.clock += dt;
    this.laneCooldown = Math.max(0, this.laneCooldown - dt);

    if (this.phase === "llamada" || this.phase === "atencion") {
      if (this.phase === "llamada" && this.clock > 1.4) {
        this.phase = "atencion";
        this.ctx.notify("¡Atención!", 1500);
      } else if (this.phase === "atencion") {
        // Pulling before the "¡Ya!" is a false start
        if (boat.throttle > 0) {
          this.falseStarts++;
          const penalty = this.falseStarts > 1 ? 80 : 0;
          if (penalty) this.ctx.addScore(-penalty);
          this.ctx.notify(penalty ? `Otra largada falsa\n−${penalty} puntos` : "¡Largada falsa! Esperá el ¡Ya!", 2200);
          this.toStart();
          return;
        }
        if (this.clock > this.setTime + 1.4) {
          this.phase = "carrera";
          this.ctx.notify("¡Ya!", 1000);
        }
      }
      if (this.phase !== "carrera") {
        // Held at the start pontoon
        const start = this.lanePoint(PLAYER_LANE, 0);
        boat.position.x = start.x;
        boat.position.z = start.z;
        boat.rotation = start.heading;
        boat.speed = 0;
      }
    }

    // Rivals row their lanes, carried by the current like you
    const racing = this.phase === "carrera" || this.phase === "llegada";
    if (racing) this.raceTime += dt;
    for (const r of this.rivals) {
      if (racing && r.finished === null) {
        const p = this.lanePoint(r.lane, r.s);
        const [cx, cz] = this.ctx.current(p.x, p.z);
        const along = cx * Math.sin(p.heading) + cz * Math.cos(p.heading);
        r.s += (rivalSpeed(r.cruise, r.s, course.length, this.raceTime) + along * 0.8) * dt;
        if (r.s >= course.length) r.finished = this.raceTime;
      }
      const effort = racing && r.finished === null ? 1 : 0.15;
      r.phase += dt * (racing && r.finished === null ? 5 : 1.2);
      r.model.animate(r.phase, effort);
      const p = this.lanePoint(r.lane, Math.min(r.s, course.length + 6));
      r.model.root.position.set(p.x, WATER_LEVEL + this.ctx.level(), p.z);
      r.model.root.rotation.y = p.heading;
    }
    if (!racing) return;

    const me = project(course.path, boat.position.x, boat.position.z);
    if (this.phase === "carrera") {
      this.place = 1 + this.rivals.filter((r) => r.finished !== null || r.s > me.s).length;
      // Stay in your lane
      const drift = Math.abs(me.offset - laneOffset(PLAYER_LANE, LANES));
      this.outOfLane = drift > LANE_WIDTH * 0.75 ? this.outOfLane + dt : 0;
      if (this.outOfLane > 1.5 && this.laneCooldown === 0) {
        this.laneCooldown = 4;
        this.ctx.addScore(-15);
        this.ctx.notify("Fuera de tu andarivel\n−15 puntos", 1800);
      }
      if (me.s >= course.length) {
        this.phase = "llegada";
        this.clock = 0;
        this.races++;
        this.best = Math.min(this.best, this.raceTime);
        const points = POINTS_BY_PLACE[this.place - 1] ?? 50;
        if (this.place === 1) this.wins++;
        this.ctx.addScore(points);
        const winner = this.rivals.filter((r) => r.finished !== null).sort((a, b) => a.finished! - b.finished!)[0];
        this.ctx.notify(
          this.place === 1
            ? `¡Ganaste la regata! ${this.raceTime.toFixed(1)} s\n+${points} puntos`
            : `Llegaste ${this.place}º en ${this.raceTime.toFixed(1)} s · ganó ${winner?.club ?? "otro club"}\n+${points} puntos`,
          3800
        );
      }
    } else if (this.clock > 6) {
      this.toStart();
    }
    const finish = pointAt(course.path, course.length);
    if (this.phase === "carrera") this.marker.show(finish.x, finish.z, dt);
    else this.marker.hide();
  }

  target(): Target | null {
    if (!this.course || this.phase === "llegada") return null;
    const p = pointAt(this.course.path, this.course.length);
    return { label: "Llegada", name: this.course.river, x: p.x, z: p.z };
  }

  hint(): string | null {
    if (this.phase === "llamada") return "Los botes a la línea de largada";
    if (this.phase === "atencion") return "Esperá el ¡Ya!";
    return null;
  }

  summary(score: number): Summary {
    return {
      verdict: this.wins > 0 ? "¡Campeón del río!" : score > 400 ? "Buen remo" : "A seguir entrenando",
      stats: [
        { value: this.races, label: "regatas" },
        { value: this.wins, label: "ganadas" },
        { value: Number.isFinite(this.best) ? Math.round(this.best) : 0, label: "seg. mejor tiempo" },
      ],
    };
  }

  dispose(): void {
    this.marker.dispose();
    this.buoys?.dispose(false, true);
    for (const r of this.rivals) r.model.root.dispose(false, true);
  }
}
