import { gsap } from "gsap";
import { injectStyles } from "./StartScreen";

/** End of the run: the score counts up over the river, then "Zarpar de nuevo". */
export function showEndScreen(score: number, delivered: number): void {
  injectStyles();
  const verdict = score > 3000 ? "Capitán del Delta" : score > 1500 ? "Buen recorrido" : "Seguí practicando";
  const root = document.createElement("div");
  root.id = "endScreen";
  root.className = "ss-screen";
  root.innerHTML = `
    <div class="ss-scrim"></div>
    <main class="ss-content">
      <p class="ss-eyebrow"><span class="ss-dot"></span>Fin del recorrido</p>
      <h1 class="ss-title ss-score" data-count="${score}">0</h1>
      <p class="ss-sub">${verdict}</p>
      <ul class="ss-stats">
        <li><b data-count="${delivered}">0</b><span>pasajeros entregados</span></li>
      </ul>
      <div class="ss-actions">
        <button id="replayBtn" class="ss-play" type="button">
          <span class="ss-play-label">Zarpar de nuevo</span>
          <span class="ss-play-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </button>
      </div>
    </main>
  `;
  document.body.appendChild(root);
  document.body.classList.add("menu-open");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const q = gsap.utils.selector(root);
  const count = (el: HTMLElement, duration: number) => {
    const v = { n: 0 };
    gsap.to(v, {
      n: Number(el.dataset.count),
      duration: reduced ? 0 : duration,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = Math.round(v.n).toLocaleString("es-AR");
      },
    });
  };
  if (reduced) {
    q("[data-count]").forEach((el: HTMLElement) => count(el, 0));
  } else {
    gsap
      .timeline({ defaults: { ease: "expo.out" } })
      .from(q(".ss-scrim"), { opacity: 0, duration: 1, ease: "power2.out" })
      .from(q(".ss-eyebrow"), { y: 16, opacity: 0, duration: 0.8 }, 0.2)
      .from(q(".ss-score"), { y: 40, opacity: 0, duration: 1.2, onStart: () => count(q(".ss-score")[0], 1.8) }, 0.3)
      .from(q(".ss-sub"), { y: 16, opacity: 0, filter: "blur(6px)", duration: 1 }, 1.0)
      .from(q(".ss-stats li"), { y: 14, opacity: 0, duration: 0.8, onStart: () => count(q(".ss-stats b")[0], 1.2) }, 1.1)
      .from(q(".ss-actions > *"), { y: 18, opacity: 0, scale: 0.94, duration: 0.9 }, 1.3);
  }

  const replay = root.querySelector<HTMLButtonElement>("#replayBtn")!;
  const reload = () => window.location.reload();
  replay.addEventListener("click", reload);
  replay.addEventListener("touchstart", (e) => {
    e.preventDefault();
    reload();
  });
}
