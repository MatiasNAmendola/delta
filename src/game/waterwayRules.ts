/**
 * Rules that depend on WHICH river or arroyo you are on and WHAT boat you
 * drive (docs/investigacion/03-reglas-de-navegacion.md and
 * 03-restricciones-vias.json, reviewed by a judge). Each rule keeps its
 * source and how sure we are of it; the user's own recollections are game
 * rules until a regulation confirms them.
 */
import type { BoatSpec } from "../boat/boatTypes";

export type Family = "colectiva" | "particular" | "moto" | "kayak" | "remo";

export function familyOf(spec: BoatSpec): Family {
  if (spec.id === "colectiva") return "colectiva";
  if (spec.id === "moto") return "moto";
  if (spec.id === "kayak") return "kayak";
  if (spec.propulsion === "remo") return "remo";
  return "particular";
}

export type WaterwayRuleKind = "sin_ola" | "prioridad_remo" | "prohibido";
export type Confidence = "confirmado" | "probable" | "regla_del_juego";

export interface WaterwayRule {
  via: string;
  kind: WaterwayRuleKind;
  applies: Family[];
  /** Points lost per fine. */
  penalty: number;
  confidence: Confidence;
  source: string;
}

const MOTOR: Family[] = ["colectiva", "particular", "moto"];
const DISP_2015 = "Disposición PZDE RI.7 Nº 02/2015 (Prefectura Zona Delta): navegar a la velocidad mínima que no genere ola";
const REMO = "Zonas de remo y SUP de la Primera Sección (docs/investigacion/03)";

export const WATERWAY_RULES: WaterwayRule[] = [
  ...["Río Luján", "Río Sarmiento", "Río Carapachay", "Arroyo Caraguatá", "Arroyo Dorado", "Arroyo Pajarito", "Arroyo Abra Vieja"].map(
    (via): WaterwayRule => ({ via, kind: "sin_ola", applies: MOTOR, penalty: 50, confidence: "confirmado", source: DISP_2015 })
  ),
  ...["Río Tigre", "Canal Aliviador", "Arroyo Abra Vieja", "Río Sarmiento", "Arroyo Caraguatá", "Arroyo Rama Negra"].map(
    (via): WaterwayRule => ({ via, kind: "prioridad_remo", applies: MOTOR, penalty: 30, confidence: "probable", source: REMO })
  ),
  // The user's rules for the Gambado: only small boats, respecting rowers and kayaks.
  // No regulation found (the judge: it is a usual rowing/kayak route); kept as a game rule.
  { via: "Arroyo Gambado", kind: "prohibido", applies: ["colectiva"], penalty: 300, confidence: "regla_del_juego", source: "Regla del juego (recuerdo de un vecino del Delta)" },
  { via: "Arroyo Gambado", kind: "prohibido", applies: ["particular", "moto"], penalty: 80, confidence: "regla_del_juego", source: "Regla del juego (recuerdo de un vecino del Delta)" },
  { via: "Arroyo Gambado", kind: "prioridad_remo", applies: MOTOR, penalty: 40, confidence: "regla_del_juego", source: "Regla del juego" },
];

/**
 * Narrowest channel each kind of boat can use (m). Estimates for the game:
 * a ~15-18 m lancha colectiva needs room to meet another boat and turn.
 */
export const MIN_CHANNEL_M: Record<Family, number> = { colectiva: 14, particular: 5, moto: 4, kayak: 1.5, remo: 5 };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The rules on this river for this kind of boat. */
export function rulesAt(via: string | null, family: Family): WaterwayRule[] {
  if (!via) return [];
  const n = norm(via);
  return WATERWAY_RULES.filter((r) => norm(r.via) === n && r.applies.includes(family));
}

export function tooNarrow(widthMeters: number, family: Family): boolean {
  return widthMeters < MIN_CHANNEL_M[family];
}

/**
 * Real width (m) of a river or arroyo, when we know it. OSM rarely tags
 * widths in the Delta; until they are measured (satellite) the importer's
 * estimate by name is used, which no boat of the game fails.
 */
export const KNOWN_WIDTH_M: Record<string, number> = {};

export function realWidthM(name: string): number {
  const known = KNOWN_WIDTH_M[norm(name)];
  if (known) return known;
  if (/^r[ií]o paran[aá]/i.test(name)) return 600;
  if (/^(arroyo|aguaje|zanja)\b/i.test(name)) return 35;
  if (/^(canal|pasaje)\b/i.test(name)) return 40;
  if (/^r[ií]o\b/i.test(name)) return 150;
  return 30;
}

/**
 * "Sin ola": the no-wake rule is about the wave you make, so it is judged
 * by the wake's height (wakePhysics.ts). Design thresholds (m): above them
 * the wave reaches the banks and rowers with some force (doc 04 cites
 * damage from ~0.3 m in the Delta, unverified).
 */
export const NO_WAKE_M = 0.25;
export const ROWING_ZONE_WAKE_M = 0.18;
