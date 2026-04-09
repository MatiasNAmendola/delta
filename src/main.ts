import { GameEngine } from "./GameEngine";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

  if (!canvas) {
    console.error("Canvas not found!");
    return;
  }

  // Prevent default touch behaviors
  canvas.addEventListener(
    "touchstart",
    (e) => e.preventDefault(),
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => e.preventDefault(),
    { passive: false }
  );

  // Lock orientation to landscape if possible
  if (screen.orientation && "lock" in screen.orientation) {
    (screen.orientation.lock as (orientation: string) => Promise<void>)("landscape").catch(() => {
      // Not all browsers support this
    });
  }

  // Start the game
  new GameEngine(canvas);

  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(new URL("/sw.js", import.meta.url).href)
      .catch(() => {
        // Service worker registration failed - game still works
      });
  }
});
