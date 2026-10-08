/**
 * The season in the Delta by the real date (southern hemisphere), or
 * forced with ?estacion=primavera|verano|otono|invierno. Sets how the
 * vegetation looks (docs/investigacion/11): fresh greens and flowering
 * santa ritas, ceibos and jacarandás in spring; yellow poplars and willows
 * in autumn; bare poplars in winter.
 */
export type Season = "primavera" | "verano" | "otono" | "invierno";

export function seasonFor(date = new Date(), search = typeof window !== "undefined" ? window.location.search : ""): Season {
  const forced = new URLSearchParams(search).get("estacion");
  if (forced === "primavera" || forced === "verano" || forced === "otono" || forced === "invierno") return forced;
  const m = date.getMonth() + 1; // 1..12
  if (m >= 9 && m <= 11) return "primavera";
  if (m === 12 || m <= 2) return "verano";
  if (m >= 3 && m <= 5) return "otono";
  return "invierno";
}

export type Rgb = [number, number, number];

/**
 * Leaf tint of one tree for the season (multiplies its base color), from a
 * per-tree random r in 0..1. null: no leaves (bare branches).
 */
export function leafTint(species: string, season: Season, r: number): Rgb | null {
  const deciduous = species === "alamo" || species === "sauce" || species === "fronda";
  switch (season) {
    case "primavera":
      // New leaves, brighter (flowers: the santa ritas in the gardens)
      return species === "casuarina" ? [1, 1.02, 0.98] : [1.05, 1.12, 0.9];
    case "verano":
      return species === "casuarina" ? [0.95, 0.95, 0.95] : [0.9, 0.95, 0.88];
    case "otono":
      if (!deciduous) return [0.95, 0.93, 0.85];
      // Yellows and oranges, some still green
      if (r < 0.2) return [0.95, 0.95, 0.85];
      if (r < 0.65) return [1.55, 1.25, 0.35];
      return [1.6, 0.95, 0.35];
    case "invierno":
      if (species === "alamo" && r < 0.85) return null;
      if (species === "fronda" && r < 0.45) return null;
      if (species === "sauce") return [1.2, 1.1, 0.55];
      return deciduous ? [1.1, 1.0, 0.7] : [0.88, 0.9, 0.85];
  }
}

/** Gardens flower (santa rita) in spring and summer. */
export function gardensInFlower(season: Season): boolean {
  return season === "primavera" || season === "verano";
}
