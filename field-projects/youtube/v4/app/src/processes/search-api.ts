// Generated scaffold: Search API (Microservice) runs as app-search-api, an HTTP process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { searchBindings } from "../features/search-bindings.ts";
import { input, selected } from "../features/service-resources.ts";
import { searchApiVideoSearchHooks } from "../modules/search-api/search-api-video-search.hooks.ts";
import { searchIndexerIndexWriterHooks } from "../modules/search-indexer/search-indexer-index-writer.hooks.ts";
import { HttpError, createHttpService } from "../runtime/http.ts";
import { runProcess } from "../runtime/process.ts";
import { parseSearchInput } from "../runtime/search-query.ts";
import { createSearch } from "../runtime/search.ts";
import { notImplementedRoutes } from "../runtime/tile-http.ts";
import { createFailureLog, createNotImplementedLog, logStarted } from "../runtime/tile-process.ts";
import { createSearchHandler, openSearchIndex } from "../runtime/tile-search.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "search-api",
  "kind": "service",
  "shape": "http",
  "exposure": "public",
  "settings": {
    "requestTimeoutMs": 1000,
    "concurrencyLimit": 1000
  },
  "listen": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "templates": {
    "search-api-video-search": {
      "template": "search-query",
      "lead": "search-api-video-search",
      "route": "/modules/search-api-video-search",
      "index": "videos"
    }
  }
} as const;

await runProcess(async (scope) => {
  // A failure the process survives writes one error line, at most once a second for each.
  const failure = createFailureLog(config.tile);
  // "Not implemented" answers 501 with one log line per module and hook a second.
  const log = createNotImplementedLog(config.tile);
  // Video search: the search query template on its index, with Index writer's mapping and document.
  const searchApiVideoSearch = await (async () => {
    const s = selected("search-query", "search-api-video-search");
    const binding = searchBindings["search-api-video-search"];
    const client = createSearch({
      endpoint: binding.index.endpoint,
      requestTimeoutMs: input(s, "host.requestTimeoutMs"),
    });
    scope.own(() => client.close());
    // The search service answers; the index is asserted once its mapping is written.
    await client.cluster.health();
    const indexHooks = searchIndexerIndexWriterHooks();
    const index = await openSearchIndex(client, binding.index.resource, indexHooks);
    return createSearchHandler({ client, index, indexHooks, hooks: searchApiVideoSearchHooks() });
  })();
  const service = await createHttpService({
    id: config.tile,
    settings: config.settings,
    onFailure: failure,
    configure: (routes) => {
      notImplementedRoutes(routes, log, "search-api-video-search").route({
        method: "GET",
        url: "/modules/search-api-video-search",
        handler: async (request) => {
          try {
            parseSearchInput(request.query);
          } catch {
            throw new HttpError(
              400,
              "SEARCH_QUERY",
              "Enter a query of 1–200 characters and a page from 1–100.",
            );
          }
          return searchApiVideoSearch(request.query);
        },
      });
    },
    initialize: async () => {},
  });
  // Draining stops admission first, then waits for admitted requests.
  scope.own(() => service.close());
  await service.start(config.listen);
  logStarted(config.tile, {"module":"search-api-video-search","template":"search-query","wiring":"mounted","checks":["cluster health","index videos asserted once its mapping is written"]});
  scope.ready();
});
