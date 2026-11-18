import { describe, expect, it } from "vitest";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import pins from "./fixtures/processes-off.json" with { type: "json" };
import { type OffPin, offDesigns, offPin } from "./fixtures/processes-off.ts";

const registry = loadLocalV2Registry();

/** Off retains runtime payload bytes (tile process contract, section 1). WD09 additionally
 * pins its two deployment scaffolds and normalized resource display labels. Provenance files
 * are compared apart from their implementation inventory. */
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
