import type pg from "pg";
import { z } from "zod";
import { uuid } from "../contracts/v1.ts";
export const readyVideo = z
  .strictObject({
    videoId: uuid,
    title: z.string().min(1).max(200),
    description: z.string().max(5000),
    channel: z.string().min(1).max(200),
    durationSeconds: z.number().min(1).max(600),
    manifest: z.string().max(250),
    thumbnail: z.string().max(250),
    publishedAt: z.iso.datetime(),
    publicationVersion: z.literal(1),
  })
  .superRefine((m, c) => {
    for (const p of [m.manifest, m.thumbnail])
      if (
        !new RegExp(
          `^videos/${m.videoId}/[a-f0-9-]{36}/[a-f0-9-]{36}/(?:master\\.m3u8|thumbnail\\.jpg)$`,
        ).test(p)
      )
        c.addIssue({ code: "custom", message: "Invalid public path" });
  });
export type ReadyVideo = z.infer<typeof readyVideo>;
export interface ReadyCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
}
// Cache contains only immutable public metadata. Never cache null, private status or totals.
export function readyReader(pool: Pick<pg.Pool, "query">, cache?: ReadyCache) {
  const fills = new Map<string, Promise<ReadyVideo | null>>();
  async function read(videoId: string) {
    const key = `ready-video:v1:${videoId}`;
    if (cache)
      try {
        const value = await cache.get(key);
        if (value) {
          const parsed = readyVideo.parse(JSON.parse(value));
          if (parsed.videoId === videoId) return parsed;
        }
      } catch {
        console.error("Ready cache unavailable; using primary");
      }
    const rows = await pool.query("SELECT * FROM video_public.ready_videos WHERE video_id=$1", [
        videoId,
      ]),
      r = rows.rows[0];
    if (!r) return null;
    const value = readyVideo.parse({
      videoId: r.video_id,
      title: r.title,
      description: r.description,
      channel: r.channel,
      durationSeconds: r.duration_seconds,
      manifest: r.manifest,
      thumbnail: r.thumbnail,
      publishedAt: r.published_at.toISOString(),
      publicationVersion: r.publication_version,
    });
    if (cache)
      try {
        await cache.set(key, JSON.stringify(value), { EX: 3600 });
      } catch {
        console.error("Ready cache fill deferred");
      }
    return value;
  }
  return (videoId: string) => {
    uuid.parse(videoId);
    const existing = fills.get(videoId);
    if (existing) return existing;
    const fill = read(videoId).finally(() => fills.delete(videoId));
    fills.set(videoId, fill);
    return fill;
  };
}
