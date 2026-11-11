// YouTube v3's video contract: the codecs that Multipart uploads (Upload API) and the Lifecycle
// writer (Video lifecycle) share, so the two tiles can't drift. Product code, written in V3-13
// from v2's youtube-contract.ts, youtube-events.ts and video-paths.ts (the v1/v2 upload policy).
import { z } from "zod";
import { assetEventId } from "../runtime/event-identity.ts";

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
