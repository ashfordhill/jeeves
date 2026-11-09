import type pg from "pg";
import { z } from "zod";
import { publicVideoRecord } from "../features/public-video.ts";
import { videoUuid } from "../features/video-paths.ts";
import { qualifiedRelation, type SqlRelation } from "../runtime/durable-sql.ts";
import { createPositiveReader, type PositiveCache } from "../runtime/positive-cache.ts";
import { createTotalReader } from "../runtime/counter-read.ts";
import { HttpError, type HttpRoutes } from "../runtime/http.ts";
import { viewPlayed } from "./youtube-contract.ts";

export function createYouTubeReadyReader(options: {
  pool: Pick<pg.Pool, "query">;
  view: SqlRelation;
  ttlSeconds: number;
  cache?: PositiveCache;
}) {
  const view = qualifiedRelation(options.view);
  const read = createPositiveReader({
    ttlSeconds: options.ttlSeconds,
    cache: options.cache,
    adapter: {
      key: (id: string) => `ready-video:v1:${videoUuid.parse(id)}`,
      codec: publicVideoRecord,
      eligible: (record, id) => record.videoId === videoUuid.parse(id),
      async load(id) {
        const result = await options.pool.query(`SELECT * FROM ${view} WHERE video_id=$1`, [
          videoUuid.parse(id),
        ]);
        const row = result.rows[0];
        if (!row) return null;
        return publicVideoRecord.parse({
          videoId: row.video_id,
          title: row.title,
          description: row.description,
          channel: row.channel,
          durationSeconds: row.duration_seconds,
          manifest: row.manifest,
          thumbnail: row.thumbnail,
          publishedAt: row.published_at.toISOString(),
          publicationVersion: row.publication_version,
        });
      },
    },
  });
  return (id: string) => read(videoUuid.parse(id));
}
export function createYouTubeTotalReader(options: {
  pool: Pick<pg.Pool, "query">;
  view: SqlRelation;
}) {
  return createTotalReader({ ...options, key: (id: string) => videoUuid.parse(id) });
}
export function mountYouTubeWatch(
  routes: HttpRoutes,
  options: {
    read: ReturnType<typeof createYouTubeReadyReader>;
    total: ReturnType<typeof createYouTubeTotalReader>;
    publisher: { publish(body: Uint8Array, messageId: string): Promise<void> };
  },
) {
  const request = z.strictObject({ eventId: videoUuid });
  async function ready(id: string) {
    const video = await options.read(id);
    if (!video)
      throw new HttpError(404, "VIDEO_NOT_READY", "This video is not publicly available.");
    return publicVideoRecord.parse(video);
  }
  routes.route({
    method: "GET",
    url: "/videos/:videoId",
    handler: async (req) => {
      const id = videoUuid.safeParse((req.params as { videoId: string }).videoId);
      if (!id.success) throw new HttpError(400, "VIDEO_ID", "Invalid video identity.");
      const video = await ready(id.data);
      return {
        ...video,
        manifestUrl: `/media/${video.manifest}`,
        thumbnailUrl: `/media/${video.thumbnail}`,
        views: await options.total(id.data),
      };
    },
  });
  routes.route({
    method: "POST",
    url: "/videos/:videoId/views",
    handler: async (req, reply) => {
      const id = videoUuid.safeParse((req.params as { videoId: string }).videoId),
        body = request.safeParse(req.body);
      if (!id.success || !body.success)
        throw new HttpError(400, "VIEW_REQUEST", "Supply a video UUID and an eventId UUID only.");
      const video = await ready(id.data),
        acceptedAt = new Date().toISOString();
      const event = viewPlayed.parse({
        schemaVersion: 1,
        type: "ViewPlayed",
        eventId: body.data.eventId,
        videoId: video.videoId,
        publicationVersion: video.publicationVersion,
        occurredAt: acceptedAt,
        acceptedAt,
      });
      await options.publisher.publish(Buffer.from(JSON.stringify(event)), event.eventId);
      reply.code(202);
      return {
        eventId: event.eventId,
        accepted: true,
        acceptedAt,
        publicationVersion: event.publicationVersion,
      };
    },
  });
}
