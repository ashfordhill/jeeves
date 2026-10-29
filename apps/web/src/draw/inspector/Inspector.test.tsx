import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, TEST_PROJECT } from "../../test-api.ts";
import { useDraw } from "../store.ts";
import { Rail } from "./Rail.tsx";

const ref = (id: string) => ({ id, version: "0.1.0" });

describe("inspector rail", () => {
  let api: ReturnType<typeof fakeApi>;

  beforeEach(async () => {
    localStorage.clear();
    api = fakeApi();
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    await useDraw.getState().open(TEST_PROJECT);
    await useDraw
      .getState()
      .edit([{ op: "addElement", element: { id: "web", name: "Web", template: ref("web-app") } }]);
    useDraw.getState().setRailTab("inspector");
    render(
      <MantineProvider>
        <Rail />
      </MantineProvider>,
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a design summary when nothing is selected", () => {
    expect(screen.getByText("Select an item on the board to edit it here.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Findings/ }).textContent).toContain("1");
  });

  it("edits config and notes, one operation per committed field", async () => {
    useDraw.getState().focus({ nodes: ["web"] });
    const title = await screen.findByRole("textbox", { name: /Title/ });
    expect(screen.getByText("Required")).toBeTruthy();

    fireEvent.change(title, { target: { value: "Link shortener" } });
    fireEvent.blur(title);
    await waitFor(() =>
      expect(useDraw.getState().loaded?.design.elements[0]?.config).toEqual({
        title: "Link shortener",
      }),
    );
    expect(useDraw.getState().loaded?.findings).toEqual([]);
    await waitFor(() => expect(screen.queryByText("Required")).toBeNull());

    const notes = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.change(notes, { target: { value: "Shows the links." } });
    fireEvent.blur(notes);
    await waitFor(() =>
      expect(useDraw.getState().loaded?.design.elements[0]?.notes).toBe("Shows the links."),
    );
    expect(api.state.done).toHaveLength(3);
  });

  it("refuses an out-of-range value at the field without posting it", async () => {
    useDraw.getState().focus({ nodes: ["web"] });
    const port = await screen.findByRole("textbox", { name: "Port" });
    const before = api.state.calls.length;
    fireEvent.change(port, { target: { value: "70000" } });
    fireEvent.blur(port);
    expect(await screen.findByText(/65535/)).toBeTruthy();
    expect(api.state.calls.slice(before)).toEqual([]);
  });

  it("selects an element from the findings list", async () => {
    fireEvent.click(screen.getByRole("tab", { name: /Findings/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Web.*needs a value for "title"/ }));
    expect(useDraw.getState().selection).toEqual({ nodes: ["web"], edges: [] });
    expect(useDraw.getState().focusRequest).toMatchObject({ nodes: ["web"], zoom: true });
    expect(await screen.findByRole("textbox", { name: "Name" })).toBeTruthy();
  });
});
