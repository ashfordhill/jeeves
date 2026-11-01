import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { validateArchitecture } from "./architecture.ts";
import {
  createTargetSchema,
  suggestArchitectureAnnotations,
  targetChanges,
} from "./architecture-targets.ts";
import { designSchema } from "./design.ts";
import { isStructural } from "./findings.ts";
import { testLookup as lookup } from "./test-support.ts";

const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/generated-workspace.json", import.meta.url),
        "utf8",
      ),
    ),
  );
it("compares stable identities, including exact contract versions, without revision/layout noise", () => {
  const a = fixture(),
    b = structuredClone(a);
  b.revision++;
  b.elements.reverse();
  b.connections.reverse();
  expect(targetChanges(a, b)).toEqual([]);
  const id = b.elements[0]!.id;
  b.elements[0]!.name = "Changed responsibility";
  const changes = targetChanges(a, b);
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ path: `elements/${id}`, kind: "changed" });
  b.elements.pop();
  expect(targetChanges(a, b).some((v) => v.kind === "removed")).toBe(true);
  expect(
    targetChanges(a, {
      ...a,
      architecture: { system: { name: "New", description: "" }, nodes: [], relationships: [] },
    }).map((c) => c.path),
  ).toContain("architecture/system");
});
it("requires an explicit reason for a conceptual replacement", () => {
  expect(
    createTargetSchema.safeParse({
      name: "New",
      baseRevision: 0,
      recipeMode: "conceptual-replacement",
    }).success,
  ).toBe(false);
  expect(createTargetSchema.parse({ name: "New", baseRevision: 0 }).recipeMode).toBe(
    "protected-copy",
  );
});
it("suggests only explicit ungrouped members, records sources, and stays editable and idempotent", () => {
  const design = fixture();
  const before = structuredClone(design);
  const architecture = suggestArchitectureAnnotations(design, "Inventory");
  expect(design).toEqual(before);
  expect(architecture.components?.length).toBeGreaterThan(0);
  expect(
    architecture.components?.every((c) => c.annotationOrigin?.revision === design.revision),
  ).toBe(true);
  expect(architecture.nodes.some((n) => n.kind === "person" && n.annotationOrigin)).toBe(true);
  const result = applyOperations(design, [{ op: "setArchitecture", architecture }], lookup);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(validateArchitecture(result.design).filter(isStructural)).toEqual([]);
  expect(suggestArchitectureAnnotations(result.design).components).toEqual(architecture.components);
  architecture.components![0]!.name = "User defined name";
  const edit = applyOperations(result.design, [{ op: "setArchitecture", architecture }], lookup);
  expect(edit.ok).toBe(true);
});
it("does not invent business groups from operation names or unbound service prose", () => {
  const d = fixture();
  for (const e of d.elements) {
    e.attachments = [];
    e.name = "Billing and organizations";
  }
  const draft = suggestArchitectureAnnotations(d);
  expect(draft.components).toEqual([]);
  expect(draft.nodes).toEqual([]);
});
it("tracks each exact contract version independently", () => {
  const model = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/architecture-review.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const contract = model.architecture!.contracts![0]!;
  const a = fixture();
  a.architecture = {
    system: { name: "Example", description: "" },
    nodes: [],
    relationships: [],
    contracts: [
      { ...contract, version: "v1" },
      { ...contract, version: "v2" },
    ],
  };
  const b = structuredClone(a);
  b.architecture!.contracts![0]!.description = "Changed only first version";
  expect(targetChanges(a, b)).toMatchObject([
    { path: `architecture/contracts/${contract.id}@v1`, kind: "changed" },
  ]);
});
it("can suggest a generic actor from explicit legacy session config without fabricating a resource group", () => {
  const design = fixture();
  for (const e of design.elements) for (const a of e.attachments) delete a.config.model;
  const draft = suggestArchitectureAnnotations(design);
  expect(draft.nodes[0]).toMatchObject({
    kind: "person",
    annotationOrigin: { revision: design.revision },
  });
  expect(draft.components).toEqual([]);
});
