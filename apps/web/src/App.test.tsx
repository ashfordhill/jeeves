import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";

describe("App shell", () => {
  beforeEach(() => {
    window.location.hash = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "ok" }))),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts on Draw and switches views by click", async () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "Draw" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
    expect(screen.getByRole("tab", { name: "Runs" }).getAttribute("aria-selected")).toBe("true");
    expect(window.location.hash).toBe("#/runs");
    expect(await screen.findByText("Server healthy")).toBeTruthy();
  });
});
