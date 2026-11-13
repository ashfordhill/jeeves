// Generated scaffold: Video lifecycle (Worker service) runs as app-video-lifecycle, a worker process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { pool, publisher, selected } from "../features/service-resources.ts";
import { videoLifecycleLifecycleWriterHooks } from "../modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";
import { createAssetLifecycle } from "../runtime/asset-lifecycle.ts";
import { startAssetLifecycleWorker } from "../runtime/asset-worker.ts";
import { runProcess } from "../runtime/process.ts";
import { createLoopLog, loopConsumer, templateHandler, watchHooks } from "../runtime/tile-loop.ts";
import { createFailureLog, logStarted } from "../runtime/tile-process.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "video-lifecycle",
  "kind": "worker",
  "shape": "worker",
  "templates": {
    "video-lifecycle-lifecycle-writer": {
      "template": "asset-lifecycle",
      "lead": "video-lifecycle-lifecycle-writer",
      "lifecycle": {
        "relation": {
          "schema": "upload_api_multipart_uploads",
          "table": "assets"
        },
        "receipts": {
          "schema": "upload_api_multipart_uploads",
          "table": "receipts"
        },
        "receiptScope": "video-lifecycle-lifecycle-writer",
        "outbox": {
          "schema": "upload_api_multipart_uploads",
          "table": "outbox",
          "destinations": [
            "jobs",
            "publication"
          ]
        },
        "jobsDestination": "jobs"
      },
      "publication": "publication"
    }
  },
  "loops": [
    {
      "module": "video-lifecycle-lifecycle-writer",
      "queue": "processing-events--video-lifecycle",
      "failedQueue": "processing-events--video-lifecycle.failed",
      "retryLimit": 10,
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
  // Lifecycle writer: the asset lifecycle's worker on its tables, its results subscriber and its publication relay.
  await (async () => {
    const s = selected("asset-lifecycle", "video-lifecycle-lifecycle-writer");
    const binding = config.templates["video-lifecycle-lifecycle-writer"];
    const db = pool(scope, s, "state");
    const hooks = watchHooks(videoLifecycleLifecycleWriterHooks(), loopLog, "video-lifecycle-lifecycle-writer");
    const lifecycle = createAssetLifecycle(
      { ...binding.lifecycle, identities: hooks.identities },
      { ...hooks, publication: { ...hooks.publication, destination: binding.publication } },
    );
    const worker = await startAssetLifecycleWorker({
      pool: db,
      lifecycle,
      openConsumer: (handle) =>
        loopConsumer(config.loops[0], templateHandler(loopLog, config.loops[0], handle), {
          onFatal: scope.fail,
        }),
      publication: {
        outbox: lifecycle.publications!,
        openPublisher: () => publisher(s, "publication", scope),
      },
      onSweepError: (error) => failure("sweep video-lifecycle-lifecycle-writer", error),
      onRelayError: (error) => failure("outbox relay publication", error),
    });
    scope.own(() => worker.close());
    scope.transport(worker);
  })();
  logStarted(config.tile, {"module":"video-lifecycle-lifecycle-writer","template":"asset-lifecycle","wiring":"mounted","checks":["sweep at start","publication relay started","subscribed processing-events--video-lifecycle","sweep every 30 s"]});
  scope.ready();
});
