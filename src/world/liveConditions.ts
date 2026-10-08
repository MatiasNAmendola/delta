/**
 * Today's real river and weather (ADR 0008, docs/investigacion/06):
 * - River height at San Fernando (Río Luján), measured by Prefectura and
 *   published by the INA's a5 API (series 52, every hour or so), with the
 *   official alert (3.00 m) and evacuation (3.50 m) levels.
 * - Wind from Open-Meteo (CC BY 4.0, free for non-commercial use).
 * Both answer browsers directly (CORS *). Cached for 20 minutes; if they
 * fail the game simulates as before.
 */
export interface LiveConditions {
  /** Height (m) at San Fernando, when it was measured, and the trend over the last hours. */
  height: number | null;
  measuredAt: string | null;
  rising: boolean | null;
  /** Wind: speed and gusts (km/h), direction it comes FROM (degrees, meteorological). */
  windSpeed: number | null;
  windGusts: number | null;
  windFrom: number | null;
  fetchedAt: number;
}

export const SAN_FERNANDO_ALERT = 3.0;
export const SAN_FERNANDO_EVACUATION = 3.5;
export const SAN_FERNANDO_LOW = 0.33;
/** A usual height there (m): the game's base water level. */
export const SAN_FERNANDO_USUAL = 1.1;

const INA = "https://alerta.ina.gob.ar/a5/obs/puntual/series/52/observaciones";
const METEO = "https://api.open-meteo.com/v1/forecast?latitude=-34.42&longitude=-58.58&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=America/Argentina/Buenos_Aires";
const CACHE_KEY = "delta.live";
const CACHE_MS = 20 * 60 * 1000;

async function getJson(url: string, ms = 6000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the INA observations: the last value and whether it rose over the last ~3 hours. */
export function parseRiver(rows: unknown): { height: number; at: string; rising: boolean } | null {
  if (!Array.isArray(rows)) return null;
  const obs = rows
    .map((r) => ({ t: Date.parse((r as { timestart?: string }).timestart ?? ""), v: Number((r as { valor?: unknown }).valor) }))
    .filter((o) => Number.isFinite(o.t) && Number.isFinite(o.v))
    .sort((a, b) => a.t - b.t);
  if (!obs.length) return null;
  const last = obs[obs.length - 1];
  const before = [...obs].reverse().find((o) => last.t - o.t >= 2.5 * 3600 * 1000) ?? obs[0];
  return { height: last.v, at: new Date(last.t).toISOString(), rising: last.v >= before.v };
}

export async function fetchLiveConditions(now = Date.now()): Promise<LiveConditions | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as LiveConditions | null;
    if (cached && now - cached.fetchedAt < CACHE_MS) return cached;
  } catch {
    // No storage: just fetch
  }
  const from = new Date(now - 30 * 3600 * 1000).toISOString();
  const to = new Date(now + 3600 * 1000).toISOString();
  const [river, meteo] = await Promise.allSettled([
    getJson(`${INA}?timestart=${from}&timeend=${to}&format=json`),
    getJson(METEO),
  ]);
  const r = river.status === "fulfilled" ? parseRiver(river.value) : null;
  const c = meteo.status === "fulfilled" ? (meteo.value as { current?: Record<string, number> }).current : undefined;
  if (!r && !c) return null;
  const live: LiveConditions = {
    height: r?.height ?? null,
    measuredAt: r?.at ?? null,
    rising: r?.rising ?? null,
    windSpeed: c?.wind_speed_10m ?? null,
    windGusts: c?.wind_gusts_10m ?? null,
    windFrom: c?.wind_direction_10m ?? null,
    fetchedAt: now,
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(live));
  } catch {
    // Fine without cache
  }
  return live;
}

/** Wind blowing towards (x east, z north), strength 0..1 (45 km/h = 1). */
export function windVector(speedKmh: number, fromDeg: number): { strength: number; x: number; z: number } {
  const towards = ((fromDeg + 180) * Math.PI) / 180;
  return { strength: Math.min(1, speedKmh / 45), x: Math.sin(towards), z: Math.cos(towards) };
}

/**
 * A sudestada: strong wind from the south-east quadrant (100°-170°), or the
 * river at San Fernando near its alert level.
 */
export function isSudestada(live: LiveConditions): boolean {
  const se = live.windFrom !== null && live.windFrom >= 100 && live.windFrom <= 170;
  const windy = (live.windSpeed ?? 0) >= 30 || (live.windGusts ?? 0) >= 55;
  return (se && windy) || (live.height ?? 0) >= SAN_FERNANDO_ALERT - 0.3;
}

/** Real height (m) to the game's level offset (units), clamped so the islands stay drawn. */
export function levelOffset(height: number, metersPerUnit: number): number {
  return Math.max(-0.12, Math.min(0.15, (height - SAN_FERNANDO_USUAL) / metersPerUnit));
}

const compass = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export function compassName(fromDeg: number): string {
  return compass[Math.round((((fromDeg % 360) + 360) % 360) / 45) % 8];
}
