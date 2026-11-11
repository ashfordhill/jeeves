// Segmenter and encoder (Video encoder) in Transcoder: the product hooks its video HLS template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { MediaCodecs } from "../../runtime/media-worker.ts";
import type { VideoHlsJob } from "../../runtime/video-result.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";

/** The template's generic resources: its source and results buckets. */
export type TranscoderSegmenterAndEncoderResources = { originals: string; outputs: string };

/** Each hook throws "Not implemented" until written; the first one a message reaches sends it to .failed. */
export function transcoderSegmenterAndEncoderHooks(resources: TranscoderSegmenterAndEncoderResources) {
  const codecs: MediaCodecs<unknown, unknown> = {
    /** Parses a job message and binds its message ID. */
    job(raw, messageId) {
      throw new NotImplemented("job for Segmenter and encoder");
    },
    /** The job's source object and immutable result prefix. */
    video(job) {
      throw new NotImplemented("video for Segmenter and encoder");
    },
    /** Parses a finished job's result. */
    result(raw, job) {
      throw new NotImplemented("result for Segmenter and encoder");
    },
    /** The stable event ID of a job's started, succeeded or failed event. */
    eventId(job, kind) {
      throw new NotImplemented("eventId for Segmenter and encoder");
    },
    /** Builds the event the results queue receives. */
    event(job, event) {
      throw new NotImplemented("event for Segmenter and encoder");
    },
  };
  return {
    codecs,
    source: {
      /** Whether the job's source object is in this worker's namespace. */
      owns(job: VideoHlsJob): boolean {
        throw new NotImplemented("source.owns for Segmenter and encoder");
      },
    },
    results: {
      /** Whether the job's result prefix is in this worker's namespace. */
      owns(job: VideoHlsJob): boolean {
        throw new NotImplemented("results.owns for Segmenter and encoder");
      },
    },
  };
}
