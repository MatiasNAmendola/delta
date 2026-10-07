/**
 * Converts OpenStreetMap data (Overpass JSON with `out geom`) into the
 * rivers and docks of a World Doc. Pure functions only: no I/O, so it can be
 * unit tested and reused by an in-game importer later.
 *
 * Map data © OpenStreetMap contributors, ODbL 1.0. A world built from it must
 * keep the attribution in `world.attribution`.
 */
import { parseWorld, type Dock, type River, type Vec2, type WorldDoc } from "../../src/world/WorldDoc";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  geometry?: LatLon[];
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
}

export interface ImportOptions {
  /** Real meters per world unit. 1 = real scale; 8 = the map shrunk 8 times. */
  metersPerUnit: number;
  /** Projection origin; defaults to the center of the data. */
  origin?: LatLon;
  /** Douglas-Peucker tolerance, in world units. */
  simplifyTolerance: number;
  /** Narrowest river kept playable for the boat, in world units. */
  minRiverWidth: number;
  /** Rivers shorter than this (world units) are dropped. */
  minRiverLength: number;
  /** Keep waterways without a `name` tag. */
  includeUnnamed: boolean;
  /** Ferry terminals closer than this (meters) are merged into one stop. */
  stopMergeRadiusM: number;
  /** Extra stops placed at real confluences of named rivers (0 = none). */
  confluenceStops: number;
  /** Minimum distance between stops, in world units. */
  minStopSpacing: number;
}

export const DEFAULT_OPTIONS: ImportOptions = {
  metersPerUnit: 8,
  simplifyTolerance: 1.5,
  minRiverWidth: 8,
  minRiverLength: 20,
  includeUnnamed: false,
  stopMergeRadiusM: 1000,
  confluenceStops: 12,
  minStopSpacing: 150,
};

/** Typical widths (meters) when OSM has no `width` tag. */
const DEFAULT_WIDTH_M: Record<string, number> = {
  river: 150,
  canal: 40,
  tidal_channel: 40,
  stream: 30,
  ditch: 10,
};

/**
 * Width when OSM has no `width` tag. In the Delta many arroyos are tagged
 * `waterway=river`, so the name is a better hint than the tag.
 */
export function estimateWidthM(type: string, name: string): number {
  if (/^r[ií]o paran[aá]/i.test(name)) return 600;
  if (/^(arroyo|aguaje|zanja)\b/i.test(name)) return 35;
  if (/^(canal|pasaje)\b/i.test(name)) return 40;
  if (/^r[ií]o\b/i.test(name)) return 150;
  return DEFAULT_WIDTH_M[type] ?? 30;
}

/** Waterway types worth navigating; e.g. `fairway` (shipping lanes) and `drain` are skipped. */
const WATERWAY_TYPES = new Set(Object.keys(DEFAULT_WIDTH_M));

/** Upper bound of placement attempts per prefab for big imported worlds. */
const MAX_SCATTER_ATTEMPTS: Record<string, number> = { tree: 3000, house: 600 };

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON_EQUATOR = 111_320;

/** Equirectangular projection around `origin`: +x = east, +z = north, in world units. */
export function project(p: LatLon, origin: LatLon, metersPerUnit: number): Vec2 {
  const mPerDegLon = M_PER_DEG_LON_EQUATOR * Math.cos((origin.lat * Math.PI) / 180);
  return [
    ((p.lon - origin.lon) * mPerDegLon) / metersPerUnit,
    ((p.lat - origin.lat) * M_PER_DEG_LAT) / metersPerUnit,
  ];
}

/** Douglas-Peucker polyline simplification. */
export function simplify(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i], points[a], points[b]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

export function polylineLength(points: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return len;
}

const samePoint = (a: LatLon, b: LatLon) => a.lat === b.lat && a.lon === b.lon;

/**
 * OSM splits one river into many ways. Joins ways that share an endpoint
 * (reversing them when needed) into the longest possible chains.
 */
export function joinWays(ways: LatLon[][]): LatLon[][] {
  const pending = ways.filter((w) => w.length >= 2).map((w) => w.slice());
  const chains: LatLon[][] = [];
  while (pending.length > 0) {
    let chain = pending.shift()!;
    let grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i];
        const head = chain[0];
        const tail = chain[chain.length - 1];
        if (samePoint(tail, w[0])) chain = chain.concat(w.slice(1));
        else if (samePoint(tail, w[w.length - 1])) chain = chain.concat(w.slice(0, -1).reverse());
        else if (samePoint(head, w[w.length - 1])) chain = w.slice(0, -1).concat(chain);
        else if (samePoint(head, w[0])) chain = w.slice(1).reverse().concat(chain);
        else continue;
        pending.splice(i, 1);
        grown = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

/** Splits a polyline into the runs of consecutive points inside ±half. */
export function clipToSquare(points: Vec2[], half: number): Vec2[][] {
  const runs: Vec2[][] = [];
  let run: Vec2[] = [];
  for (const p of points) {
    if (Math.abs(p[0]) <= half && Math.abs(p[1]) <= half) {
      run.push(p);
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  return runs.filter((r) => r.length >= 2);
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56) || "sin-nombre";
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

function elementPoint(el: OverpassElement): LatLon | null {
  if (el.lat !== undefined && el.lon !== undefined) return { lat: el.lat, lon: el.lon };
  if (el.bounds) {
    return { lat: (el.bounds.minlat + el.bounds.maxlat) / 2, lon: (el.bounds.minlon + el.bounds.maxlon) / 2 };
  }
  if (el.geometry && el.geometry.length > 0) {
    const sum = el.geometry.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
    return { lat: sum.lat / el.geometry.length, lon: sum.lon / el.geometry.length };
  }
  return null;
}

function dataCenter(elements: OverpassElement[]): LatLon {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const el of elements) {
    const pts = el.geometry ?? (el.lat !== undefined ? [{ lat: el.lat, lon: el.lon! }] : []);
    for (const p of pts) {
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
    }
  }
  if (!Number.isFinite(minLat)) throw new Error("OSM data has no coordinates");
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
}

export interface ImportResult {
  world: WorldDoc;
  report: { rivers: number; docks: number; terminals: number; droppedUnnamed: number; droppedShort: number };
}

/**
 * Builds a new World Doc: rivers and docks come from OSM; rules and scatter
 * rules are kept from `base` (scatter attempts scaled to the new area so the
 * vegetation density stays the same).
 */
export function osmToWorld(
  elements: OverpassElement[],
  base: WorldDoc,
  world: { id: string; name: string; size: number },
  opts: ImportOptions = DEFAULT_OPTIONS
): ImportResult {
  const origin = opts.origin ?? dataCenter(elements);
  const half = world.size / 2;
  const report = { rivers: 0, docks: 0, terminals: 0, droppedUnnamed: 0, droppedShort: 0 };

  // Group waterway ways by name (and type), so connected pieces join up
  const groups = new Map<string, { name: string; type: string; widthM: number | null; ways: LatLon[][] }>();
  for (const el of elements) {
    const type = el.tags?.waterway;
    if (el.type !== "way" || !type || !WATERWAY_TYPES.has(type) || !el.geometry) continue;
    const name = el.tags?.name?.trim();
    if (!name && !opts.includeUnnamed) {
      report.droppedUnnamed++;
      continue;
    }
    const key = `${type}|${name ?? `osm-${el.id}`}`;
    const widthTag = Number.parseFloat(el.tags?.width ?? "");
    const group = groups.get(key) ?? { name: name ?? "Arroyo sin nombre", type, widthM: null, ways: [] };
    if (Number.isFinite(widthTag)) group.widthM = Math.max(group.widthM ?? 0, widthTag);
    group.ways.push(el.geometry);
    groups.set(key, group);
  }

  const riverIds = new Set<string>();
  const rivers: River[] = [];
  for (const group of groups.values()) {
    const widthM = group.widthM ?? estimateWidthM(group.type, group.name);
    const width = Math.min(200, Math.max(opts.minRiverWidth, widthM / opts.metersPerUnit));
    for (const chain of joinWays(group.ways)) {
      const projected = chain.map((p) => project(p, origin, opts.metersPerUnit));
      for (const run of clipToSquare(projected, half)) {
        const points = simplify(run, opts.simplifyTolerance).map(
          ([x, z]) => [round2(x), round2(z)] as Vec2
        );
        if (points.length < 2 || polylineLength(points) < opts.minRiverLength) {
          report.droppedShort++;
          continue;
        }
        rivers.push({ id: uniqueId(slugify(group.name), riverIds), name: group.name, width: round2(width), points });
      }
    }
  }
  // Widest rivers first: they are the main navigation routes
  rivers.sort((a, b) => b.width - a.width || polylineLength(b.points) - polylineLength(a.points));

  const dockIds = new Set<string>();
  const docks: Dock[] = [];
  const farFromDocks = (x: number, z: number, minDist: number) =>
    docks.every((d) => Math.hypot(d.x - x, d.z - z) >= minDist);

  // 1. Real ferry terminals, merging clusters (e.g. tour operators next to the main station)
  const terminals: Array<{ name: string; x: number; z: number; main: boolean }> = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    const isStop =
      t.amenity === "ferry_terminal" || t.man_made === "pier" ||
      (t.public_transport === "stop_position" && t.ferry === "yes");
    const name = t.name?.trim();
    if (!isStop || !name) continue;
    const point = elementPoint(el);
    if (!point) continue;
    const [x, z] = project(point, origin, opts.metersPerUnit);
    if (Math.abs(x) > half || Math.abs(z) > half) continue;
    terminals.push({ name, x, z, main: /estaci[oó]n fluvial/i.test(name) });
  }
  terminals.sort((a, b) => Number(b.main) - Number(a.main));
  const mergeDist = opts.stopMergeRadiusM / opts.metersPerUnit;
  for (const term of terminals) {
    if (!farFromDocks(term.x, term.z, mergeDist)) continue;
    docks.push({ id: uniqueId(slugify(term.name), dockIds), name: term.name, x: round2(term.x), z: round2(term.z), rotationDeg: 0 });
  }
  report.terminals = docks.length;

  // 2. Stops at real confluences: where a named river ends on another named river
  if (opts.confluenceStops > 0) {
    // Farthest-point sampling weighted by importance: spreads stops over the
    // whole map instead of crowding the river with the most tributaries
    const candidates = findConfluences(rivers);
    const maxScore = Math.max(1, ...candidates.map((c) => c.score));
    const minDistToDocks = (c: Confluence) =>
      docks.length === 0 ? Infinity : Math.min(...docks.map((d) => Math.hypot(d.x - c.x, d.z - c.z)));
    for (let placed = 0; placed < opts.confluenceStops; placed++) {
      let best: Confluence | null = null;
      let bestValue = -Infinity;
      for (const c of candidates) {
        const dist = minDistToDocks(c);
        if (dist < opts.minStopSpacing) continue;
        const value = Math.min(dist, half) * Math.sqrt(c.score / maxScore);
        if (value > bestValue) {
          bestValue = value;
          best = c;
        }
      }
      if (!best) break;
      const c = best;
      docks.push({
        id: uniqueId(slugify(c.name), dockIds),
        name: c.name,
        x: round2(c.x),
        z: round2(c.z),
        rotationDeg: round2(c.rotationDeg),
      });
    }
  }

  if (rivers.length === 0) throw new Error("No waterways found inside the world bounds");
  if (docks.length === 0) throw new Error("No named ferry terminals or piers found inside the world bounds");

  const spawnDock = docks.find((d) => /estaci[oó]n fluvial/i.test(d.name)) ?? docks[0];
  // Terminals sit on the bank: start the boat on the nearest river center line
  const nearestWater = rivers
    .map((r) => nearestOnPolyline([spawnDock.x, spawnDock.z], r.points))
    .reduce((a, b) => (b.distance < a.distance ? b : a));
  const spawnOffset: Vec2 = [
    round2(nearestWater.point[0] - spawnDock.x),
    round2(nearestWater.point[1] - spawnDock.z),
  ];
  const areaFactor = (world.size / base.world.size) ** 2;

  const doc = {
    $schema: "../schema/world.schema.json",
    version: "0.1",
    world: { ...world, attribution: "© OpenStreetMap contributors, ODbL 1.0" },
    rules: base.rules,
    spawn: { dock: spawnDock.id, offset: spawnOffset },
    rivers,
    docks,
    // Same vegetation density as the base world, capped so cheap phones cope
    scatter: base.scatter.map((s) => ({
      ...s,
      attempts: Math.min(MAX_SCATTER_ATTEMPTS[s.prefab] ?? 2000, Math.round(s.attempts * areaFactor)),
    })),
  };
  report.rivers = rivers.length;
  report.docks = docks.length;
  return { world: parseWorld(doc), report };
}

interface Confluence {
  name: string;
  x: number;
  z: number;
  rotationDeg: number;
  score: number;
}

/**
 * A confluence is an endpoint of one river lying on another river. The stop
 * is moved from the water onto the bank of the wider river and faces it.
 */
export function findConfluences(rivers: River[]): Confluence[] {
  const out: Confluence[] = [];
  const seen = new Set<string>();
  for (const trib of rivers) {
    for (const end of [trib.points[0], trib.points[trib.points.length - 1]]) {
      for (const main of rivers) {
        if (main === trib || main.name === trib.name) continue;
        const hit = nearestOnPolyline(end, main.points);
        if (hit.distance > main.width / 2 + trib.width / 2) continue;
        const key = [main.name, trib.name].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        // Bank offset: perpendicular to the main river, away from the tributary side
        const [dx, dz] = hit.direction;
        let nx = -dz, nz = dx;
        const side = (end[0] - hit.point[0]) * nx + (end[1] - hit.point[1]) * nz;
        if (side > 0) { nx = -nx; nz = -nz; }
        const off = main.width / 2 + 3;
        out.push({
          name: `${main.name} y ${trib.name}`,
          x: hit.point[0] + nx * off,
          z: hit.point[1] + nz * off,
          rotationDeg: (Math.atan2(dx, dz) * 180) / Math.PI,
          // Cap the main river so the huge Paraná does not take every stop
          score: Math.min(main.width, 20) + trib.width,
        });
      }
    }
  }
  return out;
}

function nearestOnPolyline(p: Vec2, line: Vec2[]): { point: Vec2; direction: Vec2; distance: number } {
  let best = { point: line[0], direction: [1, 0] as Vec2, distance: Infinity };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
    const q: Vec2 = [a[0] + t * dx, a[1] + t * dz];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.distance) {
      const len = Math.sqrt(len2);
      best = { point: q, direction: [dx / len, dz / len], distance: d };
    }
  }
  return best;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
