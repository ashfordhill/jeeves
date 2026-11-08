import { consume } from "../lib/amqp.ts";
export const connect = (handle: (body: Buffer) => Promise<void>) => consume("completion-handler",4,10,handle);
// No batching; callbacks acknowledge only after successful handling.
