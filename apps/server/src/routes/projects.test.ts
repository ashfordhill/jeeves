import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildStudioCommand,
  createStudioSettings,
  type DesignDocument,
  emptyDesign,
  type OperationInput,
  studioArchitectureExample,
} from "@jeeves/spec";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import { designRevisions, projects } from "../db/schema.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

const tinyurl = studioArchitectureExample("studio-tinyurl");

/** Builds the TinyURL study from an empty design, as the web does. */
function tinyurlOps(): OperationInput[] {
  return [
    ...tinyurl.design.elements.map((element) => ({ op: "addElement" as const, element })),
    ...tinyurl.design.connections.map((connection) => ({ op: "connect" as const, connection })),
    { op: "setArchitecture", architecture: tinyurl.design.architecture ?? null },
  ];
}

/** The ops that add one service to `design`, through the studio command builder. */
function service(design: DesignDocument, id: string): OperationInput[] {
  return buildStudioCommand(design, {
    type: "create",
    system: { name: "System" },
    elements: [{ id, name: id, settings: createStudioSettings("service") }],
  }).ops;
}

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
  const design = async (id: string) =>
    (await call("GET", `/projects/${id}/design`)).body as DesignState;
  const edit = (id: string, baseRevision: number, ops: unknown[], source?: string) =>
    call("POST", `/projects/${id}/operations`, { baseRevision, ops, ...(source && { source }) });
  return {
    call,
    createProject: async (name = "TinyURL") => {
      const res = await call("POST", "/projects", { name });
      expect(res.status).toBe(201);
      return res.body.project.id as string;
    },
    design,
    edit,
    /** Adds a service against the current design. */
    addService: async (id: string, element: string, source?: string) => {
      const current = (await design(id)).design;
      return edit(id, current.revision, service(current, element), source);
    },
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

const ids = (s: DesignState) => s.design.elements.map((e) => e.id);

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
      design: emptyDesign(),
      findings: [],
      history: { canUndo: false, canRedo: false, latestEdit: null },
    });
    expect((await client.call("GET", `/projects/${id}/layout`)).body).toEqual({
      layout: { schemaVersion: 1 },
    });
  });

  it("rejects bad input with 400 and unknown projects with 404", async () => {
    expect((await client.call("POST", "/projects", { name: "  " })).status).toBe(400);
    const bad = await client.call("GET", "/projects/not-a-uuid/design");
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("BAD_REQUEST");
    const missing = "00000000-0000-4000-8000-000000000000";
    expect((await client.edit(missing, 0, service(emptyDesign(), "a"))).status).toBe(404);
    expect((await client.undo(missing, 0)).status).toBe(404);
    expect(
      (await client.call("PUT", `/projects/${missing}/layout`, { schemaVersion: 1 })).status,
    ).toBe(404);
  });

  it("refuses to load a stored document that is not a studio design", async () => {
    const id = await client.createProject("Old format");
    await db.insert(designRevisions).values({
      projectId: id,
      revision: 1,
      document: { ...emptyDesign(), revision: 1, annotations: [] } as DesignDocument,
      findings: [],
    });
    await db.update(projects).set({ revision: 1 }).where(eq(projects.id, id));
    const res = await client.call("GET", `/projects/${id}/design`);
    expect(res.status).toBe(500);
  });
});

describe("operations", () => {
  it("saves the TinyURL study as one revision and reloads it", async () => {
    const id = await client.createProject();
    const res = await client.edit(id, 0, tinyurlOps(), "canvas");
    expect(res.status).toBe(200);
    expect(res.body.design.revision).toBe(1);
    expect(res.body.history).toMatchObject({ canUndo: true, canRedo: false });
    expect(res.body.operationId).toEqual(expect.any(Number));

    const reloaded = await client.design(id);
    expect(reloaded.design).toEqual({ ...tinyurl.design, revision: 1 });
    expect((await client.call("GET", `/projects/${id}`)).body.project.revision).toBe(1);

    const blueprint = await client.call("GET", `/projects/${id}/blueprint`);
    expect(blueprint.status).toBe(200);
    expect(blueprint.body.blueprint).toBe(1);
  });

  it("returns 409 with the current design for a stale baseRevision", async () => {
    const id = await client.createProject();
    await client.addService(id, "links");
    await client.addService(id, "auth");

    const stale = await client.edit(id, 1, service(emptyDesign(), "billing"));
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("REVISION_CONFLICT");
    expect(stale.body.design.revision).toBe(2);
    expect(stale.body.design.elements.map((e: { id: string }) => e.id)).toEqual(["links", "auth"]);
    expect((await client.design(id)).design.revision).toBe(2);
  });

  it("changes nothing when any op in a batch is invalid", async () => {
    const id = await client.createProject();
    await client.addService(id, "links");
    const before = await client.design(id);

    // The last op refers to an element that doesn't exist.
    const missing = await client.edit(id, 1, [
      ...service(before.design, "auth"),
      { op: "removeElement", id: "nope" },
    ]);
    expect(missing.status).toBe(422);
    expect(missing.body.code).toBe("INVALID_OPERATION");
    expect(missing.body.errors).toEqual([expect.objectContaining({ code: "UNKNOWN_REFERENCE" })]);

    // A pre-studio op is malformed and reported with its index.
    const legacy = await client.edit(id, 1, [{ op: "addAnnotation", annotation: {} }]);
    expect(legacy.status).toBe(422);
    expect(legacy.body.errors[0]).toMatchObject({ code: "INVALID_OPERATION", target: { op: 0 } });

    // An element without studio settings is structurally invalid.
    const unbound = await client.edit(id, 1, [
      { op: "addElement", element: { id: "loose", name: "Loose" } },
    ]);
    expect(unbound.status).toBe(422);
    expect(unbound.body.errors[0].code).toBe("CONFIG_INVALID");

    expect(await client.design(id)).toEqual(before);
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
      await c.addService(id, "links");
      await c.addService(id, "auth", "chat");
      await firstApp.close();
      await first.close();

      // Restart: a new process would open the same database and build a fresh app.
      first = await openTestDb(dir);
      firstApp = buildTestApp(first.db);
      c = api(firstApp);

      const undone = (await c.undo(id, 2)).body as DesignState;
      expect(undone.design.revision).toBe(3);
      expect(ids(undone)).toEqual(["links"]);
      expect(undone.history).toMatchObject({ canUndo: true, canRedo: true });

      const undoneAgain = (await c.undo(id, 3)).body as DesignState;
      expect(ids(undoneAgain)).toEqual([]);
      expect((await c.undo(id, 4)).body.code).toBe("NOTHING_TO_UNDO");

      const redone = (await c.redo(id, 4)).body as DesignState;
      expect(redone.design.revision).toBe(5);
      expect(ids(redone)).toEqual(["links"]);

      // A new edit discards the rest of the redo chain.
      const edited = (await c.addService(id, "billing")).body as DesignState;
      expect(ids(edited)).toEqual(["links", "billing"]);
      expect(edited.history).toMatchObject({ canUndo: true, canRedo: false });
      const noRedo = await c.redo(id, 6);
      expect(noRedo.status).toBe(422);
      expect(noRedo.body.code).toBe("NOTHING_TO_REDO");

      await firstApp.close();
      await first.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 409 when the base has moved", async () => {
    const id = await client.createProject();
    await client.addService(id, "links");
    await client.addService(id, "auth");
    const res = await client.undo(id, 1);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "REVISION_CONFLICT", design: { revision: 2 } });
    expect((await client.design(id)).design.revision).toBe(2);
  });

  it("treats a whole batch as one undo step", async () => {
    const id = await client.createProject();
    await client.edit(id, 0, tinyurlOps(), "chat");
    const res = await client.undo(id, 1);
    expect(res.status).toBe(200);
    expect(res.body.design).toEqual({ ...emptyDesign(), revision: 2 });
    expect(res.body.findings).toEqual([]);
  });
});

describe("layout", () => {
  it("saves row order without changing the semantic revision", async () => {
    const id = await client.createProject();
    await client.edit(id, 0, tinyurlOps());
    const layout = {
      schemaVersion: 1,
      architecture: { "studio:containers": { order: ["studio:element:web"] } },
    };
    expect((await client.call("PUT", `/projects/${id}/layout`, layout)).status).toBe(200);
    expect((await client.call("GET", `/projects/${id}/layout`)).body.layout).toEqual(layout);
    const state = await client.design(id);
    expect(state.design.revision).toBe(1);
    expect((await client.call("GET", `/projects/${id}`)).body.project.revision).toBe(1);
  });

  it("rejects a malformed or board-era layout", async () => {
    const id = await client.createProject();
    for (const body of [
      { schemaVersion: 1, architecture: { "studio:containers": { order: "web" } } },
      { schemaVersion: 1, items: { links: { x: 1, y: 2 } } },
    ]) {
      const res = await client.call("PUT", `/projects/${id}/layout`, body);
      expect(res.status).toBe(400);
    }
    expect((await client.call("GET", `/projects/${id}/layout`)).body.layout).toEqual({
      schemaVersion: 1,
    });
  });
});
