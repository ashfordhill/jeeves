import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, TEST_PROJECT } from "../test-api.ts";
import { LAYOUT_SAVE_DELAY_MS, useDraw } from "./store.ts";

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

  it("loads the project, design, layout, and templates and puts the project in the URL", () => {
    const { status, loaded } = useDraw.getState();
    expect(status).toBe("ready");
    expect(loaded?.project.id).toBe(TEST_PROJECT);
    expect(loaded?.templates.get("http-service@0.1.0")?.displayName).toBe("HTTP service");
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
});
