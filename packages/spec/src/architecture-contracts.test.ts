import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureSchema } from "./architecture.ts";
import {
  type ArchitectureContract,
  type ArchitectureInterface,
  architectureContractReview,
  architectureContractSchema,
  contractCanonical,
  contractSources,
  resolveContractSource,
} from "./architecture-contracts.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { blocksGenerate } from "./findings.ts";
import { resourceConfigSchema } from "./resources.ts";
import { sampleDesign, testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const definition = (
  id = "update-destination",
  kind: ArchitectureContract["kind"] = "api",
): ArchitectureContract => ({
  id,
  name: id === "update-destination" ? "UpdateDestination" : "VisitRecorded",
  version: "v1",
  kind,
  description: "",
  shape:
    kind === "api"
      ? {
          operations: [
            {
              id: "update",
              name: "UpdateDestination",
              description: "",
              input: [
                {
                  id: "url",
                  name: "destination",
                  type: "http-url",
                  required: true,
                  description: "",
                },
              ],
              output: [],
            },
          ],
          payload: [],
        }
      : {
          operations: [],
          payload: [
            {
              id: "visit-id",
              name: "visitId",
              type: "unresolved",
              required: true,
              description: "",
            },
          ],
        },
});
const instance = (
  id: string,
  contract = "update-destination",
  version = "v1",
  owner = "api",
  direction: ArchitectureInterface["direction"] = "required",
): ArchitectureInterface => ({
  id,
  name: id,
  owner: { kind: "element", id: owner },
  direction,
  necessity: "required",
  contract: { id: contract, version },
});
const planned = () => {
  const design = sampleDesign();
  design.architecture = architectureSchema.parse({
    system: { name: "Links" },
    contracts: [definition(), definition("visit-recorded", "event")],
    interfaces: [
      instance("public-api", "update-destination", "v1", "api", "provided"),
      instance("browser-use", "update-destination", "v1", "site"),
      instance("worker-use", "visit-recorded"),
    ],
  });
  return design;
};
const commit = (design: DesignDocument, architecture = design.architecture!) =>
  applyOperations(design, [{ op: "setArchitecture", architecture }], testLookup);
const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );

it("preserves legacy serialization and saves required-but-unbound and unresolved definitions without changing generation readiness", () => {
  const before = sampleDesign();
  expect(designSchema.parse(before)).toEqual(before);
  const result = commit(before, planned().architecture);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(blocksGenerate(result.findings)).toBe(blocksGenerate(validateDesign(before, testLookup)));
  expect(result.findings).toEqual(validateDesign(before, testLookup));
  const review = architectureContractReview(result.design);
  expect(review.filter((item) => item.code === "UNBOUND_REQUIRED")).toHaveLength(2);
  expect(review.filter((item) => item.code === "UNRESOLVED_CONTRACT")).toHaveLength(1);
  expect(designSchema.parse(result.design)).toEqual(result.design);
});

it("renames definitions without rewriting instances and creates exact v2 with an explicit subset update", () => {
  const before = planned();
  const changed = structuredClone(before.architecture!);
  changed.contracts![0]!.name = "Change destination";
  const renamed = commit(before, changed);
  expect(renamed.ok).toBe(true);
  if (!renamed.ok) return;
  expect(renamed.design.architecture?.interfaces).toEqual(before.architecture?.interfaces);
  changed.contracts!.push({
    ...structuredClone(changed.contracts![0]!),
    version: "v2",
    shape: { operations: [], payload: [] },
  });
  changed.interfaces![1]!.contract.version = "v2";
  const versioned = commit(renamed.design, changed);
  expect(versioned.ok).toBe(true);
  if (!versioned.ok) return;
  expect(versioned.design.architecture?.interfaces?.map((item) => item.contract.version)).toEqual([
    "v1",
    "v2",
    "v1",
  ]);
  expect(versioned.design.architecture?.contracts?.map((item) => item.version)).toEqual([
    "v1",
    "v1",
    "v2",
  ]);
  const conflict = commit(renamed.design, changed);
  expect(conflict.ok).toBe(true);
  expect(
    applyOperations(
      renamed.design,
      [{ op: "setArchitecture", architecture: changed }],
      testLookup,
      { baseRevision: before.revision },
    ).ok,
  ).toBe(false);
});

it("protects referenced shapes across atomic migrations, while unreferenced drafts stay editable", () => {
  const before = planned();
  const bad = structuredClone(before.architecture!);
  bad.contracts![0]!.shape!.operations[0]!.input[0]!.type = "text";
  bad.interfaces = [];
  expect(commit(before, bad).ok).toBe(false);
  expect(before.architecture?.contracts?.[0]?.shape?.operations[0]?.input[0]?.type).toBe(
    "http-url",
  );
  const draft = structuredClone(before);
  draft.architecture!.interfaces = [];
  expect(commit(draft, bad).ok).toBe(true);
});

it("rejects dangling versions, duplicate identities, impossible owners and removal atomically", () => {
  for (const mutate of [
    (doc: DesignDocument) => {
      doc.architecture!.interfaces![0]!.contract.version = "v9";
    },
    (doc: DesignDocument) => {
      doc.architecture!.interfaces![0]!.owner = { kind: "component", id: "missing" };
    },
    (doc: DesignDocument) => {
      doc.architecture!.interfaces![0]!.owner = { kind: "element", id: "missing" };
    },
    (doc: DesignDocument) => {
      doc.architecture!.interfaces!.push(structuredClone(doc.architecture!.interfaces![0]!));
    },
    (doc: DesignDocument) => {
      doc.architecture!.contracts!.push(structuredClone(doc.architecture!.contracts![0]!));
    },
    (doc: DesignDocument) => {
      doc.architecture!.contracts![0]!.id = "site";
    },
  ]) {
    const before = planned();
    const draft = structuredClone(before);
    mutate(draft);
    const snapshot = structuredClone(before);
    expect(commit(before, draft.architecture).ok).toBe(false);
    expect(before).toEqual(snapshot);
  }
  const before = planned();
  expect(
    applyOperations(
      before,
      [
        { op: "setNotes", id: "api", notes: "Must roll back" },
        { op: "removeElement", id: "api" },
      ],
      testLookup,
    ).ok,
  ).toBe(false);
  expect(before.elements[0]?.notes).toBe("");
});

it("supports component and external-system interfaces without inventing catalog families", () => {
  const before = planned();
  const architecture = structuredClone(before.architecture!);
  architecture.components = [
    {
      id: "link-module",
      element: "api",
      name: "Links",
      responsibility: "Owns destination changes",
      config: {},
      members: [],
      usesResources: [],
      usesConnections: [],
    },
  ];
  architecture.nodes.push({
    id: "provider",
    kind: "external-system",
    name: "Event partner",
    description: "",
  });
  architecture.interfaces![0]!.owner = { kind: "component", id: "link-module" };
  architecture.interfaces!.push({
    ...instance("partner-use", "visit-recorded"),
    owner: { kind: "external-system", id: "provider" },
    necessity: "optional",
  });
  expect(commit(before, architecture).ok).toBe(true);
  expect(
    architectureContractReview({ ...before, architecture }).filter(
      (item) => item.interface === "partner-use",
    ),
  ).toEqual([]);
});

it("captures existing REST member identity and detects source shape changes without mutating source contracts", () => {
  const before = fixture();
  const sources = contractSources(before);
  const item = sources.find(
    (item) =>
      item.source.kind === "rest-operation" &&
      item.source.member.kind === "resource" &&
      item.source.member.operation === "update",
  )!;
  const source = item.source;
  const contract: ArchitectureContract = {
    id: "legacy-update",
    name: "Legacy update",
    version: "v1",
    kind: "api",
    description: "",
    source,
    sourceSnapshot: contractCanonical(resolveContractSource(before, source)),
    sourceDesignRevision: before.revision,
  };
  const model = architectureSchema.parse({
    system: { name: "Legacy" },
    contracts: [contract],
    interfaces: [instance("legacy-provider", contract.id, "v1", "links", "provided")],
  });
  const result = commit(before, model);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.design.elements).toEqual(before.elements);
  expect(architectureContractReview(result.design)).toEqual([]);
  const edited = structuredClone(result.design);
  const attachment = edited.elements[0]!.attachments[0]!;
  const resources = resourceConfigSchema.parse(attachment.config.model);
  resources.resources[0]!.fields[0]!.name = "target";
  attachment.config.model = resources;
  expect(architectureContractReview(edited)).toContainEqual(
    expect.objectContaining({ code: "SOURCE_STALE" }),
  );
  expect(commit(edited).ok).toBe(true);
  const forged = structuredClone(model);
  forged.contracts![0]!.sourceSnapshot = "{}";
  expect(commit(before, forged).ok).toBe(false);
  const badOwner = structuredClone(model);
  badOwner.interfaces![0]!.owner = { kind: "element", id: "links-db" };
  expect(commit(before, badOwner).ok).toBe(false);
  const componentOwner = structuredClone(model);
  componentOwner.components = [
    {
      id: "owner-module",
      element: "links",
      name: "Owner module",
      responsibility: "Owns resources",
      config: {},
      members: [],
      usesResources: [],
      usesConnections: [],
    },
  ];
  componentOwner.interfaces![0]!.owner = { kind: "component", id: "owner-module" };
  expect(commit(before, componentOwner).ok).toBe(false);
  componentOwner.components[0]!.members = [
    { attachment: source.attachment, kind: "resource", ref: "qr" },
  ];
  expect(commit(before, componentOwner).ok).toBe(true);
  const orphan = structuredClone(before);
  orphan.architecture = structuredClone(componentOwner);
  orphan.architecture.interfaces = [];
  orphan.elements = orphan.elements.filter((item) => item.id !== "links");
  expect(commit(orphan, componentOwner).ok).toBe(false);

  const future = structuredClone(model);
  future.contracts![0]!.sourceDesignRevision = before.revision + 1;
  expect(commit(before, future).ok).toBe(false);

  const newVersion = structuredClone(edited.architecture!);
  newVersion.contracts!.push({
    ...contract,
    version: "v2",
    sourceDesignRevision: edited.revision,
    sourceSnapshot: contractCanonical(resolveContractSource(edited, source)),
  });
  expect(commit(edited, newVersion).ok).toBe(true);
  expect(contractCanonical({ a: 1, b: { c: 3, d: 4 } })).toBe(
    contractCanonical({ b: { d: 4, c: 3 }, a: 1 }),
  );
});

it("reuses durable event and dataset definitions by stable member ID and exposes stale deleted sources", () => {
  const design = fixture();
  design.elements[0]!.attachments.push({
    id: "visits",
    template: { id: "durable-events", version: "0.1.0" },
    notes: "",
    config: {
      events: [
        {
          id: "visit",
          type: "visit.recorded",
          version: 1,
          fields: [{ name: "qrId", type: "text", maxLength: 80 }],
          acceptance: ["VISIT-01"],
        },
      ],
    },
  });
  const sources = contractSources(design);
  const event = sources.find((item) => item.kind === "event")!;
  const data = sources.find((item) => item.kind === "data")!;
  expect(event.source).toEqual({
    kind: "durable-event",
    element: "links",
    attachment: "visits",
    event: "visit",
  });
  expect(resolveContractSource(design, data.source)).toBeDefined();
  design.architecture = architectureSchema.parse({
    system: { name: "Events" },
    contracts: [
      {
        id: "visits-contract",
        name: "VisitRecorded",
        version: "v1",
        kind: "event",
        source: event.source,
        sourceSnapshot: contractCanonical(resolveContractSource(design, event.source)),
        sourceDesignRevision: design.revision,
      },
    ],
  });
  expect(architectureContractReview(design)).toEqual([]);
  design.elements[0]!.attachments.pop();
  expect(architectureContractReview(design)[0]?.code).toBe("SOURCE_STALE");
});

it("bounds payloads/operations, rejects duplicates and keeps unresolved field intent explicit", () => {
  const base = definition("event", "event");
  expect(architectureContractSchema.safeParse(base).success).toBe(true);
  expect(architectureContractSchema.safeParse({ ...base, version: "" }).success).toBe(false);
  expect(
    architectureContractSchema.safeParse({
      ...base,
      shape: { operations: [], payload: [base.shape!.payload[0], base.shape!.payload[0]] },
    }).success,
  ).toBe(false);
  expect(
    architectureContractSchema.safeParse({
      ...base,
      shape: {
        operations: [],
        payload: Array.from({ length: 41 }, (_, i) => ({
          id: `field-${i}`,
          name: `field${i}`,
          type: "text",
          required: true,
          description: "",
        })),
      },
    }).success,
  ).toBe(false);
  expect(
    architectureContractSchema.safeParse({
      ...base,
      source: { kind: "remote", url: "https://example.test" },
    }).success,
  ).toBe(false);
});
