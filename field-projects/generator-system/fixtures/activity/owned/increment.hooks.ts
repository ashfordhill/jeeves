import type { CounterAdapter } from "../../runtime/event-counter.ts";

type Activity = { eventId: string; aggregateKey: string };
export function incrementHooks(): CounterAdapter<Activity> {
  return {
    event(input, messageId) {
      const event = input as Partial<Activity> | undefined;
      if (
        !event ||
        typeof event.eventId !== "string" ||
        typeof event.aggregateKey !== "string" ||
        !/^[A-Za-z0-9:_-]{1,120}$/.test(event.eventId) ||
        !/^[A-Za-z0-9:_-]{1,120}$/.test(event.aggregateKey) ||
        messageId !== event.eventId
      )
        throw new Error("Invalid activity envelope");
      return { eventId: event.eventId, aggregateKey: event.aggregateKey };
    },
    aggregateKey: (event) => event.aggregateKey,
    eventId: (event) => event.eventId,
    identity: (event) => ({ eventId: event.eventId, aggregateKey: event.aggregateKey }),
  };
}
