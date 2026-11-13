// Generated scaffold: Search indexer (Worker service) runs as app-search-indexer, a worker process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { searchBindings } from "../features/search-bindings.ts";
import { searchIndexerIndexWriterHooks } from "../modules/search-indexer/search-indexer-index-writer.hooks.ts";
import { runProcess } from "../runtime/process.ts";
import { createSearch } from "../runtime/search.ts";
import { createLoopLog, loopConsumer, templateHandler, watchHooks } from "../runtime/tile-loop.ts";
import { createFailureLog, logStarted } from "../runtime/tile-process.ts";
import { openSearchIndex, startSearchIndexWorker } from "../runtime/tile-search.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "search-indexer",
  "kind": "worker",
  "shape": "worker",
  "templates": {
    "search-indexer-index-writer": {
      "template": "search-projection",
      "lead": "search-indexer-index-writer",
      "index": "videos"
    }
  },
  "loops": [
    {
      "module": "search-indexer-index-writer",
      "queue": "publication-events--search-indexer",
      "failedQueue": "publication-events--search-indexer.failed",
      "retryLimit": 5,
      "concurrency": 4
    }
  ]
} as const;

await runProcess(async (scope) => {
  // A failure the process survives writes one error line, at most once a second for each.
  const failure = createFailureLog(config.tile);
  // Loops subscribe before the process is ready. "Not implemented" sends a message to its
  // queue's .failed with one log line per module and hook a second; stopping drains them.
  const loopLog = createLoopLog(config.tile);
  // Index writer: the search indexing template on its index and its events subscriber.
  await (async () => {
    const binding = searchBindings["search-indexer-index-writer"];
    const client = createSearch({ endpoint: binding.index.endpoint, requestTimeoutMs: 5000 });
    scope.own(() => client.close());
    const hooks = watchHooks(searchIndexerIndexWriterHooks(), loopLog, "search-indexer-index-writer");
    // The search service answers; the index is asserted once its mapping is written.
    await client.cluster.health();
    const index = await openSearchIndex(client, binding.index.resource, hooks);
    const worker = await startSearchIndexWorker({
      client,
      index,
      hooks,
      openConsumer: (handle) =>
        loopConsumer(config.loops[0], templateHandler(loopLog, config.loops[0], handle), {
          onFatal: scope.fail,
        }),
    });
    scope.own(() => worker.close());
    scope.transport(worker);
  })();
  logStarted(config.tile, {"module":"search-indexer-index-writer","template":"search-projection","wiring":"mounted","checks":["cluster health","index videos asserted once its mapping is written","subscribed publication-events--search-indexer"]});
  scope.ready();
});
