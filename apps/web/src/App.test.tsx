import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("starts on Draw with the board toolbar and switches views by click", async () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "Draw" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByRole("toolbar", { name: "Drawing tools" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Project: Test design" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByRole("tab", { name: "Settings" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(window.location.hash).toBe("#/settings");
    expect(await screen.findByText("Server healthy")).toBeTruthy();
  });
});
