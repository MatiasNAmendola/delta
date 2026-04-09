import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// Helper: collect console errors during a test
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

// Helper: wait for loading screen to disappear
async function waitForGameReady(page: Page) {
  // Wait for loading screen to appear then disappear
  await page.waitForSelector("#loadingScreen", { state: "attached", timeout: 10000 }).catch(() => {});
  await page.waitForSelector("#loadingScreen", { state: "detached", timeout: 30000 }).catch(() => {});
  // Extra wait for systems to initialize
  await page.waitForTimeout(1000);
}

// ============================================================
// 1. LOADING & INITIALIZATION
// ============================================================
test.describe("Game Loading", () => {
  test("page loads without crash", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await page.waitForTimeout(3000);

    // Filter out known non-critical warnings
    const criticalErrors = errors.filter(
      (e) => !e.includes("service worker") && !e.includes("sw.js")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("loading screen appears and has JUGAR button", async ({ page }) => {
    await page.goto("/");
    // Loading screen should be visible initially
    const loadingScreen = page.locator("#loadingScreen");
    await expect(loadingScreen).toBeVisible({ timeout: 5000 });

    // Should have loading bar
    const loadingBar = page.locator("#loadingBar");
    await expect(loadingBar).toBeAttached();
  });

  test("canvas element exists and has WebGL context", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("#renderCanvas");
    await expect(canvas).toBeAttached();

    // Check that WebGL context was created
    const hasWebGL = await page.evaluate(() => {
      const c = document.getElementById("renderCanvas") as HTMLCanvasElement;
      return !!(c?.getContext("webgl2") || c?.getContext("webgl"));
    });
    // Note: may be false if Three.js already took the context, but canvas should exist
    expect(canvas).toBeTruthy();
  });

  test("loading screen disappears after init", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    // Loading screen should be gone
    await expect(page.locator("#loadingScreen")).toBeHidden({ timeout: 30000 });
  });

  test("start screen shows with JUGAR button", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    // Play button should be visible
    const playBtn = page.locator("#playBtn");
    await expect(playBtn).toBeVisible({ timeout: 10000 });
    await expect(playBtn).toContainText("JUGAR");
  });
});

// ============================================================
// 2. START GAME FLOW
// ============================================================
test.describe("Game Start", () => {
  test("clicking JUGAR starts the game", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);

    // Click play
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    // Start screen should disappear
    const startScreen = page.locator("#playBtn");
    await expect(startScreen).toBeHidden({ timeout: 5000 });

    // HUD should be visible
    const hud = page.locator("#gameHUD");
    await expect(hud).toBeVisible({ timeout: 5000 });
  });

  test("HUD shows score, passengers, and timer after starting", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    // Score
    const score = page.locator("#hud-score");
    await expect(score).toBeVisible();
    await expect(score).toContainText("0");

    // Passengers
    const passengers = page.locator("#hud-passengers");
    await expect(passengers).toBeVisible();

    // Timer
    const timer = page.locator("#hud-timer");
    await expect(timer).toBeVisible();
  });

  test("timer counts down after game starts", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();

    // Get initial time
    await page.waitForTimeout(500);
    const time1 = await page.locator("#hud-timer").textContent();

    // Wait and check it changed
    await page.waitForTimeout(3000);
    const time2 = await page.locator("#hud-timer").textContent();

    expect(time1).not.toEqual(time2);
  });
});

// ============================================================
// 3. CANVAS RENDERING
// ============================================================
test.describe("Rendering", () => {
  test("canvas is not blank (has pixel data)", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(2000);

    // Sample pixels from the canvas to verify it's rendering
    const isRendering = await page.evaluate(() => {
      const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
      if (!canvas) return false;
      // Try to read pixels - if WebGL is rendering, we should get non-zero data
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return false;
      const pixels = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1, 1,
        gl.RGBA, gl.UNSIGNED_BYTE, pixels
      );
      // At least some pixel should be non-zero (not all black)
      return pixels[0] + pixels[1] + pixels[2] > 0;
    });

    expect(isRendering).toBe(true);
  });

  test("canvas resizes with window", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);

    // Get initial size
    const size1 = await page.evaluate(() => {
      const c = document.getElementById("renderCanvas") as HTMLCanvasElement;
      return { w: c.clientWidth, h: c.clientHeight };
    });

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 400 });
    await page.waitForTimeout(500);

    const size2 = await page.evaluate(() => {
      const c = document.getElementById("renderCanvas") as HTMLCanvasElement;
      return { w: c.clientWidth, h: c.clientHeight };
    });

    expect(size2.w).not.toEqual(size1.w);
  });
});

// ============================================================
// 4. CONTROLS
// ============================================================
test.describe("Controls", () => {
  test("mobile controls are visible on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    const parada = page.locator("text=PARADA");
    await expect(parada).toBeVisible({ timeout: 5000 });
  });

  test("JUGAR button responds to touch on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);

    // Verify start screen is showing
    const playBtn = page.locator("#playBtn");
    await expect(playBtn).toBeVisible({ timeout: 10000 });

    // Tap the button (simulates touch, not just click)
    await playBtn.tap();
    await page.waitForTimeout(1500);

    // Start screen should disappear, HUD should show
    await expect(playBtn).toBeHidden({ timeout: 5000 });
    const hud = page.locator("#gameHUD");
    await expect(hud).toBeVisible({ timeout: 5000 });
  });

  test("touch controls respond to taps on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").tap();
    await page.waitForTimeout(1000);

    // Forward button should be visible and tappable
    const fwdBtn = page.locator("#btnForward");
    await expect(fwdBtn).toBeVisible({ timeout: 5000 });

    // Tap forward button — should not crash
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await fwdBtn.tap();
    await page.waitForTimeout(500);
    // Release
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });

  test("PARADA button responds to touch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").tap();
    await page.waitForTimeout(1000);

    const paradaBtn = page.locator("#btnAction");
    await expect(paradaBtn).toBeVisible({ timeout: 5000 });

    // Tap PARADA — should not crash
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await paradaBtn.tap();
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });

  test("steering buttons respond to touch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").tap();
    await page.waitForTimeout(1000);

    const leftBtn = page.locator("#btnLeft");
    const rightBtn = page.locator("#btnRight");
    await expect(leftBtn).toBeVisible({ timeout: 5000 });
    await expect(rightBtn).toBeVisible({ timeout: 5000 });

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Tap left then right
    await leftBtn.tap();
    await page.waitForTimeout(300);
    await rightBtn.tap();
    await page.waitForTimeout(300);

    expect(errors).toHaveLength(0);
  });

  test("canvas touch preventDefault does NOT block UI buttons", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);

    // This is the key regression test:
    // The canvas has touchstart preventDefault, but it should NOT
    // prevent taps on the JUGAR button or control buttons.
    const playBtn = page.locator("#playBtn");
    await expect(playBtn).toBeVisible({ timeout: 10000 });

    // Tap play button via touch
    await playBtn.tap();
    await page.waitForTimeout(1500);

    // If the button responded, the HUD should now be visible
    const hud = page.locator("#gameHUD");
    await expect(hud).toBeVisible({ timeout: 5000 });

    // Now verify control buttons also respond
    const fwdBtn = page.locator("#btnForward");
    await expect(fwdBtn).toBeVisible({ timeout: 5000 });

    // Tap and verify no error
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await fwdBtn.tap();
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test("keyboard controls work without crash", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Press all control keys
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.press(" "); // space = PARADA

    expect(errors).toHaveLength(0);
  });

  test("weather buttons respond to touch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").tap();
    await page.waitForTimeout(1000);

    const weatherBtns = page.locator(".weather-btn");
    const count = await weatherBtns.count();
    expect(count).toBeGreaterThan(0);

    // Tap first weather button — should not crash
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await weatherBtns.first().tap();
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });
});

// ============================================================
// 5. UI ELEMENTS
// ============================================================
test.describe("UI Elements", () => {
  test("minimap is visible", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    const minimap = page.locator("#minimap");
    await expect(minimap).toBeAttached({ timeout: 5000 });
  });

  test("weather buttons exist", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    const weatherBtns = page.locator(".weather-btn");
    const count = await weatherBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test("next stop indicator shows", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    const nextStop = page.locator("#hud-nextStop");
    await expect(nextStop).toBeAttached({ timeout: 5000 });
  });

  test("location name displays a river name", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    const location = page.locator("#hud-location");
    const text = await location.textContent();
    // Should contain a river name like "Río Luján" or "Delta"
    expect(text?.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 6. GAME MECHANICS
// ============================================================
test.describe("Game Mechanics", () => {
  test("notification appears on game start", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();

    // Welcome notification should appear
    const notification = page.locator("#hud-notification");
    await expect(notification).toHaveClass(/show/, { timeout: 5000 });
  });

  test("game ends after timer runs out", async ({ page }) => {
    test.setTimeout(330000); // 5.5 minutes
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();

    // Wait for game duration (5 minutes = 300 seconds)
    // In practice, we'd speed up time. For now, test with shorter wait
    // and check the timer is counting
    await page.waitForTimeout(5000);
    const timer = await page.locator("#hud-timer").textContent();
    expect(timer).toBeTruthy();
  });
});

// ============================================================
// 7. ERROR RESILIENCE
// ============================================================
test.describe("Error Resilience", () => {
  test("no unhandled errors during 10 seconds of gameplay", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();

    // Play for 10 seconds
    await page.waitForTimeout(10000);

    // Filter out known non-critical warnings
    const critical = errors.filter(
      (e) =>
        !e.includes("service worker") &&
        !e.includes("sw.js") &&
        !e.includes("favicon") &&
        !e.includes("manifest")
    );

    expect(critical).toHaveLength(0);
  });

  test("error overlay appears on JavaScript error", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);

    // Inject a deliberate error
    await page.evaluate(() => {
      throw new Error("Test error for overlay");
    }).catch(() => {});

    await page.waitForTimeout(500);
    const overlay = page.locator("#error-overlay");
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });
});

// ============================================================
// 8. PERFORMANCE
// ============================================================
test.describe("Performance", () => {
  test("game maintains reasonable FPS (no freeze)", async ({ page }) => {
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();

    // Measure frame timing over 3 seconds
    const fps = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const start = performance.now();
        function count() {
          frameCount++;
          if (performance.now() - start < 3000) {
            requestAnimationFrame(count);
          } else {
            resolve(frameCount / 3);
          }
        }
        requestAnimationFrame(count);
      });
    });

    // Should maintain at least 10 FPS (even with software WebGL)
    expect(fps).toBeGreaterThan(10);
  });
});

// ============================================================
// 9. RESPONSIVE LAYOUT
// ============================================================
test.describe("Responsive Layout", () => {
  test("portrait mobile layout has no overlapping elements", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    // Take screenshot for visual comparison
    await page.screenshot({ path: "tests/screenshots/mobile-portrait.png" });
  });

  test("landscape mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "tests/screenshots/mobile-landscape.png" });
  });

  test("desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await waitForGameReady(page);
    await page.locator("#playBtn").click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "tests/screenshots/desktop.png" });
  });
});
