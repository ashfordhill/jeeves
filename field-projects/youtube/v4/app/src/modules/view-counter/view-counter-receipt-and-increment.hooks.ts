// Receipt and increment (Event counter) in View counter: the product hooks its event counter template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { CounterAdapter } from "../../runtime/event-counter.ts";
import { type ViewPlayed, viewPlayed, wireEvent } from "../video-contract.ts";

/** YouTube's view counter (V3-15), v2's: each play counts once towards its video. The receipt is
 * the video and the play's event ID, which is its message ID, so a retried play counts once. */
export function viewCounterReceiptAndIncrementHooks(): CounterAdapter<ViewPlayed> {
  return {
    /** Parses an event and binds its message ID. */
    event(input, messageId) {
      return wireEvent(viewPlayed, input, messageId);
    },
    /** What the event counts towards. */
    aggregateKey(event) {
      return event.videoId;
    },
    /** The event's stable ID: a repeat counts once. */
    eventId(event) {
      return event.eventId;
    },
    /** The event data a repeat must match: not its accept time, which a retry stamps again. */
    identity(event) {
      return {
        schemaVersion: event.schemaVersion,
        type: event.type,
        videoId: event.videoId,
        eventId: event.eventId,
        publicationVersion: event.publicationVersion,
        viewer: event.viewer,
      };
    },
  };
}
