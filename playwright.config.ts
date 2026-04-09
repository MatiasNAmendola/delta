import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000/delta/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // WebGL needs this
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader"],
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

  // Start dev server before tests
  webServer: {
    command: "npx vite --port 3000",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
