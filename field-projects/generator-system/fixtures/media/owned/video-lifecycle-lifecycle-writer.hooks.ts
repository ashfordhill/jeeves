// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import { z } from "zod";
import type { AssetJobIdentity, ProcessingKind } from "../../runtime/asset-lifecycle.ts";
import { assetEventId } from "../../runtime/event-identity.ts";
import { bindVideoResult, videoHlsResult } from "../../runtime/video-result.ts";

export const videoUuid = z.uuid().transform((value) => value.toLowerCase());
export const timestamp = z.iso.datetime({ offset: true });
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const ORIGINALS_PREFIX = "upload-api-multipart-uploads/";
export const originalKey = (videoId: string, uploadId: string) =>
  `${ORIGINALS_PREFIX}${videoUuid.parse(videoId)}/${videoUuid.parse(uploadId)}/source.mp4`;
export function originalIdentity(key: string) {
  const parts = key.slice(ORIGINALS_PREFIX.length).split("/");
  const videoId = videoUuid.parse(parts[0]),
    uploadId = videoUuid.parse(parts[1]);
  if (key !== originalKey(videoId, uploadId)) throw new Error("Unbound original path");
  return { videoId, uploadId };
}

export const MAX_VIDEO_BYTES = 268435456;
export const videoMetadata = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  channel: z.string().trim().min(1).max(200),
});
export type VideoMetadata = z.infer<typeof videoMetadata>;
export const newUpload = z.strictObject({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (s) => /\.mp4$/i.test(s) && !/[/\\]/.test(s) && [...s].every((c) => c.charCodeAt(0) >= 32),
    ),
  size: z.int().min(1).max(MAX_VIDEO_BYTES),
  contentType: z.literal("video/mp4"),
  lastModified: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  sha256,
  title: videoMetadata.shape.title,
  description: videoMetadata.shape.description,
});

export const completionResponse = z.strictObject({
  uploadId: videoUuid,
  videoId: videoUuid,
  jobId: videoUuid,
  attemptId: videoUuid,
  state: z.literal("pending"),
});
export type CompletionResponse = z.infer<typeof completionResponse>;

export const logicalEventId = (...parts: string[]) => assetEventId("youtube-v1", ...parts);
export const requestEventId = (jobId: string, attemptId: string) =>
  logicalEventId(videoUuid.parse(jobId), videoUuid.parse(attemptId), "VideoProcessingRequested");

export const processingRequested = z
  .strictObject({
    schemaVersion: z.literal(1),
    type: z.literal("VideoProcessingRequested"),
    eventId: videoUuid,
    occurredAt: timestamp,
    videoId: videoUuid,
    jobId: videoUuid,
    attemptId: videoUuid,
    originalKey: z.string().max(150),
    expectedSize: z.int().min(1).max(MAX_VIDEO_BYTES),
    expectedSha256: sha256,
  })
  .superRefine((event, ctx) => {
    try {
      if (
        originalIdentity(event.originalKey).videoId !== event.videoId ||
        event.eventId !== requestEventId(event.jobId, event.attemptId)
      )
        throw Error();
    } catch {
      ctx.addIssue({ code: "custom", message: "Unbound processing job" });
    }
  });
export type ProcessingRequested = z.infer<typeof processingRequested>;

export function wireEvent<T extends { eventId: string }>(
  codec: { parse(raw: unknown): T },
  raw: unknown,
  messageId?: string,
): T {
  const event = codec.parse(raw);
  if (messageId !== undefined && event.eventId !== videoUuid.parse(messageId))
    throw new Error("Broker identity differs from envelope");
  return event;
}
export const requestedJob = (raw: unknown, messageId?: string) =>
  wireEvent(processingRequested, raw, messageId);

export const resultPrefix = (videoId: string, jobId: string, attemptId: string) =>
  `videos/${videoUuid.parse(videoId)}/${videoUuid.parse(jobId)}/${videoUuid.parse(attemptId)}/`;
export const processingType = {
  started: "ProcessingStarted",
  succeeded: "ProcessingSucceeded",
  failed: "ProcessingFailed",
} as const;
export const processingKind = {
  ProcessingStarted: "started",
  ProcessingSucceeded: "succeeded",
  ProcessingFailed: "failed",
} as const;
export const resultEventId = (id: AssetJobIdentity, kind: ProcessingKind) =>
  logicalEventId(videoUuid.parse(id.jobId), videoUuid.parse(id.attemptId), processingType[kind]);
export const processingFailure = z.enum(["INVALID_MEDIA", "PROCESSING_FAILED"]);
const processingBase = {
  schemaVersion: z.literal(1),
  eventId: videoUuid,
  occurredAt: timestamp,
  videoId: videoUuid,
  jobId: videoUuid,
  attemptId: videoUuid,
};
export const processingEvent = z
  .discriminatedUnion("type", [
    z.strictObject({ ...processingBase, type: z.literal("ProcessingStarted") }),
    z.strictObject({
      ...processingBase,
      type: z.literal("ProcessingSucceeded"),
      result: videoHlsResult,
    }),
    z.strictObject({
      ...processingBase,
      type: z.literal("ProcessingFailed"),
      code: processingFailure,
    }),
  ])
  .superRefine((event, ctx) => {
    try {
      const id = { assetId: event.videoId, jobId: event.jobId, attemptId: event.attemptId };
      if (event.eventId !== resultEventId(id, processingKind[event.type])) throw Error();
      if (event.type === "ProcessingSucceeded")
        bindVideoResult(event.result, resultPrefix(event.videoId, event.jobId, event.attemptId));
    } catch {
      ctx.addIssue({ code: "custom", message: "Unbound processing result" });
    }
  });
export type ProcessingEvent = z.infer<typeof processingEvent>;

export const publicationEventId = (videoId: string) =>
  logicalEventId(videoUuid.parse(videoId), "publication", "1");
export const publicVideo = z
  .strictObject({
    videoId: videoUuid,
    publicationVersion: z.literal(1),
    title: videoMetadata.shape.title,
    description: videoMetadata.shape.description,
    channel: videoMetadata.shape.channel,
    durationSeconds: z.number().finite().min(1).max(600),
    manifest: z.string().min(1).max(250),
    thumbnail: z.string().min(1).max(250),
    publishedAt: timestamp,
    visibility: z.literal("public"),
    state: z.literal("ready"),
  })
  .superRefine((video, ctx) => {
    const [, , jobId = "", attemptId = ""] = video.manifest.split("/");
    try {
      const prefix = resultPrefix(video.videoId, jobId, attemptId);
      if (video.manifest !== `${prefix}master.m3u8` || video.thumbnail !== `${prefix}thumbnail.jpg`)
        throw Error();
    } catch {
      ctx.addIssue({ code: "custom", message: "Unbound public video paths" });
    }
  });
export type PublicVideo = z.infer<typeof publicVideo>;
export const videoPublished = publicVideo
  .safeExtend({
    schemaVersion: z.literal(1),
    type: z.literal("VideoPublished"),
    eventId: videoUuid,
    occurredAt: timestamp,
  })
  .superRefine((event, ctx) => {
    if (event.eventId !== publicationEventId(event.videoId))
      ctx.addIssue({ code: "custom", message: "Unstable publication identity" });
  });
export type VideoPublished = z.infer<typeof videoPublished>;

export const DELIVERY_PATH = "/cdn/video-delivery/";
export const watchedVideo = publicVideo
  .safeExtend({ manifestUrl: z.string(), thumbnailUrl: z.string() })
  .superRefine((video, ctx) => {
    if (
      video.manifestUrl !== `${DELIVERY_PATH}${video.manifest}` ||
      video.thumbnailUrl !== `${DELIVERY_PATH}${video.thumbnail}`
    )
      ctx.addIssue({ code: "custom", message: "Unbound delivery URLs" });
  });
export type WatchedVideo = z.infer<typeof watchedVideo>;
export type PublishedVideoRow = {
  video_id: string;
  title: string;
  description: string;
  channel: string;
  duration_seconds: number;
  manifest: string;
  thumbnail: string;
  published_at: Date;
  publication_version: number;
};
export const watched = (row: PublishedVideoRow): WatchedVideo =>
  watchedVideo.parse({
    videoId: row.video_id,
    publicationVersion: row.publication_version,
    title: row.title,
    description: row.description,
    channel: row.channel,
    durationSeconds: row.duration_seconds,
    manifest: row.manifest,
    thumbnail: row.thumbnail,
    publishedAt: row.published_at.toISOString(),
    visibility: "public",
    state: "ready",
    manifestUrl: `${DELIVERY_PATH}${row.manifest}`,
    thumbnailUrl: `${DELIVERY_PATH}${row.thumbnail}`,
  });

export const viewRequest = z.strictObject({ eventId: videoUuid });
export const viewPlayed = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal("ViewPlayed"),
  eventId: videoUuid,
  occurredAt: timestamp,
  videoId: videoUuid,
  acceptedAt: timestamp,
  publicationVersion: z.literal(1),
  viewer: z.string().min(1).max(255).nullable(),
});
export type ViewPlayed = z.infer<typeof viewPlayed>;

import type { AssetLifecycleBinding, AssetLifecycleHooks } from "../../runtime/asset-lifecycle.ts";

type Hooks = AssetLifecycleHooks<unknown, unknown, unknown, unknown, unknown>;
export type VideoLifecycleLifecycleWriterHooks = Omit<Hooks, "publication"> & {
  publication: Omit<NonNullable<Hooks["publication"]>, "destination">;
  identities: AssetLifecycleBinding["identities"];
};

export function videoLifecycleLifecycleWriterHooks(): VideoLifecycleLifecycleWriterHooks {
  return {
    metadata(input) {
      return videoMetadata.parse(input);
    },
    event(input) {
      const event = processingEvent.parse(input);
      const base = {
        assetId: event.videoId,
        jobId: event.jobId,
        attemptId: event.attemptId,
        eventId: event.eventId,
        occurredAt: event.occurredAt,
      };
      if (event.type === "ProcessingSucceeded")
        return { ...base, kind: "succeeded", result: event.result };
      if (event.type === "ProcessingFailed") return { ...base, kind: "failed", code: event.code };
      return { ...base, kind: "started" };
    },
    result(input, identity) {
      return bindVideoResult(
        input,
        resultPrefix(identity.assetId, identity.jobId, identity.attemptId),
      );
    },
    failure(input) {
      return processingFailure.parse(input);
    },
    job: {
      codec(input, eventId) {
        return requestedJob(input, eventId);
      },
      async construct(_tx, input) {
        if (input.original.key !== originalKey(input.assetId, input.uploadId))
          throw new Error("Unbound completed original");
        return requestedJob({
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
    response({ assetId, ...completion }) {
      return completionResponse.parse({ ...completion, videoId: assetId });
    },
    publication: {
      codec(input, eventId) {
        return wireEvent(videoPublished, input, eventId);
      },
      async construct(_tx, ready, eventId) {
        const metadata = videoMetadata.parse(ready.metadata);
        const result = bindVideoResult(
          ready.result,
          resultPrefix(ready.assetId, ready.jobId, ready.attemptId),
        );
        return videoPublished.parse({
          schemaVersion: 1,
          type: "VideoPublished",
          eventId,
          occurredAt: ready.readyAt,
          videoId: ready.assetId,
          publicationVersion: ready.publicationVersion,
          ...metadata,
          durationSeconds: result.durationSeconds,
          manifest: result.manifest,
          thumbnail: result.thumbnail,
          publishedAt: ready.readyAt,
          visibility: "public",
          state: "ready",
        });
      },
    },
    identities: {
      request(identity) {
        return requestEventId(identity.jobId, identity.attemptId);
      },
      result(identity, kind) {
        return resultEventId(identity, kind);
      },
      publication(assetId) {
        return publicationEventId(assetId);
      },
    },
  };
}
