import { PGlite } from "@electric-sql/pglite";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Dependencies as loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { sha256 } from "../json.ts";
import { assembleV2 } from "./assemble.ts";
import { assetLifecycleSchema } from "./asset-lifecycle.ts";
import { outboxSchema, receiptSchema } from "./durability.ts";
import { counterSchema, counterTotalsSelect } from "./event-counter.ts";
import { historicalYouTubeModule as moduleUrl } from "./fixtures/historical-youtube.ts";
import { ownedUploadSchema } from "./upload-state.ts";

const { youtubeReadyView } = await import(moduleUrl("adapters/youtube-public-sql"));

const contract = await import(moduleUrl("adapters/youtube-contract"));
const events = await import(moduleUrl("adapters/youtube-events"));
const upload = await import(moduleUrl("adapters/youtube-upload"));
const watch = await import(moduleUrl("adapters/youtube-watch"));
const search = await import(moduleUrl("adapters/youtube-search"));
const { createYouTubeSearchProjection } = await import(moduleUrl("adapters/youtube-projection"));
const { createYouTubeViewCounter } = await import(moduleUrl("adapters/youtube-counter"));
const { createYouTubeLifecycle } = await import(moduleUrl("adapters/youtube-lifecycle"));
const { transaction } = await import(moduleUrl("runtime/transaction"));
const { publicVideoRecord, publicVideoMapping } = await import(moduleUrl("features/public-video"));
const { originalKey, resultPrefix } = await import(moduleUrl("features/video-paths"));
const videoId = "a47cc800-ffed-4ec1-9080-9c55f466cf31",
  jobId = "679acead-ab14-443e-9ec9-97e293f7d454",
  attemptId = "cf76c96e-dd5e-46f1-8361-28c46b5417a3";
function result(video = videoId, job = jobId, attempt = attemptId) {
  const prefix = resultPrefix(video, job, attempt);
  return {
    prefix,
    manifest: `${prefix}master.m3u8`,
    thumbnail: `${prefix}thumbnail.jpg`,
    marker: `${prefix}_complete.json`,
    durationSeconds: 3,
    renditions: [360, 720].map((height) => ({
      height,
      width: height === 360 ? 640 : 1280,
      playlist: `${prefix}${height}/index.m3u8`,
      videoCodec: "h264",
      audioCodec: "aac",
    })),
  };
}
const now = "2026-11-08T12:00:00Z";
const principal = {
  subject: "creator:alice",
  claims: { realm_access: { roles: ["creator"] }, preferred_username: " Alice " },
};
const input = {
  fileName: "lesson.mp4",
  contentType: "video/mp4",
  size: 12,
  lastModified: 123,
  sha256: "a".repeat(64),
  title: " A lesson ",
  description: "Public words",
};
const relation = { schema: "media_private", table: "assets" },
  transfers = { schema: "media_private", table: "uploads" },
  receipts = { schema: "media_private", table: "receipts" };
const outbox = { schema: "media_private", table: "intents", destinations: ["jobs", "published"] };
const publicView = { schema: "media_public", table: "ready" };
const tables = {
  receipts: { schema: "counts_private", table: "receipts" },
  totals: { schema: "counts_private", table: "totals" },
};
const totalView = { schema: "counts_public", table: "totals" };
type Query = {
  query(
    sql: string,
    args?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};
type Route = {
  method: string;
  url: string;
  handler(request: unknown, reply: { code(value: number): void }): Promise<unknown>;
};
function routes() {
  const mounted: Route[] = [];
  return {
    mounted,
    route: (route: Route) => mounted.push(route),
    async call(method: string, url: string, request: unknown = {}) {
      const route = mounted.find((r) => r.method === method && r.url === url);
      if (!route) throw Error("Route absent");
      let status = 200;
      const body = await route.handler(request, {
        code(value) {
          status = value;
        },
      });
      return { status, body };
    },
  };
}

describe("retained field-app product adapters against generic mechanisms", () => {
  it("canonicalizes identities and validates authoritative paths/stable wire policy using shared public schemas", () => {
    const requested = {
      schemaVersion: 1,
      type: "VideoProcessingRequested",
      eventId: events.videoEventIdentities.request({ assetId: videoId, jobId, attemptId }),
      occurredAt: now,
      videoId,
      jobId,
      attemptId,
      originalKey: originalKey(videoId, attemptId),
      expectedSize: 12,
      expectedSha256: "a".repeat(64),
    };
    expect(
      events.requestedCodec.parse(
        { ...requested, videoId: videoId.toUpperCase(), eventId: requested.eventId.toUpperCase() },
        requested.eventId.toUpperCase(),
      ),
    ).toEqual(requested);
    const r = result();
    const succeeded = {
      schemaVersion: 1,
      type: "ProcessingSucceeded",
      videoId,
      jobId,
      attemptId,
      occurredAt: now,
      eventId: events.videoEventIdentities.result(
        { assetId: videoId, jobId, attemptId },
        "succeeded",
      ),
      result: r,
    };
    expect(events.processingEvent.parse(succeeded).result).toEqual(r);
    for (const bad of [
      { ...requested, originalKey: originalKey(jobId, attemptId) },
      { ...requested, originalKey: `originals/${videoId}/not-a-uuid/source.mp4` },
      { ...requested, eventId: videoId },
    ])
      expect(() => events.requestedCodec.parse(bad)).toThrow();
    expect(() =>
      events.processingEvent.parse({ ...succeeded, result: result(videoId, attemptId, jobId) }),
    ).toThrow();
    const published = {
      schemaVersion: 1,
      type: "VideoPublished",
      eventId: contract.publicationEventId(videoId),
      occurredAt: now,
      videoId,
      publicationVersion: 1,
      title: "Lesson",
      description: "",
      channel: "Alice",
      visibility: "public",
      state: "ready",
      durationSeconds: 3,
      manifest: r.manifest,
      thumbnail: r.thumbnail,
      publishedAt: now,
    };
    expect(
      contract.publishedCodec.parse(
        { ...published, videoId: videoId.toUpperCase() },
        published.eventId.toUpperCase(),
      ).videoId,
    ).toBe(videoId);
    for (const patch of [
      { title: " " },
      { state: "pending" },
      { visibility: "private" },
      { creatorSubject: "private" },
      { eventId: videoId },
      { thumbnail: result(videoId, attemptId, jobId).thumbnail },
    ])
      expect(() => contract.publishedCodec.parse({ ...published, ...patch })).toThrow();
    expect(() => publicVideoRecord.parse({ ...published, type: undefined })).toThrow();
    expect(upload.validateYouTubeUpload(input, principal)).toMatchObject({
      metadata: { title: "A lesson", channel: "Alice" },
    });
    for (const [patch, statusCode] of [
      [{ size: 268435457 }, 413],
      [{ contentType: "text/plain" }, 422],
      [{ title: " " }, 400],
      [{ creator: "client" }, 400],
    ] as const)
      expect(() => upload.validateYouTubeUpload({ ...input, ...patch }, principal)).toThrow(
        expect.objectContaining({ statusCode }),
      );
    expect(() => upload.creatorIdentity({ ...principal, claims: {} })).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("composes durable upload/lifecycle, ready-only cache, fresh totals and confirm-gated Watch/Search browser shapes", async () => {
    const db = new PGlite();
    try {
      await db.exec(
        ownedUploadSchema(transfers) +
          assetLifecycleSchema(relation) +
          receiptSchema(receipts) +
          outboxSchema(outbox) +
          youtubeReadyView(relation, publicView) +
          counterSchema(tables, totalView) +
          `CREATE VIEW counts_public.totals AS ${counterTotalsSelect(tables)};`,
      );
      const pool = {
        connect: async () => ({
          query: async (sql: string, args?: unknown[]) => {
            const r = await db.query(sql, args);
            return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
          },
          release() {},
        }),
      };
      const run = (effect: (tx: Query) => Promise<unknown>) => transaction(pool, effect);
      const lifecycle = createYouTubeLifecycle({
        binding: { relation, receipts, receiptScope: "results", outbox, jobsDestination: "jobs" },
        publicationDestination: "published",
      });
      const multipart = upload.createYouTubeUpload({
        binding: transfers,
        lifecycle,
        transaction: run,
        objects: {
          ownsKey: () => true,
          create: async () => "provider-only",
          complete: async () => {},
          parts: async () => ({
            parts: [{ partNumber: 1, size: 12, etag: "part" }],
            truncated: false,
          }),
          head: async (r: { assetId: string; uploadId: string }) => ({
            size: 12,
            assetId: r.assetId,
            uploadId: r.uploadId,
            sha256: input.sha256,
            expectedSize: "12",
            etag: "complete",
          }),
          sign: async () => "http://signed.invalid/part",
          abort: async () => {},
          missing: () => false,
          unfinished: async () => ({ uploads: [], next: {} }),
        },
      });
      const u = routes();
      upload.mountYouTubeUpload(u, {
        multipart,
        lifecycle,
        transaction: run,
        principal: async () => principal,
      });
      expect(u.mounted.map(({ method, url }) => `${method} ${url}`)).toEqual([
        "GET /me",
        "POST /uploads",
        "GET /uploads",
        "GET /uploads/:uploadId",
        "POST /uploads/:uploadId/parts/:partNumber",
        "POST /uploads/:uploadId/complete",
        "POST /uploads/:uploadId/abort",
      ]);
      expect((await u.call("GET", "/me")).body).toEqual({
        sub: principal.subject,
        channel: "Alice",
      });
      const created = await u.call("POST", "/uploads", { body: input });
      expect(created.status).toBe(201);
      const started = created.body as { videoId: string; uploadId: string };
      expect(Object.keys(started).sort()).toEqual([
        "expiresAt",
        "partCount",
        "partSize",
        "state",
        "uploadId",
        "videoId",
      ]);
      const params = { uploadId: started.uploadId };
      const signed = await u.call("POST", "/uploads/:uploadId/parts/:partNumber", {
        params: { ...params, partNumber: "1" },
      });
      expect(signed.body).toMatchObject({ url: "http://signed.invalid/part" });
      const completed = await u.call("POST", "/uploads/:uploadId/complete", { params });
      expect(completed.status).toBe(202);
      expect(completed.body).toMatchObject({
        uploadId: started.uploadId,
        videoId: started.videoId,
        state: "pending",
      });
      const job = (
        await db.query<{ payload: unknown }>(
          "SELECT payload FROM media_private.intents WHERE destination='jobs'",
        )
      ).rows[0]?.payload;
      const parsed = events.requestedCodec.parse(job);
      expect(parsed.originalKey).toBe(originalKey(started.videoId, started.uploadId));
      const cacheValues = new Map<string, string>();
      let loads = 0;
      const read = watch.createYouTubeReadyReader({
        pool: {
          query: async (sql: string, args: unknown[]) => {
            loads++;
            return db.query(sql, args);
          },
        },
        view: publicView,
        ttlSeconds: 3600,
        cache: {
          get: async (key: string) => cacheValues.get(key) ?? null,
          set: async (key: string, value: string) => {
            cacheValues.set(key, value);
          },
        },
      });
      expect(await read(started.videoId)).toBeNull();
      expect(cacheValues.size).toBe(0);
      const success = {
        schemaVersion: 1,
        type: "ProcessingSucceeded",
        videoId: started.videoId.toUpperCase(),
        jobId: parsed.jobId.toUpperCase(),
        attemptId: parsed.attemptId.toUpperCase(),
        occurredAt: now,
        eventId: events.videoEventIdentities.result(
          { assetId: started.videoId, jobId: parsed.jobId, attemptId: parsed.attemptId },
          "succeeded",
        ),
        result: result(started.videoId, parsed.jobId, parsed.attemptId),
      };
      await run((tx) => lifecycle.apply(tx, success, success.eventId.toUpperCase()));
      await run((tx) =>
        lifecycle.apply(tx, { ...success, occurredAt: "2026-11-08T12:01:00Z" }, success.eventId),
      );
      const publication = (
        await db.query<{ payload: unknown }>(
          "SELECT payload FROM media_private.intents WHERE destination='published'",
        )
      ).rows[0]?.payload;
      expect(contract.publishedCodec.parse(publication).videoId).toBe(started.videoId);
      const metadata = await read(started.videoId.toUpperCase());
      expect(Object.keys(metadata).sort()).toEqual([
        "channel",
        "description",
        "durationSeconds",
        "manifest",
        "publicationVersion",
        "publishedAt",
        "thumbnail",
        "title",
        "videoId",
      ]);
      const w = routes();
      let confirm!: () => void, published: unknown;
      const confirmation = new Promise<void>((resolve) => {
        confirm = resolve;
      });
      watch.mountYouTubeWatch(w, {
        read,
        total: watch.createYouTubeTotalReader({ pool: db, view: totalView }),
        publisher: {
          async publish(body: Uint8Array) {
            published = JSON.parse(Buffer.from(body).toString());
            await confirmation;
          },
        },
      });
      const request = {
        params: { videoId: started.videoId.toUpperCase() },
        body: { eventId: videoId.toUpperCase() },
      };
      const before = await w.call("GET", "/videos/:videoId", request);
      expect(before.body).toMatchObject({
        views: "0",
        manifestUrl: `/media/${metadata.manifest}`,
        thumbnailUrl: `/media/${metadata.thumbnail}`,
      });
      let accepted = false;
      const acceptance = w.call("POST", "/videos/:videoId/views", request).then((r) => {
        accepted = true;
        return r;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(published).toBeDefined();
      expect(accepted).toBe(false);
      confirm();
      expect(await acceptance).toMatchObject({
        status: 202,
        body: { eventId: videoId, accepted: true, publicationVersion: 1 },
      });
      const counter = createYouTubeViewCounter(tables);
      await run((tx) => counter.record(tx, counter.parse(published, videoId.toUpperCase())));
      await run((tx) =>
        counter.record(
          tx,
          counter.parse({ ...(published as object), acceptedAt: now, occurredAt: now }, videoId),
        ),
      );
      expect((await w.call("GET", "/videos/:videoId", request)).body).toMatchObject({ views: "1" });
      expect(loads).toBe(2);
      expect(cacheValues.size).toBe(1);
      expect([...cacheValues.values()][0]).not.toContain('"views"');
      await expect(
        w.call("POST", "/videos/:videoId/views", {
          ...request,
          body: { ...request.body, extra: true },
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: "VIEW_REQUEST" });
      await expect(
        w.call("POST", "/videos/:videoId/views", { ...request, params: { videoId: attemptId } }),
      ).rejects.toMatchObject({ statusCode: 404, code: "VIDEO_NOT_READY" });
      let indexed: { body: unknown; id: string } | undefined;
      const projection = createYouTubeSearchProjection({
        binding: { index: "public-videos", ...publicVideoMapping },
        client: {
          async index(value: typeof indexed) {
            indexed = value;
          },
        },
      });
      const event = contract.publishedCodec.parse(publication);
      await projection.upsert(projection.parse(publication, event.eventId.toUpperCase()));
      const query = search.createYouTubeSearch({
        binding: { index: "public-videos", ...publicVideoMapping },
        client: {
          async search() {
            return {
              body: {
                timed_out: false,
                _shards: { failed: 0 },
                hits: {
                  total: { value: 1, relation: "eq" },
                  hits: [{ _id: indexed?.id, _source: indexed?.body }],
                },
              },
            };
          },
        },
      });
      const s = routes();
      search.mountYouTubeSearch(s, query);
      expect(await s.call("GET", "/videos", { query: { q: " lesson " } })).toMatchObject({
        status: 200,
        body: {
          q: "lesson",
          page: 1,
          pageSize: 20,
          total: 1,
          hits: [
            {
              videoId: started.videoId,
              title: "A lesson",
              channel: "Alice",
              thumbnailUrl: `/media/${metadata.thumbnail}`,
            },
          ],
        },
      });
      await expect(s.call("GET", "/videos", { query: { q: " " } })).rejects.toMatchObject({
        code: "SEARCH_QUERY",
        statusCode: 400,
      });
      const status = (await u.call("GET", "/uploads/:uploadId", { params })).body;
      expect(status).toMatchObject({
        state: "ready",
        videoId: started.videoId,
        jobId: parsed.jobId,
        attemptId: parsed.attemptId,
        failure: null,
        file: { sha256: input.sha256 },
      });
      expect(JSON.stringify(status)).not.toMatch(/ownerSubject|provider|originalKey|metadata/);
      expect((await u.call("GET", "/uploads")).body).toMatchObject({
        uploads: [{ title: "A lesson", state: "ready" }],
      });
    } finally {
      await db.close();
    }
  });

  it("exports deterministic generic dependencies without the field application product code", () => {
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: generationSelectionsFixture(),
    });
    const registry = loadLocalV2Registry(),
      first = assembleV2({ designJson: JSON.stringify(design) }, registry),
      second = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const signature = (bundle: typeof first) =>
      bundle.files.map((file) => [file.path, sha256(file.bytes)]);
    expect(signature(first)).toEqual(signature(second));
    expect(
      first.manifest.files.some((f) =>
        /src\/adapters\/|public-video|video-paths|src\/services\//.test(f.path),
      ),
    ).toBe(false);
    expect(first.report.applicationComplete).toBe(false);
    expect(
      first.report.gaps.some((g) => g.id === "application-implementations" && g.required),
    ).toBe(true);
    expect(registry.installed.templates).toEqual([]);
  });
});
