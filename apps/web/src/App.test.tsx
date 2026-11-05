import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { fakeApi } from "./test-api.ts";

describe("App shell", () => {
  beforeEach(() => {
    window.location.hash = "";
    vi.stubGlobal("fetch", vi.fn(fakeApi().fetch));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens the project on Design and switches to Settings by click", async () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "Design" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByRole("button", { name: "Project: Test design" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    // Switching views flushes pending edits first.
    await waitFor(() => expect(window.location.hash).toBe("#/settings"));
    expect(screen.getByRole("tab", { name: "Settings" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(await screen.findByText("Server healthy")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Design" }));
    await waitFor(() => expect(window.location.hash).toBe("#/draw"));
  });
});
