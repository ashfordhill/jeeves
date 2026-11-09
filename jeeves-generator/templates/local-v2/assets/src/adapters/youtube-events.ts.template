import { z } from "zod";
import { type AssetJobIdentity, type ProcessingKind } from "../runtime/asset-lifecycle.ts";
import { bindVideoResult, videoHlsResult, type VideoHlsResult } from "../runtime/video-result.ts";
import { originalIdentity, resultPrefix, videoUuid } from "../features/video-paths.ts";
import {
  sha256,
  timestamp,
  publicationEventId,
  logicalEventId,
  wireEvent,
} from "./youtube-contract.ts";

export {
  publishedCodec,
  videoPublished,
  type VideoPublished,
  logicalEventId,
} from "./youtube-contract.ts";
const base = {
  schemaVersion: z.literal(1),
  eventId: videoUuid,
  occurredAt: timestamp,
  videoId: videoUuid,
};
const job = { jobId: videoUuid, attemptId: videoUuid };
export const processingRequested = z
  .strictObject({
    ...base,
    ...job,
    type: z.literal("VideoProcessingRequested"),
    originalKey: z.string().max(150),
    expectedSize: z.int().min(1).max(268435456),
    expectedSha256: sha256,
  })
  .superRefine((event, ctx) => {
    try {
      if (
        originalIdentity(event.originalKey).videoId !== event.videoId ||
        event.eventId !== logicalEventId(event.jobId, event.attemptId, event.type)
      )
        throw Error();
    } catch {
      ctx.addIssue({ code: "custom", message: "Unbound processing job" });
    }
  });
export type ProcessingRequested = z.infer<typeof processingRequested>;
const types = {
  started: "ProcessingStarted",
  succeeded: "ProcessingSucceeded",
  failed: "ProcessingFailed",
} as const;
export const videoEventIdentities = {
  request: (id: AssetJobIdentity) =>
    logicalEventId(
      videoUuid.parse(id.jobId),
      videoUuid.parse(id.attemptId),
      "VideoProcessingRequested",
    ),
  result: (id: AssetJobIdentity, kind: ProcessingKind) =>
    logicalEventId(videoUuid.parse(id.jobId), videoUuid.parse(id.attemptId), types[kind]),
  publication: publicationEventId,
};
export const processingEvent = z
  .discriminatedUnion("type", [
    z.strictObject({ ...base, ...job, type: z.literal("ProcessingStarted") }),
    z.strictObject({
      ...base,
      ...job,
      type: z.literal("ProcessingSucceeded"),
      result: videoHlsResult,
    }),
    z.strictObject({
      ...base,
      ...job,
      type: z.literal("ProcessingFailed"),
      code: z.enum(["INVALID_MEDIA", "PROCESSING_FAILED"]),
    }),
  ])
  .superRefine((event, ctx) => {
    try {
      if (event.eventId !== logicalEventId(event.jobId, event.attemptId, event.type)) throw Error();
      if (event.type === "ProcessingSucceeded")
        bindVideoResult(event.result, resultPrefix(event.videoId, event.jobId, event.attemptId));
    } catch {
      ctx.addIssue({ code: "custom", message: "Unbound processing result" });
    }
  });
export const requestedCodec = {
  parse: (raw: unknown, messageId?: string) => wireEvent(processingRequested, raw, messageId),
};
type MediaResultEvent =
  | { kind: "started" }
  | { kind: "succeeded"; result: VideoHlsResult }
  | { kind: "failed"; code: "INVALID_MEDIA" | "PROCESSING_FAILED" };
export const youtubeMediaCodecs = {
  job: (raw: unknown, messageId: string) => requestedCodec.parse(raw, messageId),
  video: (job: ProcessingRequested) => ({
    assetId: job.videoId,
    jobId: job.jobId,
    attemptId: job.attemptId,
    source: { key: job.originalKey, size: job.expectedSize, sha256: job.expectedSha256 },
    resultPrefix: resultPrefix(job.videoId, job.jobId, job.attemptId),
  }),
  result: (raw: unknown, job: ProcessingRequested) =>
    bindVideoResult(raw, resultPrefix(job.videoId, job.jobId, job.attemptId)),
  eventId: (job: ProcessingRequested, kind: ProcessingKind) =>
    videoEventIdentities.result(
      { assetId: job.videoId, jobId: job.jobId, attemptId: job.attemptId },
      kind,
    ),
  event: (
    job: ProcessingRequested,
    event: MediaResultEvent & { eventId: string; occurredAt: string },
  ) =>
    processingEvent.parse({
      schemaVersion: 1,
      type: types[event.kind],
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      videoId: job.videoId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      ...(event.kind === "succeeded"
        ? { result: event.result }
        : event.kind === "failed"
          ? { code: event.code }
          : {}),
    }),
};
