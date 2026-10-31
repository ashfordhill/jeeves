import { type ApiOperation, designSchema, type ResourceConfig } from "@jeeves/spec";
import { expect, it } from "vitest";
import fixture from "../../../../fixtures/designs/qrwty-studio.json";
import { applyExtensionDraft, extensionDraft } from "./ExtensionEditor.tsx";
import { responseSummary } from "./preview.tsx";

const model = () =>
  structuredClone(
    designSchema.parse(fixture).elements[0]!.attachments[0]!.config.model,
  ) as ResourceConfig;

it("distinguishes body-free redirects from not-modified responses in concise summaries", () => {
  const operation: ApiOperation = {
    id: "read",
    method: "GET",
    path: "/item",
    purpose: "Read",
    group: "Extensions",
    access: "public",
    protected: false,
    contract: {
      responses: {
        "302": { description: "Moved", headers: { Location: { schema: { type: "string" } } } },
        "304": { description: "Not modified" },
      },
    },
  };
  expect(responseSummary(operation)).toBe("302 · redirect · no body / 304 · no body");
});
it("round trips supported schemas, media, headers, examples and metadata without normalized defaults", () => {
  const original = model();
  const extension = original.extensions[0]!;
  extension.contract.responses["200"]!.content!["image/png"]!.schema["x-extra"] = { value: [1, 2] };
  const draft = extensionDraft(extension);
  expect(applyExtensionDraft(original, extension.id, draft)).toEqual(original);
  draft.notes = "Updated purpose";
  const next = applyExtensionDraft(original, extension.id, draft);
  expect(next.extensions[0]).toEqual({ ...extension, notes: "Updated purpose" });
  expect(next.resources).toEqual(original.resources);
  expect(next.extensions.slice(1)).toEqual(original.extensions.slice(1));
});
it("rejects unsupported fields, methods and generated CRUD collisions without modifying the draft", () => {
  const original = model(),
    extension = original.extensions[0]!;
  for (const contract of [
    { ...extension.contract, callbacks: {} },
    { ...extension.contract, responses: { "200": { description: "x", links: {} } } },
  ]) {
    const draft = { ...extensionDraft(extension), contract: JSON.stringify(contract) };
    expect(() => applyExtensionDraft(original, extension.id, draft)).toThrow();
    expect(JSON.parse(draft.contract)).toEqual(contract);
  }
  expect(() =>
    applyExtensionDraft(original, extension.id, {
      ...extensionDraft(extension),
      method: "DELETE" as "GET",
    }),
  ).toThrow();
  expect(() =>
    applyExtensionDraft(original, extension.id, {
      ...extensionDraft(extension),
      path: "/api/qr/{id}",
    }),
  ).toThrow(/Duplicate operation route/);
});
