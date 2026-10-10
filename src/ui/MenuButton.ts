/**
 * "Menú" while playing: back to the start screen (boat, zone, controls).
 * It asks first, since the run is lost; going back reloads the page like
 * "Zarpar de nuevo" does (the world comes from the cache, so it is quick).
 * Esc does the same on a keyboard.
 */
let mounted = false;

export function mountMenuButton(): void {
  if (mounted) return;
  mounted = true;
  injectStyles();
  const btn = document.createElement("button");
  btn.id = "menuBtn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Volver al menú");
  btn.innerHTML = `<span aria-hidden="true">☰</span> Menú`;
  document.body.appendChild(btn);

  const sheet = document.createElement("div");
  sheet.id = "menuSheet";
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="ms-card" role="dialog" aria-modal="true" aria-labelledby="msTitle">
      <p id="msTitle" class="ms-title">¿Volver al menú?</p>
      <p class="ms-sub">Se pierde este recorrido. Podés elegir otra embarcación, zona o controles.</p>
      <div class="ms-actions">
        <button type="button" class="ms-stay">Seguir navegando</button>
        <button type="button" class="ms-go">Ir al menú</button>
      </div>
    </div>`;
  document.body.appendChild(sheet);

  const open = () => {
    sheet.hidden = false;
    sheet.querySelector<HTMLButtonElement>(".ms-stay")!.focus();
  };
  const close = () => (sheet.hidden = true);
  // Touch and click; stopPropagation so the controls don't take the tap
  const tap = (el: Element, fn: () => void) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
  };
  tap(btn, open);
  tap(sheet.querySelector(".ms-stay")!, close);
  tap(sheet.querySelector(".ms-go")!, () => window.location.reload());
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || document.body.classList.contains("menu-open")) return;
    if (sheet.hidden) open();
    else close();
  });
}

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    #menuBtn {
      position: fixed; top: 12px; right: 160px; z-index: 52; height: 36px; padding: 0 14px;
      border-radius: 999px; cursor: pointer; pointer-events: auto; touch-action: manipulation;
      font: 600 13px/1 "Inter Variable", Inter, system-ui, sans-serif; color: #f4efe3;
      background: rgba(12,26,22,0.6); border: 1px solid rgba(244,239,227,0.25);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
    #menuBtn span { margin-right: 4px; }
    body.menu-open #menuBtn { visibility: hidden; }
    #menuSheet {
      position: fixed; inset: 0; z-index: 400; display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(6,14,12,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    }
    #menuSheet[hidden] { display: none; }
    #menuSheet .ms-card {
      max-width: 360px; width: 100%; padding: 20px; border-radius: 20px; color: #f4efe3;
      background: rgba(16,32,27,0.92); border: 1px solid rgba(244,239,227,0.18);
      font-family: "Inter Variable", Inter, system-ui, sans-serif; box-shadow: 0 20px 50px -20px rgba(0,0,0,0.7);
    }
    #menuSheet .ms-title { margin: 0 0 6px; font: 600 22px/1.15 "Fraunces Variable", Fraunces, Georgia, serif; }
    #menuSheet .ms-sub { margin: 0 0 16px; font-size: 14px; line-height: 1.4; color: rgba(244,239,227,0.75); }
    #menuSheet .ms-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    #menuSheet button {
      flex: 1 1 140px; height: 44px; border-radius: 999px; cursor: pointer;
      font: 600 14px/1 "Inter Variable", Inter, system-ui, sans-serif;
    }
    #menuSheet .ms-stay { background: transparent; color: #f4efe3; border: 1px solid rgba(244,239,227,0.3); }
    #menuSheet .ms-go { background: #e9b44c; color: #1b140a; border: 0; }
    @media (max-height: 520px) { #menuBtn { top: 8px; right: 124px; height: 32px; padding: 0 12px; } }
  `;
  document.head.appendChild(style);
}
