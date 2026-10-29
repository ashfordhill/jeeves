import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type DesignDocument,
  designSchema,
  type LayoutDocument,
  layoutSchema,
  type OperationInput,
} from "@jeeves/spec";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../../fixtures/designs/${name}`, import.meta.url), "utf8"),
  );
const linkShortener = designSchema.parse(fixture("link-shortener.json"));
const linkShortenerLayout = layoutSchema.parse(fixture("link-shortener.layout.json"));

/** Builds the link-shortener fixture from an empty design. */
function linkShortenerOps(): OperationInput[] {
  return [
    ...linkShortener.elements.map((element) => ({ op: "addElement" as const, element })),
    ...linkShortener.connections.map((connection) => ({ op: "connect" as const, connection })),
    ...linkShortener.annotations.map((annotation) => ({
      op: "addAnnotation" as const,
      annotation,
    })),
  ];
}

const service = (id: string, name = id): OperationInput => ({
  op: "addElement",
  element: { id, name, template: { id: "http-service", version: "0.1.0" } },
});

type DesignState = {
  projectId: string;
  design: DesignDocument;
  findings: { code: string }[];
  history: { canUndo: boolean; canRedo: boolean; latestEdit: number | null };
  operationId?: number;
};

/** Thin client over `app.inject`, so tests read like API calls. */
function api(app: FastifyInstance) {
  const call = async (
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    body?: unknown,
  ) => {
    const res = await app.inject({
      method,
      url,
      ...(body === undefined ? {} : { payload: body as object }),
    });
    return { status: res.statusCode, body: res.body ? res.json() : undefined };
  };
  return {
    call,
    createProject: async (name = "Link shortener") => {
      const res = await call("POST", "/projects", { name });
      expect(res.status).toBe(201);
      return res.body.project.id as string;
    },
    design: async (id: string) => (await call("GET", `/projects/${id}/design`)).body as DesignState,
    edit: (id: string, baseRevision: number, ops: unknown[], source?: string) =>
      call("POST", `/projects/${id}/operations`, { baseRevision, ops, ...(source && { source }) }),
    undo: (id: string, baseRevision: number) =>
      call("POST", `/projects/${id}/undo`, { baseRevision }),
    redo: (id: string, baseRevision: number) =>
      call("POST", `/projects/${id}/redo`, { baseRevision }),
  };
}

let db: Db;
let close: () => Promise<void>;
let app: FastifyInstance;
let client: ReturnType<typeof api>;

beforeAll(async () => {
  ({ db, close } = await openTestDb());
  app = buildTestApp(db);
  client = api(app);
});

afterAll(async () => {
  await app.close();
  await close();
});

describe("projects", () => {
  it("creates, lists, renames, and deletes a project", async () => {
    const id = await client.createProject("Draft");
    expect((await client.call("GET", "/projects")).body.projects).toContainEqual(
      expect.objectContaining({ id, name: "Draft", revision: 0 }),
    );

    const renamed = await client.call("PATCH", `/projects/${id}`, { name: "Shorty" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.project).toMatchObject({ id, name: "Shorty" });
    expect((await client.call("GET", `/projects/${id}`)).body.project.name).toBe("Shorty");

    expect((await client.call("DELETE", `/projects/${id}`)).status).toBe(204);
    expect((await client.call("GET", `/projects/${id}`)).status).toBe(404);
    expect((await client.call("GET", `/projects/${id}/design`)).status).toBe(404);
    expect((await client.call("DELETE", `/projects/${id}`)).status).toBe(404);
  });

  it("starts with an empty design and layout", async () => {
    const id = await client.createProject();
    expect(await client.design(id)).toEqual({
      projectId: id,
      design: { schemaVersion: 1, revision: 0, elements: [], connections: [], annotations: [] },
      findings: [],
      history: { canUndo: false, canRedo: false, latestEdit: null },
    });
    expect((await client.call("GET", `/projects/${id}/layout`)).body).toEqual({
      layout: { schemaVersion: 1, items: {} },
    });
  });

  it("rejects bad input with 400 and unknown projects with 404", async () => {
    expect((await client.call("POST", "/projects", { name: "  " })).status).toBe(400);
    const bad = await client.call("GET", "/projects/not-a-uuid/design");
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("BAD_REQUEST");
    const missing = "00000000-0000-4000-8000-000000000000";
    expect((await client.edit(missing, 0, [service("a")])).status).toBe(404);
    expect((await client.undo(missing, 0)).status).toBe(404);
    expect(
      (await client.call("PUT", `/projects/${missing}/layout`, { schemaVersion: 1 })).status,
    ).toBe(404);
  });
});

describe("operations", () => {
  it("saves a batch as one revision and reloads it", async () => {
    const id = await client.createProject();
    const res = await client.edit(id, 0, linkShortenerOps(), "canvas");
    expect(res.status).toBe(200);
    expect(res.body.design.revision).toBe(1);
    expect(res.body.findings).toEqual([]);
    expect(res.body.history).toMatchObject({ canUndo: true, canRedo: false });
    expect(res.body.operationId).toEqual(expect.any(Number));

    const reloaded = await client.design(id);
    expect(reloaded.design).toEqual({ ...linkShortener, revision: 1 });
    expect((await client.call("GET", `/projects/${id}`)).body.project.revision).toBe(1);
  });

  it("saves readiness findings with the design", async () => {
    const id = await client.createProject();
    const res = await client.edit(id, 0, [
      {
        op: "addElement",
        element: { id: "web", name: "Web", template: { id: "web-app", version: "0.1.0" } },
      },
    ]);
    expect(res.status).toBe(200);
    const findings = await client.call("GET", `/projects/${id}/findings`);
    expect(findings.body.revision).toBe(1);
    expect(findings.body.findings).toEqual([
      expect.objectContaining({
        code: "CONFIG_REQUIRED",
        target: expect.objectContaining({ element: "web" }),
      }),
    ]);
  });

  it("returns 409 with the current design for a stale baseRevision", async () => {
    const id = await client.createProject();
    await client.edit(id, 0, [service("links")]);
    await client.edit(id, 1, [service("auth")]);

    const stale = await client.edit(id, 1, [service("billing")]);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("REVISION_CONFLICT");
    expect(stale.body.design.revision).toBe(2);
    expect(stale.body.design.elements.map((e: { id: string }) => e.id)).toEqual(["links", "auth"]);
    expect(stale.body.history).toMatchObject({ canUndo: true, canRedo: false });
    expect((await client.design(id)).design.revision).toBe(2);
  });

  it("changes nothing when any op in a batch is invalid", async () => {
    const id = await client.createProject();
    await client.edit(id, 0, [service("links")]);
    const before = await client.design(id);

    // The second op refers to an element that doesn't exist.
    const missing = await client.edit(id, 1, [
      service("auth"),
      { op: "removeElement", id: "nope" },
    ]);
    expect(missing.status).toBe(422);
    expect(missing.body.code).toBe("INVALID_OPERATION");
    expect(missing.body.errors).toEqual([
      expect.objectContaining({ code: "UNKNOWN_REFERENCE", target: { op: 1 } }),
    ]);

    // A malformed op is reported with its index, not as a generic 400.
    const malformed = await client.edit(id, 1, [service("auth"), { op: "teleport" }]);
    expect(malformed.status).toBe(422);
    expect(malformed.body.errors[0]).toMatchObject({
      code: "INVALID_OPERATION",
      target: { op: 1 },
    });

    // The result would be structurally invalid: Postgres can't take a REST server attachment.
    const structural = await client.edit(id, 1, [
      {
        op: "addElement",
        element: { id: "db", name: "DB", template: { id: "postgres", version: "0.1.0" } },
      },
      {
        op: "addAttachment",
        element: "db",
        attachment: { id: "db-api", template: { id: "rest-api-server", version: "0.1.0" } },
      },
    ]);
    expect(structural.status).toBe(422);
    expect(structural.body.errors[0].code).toBe("ATTACHMENT_INCOMPATIBLE");

    expect(
      (await client.call("POST", `/projects/${id}/operations`, { baseRevision: 1, ops: [] }))
        .status,
    ).toBe(400);

    expect(await client.design(id)).toEqual(before);
    // Nothing was recorded: the one undo step is still the first edit.
    expect((await client.undo(id, 1)).body.design.elements).toEqual([]);
    expect((await client.design(id)).history).toMatchObject({ canUndo: false, canRedo: true });
  });
});

describe("undo and redo", () => {
  it("restores snapshots as new revisions and survives a server restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jeeves-s3-"));
    try {
      let first = await openTestDb(dir);
      let firstApp = buildTestApp(first.db);
      let c = api(firstApp);
      const id = await c.createProject();
      await c.edit(id, 0, [service("links")]);
      await c.edit(id, 1, [service("auth")], "chat");
      await firstApp.close();
      await first.close();

      // Restart: a new process would open the same database and build a fresh app.
      first = await openTestDb(dir);
      firstApp = buildTestApp(first.db);
      c = api(firstApp);
      const ids = (s: DesignState) => s.design.elements.map((e) => e.id);

      const undone = (await c.undo(id, 2)).body as DesignState;
      expect(undone.design.revision).toBe(3);
      expect(ids(undone)).toEqual(["links"]);
      expect(undone.history).toMatchObject({ canUndo: true, canRedo: true });

      const undoneAgain = (await c.undo(id, 3)).body as DesignState;
      expect(ids(undoneAgain)).toEqual([]);
      expect(undoneAgain.history).toMatchObject({ canUndo: false, canRedo: true });
      expect((await c.undo(id, 4)).body.code).toBe("NOTHING_TO_UNDO");

      await firstApp.close();
      await first.close();

      // Restart again between undo and redo.
      first = await openTestDb(dir);
      firstApp = buildTestApp(first.db);
      c = api(firstApp);

      const redone = (await c.redo(id, 4)).body as DesignState;
      expect(redone.design.revision).toBe(5);
      expect(ids(redone)).toEqual(["links"]);
      expect(redone.history).toMatchObject({ canUndo: true, canRedo: true });

      // A new edit discards the rest of the redo chain.
      const edited = (await c.edit(id, 5, [service("billing")])).body as DesignState;
      expect(ids(edited)).toEqual(["links", "billing"]);
      expect(edited.history).toMatchObject({ canUndo: true, canRedo: false });
      const noRedo = await c.redo(id, 6);
      expect(noRedo.status).toBe(422);
      expect(noRedo.body.code).toBe("NOTHING_TO_REDO");

      expect(ids((await c.undo(id, 6)).body)).toEqual(["links"]);
      expect(ids((await c.undo(id, 7)).body)).toEqual([]);

      await firstApp.close();
      await first.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 409 when the base has moved", async () => {
    const id = await client.createProject();
    await client.edit(id, 0, [service("links")]);
    await client.edit(id, 1, [service("auth")]);
    const res = await client.undo(id, 1);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "REVISION_CONFLICT", design: { revision: 2 } });
    expect((await client.redo(id, 0)).status).toBe(409);
    expect((await client.design(id)).design.revision).toBe(2);
  });

  it("treats a whole batch as one undo step", async () => {
    const id = await client.createProject();
    await client.edit(id, 0, linkShortenerOps(), "chat");
    const res = await client.undo(id, 1);
    expect(res.status).toBe(200);
    expect(res.body.design).toEqual({
      schemaVersion: 1,
      revision: 2,
      elements: [],
      connections: [],
      annotations: [],
    });
    expect(res.body.findings).toEqual([]);
  });
});

describe("layout", () => {
  it("saves and reloads without changing the semantic revision", async () => {
    const id = await client.createProject();
    await client.edit(id, 0, linkShortenerOps());

    const put = await client.call("PUT", `/projects/${id}/layout`, linkShortenerLayout);
    expect(put.status).toBe(200);
    const moved: LayoutDocument = {
      ...linkShortenerLayout,
      items: { ...linkShortenerLayout.items, links: { x: 999, y: -40 } },
    };
    expect((await client.call("PUT", `/projects/${id}/layout`, moved)).status).toBe(200);

    expect((await client.call("GET", `/projects/${id}/layout`)).body.layout).toEqual(moved);
    const state = await client.design(id);
    expect(state.design.revision).toBe(1);
    expect(state.history).toMatchObject({ canUndo: true, canRedo: false });
    expect((await client.call("GET", `/projects/${id}`)).body.project.revision).toBe(1);
  });

  it("rejects a malformed layout", async () => {
    const id = await client.createProject();
    const res = await client.call("PUT", `/projects/${id}/layout`, {
      schemaVersion: 1,
      items: { links: { x: "left" } },
    });
    expect(res.status).toBe(400);
    expect((await client.call("GET", `/projects/${id}/layout`)).body.layout.items).toEqual({});
  });
});
