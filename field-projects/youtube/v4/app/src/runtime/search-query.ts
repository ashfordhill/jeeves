import { isDeepStrictEqual } from "node:util";
import type { API, Client } from "@opensearch-project/opensearch";
import { validateSearchIndex, type SearchDocument, type SearchIndex } from "./search-contract.ts";

export interface SearchInput {
  q: string;
  page: number;
}
type SearchBody = NonNullable<API.Search_Request["body"]>;
/** Trusted compiled preset only; no saved-source or HTTP DSL/mapping is evaluated. */
export interface SearchQueryPreset {
  query(input: SearchInput): NonNullable<SearchBody["query"]>;
  sort: NonNullable<SearchBody["sort"]>;
}
export function parseSearchInput(raw: unknown): SearchInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid search input");
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => key !== "q" && key !== "page") ||
    typeof value.q !== "string"
  )
    throw new Error("Invalid search input");
  const q = value.q.trim();
  const page =
    value.page === undefined
      ? 1
      : typeof value.page === "string" && /^[1-9][0-9]{0,2}$/.test(value.page)
        ? Number(value.page)
        : NaN;
  if (!q.length || q.length > 200 || !Number.isInteger(page) || page < 1 || page > 100)
    throw new Error("Invalid search input");
  return { q, page };
}
/** Fixed bounded v1 window/deadline, exact totals and complete validated public documents.
 * HTTP paths and response field/URL mapping belong to the application adapter. */
export function createSearchQuery<Document extends Record<string, unknown>>(options: {
  client: Pick<Client, "search">;
  binding: SearchIndex;
  document: SearchDocument<Document>;
  preset: SearchQueryPreset;
}) {
  validateSearchIndex(options.binding);
  if (
    !isDeepStrictEqual(options.document.mapping, {
      version: options.binding.version,
      properties: options.binding.properties,
    })
  )
    throw new Error("Search query mapping mismatch");
  const { index } = options.binding;
  return async (raw: unknown) => {
    const input = parseSearchInput(raw);
    const result = await options.client.search({
      index,
      body: {
        from: (input.page - 1) * 20,
        size: 20,
        track_total_hits: true,
        timeout: "750ms",
        query: options.preset.query(input),
        sort: options.preset.sort,
      },
    });
    if (result.body.timed_out || !result.body._shards || result.body._shards.failed)
      throw new Error("Incomplete search result");
    const hits = result.body.hits.hits;
    const count = result.body.hits.total;
    const total = typeof count === "number" ? count : count?.relation === "eq" ? count.value : NaN;
    if (!Number.isSafeInteger(total) || total < 0 || hits.length > 20)
      throw new Error("Invalid search result bounds");
    const documents = hits.map((hit) => {
      const document = options.document.parse(hit._source);
      if (hit._id !== options.document.id(document)) throw new Error("Unbound search document");
      return document;
    });
    return { input, pageSize: 20 as const, total, documents };
  };
}
