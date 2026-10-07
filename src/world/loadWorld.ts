import deltaWorld from "./data/delta.world.json";
import { parseWorld, type WorldDoc } from "./WorldDoc";

/** The world that ships with the game, validated at startup. */
export function loadDefaultWorld(): WorldDoc {
  return parseWorld(deltaWorld);
}
