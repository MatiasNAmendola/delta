/**
 * Builds a World Doc from OpenStreetMap data.
 *
 *   scripts/osm/fetch-delta.sh            # downloads scripts/osm/delta-tigre.overpass.json
 *   npm run world:import -- --scale 8     # writes src/world/data/delta-real.world.json
 *
 * Flags: --in <overpass.json> --out <world.json> --scale <m per unit>
 *        --size <world units> --origin <lat,lon> --id <id> --name <name> --unnamed
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorld } from "../../src/world/WorldDoc";
import { DEFAULT_OPTIONS, osmToWorld, setNameFixes, type OverpassElement } from "./osmToWorld";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const input = resolve(root, flag("in", "scripts/osm/delta-tigre.overpass.json"));
const output = resolve(root, flag("out", "src/world/data/delta-real.world.json"));
const metersPerUnit = Number(flag("scale", String(DEFAULT_OPTIONS.metersPerUnit)));
const size = Number(flag("size", "2800"));
const originFlag = flag("origin", "");
const origin = originFlag ? { lat: Number(originFlag.split(",")[0]), lon: Number(originFlag.split(",")[1]) } : undefined;

const overpass = JSON.parse(readFileSync(input, "utf8")) as { elements: OverpassElement[] };
// Waterways missing from the downloaded extract, taken from OSM itself
// (scripts/osm/supplements/*.overpass.json, each with its source)
const supplementDir = resolve(root, "scripts/osm/supplements");
const known = new Set(overpass.elements.map((e) => `${e.type}/${e.id}`));
for (const file of readdirSync(supplementDir).filter((f) => f.endsWith(".overpass.json"))) {
  const extra = JSON.parse(readFileSync(resolve(supplementDir, file), "utf8")) as { elements: OverpassElement[] };
  for (const e of extra.elements) if (!known.has(`${e.type}/${e.id}`)) overpass.elements.push(e);
}
const base = parseWorld(JSON.parse(readFileSync(resolve(root, "src/world/data/delta.world.json"), "utf8")));

// Typo fixes for OSM names (documented sources in the file)
setNameFixes(JSON.parse(readFileSync(resolve(root, "scripts/osm/name-fixes.json"), "utf8")));
const { world, report } = osmToWorld(
  overpass.elements,
  base,
  { id: flag("id", "delta-tigre-real"), name: flag("name", "Delta de Tigre (OpenStreetMap)"), size },
  { ...DEFAULT_OPTIONS, metersPerUnit, origin, includeUnnamed: args.includes("--unnamed") }
);

const json = JSON.stringify(world, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, "[$1, $2]");
writeFileSync(output, json + "\n");
console.log(
  `World written to ${output}\n` +
    `  rivers: ${report.rivers} · docks: ${report.docks} (${report.terminals} real terminals) · ` +
    `water areas: ${report.waterAreas} (${report.waterAreaVertices} vertices) · ` +
    `dropped unnamed: ${report.droppedUnnamed} · dropped short: ${report.droppedShort}`
);
