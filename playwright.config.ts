import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30000, // 30s max per test
  expect: { timeout: 10000 }, // 10s max per expect

  use: {
    baseURL: "http://localhost:4173/delta/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // WebGL software rendering for CI
    launchOptions: {
      args: [
        "--use-gl=swiftshader",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    },
  },

  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-android",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 14"] },
    },
  ],

  // Serve the built dist folder (not dev server — faster and more stable)
  webServer: {
    command: "npx vite preview --port 4173",
    port: 4173,
    reuseExistingServer: !isCI,
    timeout: 15000,
  },
});
