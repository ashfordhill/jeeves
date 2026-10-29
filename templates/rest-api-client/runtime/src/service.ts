import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import { createRestClient, type RestClient } from "./client.ts";

export * from "./index.ts";

type Env = Record<string, string | undefined>;

export interface ServiceRestClientOptions {
  /** The target element ID. */
  name: string;
  /** The target API's base path, from its rest-api-server attachment (e.g. `/api`). */
  basePath: string;
  /** The variable holding the target service's address, e.g. `API_LINKS_URL`. */
  urlEnv: string;
  /** The variable holding the bearer token, when the target API requires one. */
  tokenEnv?: string;
  timeoutMs?: number;
  retries?: number;
  fetch?: (request: Request) => Promise<Response>;
}

/**
 * The service-plugin shape of `@jeeves/service-runtime`, matched structurally so this package
 * doesn't depend on it.
 */
export interface RestClientPlugin {
  name: string;
  configure(env: Env): string[];
  register(app: FastifyInstance): void;
}

export type ServiceRestClient<Paths extends {}> = RestClient<Paths> & {
  /** Validates the client's environment at startup and propagates request IDs. */
  plugin: RestClientPlugin;
};

const requestContext = new AsyncLocalStorage<{ requestId: string }>();
const instrumented = new WeakSet<FastifyInstance>();

/**
 * A client for a service calling another service's API. The address and token come from the
 * environment (set by docker-compose.yml); the plugin in the service's generated wiring checks
 * them at startup. Calls made while handling a request send that request's ID.
 */
export function serviceRestClient<Paths extends {}>(
  options: ServiceRestClientOptions,
): ServiceRestClient<Paths> {
  // Set by the plugin at startup; until then (scripts, tests) the process environment is used.
  let configured: Env | undefined;
  const env = () => configured ?? process.env;

  const client = createRestClient<Paths>({
    name: options.name,
    baseUrl: () => {
      const read = readConfig(options, env());
      if (!read.ok) throw new Error(`The ${options.name} API client: ${read.problems.join("; ")}`);
      return read.baseUrl;
    },
    headers: (): Record<string, string> => {
      const token = options.tokenEnv ? env()[options.tokenEnv] : undefined;
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    requestId: () => requestContext.getStore()?.requestId,
    ...(options.timeoutMs !== undefined && { timeoutMs: options.timeoutMs }),
    ...(options.retries !== undefined && { retries: options.retries }),
    ...(options.fetch && { fetch: options.fetch }),
  });

  const plugin: RestClientPlugin = {
    name: `rest-client:${options.name}`,
    configure(values) {
      const read = readConfig(options, values);
      if (!read.ok) return read.problems;
      configured = values;
      return [];
    },
    register(app) {
      if (instrumented.has(app)) return;
      instrumented.add(app);
      app.addHook("onRequest", (request, _reply, done) => {
        requestContext.run({ requestId: request.id }, done);
      });
    },
  };
  return Object.assign(client, { plugin });
}

function readConfig(
  options: ServiceRestClientOptions,
  env: Env,
): { ok: true; baseUrl: string } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const raw = env[options.urlEnv]?.trim();
  let origin = "";
  if (!raw) {
    problems.push(`${options.urlEnv}: required (the address of the ${options.name} service)`);
  } else {
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http");
      origin = raw.replace(/\/+$/, "");
    } catch {
      problems.push(`${options.urlEnv}: must be an http(s) URL (got "${raw}")`);
    }
  }
  if (options.tokenEnv && !env[options.tokenEnv]?.trim()) {
    problems.push(`${options.tokenEnv}: required (the ${options.name} API uses bearer auth)`);
  }
  if (problems.length > 0) return { ok: false, problems };
  const basePath = options.basePath === "/" ? "" : options.basePath.replace(/\/+$/, "");
  return { ok: true, baseUrl: `${origin}${basePath}` };
}
