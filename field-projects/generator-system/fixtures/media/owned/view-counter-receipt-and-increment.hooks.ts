// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import type { CounterAdapter } from "../../runtime/event-counter.ts";
import {
  type ViewPlayed,
  viewPlayed,
  wireEvent,
} from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";

export function viewCounterReceiptAndIncrementHooks(): CounterAdapter<ViewPlayed> {
  return {
    event(input, messageId) {
      return wireEvent(viewPlayed, input, messageId);
    },
    aggregateKey(event) {
      return event.videoId;
    },
    eventId(event) {
      return event.eventId;
    },
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
