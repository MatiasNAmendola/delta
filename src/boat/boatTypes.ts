/**
 * The boats you can take out on the Delta. Each one handles differently and
 * plays a different game, with the navigation rules that apply to it.
 *
 * Sizes are world units (8 m each). Speeds are world units per 60 fps
 * frame: faster than real (trips must fit a few minutes) but in proportion
 * to each other.
 */
import type { HullType } from "./buoyancy";
import type { WakeRibbonOptions } from "../world/WakeRibbon";
import { METERS_PER_UNIT } from "../utils/constants";

export type BoatTypeId = "colectiva" | "travesia" | "single" | "kayak" | PrivateBoatId;

/** Boats that share one tab on the start screen. */
export type BoatFamily = "remo" | "particular";

/** The private launches ("lanchas particulares") of the Delta. */
export type PrivateBoatId = "runabout" | "pesca" | "clasica" | "semirrigido" | "moto";

export type RuleId =
  /** Keep to the starboard half of the channel (Prefectura: navegar por la derecha). */
  | "keepRight"
  /** Reduced speed in arroyos and in front of docks. */
  | "speedZones"
  /** Slow down near rowers and kayaks: your wake swamps them. */
  | "wakeCourtesy"
  /** Small craft: take a passing lancha's wake bow-first, never broadside. */
  | "takeWakeBowFirst"
  /** Small craft on big rivers: stay near the bank, cross straight across. */
  | "hugTheBank";

export interface BoatSpec {
  id: BoatTypeId;
  name: string;
  /** Short name for the variant chips of a family. */
  short?: string;
  /** Boats of a family share one tab on the start screen. */
  family?: BoatFamily;
  tagline: string;
  /** What you do with it (shown on the selection card). */
  mission: string;
  length: number;
  width: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  turnSpeed: number;
  /** Paddled/rowed boats can pivot almost in place. */
  turnsInPlace: boolean;
  /** Fraction of top speed available in reverse. */
  reverse: number;
  /** Rowed/paddled: effort drains energy, gliding recovers it. */
  humanPowered: boolean;
  /** Displacement hulls push through the water; planing hulls ride on it at speed. */
  hull: HullType;
  /**
   * Seconds its weight keeps it gliding in neutral at low speed (drag grows
   * with speed, so from full speed most of the way goes quickly, then it
   * glides): a loaded lancha colectiva glides long, a jet ski stops short. It also sets how long it takes to pick up the
   * river's current once the engine is off (Boat.ts, docs/adr/0009).
   */
  coastTime: number;
  /** Real top speed (m/s): sets the wake's wavelengths and Froude number (wakePhysics.ts). */
  realSpeed: number;
  /** What pushes it: the turbulent wake behind (white wash, jet, or paddle swirls). */
  propulsion: "helice" | "turbina" | "remo" | "pala";
  /** How big a wake it throws (1 = lancha colectiva). */
  wake: number;
  camera: { distance: number; height: number };
  rules: RuleId[];
  /** Stats for the selection card, 1-5. */
  stats: { velocidad: number; maniobra: number; olas: number };
}

export const BOAT_TYPES: Record<BoatTypeId, BoatSpec> = {
  colectiva: {
    id: "colectiva",
    name: "Lancha colectiva",
    tagline: "La de madera barnizada que conecta las islas",
    mission: "Llevá pasajeros entre los muelles",
    length: 2,
    width: 0.63,
    maxSpeed: 0.17,
    acceleration: 0.004,
    deceleration: 0.002,
    turnSpeed: 0.03,
    turnsInPlace: false,
    reverse: 0.3,
    humanPowered: false,
    hull: "displacement",
    coastTime: 4,
    realSpeed: 5.1,
    propulsion: "helice",
    wake: 1,
    camera: { distance: 8, height: 2.3 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 3, maniobra: 2, olas: 4 },
  },
  travesia: {
    id: "travesia",
    name: "Bote de travesía",
    short: "Travesía",
    family: "remo",
    tagline: "Cuatro remeros y timonel, de club en club",
    mission: "Hacé la travesía pasando por las boyas",
    length: 1.3,
    width: 0.24,
    maxSpeed: 0.09,
    acceleration: 0.0022,
    deceleration: 0.0012,
    turnSpeed: 0.022,
    turnsInPlace: false,
    reverse: 0.35,
    humanPowered: true,
    hull: "displacement",
    coastTime: 3.5,
    realSpeed: 3.5,
    propulsion: "remo",
    wake: 0.15,
    camera: { distance: 4.5, height: 1.3 },
    rules: ["keepRight", "takeWakeBowFirst", "hugTheBank"],
    stats: { velocidad: 2, maniobra: 2, olas: 1 },
  },
  single: {
    id: "single",
    name: "Single de regata",
    short: "Regata",
    family: "remo",
    tagline: "Un remero, dos remos y un casco finito como una aguja",
    mission: "Corré las regatas de los clubes: 2000 metros por andarivel",
    // A real 1x is 8.2 m long and 0.3 m wide; a touch wider to be seen
    length: 1.03,
    width: 0.06,
    maxSpeed: 0.1,
    acceleration: 0.0026,
    deceleration: 0.0011,
    turnSpeed: 0.016,
    turnsInPlace: false,
    reverse: 0.3,
    humanPowered: true,
    hull: "displacement",
    coastTime: 4.5,
    realSpeed: 5.0,
    propulsion: "remo",
    wake: 0.04,
    camera: { distance: 3.2, height: 1 },
    rules: ["takeWakeBowFirst"],
    stats: { velocidad: 3, maniobra: 1, olas: 1 },
  },
  kayak: {
    id: "kayak",
    name: "Kayak",
    tagline: "Se mete por los arroyos más angostos",
    mission: "Explorá los arroyos y encontrá sus rincones",
    length: 0.62,
    width: 0.1,
    maxSpeed: 0.07,
    acceleration: 0.003,
    deceleration: 0.0022,
    turnSpeed: 0.06,
    turnsInPlace: true,
    reverse: 0.5,
    humanPowered: true,
    hull: "displacement",
    coastTime: 3,
    realSpeed: 2.2,
    propulsion: "pala",
    wake: 0.05,
    camera: { distance: 3, height: 1 },
    rules: ["takeWakeBowFirst", "hugTheBank"],
    stats: { velocidad: 1, maniobra: 5, olas: 1 },
  },
  runabout: {
    id: "runabout",
    name: "Lancha de paseo",
    short: "Paseo",
    family: "particular",
    tagline: "Fibra de vidrio y fuera de borda, la de los fines de semana en la isla",
    mission: "Contrarreloj de muelle en muelle, sin multas",
    length: 0.72,
    width: 0.28,
    maxSpeed: 0.3,
    acceleration: 0.007,
    deceleration: 0.003,
    turnSpeed: 0.045,
    turnsInPlace: false,
    reverse: 0.25,
    humanPowered: false,
    hull: "planing",
    coastTime: 2,
    realSpeed: 15,
    propulsion: "helice",
    wake: 0.75,
    camera: { distance: 3.4, height: 1.1 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 4, maniobra: 3, olas: 4 },
  },
  pesca: {
    id: "pesca",
    name: "Bote de pesca",
    short: "Pesca",
    family: "particular",
    tagline: "Aluminio y un fuera de borda chico: cala poco y entra en cualquier arroyo",
    mission: "Recorré los arroyos buscando los rincones de pesca",
    length: 0.56,
    width: 0.2,
    maxSpeed: 0.19,
    acceleration: 0.005,
    deceleration: 0.0032,
    turnSpeed: 0.055,
    turnsInPlace: false,
    reverse: 0.35,
    humanPowered: false,
    hull: "displacement",
    coastTime: 2.6,
    realSpeed: 8,
    propulsion: "helice",
    wake: 0.25,
    camera: { distance: 3, height: 1 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 2, maniobra: 4, olas: 1 },
  },
  clasica: {
    id: "clasica",
    name: "Lancha clásica",
    short: "Clásica",
    family: "particular",
    tagline: "Caoba barnizada y motor dentro de borda, de las que se lucen en el Luján",
    mission: "Contrarreloj de muelle en muelle, sin multas",
    length: 0.94,
    width: 0.29,
    maxSpeed: 0.28,
    acceleration: 0.005,
    deceleration: 0.0025,
    turnSpeed: 0.034,
    turnsInPlace: false,
    reverse: 0.2,
    humanPowered: false,
    hull: "planing",
    coastTime: 2.8,
    realSpeed: 13,
    propulsion: "helice",
    wake: 0.9,
    camera: { distance: 4, height: 1.25 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 4, maniobra: 2, olas: 5 },
  },
  semirrigido: {
    id: "semirrigido",
    name: "Semirrígido",
    short: "Gomón",
    family: "particular",
    tagline: "Tubos inflables y casco de fibra: estable, rápido y gira cerrado",
    mission: "Contrarreloj de muelle en muelle, sin multas",
    length: 0.62,
    width: 0.27,
    maxSpeed: 0.33,
    acceleration: 0.009,
    deceleration: 0.0035,
    turnSpeed: 0.055,
    turnsInPlace: false,
    reverse: 0.25,
    humanPowered: false,
    hull: "planing",
    coastTime: 1.8,
    realSpeed: 16,
    propulsion: "helice",
    wake: 0.6,
    camera: { distance: 3.2, height: 1.05 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 5, maniobra: 4, olas: 3 },
  },
  moto: {
    id: "moto",
    name: "Moto de agua",
    short: "Moto",
    family: "particular",
    tagline: "Turbina y manubrio: sin acelerar no dobla. Prohibida de noche",
    mission: "Contrarreloj de muelle en muelle, sin multas",
    length: 0.38,
    width: 0.15,
    maxSpeed: 0.38,
    acceleration: 0.012,
    deceleration: 0.004,
    turnSpeed: 0.075,
    turnsInPlace: false,
    reverse: 0.15,
    humanPowered: false,
    hull: "planing",
    coastTime: 1.2,
    realSpeed: 22,
    propulsion: "turbina",
    wake: 0.6,
    camera: { distance: 2.4, height: 0.85 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 5, maniobra: 5, olas: 2 },
  },
};

export const BOAT_ORDER: BoatTypeId[] = ["colectiva", "travesia", "single", "kayak", "runabout", "pesca", "clasica", "semirrigido", "moto"];

/** The private launches, in the order of their chips. */
export const PRIVATE_BOATS: PrivateBoatId[] = ["runabout", "pesca", "clasica", "semirrigido", "moto"];

/** The boats of each family, in the order of their chips. */
export const FAMILIES: Record<BoatFamily, { label: string; boats: BoatTypeId[] }> = {
  remo: { label: "Remo de club", boats: ["travesia", "single"] },
  particular: { label: "Lancha particular", boats: PRIVATE_BOATS },
};

export function isBoatType(value: unknown): value is BoatTypeId {
  return typeof value === "string" && value in BOAT_TYPES;
}

/** A boat id from the URL or storage; the old "open" became the lancha de paseo. */
export function parseBoatType(value: unknown): BoatTypeId | null {
  if (value === "open") return "runabout";
  return isBoatType(value) ? value : null;
}

/** The physical wake of a boat (WakeRibbon): sizes in metres, real speed. */
export function wakeOptions(spec: BoatSpec): WakeRibbonOptions {
  return {
    length: spec.length * METERS_PER_UNIT,
    beam: spec.width * METERS_PER_UNIT,
    hull: spec.hull,
    topSpeed: spec.realSpeed,
    // Wave height at top speed: 35 cm for the lancha colectiva, scaled by its
    // wake rating; even a kayak raises a few centimetres
    height: Math.max(0.04, 0.35 * spec.wake),
    propulsion: spec.propulsion,
  };
}
