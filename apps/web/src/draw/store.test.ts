import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, TEST_PROJECT } from "../test-api.ts";
import { canRedo, canUndo, LAYOUT_SAVE_DELAY_MS, useDraw } from "./store.ts";

const ref = (id: string) => ({ id, version: "0.1.0" });

describe("draw store", () => {
  let api: ReturnType<typeof fakeApi>;

  beforeEach(async () => {
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
    const ok = await useDraw.getState().edit([
      {
        op: "addElement",
        element: { id: "links", name: "Links", template: ref("http-service") },
      },
    ]);
    expect(ok).toBe(true);
    expect(useDraw.getState().loaded?.design.revision).toBe(1);
    expect(useDraw.getState().loaded?.design.elements.map((e) => e.id)).toEqual(["links"]);
  });

  it("shows the first error and changes nothing when the server rejects a batch", async () => {
    const ok = await useDraw.getState().edit([{ op: "removeElement", id: "missing" }]);
    expect(ok).toBe(false);
    expect(useDraw.getState().notice?.tone).toBe("error");
    expect(useDraw.getState().notice?.message).toMatch(/missing/);
    expect(useDraw.getState().loaded?.design.revision).toBe(0);
  });

  it("reloads the design on a revision conflict", async () => {
    api.state.design = { ...api.state.design, revision: 5 };
    const ok = await useDraw.getState().edit([{ op: "removeElement", id: "x" }]);
    expect(ok).toBe(false);
    expect(useDraw.getState().loaded?.design.revision).toBe(5);
    expect(useDraw.getState().notice?.message).toMatch(/changed somewhere else/);
  });

  it("debounces layout saves and never posts an operation for them", async () => {
    vi.useFakeTimers();
    const before = api.state.calls.length;
    useDraw.getState().setLayoutItems({ a: { x: 1, y: 2 } });
    useDraw.getState().setLayoutItems({ a: { x: 10, y: 20 } });
    expect(api.state.layoutPuts).toBe(0);
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DELAY_MS + 10);
    expect(api.state.layoutPuts).toBe(1);
    expect(api.state.layout.items.a).toEqual({ x: 10, y: 20 });
    expect(api.state.calls.slice(before)).toEqual([`PUT /projects/${TEST_PROJECT}/layout`]);
  });

  it("keeps focused-view history independent of semantic edits, cameras and board layout", async () => {
    await useDraw.getState().edit([
      {
        op: "addElement",
        element: { id: "links", name: "Links", template: ref("http-service") },
      },
    ]);
    const initial = {
      name: "Management",
      members: ["container:links"],
      positions: { "container:links": { x: 20, y: 30 } },
    };
    useDraw.getState().setArchitectureView("focus-management", initial, true);
    const revision = useDraw.getState().loaded!.design.revision;
    await useDraw.getState().edit([{ op: "updateElement", id: "links", name: "Renamed links" }]);
    expect(useDraw.getState().loaded!.layout.architecture!["focus-management"]).toEqual(initial);
    const semanticSteps = useDraw.getState().undoSteps;
    useDraw.getState().undoArchitectureLayout();
    expect(useDraw.getState().loaded!.layout.architecture!["focus-management"]).toBeUndefined();
    expect(useDraw.getState().loaded!.design.revision).toBe(revision + 1);
    expect(useDraw.getState().undoSteps).toBe(semanticSteps);
    useDraw.getState().redoArchitectureLayout();
    expect(useDraw.getState().loaded!.layout.architecture!["focus-management"]).toEqual(initial);
    await useDraw.getState().flushLayout();
    expect(api.state.layout.architecture!["focus-management"]).toEqual(initial);
    await useDraw.getState().edit([{ op: "removeElement", id: "links" }]);
    expect(useDraw.getState().loaded!.layout.architecture!["focus-management"]!.positions).toEqual(
      {},
    );
  });

  it("undoes and redoes design edits through the server", async () => {
    const { edit } = useDraw.getState();
    await edit([
      { op: "addElement", element: { id: "links", name: "Links", template: ref("http-service") } },
    ]);
    await edit([{ op: "setNotes", id: "links", notes: "Shorten links." }]);
    expect(useDraw.getState().loaded?.history).toMatchObject({ canUndo: true, canRedo: false });

    await useDraw.getState().undo();
    expect(useDraw.getState().loaded?.design.elements[0]?.notes).toBe("");
    expect(useDraw.getState().loaded?.design.revision).toBe(3);
    await useDraw.getState().undo();
    expect(useDraw.getState().loaded?.design.elements).toEqual([]);
    expect(canUndo(useDraw.getState())).toBe(false);

    await useDraw.getState().redo();
    await useDraw.getState().redo();
    expect(useDraw.getState().loaded?.design.elements[0]?.notes).toBe("Shorten links.");
    expect(canRedo(useDraw.getState())).toBe(false);
  });

  it("interleaves local layout steps with design steps, newest first", async () => {
    vi.useFakeTimers();
    await useDraw.getState().edit([
      {
        op: "addElement",
        element: { id: "links", name: "Links", template: ref("http-service") },
      },
    ]);
    useDraw.getState().setLayoutItems({ links: { x: 0, y: 0 } });
    useDraw.getState().setLayoutItems({ links: { x: 100, y: 50 } }, { undoable: true });

    // The move is newest, so it's undone first, locally, without touching the revision.
    await useDraw.getState().undo();
    expect(useDraw.getState().loaded?.layout.items.links).toEqual({ x: 0, y: 0 });
    expect(useDraw.getState().loaded?.design.revision).toBe(1);

    await useDraw.getState().undo();
    expect(useDraw.getState().loaded?.design.elements).toEqual([]);

    await useDraw.getState().redo();
    expect(useDraw.getState().loaded?.design.elements.map((e) => e.id)).toEqual(["links"]);
    await useDraw.getState().redo();
    expect(useDraw.getState().loaded?.layout.items.links).toEqual({ x: 100, y: 50 });

    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DELAY_MS + 10);
    expect(api.state.layout.items.links).toEqual({ x: 100, y: 50 });
  });

  it("drops the redo chain after a new edit", async () => {
    await useDraw
      .getState()
      .edit([{ op: "addElement", element: { id: "a", name: "A", template: ref("http-service") } }]);
    await useDraw.getState().undo();
    expect(canRedo(useDraw.getState())).toBe(true);
    await useDraw
      .getState()
      .edit([{ op: "addElement", element: { id: "b", name: "B", template: ref("postgres") } }]);
    expect(canRedo(useDraw.getState())).toBe(false);
  });

  it("reloads and tells the user when undo hits a stale revision", async () => {
    await useDraw
      .getState()
      .edit([{ op: "addElement", element: { id: "a", name: "A", template: ref("http-service") } }]);
    api.state.design = { ...api.state.design, revision: 9 };
    await useDraw.getState().undo();
    expect(useDraw.getState().loaded?.design.revision).toBe(9);
    expect(useDraw.getState().notice?.message).toMatch(/changed somewhere else/);
  });

  it("keeps selection and focus requests", () => {
    useDraw.getState().focus({ nodes: ["web"] }, { zoom: true });
    const { selection, focusRequest } = useDraw.getState();
    expect(selection).toEqual({ nodes: ["web"], edges: [] });
    expect(focusRequest).toMatchObject({ nodes: ["web"], edges: [], zoom: true });
  });
});
