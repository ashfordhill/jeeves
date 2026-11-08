import { publisher } from "../lib/amqp.ts";
export const connect = () => publisher("view-events","");
// Immediate confirms only; no batch/linger/outbox or atomic DB+publish.
