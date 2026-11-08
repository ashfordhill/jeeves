import { publisher } from "../lib/amqp.ts";
export const connect = () => publisher("publication-events", "");
