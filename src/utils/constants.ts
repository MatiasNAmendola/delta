// Game constants
export const WORLD_SIZE = 800;
export const RIVER_WIDTH = 18;
export const RIVER_DEPTH = 3;
export const WATER_LEVEL = 0;

// Boat
export const BOAT_MAX_SPEED = 0.35;
export const BOAT_ACCELERATION = 0.008;
export const BOAT_DECELERATION = 0.004;
export const BOAT_TURN_SPEED = 0.025;
export const BOAT_LENGTH = 6;
export const BOAT_WIDTH = 2;

// Camera
export const CAMERA_HEIGHT = 4.5;
export const CAMERA_DISTANCE = 14;
export const CAMERA_LERP = 0.06;

// Game mechanics
export const MAX_PASSENGERS = 20;
export const PICKUP_RADIUS = 8;
export const SCORE_PER_PASSENGER = 100;
export const TIME_BONUS = 50;
export const GAME_DURATION = 300; // 5 minutes

// Voxel style
export const VOXEL_SCALE = 1;

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
  willowLeaf: "#3a7a2a",
  willowLeafLight: "#4a9a3a",
  poplarLeaf: "#2a6e20",
  poplarLeafDark: "#1e5518",
  reed: "#6a8a3a",
  reedDark: "#5a7a2a",
  bush: "#2a7a22",
  bushDark: "#1a5a15",
  sky: "#87ceeb",
  boatHull: "#654321",
  boatDeck: "#deb887",
  boatCabin: "#a0522d",
  boatRoof: "#f5f5dc",
  boatTrim: "#1a3a6a",
  white: "#ffffff",
  flag: "#75aadb", // Argentine celeste
};

// River map definition - approximate Delta de Tigre layout
export interface RiverSegment {
  points: [number, number][];
  width: number;
  name: string;
}

export const RIVER_MAP: RiverSegment[] = [
  // Río Luján - main river flowing horizontally through center
  {
    name: "Río Luján",
    width: 28,
    points: [
      [-400, 0],
      [-300, 10],
      [-200, -5],
      [-100, 15],
      [0, 5],
      [100, -10],
      [200, 5],
      [300, -5],
      [400, 0],
    ],
  },
  // Río Tigre - branches north from Luján
  {
    name: "Río Tigre",
    width: 20,
    points: [
      [-50, 10],
      [-60, 60],
      [-40, 120],
      [-55, 180],
      [-30, 240],
      [-45, 300],
      [-20, 370],
    ],
  },
  // Río Sarmiento - branches northwest
  {
    name: "Río Sarmiento",
    width: 18,
    points: [
      [-200, -5],
      [-220, 50],
      [-250, 110],
      [-230, 170],
      [-260, 230],
      [-240, 290],
      [-270, 350],
    ],
  },
  // Río Capitán - branches south from Luján
  {
    name: "Río Capitán",
    width: 16,
    points: [
      [100, -10],
      [110, -70],
      [90, -130],
      [120, -190],
      [95, -250],
      [115, -310],
    ],
  },
  // Río San Antonio - branches northeast
  {
    name: "Río San Antonio",
    width: 16,
    points: [
      [200, 5],
      [220, 60],
      [250, 120],
      [230, 180],
      [260, 240],
      [240, 300],
    ],
  },
  // Arroyo Abra Vieja - small channel connecting Tigre and Sarmiento
  {
    name: "Arroyo Abra Vieja",
    width: 12,
    points: [
      [-55, 180],
      [-100, 185],
      [-150, 175],
      [-230, 170],
    ],
  },
  // Canal de la Sección - connecting south rivers
  {
    name: "Canal de la Sección",
    width: 12,
    points: [
      [0, -80],
      [30, -90],
      [60, -100],
      [90, -130],
    ],
  },
  // Río Reconquista - southern branch
  {
    name: "Río Reconquista",
    width: 22,
    points: [
      [-300, 10],
      [-280, -50],
      [-310, -110],
      [-290, -170],
      [-320, -230],
      [-300, -290],
    ],
  },
  // Arroyo Espera - small connecting channel
  {
    name: "Arroyo Espera",
    width: 10,
    points: [
      [-40, 120],
      [10, 130],
      [60, 115],
      [100, 120],
      [150, 110],
      [220, 120],
    ],
  },
  // Río Carapachay - northern branch
  {
    name: "Río Carapachay",
    width: 15,
    points: [
      [-100, 15],
      [-80, 70],
      [-110, 130],
      [-90, 190],
      [-120, 250],
    ],
  },
];

// Dock/stop locations
export interface DockLocation {
  x: number;
  z: number;
  name: string;
  rotation: number; // facing angle
}

export const DOCK_LOCATIONS: DockLocation[] = [
  { x: -300, z: 10, name: "Estación Fluvial Tigre", rotation: 0 },
  { x: -50, z: 10, name: "Tres Bocas", rotation: Math.PI / 2 },
  { x: -60, z: 60, name: "Río Tigre Norte", rotation: 0 },
  { x: -220, z: 50, name: "Sarmiento Sur", rotation: Math.PI },
  { x: 200, z: 5, name: "San Antonio", rotation: 0 },
  { x: -40, z: 120, name: "Arroyo Espera", rotation: Math.PI / 4 },
  { x: 100, z: -10, name: "Capitán Sur", rotation: -Math.PI / 2 },
  { x: -250, z: 110, name: "Sarmiento Centro", rotation: Math.PI / 3 },
  { x: -30, z: 240, name: "Tigre Alto", rotation: 0 },
  { x: 110, z: -70, name: "Capitán Norte", rotation: Math.PI },
  { x: -280, z: -50, name: "Reconquista", rotation: -Math.PI / 4 },
  { x: 250, z: 120, name: "San Antonio Arriba", rotation: Math.PI / 2 },
  { x: -55, z: 180, name: "Abra Vieja", rotation: 0 },
  { x: -90, z: 190, name: "Carapachay", rotation: Math.PI / 6 },
  { x: 0, z: 5, name: "Centro Delta", rotation: 0 },
];
