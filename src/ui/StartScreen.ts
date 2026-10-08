import { gsap } from "gsap";
import type { WorldDoc } from "../world/WorldDoc";

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

  constructor(private world: WorldDoc) {
    injectStyles();
    this.root = document.createElement("div");
    this.root.id = "startScreen";
    this.root.className = "ss-screen";
    const minutes = Math.round(world.rules.durationSec / 60);
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.root.innerHTML = `
      <div class="ss-scrim"></div>
      <main class="ss-content">
        <p class="ss-eyebrow"><span class="ss-dot"></span>Tigre · Buenos Aires</p>
        <h1 class="ss-title" aria-label="Delta">${[..."Delta"].map((c) => `<span class="ss-char"><span>${c}</span></span>`).join("")}</h1>
        <p class="ss-sub">Lancha colectiva</p>
        <p class="ss-lede">Llevá pasajeros entre los muelles de las islas. Respetá a los remeros: cerca de ellos, despacio.</p>
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
          <li><p><b>Navegá</b> ${touch ? "con los botones o inclinando el celular" : "con W A S D o las flechas"}.</p></li>
          <li><p><b>Pará en el muelle</b> ${touch ? "con PARADA" : "con ESPACIO"}, a baja velocidad: suben o bajan pasajeros.</p></li>
          <li><p><b>Seguí la próxima parada</b> que marca la pantalla: entregar ahí suma bonus.</p></li>
          <li><p><b>Cerca de los remeros</b>, despacio: tu ola los moja y resta puntos.</p></li>
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
    this.magnetic(play);
    this.animateIn();
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
      font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
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
      max-width: 640px;
    }
    .ss-screen .ss-eyebrow {
      display: inline-flex; align-items: center; gap: 10px;
      font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted);
    }
    .ss-screen .ss-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px rgba(233, 180, 76, 0.18); }
    .ss-screen .ss-title {
      font-family: Fraunces, "Iowan Old Style", Georgia, serif;
      font-weight: 600; font-size: clamp(64px, 13vw, 168px); line-height: 0.92;
      letter-spacing: -0.035em; margin: 14px 0 0;
      display: flex;
    }
    .ss-screen .ss-char { display: inline-block; overflow: hidden; padding-bottom: 0.06em; }
    .ss-screen .ss-char > span { display: inline-block; will-change: transform; }
    .ss-screen .ss-sub {
      font-family: Fraunces, Georgia, serif; font-style: italic; font-weight: 400;
      font-size: clamp(22px, 3vw, 34px); color: var(--accent); margin-top: 2px;
    }
    .ss-screen .ss-lede { margin-top: 18px; max-width: 34ch; font-size: 16px; line-height: 1.55; color: var(--muted); }
    .ss-screen .ss-actions { display: flex; align-items: center; gap: 14px; margin-top: 30px; flex-wrap: wrap; }
    .ss-screen .ss-play {
      display: inline-flex; align-items: center; gap: 14px;
      padding: 10px 10px 10px 26px; border-radius: 999px; border: 0; cursor: pointer;
      font: 600 17px/1 Inter, system-ui, sans-serif; letter-spacing: 0.01em;
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
      font: 500 15px/1 Inter, system-ui, sans-serif; color: var(--ink);
      background: rgba(244, 239, 227, 0.06); border: 1px solid rgba(244, 239, 227, 0.22);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      transition: background 0.3s, border-color 0.3s;
    }
    .ss-screen .ss-ghost:hover, .ss-screen .ss-ghost[aria-expanded="true"] { background: rgba(244, 239, 227, 0.14); border-color: rgba(244, 239, 227, 0.4); }
    .ss-screen .ss-stats { list-style: none; display: flex; gap: clamp(20px, 4vw, 44px); margin-top: 36px; }
    .ss-screen .ss-stats li { display: flex; flex-direction: column; gap: 4px; }
    .ss-screen .ss-stats b { font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 30px; font-variant-numeric: tabular-nums; }
    .ss-screen .ss-stats span { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .ss-screen .ss-how {
      position: absolute; right: clamp(16px, 5vw, 64px); top: 50%; translate: 0 -50%;
      width: min(380px, 42vw); padding: 26px 26px 22px; border-radius: 22px;
      background: rgba(12, 26, 22, 0.62); border: 1px solid rgba(244, 239, 227, 0.14);
      backdrop-filter: blur(18px) saturate(1.2); -webkit-backdrop-filter: blur(18px) saturate(1.2);
      opacity: 0; visibility: hidden; transform: translateX(24px);
    }
    .ss-screen .ss-how h2 { font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 22px; margin-bottom: 14px; }
    .ss-screen .ss-how ol { list-style: none; counter-reset: step; display: grid; gap: 12px; }
    .ss-screen .ss-how li { counter-increment: step; display: grid; grid-template-columns: 28px 1fr; gap: 10px; font-size: 14px; line-height: 1.5; color: var(--muted); }
    .ss-screen .ss-how li::before {
      content: counter(step); display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
      font: 600 12px/1 Inter, sans-serif; color: #1b140a; background: var(--accent);
    }
    .ss-screen .ss-how b { color: var(--ink); font-weight: 600; }
    body.menu-open #mobileControls, body.menu-open #desktopHint, body.menu-open #minimap { visibility: hidden; }
    .ss-screen .ss-credit { position: absolute; left: clamp(20px, 7vw, 96px); bottom: 14px; font-size: 11px; color: rgba(244, 239, 227, 0.5); }
    /* Landscape phones */
    @media (max-height: 520px) {
      .ss-screen .ss-title { font-size: clamp(52px, 17vh, 88px); margin-top: 6px; }
      .ss-screen .ss-sub { font-size: 20px; }
      .ss-screen .ss-lede { margin-top: 8px; font-size: 13px; }
      .ss-screen .ss-actions { margin-top: 14px; }
      .ss-screen .ss-play { padding: 7px 7px 7px 20px; font-size: 15px; }
      .ss-screen .ss-play-icon { width: 34px; height: 34px; }
      .ss-screen .ss-ghost { padding: 11px 16px; font-size: 13px; }
      .ss-screen .ss-stats { margin-top: 14px; }
      .ss-screen .ss-stats b { font-size: 22px; }
      .ss-screen .ss-how { padding: 16px 18px; width: min(340px, 44vw); }
      .ss-screen .ss-how h2 { font-size: 17px; margin-bottom: 8px; }
      .ss-screen .ss-how ol { gap: 6px; }
      .ss-screen .ss-how li { font-size: 12px; }
    }
    /* Portrait phones: stack, scrim from the bottom */
    @media (max-width: 600px) and (orientation: portrait) {
      .ss-screen .ss-scrim { background: linear-gradient(0deg, rgba(10,24,20,0.95) 0%, rgba(10,24,20,0.75) 55%, rgba(10,24,20,0.1) 100%); }
      .ss-screen .ss-content { justify-content: flex-end; padding-bottom: 56px; }
      .ss-screen .ss-how { left: 16px; right: 16px; width: auto; top: 24px; translate: none; }
    }
  `;
  document.head.appendChild(style);
}
