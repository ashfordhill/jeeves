import { publisher } from "../lib/amqp.ts";
export const connect = () => publisher("processing-events", "");
// Immediate confirms only; no batch/linger/outbox or atomic DB+publish.
