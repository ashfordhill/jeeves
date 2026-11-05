import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import {
  designBlueprint,
  designBlueprintJsonSchema,
  designBlueprintSchema,
} from "./studio-blueprint.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";

const tinyurl = () => studioArchitectureExample("studio-tinyurl").design;

describe("designBlueprint", () => {
  it("exports TinyURL as a schema-valid, deterministic blueprint", () => {
    const design = tinyurl();
    const before = structuredClone(design);
    const blueprint = designBlueprint(design, "TinyURL");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(design).toEqual(before);
    expect(blueprint).toMatchObject({ blueprint: 1, revision: design.revision, findings: [] });
    expect(blueprint.services.map((s) => s.id)).toEqual(["analytics", "redirect", "shorten-api"]);
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "cdn" },
      { lane: "upload", element: "shorten-api" },
    ]);
    expect(blueprint.connections).toHaveLength(9);
    expect(blueprint.componentLinks).toHaveLength(15);
    expect(blueprint.omitted).toEqual([]);

    const shuffled = tinyurl();
    shuffled.elements.reverse();
    expect(designBlueprint(shuffled, "TinyURL")).toEqual(blueprint);
  });

  it("lists a both-lane entry once per lane, keeping the entries' shape", () => {
    const design = tinyurl();
    const entry = design.architecture?.studio?.entries?.find((item) => item.element === "cdn");
    if (!entry) throw new Error("No CDN entry.");
    entry.lane = "both";
    const blueprint = designBlueprint(design, "TinyURL");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "cdn" },
      { lane: "upload", element: "cdn" },
      { lane: "upload", element: "shorten-api" },
    ]);
    expect(blueprint.findings).toEqual([]);
  });

  it("follows the design revision and publishes a JSON Schema", () => {
    const result = applyOperations(tinyurl(), [
      { op: "updateElement", id: "redirect", name: "Redirector" },
    ]);
    if (!result.ok) throw new Error("rejected");
    const blueprint = designBlueprint(result.design);
    expect(blueprint.revision).toBe(1);
    expect(blueprint.services.find((s) => s.id === "redirect")?.name).toBe("Redirector");
    expect(designBlueprintJsonSchema()).toMatchObject({ type: "object" });
  });
});
