import { z } from "zod";
import { assetEventId } from "../runtime/event-identity.ts";
import { publicVideoDocumentSchema } from "../features/public-video.ts";
import { videoUuid } from "../features/video-paths.ts";

export const timestamp = z.iso.datetime({ offset: true });
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const creator = z.strictObject({
  sub: z.string().min(1).max(255),
  channel: z.string().trim().min(1).max(200),
});
export const videoMetadata = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  channel: creator.shape.channel,
});
export type VideoMetadata = z.infer<typeof videoMetadata>;
export const newUpload = z.strictObject({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine((s) => /\.mp4$/i.test(s) && !/[\x00-\x1f/\\]/.test(s)),
  size: z.int().min(1).max(268435456),
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
const base = {
  schemaVersion: z.literal(1),
  eventId: videoUuid,
  occurredAt: timestamp,
  videoId: videoUuid,
};
export const viewPlayed = z.strictObject({
  ...base,
  type: z.literal("ViewPlayed"),
  acceptedAt: timestamp,
  publicationVersion: z.literal(1),
});
export type ViewPlayed = z.infer<typeof viewPlayed>;
// Hash policy belongs to this product adapter. The generic lifecycle supplies the mechanism.
export const logicalEventId = (...parts: string[]) => assetEventId("youtube-v1", ...parts);
export const publicationEventId = (videoId: string) =>
  logicalEventId(videoUuid.parse(videoId), "publication", "1");
export const videoPublished = publicVideoDocumentSchema
  .safeExtend({
    ...base,
    type: z.literal("VideoPublished"),
    title: videoMetadata.shape.title,
  })
  .superRefine((event, ctx) => {
    if (event.eventId !== publicationEventId(event.videoId))
      ctx.addIssue({ code: "custom", message: "Unstable publication identity" });
  });
export type VideoPublished = z.infer<typeof videoPublished>;
export const publishedCodec = {
  parse: (raw: unknown, messageId?: string) => wireEvent(videoPublished, raw, messageId),
};
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
export const failureMessages = {
  INITIATION_FAILED: "Upload initiation failed.",
  UPLOAD_MISMATCH: "Stored original does not match this upload.",
  INVALID_MEDIA: "Media does not meet the supported format.",
  PROCESSING_FAILED: "Video processing failed.",
  QUEUE_DEADLINE: "Processing did not start before the deadline.",
  PROCESSING_DEADLINE: "Processing exceeded its deadline.",
} as const;
export function failure(code: string | null) {
  if (code === null) return null;
  if (!(code in failureMessages)) throw new Error("Unknown video failure");
  return { code, message: failureMessages[code as keyof typeof failureMessages] };
}
