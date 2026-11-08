import { publisher } from "../lib/amqp.ts";
export const connect = () => publisher("completion-events","");
// Immediate confirms only; no batch/linger/outbox or atomic DB+publish.
