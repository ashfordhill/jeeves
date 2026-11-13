// View publisher, a Custom in Watch API: Reports each play of a ready video as an event, with the viewer when signed in.
// Write the module here. Export never overwrites your edits: export afresh and carry them over.
import { HttpError } from "../../runtime/http.ts";
import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import { videoUuid, viewPlayed, viewRequest } from "../video-contract.ts";
import type { Dependencies } from "./watch-api-view-publisher.slots.ts";

/** YouTube's play report (V3-15), v1/v2's: `POST /<videoId>` with `{eventId}`, one event ID per
 * watch page session, sent once the browser has played two cumulative seconds (V3-16's part).
 * Only a ready video in published.videos accepts it (404 `VIDEO_NOT_READY` otherwise). It sends
 * one ViewPlayed to View events, with the viewer's subject when signed in and null when anonymous,
 * whose message ID is the event ID: a retried play is the same message, and the counter's
 * receipt counts it once. Answers 202. */
export async function watchApiViewPublisher(dependencies: Dependencies, request: ModuleRequest): Promise<ModuleResponse> {
  const path = /^\/([^/]+)$/.exec(request.path);
  if (!path) throw new HttpError(404, "NOT_FOUND", "Route not found.");
  if (request.method !== "POST")
    return {
      status: 405,
      headers: { allow: "POST" },
      body: { error: "METHOD_NOT_ALLOWED", message: "Report a play with POST." },
    };
  const id = videoUuid.safeParse(path[1]),
    body = viewRequest.safeParse(request.body);
  if (!id.success || !body.success)
    throw new HttpError(400, "VIEW_REQUEST", "Supply a video UUID and an eventId UUID only.");
  const ready = await dependencies.metadata.query<{ publication_version: number }>(
    "SELECT publication_version FROM published.videos WHERE video_id = $1",
    [id.data],
  );
  const video = ready[0];
  if (!video) throw new HttpError(404, "VIDEO_NOT_READY", "This video is not publicly available.");
  const acceptedAt = new Date().toISOString();
  const event = viewPlayed.parse({
    schemaVersion: 1,
    type: "ViewPlayed",
    eventId: body.data.eventId,
    occurredAt: acceptedAt,
    videoId: id.data,
    acceptedAt,
    publicationVersion: video.publication_version,
    viewer: request.caller.signedIn ? request.caller.principal.subject : null,
  });
  await dependencies.viewEvents.publish(Buffer.from(JSON.stringify(event)), {
    messageId: event.eventId,
  });
  return {
    status: 202,
    body: {
      eventId: event.eventId,
      accepted: true,
      acceptedAt,
      publicationVersion: event.publicationVersion,
    },
  };
}
