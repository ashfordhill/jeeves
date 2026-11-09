import { z } from "zod";
import { createAssetLifecycle, type AssetLifecycleBinding } from "../runtime/asset-lifecycle.ts";
import { bindVideoResult } from "../runtime/video-result.ts";
import { originalKey, resultPrefix, videoUuid } from "../features/video-paths.ts";
import {
  completionResponse,
  videoMetadata,
  type VideoMetadata,
  type CompletionResponse,
} from "./youtube-contract.ts";
import {
  processingEvent,
  requestedCodec,
  publishedCodec,
  videoEventIdentities,
  type ProcessingRequested,
  type VideoPublished,
} from "./youtube-events.ts";
import type { VideoHlsResult } from "../runtime/video-result.ts";

export function createYouTubeLifecycle(options: {
  binding: Omit<AssetLifecycleBinding, "identities">;
  publicationDestination: string;
}) {
  const lifecycle = createAssetLifecycle<
    VideoMetadata,
    VideoHlsResult,
    CompletionResponse,
    ProcessingRequested,
    VideoPublished
  >(
    { ...options.binding, identities: videoEventIdentities },
    {
      metadata: (raw) => videoMetadata.parse(raw),
      event(raw) {
        const event = processingEvent.parse(raw);
        const base = {
          assetId: event.videoId,
          jobId: event.jobId,
          attemptId: event.attemptId,
          eventId: event.eventId,
          occurredAt: event.occurredAt,
        };
        if (event.type === "ProcessingStarted") return { ...base, kind: "started" };
        if (event.type === "ProcessingSucceeded")
          return { ...base, kind: "succeeded", result: event.result };
        return { ...base, kind: "failed", code: event.code };
      },
      result: (raw, id) => bindVideoResult(raw, resultPrefix(id.assetId, id.jobId, id.attemptId)),
      failure: (raw) => z.enum(["INVALID_MEDIA", "PROCESSING_FAILED"]).parse(raw),
      response: ({ assetId, ...response }) =>
        completionResponse.parse({ ...response, videoId: assetId }),
      job: {
        codec: (raw, eventId) => requestedCodec.parse(raw, eventId),
        async construct(_tx, input) {
          if (input.original.key !== originalKey(input.assetId, input.uploadId))
            throw new Error("Unbound completed original");
          return requestedCodec.parse({
            schemaVersion: 1,
            type: "VideoProcessingRequested",
            eventId: input.eventId,
            occurredAt: input.occurredAt,
            videoId: input.assetId,
            jobId: input.jobId,
            attemptId: input.attemptId,
            originalKey: input.original.key,
            expectedSize: input.original.size,
            expectedSha256: input.original.sha256,
          });
        },
      },
      publication: {
        destination: options.publicationDestination,
        codec: (raw, eventId) => publishedCodec.parse(raw, eventId),
        async construct(_tx, ready, eventId) {
          const result = bindVideoResult(
            ready.result,
            resultPrefix(ready.assetId, ready.jobId, ready.attemptId),
          );
          return publishedCodec.parse({
            schemaVersion: 1,
            type: "VideoPublished",
            eventId,
            occurredAt: ready.readyAt,
            videoId: ready.assetId,
            ...ready.metadata,
            publicationVersion: ready.publicationVersion,
            visibility: "public",
            state: "ready",
            durationSeconds: result.durationSeconds,
            manifest: result.manifest,
            thumbnail: result.thumbnail,
            publishedAt: ready.readyAt,
          });
        },
      },
    },
  );
  return {
    ...lifecycle,
    parse: (raw: unknown, messageId?: string) =>
      lifecycle.parse(raw, messageId === undefined ? undefined : videoUuid.parse(messageId)),
    apply: (tx: Parameters<typeof lifecycle.apply>[0], raw: unknown, messageId?: string) =>
      lifecycle.apply(tx, raw, messageId === undefined ? undefined : videoUuid.parse(messageId)),
  };
}
export type YouTubeLifecycle = ReturnType<typeof createYouTubeLifecycle>;
