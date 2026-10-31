import { readFileSync } from "node:fs";
import { builtinRegistry } from "@jeeves/registry";
import { applyOperations, designSchema } from "@jeeves/spec";
import { expect, it } from "vitest";
import { Workspace } from "./tools.ts";

const registry = builtinRegistry();
const design = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );
it("chat requests an exact human subtype review and cannot approve it itself", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  const result = JSON.parse(
    workspace.run(
      "reviewSubtype",
      JSON.stringify({ id: "links", template: { id: "web-app", version: "0.1.0" } }),
    ),
  );
  expect(result.ok).toBe(true);
  const review = workspace.question?.subtypeReview;
  expect(review?.revision).toBe(before.revision);
  expect(review?.discarded).toContain("component: links-api (rest-api-server)");
  expect(workspace.pending).toEqual([]);
  expect(workspace.working).toEqual(before);
  const op = {
    op: "changeSubtype" as const,
    id: "links",
    template: { id: "web-app", version: "0.1.0" },
    confirmation: { revision: review!.revision, discarded: review!.discarded },
  };
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(
    false,
  );
  const manual = applyOperations(before, [op], registry, { baseRevision: before.revision });
  expect(manual.ok).toBe(true);
});
it("chat resource config edits use the same validation as manual attachment edits", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  const attachment = before.elements[0]!.attachments[0]!;
  const config = structuredClone(attachment.config);
  const op = { op: "updateAttachment" as const, id: attachment.id, config };
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(true);
  const invalid = { ...config, model: { resources: [{ id: "bad" }], extensions: [] } };
  const refused = JSON.parse(
    workspace.run("applyOperations", JSON.stringify({ ops: [{ ...op, config: invalid }] })),
  );
  expect(refused.ok).toBe(false);
  expect(workspace.working.elements[0]!.attachments[0]!.config).toEqual(config);
});

it("chat routes same-template review to a compatible upgrade without an unusable discard confirmation", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  const result = JSON.parse(
    workspace.run(
      "reviewSubtype",
      JSON.stringify({ id: "links", template: { id: "http-service", version: "0.3.0" } }),
    ),
  );
  expect(result).toMatchObject({
    ok: true,
    upgrade: {
      ok: true,
      from: { id: "http-service", version: "0.1.0" },
      to: { id: "http-service", version: "0.3.0" },
    },
  });
  expect(workspace.question).toBeUndefined();
  expect(workspace.pending).toEqual([]);
  const { id, from, to, revision } = result.upgrade;
  expect(
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "upgradeTemplate", id, from, to, revision }] }),
      ),
    ).ok,
  ).toBe(true);
  expect(workspace.working.elements[0]!.attachments).toEqual(before.elements[0]!.attachments);
  expect(workspace.working.elements[0]!.template).toEqual(to);
});
