import { mkdtempSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Separate ports from `pnpm dev` so e2e can run while a dev session is open.
const webPort = 4301;
const serverPort = 4311;
const webOrigin = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  outputDir: "./test-results",
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  // Leave room for browser rendering, Vite and the API alongside local field applications.
  workers: Math.min(3, Math.max(1, Math.floor(availableParallelism() / 2))),
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @jeeves/server start",
      url: `http://127.0.0.1:${serverPort}/health`,
      env: {
        JEEVES_SERVER_PORT: String(serverPort),
        // Its own database, so e2e projects never mix with a `pnpm dev` server's projects.
        DATABASE_URL: "postgres://jeeves:jeeves@127.0.0.1:54329/jeeves_e2e",
        // Chat replays a scripted model; settings go to a throwaway directory, not ~/.jeeves.
        JEEVES_FAKE_MODEL_SCRIPT: fileURLToPath(
          new URL("./fixtures/chat/e2e-script.json", import.meta.url),
        ),
        JEEVES_HOME: mkdtempSync(join(tmpdir(), "jeeves-e2e-")),
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        // Codex is a stand-in that signs no one in, with a login directory of its own: the server
        // never runs the real `codex` or sees the login in ~/.codex, so Codex reads as signed out.
        JEEVES_CODEX_PATH: fileURLToPath(new URL("./apps/web/e2e/fake-codex.mjs", import.meta.url)),
        CODEX_HOME: mkdtempSync(join(tmpdir(), "jeeves-e2e-codex-")),
        CODEX_API_KEY: "",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @jeeves/web dev",
      url: webOrigin,
      env: { JEEVES_WEB_PORT: String(webPort), JEEVES_SERVER_PORT: String(serverPort) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
