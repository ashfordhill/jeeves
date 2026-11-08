import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

const serverPort = Number(process.env.JEEVES_SERVER_PORT ?? 4310);

// Archives/Docker builds omit .git and may not have Git installed. Unknown is explicit.
const rendererIdentity = (() => {
  try {
    const git = (args: string[]) =>
      execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return {
      commit: git(["rev-parse", "HEAD"]),
      dirty: !!git(["status", "--porcelain", "--untracked-files=no"]),
    };
  } catch {
    return { commit: null, dirty: null };
  }
})();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __RENDERER_COMMIT__: JSON.stringify(rendererIdentity.commit),
    __RENDERER_DIRTY__: JSON.stringify(rendererIdentity.dirty),
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
