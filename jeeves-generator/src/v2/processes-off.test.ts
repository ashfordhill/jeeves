import { describe, expect, it } from "vitest";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import pins from "./fixtures/processes-off.json" with { type: "json" };
import { type OffPin, offDesigns, offPin } from "./fixtures/processes-off.ts";

const registry = loadLocalV2Registry();

/** Off means unchanged (tile process contract, section 1): pinned before TP04 changed the
 * generator. Every payload byte, and the provenance files apart from their inventory. */
describe("Runnable processes off", () => {
  const designs = offDesigns(registry);
  for (const [name, designJson] of Object.entries(designs))
    it(`keeps ${name}'s export`, () => {
      expect(offPin(designJson, registry)).toEqual((pins as Record<string, OffPin>)[name]);
    });
  it("pins all three designs", () => {
    expect(Object.keys(pins).sort()).toEqual(Object.keys(designs).sort());
  });
});
