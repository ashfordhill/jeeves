// Receipt and increment (Event counter) in View counter: the product hooks its event counter template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { CounterAdapter } from "../../runtime/event-counter.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";


/** Each hook throws "Not implemented" until written; the first one a message reaches sends it to .failed. */
export function viewCounterReceiptAndIncrementHooks(): CounterAdapter<unknown> {
  return {
    /** Parses an event and binds its message ID. */
    event(input, messageId) {
      throw new NotImplemented("event for Receipt and increment");
    },
    /** What the event counts towards. */
    aggregateKey(event) {
      throw new NotImplemented("aggregateKey for Receipt and increment");
    },
    /** The event's stable ID: a repeat counts once. */
    eventId(event) {
      throw new NotImplemented("eventId for Receipt and increment");
    },
    /** The event data a repeat must match. */
    identity(event) {
      throw new NotImplemented("identity for Receipt and increment");
    },
  };
}
