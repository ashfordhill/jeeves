import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, serviceOps, TEST_PROJECT } from "../test-api.ts";

type Store = typeof import("./store.ts");
let useProject: Store["useProject"];
let canUndo: Store["canUndo"];
let canRedo: Store["canRedo"];

const loaded = () => {
  const current = useProject.getState().loaded;
  if (!current) throw new Error("No project is open.");
  return current;
};
const design = () => loaded().design;
const addService = (id: string, name = id) =>
  useProject.getState().edit(serviceOps(design(), id, name));

describe("project store", () => {
  let api: ReturnType<typeof fakeApi>;

  beforeEach(async () => {
    // The store keeps accepted revisions per project; each test starts from a fresh module.
    vi.resetModules();
    ({ useProject, canUndo, canRedo } = await import("./store.ts"));
    api = fakeApi();
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    await useProject.getState().open(TEST_PROJECT);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the project and design and puts the project in the URL", () => {
    const { status, loaded } = useProject.getState();
    expect(status).toBe("ready");
    expect(loaded?.project.id).toBe(TEST_PROJECT);
    expect(new URL(window.location.href).searchParams.get("project")).toBe(TEST_PROJECT);
  });

  it("adopts the server's design after an edit", async () => {
    expect(await addService("links", "Links")).toBe(true);
    expect(design().revision).toBe(1);
    expect(design().elements.map((e) => e.id)).toEqual(["links"]);
  });

  it("shows the first error and changes nothing when the server rejects a batch", async () => {
    const ok = await useProject.getState().edit([{ op: "removeElement", id: "missing" }]);
    expect(ok).toBe(false);
    expect(useProject.getState().notice?.tone).toBe("error");
    expect(useProject.getState().notice?.message).toMatch(/missing/);
    expect(design().revision).toBe(0);
  });

  it("reloads the design on a revision conflict", async () => {
    api.state.design = { ...api.state.design, revision: 5 };
    const ok = await useProject.getState().edit([{ op: "removeElement", id: "x" }]);
    expect(ok).toBe(false);
    expect(design().revision).toBe(5);
    expect(useProject.getState().notice?.message).toMatch(/changed somewhere else/);
  });

  it("undoes and redoes design edits through the server", async () => {
    await addService("links", "Links");
    await useProject.getState().edit([{ op: "updateElement", id: "links", name: "Short links" }]);
    expect(useProject.getState().loaded?.history).toMatchObject({ canUndo: true, canRedo: false });

    await useProject.getState().undo();
    expect(design().elements[0]?.name).toBe("Links");
    expect(design().revision).toBe(3);
    await useProject.getState().undo();
    expect(design().elements).toEqual([]);
    expect(canUndo(useProject.getState())).toBe(false);

    await useProject.getState().redo();
    await useProject.getState().redo();
    expect(design().elements[0]?.name).toBe("Short links");
    expect(canRedo(useProject.getState())).toBe(false);
  });

  it("follows a rename that re-keys IDs: the draft moves, and Undo moves it back", async () => {
    const { formDrafts } = await import("./form-drafts.ts");
    const { inspectorSpec } = await import("../studio/inspector-drafts.ts");
    await addService("microservice", "Microservice");
    const spec = inspectorSpec(TEST_PROJECT, { kind: "element", id: "microservice" }, "", design());
    if (!spec) throw new Error("The service has an inspector");
    const entry = formDrafts.open(spec, design());
    // The name commits as the inspector's debounced save does, and re-keys the tile.
    formDrafts.change(entry.key, { "element.name": "Upload API" });
    const flight = formDrafts.flush(entry.key);
    // Typed while the rename is in flight: saved next, under the new ID.
    formDrafts.change(entry.key, { "element.description": "Takes uploads." });
    void formDrafts.flush(entry.key);
    await flight;
    expect(design().elements).toMatchObject([
      { id: "upload-api", name: "Upload API", description: "Takes uploads." },
    ]);
    expect(design().revision).toBe(3);
    expect(entry.key).toContain("element:upload-api");
    expect(entry.paths.size).toBe(0);
    expect(entry.problem).toBeUndefined();
    expect(formDrafts.forProject(TEST_PROJECT).filter((item) => item === entry)).toHaveLength(1);
    // The description's own save re-keyed nothing.
    expect(loaded().renamed).toBeUndefined();
    await useProject.getState().undo();
    await useProject.getState().undo();
    expect(design().elements.map((item) => item.id)).toEqual(["microservice"]);
    expect(loaded().renamed).toEqual([{ from: "upload-api", to: "microservice" }]);
    expect(entry.key).toContain("element:microservice");
    // The inspector, rendering the restored ID, finds the same draft and reads the old name.
    const back = inspectorSpec(TEST_PROJECT, { kind: "element", id: "microservice" }, "", design());
    if (!back) throw new Error("The service has an inspector");
    expect(formDrafts.open(back, design())).toBe(entry);
    expect(entry.values["element.name"]).toBe("Microservice");
  });

  it("holds a name whose re-keyed ID is taken as a field error, and saves once it is free", async () => {
    const { formDrafts } = await import("./form-drafts.ts");
    const { inspectorSpec } = await import("../studio/inspector-drafts.ts");
    await addService("upload", "Upload");
    await addService("microservice", "Microservice");
    const spec = inspectorSpec(TEST_PROJECT, { kind: "element", id: "microservice" }, "", design());
    if (!spec) throw new Error("The service has an inspector");
    const entry = formDrafts.open(spec, design());
    // Typing "Upload API" passes "Upload", which another tile's ID already is.
    formDrafts.change(entry.key, { "element.name": "Upload" });
    expect(entry.errors["element.name"]).toBe(
      "Upload would take the ID upload, which Upload already uses. Choose another name.",
    );
    await formDrafts.flush(entry.key);
    expect(design().revision).toBe(2);
    expect(entry.problem).toBeUndefined();
    formDrafts.change(entry.key, { "element.name": "Upload API" });
    expect(entry.errors).toEqual({});
    await formDrafts.flush(entry.key);
    expect(design().elements.map((item) => item.id)).toEqual(["upload", "upload-api"]);
  });

  it("drops the redo chain after a new edit", async () => {
    await addService("a");
    await useProject.getState().undo();
    expect(canRedo(useProject.getState())).toBe(true);
    await addService("b");
    expect(canRedo(useProject.getState())).toBe(false);
  });

  it("reloads and tells the user when undo hits a stale revision", async () => {
    await addService("a");
    api.state.design = { ...api.state.design, revision: 9 };
    await useProject.getState().undo();
    expect(design().revision).toBe(9);
    expect(useProject.getState().notice?.message).toMatch(/changed somewhere else/);
  });
});
