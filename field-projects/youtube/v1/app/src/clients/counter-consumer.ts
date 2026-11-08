import { consume, type MessageHandler, type ConsumerOptions } from "../lib/amqp.ts";
export const connect = (handle: MessageHandler, options: ConsumerOptions = {}) =>
  consume("view-counter", 8, 5, handle, options);
// No batching; callbacks acknowledge only after successful handling.
