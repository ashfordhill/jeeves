import type { Client } from "@opensearch-project/opensearch";
import { videoPublished, type VideoPublished } from "../contracts/v1.ts";
import { index, publicDocument } from "../lib/search-schema.ts";
export async function handle(client: Client, input: VideoPublished) {
  const event = videoPublished.parse(input);
  const {
    schemaVersion: _schema,
    eventId: _id,
    occurredAt: _time,
    type: _type,
    ...document
  } = event;
  await client.index({
    index,
    id: event.videoId,
    version: event.publicationVersion,
    version_type: "external_gte",
    body: publicDocument.parse(document),
    timeout: "3s",
  });
}
