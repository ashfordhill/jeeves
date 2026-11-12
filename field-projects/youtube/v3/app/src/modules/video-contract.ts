// YouTube v3's video contract: the codecs that Multipart uploads (Upload API), the Transcoder,
// the Lifecycle writer (Video lifecycle), Watch API and View counter share, so the tiles can't
// drift. Product code, from v2's youtube-contract.ts, youtube-events.ts, video-paths.ts and
// youtube-watch.ts: the upload (V3-13), processing and publication (V3-14), then watching (V3-15).
import { z } from "zod";
import type { AssetJobIdentity, ProcessingKind } from "../runtime/asset-lifecycle.ts";
import { assetEventId } from "../runtime/event-identity.ts";
import { bindVideoResult, videoHlsResult } from "../runtime/video-result.ts";

export const videoUuid = z.uuid().transform((value) => value.toLowerCase());
export const timestamp = z.iso.datetime({ offset: true });
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

/** Upload API's multipart key prefix (its compiled `prefix`): every original lies under it. */
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

/** 1 byte–256 MiB, MP4 only (v1 policy); the media itself is checked before publication. */
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
    .refine((s) => /\.mp4$/i.test(s) && !/[\x00-\x1f/\\]/.test(s)),
  size: z.int().min(1).max(MAX_VIDEO_BYTES),
  contentType: z.literal("video/mp4"),
  lastModified: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  sha256,
  title: videoMetadata.shape.title,
  description: videoMetadata.shape.description,
});

/** What completing an upload answers, and what multipart stores for a repeated complete. */
export const completionResponse = z.strictObject({
  uploadId: videoUuid,
  videoId: videoUuid,
  jobId: videoUuid,
  attemptId: videoUuid,
  state: z.literal("pending"),
});
export type CompletionResponse = z.infer<typeof completionResponse>;

// v1's wire event IDs, as v2 kept them: the same job always has the same event ID.
export const logicalEventId = (...parts: string[]) => assetEventId("youtube-v1", ...parts);
export const requestEventId = (jobId: string, attemptId: string) =>
  logicalEventId(videoUuid.parse(jobId), videoUuid.parse(attemptId), "VideoProcessingRequested");

/** The job Upload jobs carries to the Transcoder once an upload completes. */
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

/** Parses a wire event and binds it to the broker's message ID, when there is one. */
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

// Processing (V3-14). Each attempt's HLS package lies under its own immutable prefix in
// Transcoded videos (v2's path policy); the Transcoder's hooks get no prefix (template gap 4).
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
/** The two failures the Transcoder reports; the lifecycle adds its own deadlines. */
export const processingFailure = z.enum(["INVALID_MEDIA", "PROCESSING_FAILED"]);
const processingBase = {
  schemaVersion: z.literal(1),
  eventId: videoUuid,
  occurredAt: timestamp,
  videoId: videoUuid,
  jobId: videoUuid,
  attemptId: videoUuid,
};
/** What Processing events carries from the Transcoder to the lifecycle. */
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

// Publication (V3-14): a ready video's public record, as published.videos holds it and as
// Publication events carries it (with visibility and state, the search document's filters).
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

// Watching (V3-15), from v2's youtube-watch.ts and ViewPlayed.
/** Where the edge serves Transcoded videos: Video delivery's CDN route. */
export const DELIVERY_PATH = "/cdn/video-delivery/";
/** Watch's details answer: a ready video's public record and its delivery URLs. It is immutable
 * once ready, so the cache may keep it; a count is never in it (the View count reader's). */
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
/** A published.videos row, as pg reads it. */
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

/** What a play sends: one event ID per watch page session (v1's policy), reused by its retries. */
export const viewRequest = z.strictObject({ eventId: videoUuid });
/** One accepted play on View events (v2's ViewPlayed), with the viewer: the signed-in account's
 * subject, or null when anonymous (D4). Its event ID is its broker message ID. */
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
