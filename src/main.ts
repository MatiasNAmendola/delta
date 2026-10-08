import { GameEngine } from "./GameEngine";
import { watchInstallPrompt } from "./ui/install";

watchInstallPrompt();
// Fonts are bundled with the game (work offline in the PWA): Fraunces for
// display, Inter for UI text
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource-variable/inter/index.css";
import { loadWorldFromUrl } from "./world/loadWorld";
import { mark } from "./utils/perf";

// Import side-effects needed by BabylonJS
import "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Materials/standardMaterial";

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
  loadWorldFromUrl()
    .then((world) => {
      mark("mundo descargado");
      return world;
    })
    .then((world) => {
      const game = new GameEngine(canvas, world);
      // Dev builds: the game is reachable from the console and test scripts
      if (import.meta.env.DEV) (window as unknown as { __game: GameEngine }).__game = game;
      return game;
    })
    .catch((error) => {
      console.error("Could not load the world:", error);
      const text = document.getElementById("loadingText");
      if (text) text.textContent = "No se pudo cargar el mundo 😕";
    });

  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    // Served from the site's folder (/delta/ on GitHub Pages), not the domain root
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        // Service worker registration failed - game still works
      });
  }
});
