// Lifecycle writer (Lifecycle writer) in Video lifecycle: the product hooks its asset lifecycle template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { AssetLifecycleBinding, AssetLifecycleHooks } from "../../runtime/asset-lifecycle.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";
import {
  completionResponse,
  originalKey,
  requestEventId,
  requestedJob,
  videoMetadata,
} from "../video-contract.ts";

type Hooks = AssetLifecycleHooks<unknown, unknown, unknown, unknown, unknown>;
/** The template's hooks; its process names the publication's outbox destination. */
export type VideoLifecycleLifecycleWriterHooks = Omit<Hooks, "publication"> & {
  publication: Omit<NonNullable<Hooks["publication"]>, "destination">;
  identities: AssetLifecycleBinding["identities"];
};

/** Each hook throws "Not implemented" until written; the first one a message reaches sends it to .failed. */
export function videoLifecycleLifecycleWriterHooks(): VideoLifecycleLifecycleWriterHooks {
  return {
    /** Parses an asset's stored metadata: the same codec as the upload's. */
    metadata(input) {
      return videoMetadata.parse(input);
    },
    /** Parses a processing event from the results queue. */
    event(input) {
      throw new NotImplemented("event for Lifecycle writer");
    },
    /** Parses a succeeded event's result for its job. */
    result(input, identity) {
      throw new NotImplemented("result for Lifecycle writer");
    },
    /** Maps a failed event's code to a bounded failure label. */
    failure(input) {
      throw new NotImplemented("failure for Lifecycle writer");
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
      /** Parses what a ready asset publishes. */
      codec(input, eventId) {
        throw new NotImplemented("publication.codec for Lifecycle writer");
      },
      /** Builds it inside the transaction that marks the asset ready. */
      async construct(tx, ready, eventId) {
        throw new NotImplemented("publication.construct for Lifecycle writer");
      },
    },
    identities: {
      /** The stable event ID of a job request. */
      request(identity) {
        return requestEventId(identity.jobId, identity.attemptId);
      },
      /** The stable event ID of a job's started, succeeded or failed event. */
      result(identity, kind) {
        throw new NotImplemented("identities.result for Lifecycle writer");
      },
      /** The stable event ID of an asset's publication. */
      publication(assetId) {
        throw new NotImplemented("identities.publication for Lifecycle writer");
      },
    },
  };
}
