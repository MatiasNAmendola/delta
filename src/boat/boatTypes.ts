/**
 * The boats you can take out on the Delta. Each one handles differently and
 * plays a different game, with the navigation rules that apply to it.
 *
 * Sizes are world units (8 m each). Speeds are world units per 60 fps
 * frame: faster than real (trips must fit a few minutes) but in proportion
 * to each other.
 */
export type BoatTypeId = "colectiva" | "travesia" | "kayak" | "open";

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
    wake: 1,
    camera: { distance: 8, height: 2.3 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 3, maniobra: 2, olas: 4 },
  },
  travesia: {
    id: "travesia",
    name: "Bote de travesía",
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
    wake: 0.15,
    camera: { distance: 4.5, height: 1.3 },
    rules: ["keepRight", "takeWakeBowFirst", "hugTheBank"],
    stats: { velocidad: 2, maniobra: 2, olas: 1 },
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
    wake: 0.05,
    camera: { distance: 3, height: 1 },
    rules: ["takeWakeBowFirst", "hugTheBank"],
    stats: { velocidad: 1, maniobra: 5, olas: 1 },
  },
  open: {
    id: "open",
    name: "Lancha open",
    tagline: "Casco de fibra y fuera de borda",
    mission: "Contrarreloj de muelle en muelle, sin multas",
    length: 0.8,
    width: 0.3,
    maxSpeed: 0.32,
    acceleration: 0.008,
    deceleration: 0.003,
    turnSpeed: 0.045,
    turnsInPlace: false,
    reverse: 0.25,
    humanPowered: false,
    wake: 0.7,
    camera: { distance: 3.6, height: 1.15 },
    rules: ["keepRight", "speedZones", "wakeCourtesy"],
    stats: { velocidad: 5, maniobra: 4, olas: 3 },
  },
};

export const BOAT_ORDER: BoatTypeId[] = ["colectiva", "travesia", "kayak", "open"];

export function isBoatType(value: unknown): value is BoatTypeId {
  return typeof value === "string" && value in BOAT_TYPES;
}
