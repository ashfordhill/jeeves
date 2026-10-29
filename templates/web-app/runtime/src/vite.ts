import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin, ProxyOptions } from "vite";
import { CONFIG_URL, parseRuntimeConfig, renderConfigTemplate } from "./config.ts";

export interface JeevesDevOptions {
  /** `APP_TITLE` when the environment doesn't set it. */
  title: string;
  /** The runtime config template. Defaults to the generated `nginx/jeeves-config.json.template`. */
  configTemplate?: string;
}

/** `API_<NAME>_URL`, as compose sets it for the container (`@jeeves/template-kit` convention). */
export function apiEnvName(name: string, what: "URL" | "TOKEN"): string {
  return `API_${name.toUpperCase().replaceAll("-", "_")}_${what}`;
}

/**
 * Makes `vite dev` behave like the container: serves the runtime config from the generated
 * template and the environment, and proxies each API's path to `API_<NAME>_URL` (adding
 * `API_<NAME>_TOKEN` as a bearer token). Point those variables at the services' published ports,
 * for example `API_LINKS_URL=http://127.0.0.1:$(docker compose port links 8080 | cut -d: -f2)`.
 */
export function jeevesDev(options: JeevesDevOptions): Plugin {
  let root = process.cwd();
  const render = () => {
    const file = resolve(root, options.configTemplate ?? "nginx/jeeves-config.json.template");
    const env = { ...process.env, APP_TITLE: process.env.APP_TITLE || options.title };
    return renderConfigTemplate(readFileSync(file, "utf8"), env);
  };
  return {
    name: "jeeves-dev",
    // Builds don't need it: the container serves the config and proxies the APIs.
    apply: "serve",
    config(config) {
      root = resolve(config.root ?? process.cwd());
      const proxy: Record<string, ProxyOptions> = {};
      for (const [name, api] of Object.entries(parseRuntimeConfig(JSON.parse(render())).apis)) {
        const target = process.env[apiEnvName(name, "URL")];
        if (!target) continue;
        const token = process.env[apiEnvName(name, "TOKEN")];
        proxy[api.url] = {
          target,
          changeOrigin: true,
          rewrite: (path) => path.slice(api.url.length) || "/",
          ...(token && { headers: { authorization: `Bearer ${token}` } }),
        };
      }
      return { server: { proxy } };
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? "").split("?")[0] ?? "";
        if (path === CONFIG_URL) {
          response.setHeader("content-type", "application/json");
          response.setHeader("cache-control", "no-store");
          response.end(render());
          return;
        }
        // Proxied APIs never reach this middleware; an API path that does isn't configured.
        const match = /^\/_api\/([a-z0-9-]+)(?:\/|$)/.exec(path);
        if (match?.[1]) {
          response.statusCode = 502;
          response.setHeader("content-type", "application/json");
          response.end(
            JSON.stringify({
              error: "API_NOT_CONFIGURED",
              message: `Set ${apiEnvName(match[1], "URL")} to the ${match[1]} service's address and restart the dev server`,
            }),
          );
          return;
        }
        next();
      });
    },
  };
}
