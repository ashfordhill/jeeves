import { isDeepStrictEqual } from "node:util";
import type { Client } from "@opensearch-project/opensearch";
import {
  searchIdentity,
  validateSearchIndex,
  type SearchDocument,
  type SearchIndex,
} from "./search-contract.ts";

export interface SearchProjectionEvent<Document> {
  eventId: string;
  id: string;
  version: number;
  document: Document;
}
/** Producers commit public state plus outbox intent together before relaying the event.
 * This consumer needs only the public event/index; no SQL credential or private loader. */
export function createSearchProjection<Event, Document extends Record<string, unknown>>(options: {
  client: Pick<Client, "index">;
  binding: SearchIndex;
  document: SearchDocument<Document>;
  adapter: {
    event(rawWire: unknown, messageId?: string): Event;
    eventId(event: Event): string;
    document(event: Event): unknown;
  };
}) {
  validateSearchIndex(options.binding);
  if (
    !isDeepStrictEqual(options.document.mapping, {
      version: options.binding.version,
      properties: options.binding.properties,
    })
  )
    throw new Error("Search projection mapping mismatch");
  const { index } = options.binding;
  function normalized(input: SearchProjectionEvent<Document>): SearchProjectionEvent<Document> {
    const document = options.document.parse(input.document);
    const id = options.document.id(document),
      version = options.document.version(document);
    if (input.id !== id || input.version !== version) throw new Error("Unbound search projection");
    return { eventId: searchIdentity(input.eventId), id, version, document };
  }
  return {
    parse(rawWire: unknown, messageId?: string): SearchProjectionEvent<Document> {
      if (messageId !== undefined) searchIdentity(messageId);
      const event = options.adapter.event(rawWire, messageId);
      const eventId = searchIdentity(options.adapter.eventId(event));
      if (messageId !== undefined && messageId !== eventId)
        throw new Error("Search event mismatch");
      const document = options.document.parse(options.adapter.document(event));
      return normalized({
        eventId,
        id: options.document.id(document),
        version: options.document.version(document),
        document,
      });
    },
    async upsert(event: SearchProjectionEvent<Document>): Promise<void> {
      // Internal envelope revalidation never calls the application's raw-wire codec again.
      const value = normalized(event);
      await options.client.index({
        index,
        id: value.id,
        version: value.version,
        version_type: "external_gte",
        body: value.document,
        timeout: "3s",
      });
    },
  };
}
