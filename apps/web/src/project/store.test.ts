import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, serviceOps, TEST_PROJECT } from "../test-api.ts";

type Store = typeof import("./store.ts");
let useDraw: Store["useDraw"];
let canUndo: Store["canUndo"];
let canRedo: Store["canRedo"];
let LAYOUT_SAVE_DELAY_MS: number;

const loaded = () => {
  const current = useDraw.getState().loaded;
  if (!current) throw new Error("No project is open.");
  return current;
};
const design = () => loaded().design;
const addService = (id: string, name = id) =>
  useDraw.getState().edit(serviceOps(design(), id, name));

describe("project store", () => {
  let api: ReturnType<typeof fakeApi>;

  beforeEach(async () => {
    // The store keeps accepted revisions per project; each test starts from a fresh module.
    vi.resetModules();
    ({ useDraw, canUndo, canRedo, LAYOUT_SAVE_DELAY_MS } = await import("./store.ts"));
    api = fakeApi();
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    await useDraw.getState().open(TEST_PROJECT);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads the project, design and layout and puts the project in the URL", () => {
    const { status, loaded } = useDraw.getState();
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
    const ok = await useDraw.getState().edit([{ op: "removeElement", id: "missing" }]);
    expect(ok).toBe(false);
    expect(useDraw.getState().notice?.tone).toBe("error");
    expect(useDraw.getState().notice?.message).toMatch(/missing/);
    expect(design().revision).toBe(0);
  });

  it("reloads the design on a revision conflict", async () => {
    api.state.design = { ...api.state.design, revision: 5 };
    const ok = await useDraw.getState().edit([{ op: "removeElement", id: "x" }]);
    expect(ok).toBe(false);
    expect(design().revision).toBe(5);
    expect(useDraw.getState().notice?.message).toMatch(/changed somewhere else/);
  });

  it("debounces non-undoable view saves and never posts an operation for them", async () => {
    vi.useFakeTimers();
    const before = api.state.calls.length;
    await useDraw
      .getState()
      .setArchitectureView("studio:containers", { viewport: { x: 1, y: 2, zoom: 1 } });
    await useDraw
      .getState()
      .setArchitectureView("studio:containers", { viewport: { x: 10, y: 20, zoom: 1 } });
    expect(api.state.layoutPuts).toBe(0);
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DELAY_MS + 10);
    expect(api.state.layoutPuts).toBe(1);
    expect(api.state.layout.architecture?.["studio:containers"]?.viewport).toEqual({
      x: 10,
      y: 20,
      zoom: 1,
    });
    expect(api.state.calls.slice(before)).toEqual([`PUT /projects/${TEST_PROJECT}/layout`]);
  });

  it("keeps row-order history in the same stack as design edits and prunes dead rows", async () => {
    await addService("links", "Links");
    const order = { order: ["studio:element:links"] };
    expect(await useDraw.getState().setArchitectureView("studio:containers", order, true)).toBe(
      true,
    );
    expect(design().revision).toBe(1);
    await useDraw.getState().undo();
    expect(loaded().layout.architecture?.["studio:containers"]).toBeUndefined();
    expect(design().revision).toBe(1);
    await useDraw.getState().redo();
    expect(loaded().layout.architecture?.["studio:containers"]).toEqual(order);
    await useDraw.getState().edit([{ op: "removeElement", id: "links" }]);
    expect(loaded().layout.architecture?.["studio:containers"]?.order).toEqual([]);
  });

  it("undoes and redoes design edits through the server", async () => {
    await addService("links", "Links");
    await useDraw.getState().edit([{ op: "updateElement", id: "links", name: "Short links" }]);
    expect(useDraw.getState().loaded?.history).toMatchObject({ canUndo: true, canRedo: false });

    await useDraw.getState().undo();
    expect(design().elements[0]?.name).toBe("Links");
    expect(design().revision).toBe(3);
    await useDraw.getState().undo();
    expect(design().elements).toEqual([]);
    expect(canUndo(useDraw.getState())).toBe(false);

    await useDraw.getState().redo();
    await useDraw.getState().redo();
    expect(design().elements[0]?.name).toBe("Short links");
    expect(canRedo(useDraw.getState())).toBe(false);
  });

  it("drops the redo chain after a new edit", async () => {
    await addService("a");
    await useDraw.getState().undo();
    expect(canRedo(useDraw.getState())).toBe(true);
    await addService("b");
    expect(canRedo(useDraw.getState())).toBe(false);
  });

  it("reloads and tells the user when undo hits a stale revision", async () => {
    await addService("a");
    api.state.design = { ...api.state.design, revision: 9 };
    await useDraw.getState().undo();
    expect(design().revision).toBe(9);
    expect(useDraw.getState().notice?.message).toMatch(/changed somewhere else/);
  });
});
