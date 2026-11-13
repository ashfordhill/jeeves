// Index writer (Index writer) in Search indexer: the product hooks its search indexing template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { SearchMapping } from "../../runtime/search-contract.ts";
import type { SearchIndexHooks } from "../../runtime/tile-search.ts";
import { type PublicVideo, publicVideo, videoPublished, wireEvent } from "../video-contract.ts";

/** A document of the index: a ready video's public record (the contract's `publicVideo`), exactly
 * the fields its mapping names. */
export type SearchIndexerIndexWriterDocument = PublicVideo;

/** v2's public video mapping (`public-video.ts`), version 1: the filters and the ID as keywords,
 * the searched text, and the paths kept but not indexed. */
export const publicVideoMapping = {
  version: 1,
  properties: {
    videoId: { type: "keyword" },
    publicationVersion: { type: "integer" },
    visibility: { type: "keyword" },
    state: { type: "keyword" },
    title: { type: "text" },
    description: { type: "text" },
    channel: { type: "text" },
    durationSeconds: { type: "double" },
    manifest: { type: "keyword", index: false },
    thumbnail: { type: "keyword", index: false },
    publishedAt: { type: "date" },
  },
} as const satisfies SearchMapping<PublicVideo>;

/** YouTube's search documents (V3-16), as v2's public video document and search projection: one
 * document per ready video, from its `VideoPublished` on Publication events. */
export function searchIndexerIndexWriterHooks(): SearchIndexHooks<SearchIndexerIndexWriterDocument> {
  return {
    /** The index's explicit mapping: its version and each field's type. */
    mapping(): SearchMapping<SearchIndexerIndexWriterDocument> {
      return publicVideoMapping;
    },
    document: {
      /** Parses a document: exactly the mapping's fields, refusing any other. */
      parse(input) {
        return publicVideo.parse(input);
      },
      /** A document's ID in the index: the video. */
      id(document) {
        return document.videoId;
      },
      /** A document's version: a repeat or an older one never overwrites a newer one. */
      version(document) {
        return document.publicationVersion;
      },
    },
    /** Parses a message from its events subscriber: the `VideoPublished` bound to its message ID,
     * and its public record without the event's envelope (v2's projection). */
    event(raw, messageId) {
      const {
        schemaVersion: _schema,
        type: _type,
        eventId,
        occurredAt: _at,
        ...document
      } = wireEvent(videoPublished, raw, messageId);
      return { eventId, document };
    },
  };
}
