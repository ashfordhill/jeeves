import { z } from "zod";
import { assetUuid, type AssetJobIdentity } from "./asset-identity.ts";

const uuid = z.string().transform((value, ctx) => {
  try {
    return assetUuid(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid asset/job identity" });
    return z.NEVER;
  }
});
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const key = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^[A-Za-z0-9_./-]+$/)
  .refine((s) => s.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
const prefix = z
  .string()
  .max(150)
  .endsWith("/")
  .refine((s) => key.safeParse(s.slice(0, -1)).success);
export const videoSourceFingerprint = z.strictObject({
  key,
  size: z.int().min(1).max(268435456),
  sha256,
});
/** Trusted adapter binds the immutable result prefix to its job namespace; no product convention. */
export const videoHlsJob = z.strictObject({
  assetId: uuid,
  jobId: uuid,
  attemptId: uuid,
  source: videoSourceFingerprint,
  resultPrefix: prefix,
});
export type VideoHlsJob = z.infer<typeof videoHlsJob>;
export type VideoSourceFingerprint = z.infer<typeof videoSourceFingerprint>;
export const videoHlsResult = z
  .strictObject({
    prefix,
    manifest: key,
    thumbnail: key,
    marker: key,
    durationSeconds: z.number().finite().min(1).max(600),
    renditions: z
      .array(
        z.strictObject({
          height: z.union([z.literal(360), z.literal(720)]),
          width: z.union([z.literal(640), z.literal(1280)]),
          playlist: key,
          videoCodec: z.literal("h264"),
          audioCodec: z.literal("aac"),
        }),
      )
      .length(2),
  })
  .superRefine((m, c) => {
    if (
      m.manifest !== m.prefix + "master.m3u8" ||
      m.thumbnail !== m.prefix + "thumbnail.jpg" ||
      m.marker !== m.prefix + "_complete.json" ||
      new Set(m.renditions.map((r) => r.height)).size !== 2 ||
      m.renditions.some(
        (r) =>
          r.playlist !== m.prefix + `${r.height}/index.m3u8` ||
          r.width !== (r.height === 360 ? 640 : 1280),
      )
    )
      c.addIssue({ code: "custom", message: "Incomplete or unbound video result" });
  });
export type VideoHlsResult = z.infer<typeof videoHlsResult>;
const relative = z
  .string()
  .regex(/^(?:(?:360|720)\/(?:index\.m3u8|segment[0-9]{5}\.ts)|master\.m3u8|thumbnail\.jpg)$/);
export function videoContentType(path: string) {
  return path.endsWith(".ts")
    ? ("video/mp2t" as const)
    : path.endsWith(".jpg")
      ? ("image/jpeg" as const)
      : ("application/vnd.apple.mpegurl" as const);
}
export const videoCompletionMarker = z
  .strictObject({
    schemaVersion: z.literal(1),
    assetId: uuid,
    jobId: uuid,
    attemptId: uuid,
    source: videoSourceFingerprint,
    result: videoHlsResult,
    inventory: z
      .array(
        z.strictObject({
          path: relative,
          size: z.int().min(1).max(268435456),
          sha256,
          contentType: z.enum(["video/mp2t", "application/vnd.apple.mpegurl", "image/jpeg"]),
        }),
      )
      .min(6)
      .max(500),
  })
  .superRefine((m, c) => {
    const paths = new Set(m.inventory.map((i) => i.path));
    if (
      paths.size !== m.inventory.length ||
      ["360/index.m3u8", "720/index.m3u8", "master.m3u8", "thumbnail.jpg"].some(
        (p) => !paths.has(p),
      ) ||
      ![360, 720].every((h) => {
        const count = m.inventory.filter((i) => i.path.startsWith(`${h}/segment`)).length;
        return count >= 1 && count <= 160;
      }) ||
      m.inventory.some((i) => i.contentType !== videoContentType(i.path))
    )
      c.addIssue({ code: "custom", message: "Incomplete marker inventory" });
  });
export type VideoCompletionMarker = z.infer<typeof videoCompletionMarker>;
/** Result binding for lifecycle/application codecs; caller supplies its authoritative prefix. */
export function bindVideoResult(raw: unknown, resultPrefix: string): VideoHlsResult {
  const result = videoHlsResult.parse(raw);
  if (result.prefix !== prefix.parse(resultPrefix)) throw new Error("Video result prefix mismatch");
  return result;
}
export function bindVideoMarker(raw: unknown, input: VideoHlsJob): VideoCompletionMarker {
  const job = videoHlsJob.parse(input),
    marker = videoCompletionMarker.parse(raw);
  for (const field of [
    "assetId",
    "jobId",
    "attemptId",
  ] as const satisfies readonly (keyof AssetJobIdentity)[])
    if (marker[field] !== job[field]) throw new Error("Marker identity mismatch");
  if (
    marker.source.key !== job.source.key ||
    marker.source.size !== job.source.size ||
    marker.source.sha256 !== job.source.sha256
  )
    throw new Error("Marker fingerprint mismatch");
  bindVideoResult(marker.result, job.resultPrefix);
  return marker;
}
