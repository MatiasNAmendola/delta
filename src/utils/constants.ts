// Engine tuning constants. World content and game rules live in the World Doc
// (src/world/data/*.world.json), not here.
export const WATER_LEVEL = 0;

/**
 * World scale: the real map is 8 m per unit. Props (docks, houses, trees,
 * yolas, grass, banks, wake) were designed about 3.5 times too big for it
 * (the lancha came out 56 m long and filled a third of the Río Tigre).
 * Design sizes in their code are multiplied by this to get real sizes.
 */
export const PROP_SCALE = 2 / 7;

// Boat: a lancha colectiva is ~16 m long and ~5 m wide
export const BOAT_LENGTH = 2;
export const BOAT_WIDTH = 0.63;
/** World units per 60 fps frame. Faster than real (a game must keep trips short), but at boat scale. */
export const BOAT_MAX_SPEED = 0.17;
export const BOAT_ACCELERATION = 0.004;
export const BOAT_DECELERATION = 0.002;
export const BOAT_TURN_SPEED = 0.03;

// Camera (chase camera behind and above the boat)
export const CAMERA_HEIGHT = 2.3;
export const CAMERA_DISTANCE = 8;
export const CAMERA_LERP = 0.05;

// Colors (Minecraft/Roblox style)
export const COLORS = {
  water: "#2d7a5f",
  waterDeep: "#1a5a3f",
  grass: "#5da845",
  grassDark: "#4a8a35",
  dirt: "#8b6914",
  sand: "#d4b96a",
  wood: "#8b4513",
  woodDark: "#654321",
  woodLight: "#a0522d",
  roof: "#c41e3a",
  roofBlue: "#2a5aaa",
  dock: "#6b4e2a",
  leaves: "#2d8a2d",
  leavesDark: "#1a6a1a",
  leavesLight: "#45aa45",
  sky: "#87ceeb",
  boatHull: "#654321",
  boatDeck: "#deb887",
  boatCabin: "#a0522d",
  boatRoof: "#f5f5dc",
  boatTrim: "#1a3a6a",
  white: "#ffffff",
  flag: "#75aadb", // Argentine celeste
};
