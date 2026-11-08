import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { outboxSchema } from "./durability.ts";
import { ownedUploadPersistence, ownedUploadSchema } from "./upload-state.ts";

// Run the exact emitted SQL/modules offline, with no SDK/runtime or SQL interpreter mock.
const urls = new Map<string, string>();
function moduleUrl(name: string): string {
  const previous = urls.get(name);
  if (previous) return previous;
  const base = new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts`, import.meta.url);
  const source = readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8");
  const js = stripTypeScriptTypes(source).replace(
    /from "\.\/(.+)\.ts"/g,
    (_match, dep: string) => `from "${moduleUrl(dep)}"`,
  );
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { transaction } = await import(moduleUrl("transaction"));
const { createOwnedUploads } = await import(moduleUrl("owned-upload"));
const { createOutbox } = await import(moduleUrl("outbox"));
const relation = { schema: "attachments_private", table: "transfers" };
const intents = {
  schema: "attachments_private",
  table: "intents",
  destinations: ["document-jobs"],
};
const principal = { subject: "verified:alice", claims: { sub: "verified:alice" } },
  foreign = { subject: "verified:bob", claims: { sub: "verified:bob" } };
const input = {
  file: {
    fileName: "report.pdf",
    contentType: "application/pdf",
    size: 12,
    lastModified: 123,
    sha256: "a".repeat(64),
  },
  metadata: { document: "report-1" },
  ownerSubject: foreign.subject,
  originalKey: "untrusted/key",
};
const metadata = (value: unknown) => {
  const m = value as { document: string };
  if (typeof m.document !== "string" || !m.document.length)
    throw new Error("Invalid document metadata");
  return { document: m.document };
};
const response = (value: unknown) => {
  const r = value as { assetId: string; jobId: string; state: string };
  if (typeof r.assetId !== "string" || typeof r.jobId !== "string" || r.state !== "pending")
    throw new Error("Invalid document response");
  return { assetId: r.assetId, jobId: r.jobId, state: "pending" };
};
type TestTx = { query(sql: string, values?: unknown[]): Promise<unknown> };
type TestRow = { assetId: string; uploadId: string; originalKey: string; file: typeof input.file };
async function database() {
  const db = new PGlite();
  await db.exec(
    ownedUploadSchema(relation) +
      outboxSchema(intents) +
      "CREATE TABLE attachments_private.documents(id uuid PRIMARY KEY,state text NOT NULL);",
  );
  const pool = {
    async connect() {
      return {
        async query(sql: string, values?: unknown[]) {
          const result = await db.query(sql, values);
          return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
        },
        release() {},
      };
    },
  };
  const modes = { reserve: false, complete: false, closed: false, invalidResponse: false };
  let completed = 0;
  const outbox = createOutbox(intents, "document-jobs", (value: unknown) => value);
  const repo = createOwnedUploads(
    {
      ...relation,
      originalKey: ({ assetId, uploadId }: TestRow) => `documents/${assetId}/${uploadId}/source`,
    },
    {
      validate: (raw: typeof input) => ({ file: raw.file, metadata: metadata(raw.metadata) }),
      metadata,
      response,
      async reserve(tx: TestTx, row: TestRow) {
        await tx.query("INSERT INTO attachments_private.documents VALUES($1,'uploading')", [
          row.assetId,
        ]);
        if (modes.reserve) throw new Error("reserve hook failed");
      },
      async complete(tx: TestTx, row: TestRow) {
        completed++;
        const jobId = randomUUID();
        await tx.query("UPDATE attachments_private.documents SET state='pending' WHERE id=$1", [
          row.assetId,
        ]);
        await outbox.enqueue(tx, {
          eventId: jobId,
          intentKey: `job:${row.assetId}`,
          payload: { assetId: row.assetId, jobId },
        });
        if (modes.complete) throw new Error("completion hook failed");
        return modes.invalidResponse
          ? { assetId: row.assetId, jobId, state: "bad" }
          : { assetId: row.assetId, jobId, state: "pending" };
      },
      async closed(tx: TestTx, row: TestRow, terminal: { state: string }) {
        await tx.query("UPDATE attachments_private.documents SET state=$2 WHERE id=$1", [
          row.assetId,
          terminal.state,
        ]);
        if (modes.closed) throw new Error("terminal hook failed");
      },
    },
  );
  const run = (effect: (tx: TestTx) => Promise<unknown>) => transaction(pool, effect);
  const original = (row: TestRow) => ({
    key: row.originalKey,
    size: row.file.size,
    sha256: row.file.sha256,
    etag: "provider-etag",
  });
  const reserve = () => run((tx) => repo.reserve(tx, principal, input));
  const activate = (row: TestRow) =>
    run((tx) => repo.saveProvider(tx, row.uploadId, principal, "provider-id"));
  return { db, repo, run, modes, reserve, activate, original, completed: () => completed };
}

describe("emitted owned upload persistence", () => {
  it("reserves server identities with metadata atomically and isolates the verified owner", async () => {
    const { db, repo, run, modes, reserve } = await database();
    try {
      modes.reserve = true;
      await expect(
        run(async (tx) => {
          await repo.reserve(tx, principal, input).catch(() => {});
        }),
      ).rejects.toThrow("reserve hook failed");
      expect((await db.query("SELECT * FROM attachments_private.documents")).rows).toEqual([]);
      expect((await db.query("SELECT * FROM attachments_private.transfers")).rows).toEqual([]);
      modes.reserve = false;
      const row = await reserve();
      expect(row.ownerSubject).toBe(principal.subject);
      expect(row.originalKey).toBe(`documents/${row.assetId}/${row.uploadId}/source`);
      expect(row.metadata).toEqual(input.metadata);
      expect(row.phase).toBe("initiating");
      expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThanOrEqual(86400000);
      expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeLessThan(86401000);
      expect(
        await run((tx) => repo.owned(tx, row.uploadId.toUpperCase(), principal)),
      ).toMatchObject({ uploadId: row.uploadId });
      expect(await run((tx) => repo.owned(tx, row.uploadId, foreign))).toBeNull();
      expect(
        await run((tx) => repo.saveProvider(tx, row.uploadId, foreign, "foreign-provider")),
      ).toEqual({ outcome: "unknown" });
      expect(await run((tx) => repo.recent(tx, foreign))).toEqual([]);
      expect(await run((tx) => repo.recent(tx, principal))).toHaveLength(1);
      expect((await reserve()).assetId).not.toBe(row.assetId); // no idempotent-start behavior
    } finally {
      await db.close();
    }
  });

  it("keeps provider uncertainty, completion state and job intent atomic with a stable replay response", async () => {
    const { db, repo, run, modes, reserve, activate, original, completed } = await database();
    try {
      const row = await reserve();
      expect(await activate(row)).toEqual({ outcome: "active" });
      await run((tx) => repo.beginComplete(tx, row.uploadId, principal));
      modes.complete = true;
      await expect(
        run(async (tx) => {
          await repo.complete(tx, row.uploadId, principal, original(row)).catch(() => {});
        }),
      ).rejects.toThrow("completion hook failed");
      expect((await db.query("SELECT state FROM attachments_private.documents")).rows).toEqual([
        { state: "uploading" },
      ]);
      expect((await db.query("SELECT * FROM attachments_private.intents")).rows).toEqual([]);
      expect(await run((tx) => repo.owned(tx, row.uploadId, principal))).toMatchObject({
        phase: "completing",
        completeResponse: null,
        providerUploadId: "provider-id",
      });
      modes.complete = false;
      modes.invalidResponse = true;
      await expect(
        run((tx) => repo.complete(tx, row.uploadId, principal, original(row))),
      ).rejects.toThrow("Invalid document response");
      modes.invalidResponse = false;
      expect(await run((tx) => repo.complete(tx, row.uploadId, foreign, original(row)))).toEqual({
        outcome: "unknown",
      });
      expect(
        await run((tx) =>
          repo.complete(tx, row.uploadId, principal, { ...original(row), sha256: "b".repeat(64) }),
        ),
      ).toEqual({ outcome: "mismatch" });
      const result = await run((tx) => repo.complete(tx, row.uploadId, principal, original(row)));
      expect(result.outcome).toBe("completed");
      await db.exec(
        "UPDATE attachments_private.transfers SET expires_at=clock_timestamp()-interval '1 day'",
      );
      expect(
        await run((tx) => repo.complete(tx, row.uploadId, principal, { key: "ignored-on-replay" })),
      ).toEqual({ outcome: "duplicate", response: result.response });
      expect(await run((tx) => repo.beginComplete(tx, row.uploadId, principal))).toMatchObject({
        outcome: "duplicate",
      });
      expect(completed()).toBe(3); // two rolled back hooks, one committed hook; replay does not run it
      expect((await db.query("SELECT * FROM attachments_private.intents")).rows).toHaveLength(1);
      expect((await db.query("SELECT state FROM attachments_private.documents")).rows).toEqual([
        { state: "pending" },
      ]);
    } finally {
      await db.close();
    }
  });

  it("refuses terminal completion, commits terminal hooks together and exposes bounded reconciliation/cleanup", async () => {
    const { db, repo, run, modes, reserve, activate, original } = await database();
    try {
      const row = await reserve();
      await activate(row);
      await run((tx) => repo.beginComplete(tx, row.uploadId, principal));
      expect(await run((tx) => repo.interrupted(tx))).toHaveLength(1);
      await run((tx) => repo.reopenIncomplete(tx, row.uploadId, principal));
      expect(await run((tx) => repo.interrupted(tx))).toEqual([]);
      modes.closed = true;
      await expect(
        run(async (tx) => {
          await repo.close(tx, row.uploadId, principal, "aborted").catch(() => {});
        }),
      ).rejects.toThrow("terminal hook failed");
      expect(await run((tx) => repo.owned(tx, row.uploadId, principal))).toMatchObject({
        state: "uploading",
        phase: "active",
      });
      modes.closed = false;
      expect(await run((tx) => repo.close(tx, row.uploadId, principal, "expired"))).toEqual({
        outcome: "not-due",
      });
      expect(await run((tx) => repo.close(tx, row.uploadId, principal, "aborted"))).toEqual({
        outcome: "aborted",
      });
      expect(await run((tx) => repo.complete(tx, row.uploadId, principal, original(row)))).toEqual({
        outcome: "conflict",
      });
      expect(await run((tx) => repo.cleanup(tx))).toHaveLength(1);
      await run((tx) => repo.clearCleanup(tx, row.uploadId));
      expect(await run((tx) => repo.cleanup(tx))).toEqual([]);
      const expiring = await reserve();
      await activate(expiring);
      await db.query(
        "UPDATE attachments_private.transfers SET expires_at=clock_timestamp()-interval '1 second' WHERE upload_id=$1",
        [expiring.uploadId],
      );
      expect(await run((tx) => repo.beginComplete(tx, expiring.uploadId, principal))).toMatchObject(
        { outcome: "expired" },
      );
      expect(
        await run((tx) => repo.complete(tx, expiring.uploadId, principal, original(expiring))),
      ).toEqual({ outcome: "conflict" });
      const failed = await reserve();
      await db.query(
        "UPDATE attachments_private.transfers SET created_at=clock_timestamp()-interval '2 minutes' WHERE upload_id=$1",
        [failed.uploadId],
      );
      expect(await run((tx) => repo.interrupted(tx))).toHaveLength(1);
      expect(
        await run((tx) => repo.fail(tx, failed.uploadId, principal, "INITIATION_FAILED")),
      ).toBe(true);
      expect(await run((tx) => repo.beginComplete(tx, failed.uploadId, principal))).toMatchObject({
        outcome: "conflict",
      });
      expect(
        (await db.query("SELECT state FROM attachments_private.documents ORDER BY state")).rows,
      ).toEqual([{ state: "aborted" }, { state: "expired" }, { state: "failed" }]);
    } finally {
      await db.close();
    }
  });

  it("emits generic dependencies and explicit migration/access contributions without installing multipart", () => {
    expect(() => ownedUploadSchema({ ...relation, table: "unsafe.table" })).toThrow(
      "Invalid SQL identifier",
    );
    const contribution = ownedUploadPersistence({
      resource: "metadata-db",
      host: "upload",
      relation,
      migrationId: "001-owned-uploads.sql",
      sourcePaths: ["/generation/selections/0"],
    });
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: generationSelectionsFixture(),
    });
    const registry = loadLocalV2Registry([
      {
        id: "probe.uploads",
        version: "0.1.0",
        status: "diagnostic",
        description: "Bound persistence only",
        sourcePaths: ["jeeves-generator/src/v2/upload-state.ts"],
        render: () => ({ files: [] }),
        local: () => contribution,
      },
    ]);
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const files = bundle.manifest.files.filter(
      (f) => f.owner !== "assembler" && f.owner.id === "local.upload-state",
    );
    expect(files.map((f) => f.path).sort()).toEqual([
      "src/runtime/owned-upload.ts",
      "src/runtime/upload-sql.ts",
    ]);
    for (const file of files)
      expect(
        new TextDecoder().decode(bundle.files.find((f) => f.path === file.path)?.bytes),
      ).not.toMatch(/videoId|video_private|youtube|channel|title/);
    const plan = JSON.parse(
      new TextDecoder().decode(bundle.files.find((f) => f.path === "infra/local.json")?.bytes),
    );
    expect(plan.logins).toHaveLength(1);
    expect(plan.grants).toHaveLength(1);
    expect(plan.grants[0]).toMatchObject({
      schema: relation.schema,
      relation: relation.table,
      privileges: ["SELECT", "INSERT", "UPDATE"],
    });
    expect(bundle.report.applicationComplete).toBe(false);
    expect(registry.installed.templates).toEqual([]);
  });
});
