import { consume } from "../lib/amqp.ts";
export const connect = (handle: (body: Buffer) => Promise<void>) => consume("upload-jobs",1,3,handle);
// No batching; callbacks acknowledge only after successful handling.
