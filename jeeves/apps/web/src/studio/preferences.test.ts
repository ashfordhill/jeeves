// The canvas view preference: Detailed by default, and a view saved as "overview" reads as Simple.
import { afterEach, describe, expect, it } from "vitest";
import { canvasViews, readPreferences } from "./preferences.ts";

const save = (project: string, value: object) =>
  localStorage.setItem(`jeeves.studio.ui.v1:${project}`, JSON.stringify(value));

describe("readPreferences", () => {
  afterEach(() => localStorage.clear());

  it("lists Detailed first and opens a project with no saved choice in Detailed", () => {
    expect(canvasViews).toEqual(["detailed", "simple"]);
    expect(readPreferences("fresh").view).toBe("detailed");
    save("rails-only", { chatOpen: false });
    expect(readPreferences("rails-only")).toMatchObject({ chatOpen: false, view: "detailed" });
  });

  it("keeps a saved choice, reads the old Overview as Simple and ignores anything else", () => {
    save("simple", { view: "simple" });
    expect(readPreferences("simple").view).toBe("simple");
    save("detailed", { view: "detailed" });
    expect(readPreferences("detailed").view).toBe("detailed");
    save("old", { view: "overview", inspectorOpen: true });
    expect(readPreferences("old")).toMatchObject({ view: "simple", inspectorOpen: true });
    save("unknown", { view: "hand" });
    expect(readPreferences("unknown").view).toBe("detailed");
    localStorage.setItem("jeeves.studio.ui.v1:broken", "{");
    expect(readPreferences("broken").view).toBe("detailed");
  });
});
