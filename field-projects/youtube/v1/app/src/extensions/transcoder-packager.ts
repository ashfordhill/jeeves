import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  mediaResult,
  resultPrefix,
  sha256,
  uuid,
  type ProcessingRequested,
} from "../contracts/v1.ts";
const relative = z
  .string()
  .regex(/^(?:(?:360|720)\/(?:index\.m3u8|segment[0-9]{5}\.ts)|master\.m3u8|thumbnail\.jpg)$/);
export const completionMarker = z
  .strictObject({
    schemaVersion: z.literal(1),
    videoId: uuid,
    jobId: uuid,
    attemptId: uuid,
    originalKey: z.string().max(150),
    originalSize: z.int().min(1).max(268435456),
    originalSha256: sha256,
    result: mediaResult,
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
      ![360, 720].every((h) => m.inventory.some((i) => i.path.startsWith(`${h}/segment`))) ||
      m.result.prefix !== resultPrefix(m.videoId, m.jobId, m.attemptId) ||
      m.result.renditions.some((r) => r.playlist !== m.result.prefix + `${r.height}/index.m3u8`) ||
      m.inventory.some((i) => i.contentType !== contentType(i.path))
    )
      c.addIssue({ code: "custom", message: "Incomplete marker inventory" });
  });
export type CompletionMarker = z.infer<typeof completionMarker>;
export function contentType(path: string) {
  return path.endsWith(".ts")
    ? ("video/mp2t" as const)
    : path.endsWith(".jpg")
      ? ("image/jpeg" as const)
      : ("application/vnd.apple.mpegurl" as const);
}
export function bindMarker(raw: unknown, job: ProcessingRequested) {
  const m = completionMarker.parse(raw);
  if (
    m.videoId !== job.videoId ||
    m.jobId !== job.jobId ||
    m.attemptId !== job.attemptId ||
    m.originalKey !== job.originalKey ||
    m.originalSize !== job.expectedSize ||
    m.originalSha256 !== job.expectedSha256
  )
    throw new Error("Marker fingerprint mismatch");
  return m;
}
export async function handle(output: string, job: ProcessingRequested, duration: number) {
  const prefix = resultPrefix(job.videoId, job.jobId, job.attemptId);
  const files: string[] = [];
  for (const height of [360, 720]) {
    const names = await readdir(join(output, String(height))),
      playlist = await readFile(join(output, String(height), "index.m3u8"), "utf8");
    const refs = playlist.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
    if (
      !playlist.startsWith("#EXTM3U\n") ||
      !playlist.includes("#EXT-X-ENDLIST") ||
      !playlist.includes("#EXT-X-PLAYLIST-TYPE:VOD") ||
      refs.length < 1 ||
      refs.length > 160 ||
      new Set(refs).size !== refs.length ||
      refs.some((r) => !/^segment[0-9]{5}\.ts$/.test(r)) ||
      playlist.split(/\r?\n/).some((l) => l.startsWith("#") && l.includes("URI=")) ||
      names.length !== refs.length + 1 ||
      refs.some((r) => !names.includes(r))
    )
      throw new Error("Unsafe or incomplete HLS inventory");
    files.push(...refs.map((r) => `${height}/${r}`), `${height}/index.m3u8`);
  }
  await writeFile(
    join(output, "master.m3u8"),
    "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-STREAM-INF:BANDWIDTH=1250000,RESOLUTION=640x360\n360/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=3500000,RESOLUTION=1280x720\n720/index.m3u8\n",
  );
  files.push("thumbnail.jpg", "master.m3u8");
  const inventory = [];
  for (const path of files) {
    const bytes = await readFile(join(output, path));
    inventory.push({
      path,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      contentType: contentType(path),
    });
  }
  return bindMarker(
    {
      schemaVersion: 1,
      videoId: job.videoId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      originalKey: job.originalKey,
      originalSize: job.expectedSize,
      originalSha256: job.expectedSha256,
      result: {
        prefix,
        manifest: prefix + "master.m3u8",
        thumbnail: prefix + "thumbnail.jpg",
        marker: prefix + "_complete.json",
        durationSeconds: duration,
        renditions: [360, 720].map((height) => ({
          height,
          width: height === 360 ? 640 : 1280,
          playlist: prefix + `${height}/index.m3u8`,
          videoCodec: "h264",
          audioCodec: "aac",
        })),
      },
      inventory,
    },
    job,
  );
}
