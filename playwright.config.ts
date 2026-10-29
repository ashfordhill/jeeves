import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Separate ports from `pnpm dev` so e2e can run while a dev session is open.
const webPort = 4301;
const serverPort = 4311;
const webOrigin = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: webOrigin,
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @jeeves/server start",
      url: `http://127.0.0.1:${serverPort}/health`,
      env: {
        JEEVES_SERVER_PORT: String(serverPort),
        // Chat replays a scripted model; settings go to a throwaway directory, not ~/.jeeves.
        JEEVES_FAKE_MODEL_SCRIPT: fileURLToPath(
          new URL("./fixtures/chat/e2e-script.json", import.meta.url),
        ),
        JEEVES_HOME: mkdtempSync(join(tmpdir(), "jeeves-e2e-")),
        // Generate's default output folders go somewhere throwaway too.
        JEEVES_PROJECTS_DIR: mkdtempSync(join(tmpdir(), "jeeves-e2e-projects-")),
        OPENAI_API_KEY: "",
        // Run execution is a stub until S12: each task takes this long, so Pause can be clicked.
        JEEVES_STUB_TASK_MS: "2000",
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
