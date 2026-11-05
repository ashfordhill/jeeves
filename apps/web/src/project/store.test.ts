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
