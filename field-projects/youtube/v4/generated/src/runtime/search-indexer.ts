import { NonRetryable, type MessageHandler } from "./delivery.ts";
import type { SearchProjectionEvent } from "./search-projection.ts";

export interface SearchConsumer {
  close(): Promise<void>;
  closed: Promise<{ fatal: boolean }>;
}
/** Caller asserts the exact index before admission and owns the search client. This factory
 * owns the bound YV2-05 consumer; close drains before the caller closes that client. */
export async function startSearchIndexer<Document>(options: {
  projection: {
    parse(rawWire: unknown, messageId?: string): SearchProjectionEvent<Document>;
    upsert(event: SearchProjectionEvent<Document>): Promise<void>;
  };
  openConsumer(handle: MessageHandler): Promise<SearchConsumer>;
}) {
  const handle: MessageHandler = async (body, delivery) => {
    let event: SearchProjectionEvent<Document>;
    try {
      if (!delivery.messageId || body.byteLength > 65536) throw new Error("Invalid envelope");
      event = options.projection.parse(JSON.parse(body.toString("utf8")), delivery.messageId);
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
    await options.projection.upsert(event);
  };
  const consumer = await options.openConsumer(handle);
  let closing: Promise<void> | undefined;
  return {
    closed: consumer.closed,
    close(): Promise<void> {
      return (closing ??= consumer.close());
    },
  };
}
