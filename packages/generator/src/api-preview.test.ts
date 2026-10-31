import { type ResourceConfig, resourceConfigSchema } from "@jeeves/spec";
import { resourceContract } from "@jeeves/template-rest-api-server/resources";
import { expect, it } from "vitest";
import { designApiPreview } from "./api-preview.ts";
import { templateSet } from "./modules.ts";
import { createRecipeDesign } from "./recipes.ts";
import { fixtureDesign } from "./test-support.ts";

const lookup = templateSet().lookup;
it("previews every session/CRUD/extension once with the unchanged generation contract and exact pin", () => {
  for (const fixture of ["qrwty-architecture", "generated-workspace"]) {
    for (const version of ["0.1.0", "0.2.0"]) {
      const design = fixtureDesign(fixture);
      const element = design.elements.find((e) => e.attachments.some((a) => a.config.model))!;
      const attachment = element.attachments.find((a) => a.config.model)!;
      attachment.template.version = version;
      design.revision = 37;
      const before = structuredClone(design);
      const model = resourceConfigSchema.parse(attachment.config.model);
      const preview = designApiPreview(design, lookup);
      const api = preview.apis[0]!;
      expect(preview.revision).toBe(37);
      expect(api.document).toEqual(resourceContract(model, element.name, version === "0.2.0"));
      expect(api.operations).toHaveLength(
        4 + model.resources.reduce((n, r) => n + r.operations.length, 0) + model.extensions.length,
      );
      expect(new Set(api.operations.map((o) => `${o.method} ${o.path}`)).size).toBe(
        api.operations.length,
      );
      expect(api.operations.every((o) => o.purpose && o.group && o.access)).toBe(true);
      expect(design).toEqual(before);
    }
  }
});
it("retains binary media, redirect headers and empty bodies, JSON inputs, and generated errors", () => {
  const api = designApiPreview(fixtureDesign("qrwty-architecture"), lookup).apis[0]!;
  const image = api.operations.find((o) => o.path === "/api/qr/{id}/image")!;
  expect(image.contract.responses["200"]).toMatchObject({
    content: { "image/png": { schema: { type: "string", format: "binary" } } },
    headers: { "Content-Disposition": { schema: { type: "string" } } },
  });
  const redirect = api.operations.find((o) => o.path === "/q/{id}")!;
  expect(redirect.access).toBe("public");
  expect(redirect.contract.responses["302"]).toMatchObject({
    headers: { Location: { required: true }, "Cache-Control": { required: true } },
  });
  expect(redirect.contract.responses["302"]).not.toHaveProperty("content");
  expect(image.contract.responses["400"]?.content?.["application/json"]).toBeDefined();
  expect(
    api.operations.find((o) => o.id === "registerAccount")?.contract.requestBody?.content[
      "application/json"
    ].schema,
  ).toHaveProperty("properties.email");
});
it("reports unsupported/invalid saved models explicitly and protects recipe contracts", () => {
  const legacy = designApiPreview(fixtureDesign("link-shortener"), lookup);
  expect(legacy.apis[0]?.unavailable).toContain("project-owned");
  const invalid = fixtureDesign("qrwty-architecture");
  const model = invalid.elements[0]!.attachments[0]!.config.model as ResourceConfig;
  model.extensions[0]!.path = "/auth/login";
  expect(designApiPreview(invalid, lookup).apis[0]).toMatchObject({
    operations: [],
    unavailable: expect.stringContaining("runtime route"),
  });
  const recipe = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "Preview", hostPort: 18287 },
  ).design;
  expect(designApiPreview(recipe, lookup).apis[0]!.operations.every((o) => o.protected)).toBe(true);
});
