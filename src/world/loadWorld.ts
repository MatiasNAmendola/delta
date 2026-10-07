/// <reference types="vite/client" />
import { parseWorld, type WorldDoc } from "./WorldDoc";

// Lazy: each world is its own chunk, downloaded only when chosen
const worlds = import.meta.glob<{ default: unknown }>("./data/*.world.json");

/** The real Delta (OpenStreetMap). The hand-drawn proof of concept stays available as `?world=delta`. */
const DEFAULT_WORLD = "delta-real";

/** File name (without `.world.json`) of every world bundled with the game. */
export function availableWorlds(): string[] {
  return Object.keys(worlds).map((path) => path.replace("./data/", "").replace(".world.json", ""));
}

/**
 * Loads and validates the world named by `?world=<name>` in the URL
 * (e.g. `?world=delta` for the original proof of concept), or the real Delta.
 */
export async function loadWorldFromUrl(search: string = window.location.search): Promise<WorldDoc> {
  const requested = new URLSearchParams(search).get("world") ?? DEFAULT_WORLD;
  let load = worlds[`./data/${requested}.world.json`];
  if (!load) {
    console.warn(`World "${requested}" not found. Available: ${availableWorlds().join(", ")}`);
    load = worlds[`./data/${DEFAULT_WORLD}.world.json`];
  }
  return parseWorld((await load()).default);
}
