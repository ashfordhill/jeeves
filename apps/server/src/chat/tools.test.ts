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

it("exposes all planned options with exact defaults, schemas and compatible host roles", async () => {
  const { componentCompatible, emptyDesign, plannedCapabilities, plannedConfigSchema } =
    await import("@jeeves/spec");
  const { z } = await import("zod");
  const workspace = new Workspace(registry, emptyDesign());
  const list = (scope?: string) =>
    JSON.parse(workspace.run("listPlannedCapabilities", JSON.stringify({ scope }))).capabilities;
  expect(list().map((entry: { id: string }) => entry.id)).toEqual(
    plannedCapabilities.map((entry) => entry.id),
  );
  for (const scope of ["container", "component"]) {
    expect(list(scope).map((entry: { id: string }) => entry.id)).toEqual(
      plannedCapabilities.filter((entry) => entry.scope === scope).map((entry) => entry.id),
    );
  }
  for (const entry of plannedCapabilities) {
    const result = JSON.parse(
      workspace.run("describePlannedCapability", JSON.stringify({ id: entry.id })),
    );
    expect(result.capability).toEqual(JSON.parse(JSON.stringify(entry)));
    expect(result.configSchema).toEqual(
      z.toJSONSchema(plannedConfigSchema(entry.id), { io: "input" }),
    );
    expect(result.availability).toContain("no runtime; blocks generation");
    if (entry.scope === "component") {
      expect(result.compatibleHostRoles).toEqual(
        ["frontend", "service", "worker", "database", "external"].filter((role) =>
          componentCompatible(entry, role),
        ),
      );
    }
  }
  expect(workspace.pending).toEqual([]);
  expect(
    JSON.parse(workspace.run("describePlannedCapability", '{"id":"quantum-transport"}')),
  ).toMatchObject({ ok: false, error: expect.stringContaining("never invent IDs") });
});

it("rejects invented planning IDs/options and incompatible C3 atomically, then accepts an honest placeholder", async () => {
  const { emptyDesign } = await import("@jeeves/spec");
  const workspace = new Workspace(registry, emptyDesign());
  const add = {
    op: "addElement",
    element: {
      id: "quantum",
      name: "Quantum transport",
      template: null,
      planned: "quantum-transport",
      notes: "Requires a capability outside the library.",
    },
  };
  const run = (ops: unknown[]) =>
    JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops })));
  expect(run([add]).ok).toBe(false);
  expect(workspace.pending).toEqual([]);
  expect(
    run([
      {
        ...add,
        element: {
          ...add.element,
          planned: "browser-client",
          config: { audience: "Invented audience" },
        },
      },
    ]).ok,
  ).toBe(false);
  expect(workspace.working.elements).toEqual([]);
  expect(
    run([
      { ...add, element: { ...add.element, planned: "browser-client" } },
      {
        op: "setArchitecture",
        architecture: {
          system: { name: "Test" },
          components: [
            {
              id: "bad-backend",
              element: "quantum",
              name: "Backend on client",
              capability: "billing-module",
            },
          ],
        },
      },
    ]).ok,
  ).toBe(false);
  expect(workspace.working.elements).toEqual([]);
  const { planned: _planned, ...placeholder } = add.element;
  expect(run([{ ...add, element: placeholder }])).toMatchObject({
    ok: true,
    findings: [{ code: "NEEDS_TEMPLATE" }],
  });
  expect(workspace.working.elements[0]?.planned).toBeUndefined();
});
