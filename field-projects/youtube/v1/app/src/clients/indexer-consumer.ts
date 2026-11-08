import { consume } from "../lib/amqp.ts";
export const connect = (handle: (body: Buffer) => Promise<void>) => consume("search-indexer",4,5,handle);
// No batching; callbacks acknowledge only after successful handling.
