/**
 * World Doc (World DSL v0.1): the declarative description of a world.
 *
 * This module is engine-agnostic on purpose: no Babylon imports. The JSON
 * Schema in ./schema/world.schema.json is the published contract; this file
 * mirrors it as TypeScript types plus a runtime validator that also checks
 * the cross-references a JSON Schema cannot express (unique ids, spawn dock
 * exists, everything inside the world bounds).
 */

export type Vec2 = [number, number];

export interface WorldInfo {
  id: string;
  name: string;
  /** Side of the square world in meters; origin at the center. */
  size: number;
  /** Credits for the data the world was built from (e.g. OpenStreetMap). */
  attribution?: string;
}

export interface WorldRules {
  durationSec: number;
  boatCapacity: number;
  pickupRadius: number;
  scorePerPassenger: number;
  timeBonusPerPassenger: number;
}

export interface River {
  id: string;
  name: string;
  width: number;
  /** Polyline [x, z] along the river center. */
  points: Vec2[];
}

export interface Dock {
  id: string;
  name: string;
  x: number;
  z: number;
  rotationDeg: number;
}

export type ScatterPrefab = "tree" | "house";

export interface ScatterRule {
  id: string;
  prefab: ScatterPrefab;
  seed: number;
  attempts: number;
  spread: number;
  nearWaterDistance: number;
  inlandChance: number;
  instanceSeed: { stride: number; offset: number };
}

/** A body of water with its real shape: outer ring plus islands as holes. */
export interface WaterArea {
  id: string;
  name?: string;
  outer: Vec2[];
  holes: Vec2[][];
}

export interface WorldDoc {
  version: "0.1";
  world: WorldInfo;
  rules: WorldRules;
  spawn: { dock: string; offset: Vec2 };
  rivers: River[];
  /** Optional real water shapes; navigable water = rivers ∪ waterAreas. */
  waterAreas?: WaterArea[];
  docks: Dock[];
  scatter: ScatterRule[];
}

/** Content budget: total vertices across all water areas (keeps big imports playable on phones). */
export const MAX_WATER_AREA_VERTICES = 60_000;

export class WorldValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid world document:\n- ${issues.join("\n- ")}`);
    this.name = "WorldValidationError";
  }
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SCATTER_PREFABS: readonly ScatterPrefab[] = ["tree", "house"];

/** Validates unknown input (e.g. parsed JSON) and returns a typed WorldDoc. */
export function parseWorld(input: unknown): WorldDoc {
  const issues: string[] = [];
  const v = new Checker(issues);

  const doc = v.object(input, "$", [
    "$schema", "version", "world", "rules", "spawn", "rivers", "waterAreas", "docks", "scatter",
  ], ["$schema", "waterAreas"]);
  if (!doc) throw new WorldValidationError(issues);

  if (doc.version !== "0.1") issues.push(`$.version: expected "0.1", got ${JSON.stringify(doc.version)}`);

  const world = v.object(doc.world, "$.world", ["id", "name", "size", "attribution"], ["attribution"]);
  if (world) {
    v.id(world.id, "$.world.id");
    v.name(world.name, "$.world.name");
    v.number(world.size, "$.world.size", { min: 50, max: 4000 });
    if (world.attribution !== undefined && (typeof world.attribution !== "string" || world.attribution.length > 200)) {
      issues.push("$.world.attribution: expected a string of at most 200 characters");
    }
  }

  const rules = v.object(doc.rules, "$.rules", [
    "durationSec", "boatCapacity", "pickupRadius", "scorePerPassenger", "timeBonusPerPassenger",
  ]);
  if (rules) {
    v.number(rules.durationSec, "$.rules.durationSec", { exclusiveMin: 0 });
    v.number(rules.boatCapacity, "$.rules.boatCapacity", { min: 1, max: 200, integer: true });
    v.number(rules.pickupRadius, "$.rules.pickupRadius", { exclusiveMin: 0 });
    v.number(rules.scorePerPassenger, "$.rules.scorePerPassenger", { min: 0 });
    v.number(rules.timeBonusPerPassenger, "$.rules.timeBonusPerPassenger", { min: 0 });
  }

  const spawn = v.object(doc.spawn, "$.spawn", ["dock", "offset"]);
  if (spawn) {
    v.id(spawn.dock, "$.spawn.dock");
    v.vec2(spawn.offset, "$.spawn.offset");
  }

  const half = typeof world?.size === "number" ? world.size / 2 : Infinity;
  const inBounds = (x: unknown, z: unknown, path: string) => {
    if (typeof x === "number" && typeof z === "number" && (Math.abs(x) > half || Math.abs(z) > half)) {
      issues.push(`${path}: (${x}, ${z}) is outside the world bounds ±${half}`);
    }
  };

  const riverIds = new Set<string>();
  v.array(doc.rivers, "$.rivers", 1).forEach((r, i) => {
    const p = `$.rivers[${i}]`;
    const river = v.object(r, p, ["id", "name", "width", "points"]);
    if (!river) return;
    if (v.id(river.id, `${p}.id`)) v.unique(riverIds, river.id as string, `${p}.id`);
    v.name(river.name, `${p}.name`);
    v.number(river.width, `${p}.width`, { exclusiveMin: 0, max: 200 });
    v.array(river.points, `${p}.points`, 2).forEach((pt, j) => {
      if (v.vec2(pt, `${p}.points[${j}]`)) inBounds((pt as Vec2)[0], (pt as Vec2)[1], `${p}.points[${j}]`);
    });
  });

  const dockIds = new Set<string>();
  v.array(doc.docks, "$.docks", 1).forEach((d, i) => {
    const p = `$.docks[${i}]`;
    const dock = v.object(d, p, ["id", "name", "x", "z", "rotationDeg"]);
    if (!dock) return;
    if (v.id(dock.id, `${p}.id`)) v.unique(dockIds, dock.id as string, `${p}.id`);
    v.name(dock.name, `${p}.name`);
    v.number(dock.x, `${p}.x`);
    v.number(dock.z, `${p}.z`);
    v.number(dock.rotationDeg, `${p}.rotationDeg`, { min: -360, max: 360 });
    inBounds(dock.x, dock.z, p);
  });

  if (spawn && typeof spawn.dock === "string" && !dockIds.has(spawn.dock)) {
    issues.push(`$.spawn.dock: no dock with id "${spawn.dock}"`);
  }

  if (doc.waterAreas !== undefined) {
    const areaIds = new Set<string>();
    let vertices = 0;
    v.array(doc.waterAreas, "$.waterAreas", 0).forEach((a, i) => {
      const p = `$.waterAreas[${i}]`;
      const area = v.object(a, p, ["id", "name", "outer", "holes"], ["name"]);
      if (!area) return;
      if (v.id(area.id, `${p}.id`)) v.unique(areaIds, area.id as string, `${p}.id`);
      if (area.name !== undefined) v.name(area.name, `${p}.name`);
      const rings: Array<[unknown, string]> = [[area.outer, `${p}.outer`]];
      v.array(area.holes, `${p}.holes`, 0).forEach((h, j) => rings.push([h, `${p}.holes[${j}]`]));
      for (const [ring, rp] of rings) {
        const pts = v.array(ring, rp, 3);
        vertices += pts.length;
        pts.forEach((pt, k) => {
          if (v.vec2(pt, `${rp}[${k}]`)) inBounds((pt as Vec2)[0], (pt as Vec2)[1], `${rp}[${k}]`);
        });
      }
    });
    if (vertices > MAX_WATER_AREA_VERTICES) {
      issues.push(`$.waterAreas: ${vertices} vertices exceed the budget of ${MAX_WATER_AREA_VERTICES}`);
    }
  }

  const scatterIds = new Set<string>();
  v.array(doc.scatter, "$.scatter", 0).forEach((s, i) => {
    const p = `$.scatter[${i}]`;
    const rule = v.object(s, p, [
      "id", "prefab", "seed", "attempts", "spread", "nearWaterDistance", "inlandChance", "instanceSeed",
    ]);
    if (!rule) return;
    if (v.id(rule.id, `${p}.id`)) v.unique(scatterIds, rule.id as string, `${p}.id`);
    if (!SCATTER_PREFABS.includes(rule.prefab as ScatterPrefab)) {
      issues.push(`${p}.prefab: expected one of ${SCATTER_PREFABS.join(", ")}`);
    }
    v.number(rule.seed, `${p}.seed`, { integer: true });
    v.number(rule.attempts, `${p}.attempts`, { min: 0, max: 20000, integer: true });
    v.number(rule.spread, `${p}.spread`, { exclusiveMin: 0, max: 1 });
    v.number(rule.nearWaterDistance, `${p}.nearWaterDistance`, { min: 0 });
    v.number(rule.inlandChance, `${p}.inlandChance`, { min: 0, max: 1 });
    const seed = v.object(rule.instanceSeed, `${p}.instanceSeed`, ["stride", "offset"]);
    if (seed) {
      v.number(seed.stride, `${p}.instanceSeed.stride`, { integer: true });
      v.number(seed.offset, `${p}.instanceSeed.offset`, { integer: true });
    }
  });

  if (issues.length > 0) throw new WorldValidationError(issues);
  return doc as unknown as WorldDoc;
}

export function findDock(doc: WorldDoc, id: string): Dock {
  const dock = doc.docks.find((d) => d.id === id);
  if (!dock) throw new Error(`No dock with id "${id}" in world "${doc.world.id}"`);
  return dock;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

type Obj = Record<string, unknown>;

class Checker {
  constructor(private issues: string[]) {}

  object(value: unknown, path: string, allowed: string[], optional: string[] = []): Obj | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      this.issues.push(`${path}: expected an object`);
      return null;
    }
    const obj = value as Obj;
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) this.issues.push(`${path}.${key}: unknown property`);
    }
    for (const key of allowed) {
      if (!optional.includes(key) && !(key in obj)) this.issues.push(`${path}.${key}: required`);
    }
    return obj;
  }

  array(value: unknown, path: string, minItems: number): unknown[] {
    if (!Array.isArray(value)) {
      this.issues.push(`${path}: expected an array`);
      return [];
    }
    if (value.length < minItems) this.issues.push(`${path}: expected at least ${minItems} item(s)`);
    return value;
  }

  number(
    value: unknown,
    path: string,
    opts: { min?: number; max?: number; exclusiveMin?: number; integer?: boolean } = {}
  ): boolean {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.issues.push(`${path}: expected a finite number`);
      return false;
    }
    if (opts.integer && !Number.isInteger(value)) this.issues.push(`${path}: expected an integer`);
    if (opts.min !== undefined && value < opts.min) this.issues.push(`${path}: must be >= ${opts.min}`);
    if (opts.max !== undefined && value > opts.max) this.issues.push(`${path}: must be <= ${opts.max}`);
    if (opts.exclusiveMin !== undefined && value <= opts.exclusiveMin) {
      this.issues.push(`${path}: must be > ${opts.exclusiveMin}`);
    }
    return true;
  }

  id(value: unknown, path: string): boolean {
    if (typeof value !== "string" || value.length > 64 || !ID_PATTERN.test(value)) {
      this.issues.push(`${path}: expected a kebab-case id (a-z, 0-9, "-")`);
      return false;
    }
    return true;
  }

  name(value: unknown, path: string): void {
    if (typeof value !== "string" || value.length < 1 || value.length > 80) {
      this.issues.push(`${path}: expected a name of 1-80 characters`);
    }
  }

  vec2(value: unknown, path: string): boolean {
    if (
      !Array.isArray(value) || value.length !== 2 ||
      !value.every((n) => typeof n === "number" && Number.isFinite(n))
    ) {
      this.issues.push(`${path}: expected [x, z] with two finite numbers`);
      return false;
    }
    return true;
  }

  unique(seen: Set<string>, id: string, path: string): void {
    if (seen.has(id)) this.issues.push(`${path}: duplicate id "${id}"`);
    seen.add(id);
  }
}
