// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import type { SearchQueryPreset } from "../../runtime/search-query.ts";
import type { SearchQueryHooks } from "../../runtime/tile-search.ts";
import type { SearchIndexerIndexWriterDocument } from "../search-indexer/search-indexer-index-writer.hooks.ts";
import { DELIVERY_PATH } from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";

type Document = SearchIndexerIndexWriterDocument;

export const publicVideoQueryPreset: SearchQueryPreset = {
  query: ({ q }) => ({
    bool: {
      filter: [{ term: { state: "ready" } }, { term: { visibility: "public" } }],
      must: [
        {
          multi_match: {
            query: q,
            fields: ["title^3", "description", "channel^2"],
            type: "best_fields",
          },
        },
      ],
    },
  }),
  sort: [{ _score: "desc" }, { publishedAt: "desc" }, { videoId: "asc" }],
};

export function searchApiVideoSearchHooks(): SearchQueryHooks<Document> {
  return {
    preset(): SearchQueryPreset {
      return publicVideoQueryPreset;
    },
    hit(document) {
      return {
        videoId: document.videoId,
        title: document.title,
        description: document.description,
        channel: document.channel,
        durationSeconds: document.durationSeconds,
        publishedAt: document.publishedAt,
        thumbnailUrl: `${DELIVERY_PATH}${document.thumbnail}`,
      };
    },
  };
}
