import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import {
  assetLifecyclePersistence,
  assetLifecycleSchema,
  assetReadySelect,
} from "./asset-lifecycle.ts";
import { outboxSchema, receiptSchema } from "./durability.ts";
import { ownedUploadSchema } from "./upload-state.ts";

// Execute exact emitted modules with real offline SQL, no Docker/network/SDK stubs.
const urls = new Map<string, string>();
function moduleUrl(name: string): string {
  const previous = urls.get(name);
  if (previous) return previous;
  const base = new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts`, import.meta.url);
  const js = stripTypeScriptTypes(
    readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8"),
  ).replace(/from "\.\/(.+)\.ts"/g, (_match, dep: string) => `from "${moduleUrl(dep)}"`);
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { transaction } = await import(moduleUrl("transaction"));
const { createOwnedUploads } = await import(moduleUrl("owned-upload"));
const { createAssetLifecycle, assetEventId, assetUuid } = await import(
  moduleUrl("asset-lifecycle")
);
const { startAssetLifecycleWorker } = await import(moduleUrl("asset-worker"));
const relation = { schema: "attachments", table: "assets" };
const uploads = { ...relation, table: "transfers" };
const receipts = { ...relation, table: "receipts" };
const outbox = { ...relation, table: "intents", destinations: ["document-jobs", "document-ready"] };
const metadata = z.strictObject({ document: z.string().min(1).max(100) }).parse;
const wire = z.strictObject({
  message: z.string().min(1),
  at: z.iso.datetime(),
  attachment: z.uuid(),
  job: z.uuid(),
  attempt: z.uuid(),
  signal: z.enum(["start", "done", "error"]),
  payload: z.unknown().optional(),
  reason: z.string().optional(),
});
const principal = { subject: "verified:Alice", claims: { sub: "verified:Alice" } };
const input = {
  file: {
    fileName: "report.pdf",
    contentType: "application/pdf",
    size: 12,
    lastModified: 1,
    sha256: "a".repeat(64),
  },
  metadata: { document: "case-sensitive Document" },
};
type TestTx = { query(sql: string, values?: unknown[]): Promise<unknown> };
type Id = { assetId: string; jobId: string; attemptId: string };
type Transfer = { assetId: string; uploadId: string; originalKey: string; file: typeof input.file };
async function database(publish = true) {
  const db = new PGlite();
  await db.exec(
    ownedUploadSchema(uploads) +
      assetLifecycleSchema(relation) +
      receiptSchema(receipts) +
      outboxSchema(outbox),
  );
  const pool = {
    async connect() {
      return {
        async query(sql: string, values?: unknown[]) {
          const r = await db.query(sql, values);
          return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
        },
        release() {},
      };
    },
  };
  const run = (effect: (tx: TestTx) => Promise<unknown>) => transaction(pool, effect);
  const modes = { job: false, publication: false, response: false, closed: false, failed: false };
  const identities = {
    request: (id: Id) => assetEventId("attachment-demo", id.jobId, id.attemptId, "request"),
    result: (id: Id, kind: string) => assetEventId("attachment-demo", id.jobId, id.attemptId, kind),
    publication: (assetId: string) => assetEventId("attachment-demo", assetId, "public", "1"),
  };
  const lifecycle = createAssetLifecycle(
    {
      relation,
      receipts,
      outbox,
      receiptScope: "AttachmentResults",
      jobsDestination: "document-jobs",
      identities,
    },
    {
      metadata,
      event(input: unknown) {
        const e = wire.parse(input);
        const base = {
          eventId: e.message,
          occurredAt: e.at,
          assetId: e.attachment,
          jobId: e.job,
          attemptId: e.attempt,
        };
        if (e.signal === "done") return { ...base, kind: "succeeded", result: e.payload };
        if (e.signal === "error") return { ...base, kind: "failed", code: e.reason };
        return { ...base, kind: "started" };
      },
      result(input: unknown, id: Id) {
        return z
          .strictObject({
            key: z.literal(`reports/${id.assetId}/${id.jobId}/${id.attemptId}/report.pdf`),
            pages: z.int().min(1).max(1000),
          })
          .parse(input);
      },
      failure: z.enum(["INVALID_DOCUMENT", "PROCESSING_FAILED"]).parse,
      async failed() {
        if (modes.failed) throw new Error("Failure hook failed");
      },
      job: {
        codec: (input: unknown, eventId: string) =>
          z
            .strictObject({
              eventId: z.literal(eventId),
              assetId: z.uuid(),
              jobId: z.uuid(),
              attemptId: z.uuid(),
              key: z.string(),
            })
            .parse(input),
        async construct(_tx: TestTx, value: Id & { eventId: string; original: { key: string } }) {
          if (modes.job) throw new Error("Job construction failed");
          return {
            eventId: value.eventId,
            assetId: value.assetId,
            jobId: value.jobId,
            attemptId: value.attemptId,
            key: value.original.key,
          };
        },
      },
      response: (value: unknown) => (modes.response ? { bad: true } : value),
      ...(publish
        ? {
            publication: {
              destination: "document-ready",
              codec: (input: unknown, eventId: string) =>
                z
                  .strictObject({
                    eventId: z.literal(eventId),
                    assetId: z.uuid(),
                    document: z.string(),
                    pages: z.int(),
                    version: z.literal(1),
                  })
                  .parse(input),
              async construct(
                tx: TestTx,
                ready: Id & {
                  metadata: { document: string };
                  result: { pages: number };
                  publicationVersion: number;
                },
                eventId: string,
              ) {
                // Constructor sees ready in this exact transaction; throwing rolls all effects back.
                await tx.query(
                  `SELECT asset_id FROM attachments.assets WHERE asset_id=$1 AND state='ready'`,
                  [ready.assetId],
                );
                if (modes.publication) throw new Error("Publication construction failed");
                return {
                  eventId,
                  assetId: ready.assetId,
                  document: ready.metadata.document,
                  pages: ready.result.pages,
                  version: ready.publicationVersion,
                };
              },
            },
          }
        : {}),
    },
  );
  const repository = createOwnedUploads(
    {
      ...uploads,
      originalKey: ({ assetId, uploadId }: Transfer) => `reports/${assetId}/${uploadId}/source.pdf`,
    },
    {
      validate: (value: typeof input) => value,
      metadata,
      response: z.strictObject({
        assetId: z.uuid(),
        uploadId: z.uuid(),
        jobId: z.uuid(),
        attemptId: z.uuid(),
        state: z.literal("pending"),
      }).parse,
      ...lifecycle.uploadHooks,
      closed: async (tx: TestTx, upload: Transfer, terminal: unknown) => {
        await lifecycle.uploadHooks.closed(tx, upload, terminal);
        if (modes.closed) throw new Error("Closed hook failed");
      },
    },
  );
  const reserve = () => run((tx) => repository.reserve(tx, principal, input));
  const complete = async (upload: Transfer) => {
    await run((tx) => repository.saveProvider(tx, upload.uploadId, principal, "provider"));
    await run((tx) => repository.beginComplete(tx, upload.uploadId, principal));
    return run((tx) =>
      repository.complete(tx, upload.uploadId, principal, {
        key: upload.originalKey,
        size: upload.file.size,
        sha256: upload.file.sha256,
        etag: "verified",
      }),
    );
  };
  const pending = async () => {
    const upload = await reserve();
    return { upload, ...(await complete(upload)).response };
  };
  const event = (id: Id, kind: string, extra: Record<string, unknown> = {}) => ({
    message: identities.result(
      {
        assetId: assetUuid(id.assetId),
        jobId: assetUuid(id.jobId),
        attemptId: assetUuid(id.attemptId),
      },
      kind,
    ),
    at: "2026-11-08T10:00:00.000Z",
    attachment: id.assetId,
    job: id.jobId,
    attempt: id.attemptId,
    signal: kind === "started" ? "start" : kind === "succeeded" ? "done" : "error",
    ...(kind === "succeeded"
      ? {
          payload: {
            key: `reports/${assetUuid(id.assetId)}/${assetUuid(id.jobId)}/${assetUuid(id.attemptId)}/report.pdf`,
            pages: 2,
          },
        }
      : {}),
    ...(kind === "failed" ? { reason: "INVALID_DOCUMENT" } : {}),
    ...extra,
  });
  const apply = (e: unknown) => run((tx) => lifecycle.apply(tx, e));
  const counts = async () => ({
    intents: (await db.query("SELECT * FROM attachments.intents")).rows.length,
    receipts: (await db.query("SELECT * FROM attachments.receipts")).rows.length,
    ready: (await db.query(assetReadySelect(relation))).rows.length,
  });
  return {
    db,
    pool,
    run,
    modes,
    lifecycle,
    repository,
    reserve,
    complete,
    pending,
    event,
    apply,
    counts,
  };
}

describe("emitted fixed asset lifecycle", () => {
  it("commits upload pending/job and result ready/publication/receipt atomically with stable replay", async () => {
    const f = await database();
    try {
      const upload = await f.reserve();
      f.modes.job = true;
      await expect(f.complete(upload)).rejects.toThrow("Job construction failed");
      expect(await f.counts()).toEqual({ intents: 0, receipts: 0, ready: 0 });
      expect(await f.run((tx) => f.lifecycle.get(tx, upload.assetId))).toMatchObject({
        state: "uploading",
        jobId: null,
      });
      f.modes.job = false;
      f.modes.response = true;
      await expect(f.complete(upload)).rejects.toThrow();
      expect(await f.counts()).toEqual({ intents: 0, receipts: 0, ready: 0 });
      f.modes.response = false;
      const complete = await f.complete(upload),
        id = complete.response;
      const pending = await f.run((tx) => f.lifecycle.get(tx, upload.assetId));
      expect(pending.deadlineAt.getTime() - pending.queuedAt.getTime()).toBeGreaterThanOrEqual(
        600000,
      );
      expect(pending.deadlineAt.getTime() - pending.queuedAt.getTime()).toBeLessThan(601000);
      const e = f.event(
        {
          ...id,
          assetId: id.assetId.toUpperCase(),
          jobId: id.jobId.toUpperCase(),
          attemptId: id.attemptId.toUpperCase(),
        },
        "succeeded",
      );
      f.modes.publication = true;
      await expect(
        f.run(async (tx) => {
          await f.lifecycle.apply(tx, e).catch(() => {});
        }),
      ).rejects.toThrow("Publication construction failed");
      expect(await f.counts()).toEqual({ intents: 1, receipts: 0, ready: 0 });
      f.modes.publication = false;
      expect(await f.apply(e)).toEqual({ applied: true, result: { outcome: "ready" } });
      expect(await f.apply({ ...e, at: "2026-11-08T10:00:01.000Z" })).toEqual({
        applied: false,
        result: { outcome: "ready" },
      });
      expect(await f.counts()).toEqual({ intents: 2, receipts: 1, ready: 1 });
      const replay = await f.complete(upload);
      expect(replay).toEqual({ outcome: "duplicate", response: id });
      expect(await f.counts()).toEqual({ intents: 2, receipts: 1, ready: 1 });
      await expect(f.apply({ ...e, payload: { ...e.payload, pages: 3 } })).rejects.toThrow(
        "Conflicting or incomplete receipt",
      );
      expect(await f.counts()).toEqual({ intents: 2, receipts: 1, ready: 1 });
      const publicSource = (await f.db.query(assetReadySelect(relation))).rows[0];
      expect(publicSource).toMatchObject({
        asset_id: id.assetId,
        publication_version: 1,
        metadata: input.metadata,
        result: { pages: 2 },
      });
      expect(publicSource).not.toHaveProperty("owner_subject");
    } finally {
      await f.db.close();
    }
  });

  it("rejects stale/unknown/failed/late effects, preserves fixed deadlines and allows optional publication", async () => {
    const f = await database(false);
    try {
      const id = await f.pending(),
        stale = { ...id, jobId: randomUUID() };
      expect((await f.apply(f.event(stale, "succeeded"))).result.outcome).toBe("stale");
      expect(
        (await f.apply(f.event({ ...stale, assetId: randomUUID() }, "failed"))).result.outcome,
      ).toBe("unknown");
      const started = f.event(id, "started");
      await f.apply(started);
      const running = await f.run((tx) => f.lifecycle.get(tx, id.assetId));
      expect(running.deadlineAt.getTime() - running.startedAt.getTime()).toBeGreaterThanOrEqual(
        1800000,
      );
      expect(running.deadlineAt.getTime() - running.startedAt.getTime()).toBeLessThan(1801000);
      await f.apply({ ...started, at: "2026-11-08T11:00:00.000Z" });
      expect((await f.run((tx) => f.lifecycle.get(tx, id.assetId))).deadlineAt).toEqual(
        running.deadlineAt,
      );
      f.modes.failed = true;
      await expect(
        f.run(async (tx) => {
          await f.lifecycle.apply(tx, f.event(id, "failed")).catch(() => {});
        }),
      ).rejects.toThrow("Failure hook failed");
      expect(await f.run((tx) => f.lifecycle.get(tx, id.assetId))).toMatchObject({
        state: "processing",
      });
      f.modes.failed = false;
      await f.apply(f.event(id, "failed"));
      expect((await f.apply(f.event(id, "succeeded"))).result.outcome).toBe("terminal");
      expect(await f.run((tx) => f.lifecycle.get(tx, id.assetId))).toMatchObject({
        state: "failed",
        failureCode: "INVALID_DOCUMENT",
      });
      const queued = await f.pending();
      await f.db.query(
        "UPDATE attachments.assets SET deadline_at=clock_timestamp()-interval '1 second' WHERE asset_id=$1",
        [queued.assetId],
      );
      expect((await f.apply(f.event(queued, "succeeded"))).result.outcome).toBe("terminal");
      expect(await f.run((tx) => f.lifecycle.get(tx, queued.assetId))).toMatchObject({
        failureCode: "QUEUE_DEADLINE",
      });
      const late = await f.pending();
      await f.apply(f.event(late, "started"));
      await f.db.query(
        "UPDATE attachments.assets SET deadline_at=clock_timestamp()-interval '1 second' WHERE asset_id=$1",
        [late.assetId],
      );
      expect((await f.apply(f.event(late, "succeeded"))).result.outcome).toBe("terminal");
      expect(await f.run((tx) => f.lifecycle.get(tx, late.assetId))).toMatchObject({
        failureCode: "PROCESSING_DEADLINE",
      });
      const ready = await f.pending();
      const result = f.event(ready, "succeeded");
      await expect(
        f.apply({ ...result, payload: { ...result.payload, pages: 1001 } }),
      ).rejects.toThrow();
      await expect(f.apply({ ...result, message: randomUUID() })).rejects.toThrow(
        "Unbound processing event identity",
      );
      await f.apply(result);
      expect(
        (await f.db.query("SELECT * FROM attachments.intents WHERE destination='document-ready'"))
          .rows,
      ).toEqual([]);
      expect((await f.counts()).ready).toBe(1);
      expect(assetEventId("CaseSensitive", "A")).not.toBe(assetEventId("CaseSensitive", "a"));
    } finally {
      await f.db.close();
    }
  });

  it("synchronizes upload terminal hooks and bounds deadline sweeps at 50", async () => {
    const f = await database();
    try {
      const aborted = await f.reserve();
      f.modes.closed = true;
      await expect(
        f.run(async (tx) => {
          await f.repository.close(tx, aborted.uploadId, principal, "aborted").catch(() => {});
        }),
      ).rejects.toThrow("Closed hook failed");
      expect(await f.run((tx) => f.lifecycle.get(tx, aborted.assetId))).toMatchObject({
        state: "uploading",
      });
      f.modes.closed = false;
      await f.run((tx) => f.repository.close(tx, aborted.uploadId, principal, "aborted"));
      const expired = await f.reserve();
      await f.run((tx) => f.repository.saveProvider(tx, expired.uploadId, principal, "provider"));
      await f.db.query(
        "UPDATE attachments.transfers SET expires_at=clock_timestamp()-interval '1 second' WHERE upload_id=$1",
        [expired.uploadId],
      );
      await f.run((tx) => f.repository.beginComplete(tx, expired.uploadId, principal));
      for (const code of ["INITIATION_FAILED", "UPLOAD_MISMATCH"]) {
        const failed = await f.reserve();
        await f.run((tx) => f.repository.fail(tx, failed.uploadId, principal, code));
        expect(await f.run((tx) => f.lifecycle.get(tx, failed.assetId))).toMatchObject({
          state: "failed",
          failureCode: code,
        });
      }
      expect(await f.run((tx) => f.lifecycle.get(tx, aborted.assetId))).toMatchObject({
        state: "aborted",
      });
      expect(await f.run((tx) => f.lifecycle.get(tx, expired.assetId))).toMatchObject({
        state: "expired",
      });
      expect(await f.counts()).toEqual({ intents: 0, receipts: 0, ready: 0 });
      // Stage existing one-attempt jobs via SQL; no timers or extended policy for the harness.
      for (let index = 0; index < 51; index++)
        await f.db.query(
          "INSERT INTO attachments.assets(asset_id,upload_id,metadata,state,job_id,attempt_id,queued_at,deadline_at) VALUES($1,$2,$3,'pending',$4,$5,clock_timestamp()-interval '11 minutes',clock_timestamp()-interval '1 minute')",
          [randomUUID(), randomUUID(), input.metadata, randomUUID(), randomUUID()],
        );
      expect(await f.run((tx) => f.lifecycle.sweep(tx))).toBe(50);
      expect(await f.run((tx) => f.lifecycle.sweep(tx))).toBe(1);
      expect(await f.run((tx) => f.lifecycle.sweep(tx))).toBe(0);
      expect(await f.counts()).toEqual({ intents: 0, receipts: 0, ready: 0 });
    } finally {
      await f.db.close();
    }
  });

  it("starts with a DB sweep, uses distinct wire codec in its worker and drains the admitted consumer", async () => {
    const f = await database(false);
    try {
      const id = await f.pending(),
        events: string[] = [];
      let handler: (body: Buffer, delivery: { messageId: string }) => Promise<void> =
        async () => {};
      let finish!: (result: { fatal: boolean }) => void;
      const closed = new Promise<{ fatal: boolean }>((resolve) => {
        finish = resolve;
      });
      const worker = await startAssetLifecycleWorker({
        pool: f.pool,
        lifecycle: {
          ...f.lifecycle,
          sweep: async (tx: TestTx) => {
            events.push("sweep");
            return f.lifecycle.sweep(tx);
          },
        },
        openConsumer: async (handle: typeof handler) => {
          events.push("consume");
          handler = handle;
          return {
            closed,
            async close() {
              events.push("close");
              finish({ fatal: false });
            },
          };
        },
      });
      expect(events).toEqual(["sweep", "consume"]);
      const e = f.event(id, "succeeded");
      await handler(Buffer.from(JSON.stringify(e)), { messageId: e.message });
      await expect(handler(Buffer.from("{}"), { messageId: "unknown" })).rejects.toMatchObject({
        code: "MALFORMED_MESSAGE",
      });
      expect((await f.counts()).ready).toBe(1);
      await worker.close();
      await worker.close();
      expect(await worker.closed).toEqual({ fatal: false });
      expect(events).toEqual(["sweep", "consume", "close"]);
    } finally {
      await f.db.close();
    }
  });

  it("emits dependency code and same-authority persistence without an installed application or media SQL access", () => {
    const contribution = assetLifecyclePersistence({
      resource: "metadata-db",
      uploadHost: "upload",
      lifecycleHost: "completion-handler",
      relation,
      receipts,
      outbox,
      migrationId: "002-assets.sql",
      sourcePaths: ["/generation/selections/1"],
    });
    const registry = loadLocalV2Registry([
      {
        id: "probe.lifecycle",
        version: "0.1.0",
        status: "diagnostic",
        description: "Explicit lifecycle persistence probe",
        sourcePaths: ["jeeves-generator/src/v2/asset-lifecycle.ts"],
        render: () => ({ files: [] }),
        local: () => contribution,
      },
    ]);
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: generationSelectionsFixture(),
    });
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const files = bundle.manifest.files.filter(
      (f) => f.owner !== "assembler" && f.owner.id === "local.asset-lifecycle",
    );
    expect(files.map((f) => f.path).sort()).toEqual([
      "src/runtime/asset-lifecycle.ts",
      "src/runtime/asset-sql.ts",
      "src/runtime/asset-worker.ts",
    ]);
    for (const file of files)
      expect(
        new TextDecoder().decode(bundle.files.find((f) => f.path === file.path)?.bytes),
      ).not.toMatch(/videoId|video_private|youtube|channel|title/);
    const plan = JSON.parse(
      new TextDecoder().decode(bundle.files.find((f) => f.path === "infra/local.json")?.bytes),
    );
    expect(plan.logins.map((l: { host: string }) => l.host).sort()).toEqual([
      "completion-handler",
      "upload",
    ]);
    expect(
      plan.grants
        .filter((g: { relation: string; host: string }) => g.relation === "receipts")
        .map((g: { host: string }) => g.host),
    ).toEqual(["completion-handler"]);
    expect(plan.views).toEqual([]);
    expect(registry.installed.templates).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(() => assetLifecycleSchema({ ...relation, table: "unsafe.table" })).toThrow(
      "Invalid SQL identifier",
    );
  });
});
