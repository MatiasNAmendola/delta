import { execSync } from "node:child_process";
import { defineConfig } from "vite";

// Which build is running, shown on the start screen: commit and deploy time
const sha = (process.env.GITHUB_SHA ?? (() => {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "local";
  }
})()).slice(0, 7);

export default defineConfig({
  base: "/delta/",
  plugins: [
    {
      // version.json: the deployed build, polled by src/pwa/updates.ts
      name: "delta-version",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ sha }) });
      },
    },
  ],
  define: {
    __BUILD__: JSON.stringify({ sha, time: new Date().toISOString() }),
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
  },
});
