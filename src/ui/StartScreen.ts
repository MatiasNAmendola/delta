import { gsap } from "gsap";
import type { WorldDoc } from "../world/WorldDoc";
import { chooseZone, currentZone, ZONES } from "../world/loadWorld";
import { BOAT_TYPES, FAMILIES, type BoatFamily, type BoatTypeId } from "../boat/boatTypes";

/** Start screen tabs: one per boat, or one per family of boats. */
const TABS: Array<{ tab: string; label: string }> = [
  { tab: "colectiva", label: BOAT_TYPES.colectiva.name },
  { tab: "remo", label: FAMILIES.remo.label },
  { tab: "kayak", label: BOAT_TYPES.kayak.name },
  { tab: "particular", label: FAMILIES.particular.label },
];

const tabOf = (id: BoatTypeId) => BOAT_TYPES[id].family ?? id;

/**
 * Title screen over the live 3D river (the camera circles the lancha
 * behind it). Editorial layout, GSAP motion: letters rise into place,
 * counters run up, the play button follows the pointer; on "Zarpar" the
 * content lifts away and hands over to the game. Respects
 * prefers-reduced-motion.
 */
export class StartScreen {
  private root: HTMLDivElement;
  private intro: gsap.core.Timeline | null = null;
  private onPlay: (() => void) | null = null;
  private leaving = false;

  constructor(
    private world: WorldDoc,
    private selected: BoatTypeId,
    private onSelect: (id: BoatTypeId) => void
  ) {
    injectStyles();
    const family = BOAT_TYPES[selected].family;
    if (family) this.lastInFamily[family] = selected;
    this.root = document.createElement("div");
    this.root.id = "startScreen";
    this.root.className = "ss-screen";
    const minutes = Math.round(world.rules.durationSec / 60);
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.root.innerHTML = `
      <div class="ss-scrim"></div>
      <main class="ss-content">
        <p class="ss-eyebrow"><span class="ss-dot"></span>
          <label class="ss-zone">Delta del Paraná ·
            <select aria-label="Zona del Delta">${ZONES.map((z) => `<option value="${z.id}"${z.id === currentZone() ? " selected" : ""}>${z.label}</option>`).join("")}</select>
          </label>
        </p>
        <h1 class="ss-title" aria-label="Delta">${[..."Delta"].map((c) => `<span class="ss-char"><span>${c}</span></span>`).join("")}</h1>
        <p class="ss-sub">${BOAT_TYPES[selected].name}</p>
        <p class="ss-lede">Elegí tu embarcación. Cada una navega distinto y tiene sus reglas.</p>
        <div class="ss-boats" role="tablist" aria-label="Embarcación">
          <span class="ss-boats-pill" aria-hidden="true"></span>
          ${TABS.map(({ tab, label }) => `<button type="button" role="tab" class="ss-boat" data-tab="${tab}" aria-selected="${tab === tabOf(selected)}">${label}</button>`).join("")}
        </div>
        <div class="ss-boat-detail" aria-live="polite"></div>
        <div class="ss-actions">
          <button id="playBtn" class="ss-play" type="button">
            <span class="ss-play-label">Zarpar</span>
            <span class="ss-play-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
          <button id="howBtn" class="ss-ghost" type="button" aria-expanded="false">Cómo se juega</button>
        </div>
        <ul class="ss-stats">
          <li><b data-count="${world.docks.length}">0</b><span>muelles</span></li>
          <li><b data-count="${world.rivers.length}">0</b><span>ríos y arroyos</span></li>
          <li><b data-count="${minutes}">0</b><span>minutos</span></li>
        </ul>
      </main>
      <aside class="ss-how" aria-hidden="true">
        <h2>Cómo se juega</h2>
        <ol>
          <li><p><b>El acelerador queda donde lo dejás,</b> como una palanca: ${touch ? "▲▼" : "W/S"} lo mueven un punto por toque, o suave si los mantenés${touch ? "" : " (X: punto muerto)"}. ${touch ? "◀▶ o inclinar el celular" : "A/D"} mueven el timón; ${touch ? "PARADA" : "ESPACIO"} para en los muelles.</p></li>
          <li><p><b>Por la derecha:</b> como en la ruta, en el río se navega por la mano derecha.</p></li>
          <li><p><b>Despacio</b> en los arroyos, frente a los muelles y cerca de remeros y kayaks: tu ola los moja. La línea punteada junto al acelerador marca el límite; primero te avisan y si seguís rápido, te multan.</p></li>
          <li><p><b>Limpiá el río:</b> ${touch ? "tocá" : "hacé clic en"} la basura que flota cerca tuyo y ganás créditos.</p></li>
          <li><p><b>En kayak o a remo,</b> recibí la ola de las lanchas de proa, y en los ríos anchos quedate cerca de la costa.</p></li>
          <li><p><b>El río está vivo:</b> la marea sube y baja, la corriente se da vuelta y a veces se larga una sudestada.</p></li>
          <li><p><b>Regatas:</b> con el single, esperá el "¡Ya!" y no te salgas de tu andarivel.</p></li>
        </ol>
      </aside>
      ${world.world.attribution ? `<footer class="ss-credit">Mapa: ${world.world.attribution}</footer>` : ""}
    `;
    document.body.appendChild(this.root);
    // Game controls and HUD stay hidden while the title is up
    document.body.classList.add("menu-open");

    const play = this.root.querySelector<HTMLButtonElement>("#playBtn")!;
    play.addEventListener("click", () => this.start());
    play.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.start();
    });
    this.root.querySelector("#howBtn")!.addEventListener("click", () => this.toggleHow());
    // Another section of the Delta: a new world, so the page reloads into it
    const zone = this.root.querySelector<HTMLSelectElement>(".ss-zone select")!;
    zone.addEventListener("change", () => chooseZone(zone.value));
    this.root.querySelectorAll<HTMLButtonElement>(".ss-boat").forEach((b) =>
      b.addEventListener("click", () => {
        const tab = b.dataset.tab!;
        if (tab === tabOf(this.selected)) return;
        this.choose(tab in FAMILIES ? this.lastInFamily[tab as BoatFamily] : (tab as BoatTypeId));
      })
    );
    // Variant chips of the private launches (re-rendered with the detail)
    this.root.querySelector(".ss-boat-detail")!.addEventListener("click", (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>(".ss-variant");
      if (chip) this.choose(chip.dataset.boat as BoatTypeId);
    });
    this.renderDetail();
    // Place the highlight once fonts and layout settle
    requestAnimationFrame(() => this.movePill(false));
    window.addEventListener("resize", () => this.movePill(false));
    this.magnetic(play);
    this.animateIn();
  }

  /** The boat shown when a family's tab is picked: the last one chosen in it. */
  private lastInFamily: Record<BoatFamily, BoatTypeId> = { remo: "travesia", particular: "runabout" };

  private choose(id: BoatTypeId): void {
    if (id === this.selected) return;
    this.selected = id;
    const family = BOAT_TYPES[id].family;
    if (family) this.lastInFamily[family] = id;
    this.root.querySelectorAll<HTMLElement>(".ss-boat").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tabOf(id))));
    this.movePill(true);
    const sub = this.root.querySelector<HTMLElement>(".ss-sub")!;
    gsap.to(sub, {
      opacity: 0,
      y: -6,
      duration: this.reduced ? 0 : 0.18,
      ease: "power2.in",
      onComplete: () => {
        sub.textContent = BOAT_TYPES[id].name;
        gsap.fromTo(sub, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: this.reduced ? 0 : 0.5, ease: "expo.out" });
      },
    });
    const detail = this.root.querySelector<HTMLElement>(".ss-boat-detail")!;
    gsap.to(detail, {
      opacity: 0,
      y: -8,
      duration: this.reduced ? 0 : 0.18,
      ease: "power2.in",
      onComplete: () => {
        this.renderDetail();
        gsap.fromTo(detail, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: this.reduced ? 0 : 0.5, ease: "expo.out" });
        gsap.from(detail.querySelectorAll(".ss-bar i"), { scaleX: 0, duration: this.reduced ? 0 : 0.6, stagger: 0.05, ease: "expo.out" });
      },
    });
    this.onSelect(id);
  }

  /** Slides the amber highlight under the selected tab. */
  private movePill(animate: boolean): void {
    const pill = this.root.querySelector<HTMLElement>(".ss-boats-pill");
    const tab = this.root.querySelector<HTMLElement>(`.ss-boat[data-tab="${tabOf(this.selected)}"]`);
    if (!pill || !tab) return;
    gsap.to(pill, {
      x: tab.offsetLeft,
      y: tab.offsetTop,
      width: tab.offsetWidth,
      height: tab.offsetHeight,
      duration: animate && !this.reduced ? 0.55 : 0,
      ease: "expo.out",
    });
  }

  private renderDetail(): void {
    const b = BOAT_TYPES[this.selected];
    const bar = (label: string, v: number) =>
      `<span class="ss-bar"><span>${label}</span><span class="ss-bar-track">${Array.from({ length: 5 }, (_, i) => `<i class="${i < v ? "on" : ""}"></i>`).join("")}</span></span>`;
    const variants = b.family
      ? `<div class="ss-variants" role="radiogroup" aria-label="${FAMILIES[b.family].label}">${FAMILIES[b.family].boats.map((id) => `<button type="button" role="radio" class="ss-variant" data-boat="${id}" aria-checked="${id === b.id}">${BOAT_TYPES[id].short}</button>`).join("")}</div>`
      : "";
    this.root.querySelector<HTMLElement>(".ss-boat-detail")!.innerHTML = `
      ${variants}
      <p class="ss-boat-mission"><b>${b.mission}.</b> ${b.tagline}.</p>
      <div class="ss-bars">${bar("Velocidad", b.stats.velocidad)}${bar("Maniobra", b.stats.maniobra)}${bar("Olas", b.stats.olas)}</div>`;
  }

  onPlayClick(callback: () => void): void {
    this.onPlay = callback;
  }

  private get reduced(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private animateIn(): void {
    const q = gsap.utils.selector(this.root);
    const counters = q(".ss-stats b") as HTMLElement[];
    const runCounters = () =>
      counters.forEach((el) => {
        const target = Number(el.dataset.count);
        const v = { n: 0 };
        gsap.to(v, {
          n: target,
          duration: this.reduced ? 0 : 1.4,
          ease: "power3.out",
          onUpdate: () => {
            el.textContent = String(Math.round(v.n));
          },
        });
      });
    if (this.reduced) {
      gsap.set(q(".ss-scrim, .ss-eyebrow, .ss-char > span, .ss-sub, .ss-lede, .ss-actions > *, .ss-stats li, .ss-credit"), {
        clearProps: "all",
      });
      runCounters();
      return;
    }
    this.intro = gsap
      .timeline({ defaults: { ease: "expo.out" } })
      .from(q(".ss-scrim"), { opacity: 0, duration: 1.2, ease: "power2.out" })
      .from(q(".ss-eyebrow"), { y: 16, opacity: 0, duration: 0.9 }, 0.25)
      .from(q(".ss-char > span"), { yPercent: 115, rotate: 6, duration: 1.3, stagger: 0.06 }, 0.3)
      .from(q(".ss-sub"), { y: 20, opacity: 0, filter: "blur(6px)", duration: 1.1 }, 0.7)
      .from(q(".ss-lede"), { y: 20, opacity: 0, duration: 1 }, 0.85)
      .from(q(".ss-boat"), { y: 14, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.9)
      .from(q(".ss-boats-pill, .ss-boat-detail"), { opacity: 0, duration: 0.8 }, 1.1)
      .from(q(".ss-actions > *"), { y: 18, opacity: 0, scale: 0.94, duration: 0.9, stagger: 0.08 }, 1.0)
      .from(q(".ss-stats li"), { y: 14, opacity: 0, duration: 0.8, stagger: 0.07, onStart: runCounters }, 1.15)
      .from(q(".ss-credit"), { opacity: 0, duration: 1 }, 1.4);
  }

  /** The play button leans towards the pointer (desktop). */
  private magnetic(button: HTMLElement): void {
    if (this.reduced || !window.matchMedia("(hover: hover)").matches) return;
    const xTo = gsap.quickTo(button, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(button, "y", { duration: 0.5, ease: "power3.out" });
    button.addEventListener("pointermove", (e) => {
      const r = button.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    button.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  }

  private toggleHow(): void {
    const how = this.root.querySelector<HTMLElement>(".ss-how")!;
    const btn = this.root.querySelector<HTMLElement>("#howBtn")!;
    const open = how.getAttribute("aria-hidden") === "true";
    how.setAttribute("aria-hidden", String(!open));
    btn.setAttribute("aria-expanded", String(open));
    gsap.to(how, {
      autoAlpha: open ? 1 : 0,
      x: open ? 0 : 24,
      duration: this.reduced ? 0 : 0.6,
      ease: "expo.out",
    });
    if (open) {
      gsap.from(how.querySelectorAll("li"), {
        x: 16,
        opacity: 0,
        duration: this.reduced ? 0 : 0.6,
        stagger: 0.06,
        ease: "expo.out",
      });
    }
  }

  private start(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.intro?.progress(1);
    this.onPlay?.();
    document.body.classList.remove("menu-open");
    const q = gsap.utils.selector(this.root);
    gsap
      .timeline({ defaults: { ease: "expo.inOut" }, onComplete: () => this.root.remove() })
      .to(q(".ss-content > *, .ss-how"), {
        y: -28,
        opacity: 0,
        filter: "blur(8px)",
        duration: this.reduced ? 0 : 0.8,
        stagger: this.reduced ? 0 : 0.04,
      })
      .to(q(".ss-scrim, .ss-credit"), { opacity: 0, duration: this.reduced ? 0 : 0.9 }, this.reduced ? 0 : 0.25)
      .set(this.root, { pointerEvents: "none" }, 0);
  }
}

let stylesInjected = false;

export function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .ss-screen {
      --ink: #f4efe3;
      --muted: rgba(244, 239, 227, 0.72);
      --accent: #e9b44c;
      --river: #8a6a43;
      position: fixed; inset: 0; z-index: 200;
      color: var(--ink);
      font-family: "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      overflow: hidden;
    }
    .ss-screen .ss-scrim {
      position: absolute; inset: 0;
      background:
        linear-gradient(90deg, rgba(10, 24, 20, 0.92) 0%, rgba(10, 24, 20, 0.7) 38%, rgba(10, 24, 20, 0.05) 75%),
        linear-gradient(0deg, rgba(10, 24, 20, 0.55) 0%, transparent 35%);
    }
    .ss-screen .ss-content {
      position: relative; height: 100%;
      display: flex; flex-direction: column; justify-content: center;
      padding: 0 clamp(20px, 7vw, 96px);
      max-width: 680px;
    }
    .ss-screen .ss-eyebrow {
      display: inline-flex; align-items: center; gap: 10px;
      font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted);
    }
    .ss-screen .ss-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px rgba(233, 180, 76, 0.18); }
    .ss-screen .ss-title {
      font-family: "Fraunces Variable", Fraunces, "Iowan Old Style", Georgia, serif;
      font-weight: 600; font-size: clamp(64px, 13vw, 168px); line-height: 0.92;
      letter-spacing: -0.035em; margin: 14px 0 0;
      display: flex;
    }
    .ss-screen .ss-char { display: inline-block; overflow: hidden; padding-bottom: 0.06em; }
    .ss-screen .ss-char > span { display: inline-block; will-change: transform; }
    .ss-screen .ss-sub {
      font-family: "Fraunces Variable", Fraunces, Georgia, serif; font-style: italic; font-weight: 400;
      font-size: clamp(22px, 3vw, 34px); color: var(--accent); margin-top: 2px;
    }
    .ss-screen .ss-lede { margin-top: 18px; max-width: 34ch; font-size: 16px; line-height: 1.55; color: var(--muted); }
    .ss-screen .ss-boats {
      position: relative; display: flex; flex-wrap: nowrap; gap: 2px; margin-top: 18px; padding: 4px;
      border-radius: 999px; width: fit-content; max-width: 100%;
      background: rgba(244, 239, 227, 0.07); border: 1px solid rgba(244, 239, 227, 0.14);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
    .ss-screen .ss-boats-pill { position: absolute; left: 0; top: 0; border-radius: 999px; background: var(--ink); pointer-events: none; }
    .ss-screen .ss-boat {
      position: relative; z-index: 1; border: 0; background: none; cursor: pointer; white-space: nowrap;
      padding: 9px 13px; border-radius: 999px; font: 500 13.5px/1 "Inter Variable", Inter, system-ui, sans-serif;
      color: var(--muted); transition: color 0.3s;
    }
    .ss-screen .ss-boat:hover { color: var(--ink); }
    .ss-screen .ss-boat[aria-selected="true"] { color: #1b140a; }
    .ss-screen .ss-boat:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .ss-screen .ss-boat-detail { margin-top: 12px; min-height: 64px; }
    .ss-screen .ss-boat-mission { font-size: 14px; line-height: 1.5; color: var(--muted); max-width: 46ch; }
    .ss-screen .ss-boat-mission b { color: var(--ink); font-weight: 600; }
    .ss-screen .ss-bars { display: flex; gap: 18px; margin-top: 8px; flex-wrap: wrap; }
    .ss-screen .ss-bar { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .ss-screen .ss-bar-track { display: inline-flex; gap: 3px; }
    .ss-screen .ss-bar i { display: block; width: 14px; height: 4px; border-radius: 2px; background: rgba(244, 239, 227, 0.18); transform-origin: left; }
    .ss-screen .ss-bar i.on { background: var(--accent); }
    .ss-screen .ss-zone { display: inline-flex; align-items: center; gap: 6px; }
    .ss-screen .ss-zone select {
      font: inherit; letter-spacing: inherit; text-transform: inherit; color: var(--ink); cursor: pointer;
      background: rgba(244, 239, 227, 0.08); border: 1px solid rgba(244, 239, 227, 0.22); border-radius: 999px;
      padding: 4px 10px; max-width: 70vw;
    }
    .ss-screen .ss-zone select option { color: #1b140a; text-transform: none; }
    .ss-screen .ss-variants { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .ss-screen .ss-variant { font: inherit; font-size: 12px; letter-spacing: 0.04em; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(244, 239, 227, 0.25); background: transparent; color: var(--muted); cursor: pointer; transition: background 0.2s, color 0.2s, border-color 0.2s; }
    .ss-screen .ss-variant:hover { color: var(--ink); border-color: rgba(244, 239, 227, 0.5); }
    .ss-screen .ss-variant[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: #1a1408; font-weight: 600; }
    .ss-screen .ss-actions { display: flex; align-items: center; gap: 14px; margin-top: 30px; flex-wrap: wrap; }
    .ss-screen .ss-play {
      display: inline-flex; align-items: center; gap: 14px;
      padding: 10px 10px 10px 26px; border-radius: 999px; border: 0; cursor: pointer;
      font: 600 17px/1 "Inter Variable", Inter, system-ui, sans-serif; letter-spacing: 0.01em;
      color: #1b140a; background: var(--accent);
      box-shadow: 0 10px 30px -8px rgba(233, 180, 76, 0.55);
      transition: background 0.3s;
    }
    .ss-screen .ss-play:hover { background: #f2c66a; }
    .ss-screen .ss-play:focus-visible, .ss-screen .ss-ghost:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; }
    .ss-screen .ss-play-icon {
      display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%;
      background: #1b140a; color: var(--accent); transition: transform 0.4s cubic-bezier(.2,.8,.2,1);
    }
    .ss-screen .ss-play:hover .ss-play-icon { transform: translateX(3px) rotate(-8deg); }
    .ss-screen .ss-ghost {
      padding: 14px 20px; border-radius: 999px; cursor: pointer;
      font: 500 15px/1 "Inter Variable", Inter, system-ui, sans-serif; color: var(--ink);
      background: rgba(244, 239, 227, 0.06); border: 1px solid rgba(244, 239, 227, 0.22);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      transition: background 0.3s, border-color 0.3s;
    }
    .ss-screen .ss-ghost:hover, .ss-screen .ss-ghost[aria-expanded="true"] { background: rgba(244, 239, 227, 0.14); border-color: rgba(244, 239, 227, 0.4); }
    .ss-screen .ss-stats { list-style: none; display: flex; gap: clamp(20px, 4vw, 44px); margin-top: 36px; }
    .ss-screen .ss-stats li { display: flex; flex-direction: column; gap: 4px; }
    .ss-screen .ss-stats b { font-family: "Fraunces Variable", Fraunces, Georgia, serif; font-weight: 600; font-size: 30px; font-variant-numeric: tabular-nums; }
    .ss-screen .ss-stats span { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .ss-screen .ss-how {
      position: absolute; right: clamp(16px, 5vw, 64px); top: 50%; translate: 0 -50%;
      width: min(380px, 42vw); padding: 26px 26px 22px; border-radius: 22px;
      background: rgba(12, 26, 22, 0.62); border: 1px solid rgba(244, 239, 227, 0.14);
      backdrop-filter: blur(18px) saturate(1.2); -webkit-backdrop-filter: blur(18px) saturate(1.2);
      opacity: 0; visibility: hidden; transform: translateX(24px);
    }
    .ss-screen .ss-how h2 { font-family: "Fraunces Variable", Fraunces, Georgia, serif; font-weight: 600; font-size: 22px; margin-bottom: 14px; }
    .ss-screen .ss-how ol { list-style: none; counter-reset: step; display: grid; gap: 12px; }
    .ss-screen .ss-how li { counter-increment: step; display: grid; grid-template-columns: 28px 1fr; gap: 10px; font-size: 14px; line-height: 1.5; color: var(--muted); }
    .ss-screen .ss-how li::before {
      content: counter(step); display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
      font: 600 12px/1 "Inter Variable", Inter, sans-serif; color: #1b140a; background: var(--accent);
    }
    .ss-screen .ss-how b { color: var(--ink); font-weight: 600; }
    body.menu-open #mobileControls, body.menu-open #desktopHint, body.menu-open #minimap { visibility: hidden; }
    .ss-screen .ss-credit { position: absolute; left: clamp(20px, 7vw, 96px); bottom: 14px; font-size: 11px; color: rgba(244, 239, 227, 0.5); }
    /* Short desktop windows: drop the numbers, they are the least needed */
    @media (max-height: 780px) {
      .ss-screen .ss-stats { display: none; }
      .ss-screen .ss-title { font-size: clamp(64px, 11vw, 132px); }
    }
    /* Landscape phones */
    @media (max-height: 520px) {
      .ss-screen .ss-title { font-size: clamp(52px, 17vh, 88px); margin-top: 6px; }
      .ss-screen .ss-sub { font-size: 20px; }
      .ss-screen .ss-lede { margin-top: 8px; font-size: 13px; }
      .ss-screen .ss-actions { margin-top: 14px; }
      .ss-screen .ss-play { padding: 7px 7px 7px 20px; font-size: 15px; }
      .ss-screen .ss-play-icon { width: 34px; height: 34px; }
      .ss-screen .ss-ghost { padding: 11px 16px; font-size: 13px; }
      .ss-screen .ss-stats { display: none; }
      .ss-screen .ss-lede { display: none; }
      .ss-screen .ss-boats { margin-top: 10px; }
      .ss-screen .ss-boat { padding: 7px 11px; font-size: 12px; }
      .ss-screen .ss-boat-detail { margin-top: 6px; min-height: 48px; }
      .ss-screen .ss-boat-mission { font-size: 12px; }
      .ss-screen .ss-bars { margin-top: 4px; }
      .ss-screen .ss-how { padding: 16px 18px; width: min(340px, 44vw); }
      .ss-screen .ss-how h2 { font-size: 17px; margin-bottom: 8px; }
      .ss-screen .ss-how ol { gap: 6px; }
      .ss-screen .ss-how li { font-size: 12px; }
    }
    /* Portrait phones: stack, scrim from the bottom */
    @media (max-width: 600px) and (orientation: portrait) {
      .ss-screen .ss-boats { flex-wrap: wrap; border-radius: 18px; }
      .ss-screen .ss-scrim { background: linear-gradient(0deg, rgba(10,24,20,0.95) 0%, rgba(10,24,20,0.75) 55%, rgba(10,24,20,0.1) 100%); }
      .ss-screen .ss-content { justify-content: flex-end; padding-bottom: 56px; }
      .ss-screen .ss-how { left: 16px; right: 16px; width: auto; top: 24px; translate: none; }
    }
  `;
  document.head.appendChild(style);
}
