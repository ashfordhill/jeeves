import { defineConfig } from "@playwright/test";
import development from "./playwright.config.ts";

/** The same isolated test API/database and strict journeys, served from a freshly built web app. */
export default defineConfig({
  ...development,
  webServer: (Array.isArray(development.webServer) ? development.webServer : []).map(
    (server, index) =>
      index === 1
        ? {
            ...server,
            command: "pnpm --filter @jeeves/web preview --host 127.0.0.1 --port 4301 --strictPort",
          }
        : server,
  ),
});
