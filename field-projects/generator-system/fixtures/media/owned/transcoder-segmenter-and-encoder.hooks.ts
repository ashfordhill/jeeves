// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import type { MediaCodecs } from "../../runtime/media-worker.ts";
import {
  bindVideoResult,
  type VideoHlsJob,
  type VideoHlsResult,
} from "../../runtime/video-result.ts";
import {
  originalIdentity,
  type ProcessingRequested,
  processingEvent,
  processingType,
  requestedJob,
  resultEventId,
  resultPrefix,
} from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";

export type TranscoderSegmenterAndEncoderResources = { originals: string; outputs: string };

const identity = (job: ProcessingRequested) => ({
  assetId: job.videoId,
  jobId: job.jobId,
  attemptId: job.attemptId,
});

export function transcoderSegmenterAndEncoderHooks(
  _resources: TranscoderSegmenterAndEncoderResources,
) {
  const codecs: MediaCodecs<ProcessingRequested, VideoHlsResult> = {
    job(raw, messageId) {
      return requestedJob(raw, messageId);
    },
    video(job) {
      return {
        ...identity(job),
        source: { key: job.originalKey, size: job.expectedSize, sha256: job.expectedSha256 },
        resultPrefix: resultPrefix(job.videoId, job.jobId, job.attemptId),
      };
    },
    result(raw, job) {
      return bindVideoResult(raw, resultPrefix(job.videoId, job.jobId, job.attemptId));
    },
    eventId(job, kind) {
      return resultEventId(identity(job), kind);
    },
    event(job, event) {
      return processingEvent.parse({
        schemaVersion: 1,
        type: processingType[event.kind],
        eventId: event.eventId,
        occurredAt: event.occurredAt,
        videoId: job.videoId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        ...(event.kind === "succeeded"
          ? { result: event.result }
          : event.kind === "failed"
            ? { code: event.code }
            : {}),
      });
    },
  };
  return {
    codecs,
    source: {
      owns(job: VideoHlsJob): boolean {
        try {
          return originalIdentity(job.source.key).videoId === job.assetId;
        } catch {
          return false;
        }
      },
    },
    results: {
      owns(job: VideoHlsJob): boolean {
        return job.resultPrefix === resultPrefix(job.assetId, job.jobId, job.attemptId);
      },
    },
  };
}
