import type { SearchQueryPreset } from "../runtime/search-query.ts";
export {
  publicVideoDocument,
  publicVideoDocumentSchema,
  publicVideoMapping,
  publicVideoRecord,
  type PublicVideoDocument,
  type PublicVideoRecord,
} from "./public-video.ts";

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
