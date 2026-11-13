// Video search (Search query) in Search API: the product hooks its search query template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { SearchQueryPreset } from "../../runtime/search-query.ts";
import type { SearchQueryHooks } from "../../runtime/tile-search.ts";
import type { SearchIndexerIndexWriterDocument } from "../search-indexer/search-indexer-index-writer.hooks.ts";
import { DELIVERY_PATH } from "../video-contract.ts";

/** A document of the index: Index writer's, whose hooks file holds its mapping. */
type Document = SearchIndexerIndexWriterDocument;

/** v1/v2's public search (`public-video-search.ts`): ready public videos only, the text on title^3,
 * description and channel^2 as best_fields (default OR), by score, then newest, then ID. */
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

/** YouTube's search answers (V3-16), as v2's search adapter: the template fixes q (1–200
 * characters), pages (1–100, 20 each) and the 750 ms deadline. */
export function searchApiVideoSearchHooks(): SearchQueryHooks<Document> {
  return {
    /** The compiled query preset: the query for a search's text and page, and its sort. */
    preset(): SearchQueryPreset {
      return publicVideoQueryPreset;
    },
    /** What each hit answers: the public fields a result shows, and its thumbnail under Video
     * delivery (v2's, at v3's CDN route). */
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
