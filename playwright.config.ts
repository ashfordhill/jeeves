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
    trace: "on-first-retry",
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
        // Its own database: a `pnpm dev` server on the same Postgres must never pick up (and run
        // a real coding agent on) e2e runs, and the e2e server's restart recovery must never
        // pause the dev server's runs.
        DATABASE_URL: "postgres://jeeves:jeeves@127.0.0.1:54329/jeeves_e2e",
        // Chat replays a scripted model; settings go to a throwaway directory, not ~/.jeeves.
        JEEVES_FAKE_MODEL_SCRIPT: fileURLToPath(
          new URL("./fixtures/chat/e2e-script.json", import.meta.url),
        ),
        JEEVES_HOME: mkdtempSync(join(tmpdir(), "jeeves-e2e-")),
        // Generate's default output folders go somewhere throwaway too.
        JEEVES_PROJECTS_DIR: mkdtempSync(join(tmpdir(), "jeeves-e2e-projects-")),
        OPENAI_API_KEY: "",
        // Tasks run a scripted coding agent (real git, diffs, and owned-path checks) and quick
        // marker checks instead of Docker and the template test packs.
        JEEVES_FAKE_CODING_SCRIPT: fileURLToPath(
          new URL("./fixtures/coding/e2e-script.json", import.meta.url),
        ),
        JEEVES_FAKE_CHECKS: "300",
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
