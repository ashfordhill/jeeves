// Lifecycle writer (Lifecycle writer) in Video lifecycle: the product hooks its asset lifecycle template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { AssetLifecycleBinding, AssetLifecycleHooks } from "../../runtime/asset-lifecycle.ts";
import { bindVideoResult } from "../../runtime/video-result.ts";
import {
  completionResponse,
  originalKey,
  processingEvent,
  processingFailure,
  publicationEventId,
  requestEventId,
  requestedJob,
  resultEventId,
  resultPrefix,
  videoMetadata,
  videoPublished,
  wireEvent,
} from "../video-contract.ts";

type Hooks = AssetLifecycleHooks<unknown, unknown, unknown, unknown, unknown>;
/** The template's hooks; its process names the publication's outbox destination. */
export type VideoLifecycleLifecycleWriterHooks = Omit<Hooks, "publication"> & {
  publication: Omit<NonNullable<Hooks["publication"]>, "destination">;
  identities: AssetLifecycleBinding["identities"];
};

/** YouTube's lifecycle hooks: the upload's (V3-13), then processing and publication (V3-14),
 * as v2's createYouTubeLifecycle. A ready video publishes once, in the transaction that marks it
 * ready; the relay sends it after that commit. */
export function videoLifecycleLifecycleWriterHooks(): VideoLifecycleLifecycleWriterHooks {
  return {
    /** Parses an asset's stored metadata: the same codec as the upload's. */
    metadata(input) {
      return videoMetadata.parse(input);
    },
    /** Parses a processing event from the results queue: the Transcoder's started, succeeded or failed. */
    event(input) {
      const event = processingEvent.parse(input);
      const base = {
        assetId: event.videoId,
        jobId: event.jobId,
        attemptId: event.attemptId,
        eventId: event.eventId,
        occurredAt: event.occurredAt,
      };
      if (event.type === "ProcessingSucceeded")
        return { ...base, kind: "succeeded", result: event.result };
      if (event.type === "ProcessingFailed") return { ...base, kind: "failed", code: event.code };
      return { ...base, kind: "started" };
    },
    /** Parses a succeeded event's result for its job: the HLS package under that attempt's prefix. */
    result(input, identity) {
      return bindVideoResult(input, resultPrefix(identity.assetId, identity.jobId, identity.attemptId));
    },
    /** Maps a failed event's code to a bounded failure label: INVALID_MEDIA or PROCESSING_FAILED. */
    failure(input) {
      return processingFailure.parse(input);
    },
    job: {
      /** Parses the job a completed upload publishes: a VideoProcessingRequested. */
      codec(input, eventId) {
        return requestedJob(input, eventId);
      },
      /** Builds that job inside the completion transaction, from the verified original. */
      async construct(_tx, input) {
        if (input.original.key !== originalKey(input.assetId, input.uploadId))
          throw new Error("Unbound completed original");
        return requestedJob({
          schemaVersion: 1,
          type: "VideoProcessingRequested",
          eventId: input.eventId,
          occurredAt: input.occurredAt,
          videoId: input.assetId,
          jobId: input.jobId,
          attemptId: input.attemptId,
          originalKey: input.original.key,
          expectedSize: input.original.size,
          expectedSha256: input.original.sha256,
        });
      },
    },
    /** What completing an upload answers: the video and its job, pending. */
    response({ assetId, ...completion }) {
      return completionResponse.parse({ ...completion, videoId: assetId });
    },
    publication: {
      /** Parses what a ready asset publishes: a VideoPublished bound to its event ID. */
      codec(input, eventId) {
        return wireEvent(videoPublished, input, eventId);
      },
      /** Builds it inside the transaction that marks the asset ready: the public record. */
      async construct(_tx, ready, eventId) {
        const metadata = videoMetadata.parse(ready.metadata);
        const result = bindVideoResult(
          ready.result,
          resultPrefix(ready.assetId, ready.jobId, ready.attemptId),
        );
        return videoPublished.parse({
          schemaVersion: 1,
          type: "VideoPublished",
          eventId,
          occurredAt: ready.readyAt,
          videoId: ready.assetId,
          publicationVersion: ready.publicationVersion,
          ...metadata,
          durationSeconds: result.durationSeconds,
          manifest: result.manifest,
          thumbnail: result.thumbnail,
          publishedAt: ready.readyAt,
          visibility: "public",
          state: "ready",
        });
      },
    },
    identities: {
      /** The stable event ID of a job request. */
      request(identity) {
        return requestEventId(identity.jobId, identity.attemptId);
      },
      /** The stable event ID of a job's started, succeeded or failed event. */
      result(identity, kind) {
        return resultEventId(identity, kind);
      },
      /** The stable event ID of an asset's publication: one per video. */
      publication(assetId) {
        return publicationEventId(assetId);
      },
    },
  };
}
