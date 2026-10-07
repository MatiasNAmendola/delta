// Engine tuning constants. World content and game rules live in the World Doc
// (src/world/data/*.world.json), not here.
export const WATER_LEVEL = 0;

// Boat
export const BOAT_MAX_SPEED = 0.35;
export const BOAT_ACCELERATION = 0.008;
export const BOAT_DECELERATION = 0.004;
export const BOAT_TURN_SPEED = 0.025;
export const BOAT_LENGTH = 6;
export const BOAT_WIDTH = 2;

// Camera
export const CAMERA_HEIGHT = 12;
export const CAMERA_DISTANCE = 18;
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
