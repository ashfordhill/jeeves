import type { Client } from "@opensearch-project/opensearch";
import { publicVideoDocument, publicVideoQueryPreset } from "../features/public-video-search.ts";
import { HttpError, type HttpRoutes } from "../runtime/http.ts";
import type { SearchIndex } from "../runtime/search-contract.ts";
import { createSearchQuery, parseSearchInput } from "../runtime/search-query.ts";

export function createYouTubeSearch(options: {
  client: Pick<Client, "search">;
  binding: SearchIndex;
}) {
  const query = createSearchQuery({
    ...options,
    document: publicVideoDocument,
    preset: publicVideoQueryPreset,
  });
  return async (raw: unknown) => {
    const result = await query(raw);
    return {
      q: result.input.q,
      page: result.input.page,
      pageSize: result.pageSize,
      total: result.total,
      hits: result.documents.map((d) => ({
        videoId: d.videoId,
        title: d.title,
        description: d.description,
        channel: d.channel,
        durationSeconds: d.durationSeconds,
        publishedAt: d.publishedAt,
        thumbnailUrl: `/media/${d.thumbnail}`,
      })),
    };
  };
}
export function mountYouTubeSearch(
  routes: HttpRoutes,
  search: ReturnType<typeof createYouTubeSearch>,
) {
  routes.route({
    method: "GET",
    url: "/videos",
    handler: async (request) => {
      try {
        parseSearchInput(request.query);
      } catch {
        throw new HttpError(
          400,
          "SEARCH_QUERY",
          "Enter a query of 1–200 characters and a page from 1–100.",
        );
      }
      return search(request.query);
    },
  });
}
