// Lifecycle writer (Lifecycle writer) in Video lifecycle: the product hooks its asset lifecycle template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { AssetLifecycleBinding, AssetLifecycleHooks } from "../../runtime/asset-lifecycle.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";

type Hooks = AssetLifecycleHooks<unknown, unknown, unknown, unknown, unknown>;
/** The template's hooks; its process names the publication's outbox destination. */
export type VideoLifecycleLifecycleWriterHooks = Omit<Hooks, "publication"> & {
  publication: Omit<NonNullable<Hooks["publication"]>, "destination">;
  identities: AssetLifecycleBinding["identities"];
};

/** Each hook throws "Not implemented" until written; the first one a message reaches sends it to .failed. */
export function videoLifecycleLifecycleWriterHooks(): VideoLifecycleLifecycleWriterHooks {
  return {
    /** Parses an asset's stored metadata. */
    metadata(input) {
      throw new NotImplemented("metadata for Lifecycle writer");
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
      /** Parses the job a completed upload publishes. */
      codec(input, eventId) {
        throw new NotImplemented("job.codec for Lifecycle writer");
      },
      /** Builds that job inside the completion transaction. */
      async construct(tx, input) {
        throw new NotImplemented("job.construct for Lifecycle writer");
      },
    },
    /** What completing an upload answers. */
    response(input) {
      throw new NotImplemented("response for Lifecycle writer");
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
        throw new NotImplemented("identities.request for Lifecycle writer");
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
