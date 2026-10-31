import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyOperations,
  architectureViews,
  deliveryConfigSchema,
  validateDesign,
} from "@jeeves/spec";
import { afterEach, expect, it } from "vitest";
import { acceptanceCoverageProblems, type FixedAcceptance } from "./acceptance.ts";
import { generateProject } from "./generate.ts";
import { hashContents } from "./lock.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const suite: FixedAcceptance = {
  id: "orders",
  service: "orders",
  operationIds: ["event:order-delivery:order-placed"],
  acceptanceIds: ["ORDER-01"],
  source:
    "import assert from 'node:assert/strict'; import test from 'node:test'; test('fixture', () => assert.ok(true));",
};
const design = () => fixtureDesign("event-orders");
it("validates finite contracts and the actual Postgres binding; older services cannot accept it", () => {
  const document = design();
  const config = structuredClone(document.elements[0]!.attachments[0]!.config);
  expect(deliveryConfigSchema.safeParse(config).success).toBe(true);
  const invalid = {
    ...config,
    events: [
      { ...(config.events as object[])[0], fields: [{ name: "constructor", type: "boolean" }] },
    ],
  };
  expect(deliveryConfigSchema.safeParse(invalid).success).toBe(false);
  expect(deliveryConfigSchema.safeParse({ ...config, surprise: true }).success).toBe(false);
  const parsed = deliveryConfigSchema.parse(config);
  expect(
    deliveryConfigSchema.safeParse({ ...parsed, events: [...parsed.events, parsed.events[0]] })
      .success,
  ).toBe(false);
  expect(validateDesign(document, templateSet().lookup)).toEqual([]);
  const incomplete = structuredClone(document);
  incomplete.elements[0]!.attachments = [];
  expect(
    applyOperations(
      incomplete,
      [
        {
          op: "addAttachment",
          element: "orders",
          attachment: { id: "events", template: { id: "durable-events", version: "0.1.0" } },
        },
      ],
      templateSet().lookup,
    ).ok,
  ).toBe(true);
  document.connections = [];
  expect(
    validateDesign(document, templateSet().lookup).some((f) => f.message.includes("Postgres")),
  ).toBe(true);
  document.elements[0]!.template!.version = "0.1.0";
  expect(
    validateDesign(document, templateSet().lookup).some(
      (f) => f.code === "ATTACHMENT_INCOMPATIBLE",
    ),
  ).toBe(true);
});
it("binds real C4 responsibilities and requires namespaced fixed event acceptance", () => {
  const document = design(),
    templates = templateSet();
  const plan = planProject(document, templates, {
    projectName: "Orders",
    fixedAcceptance: [suite],
  });
  expect(
    acceptanceCoverageProblems({}, [], { orders: suite.operationIds }, plan.deliveryModels),
  ).toEqual(["orders/event:order-delivery:order-placed: uncovered required acceptance ORDER-01"]);
  expect(
    acceptanceCoverageProblems(
      {},
      plan.fixedAcceptance!,
      { orders: suite.operationIds },
      plan.deliveryModels,
    ),
  ).toEqual([]);
  const view = architectureViews(document, templates.lookup, "Orders").components[0]!;
  expect(view.nodes.find((n) => n.binding?.event === "order-placed")).toMatchObject({
    support: "extension",
    acceptance: ["ORDER-01"],
  });
  expect(view.edges.map((e) => e.connection)).toEqual(["orders-store"]);
  expect(view.nodes.find((n) => n.name === "Durable event delivery")?.description).toContain(
    "in this service process",
  );
  expect(plan.artifacts?.map((a) => hashContents(a.contents))).toEqual([
    "sha256-b0658fce9fbb692e317c54ded4c9b4fff3d4eb3c66b5d4b550947f67f60776fd",
  ]);
});
it("regenerates deterministically, preserves handlers, refuses durable identity changes and edited archives before writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-events-unit-"));
  dirs.push(dir);
  const document = design();
  const generate = () =>
    generateProject({
      dir,
      design: document,
      projectName: "Orders",
      git: false,
      vendor: fakeVendor,
    });
  const first = await generate();
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  const handler = join(dir, "services/orders/src/event-handlers/order-placed.ts");
  writeFileSync(handler, "// deliberate domain implementation\n");
  const second = await generate();
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  expect(second.lock).toEqual(first.lock);
  expect(readFileSync(handler, "utf8")).toContain("deliberate domain");
  const config = document.elements[0]!.attachments[0]!.config;
  config.preset = "standard";
  expect((await generate()).ok).toBe(true);
  let published = readFileSync(join(dir, "jeeves/lock.json"), "utf8");
  const event = (config.events as { version: number }[])[0]!;
  event.version = 2;
  await expect(generate()).rejects.toThrow("append a new event version");
  expect(readFileSync(join(dir, "jeeves/lock.json"), "utf8")).toBe(published);
  event.version = 1;
  const previous = document.connections[0]!.id;
  document.connections[0]!.id = "new-store";
  await expect(generate()).rejects.toThrow("reviewed data and ownership migration");
  document.connections[0]!.id = previous;
  const pkgPath = join(dir, "services/orders/package.json");
  const pkgText = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(pkgText);
  pkg.dependencies["@jeeves/durable-events"] = "9.0.0";
  writeFileSync(pkgPath, JSON.stringify(pkg));
  await expect(generate()).rejects.toThrow("must keep the pinned production dependency");
  writeFileSync(pkgPath, pkgText);
  const events = config.events as { id: string; version: number }[];
  config.events = [...events, { ...events[0], id: "order-placed-v2", version: 2 }];
  expect((await generate()).ok).toBe(true);
  expect(readFileSync(handler, "utf8")).toContain("deliberate domain");
  const migration = join(dir, "services/orders/event-migrations/0001.sql");
  expect(hashContents(readFileSync(migration))).toBe(
    first.lock.files["services/orders/event-migrations/0001.sql"],
  );
  published = readFileSync(join(dir, "jeeves/lock.json"), "utf8");
  const appended = config.events;
  config.events = events;
  await expect(generate()).rejects.toThrow("cannot be removed or redefined");
  config.events = appended;
  const archive = join(dir, first.plan.artifacts![0]!.path);
  writeFileSync(archive, "changed");
  expect(await generate()).toMatchObject({ ok: false, reason: "ownership" });
  expect(readFileSync(join(dir, "jeeves/lock.json"), "utf8")).toBe(published);
});
