/// <reference types="vite/client" />
import { parseWorld, type WorldDoc } from "./WorldDoc";

const worlds = import.meta.glob<{ default: unknown }>("./data/*.world.json", { eager: true });
const DEFAULT_WORLD = "delta";

/** File name (without `.world.json`) of every world bundled with the game. */
export function availableWorlds(): string[] {
  return Object.keys(worlds).map((path) => path.replace("./data/", "").replace(".world.json", ""));
}

/**
 * Loads and validates the world named by `?world=<name>` in the URL
 * (e.g. `?world=delta-real`), or the default Delta.
 */
export function loadWorldFromUrl(search: string = window.location.search): WorldDoc {
  const requested = new URLSearchParams(search).get("world") ?? DEFAULT_WORLD;
  const mod = worlds[`./data/${requested}.world.json`];
  if (!mod) {
    console.warn(`World "${requested}" not found. Available: ${availableWorlds().join(", ")}`);
    return parseWorld(worlds[`./data/${DEFAULT_WORLD}.world.json`].default);
  }
  return parseWorld(mod.default);
}
