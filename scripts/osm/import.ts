/**
 * Builds a World Doc from OpenStreetMap data.
 *
 *   scripts/osm/fetch-delta.sh            # downloads scripts/osm/delta-tigre.overpass.json
 *   npm run world:import -- --scale 8     # writes src/world/data/delta-real.world.json
 *
 * Flags: --in <overpass.json> --out <world.json> --scale <m per unit>
 *        --size <world units> --id <id> --name <name> --unnamed
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWorld } from "../../src/world/WorldDoc";
import { DEFAULT_OPTIONS, osmToWorld, type OverpassElement } from "./osmToWorld";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const root = resolve(import.meta.dirname, "../..");
const input = resolve(root, flag("in", "scripts/osm/delta-tigre.overpass.json"));
const output = resolve(root, flag("out", "src/world/data/delta-real.world.json"));
const metersPerUnit = Number(flag("scale", String(DEFAULT_OPTIONS.metersPerUnit)));
const size = Number(flag("size", "2600"));

const overpass = JSON.parse(readFileSync(input, "utf8")) as { elements: OverpassElement[] };
const base = parseWorld(JSON.parse(readFileSync(resolve(root, "src/world/data/delta.world.json"), "utf8")));

const { world, report } = osmToWorld(
  overpass.elements,
  base,
  { id: flag("id", "delta-tigre-real"), name: flag("name", "Delta de Tigre (OpenStreetMap)"), size },
  { ...DEFAULT_OPTIONS, metersPerUnit, includeUnnamed: args.includes("--unnamed") }
);

const json = JSON.stringify(world, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, "[$1, $2]");
writeFileSync(output, json + "\n");
console.log(
  `World written to ${output}\n` +
    `  rivers: ${report.rivers} · docks: ${report.docks} · ` +
    `dropped unnamed: ${report.droppedUnnamed} · dropped short: ${report.droppedShort}`
);
