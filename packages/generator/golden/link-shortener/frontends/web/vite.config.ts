// Vite config for Web app. Project-owned. `npm run dev` serves the app the way its container
// does: the runtime config and API proxies come from @jeeves/web-runtime's jeevesDev plugin.
import { jeevesDev } from "@jeeves/web-runtime/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), jeevesDev({ title: "Shorty" })],
  server: { host: "127.0.0.1" },
});
