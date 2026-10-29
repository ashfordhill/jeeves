import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

const serverPort = Number(process.env.JEEVES_SERVER_PORT ?? 4310);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.JEEVES_WEB_PORT ?? 4300),
    strictPort: true,
    // The UI calls /api/*; the server's routes have no prefix.
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${serverPort}`,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/vitest.setup.ts"],
  },
});
