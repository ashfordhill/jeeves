import { randomUUID } from "node:crypto";
import Fastify, { type FastifyBaseLogger, type FastifyInstance, LogController } from "fastify";
import { z } from "zod";
import {
  type Env,
  parseEnv,
  type ServiceConfig,
  ServiceConfigError,
  type ServiceDefaults,
  serviceConfigFromEnv,
} from "./config.ts";
import {
  type Feature,
  type FeatureContext,
  loadFeatures,
  type OperationHandler,
} from "./feature.ts";

export type ReadyResult = { ok: true } | { ok: false; error: string };

/** Logging methods dependencies and plugins may use (a pino logger fits). */
export interface Log {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Something the service needs to be useful, such as its database. Added by the generated wiring
 * from the design's connections; `/ready` reports each one.
 */
export interface Dependency {
  name: string;
  /** Reads the dependency's environment; returns problems, empty when it's fine. */
  configure?(env: Env): string[];
  /** Connects and prepares (for example, applies migrations) before features start. */
  start?(log: Log): Promise<void>;
  ready(): Promise<ReadyResult>;
  close?(): Promise<void>;
}

export interface RegisteredOperation {
  feature: string;
  handler: OperationHandler;
}

export interface PluginContext {
  service: string;
  config: ServiceConfig;
  log: FastifyBaseLogger;
  /** Operation handlers declared by features, by `operationId`. */
  operations: ReadonlyMap<string, RegisteredOperation>;
}

/** A capability added by an attachment template's runtime, such as `@jeeves/rest-server`. */
export interface ServicePlugin {
  name: string;
  configure?(env: Env): string[];
  /** Whether this plugin serves the `operations` features declare. */
  servesOperations?: boolean;
  register(app: FastifyInstance, ctx: PluginContext): void | Promise<void>;
}

/** The service as the design describes it; written by Jeeves into `src/jeeves.generated.ts`. */
export interface ServiceDefinition {
  /** The element ID. */
  name: string;
  displayName?: string;
  defaults?: ServiceDefaults;
  dependencies?: Dependency[];
  plugins?: ServicePlugin[];
}

export function defineService(definition: ServiceDefinition): ServiceDefinition {
  return definition;
}

export interface ServiceOptions {
  env?: Env;
  /** Features, or the folder to load them from (`new URL("./features/", import.meta.url)`). */
  features?: Feature[] | URL | string;
  /** Fastify's `logger` option; defaults to pino JSON on stdout at `LOG_LEVEL`. */
  logger?: boolean | Record<string, unknown>;
}

export interface Service {
  app: FastifyInstance;
  config: ServiceConfig;
  /** Opens the port; returns the address. */
  listen(): Promise<string>;
  /** Graceful shutdown: stops taking requests, finishes in-flight ones, then closes everything. */
  stop(): Promise<void>;
}

export interface ReadinessReport {
  status: "ready" | "not-ready" | "shutting-down";
  dependencies: Record<string, ReadyResult>;
}

/**
 * Builds the service: validates the environment (every problem at once), starts dependencies,
 * registers plugins and features, and runs startup tasks. The port isn't opened yet.
 */
export async function createService(
  definition: ServiceDefinition,
  options: ServiceOptions = {},
): Promise<Service> {
  const env = options.env ?? process.env;
  const features =
    options.features === undefined
      ? []
      : Array.isArray(options.features)
        ? options.features
        : await loadFeatures(options.features);
  const dependencies = definition.dependencies ?? [];
  const plugins = definition.plugins ?? [];
  const operations = collectOperations(definition, features, plugins);

  const problems: string[] = [];
  const configResult = serviceConfigFromEnv(env, definition.defaults);
  if (!configResult.ok) problems.push(...configResult.problems);
  for (const part of [...dependencies, ...plugins]) problems.push(...(part.configure?.(env) ?? []));
  const featureEnv = new Map<Feature, Record<string, unknown>>();
  for (const feature of features) {
    const parsed = parseEnv(z.object(feature.env ?? {}), env);
    if (parsed.ok) featureEnv.set(feature, parsed.value);
    else problems.push(...parsed.problems.map((p) => `${p} (feature "${feature.name}")`));
  }
  if (!configResult.ok || problems.length > 0) {
    throw new ServiceConfigError(definition.name, problems);
  }
  const config = configResult.value;

  const app = Fastify({
    logger: options.logger ?? { level: config.logLevel, base: { service: definition.name } },
    // Health checks run every few seconds; logging them would drown everything else.
    logController: new LogController({
      disableRequestLogging: (request) => request.url === "/health" || request.url === "/ready",
    }),
    forceCloseConnections: "idle",
    // One ID per request across services: adopt the caller's, else make a UUID. REST clients
    // (@jeeves/rest-client) forward it on the calls a request makes.
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });

  let shuttingDown = false;
  // Keep-alive connections that finish a request during shutdown would otherwise stay open and
  // hold up `close()`.
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
    if (shuttingDown) reply.header("connection", "close");
  });
  const readiness = async (): Promise<ReadinessReport> => {
    const entries = await Promise.all(
      dependencies.map(async (d) => [d.name, await within(d.ready(), config.readyTimeoutMs)]),
    );
    const results = Object.fromEntries(entries) as Record<string, ReadyResult>;
    const ok = Object.values(results).every((r) => r.ok);
    const status = shuttingDown ? "shutting-down" : ok ? "ready" : "not-ready";
    return { status, dependencies: results };
  };
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    const report = await readiness();
    return reply.code(report.status === "ready" ? 200 : 503).send(report);
  });

  const started: Dependency[] = [];
  const closeDependencies = async () => {
    for (const dependency of [...started].reverse()) {
      await dependency.close?.().catch((error: unknown) => {
        app.log.error({ err: error }, `closing ${dependency.name} failed`);
      });
    }
  };
  try {
    for (const dependency of dependencies) {
      started.push(dependency);
      try {
        await dependency.start?.(logOf(app.log));
      } catch (error) {
        throw new Error(`Dependency "${dependency.name}" failed to start: ${messageOf(error)}`, {
          cause: error,
        });
      }
    }
    const pluginContext: PluginContext = {
      service: definition.name,
      config,
      log: app.log,
      operations,
    };
    for (const plugin of plugins) await plugin.register(app, pluginContext);
    const contexts = new Map<Feature, FeatureContext>();
    for (const feature of features) {
      const ctx: FeatureContext = {
        service: definition.name,
        config,
        env: featureEnv.get(feature) ?? {},
        log: app.log.child({ feature: feature.name }),
      };
      contexts.set(feature, ctx);
      await feature.register?.(app, ctx);
    }
    await app.ready();
    for (const feature of features) {
      const ctx = contexts.get(feature);
      if (ctx) await feature.start?.(ctx);
    }
  } catch (error) {
    await app.close().catch(() => {});
    await closeDependencies();
    throw error;
  }

  let stopping: Promise<void> | undefined;
  return {
    app,
    config,
    listen: () => app.listen({ port: config.port, host: config.host }),
    stop() {
      stopping ??= (async () => {
        shuttingDown = true;
        await app.close();
        for (const feature of [...features].reverse()) await feature.stop?.();
        await closeDependencies();
      })();
      return stopping;
    },
  };
}

function collectOperations(
  definition: ServiceDefinition,
  features: Feature[],
  plugins: ServicePlugin[],
): Map<string, RegisteredOperation> {
  const names = new Set<string>();
  const operations = new Map<string, RegisteredOperation>();
  for (const feature of features) {
    if (names.has(feature.name)) throw new Error(`Two features are named "${feature.name}"`);
    names.add(feature.name);
    for (const [operationId, handler] of Object.entries(feature.operations ?? {})) {
      const existing = operations.get(operationId);
      if (existing) {
        throw new Error(
          `Operation "${operationId}" is handled by both "${existing.feature}" and "${feature.name}"`,
        );
      }
      operations.set(operationId, { feature: feature.name, handler });
    }
  }
  if (operations.size > 0 && !plugins.some((p) => p.servesOperations)) {
    const first = [...operations.values()][0]?.feature;
    throw new Error(
      `Feature "${first}" declares operations, but service "${definition.name}" has no API to serve them (add a rest-api-server attachment in the design)`,
    );
  }
  return operations;
}

/** `createService`, then opens the port. */
export async function runService(
  definition: ServiceDefinition,
  options: ServiceOptions = {},
): Promise<Service & { address: string }> {
  const service = await createService(definition, options);
  try {
    const address = await service.listen();
    return { ...service, address };
  } catch (error) {
    await service.stop();
    throw error;
  }
}

/**
 * The entry point `src/main.ts` calls. Starts the service, shuts it down gracefully on SIGTERM or
 * SIGINT (exit code 0, or 1 when it takes longer than `SHUTDOWN_TIMEOUT_MS`), and turns startup
 * failures into a readable message and exit code 1.
 */
export async function startService(
  definition: ServiceDefinition,
  options: ServiceOptions = {},
): Promise<void> {
  let service: Service & { address: string };
  try {
    service = await runService(definition, options);
  } catch (error) {
    if (error instanceof ServiceConfigError) console.error(error.message);
    else console.error(`Service "${definition.name}" failed to start: ${describeError(error)}`);
    process.exit(1);
  }
  const log = service.app.log;
  log.info(`${definition.displayName ?? definition.name} listening on ${service.address}`);

  const shutdown = async (signal: string) => {
    log.info(`${signal} received, shutting down`);
    const timer = setTimeout(() => {
      log.error(`shutdown took longer than ${service.config.shutdownTimeoutMs} ms; exiting`);
      process.exit(1);
    }, service.config.shutdownTimeoutMs);
    timer.unref();
    try {
      await service.stop();
      log.info("stopped");
      process.exit(0);
    } catch (error) {
      log.error({ err: error }, "shutdown failed");
      process.exit(1);
    }
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

async function within(promise: Promise<ReadyResult>, ms: number): Promise<ReadyResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<ReadyResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: `no answer within ${ms} ms` }), ms);
  });
  try {
    return await Promise.race([
      promise.catch((error: unknown) => ({ ok: false as const, error: messageOf(error) })),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function logOf(log: FastifyBaseLogger): Log {
  return {
    info: (message) => log.info(message),
    warn: (message) => log.warn(message),
    error: (message) => log.error(message),
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Message plus stack for unexpected errors; known startup errors read better without it. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error || !error.stack ? error.message : error.stack;
}
