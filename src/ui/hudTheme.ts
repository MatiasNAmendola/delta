/**
 * In-game HUD in the title screen's visual language: frosted glass pills,
 * Inter for labels and Fraunces for numbers. Overrides the original HUD
 * and touch-control styles (higher specificity, loaded after them).
 */
let injected = false;

export function injectHudTheme(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = `
    body #gameHUD { font-family: "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
    body #gameHUD .hud-bar {
      padding: 12px 16px; gap: 10px; justify-content: flex-start;
      background: none;
    }
    body #gameHUD .hud-item {
      flex-direction: column; align-items: flex-start; gap: 2px;
      padding: 8px 14px 9px; border-radius: 14px;
      background: rgba(12, 26, 22, 0.5); border: 1px solid rgba(244, 239, 227, 0.14);
      backdrop-filter: blur(12px) saturate(1.2); -webkit-backdrop-filter: blur(12px) saturate(1.2);
      color: #f4efe3; text-shadow: none; font-weight: 400;
    }
    body #gameHUD .hud-item .label { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244, 239, 227, 0.62); }
    body #gameHUD .hud-item .value {
      font-family: "Fraunces Variable", Fraunces, Georgia, serif; font-weight: 600; font-size: 22px; line-height: 1;
      color: #f4efe3; font-variant-numeric: tabular-nums;
    }
    body #gameHUD #hud-river {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%); pointer-events: none;
      padding: 7px 18px 8px; border-radius: 999px; white-space: nowrap; max-width: 46vw; overflow: hidden; text-overflow: ellipsis;
      font: italic 600 20px/1.1 "Fraunces Variable", Fraunces, Georgia, serif; color: #f4efe3;
      background: rgba(12, 26, 22, 0.42); border: 1px solid rgba(244, 239, 227, 0.12);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); text-shadow: 0 1px 8px rgba(0,0,0,0.35);
    }
    body #gameHUD #hud-river span { display: inline-block; }
    body #gameHUD #hud-location:empty { display: none; }
    body #gameHUD #hud-location {
      position: fixed; top: auto; bottom: 14px; left: 50%; transform: translateX(-50%);
      font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
      color: rgba(244, 239, 227, 0.75); text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
      background: none; padding: 0; white-space: nowrap;
    }
    body #gameHUD #hud-nextStop {
      position: fixed; top: 74px; left: 16px; bottom: auto; transform: none;
      padding: 8px 14px; border-radius: 999px; font-size: 13px; color: #1b140a;
      background: #e9b44c; border: 0; box-shadow: 0 8px 24px -10px rgba(233, 180, 76, 0.7);
      font-weight: 600; white-space: nowrap;
    }
    body #gameHUD #hud-notification {
      top: 30%; padding: 14px 22px; border-radius: 18px; max-width: min(460px, 86vw);
      font-size: 15px; line-height: 1.45; font-weight: 500; white-space: pre-line; text-align: center;
      color: #f4efe3; background: rgba(12, 26, 22, 0.72); border: 1px solid rgba(244, 239, 227, 0.16);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.6);
    }
    body #desktopHint > div {
      font-family: "Inter Variable", Inter, system-ui, sans-serif !important; font-size: 12px !important; letter-spacing: 0.02em;
      color: rgba(244, 239, 227, 0.75) !important; background: rgba(12, 26, 22, 0.5) !important;
      border: 1px solid rgba(244, 239, 227, 0.12); border-radius: 12px !important;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
    body #mobileControls .ctrl-btn {
      border: 1px solid rgba(244, 239, 227, 0.28); background: rgba(12, 26, 22, 0.42);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #f4efe3;
    }
    body #mobileControls .ctrl-btn:active, body #mobileControls .ctrl-btn.active { background: rgba(244, 239, 227, 0.28); }
    body #mobileControls .ctrl-btn.action-btn {
      background: #e9b44c; color: #1b140a; border-color: transparent;
      font-family: "Inter Variable", Inter, system-ui, sans-serif; font-weight: 700; letter-spacing: 0.06em;
    }
    body #mobileControls .ctrl-btn.action-btn:active, body #mobileControls .ctrl-btn.action-btn.active { background: #f2c66a; }
    body #mobileControls .gyro-toggle {
      font-family: "Inter Variable", Inter, system-ui, sans-serif; border: 1px solid rgba(244, 239, 227, 0.22);
      background: rgba(12, 26, 22, 0.45); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
    /* Below the map card (136 px, or 104 px on landscape phones) */
    body #mobileControls .gyro-toggle { top: 158px !important; right: 12px !important; }
    .credit-pop {
      position: fixed; z-index: 120; pointer-events: none; transform-origin: 50% 100%;
      translate: -50% -100%; display: flex; flex-direction: column; align-items: center; gap: 1px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.55);
    }
    .credit-pop b { font: 700 22px/1 "Fraunces Variable", Fraunces, Georgia, serif; color: #e9b44c; }
    .credit-pop span { font: 600 10px/1 "Inter Variable", Inter, system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: #f4efe3; }
    @media (max-height: 520px) {
      body #gameHUD .hud-bar { padding: 8px 10px; gap: 6px; }
      body #gameHUD .hud-item { padding: 5px 10px 6px; }
      body #gameHUD .hud-item .value { font-size: 17px; }
      body #gameHUD #hud-nextStop { top: 56px; left: 10px; font-size: 12px; padding: 6px 12px; }
      body #gameHUD #hud-river { font-size: 16px; top: 8px; padding: 5px 14px 6px; }
      body #mobileControls .gyro-toggle { top: 120px !important; right: 8px !important; }
    }
  `;
  document.head.appendChild(style);
}
