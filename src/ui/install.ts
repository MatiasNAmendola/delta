/**
 * Installing the game as an app and playing it full screen (no browser
 * bars): Chrome/Android offer "Instalar" through beforeinstallprompt;
 * iPhone/iPad need "Compartir → Agregar a inicio", so we explain it.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function standalone(): boolean {
  return (
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Starts listening early (before the start screen exists). */
export function watchInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/**
 * Adds an "Instalar" button to `container` when the browser can install
 * the app (or a hint on iOS). Hidden once installed.
 */
export function mountInstallButton(container: HTMLElement, className: string): void {
  if (standalone()) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = "Instalar app";
  button.style.display = "none";
  container.appendChild(button);
  const hint = document.createElement("p");
  hint.className = "ss-install-hint";
  hint.style.display = "none";
  hint.innerHTML = "Para jugar a pantalla completa: <b>Compartir</b> → <b>Agregar a inicio</b>";
  container.after(hint);
  const refresh = () => {
    button.style.display = deferred ? "" : "none";
  };
  listeners.add(refresh);
  refresh();
  if (isIos()) hint.style.display = "";
  button.addEventListener("click", async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    refresh();
  });
}

/** Full screen and landscape on phones when playing in the browser. */
export async function enterPlayMode(): Promise<void> {
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!touch || standalone()) return;
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
    await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    // Not allowed here (iOS Safari, desktop): keep playing in the page
  }
}
