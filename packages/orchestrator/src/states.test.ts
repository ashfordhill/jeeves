import { describe, expect, it } from "vitest";
import { allows, runActions } from "./states.ts";

describe("run actions", () => {
  it("offers what each state allows", () => {
    expect(runActions("planning")).toEqual(["cancel"]);
    expect(runActions("planned")).toEqual(["start", "replan", "cancel"]);
    expect(runActions("running")).toEqual(["pause", "cancel"]);
    expect(runActions("paused")).toEqual(["resume", "cancel"]);
    expect(runActions("waiting_for_provider")).toEqual(["resume", "cancel"]);
    expect(runActions("succeeded")).toEqual([]);
  });

  it("allows editing the plan only while nothing runs", () => {
    expect(allows("planned", "edit")).toBe(true);
    expect(allows("needs-attention", "edit")).toBe(true);
    expect(allows("running", "edit")).toBe(false);
    expect(allows("cancelled", "edit")).toBe(false);
  });
});
