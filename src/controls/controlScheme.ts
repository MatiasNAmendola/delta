/**
 * How the player drives a motor boat (chosen on the start screen, ADR 0013):
 * - "flechas": ▲▼ move the throttle lever (tap: one notch, hold: smoothly; it
 *   stays where it is left), ◀▶ the rudder;
 * - "ruedita": one on-screen joystick for the thumb (up/down throttle, left/right helm);
 * - "palanca" (shown as "Timón"): an on-screen rueda de timón and palanca de mando.
 * The kayak and the single are rowed with their own widgets whatever the scheme.
 */
export type ControlScheme = "flechas" | "ruedita" | "palanca";
const SCHEME_KEY = "delta.controles";

/** The saved scheme; the old "botones" and "flechas" are both today's "flechas". */
export function parseScheme(v: string | null): ControlScheme {
  return v === "palanca" || v === "ruedita" ? v : "flechas";
}

export function controlScheme(): ControlScheme {
  try {
    return parseScheme(localStorage.getItem(SCHEME_KEY));
  } catch {
    return "flechas";
  }
}

export function setControlScheme(scheme: ControlScheme): void {
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    // Only for this visit
  }
}
