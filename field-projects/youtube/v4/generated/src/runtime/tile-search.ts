import type { Client } from "@opensearch-project/opensearch";
import type { MessageHandler } from "./delivery.ts";
import {
  defineSearchDocument,
  type SearchDocument,
  type SearchIndex,
  type SearchMapping,
} from "./search-contract.ts";
import { startSearchIndexer, type SearchConsumer } from "./search-indexer.ts";
import { createSearchProjection } from "./search-projection.ts";
import { createSearchQuery, type SearchQueryPreset } from "./search-query.ts";
import { assertSearchIndex } from "./search-schema.ts";
import { isNotImplemented } from "./tile-process.ts";

/** The Index writer's product hooks (its hooks file): the index's mapping, its documents and the
 * events that carry them. The search query on the same index reads `mapping` and `document`. */
export type SearchIndexHooks<Document extends Record<string, unknown>> = {
  mapping(): SearchMapping<Document>;
  document: {
    parse(input: unknown): Document;
    id(document: Document): string;
    version(document: Document): number;
  };
  event(raw: unknown, messageId: string | undefined): { eventId: string; document: unknown };
};
/** The search query's product hooks (its hooks file): its compiled preset and each hit's answer. */
export type SearchQueryHooks<Document extends Record<string, unknown>> = {
  preset(): SearchQueryPreset;
  hit(document: Document): unknown;
};
/** The index a process opened at start: its name and mapping, and the document codec. */
export type OpenSearchIndex<Document extends Record<string, unknown>> = {
  binding: SearchIndex;
  document: SearchDocument<Document>;
};

/**
 * Opens the index from the Index writer's hooks at start, and asserts it: created when missing
 * (another process creating it at the same moment is fine), refused when its mapping differs.
 * While `mapping` isn't written it answers undefined; whatever needs the index reaches the hook
 * again and answers "Not implemented".
 */
export async function openSearchIndex<Document extends Record<string, unknown>>(
  client: Pick<Client, "indices">,
  index: string,
  hooks: SearchIndexHooks<Document>,
): Promise<OpenSearchIndex<Document> | undefined> {
  let mapping: SearchMapping<Document>;
  try {
    mapping = hooks.mapping();
  } catch (error) {
    if (isNotImplemented(error)) return undefined;
    throw error;
  }
  const binding: SearchIndex = { index, ...mapping };
  const document = defineSearchDocument<Document>({
    mapping,
    codec: { parse: (input) => hooks.document.parse(input) },
    id: (item) => hooks.document.id(item),
    version: (item) => hooks.document.version(item),
  });
  try {
    await assertSearchIndex(client, binding);
  } catch (error) {
    // Two processes may both find the index missing; the second one's create then fails.
    if (!(await client.indices.exists({ index })).body) throw error;
    await assertSearchIndex(client, binding);
  }
  return { binding, document };
}

/** Reaches `mapping` again for a message or request while the index isn't open. */
function opened<Document extends Record<string, unknown>>(
  index: OpenSearchIndex<Document> | undefined,
  hooks: Pick<SearchIndexHooks<Document>, "mapping">,
): OpenSearchIndex<Document> {
  if (index) return index;
  hooks.mapping();
  throw new Error("The search index isn't open.");
}

/** OpenSearch's answer to an older external version: the newer document stays. */
const olderVersion = (error: unknown) =>
  (error as { meta?: { statusCode?: number } } | undefined)?.meta?.statusCode === 409;

/**
 * The Index writer's loop: each message's event names its document, upserted at its version
 * (a repeat or an older version never overwrites a newer one, and an older one is done, not
 * retried). A message whose hook isn't written goes to .failed; one that doesn't parse is
 * MALFORMED_MESSAGE.
 */
export function startSearchIndexWorker<Document extends Record<string, unknown>>(options: {
  client: Pick<Client, "index">;
  index: OpenSearchIndex<Document> | undefined;
  hooks: SearchIndexHooks<Document>;
  openConsumer(handle: MessageHandler): Promise<SearchConsumer>;
}) {
  const { client, index, hooks } = options;
  const projection =
    index &&
    createSearchProjection({
      client,
      ...index,
      adapter: {
        event: (raw: unknown, messageId?: string) => hooks.event(raw, messageId),
        eventId: (event) => event.eventId,
        document: (event) => event.document,
      },
    });
  const open = () => {
    opened(index, hooks);
    if (!projection) throw new Error("The search index isn't open.");
    return projection;
  };
  return startSearchIndexer({
    projection: {
      parse: (raw, messageId) => open().parse(raw, messageId),
      upsert: async (event) => {
        try {
          await open().upsert(event);
        } catch (error) {
          if (!olderVersion(error)) throw error;
        }
      },
    },
    openConsumer: options.openConsumer,
  });
}

/**
 * The search query on the index the Index writer fills: a page of its documents for a search's
 * text and page, each answered as its hit (`{q, page, pageSize, total, hits}`). The input's bounds,
 * page size and deadline are the template's. A search reaches `mapping`, then `preset`, then `hit`.
 */
export function createSearchHandler<Document extends Record<string, unknown>>(options: {
  client: Pick<Client, "search">;
  index: OpenSearchIndex<Document> | undefined;
  indexHooks: Pick<SearchIndexHooks<Document>, "mapping">;
  hooks: SearchQueryHooks<Document>;
}) {
  let query: ReturnType<typeof createSearchQuery<Document>> | undefined;
  return async (raw: unknown) => {
    const index = opened(options.index, options.indexHooks);
    query ??= createSearchQuery({ client: options.client, ...index, preset: options.hooks.preset() });
    const result = await query(raw);
    return {
      q: result.input.q,
      page: result.input.page,
      pageSize: result.pageSize,
      total: result.total,
      hits: result.documents.map((document) => options.hooks.hit(document)),
    };
  };
}
