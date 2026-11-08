import { consume, type MessageHandler, type ConsumerOptions } from "../lib/amqp.ts";
export const connect = (handle: MessageHandler, options: ConsumerOptions = {}) =>
  consume("upload-jobs", 1, 3, handle, options);
// No batching; callbacks acknowledge only after successful handling.
