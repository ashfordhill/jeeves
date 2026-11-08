import type { Client } from "@opensearch-project/opensearch";
import { z } from "zod";
import { index, publicDocument } from "../lib/search-schema.ts";
export const searchInput = z.strictObject({
  q: z.string().trim().min(1).max(200),
  page: z
    .string()
    .regex(/^[1-9][0-9]{0,2}$/)
    .transform(Number)
    .pipe(z.int().min(1).max(100))
    .default(1),
});
export async function handle(client: Client, input: z.infer<typeof searchInput>) {
  const result = await client.search({
    index,
    body: {
      from: (input.page - 1) * 20,
      size: 20,
      track_total_hits: true,
      timeout: "750ms",
      query: {
        bool: {
          filter: [{ term: { state: "ready" } }, { term: { visibility: "public" } }],
          must: [
            {
              multi_match: {
                query: input.q,
                fields: ["title^3", "description", "channel^2"],
                type: "best_fields",
              },
            },
          ],
        },
      },
      sort: [{ _score: "desc" }, { publishedAt: "desc" }, { videoId: "asc" }],
    },
  });
  if (result.body.timed_out || result.body._shards.failed)
    throw new Error("Incomplete search result");
  const hits = result.body.hits.hits.map((hit) => {
    const d = publicDocument.parse(hit._source);
    if (hit._id !== d.videoId) throw new Error("Unbound search document");
    return {
      videoId: d.videoId,
      title: d.title,
      description: d.description,
      channel: d.channel,
      durationSeconds: d.durationSeconds,
      publishedAt: d.publishedAt,
      thumbnailUrl: `/media/${d.thumbnail}`,
    };
  });
  const total = result.body.hits.total;
  return {
    q: input.q,
    page: input.page,
    pageSize: 20,
    total: typeof total === "number" ? total : (total?.value ?? 0),
    hits,
  };
}
