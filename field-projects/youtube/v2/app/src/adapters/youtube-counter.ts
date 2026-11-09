import { createEventCounter } from "../runtime/event-counter.ts";
import type { CounterTables } from "../runtime/counter-sql.ts";
import { videoUuid } from "../features/video-paths.ts";
import { viewPlayed, wireEvent } from "./youtube-contract.ts";

export function createYouTubeViewCounter(binding: CounterTables) {
  const counter = createEventCounter(binding, {
    event: (raw, messageId) => wireEvent(viewPlayed, raw, messageId),
    aggregateKey: (event) => event.videoId,
    eventId: (event) => event.eventId,
    identity: (event) => ({
      schemaVersion: event.schemaVersion,
      type: event.type,
      videoId: event.videoId,
      eventId: event.eventId,
      publicationVersion: event.publicationVersion,
    }),
  });
  return {
    ...counter,
    parse: (raw: unknown, messageId?: string) =>
      counter.parse(raw, messageId === undefined ? undefined : videoUuid.parse(messageId)),
  };
}
