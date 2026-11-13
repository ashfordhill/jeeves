// Generated scaffold: Watch API (Microservice) runs as app-watch-api, an HTTP process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { positiveCacheBindings } from "../features/positive-cache-bindings.ts";
import { input, pool, selected } from "../features/service-resources.ts";
import { watchApiVideoDetailsCacheHooks } from "../modules/watch-api/watch-api-video-details-cache.hooks.ts";
import type { Dependencies as WatchApiViewCountReaderDependencies } from "../modules/watch-api/watch-api-view-count-reader.slots.ts";
import { watchApiViewCountReader } from "../modules/watch-api/watch-api-view-count-reader.ts";
import type { Dependencies as WatchApiViewPublisherDependencies } from "../modules/watch-api/watch-api-view-publisher.slots.ts";
import { watchApiViewPublisher } from "../modules/watch-api/watch-api-view-publisher.ts";
import { HttpError, createHttpService } from "../runtime/http.ts";
import { createPrincipalVerifier } from "../runtime/identity.ts";
import { createProbeLog, databaseClient, queuePublisher } from "../runtime/module-clients.ts";
import { createPositiveReader } from "../runtime/positive-cache.ts";
import { runProcess } from "../runtime/process.ts";
import { createTileGuard } from "../runtime/tile-guard.ts";
import { notImplementedRoutes, stubRoutes } from "../runtime/tile-http.ts";
import { brokerState, createFailureLog, createNotImplementedLog, logStarted } from "../runtime/tile-process.ts";
import { createValkeyCache } from "../runtime/valkey.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "watch-api",
  "kind": "service",
  "shape": "http",
  "exposure": "public",
  "settings": {
    "requestTimeoutMs": 1000,
    "concurrencyLimit": 2000
  },
  "listen": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "templates": {
    "watch-api-viewer-check": {
      "template": "verified-identity",
      "lead": "watch-api-viewer-check",
      "identity": "sign-in",
      "signIn": "optional",
      "me": "/modules/watch-api-viewer-check/me"
    },
    "watch-api-video-details-cache": {
      "template": "positive-cache-read",
      "lead": "watch-api-video-details-cache",
      "route": "/modules/watch-api-video-details-cache/:key"
    }
  },
  "stubs": [
    {
      "module": "watch-api-view-count-reader",
      "path": "/modules/watch-api-view-count-reader"
    },
    {
      "module": "watch-api-view-publisher",
      "path": "/modules/watch-api-view-publisher"
    }
  ]
} as const;

await runProcess(async (scope) => {
  // A failure the process survives writes one error line, at most once a second for each.
  const failure = createFailureLog(config.tile);
  // "Not implemented" answers 501 with one log line per module and hook a second.
  const log = createNotImplementedLog(config.tile);
  // Module clients (src/runtime/module-clients.ts): one per store or channel this tile's stubs
  // use, each probed once before the process is ready; a failed probe fails startup.
  const probe = createProbeLog(config.tile);
  const clients = {
    "metadata": await databaseClient(scope, probe, { tile: config.tile, resource: "metadata" }),
    "view-counts": await databaseClient(scope, probe, { tile: config.tile, resource: "view-counts" }),
    "view-events": await queuePublisher(scope, probe, { queue: "view-events", mode: "topic" }, brokerState(config.tile, failure, "broker publish view-events")),
  };
  // Each stub's dependencies: its clients, and a module link calls that module's entry point.
  const dependencies = {} as {
    "watch-api-view-count-reader": WatchApiViewCountReaderDependencies;
    "watch-api-view-publisher": WatchApiViewPublisherDependencies;
  };
  dependencies["watch-api-view-count-reader"] = {
    viewCounts: clients["view-counts"],
  };
  dependencies["watch-api-view-publisher"] = {
    viewEvents: clients["view-events"],
    metadata: clients["metadata"],
  };
  // Viewer check: the tile's sign-in, Optional: a token sent with a request is verified; none is anonymous.
  const watchApiViewerCheck = (() => {
    const binding = config.templates["watch-api-viewer-check"];
    return createTileGuard({
      signIn: binding.signIn,
      verify: createPrincipalVerifier({
        issuer: process.env.OIDC_ISSUER ?? "",
        audience: `${binding.identity}-web`,
        jwksUrl: process.env.OIDC_JWKS_URL ?? "",
        algorithms: ["RS256"],
        jwksTimeoutMs: 3000,
      }),
    });
  })();
  // Video details cache: the cache read template's reader on the source login and the cache.
  const watchApiVideoDetailsCache = await (async () => {
    const s = selected("positive-cache-read", "watch-api-video-details-cache");
    const source = pool(scope, s, "source");
    const cache = await createValkeyCache({
      binding: positiveCacheBindings["watch-api-video-details-cache"].cache,
      onState: (state, error) =>
        state === "unavailable"
          ? failure("cache watch-api-video-details-cache", error ?? new Error("Cache unavailable"))
          : console.log(JSON.stringify({ level: "info", event: "cache", tile: config.tile, module: "watch-api-video-details-cache", state })),
    });
    scope.own(() => cache.close());
    const read = createPositiveReader({
      adapter: watchApiVideoDetailsCacheHooks({ source }),
      cache,
      ttlSeconds: input(s, "cache.ttlSeconds"),
      onFailure: (what, error) => failure(`${what} watch-api-video-details-cache`, error),
    });
    return { source, read };
  })();
  const service = await createHttpService({
    id: config.tile,
    settings: config.settings,
    onFailure: failure,
    configure: (open) => {
      // Every module route checks its caller first: the tile's sign-in.
      const routes = watchApiViewerCheck.routes(open);
      watchApiViewerCheck.me(routes, "/modules/watch-api-viewer-check/me");
      notImplementedRoutes(routes, log, "watch-api-video-details-cache").route({
        method: "GET",
        url: "/modules/watch-api-video-details-cache/:key",
        handler: async (request) => {
          const record = await watchApiVideoDetailsCache.read({ key: (request.params as { key: string }).key });
          if (record === null) throw new HttpError(404, "NOT_FOUND", "No record for this key.");
          return record;
        },
      });
      stubRoutes(
        routes,
        log,
        "watch-api-view-count-reader",
        (request) => watchApiViewCountReader(dependencies["watch-api-view-count-reader"], request),
        watchApiViewerCheck.caller,
      );
      stubRoutes(
        routes,
        log,
        "watch-api-view-publisher",
        (request) => watchApiViewPublisher(dependencies["watch-api-view-publisher"], request),
        watchApiViewerCheck.caller,
      );
    },
    initialize: async () => {
      await watchApiVideoDetailsCache.source.query("SELECT 1");
    },
  });
  // Draining stops admission first, then waits for admitted requests.
  scope.own(() => service.close());
  await service.start(config.listen);
  logStarted(config.tile, {"module":"watch-api-viewer-check","template":"verified-identity","wiring":"mounted","checks":["sign-in Optional on every module route"]});
  logStarted(config.tile, {"module":"watch-api-video-details-cache","template":"positive-cache-read","wiring":"mounted","checks":["SELECT 1 on its source login"]});
  scope.ready();
});
