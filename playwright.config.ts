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
      env: { JEEVES_SERVER_PORT: String(serverPort) },
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
