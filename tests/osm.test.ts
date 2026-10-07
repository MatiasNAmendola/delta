import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import schema from "../src/world/schema/world.schema.json";
import deltaWorld from "../src/world/data/delta.world.json";
import { parseWorld } from "../src/world/WorldDoc";
import {
  DEFAULT_OPTIONS,
  clipToSquare,
  estimateWidthM,
  joinWays,
  osmToWorld,
  project,
  simplify,
  type OverpassElement,
} from "../scripts/osm/osmToWorld";

const origin = { lat: -34.35, lon: -58.55 };
// ~1 km in degrees at this latitude
const KM_LAT = 1000 / 110_540;
const KM_LON = 1000 / (111_320 * Math.cos((origin.lat * Math.PI) / 180));

const way = (id: number, tags: Record<string, string>, pts: Array<[number, number]>): OverpassElement => ({
  type: "way",
  id,
  tags,
  geometry: pts.map(([dLatKm, dLonKm]) => ({ lat: origin.lat + dLatKm * KM_LAT, lon: origin.lon + dLonKm * KM_LON })),
});
const stop = (id: number, name: string, dLatKm: number, dLonKm: number): OverpassElement => ({
  type: "node",
  id,
  tags: { amenity: "ferry_terminal", name },
  lat: origin.lat + dLatKm * KM_LAT,
  lon: origin.lon + dLonKm * KM_LON,
});

describe("geometry helpers", () => {
  it("projects 1 km east/north to 1000/scale world units", () => {
    const [x, z] = project({ lat: origin.lat + KM_LAT, lon: origin.lon + KM_LON }, origin, 8);
    expect(x).toBeCloseTo(125, 6);
    expect(z).toBeCloseTo(125, 6);
  });

  it("simplifies collinear points away and keeps corners", () => {
    expect(simplify([[0, 0], [1, 0.01], [2, 0], [2, 5]], 0.1)).toEqual([[0, 0], [2, 0], [2, 5]]);
  });

  it("joins ways that share endpoints, reversing when needed", () => {
    const a = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }];
    const b = [{ lat: 0, lon: 2 }, { lat: 0, lon: 1 }]; // reversed continuation
    const c = [{ lat: 5, lon: 5 }, { lat: 5, lon: 6 }]; // disconnected
    const chains = joinWays([a, b, c]);
    expect(chains).toHaveLength(2);
    expect(chains[0].map((p) => p.lon)).toEqual([0, 1, 2]);
  });

  it("clips polylines to the world square", () => {
    expect(clipToSquare([[0, 0], [5, 0], [50, 0], [6, 1], [7, 2]], 10)).toEqual([
      [[0, 0], [5, 0]],
      [[6, 1], [7, 2]],
    ]);
  });
});

describe("osmToWorld", () => {
  const elements: OverpassElement[] = [
    way(1, { waterway: "river", name: "Río Luján" }, [[0, -4], [0, -1]]),
    way(2, { waterway: "river", name: "Río Luján" }, [[0, -1], [0.3, 2], [0, 4]]),
    way(3, { waterway: "stream", name: "Arroyo Espera", width: "24" }, [[0, 0], [2, 0.5], [4, 0]]),
    way(4, { waterway: "stream" }, [[-1, -1], [-2, -2]]), // unnamed
    stop(10, "Estación Fluvial Tigre", -0.1, -3.9),
    stop(11, "Muelle Espera", 3.9, 0.1),
    stop(12, "Muy lejos", 90, 90), // outside the world
  ];
  const base = parseWorld(deltaWorld);
  const { world, report } = osmToWorld(
    elements,
    base,
    { id: "delta-test", name: "Delta de prueba", size: 1200 },
    { ...DEFAULT_OPTIONS, origin }
  );

  it("produces a document valid against the JSON Schema", () => {
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    expect(validate(world), JSON.stringify(validate.errors)).toBe(true);
  });

  it("joins split OSM ways into one river and drops unnamed ones", () => {
    expect(world.rivers.map((r) => r.name)).toEqual(["Río Luján", "Arroyo Espera"]);
    expect(report.droppedUnnamed).toBe(1);
  });

  it("estimates widths from the name when OSM has no width tag", () => {
    expect(estimateWidthM("river", "Río Paraná de las Palmas")).toBe(600);
    expect(estimateWidthM("river", "Arroyo Toro")).toBe(35); // arroyos tagged as rivers
    expect(estimateWidthM("river", "Río Luján")).toBe(150);
    expect(estimateWidthM("canal", "Zona sin nombre claro")).toBe(40);
  });

  it("uses OSM width tags and default widths, never narrower than playable", () => {
    const lujan = world.rivers.find((r) => r.id === "rio-lujan")!;
    const espera = world.rivers.find((r) => r.id === "arroyo-espera")!;
    expect(lujan.width).toBeCloseTo(150 / 8, 2);
    expect(espera.width).toBe(DEFAULT_OPTIONS.minRiverWidth); // 24 m / 8 = 3 → clamped
  });

  it("imports named stops inside the world as docks and spawns at the Estación Fluvial", () => {
    expect(world.docks.map((d) => d.name).slice(0, 2)).toEqual(["Estación Fluvial Tigre", "Muelle Espera"]);
    expect(report.terminals).toBe(2);
    expect(world.spawn.dock).toBe("estacion-fluvial-tigre");
  });

  it("starts the boat on the water next to the spawn terminal", () => {
    const dock = world.docks.find((d) => d.id === world.spawn.dock)!;
    const [x, z] = [dock.x + world.spawn.offset[0], dock.z + world.spawn.offset[1]];
    const lujan = world.rivers.find((r) => r.id === "rio-lujan")!;
    const onLine = lujan.points.slice(1).some((b, i) => {
      const a = lujan.points[i];
      const cross = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
      const within = Math.min(a[0], b[0]) - 0.01 <= x && x <= Math.max(a[0], b[0]) + 0.01;
      return within && Math.abs(cross) / Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05;
    });
    expect(onLine).toBe(true);
  });

  it("adds a stop at the real confluence, on the bank of the main river", () => {
    const stop = world.docks.find((d) => d.name === "Río Luján y Arroyo Espera")!;
    expect(stop).toBeDefined();
    const lujan = world.rivers.find((r) => r.id === "rio-lujan")!;
    // Distance from the stop to the Luján center line: just past the bank
    const distToLujan = Math.min(
      ...lujan.points.slice(1).map((b, i) => {
        const a = lujan.points[i];
        const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
        const t = Math.max(0, Math.min(1, ((stop.x - a[0]) * dx + (stop.z - a[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(stop.x - (a[0] + t * dx), stop.z - (a[1] + t * dz));
      })
    );
    expect(distToLujan).toBeCloseTo(lujan.width / 2 + 3, 0);
  });

  it("merges ferry terminals that are next to each other", () => {
    const cluster = [
      stop(20, "Estación Fluvial Tigre", -0.1, -3.9),
      stop(21, "Agencia de Turismo", -0.12, -3.88), // ~30 m away
    ];
    const { world: w } = osmToWorld([...elements, ...cluster], base, { id: "x", name: "x", size: 1200 }, { ...DEFAULT_OPTIONS, origin, confluenceStops: 0 });
    expect(w.docks.map((d) => d.name)).toEqual(["Estación Fluvial Tigre", "Muelle Espera"]);
  });

  it("credits OpenStreetMap and scales vegetation to the new area", () => {
    expect(world.world.attribution).toMatch(/OpenStreetMap/);
    const factor = (1200 / 800) ** 2;
    expect(world.scatter[0].attempts).toBe(Math.round(600 * factor));
  });
});
