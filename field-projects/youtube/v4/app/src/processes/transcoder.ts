// Generated scaffold: Transcoder (Worker service) runs as app-transcoder, a worker process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { objects, publisher, resource, selected } from "../features/service-resources.ts";
import { verifyVideoRuntime } from "../features/video-runtime.ts";
import { transcoderSegmenterAndEncoderHooks } from "../modules/transcoder/transcoder-segmenter-and-encoder.hooks.ts";
import { createMediaObjects } from "../runtime/media-objects.ts";
import { startMediaWorker } from "../runtime/media-worker.ts";
import { runProcess } from "../runtime/process.ts";
import { createLoopLog, loopConsumer, templateHandler, watchHooks } from "../runtime/tile-loop.ts";
import { brokerState, createFailureLog, logStarted } from "../runtime/tile-process.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "transcoder",
  "kind": "worker",
  "shape": "worker",
  "templates": {
    "transcoder-segmenter-and-encoder": {
      "template": "video-hls",
      "lead": "transcoder-segmenter-and-encoder",
      "sha256Metadata": "sha256"
    }
  },
  "loops": [
    {
      "module": "transcoder-segmenter-and-encoder",
      "queue": "upload-jobs",
      "failedQueue": "upload-jobs.failed",
      "retryLimit": 3,
      "concurrency": 1
    }
  ]
} as const;

await runProcess(async (scope) => {
  // A failure the process survives writes one error line, at most once a second for each.
  const failure = createFailureLog(config.tile);
  // Loops subscribe before the process is ready. "Not implemented" sends a message to its
  // queue's .failed with one log line per module and hook a second; stopping drains them.
  const loopLog = createLoopLog(config.tile);
  // Segmenter and encoder: the video HLS media worker on its buckets, jobs queue and results publisher.
  await (async () => {
    const s = selected("video-hls", "transcoder-segmenter-and-encoder");
    const binding = config.templates["transcoder-segmenter-and-encoder"];
    await verifyVideoRuntime();
    const originals = resource(s, "originals");
    const outputs = resource(s, "outputs");
    const hooks = watchHooks(transcoderSegmenterAndEncoderHooks({ originals, outputs }), loopLog, "transcoder-segmenter-and-encoder");
    const worker = await startMediaWorker({
      codecs: hooks.codecs,
      objects: createMediaObjects({
        source: { client: objects(s), bucket: originals, owns: hooks.source.owns },
        results: { client: objects(s), bucket: outputs, owns: hooks.results.owns },
        sha256Metadata: binding.sha256Metadata,
      }),
      openPublisher: () => publisher(s, "results", scope, brokerState(config.tile, failure, "broker publish processing-events")),
      openConsumer: ({ handle, ...consumerHooks }) =>
        loopConsumer(config.loops[0], templateHandler(loopLog, config.loops[0], handle), { ...consumerHooks, onState: brokerState(config.tile, failure, "broker consume upload-jobs") }),
      onSkippedReport: (error, messageId) => failure("failure report transcoder-segmenter-and-encoder", error, { message: messageId }),
      onFatal: scope.fail,
    });
    scope.own(() => worker.close());
    scope.transport(worker);
  })();
  logStarted(config.tile, {"module":"transcoder-segmenter-and-encoder","template":"video-hls","wiring":"mounted","checks":["pinned ffmpeg and ffprobe","results publisher open","subscribed upload-jobs"]});
  scope.ready();
});
