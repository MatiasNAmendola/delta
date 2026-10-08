/// <reference types="vite/client" />
import { parseWorld, type WorldDoc } from "./WorldDoc";

// Lazy: each world is its own chunk, downloaded only when chosen
const worlds = import.meta.glob<{ default: unknown }>("./data/*.world.json");

/** The real Delta (OpenStreetMap). The hand-drawn proof of concept stays available as `?world=delta`. */
const DEFAULT_WORLD = "delta-real";

/** The sections of the Delta you can sail, in menu order (file name -> label). */
export const ZONES: Array<{ id: string; label: string }> = [
  { id: "delta-real", label: "Tigre · Primera Sección" },
  { id: "delta-segunda", label: "San Fernando · Segunda Sección" },
  { id: "delta-guazu", label: "Paraná Guazú · Tercera Sección" },
  { id: "delta-escobar", label: "Escobar · Paraná de las Palmas" },
];

const ZONE_KEY = "delta.world";

/** The zone chosen in the menu, remembered for the next visit. */
export function chooseZone(id: string): void {
  try {
    localStorage.setItem(ZONE_KEY, id);
  } catch {
    // Private mode: the URL still carries it
  }
  const url = new URL(window.location.href);
  url.searchParams.set("world", id);
  window.location.assign(url.toString());
}

/** File name (without `.world.json`) of every world bundled with the game. */
export function availableWorlds(): string[] {
  return Object.keys(worlds).map((path) => path.replace("./data/", "").replace(".world.json", ""));
}

/**
 * Loads and validates the world named by `?world=<name>` in the URL
 * (e.g. `?world=delta` for the original proof of concept), or the real Delta.
 */
export async function loadWorldFromUrl(search: string = window.location.search): Promise<WorldDoc> {
  const requested = new URLSearchParams(search).get("world") ?? savedZone() ?? DEFAULT_WORLD;
  let load = worlds[`./data/${requested}.world.json`];
  if (!load) {
    console.warn(`World "${requested}" not found. Available: ${availableWorlds().join(", ")}`);
    load = worlds[`./data/${DEFAULT_WORLD}.world.json`];
  }
  return parseWorld((await load()).default);
}

/** The world file currently requested (URL, then the remembered zone). */
export function currentZone(search: string = window.location.search): string {
  const id = new URLSearchParams(search).get("world") ?? savedZone() ?? DEFAULT_WORLD;
  return worlds[`./data/${id}.world.json`] ? id : DEFAULT_WORLD;
}

function savedZone(): string | null {
  try {
    const id = localStorage.getItem(ZONE_KEY);
    return id && worlds[`./data/${id}.world.json`] ? id : null;
  } catch {
    return null;
  }
}
