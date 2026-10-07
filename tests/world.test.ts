import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import schema from "../src/world/schema/world.schema.json";
import deltaWorld from "../src/world/data/delta.world.json";
import { parseWorld, WorldValidationError, degToRad, findDock } from "../src/world/WorldDoc";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("delta.world.json", () => {
  it("is valid against the published JSON Schema", () => {
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    expect(validate(deltaWorld), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("passes the runtime validator", () => {
    const world = parseWorld(deltaWorld);
    expect(world.world.id).toBe("delta-tigre");
    expect(world.rivers).toHaveLength(10);
    expect(world.docks).toHaveLength(15);
  });

  it("keeps the legacy layout (Phase 0 must not change the world)", () => {
    const world = parseWorld(deltaWorld);
    expect(world.world.size).toBe(800);
    expect(world.rules).toEqual({
      durationSec: 300,
      boatCapacity: 20,
      pickupRadius: 8,
      scorePerPassenger: 100,
      timeBonusPerPassenger: 50,
    });
    const lujan = world.rivers.find((r) => r.id === "rio-lujan")!;
    expect(lujan.width).toBe(28);
    expect(lujan.points[0]).toEqual([-400, 0]);
    const start = findDock(world, world.spawn.dock);
    expect(start.name).toBe("Estación Fluvial Tigre");
    expect([start.x + world.spawn.offset[0], start.z + world.spawn.offset[1]]).toEqual([-295, 10]);
    const sarmiento = world.docks.find((d) => d.id === "sarmiento-centro")!;
    expect(degToRad(sarmiento.rotationDeg)).toBeCloseTo(Math.PI / 3, 12);
    expect(world.scatter.map((s) => [s.prefab, s.seed, s.attempts])).toEqual([
      ["tree", 42, 600],
      ["house", 123, 80],
    ]);
  });
});

describe("parseWorld rejects broken documents", () => {
  const issuesOf = (doc: unknown): string[] => {
    try {
      parseWorld(doc);
    } catch (e) {
      if (e instanceof WorldValidationError) return e.issues;
      throw e;
    }
    return [];
  };

  it("unknown spawn dock", () => {
    const doc = clone(deltaWorld);
    doc.spawn.dock = "no-existe";
    expect(issuesOf(doc)).toContain('$.spawn.dock: no dock with id "no-existe"');
  });

  it("duplicate ids", () => {
    const doc = clone(deltaWorld);
    doc.docks[1].id = doc.docks[0].id;
    expect(issuesOf(doc).some((i) => i.includes("duplicate id"))).toBe(true);
  });

  it("entities outside the world", () => {
    const doc = clone(deltaWorld);
    doc.docks[0].x = 9999;
    expect(issuesOf(doc).some((i) => i.includes("outside the world bounds"))).toBe(true);
  });

  it("unknown properties and wrong types", () => {
    const doc = clone(deltaWorld) as Record<string, any>;
    doc.rules.boatCapacity = "veinte";
    doc.dragons = true;
    const issues = issuesOf(doc);
    expect(issues).toContain("$.rules.boatCapacity: expected a finite number");
    expect(issues).toContain("$.dragons: unknown property");
  });

  it("rivers need at least two points", () => {
    const doc = clone(deltaWorld);
    doc.rivers[0].points = [[0, 0]];
    expect(issuesOf(doc)).toContain("$.rivers[0].points: expected at least 2 item(s)");
  });
});

describe("schema and runtime validator agree", () => {
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  const mutations: Array<[string, (d: any) => void]> = [
    ["bad id", (d) => (d.world.id = "Delta Tigre")],
    ["negative capacity", (d) => (d.rules.boatCapacity = 0)],
    ["bad prefab", (d) => (d.scatter[0].prefab = "dragon")],
    ["spread > 1", (d) => (d.scatter[0].spread = 2)],
    ["missing rules", (d) => delete d.rules],
    ["3D point", (d) => (d.rivers[0].points[0] = [1, 2, 3])],
  ];
  for (const [name, mutate] of mutations) {
    it(`both reject: ${name}`, () => {
      const doc = clone(deltaWorld);
      mutate(doc);
      expect(validate(doc)).toBe(false);
      expect(() => parseWorld(doc)).toThrow(WorldValidationError);
    });
  }
});
