/**
 * Keeps the game on the latest deploy (docs/adr/0014):
 * - the service worker is registered with updateViaCache "none", so the
 *   browser never answers sw.js from its HTTP cache;
 * - each build publishes version.json (vite.config.ts). On opening, on
 *   coming back to the tab or app, and every 5 minutes, the game asks for it
 *   (no-cache). If it names another build, then on a menu the page reloads
 *   by itself; while sailing a "versión nueva" toast offers to update, so a
 *   run is never cut short;
 * - when a new service worker takes over a page that already had one, the
 *   same applies.
 */
const CHECK_MS = 5 * 60 * 1000;

export function keepUpToDate(base: string): void {
  if ("serviceWorker" in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base, updateViaCache: "none" })
      .then((reg) => {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg?.update().catch(() => undefined);
        });
      })
      .catch(() => undefined); // the game works without it
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) newVersion("sw");
    });
  }
  const check = async () => {
    try {
      const response = await fetch(`${base}version.json`, { cache: "no-store" });
      if (!response.ok) return;
      const { sha } = (await response.json()) as { sha?: string };
      if (sha && sha !== __BUILD__.sha) newVersion(sha);
    } catch {
      // Offline: nothing to compare
    }
  };
  void check();
  setInterval(check, CHECK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
}

let shown = false;

function newVersion(to: string): void {
  // On the start or end screen nothing is lost: reload straight away, once
  // per version (if a cache still served the old page, don't loop: offer it)
  const key = "delta.reloadedFor";
  let already = false;
  try {
    already = sessionStorage.getItem(key) === to;
    sessionStorage.setItem(key, to);
  } catch {
    already = true;
  }
  if (document.body.classList.contains("menu-open") && !already) {
    window.location.reload();
    return;
  }
  if (shown) return;
  shown = true;
  const toast = document.createElement("button");
  toast.type = "button";
  toast.id = "updateToast";
  toast.textContent = "Hay una versión nueva del juego · Actualizar";
  toast.style.cssText =
    "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:500;padding:12px 18px;border:0;border-radius:999px;" +
    "background:#e9b44c;color:#1b140a;font:600 14px/1.2 'Inter Variable',Inter,system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.6);cursor:pointer;max-width:calc(100% - 32px)";
  const go = (e: Event) => {
    e.stopPropagation();
    window.location.reload();
  };
  toast.addEventListener("click", go);
  toast.addEventListener("touchstart", go, { passive: true });
  document.body.appendChild(toast);
}
