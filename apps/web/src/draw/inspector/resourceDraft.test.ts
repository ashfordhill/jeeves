import { resourceConfigSchema } from "@jeeves/spec";
import { expect, it } from "vitest";
import studioFixture from "../../../../../fixtures/designs/qrwty-studio.json";
import { addField, addResource, fieldKind, resourceDraft } from "./resourceDraft.ts";

it("keeps GET/POST extension contracts and dependencies unchanged, including omitted defaults", () => {
  const fixture = JSON.parse(JSON.stringify(studioFixture));
  const model = fixture.elements[0].attachments[0].config.model;
  const post = model.extensions.find(
    (extension: { method: string }) => extension.method === "POST",
  );
  post.path = "/api/artwork-preview"; // A body-only command may omit the default empty parameters.
  delete post.contract.parameters;
  expect(resourceConfigSchema.safeParse(model).success).toBe(true);
  const original = JSON.stringify(model.extensions);
  const draft = resourceDraft(model)!;
  draft.resources.push(addResource(draft));
  expect(JSON.stringify(draft.extensions)).toBe(original);
  expect(draft.extensions).not.toBe(model.extensions);
  expect(model.resources).toHaveLength(draft.resources.length - 1);
  expect(resourceDraft({ resources: [], extensions: [{ invalid: true }] })).toBeUndefined();
});

it("preserves field identity across kinds and avoids previously reserved resource/part IDs", () => {
  const model = resourceDraft(undefined)!;
  const resource = addResource(model, ["resource-1"]);
  expect(resource.id).toBe("resource-2");
  const field = addField(resource, ["field-1", "field-2"]);
  expect(field.id).toBe("field-3");
  const renamed = { ...field, name: "quantity", required: true };
  expect(fieldKind(renamed, "integer")).toMatchObject({
    id: field.id,
    name: "quantity",
    required: true,
    type: "integer",
  });
  expect(fieldKind(renamed, "timestamp")).toEqual({
    id: field.id,
    name: "quantity",
    type: "timestamp",
    generated: "created-at",
  });
  model.resources.push(resource);
  expect(resourceConfigSchema.safeParse(model).success).toBe(true); // Wiring readiness is a separate finding.
});
