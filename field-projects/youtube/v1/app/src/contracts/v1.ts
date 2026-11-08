import { createHash } from "node:crypto";
import { z } from "zod";
export const uuid = z.uuid();
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const timestamp = z.iso.datetime({ offset: true });
export const videoState = z.enum([
  "uploading",
  "pending",
  "processing",
  "ready",
  "failed",
  "aborted",
  "expired",
]);
export const failureCode = z.enum([
  "INITIATION_FAILED",
  "UPLOAD_MISMATCH",
  "INVALID_MEDIA",
  "PROCESSING_FAILED",
  "QUEUE_DEADLINE",
  "PROCESSING_DEADLINE",
]);
export type FailureCode = z.infer<typeof failureCode>;
export const safeFailureMessages: Record<FailureCode, string> = {
  INITIATION_FAILED: "Upload initiation failed.",
  UPLOAD_MISMATCH: "Stored original does not match this upload.",
  INVALID_MEDIA: "Media does not meet the supported format.",
  PROCESSING_FAILED: "Video processing failed.",
  QUEUE_DEADLINE: "Processing did not start before the deadline.",
  PROCESSING_DEADLINE: "Processing exceeded its deadline.",
};
export const newUpload = z.strictObject({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine((s) => /\.mp4$/i.test(s) && !/[\x00-\x1f/\\]/.test(s)),
  size: z
    .int()
    .min(1)
    .max(256 * 1024 * 1024),
  contentType: z.literal("video/mp4"),
  lastModified: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  sha256,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
});
export type NewUpload = z.infer<typeof newUpload>;
export const creator = z.strictObject({
  sub: z.string().min(1).max(255),
  channel: z.string().trim().min(1).max(200),
});
export const originalKey = (videoId: string, uploadId: string) =>
  `originals/${uuid.parse(videoId)}/${uuid.parse(uploadId)}/source.mp4`;
export const resultPrefix = (videoId: string, jobId: string, attemptId: string) =>
  `videos/${uuid.parse(videoId)}/${uuid.parse(jobId)}/${uuid.parse(attemptId)}/`;
// Stable logical identities are unrelated to broker retries or a worker execution directory.
export function logicalEventId(...parts: string[]): string {
  const h = createHash("sha256")
    .update(JSON.stringify(["youtube-v1", ...parts]))
    .digest();
  h[6] = (h[6]! & 15) | 0x50;
  h[8] = (h[8]! & 63) | 0x80;
  const s = h.subarray(0, 16).toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
const base = { schemaVersion: z.literal(1), eventId: uuid, occurredAt: timestamp, videoId: uuid };
const job = { jobId: uuid, attemptId: uuid };
export const processingRequested = z
  .strictObject({
    ...base,
    ...job,
    type: z.literal("VideoProcessingRequested"),
    originalKey: z
      .string()
      .max(150)
      .regex(/^originals\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/source\.mp4$/),
    expectedSize: z.int().min(1).max(268435456),
    expectedSha256: sha256,
  })
  .superRefine((m, c) => {
    if (!m.originalKey.startsWith(`originals/${m.videoId}/`))
      c.addIssue({ code: "custom", message: "Original key is not bound to video" });
    if (m.eventId !== logicalEventId(m.jobId, m.attemptId, m.type))
      c.addIssue({ code: "custom", message: "Unstable processing job identity" });
  });
const path = z
  .string()
  .max(240)
  .regex(/^videos\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[A-Za-z0-9_./-]+$/)
  .refine((s) => !s.includes("..") && !s.includes("//"));
const rendition = z.strictObject({
  height: z.union([z.literal(360), z.literal(720)]),
  width: z.union([z.literal(640), z.literal(1280)]),
  playlist: path,
  videoCodec: z.literal("h264"),
  audioCodec: z.literal("aac"),
});
export const mediaResult = z
  .strictObject({
    prefix: z.string().max(150),
    manifest: path,
    thumbnail: path,
    marker: path,
    durationSeconds: z.number().finite().min(1).max(600),
    renditions: z.array(rendition).length(2),
  })
  .superRefine((m, c) => {
    if (
      m.manifest !== m.prefix + "master.m3u8" ||
      m.thumbnail !== m.prefix + "thumbnail.jpg" ||
      m.marker !== m.prefix + "_complete.json" ||
      m.renditions.some(
        (r) => !r.playlist.startsWith(m.prefix) || r.width !== (r.height === 360 ? 640 : 1280),
      ) ||
      new Set(m.renditions.map((r) => r.height)).size !== 2
    )
      c.addIssue({ code: "custom", message: "Incomplete or unbound media result" });
  });
const started = z.strictObject({ ...base, ...job, type: z.literal("ProcessingStarted") });
const succeeded = z.strictObject({
  ...base,
  ...job,
  type: z.literal("ProcessingSucceeded"),
  result: mediaResult,
});
const failed = z.strictObject({
  ...base,
  ...job,
  type: z.literal("ProcessingFailed"),
  code: z.enum(["INVALID_MEDIA", "PROCESSING_FAILED"]),
});
export const processingEvent = z
  .discriminatedUnion("type", [started, succeeded, failed])
  .superRefine((m, c) => {
    if (m.eventId !== logicalEventId(m.jobId, m.attemptId, m.type))
      c.addIssue({ code: "custom", message: "Unstable processing event identity" });
    if (
      m.type === "ProcessingSucceeded" &&
      m.result.prefix !== resultPrefix(m.videoId, m.jobId, m.attemptId)
    )
      c.addIssue({ code: "custom", message: "Result does not belong to job" });
  });
export const videoPublished = z
  .strictObject({
    ...base,
    type: z.literal("VideoPublished"),
    publicationVersion: z.literal(1),
    visibility: z.literal("public"),
    state: z.literal("ready"),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000),
    channel: z.string().min(1).max(200),
    durationSeconds: z.number().finite().min(1).max(600),
    manifest: path,
    thumbnail: path,
    publishedAt: timestamp,
  })
  .superRefine((m, c) => {
    if (m.eventId !== logicalEventId(m.videoId, "publication", "1"))
      c.addIssue({ code: "custom", message: "Unstable publication identity" });
    if (
      !m.manifest.startsWith(`videos/${m.videoId}/`) ||
      !m.thumbnail.startsWith(`videos/${m.videoId}/`)
    )
      c.addIssue({ code: "custom", message: "Unbound public paths" });
  });
export const viewPlayed = z.strictObject({
  ...base,
  type: z.literal("ViewPlayed"),
  acceptedAt: timestamp,
  publicationVersion: z.literal(1),
});
export const destinations = [
  "upload-jobs",
  "processing-events",
  "publication-events",
  "view-events",
] as const;
export type Destination = (typeof destinations)[number];
export type ProcessingEvent = z.infer<typeof processingEvent>;
export type ProcessingRequested = z.infer<typeof processingRequested>;
export type VideoPublished = z.infer<typeof videoPublished>;
export type ViewPlayed = z.infer<typeof viewPlayed>;
const schemas = {
  "upload-jobs": processingRequested,
  "processing-events": processingEvent,
  "publication-events": videoPublished,
  "view-events": viewPlayed,
};
export function parseMessage(destination: Destination, body: Uint8Array, messageId?: string) {
  if (body.byteLength > 65536) throw new Error("Message exceeds 64KiB");
  const m = schemas[destination].parse(JSON.parse(Buffer.from(body).toString("utf8")));
  if (messageId !== undefined && m.eventId !== messageId)
    throw new Error("Broker identity differs from envelope");
  return m;
}
export function nextProcessingState(
  state: z.infer<typeof videoState>,
  type: ProcessingEvent["type"],
  matches: boolean,
): "started" | "ready" | "failed" | "stale" | "terminal" {
  if (!matches) return "stale";
  if (state !== "pending" && state !== "processing") return "terminal";
  if (type === "ProcessingStarted") return "started";
  return type === "ProcessingSucceeded" ? "ready" : "failed";
}
