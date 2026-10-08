/**
 * Turns keys and touch buttons into the orders of each boat's realistic
 * handling (ADR 0013). The four touch buttons stay where they are; what
 * they do depends on the boat, and the on-screen labels say so.
 *
 * Keyboard (judge's notes in docs/investigacion/02, 5.6: no Ctrl/Alt combos):
 * - Motor launches: W/S or ↑/↓ the lever (one notch per tap), A/D or ←/→ the helm.
 * - Jet ski: hold W for throttle, S to brake/reverse, A/D handlebar.
 * - Kayak: Q/E or ←/→ forward stroke left/right, A/D back stroke left/right.
 * - Single scull: W, ↑ or Space a stroke, hold A/D (←/→) to pull harder and turn, S ciar.
 * - Bote de travesía (coxswain): W/S the crew's rate (below zero: ciar), A/D rudder.
 */
import type { HandlingInput, HandlingKind } from "../boat/handling";
import type { RawInput } from "./MobileControls";

export function handlingInput(kind: HandlingKind, raw: RawInput, lever: number, steering: number, helmIsPosition = false): HandlingInput {
  const p = (...keys: string[]) => keys.some((k) => raw.pressed.has(k));
  const h = (...keys: string[]) => keys.some((k) => raw.held.has(k));
  const input: HandlingInput = { lever, helm: steering, strokeLeft: false, strokeRight: false, backLeft: false, backRight: false, pressure: 0, helmIsPosition };
  switch (kind) {
    case "moto": {
      const gas = h("w", "arrowup", "touch-up");
      const brake = h("s", "arrowdown", "touch-down");
      input.lever = gas ? 1 : brake ? -1 : 0;
      return input;
    }
    case "kayak": {
      input.strokeLeft = p("q", "arrowleft", "touch-left");
      input.strokeRight = p("e", "arrowright", "touch-right");
      input.backLeft = p("a");
      input.backRight = p("d");
      // ▲: a stroke on the other side from the last one; ▼: back stroke
      if (p("touch-up", "w", "arrowup")) {
        if (lastKayakSide < 0) input.strokeRight = true;
        else input.strokeLeft = true;
      }
      if (p("touch-down", "s", "arrowdown")) {
        if (lastKayakSide < 0) input.backRight = true;
        else input.backLeft = true;
      }
      if (input.strokeLeft || input.backLeft) lastKayakSide = -1;
      else if (input.strokeRight || input.backRight) lastKayakSide = 1;
      input.helm = 0;
      return input;
    }
    case "single": {
      input.strokeLeft = p("w", "arrowup", " ", "touch-up");
      input.backLeft = p("s", "arrowdown", "touch-down");
      input.pressure = (h("d", "arrowright", "touch-right") ? 1 : 0) - (h("a", "arrowleft", "touch-left") ? 1 : 0);
      input.helm = 0;
      return input;
    }
    default:
      return input;
  }
}

let lastKayakSide: -1 | 1 = 1;

/** What the four touch buttons say in each mode. */
export function touchLabels(kind: HandlingKind | null): { up: string; down: string; left: string; right: string } {
  switch (kind) {
    case "kayak":
      return { up: "Remar", down: "Atrás", left: "Pala izq.", right: "Pala der." };
    case "single":
      return { up: "Palada", down: "Ciar", left: "◀ Fuerza", right: "Fuerza ▶" };
    case "moto":
      return { up: "Gas", down: "Freno", left: "◀", right: "▶" };
    case "timonel":
      return { up: "Boga +", down: "Boga −", left: "◀ Timón", right: "Timón ▶" };
    case "rueda":
      return { up: "Avante", down: "Atrás", left: "◀ Rueda", right: "Rueda ▶" };
    case "cana":
      return { up: "▲", down: "▼", left: "Caña ◀", right: "Caña ▶" };
    default:
      return { up: "▲", down: "▼", left: "◀", right: "▶" };
  }
}

export type HandlingMode = "clasico" | "realista";
const MODE_KEY = "delta.manejo";

export function handlingMode(): HandlingMode {
  const param = new URLSearchParams(window.location.search).get("manejo");
  if (param === "realista" || param === "clasico") return param;
  try {
    return localStorage.getItem(MODE_KEY) === "realista" ? "realista" : "clasico";
  } catch {
    return "clasico";
  }
}

export function setHandlingMode(mode: HandlingMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Private mode: only for this visit
  }
}

/** How each boat is driven in the realistic mode (start screen). */
export function handlingHelp(kind: HandlingKind, touch: boolean): string {
  const t = touch;
  switch (kind) {
    case "rueda":
      return `Rueda de timón: ${t ? "◀ ▶" : "A/D"} la giran de a poco y queda donde la dejás. Palanca de mando: ${t ? "▲ ▼" : "W/S"} entre Atrás toda, Atrás, Neutro, Avante y Avante toda; para invertir pasa por neutro y espera. Sin arrancada el timón no gobierna; en marcha atrás la hélice tira la popa.`;
    case "volante":
      return `Volante: ${t ? "◀ ▶" : "A/D"}. Palanca única: ${t ? "▲ ▼" : "W/S"}; el primer tramo es solo engranar en ralentí, después acelera. El fuera de borda gobierna con su empuje: con gas dobla mucho mejor.`;
    case "cana":
      return `Caña del timón: como en los botes de verdad, va al revés: caña a babor (${t ? "◀" : "A"}) y la proa va a estribor. ${t ? "▲ ▼" : "W/S"} acelerador y cambio.`;
    case "moto":
      return `Mantené ${t ? "Gas" : "W"} para acelerar, ${t ? "Freno" : "S"} frena y da reversa. Manubrio ${t ? "◀ ▶" : "A/D"}: sin gas casi no dobla.`;
    case "kayak":
      return `Una palada por lado: ${t ? "Pala izq. / Pala der." : "Q / E (o ← →)"}. Alternando vas derecho; del mismo lado girás hacia el otro. ${t ? "Atrás" : "A / D"}: palada atrás, frena y gira hacia ese lado. Ritmo de crucero: unas 60 por minuto.`;
    case "single":
      return `${t ? "Palada" : "W o Espacio"} en cada palada, con ritmo: si apurás la recuperación, la palada sale débil. Mantené ${t ? "◀ / ▶" : "A / D"} para tirar más de un remo y girar. ${t ? "Ciar" : "S"}: ciar (remar al revés).`;
    case "timonel":
      return `Sos el timonel. ${t ? "Boga + / −" : "W / S"}: el ritmo de la tripulación (paladas por minuto); por debajo de cero, ¡ciar! Timón ${t ? "◀ ▶" : "A/D"}: solo gobierna con el bote andando.`;
  }
}

/** Short key reminder for the desktop hint bar. */
export function handlingKeys(kind: HandlingKind | null): string {
  switch (kind) {
    case "rueda":
      return "W/S Palanca de mando (Atrás toda · Atrás · Neutro · Avante · Avante toda) &nbsp; A/D Rueda (queda donde la dejás)";
    case "volante":
      return "W/S Palanca única (adelante · neutro · atrás) &nbsp; A/D Volante";
    case "cana":
      return "W/S Acelerador y cambio &nbsp; A/D Caña (al revés: caña a babor, proa a estribor)";
    case "moto":
      return "Mantené W gas &nbsp; S freno/reversa &nbsp; A/D manubrio (sin gas no dobla)";
    case "kayak":
      return "Q/E (o ←/→) palada izq./der. &nbsp; A/D palada atrás &nbsp; W/S alternar solo";
    case "single":
      return "W o Espacio palada (con ritmo) &nbsp; mantené A/D más fuerza de un lado &nbsp; S ciar";
    case "timonel":
      return "W/S ritmo de boga (abajo de cero: ¡ciar!) &nbsp; A/D timón";
    default:
      return "W/↑ S/↓ Acelerador (tocá: un punto · mantené: suave) &nbsp; X Punto muerto &nbsp; A/← D/→ Timón";
  }
}
