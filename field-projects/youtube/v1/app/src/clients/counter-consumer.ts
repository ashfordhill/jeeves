import { consume } from "../lib/amqp.ts";
export const connect = (handle: (body: Buffer) => Promise<void>) => consume("view-counter",8,5,handle);
// No batching; callbacks acknowledge only after successful handling.
