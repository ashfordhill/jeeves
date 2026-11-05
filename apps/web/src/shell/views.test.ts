import { describe, expect, it } from "vitest";
import { viewFromHash } from "./views.ts";

describe("viewFromHash", () => {
  it("reads known views", () => {
    expect(viewFromHash("#/draw")).toBe("draw");
    expect(viewFromHash("#settings")).toBe("settings");
  });

  it("falls back to Draw", () => {
    expect(viewFromHash("")).toBe("draw");
    expect(viewFromHash("#/nope")).toBe("draw");
  });
});
