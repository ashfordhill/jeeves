import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Dependencies as loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { ownedUploadSchema } from "./upload-state.ts";

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
const { createOwnedMultipart, PART_SIZE, validateParts } = await import(moduleUrl("multipart"));
const alice = { subject: "document:alice", claims: {} },
  bob = { subject: "document:bob", claims: {} };
const file = {
  fileName: "report.pdf",
  contentType: "application/pdf",
  size: 12,
  lastModified: 123,
  sha256: "a".repeat(64),
};
type Row = { uploadId: string; assetId: string; originalKey: string; file: typeof file };
async function fixture(
  onFailure?: (what: string, error: unknown, extra?: Record<string, unknown>) => void,
) {
  const db = new PGlite();
  await db.exec(
    ownedUploadSchema({ schema: "docs", table: "transfers" }) +
      "CREATE TABLE docs.jobs(asset uuid PRIMARY KEY);",
  );
  const run = (effect: (tx: unknown) => Promise<unknown>) =>
    transaction(
      {
        connect: async () => ({
          query: async (sql: string, args?: unknown[]) => {
            const r = await db.query(sql, args);
            return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
          },
          release() {},
        }),
      },
      effect,
    );
  const repo = createOwnedUploads(
    {
      schema: "docs",
      table: "transfers",
      originalKey: (r: Row) => `docs/${r.assetId}/${r.uploadId}`,
    },
    {
      validate: (input: typeof file) => ({ file: input, metadata: { folder: "reports" } }),
      metadata: (v: unknown) => v,
      response: (v: unknown) => v,
      reserve: async () => {},
      complete: async (tx: { query(sql: string, args: unknown[]): Promise<unknown> }, row: Row) => {
        await tx.query("INSERT INTO docs.jobs VALUES($1)", [row.assetId]);
        return { assetId: row.assetId, accepted: true };
      },
      closed: async () => {},
    },
  );
  const state = {
    parts: [{ partNumber: 1, size: 12, etag: "part-etag" }],
    truncated: false,
    missing: false,
    mismatch: false,
    uncertain: false,
    completeCalls: 0,
    signed: 0,
    created: 0,
    aborts: [] as string[],
    orphanCursor: [] as unknown[],
    createError: undefined as Error | undefined,
  };
  const objects = {
    ownsKey: (key: string) => key.startsWith("docs/"),
    missing: (error: Error) => error.name === "NoSuchUpload",
    create: async () => {
      if (state.createError) throw state.createError;
      state.created++;
      return "provider-1";
    },
    sign: async (_r: Row, _n: number, seconds: number) => {
      state.signed++;
      expect(seconds).toBe(900);
      return "opaque-test-url";
    },
    parts: async () => {
      if (state.missing) throw Object.assign(new Error(), { name: "NoSuchUpload" });
      return { parts: state.parts, truncated: state.truncated, next: "same-marker" };
    },
    complete: async () => {
      state.completeCalls++;
      state.missing = true; // provider consumes inventory before the SQL hook
      if (state.uncertain) throw new Error("Provider outcome uncertain");
    },
    head: async (r: Row) => ({
      size: r.file.size,
      etag: "object-etag",
      assetId: r.assetId,
      uploadId: r.uploadId,
      sha256: state.mismatch ? "b".repeat(64) : r.file.sha256,
      expectedSize: String(r.file.size),
    }),
    abort: async (key: string) => {
      state.aborts.push(key);
    },
    unfinished: async (cursor: unknown) => {
      state.orphanCursor.push(cursor);
      return {
        uploads: [
          { key: "docs/old", uploadId: "orphan", initiated: new Date(0) },
          { key: "other/old", uploadId: "foreign", initiated: new Date(0) },
          { key: "docs/new", uploadId: "recent", initiated: new Date() },
        ],
        next: { key: "docs/old", uploadId: "orphan" },
      };
    },
  };
  return {
    db,
    run,
    repo,
    state,
    api: createOwnedMultipart({ repository: repo, transaction: run, objects, onFailure }),
  };
}

describe("owned signed multipart engine", () => {
  it("uses durable ownership and exact inventory, retains fingerprint for resume and completes once after uncertainty", async () => {
    const { db, state, api } = await fixture();
    try {
      const started = await api.start(alice, file);
      expect(started).toMatchObject({ partSize: 5242880, partCount: 1, state: "uploading" });
      for (const operation of ["status", "sign", "complete", "abort"])
        await expect(api[operation](started.uploadId, bob, 1)).rejects.toMatchObject({
          statusCode: 404,
        });
      expect(state).toMatchObject({ created: 1, signed: 0, completeCalls: 0, aborts: [] });
      expect(await api.list(bob)).toEqual({ uploads: [] });
      const status = await api.status(started.uploadId, alice);
      expect(status.file).toEqual(file);
      expect(status.parts).toEqual(state.parts);
      expect(status).not.toHaveProperty("providerUploadId");
      expect(status).not.toHaveProperty("originalKey");
      expect(status).not.toHaveProperty("ownerSubject");
      await expect(api.sign(started.uploadId, alice, 2)).rejects.toMatchObject({
        code: "PART_NUMBER",
      });
      expect(await api.sign(started.uploadId, alice, 1)).toHaveProperty("url", "opaque-test-url");
      state.parts = [{ partNumber: 1, size: 11, etag: "short" }];
      await expect(api.complete(started.uploadId, alice)).rejects.toMatchObject({
        code: "INCOMPLETE_PARTS",
      });
      expect(state.completeCalls).toBe(0);
      state.parts = [{ partNumber: 1, size: 12, etag: "valid" }];
      state.uncertain = true;
      await expect(api.complete(started.uploadId, alice)).rejects.toThrow(
        "Provider outcome uncertain",
      );
      expect((await db.query("SELECT phase FROM docs.transfers")).rows).toEqual([
        { phase: "completing" },
      ]);
      expect(await api.status(started.uploadId, alice)).toMatchObject({
        state: "completed",
        phase: "closed",
      });
      const response = await api.complete(started.uploadId, alice);
      expect(await api.complete(started.uploadId, alice)).toEqual(response);
      expect(state.completeCalls).toBe(1);
      expect((await db.query("SELECT * FROM docs.jobs")).rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it("refuses wrong Head fingerprints and terminal uploads; bounds inventory and scoped cleanup", async () => {
    const { db, state, api } = await fixture();
    try {
      const broken = await api.start(alice, file);
      state.mismatch = true;
      await expect(api.complete(broken.uploadId, alice)).rejects.toMatchObject({
        code: "UPLOAD_MISMATCH",
      });
      expect(await api.status(broken.uploadId, alice)).toMatchObject({
        state: "failed",
        failureCode: "UPLOAD_MISMATCH",
      });
      state.missing = false;
      state.mismatch = false;
      const aborted = await api.start(alice, file);
      await api.abort(aborted.uploadId, alice);
      await expect(api.complete(aborted.uploadId, alice)).rejects.toMatchObject({
        statusCode: 410,
      });
      const expired = await api.start(alice, file);
      await db.query(
        "UPDATE docs.transfers SET expires_at=clock_timestamp()-interval '1 second' WHERE upload_id=$1",
        [expired.uploadId],
      );
      await expect(api.sign(expired.uploadId, alice, 1)).rejects.toMatchObject({ statusCode: 410 });
      const oversizedInventory = await api.start(alice, file);
      state.truncated = true;
      await expect(api.status(oversizedInventory.uploadId, alice)).rejects.toMatchObject({
        code: "PARTS_LIMIT",
      });
      state.truncated = false;
      const first = api.sweep();
      expect(api.sweep()).toBe(first);
      await first;
      await api.sweep();
      expect(state.aborts.filter((key) => key === "docs/old")).toHaveLength(2);
      expect(state.aborts).not.toContain("other/old");
      expect(state.aborts).not.toContain("docs/new");
      expect(state.orphanCursor[1]).toEqual({ key: "docs/old", uploadId: "orphan" });
      expect((await db.query("SELECT * FROM docs.transfers WHERE cleanup_needed")).rows).toEqual(
        [],
      );
      expect(() => validateParts([{ partNumber: 2, size: 12, etag: "e" }], 12)).toThrow();
      expect(() =>
        validateParts(
          [
            { partNumber: 1, size: PART_SIZE, etag: "e" },
            { partNumber: 1, size: 1, etag: "e" },
          ],
          PART_SIZE + 1,
        ),
      ).toThrow();
      expect(() => validateParts([{ partNumber: 1, size: 12, etag: "e" }], 268435457)).toThrow();
    } finally {
      await db.close();
    }
  });

  it("reports a failed start with its error and upload, and still answers 503 INITIATION_FAILED", async () => {
    const failures: unknown[][] = [];
    const { db, state, api } = await fixture((...failure) => failures.push(failure));
    try {
      state.createError = new Error("Provider unavailable");
      await expect(api.start(alice, file)).rejects.toMatchObject({
        statusCode: 503,
        code: "INITIATION_FAILED",
      });
      const { uploads } = await api.list(alice);
      expect(uploads).toMatchObject([{ state: "failed", failureCode: "INITIATION_FAILED" }]);
      expect(failures).toEqual([
        ["multipart start", new Error("Provider unavailable"), { upload: uploads[0].uploadId }],
      ]);
    } finally {
      await db.close();
    }
  });

  it("emits real generic transport and minimal object access while keeping required recipe hooks unfinished", () => {
    const generation = generationSelectionsFixture();
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: {
        version: 1,
        runtime: generation.runtime,
        selections: generation.selections.filter((s) => s.binding.kind === "owned-multipart"),
      },
    });
    const registry = loadLocalV2Registry();
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const files = bundle.manifest.files.filter(
      (f) => f.owner !== "assembler" && f.owner.id === "local.multipart",
    );
    expect(files.map((f) => f.path).sort()).toEqual([
      "src/runtime/multipart-http.ts",
      "src/runtime/multipart-objects.ts",
      "src/runtime/multipart.ts",
    ]);
    for (const file of files)
      expect(
        new TextDecoder().decode(bundle.files.find((f) => f.path === file.path)?.bytes),
      ).not.toMatch(/videoId|youtube|video_private|source\.mp4/);
    const plan = JSON.parse(
      new TextDecoder().decode(bundle.files.find((f) => f.path === "infra/local.json")?.bytes),
    );
    expect(plan.storage).toEqual([
      expect.objectContaining({
        host: "upload",
        resource: "originals",
        read: true,
        write: true,
        corsPut: true,
      }),
    ]);
    expect(plan.application).toEqual([]);
    expect(bundle.report.gaps).toContainEqual(
      expect.objectContaining({
        id: "multipart-application-bindings",
        required: true,
        status: "unfinished",
      }),
    );
    expect(registry.installed.templates).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
  });
});
