import { publisher } from "../lib/amqp.ts";
export const connect = () => publisher("","upload-jobs");
// Immediate confirms only; no batch/linger/outbox or atomic DB+publish.
