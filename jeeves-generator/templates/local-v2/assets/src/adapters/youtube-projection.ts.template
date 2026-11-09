import type { Client } from "@opensearch-project/opensearch";
import { publicVideoDocument, publicVideoDocumentSchema } from "../features/public-video.ts";
import { videoUuid } from "../features/video-paths.ts";
import type { SearchIndex } from "../runtime/search-contract.ts";
import { createSearchProjection } from "../runtime/search-projection.ts";
import { publishedCodec } from "./youtube-contract.ts";

export function createYouTubeSearchProjection(options: {
  client: Pick<Client, "index">;
  binding: SearchIndex;
}) {
  const projection = createSearchProjection({
    ...options,
    document: publicVideoDocument,
    adapter: {
      event: (raw, messageId) => publishedCodec.parse(raw, messageId),
      eventId: (event) => event.eventId,
      document: (event) => {
        const {
          schemaVersion: _schema,
          type: _type,
          eventId: _id,
          occurredAt: _at,
          ...document
        } = event;
        return publicVideoDocumentSchema.parse(document);
      },
    },
  });
  return {
    ...projection,
    parse: (raw: unknown, messageId?: string) =>
      projection.parse(raw, messageId === undefined ? undefined : videoUuid.parse(messageId)),
  };
}
