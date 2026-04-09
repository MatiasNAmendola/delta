import { GameEngine } from "./GameEngine";

// --- Error overlay (like Next.js) for mobile debugging ---
function showErrorOverlay(error: string, source?: string) {
  let overlay = document.getElementById("error-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "error-overlay";
    overlay.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; max-height:50vh;
      background:rgba(220,38,38,0.95); color:#fff; font-family:monospace;
      font-size:12px; padding:12px; z-index:99999; overflow-y:auto;
      border-top:3px solid #ff0; backdrop-filter:blur(4px);
    `;
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ Cerrar";
    closeBtn.style.cssText = `
      position:absolute; top:4px; right:8px; background:#ff0; color:#000;
      border:none; padding:4px 10px; border-radius:4px; font-weight:bold;
      cursor:pointer; font-size:12px;
    `;
    closeBtn.onclick = () => overlay!.remove();
    overlay.appendChild(closeBtn);

    const title = document.createElement("div");
    title.style.cssText = "font-size:14px; font-weight:bold; margin-bottom:8px; color:#ff0;";
    title.textContent = "⚠ Error en el juego";
    overlay.appendChild(title);

    const list = document.createElement("div");
    list.id = "error-list";
    overlay.appendChild(list);

    document.body.appendChild(overlay);
  }

  const list = document.getElementById("error-list")!;
  const entry = document.createElement("div");
  entry.style.cssText = "margin-bottom:6px; padding:4px; background:rgba(0,0,0,0.3); border-radius:3px; word-break:break-all;";
  entry.innerHTML = `<span style="color:#ff0">${source || "runtime"}</span>: ${error}`;
  list.appendChild(entry);

  // Keep max 10 errors visible
  while (list.children.length > 10) list.removeChild(list.firstChild!);
}

// Catch all unhandled errors
window.addEventListener("error", (e) => {
  showErrorOverlay(e.message, e.filename ? `${e.filename}:${e.lineno}` : undefined);
});

// Catch unhandled promise rejections
window.addEventListener("unhandledrejection", (e) => {
  showErrorOverlay(String(e.reason), "Promise");
});

// Override console.error to also show in overlay
const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  showErrorOverlay(args.map(a => String(a)).join(" "), "console.error");
};

// Override console.warn for init warnings
const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  origWarn.apply(console, args);
  // Only show init-related warnings
  const msg = args.map(a => String(a)).join(" ");
  if (msg.includes("init failed") || msg.includes("failed")) {
    showErrorOverlay(msg, "console.warn");
  }
};

// --- Eruda mobile console (dev only) ---
async function initEruda() {
  try {
    const eruda = await import("eruda");
    eruda.default.init({
      tool: ["console", "elements", "network", "info"],
      useShadowDom: true,
    });
    // Make the button smaller and less intrusive
    const entry = document.querySelector(".eruda-entry-btn") as HTMLElement;
    if (entry) {
      entry.style.cssText += "width:36px!important;height:36px!important;opacity:0.5!important;";
    }
  } catch (e) {
    console.log("Eruda not available");
  }
}

// --- Game init ---
window.addEventListener("DOMContentLoaded", () => {
  // Init eruda for mobile debugging
  initEruda();

  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

  if (!canvas) {
    showErrorOverlay("Canvas #renderCanvas not found!");
    return;
  }

  // Prevent default touch behaviors
  canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  // Lock orientation to landscape if possible
  if (screen.orientation && "lock" in screen.orientation) {
    (screen.orientation.lock as (orientation: string) => Promise<void>)("landscape").catch(() => {});
  }

  // Start the game
  try {
    new GameEngine(canvas);
  } catch (e) {
    showErrorOverlay(String(e), "GameEngine constructor");
  }

  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(new URL("/sw.js", import.meta.url).href)
      .catch(() => {});
  }
});
