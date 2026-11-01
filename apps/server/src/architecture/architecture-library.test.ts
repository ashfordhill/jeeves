import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeProvider } from "@jeeves/providers";
import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  designSchema,
  extractArchitectureTemplate,
  previewArchitecturePattern,
  previewArchitectureTemplate,
} from "@jeeves/spec";
import { afterAll, describe, expect, it } from "vitest";
import { Workspace } from "../chat/tools.ts";
import { Settings } from "../settings.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";
import { ArchitectureLibrary } from "./library.ts";

const directories: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-p55-"));
  directories.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
});
const registry = builtinRegistry();
function source() {
  const base = designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      { id: "api", name: "API", template: null, planned: "application-api" },
      { id: "worker", name: "Worker", template: null, planned: "background-worker" },
      { id: "store", name: "Store", template: null, planned: "relational-store" },
    ],
  });
  const preview = previewArchitecturePattern(
    base,
    {
      pattern: "asynchronous-work-delivery",
      version: "1.0.0",
      variant: "transactional-outbox",
      instanceId: "source",
      baseRevision: 0,
      config: { name: "Delivery" },
      roles: {
        api: { mode: "reuse", id: "api" },
        worker: { mode: "reuse", id: "worker" },
        store: { mode: "reuse", id: "store" },
      },
    },
    registry,
  );
  expect(preview.errors).toEqual([]);
  const result = applyOperations(base, preview.ops, registry, { baseRevision: 0 });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
function publish(library: ArchitectureLibrary) {
  const design = source();
  const extracted = extractArchitectureTemplate(
    design,
    { elements: design.elements.map((e) => e.id) },
    {
      id: "durable-delivery",
      version: "1.0.0",
      name: "Durable delivery",
      purpose: "Atomic domain and event intent",
    },
    registry,
  );
  const draft = library.create(extracted.fragment, extracted.metadata);
  return library.change(draft.id, draft.version, draft.draftRevision, "publish")!;
}

describe("server-owned local architecture catalog", () => {
  it("retains immutable published versions after restart, supports new drafts, retires without losing source and rejects stale draft updates", () => {
    const home = directory();
    const library = new ArchitectureLibrary(home);
    const entry = publish(library);
    expect(statSync(library.path).mode & 0o777).toBe(0o600);
    expect(new ArchitectureLibrary(home).get(entry.id, entry.version)).toEqual(entry);
    expect(() =>
      library.change(entry.id, entry.version, entry.draftRevision, "edit", entry.metadata),
    ).toThrow(/immutable/);
    const next = library.clone(entry.id, entry.version, "2.0.0");
    expect(library.list()).toHaveLength(1);
    expect(library.list("", true)).toHaveLength(2);
    const metadata = {
      ...next.metadata,
      name: "Revised delivery",
      invariants: [...next.metadata.invariants, "Retain failed work until explicitly reconciled."],
    };
    const edited = library.change(next.id, next.version, next.draftRevision, "edit", metadata)!;
    expect(() => library.change(next.id, next.version, next.draftRevision, "publish")).toThrow(
      /changed/,
    );
    const published = library.change(edited.id, edited.version, edited.draftRevision, "publish")!;
    expect(published.contentHash).not.toBe(entry.contentHash);
    expect(library.get(entry.id, entry.version).fragment).toEqual(entry.fragment);
    const retired = library.change(entry.id, entry.version, entry.draftRevision, "retire")!;
    expect(retired.contentHash).toBe(entry.contentHash);
    expect(library.list()).toEqual([published]);
    expect(new ArchitectureLibrary(home).get(retired.id, retired.version).state).toBe("retired");
    const disposable = library.clone(entry.id, entry.version, "3.0.0");
    library.change(disposable.id, disposable.version, disposable.draftRevision, "delete");
    expect(() => library.get(disposable.id, disposable.version)).toThrow(/not found/);
    expect(readFileSync(library.path, "utf8")).not.toContain("outputDir");
  });
  it("mouse preview and scripted tool insertion produce the same exact version and semantic results", () => {
    const library = new ArchitectureLibrary(directory());
    const entry = publish(library);
    const design = designSchema.parse({ schemaVersion: 2, revision: 0 });
    const req = {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "inserted",
      baseRevision: 0,
      name: "Independent instance",
    };
    const mouse = previewArchitectureTemplate(design, entry, req, registry);
    expect(mouse.errors).toEqual([]);
    const workspace = new Workspace(registry, design, design, "Target", library);
    const run = (name: string, args: object) =>
      JSON.parse(workspace.run(name, JSON.stringify(args)));
    expect(run("listArchitectureLibrary", { query: "Durable" }).entries[0].availability).toBe(
      "architecture only",
    );
    expect(
      run("describeArchitectureLibrary", { id: entry.id, version: entry.version }).entry
        .contentHash,
    ).toBe(entry.contentHash);
    expect(run("previewArchitectureLibrary", req).ops).toEqual(
      JSON.parse(JSON.stringify(mouse.ops)),
    );
    expect(run("applyArchitectureLibrary", req).ok).toBe(true);
    const applied = applyOperations(design, mouse.ops, registry, { baseRevision: 0 });
    expect(applied.ok && workspace.working).toEqual(applied.ok && applied.design);
    expect(workspace.patternRevisionBound).toBe(true);
    expect(entry.fragment.architecture.components).not.toEqual(
      workspace.working.architecture!.components,
    );
  });
  it("API saves selections with revision guards and scripted chat commits an insertion in one undoable edit across restarts", async () => {
    const testDb = await openTestDb();
    const home = directory();
    const library = new ArchitectureLibrary(home);
    const entry = publish(library);
    const insertion = {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "chat-copy",
      baseRevision: 0,
      name: "Chat delivery",
    };
    const provider = createFakeProvider([
      {
        toolCalls: [
          { name: "listArchitectureLibrary", arguments: {} },
          {
            name: "describeArchitectureLibrary",
            arguments: { id: entry.id, version: entry.version },
          },
          { name: "applyArchitectureLibrary", arguments: insertion },
        ],
      },
      { text: "Inserted the exact published architecture version." },
    ]);
    let app = buildTestApp(testDb.db, {
      settings: new Settings(home, {}),
      models: () => ({ provider, model: "scripted" }),
    });
    const call = (method: "GET" | "POST", url: string, payload?: object) =>
      app.inject({ method, url, ...(payload ? { payload } : {}) });
    try {
      const project = (await call("POST", "/projects", { name: "P55 scripted library" })).json()
        .project;
      const res = await call("POST", `/projects/${project.id}/chat`, {
        message: "Insert my saved delivery pattern",
        fileIds: [],
        selection: [],
      });
      expect(res.statusCode).toBe(200);
      let state = (await call("GET", `/projects/${project.id}/design`)).json();
      expect(state.design.revision).toBe(1);
      expect(state.design.architecture.patternInstances[0].libraryContentHash).toBe(
        entry.contentHash,
      );
      const before = structuredClone(state.design);
      const preview = await call("POST", `/projects/${project.id}/architecture-library/preview`, {
        ...insertion,
        baseRevision: 0,
        instanceId: "stale",
      });
      expect(preview.json().ok).toBe(false);
      expect(preview.json().ops).toEqual([]);
      const staleExtraction = await call("POST", "/architecture-library", {
        id: "stale-export",
        version: "1.0.0",
        name: "Stale",
        purpose: "Cannot copy a stale revision",
        projectId: project.id,
        baseRevision: 0,
        selection: { elements: [before.elements[0].id] },
      });
      expect(staleExtraction.statusCode).toBe(409);
      expect(
        (await call("POST", `/projects/${project.id}/undo`, { baseRevision: 1 })).statusCode,
      ).toBe(200);
      state = (await call("GET", `/projects/${project.id}/design`)).json();
      expect(state.design.elements).toEqual([]);
      expect(
        (await call("POST", `/projects/${project.id}/redo`, { baseRevision: 2 })).statusCode,
      ).toBe(200);
      await app.close();
      app = buildTestApp(testDb.db, { settings: new Settings(home, {}) });
      expect((await call("GET", "/architecture-library")).json().entries[0].contentHash).toBe(
        entry.contentHash,
      );
      const restored: DesignDocument = (await call("GET", `/projects/${project.id}/design`)).json()
        .design;
      expect(restored.architecture!.patternInstances).toEqual(before.architecture.patternInstances);
    } finally {
      await app.close();
      await testDb.close();
    }
  });
});
