// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import type { SearchMapping } from "../../runtime/search-contract.ts";
import type { SearchIndexHooks } from "../../runtime/tile-search.ts";
import {
  type PublicVideo,
  publicVideo,
  videoPublished,
  wireEvent,
} from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";

export type SearchIndexerIndexWriterDocument = PublicVideo;

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

export function searchIndexerIndexWriterHooks(): SearchIndexHooks<SearchIndexerIndexWriterDocument> {
  return {
    mapping(): SearchMapping<SearchIndexerIndexWriterDocument> {
      return publicVideoMapping;
    },
    document: {
      parse(input) {
        return publicVideo.parse(input);
      },
      id(document) {
        return document.videoId;
      },
      version(document) {
        return document.publicationVersion;
      },
    },
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
