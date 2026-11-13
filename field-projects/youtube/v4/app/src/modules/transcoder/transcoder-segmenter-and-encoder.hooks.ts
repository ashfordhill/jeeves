// Segmenter and encoder (Video encoder) in Transcoder: the product hooks its video HLS template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { MediaCodecs } from "../../runtime/media-worker.ts";
import { bindVideoResult, type VideoHlsJob, type VideoHlsResult } from "../../runtime/video-result.ts";
import {
  originalIdentity,
  processingEvent,
  processingType,
  requestedJob,
  resultEventId,
  resultPrefix,
  type ProcessingRequested,
} from "../video-contract.ts";

/** The template's generic resources: its source and results buckets. */
export type TranscoderSegmenterAndEncoderResources = { originals: string; outputs: string };

const identity = (job: ProcessingRequested) => ({
  assetId: job.videoId,
  jobId: job.jobId,
  attemptId: job.attemptId,
});

/** YouTube's processing codecs (V3-14), as v2's: the job Upload jobs carries, each attempt's
 * own result prefix, and the started, succeeded and failed events Processing events carries. */
export function transcoderSegmenterAndEncoderHooks(resources: TranscoderSegmenterAndEncoderResources) {
  const codecs: MediaCodecs<ProcessingRequested, VideoHlsResult> = {
    /** Parses a job message and binds its message ID. */
    job(raw, messageId) {
      return requestedJob(raw, messageId);
    },
    /** The job's source object and immutable result prefix. */
    video(job) {
      return {
        ...identity(job),
        source: { key: job.originalKey, size: job.expectedSize, sha256: job.expectedSha256 },
        resultPrefix: resultPrefix(job.videoId, job.jobId, job.attemptId),
      };
    },
    /** Parses a finished job's result. */
    result(raw, job) {
      return bindVideoResult(raw, resultPrefix(job.videoId, job.jobId, job.attemptId));
    },
    /** The stable event ID of a job's started, succeeded or failed event. */
    eventId(job, kind) {
      return resultEventId(identity(job), kind);
    },
    /** Builds the event the results queue receives. */
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
      /** Whether the job's source object is in this worker's namespace. */
      owns(job: VideoHlsJob): boolean {
        try {
          return originalIdentity(job.source.key).videoId === job.assetId;
        } catch {
          return false;
        }
      },
    },
    results: {
      /** Whether the job's result prefix is in this worker's namespace. */
      owns(job: VideoHlsJob): boolean {
        return job.resultPrefix === resultPrefix(job.assetId, job.jobId, job.attemptId);
      },
    },
  };
}
