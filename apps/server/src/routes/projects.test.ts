import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type DesignDocument,
  designSchema,
  type LayoutDocument,
  layoutSchema,
  type OperationInput,
  upgradeDesign,
} from "@jeeves/spec";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import { designRevisions, projects } from "../db/schema.ts";
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
  it("creates an independent editable starter with C4 context and refuses unknown versions atomically", async () => {
    const original = await client.createProject("Keep the original");
    const before = (await client.call("GET", "/projects")).body.projects.length;
    const catalog = (await client.call("GET", "/starters")).body.starters;
    expect(catalog[0]).toMatchObject({
      id: "resource-workspace",
      version: "0.1.0",
      maturity: "experimental",
    });
    expect(
      (
        await client.call("POST", "/projects/from-starter", {
          name: "Unknown",
          starter: { id: "resource-workspace", version: "9.0.0" },
        })
      ).status,
    ).toBe(422);
    expect((await client.call("GET", "/projects")).body.projects).toHaveLength(before);
    const created = await client.call("POST", "/projects/from-starter", {
      name: "Fieldwork starter",
      starter: { id: "resource-workspace", version: "0.1.0" },
      config: { preset: "paper", pageSize: 25, tagline: "Our private records" },
    });
    expect(created.status).toBe(201);
    const id = created.body.project.id,
      state = await client.design(id);
    expect(state.findings).toEqual([]);
    expect(state.design.recipe).toBeUndefined();
    expect(state.design.startedFrom?.manifestSha256).toBe(catalog[0].manifestSha256);
    expect(state.design.architecture?.nodes[0]?.name).toBe("Workspace member");
    const web = state.design.elements.find((element) => element.id === "inventory-web")!;
    expect(web.config).toMatchObject({ title: "Fieldwork starter", hostPort: expect.any(Number) });
    expect(
      web.attachments.find((attachment) => attachment.id === "inventory-workspace")!.config,
    ).toMatchObject({ preset: "paper", pageSize: 25 });
    const service = state.design.elements[0]!,
      attachment = service.attachments[0]!;
    const config = structuredClone(attachment.config);
    (config.model as { resources: { fields: { name: string }[] }[] }).resources[0]!
      .fields[0]!.name = "displayName";
    const edit = await client.edit(id, 0, [{ op: "updateAttachment", id: attachment.id, config }]);
    expect(edit.status).toBe(200);
    expect(edit.body.design.startedFrom).toEqual(state.design.startedFrom);
    expect((await client.design(original)).design.elements).toEqual([]);
  });

  it("reads architecture without mutation and keeps added project work visible beside a recipe", async () => {
    const created = await client.call("POST", "/projects/from-recipe", {
      name: "Architecture proof",
      recipe: { id: "qr-studio", version: "0.1.0" },
    });
    const id = created.body.project.id;
    const before = await client.design(id);
    const architecture = await client.call("GET", `/projects/${id}/architecture`);
    expect(architecture.status).toBe(200);
    expect(architecture.body.views.provision.id).toBe("qr-studio");
    expect(architecture.body.views.context.nodes).toHaveLength(4);
    expect(await client.design(id)).toEqual(before);
    const intent = structuredClone(before.design.architecture!);
    intent.system.description = "Explicit architecture responsibility";
    await client.edit(id, 0, [
      { op: "setArchitecture", architecture: intent },
      { op: "setNotes", id: "qrwty-web", notes: "Add project-specific inventory integration." },
    ]);
    const changed = (await client.call("GET", `/projects/${id}/architecture`)).body;
    expect(changed.revision).toBe(1);
    expect(changed.views.context.description).toBe(intent.system.description);
    expect(
      changed.views.components.find((view: { container: string }) => view.container === "qrwty-web")
        .nodes,
    ).toContainEqual(
      expect.objectContaining({ name: "Additional product work", support: "extension" }),
    );
    await client.undo(id, 1);
    expect((await client.design(id)).design.architecture).toEqual(before.design.architecture);
    expect(
      (await client.call("GET", "/projects/00000000-0000-4000-8000-000000000000/architecture"))
        .status,
    ).toBe(404);
  });
  it("creates a separate recipe project, rejects invalid configuration, and restores recipe edits with undo", async () => {
    const old = await client.createProject("Keep this project");
    const catalog = await client.call("GET", "/recipes");
    expect(catalog.body.recipes[0]).toMatchObject({ id: "qr-studio", maturity: "experimental" });
    const input = {
      name: "Recipe proof",
      recipe: { id: "qr-studio", version: "0.1.0" },
      config: { tagline: "Made without a model", analyticsDays: 7 },
    };
    expect(
      (
        await client.call("POST", "/projects/from-recipe", {
          ...input,
          config: { analyticsDays: 365 },
        })
      ).status,
    ).toBe(422);
    const created = await client.call("POST", "/projects/from-recipe", input);
    expect(created.status).toBe(201);
    const id = created.body.project.id;
    const state = await client.design(id);
    expect(state.design.elements).toHaveLength(3);
    expect(state.design.recipe?.config).toEqual(input.config);
    expect(state.findings).toEqual([]);
    expect((await client.design(old)).design.elements).toHaveLength(0);
    expect(
      Object.keys((await client.call("GET", `/projects/${id}/layout`)).body.layout.items),
    ).toHaveLength(3);
    await client.edit(id, 0, [
      {
        op: "setRecipe",
        recipe: { ...input.recipe, config: { ...input.config, tagline: "Changed" } },
      },
    ]);
    expect((await client.undo(id, 1)).body.design.recipe.config.tagline).toBe(input.config.tagline);
  });
  it("converts legacy endpoints on read but records v2 only on a semantic save", async () => {
    const id = await client.createProject("Legacy conversion");
    const legacy = { ...linkShortener, revision: 1 };
    await db
      .insert(designRevisions)
      .values({ projectId: id, revision: 1, document: legacy, findings: [] });
    await db.update(projects).set({ revision: 1 }).where(eq(projects.id, id));
    const state = await client.design(id);
    expect(state.design).toEqual(upgradeDesign(legacy));
    expect(
      (
        await client.call("PUT", "/projects/" + id + "/layout", {
          schemaVersion: 1,
          items: { links: { x: 10, y: 20 } },
        })
      ).status,
    ).toBe(200);
    const original = await db
      .select()
      .from(designRevisions)
      .where(and(eq(designRevisions.projectId, id), eq(designRevisions.revision, 1)));
    expect(original[0]?.document).toEqual(legacy);
    const saved = await client.edit(id, 1, [
      { op: "setNotes", id: "links", notes: "Semantic save after conversion" },
    ]);
    expect(saved.status).toBe(200);
    expect(saved.body.design.schemaVersion).toBe(2);
    expect(saved.body.design.connections).toEqual(upgradeDesign(legacy).connections);
    expect((await client.undo(id, 2)).body.design).toEqual({
      ...upgradeDesign(legacy),
      revision: 3,
    });
  });
  it("creates, lists, renames, and deletes a project", async () => {
    const id = await client.createProject("Draft");
    expect((await client.call("GET", "/projects")).body.projects).toContainEqual(
      expect.objectContaining({ id, name: "Draft", revision: 0 }),
    );

    const renamed = await client.call("PATCH", `/projects/${id}`, { name: "Shorty" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.project).toMatchObject({ id, name: "Shorty" });
    expect((await client.call("GET", `/projects/${id}`)).body.project.name).toBe("Shorty");

    const located = await client.call("PATCH", `/projects/${id}`, {
      outputDir: "/tmp/shorty",
    });
    expect(located.body.project).toMatchObject({ name: "Shorty", outputDir: "/tmp/shorty" });
    expect((await client.call("PATCH", `/projects/${id}`, {})).body.project).toMatchObject({
      name: "Shorty",
      outputDir: "/tmp/shorty",
    });

    expect((await client.call("DELETE", `/projects/${id}`)).status).toBe(204);
    expect((await client.call("GET", `/projects/${id}`)).status).toBe(404);
    expect((await client.call("GET", `/projects/${id}/design`)).status).toBe(404);
    expect((await client.call("DELETE", `/projects/${id}`)).status).toBe(404);
  });

  it("starts with an empty design and layout", async () => {
    const id = await client.createProject();
    expect(await client.design(id)).toEqual({
      projectId: id,
      design: { schemaVersion: 2, revision: 0, elements: [], connections: [], annotations: [] },
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
    expect(reloaded.design).toEqual({ ...upgradeDesign(linkShortener), revision: 1 });
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
      schemaVersion: 2,
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
