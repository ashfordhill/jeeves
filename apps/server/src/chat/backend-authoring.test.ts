import {
  applyOperations,
  architectureContractSchema,
  backendPolicyConsumers,
  contractKey,
  type DesignDocument,
  designSchema,
  noTemplates,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { toolDefinitions, Workspace } from "./tools.ts";

function need<T>(value: T | undefined | null): T {
  if (value == null) throw new Error("Missing fixture value");
  return value;
}
const model = (d: DesignDocument) => need(need(d.architecture).backend);
const ref = (id: string, version = "v1") => ({ id, version });
function fixture(): DesignDocument {
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      { id: "api", name: "API", template: null, planned: "application-api" },
      { id: "store", name: "Store", template: null, planned: "relational-store" },
    ],
    architecture: {
      system: { name: "Policy authoring", description: "Design only" },
      contracts: [
        {
          id: "data",
          version: "v1",
          name: "Data",
          kind: "data",
          coverage: "Complete",
          shape: {
            operations: [],
            payload: [
              { id: "id", name: "ID", type: "uuid", required: true },
              { id: "body", name: "Body", type: "text", maxLength: 100, required: true },
            ],
          },
        },
      ],
      datasets: [
        {
          id: "dataset",
          name: "Data",
          contract: ref("data"),
          owners: [{ kind: "element", id: "api" }],
          readers: [],
          writers: [],
          store: "store",
          ownershipDecision: "",
          tenant: "Public",
          deletion: "Retain",
          exportAccess: "Authorized staff",
        },
      ],
      backend: {
        schemaVersion: 1,
        entities: [
          {
            id: "entity",
            version: "v1",
            name: "Entity",
            dataset: "dataset",
            contract: ref("data"),
            storageId: "entity-table",
            fields: ["id", "body"].map((field) => ({
              field,
              storageId: field,
              required: true,
              nullable: false,
              storage: { kind: "scalar" },
            })),
            primaryKey: ["id"],
            scope: { kind: "global" },
            relations: [],
          },
        ],
        accessPolicies: [
          {
            id: "policy",
            version: "v1",
            name: "Policy",
            resource: ref("entity"),
            context: {
              identity: "session-principal",
              scope: "global",
              authentication: "server-established",
              correlation: "server-established",
            },
            default: "deny",
            conflict: "deny-wins",
            clauses: [{ id: "authenticated", kind: "authenticated" }],
            rules: [
              {
                id: "allow",
                effect: "allow",
                actions: ["list", "bytes"],
                when: { operator: "all", clauses: ["authenticated"] },
              },
            ],
            projections: [
              {
                id: "read",
                mode: "read",
                fields: ["id", "body"],
                when: { operator: "all", clauses: ["authenticated"] },
                unknownFields: "reject",
              },
            ],
            revocation: { strategy: "current-state", cache: "none", recheck: ["read", "bytes"] },
          },
        ],
        queries: [
          {
            id: "query",
            version: "v1",
            name: "Private query",
            root: ref("entity"),
            joins: [],
            filters: [
              { id: "filter", field: { source: "root", field: "body" }, comparisons: ["eq"] },
            ],
            projection: [{ id: "id", field: { source: "root", field: "id" } }],
            order: [{ field: { source: "root", field: "id" }, direction: "asc" }],
            cursor: { kind: "keyset", fields: [{ source: "root", field: "id" }] },
            limit: { default: 25, maximum: 100 },
            accessPolicy: { kind: "policy", reference: ref("policy") },
            accessProjection: "read",
            freshness: { kind: "authoritative" },
          },
        ],
        accessBindings: [
          {
            id: "bytes",
            version: "v1",
            name: "Private bytes",
            resource: ref("entity"),
            target: { kind: "projection", entity: ref("entity"), fields: ["body"] },
            policy: { kind: "policy", reference: ref("policy") },
            site: "bytes",
            action: "bytes",
            projection: "read",
          },
        ],
      },
    },
  });
}
it("discovers exact backend policy uses including hidden query fields and byte paths", () => {
  const before = fixture(),
    workspace = new Workspace(before);
  const discovered = JSON.parse(workspace.run("getArchitectureContracts", "{}"));
  expect(discovered.backend).toEqual(model(before));
  expect(discovered.policyConsumers[0].policy).toEqual(ref("policy"));
  expect(discovered.policyConsumers[0].consumers).toMatchObject([
    { kind: "query", site: "read", action: "list", fields: ["id", "body"] },
    { kind: "access-binding", site: "bytes", fields: ["body"] },
  ]);
  expect(
    discovered.policyConsumers[0].consumers.map((u: { reference: unknown }) => u.reference),
  ).toEqual([ref("query"), ref("bytes")]);
  expect(discovered.backendAuthoring).toContain("design previews only");
  expect(backendPolicyConsumers(before, ref("policy", "v2"))).toEqual([]);
  need(need(model(before).queries)[0]).accessPolicy.kind = "unresolved";
  expect(backendPolicyConsumers(before, ref("policy"))[0]?.resolved).toBe(false);
  expect(workspace.pending).toEqual([]);
});
it("chat preserves protected policy versions and atomically saves a successor with exact query/byte retargets", () => {
  const before = fixture(),
    registry = noTemplates,
    workspace = new Workspace(before);
  const edit = (architecture: NonNullable<DesignDocument["architecture"]>) =>
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "setArchitecture", architecture }] }),
      ),
    );
  const invalid = structuredClone(need(before.architecture));
  need(need(need(invalid.backend).accessPolicies)[0]).rules = [];
  expect(edit(invalid).ok).toBe(false);
  expect(workspace.working).toEqual(before);
  expect(workspace.pending).toEqual([]);
  const next = structuredClone(need(before.architecture));
  const successor = {
    ...structuredClone(need(need(need(next.backend).accessPolicies)[0])),
    version: "v2",
    name: "Internal note policy",
  };
  need(need(next.backend).accessPolicies).push(successor);
  need(need(need(next.backend).queries)[0]).accessPolicy = {
    kind: "policy",
    reference: ref("policy", "v2"),
  };
  need(need(need(next.backend).accessBindings)[0]).policy = {
    kind: "policy",
    reference: ref("policy", "v2"),
  };
  expect(edit(next).ok).toBe(true);
  expect(workspace.pending).toHaveLength(1);
  const committed = applyOperations(before, workspace.pending, registry);
  expect(committed.ok).toBe(true);
  if (committed.ok) {
    expect(committed.design.revision).toBe(1);
    expect(need(model(committed.design).accessPolicies)[0]).toEqual(
      need(model(before).accessPolicies)[0],
    );
  }
  const discovered = JSON.parse(workspace.run("getArchitectureContracts", "{}"));
  expect(
    discovered.policyConsumers.map(
      (p: { policy: { id: string; version: string }; consumers: unknown[] }) => [
        contractKey(p.policy),
        p.consumers.length,
      ],
    ),
  ).toEqual([
    ["policy@v1", 0],
    ["policy@v2", 2],
  ]);
  const unknown = structuredClone(next);
  need(need(need(unknown.backend).queries)[0]).accessPolicy = {
    kind: "policy",
    reference: ref("missing"),
  };
  expect(edit(unknown).ok).toBe(false);
  expect(workspace.working.architecture).toEqual(next);
  expect(workspace.pending).toHaveLength(1);
});

it("keeps joined query source observations and intended unresolved policies distinct by exact version", () => {
  const d = fixture(),
    query = need(need(model(d).queries)[0]);
  query.sourcePolicies = [
    {
      source: "category",
      policy: { kind: "unresolved", reference: ref("policy", "v2") },
      projection: "category-read",
    },
  ];
  query.filters.push({
    id: "hidden-category",
    field: { source: "category", field: "body" },
    comparisons: ["eq"],
  });
  expect(backendPolicyConsumers(d, ref("policy", "v2"))).toEqual([
    {
      kind: "query",
      reference: ref("query"),
      label: "Private query · category",
      path: "queries/query@v1/category",
      resolved: false,
      site: "read",
      action: "list",
      projection: "category-read",
      fields: ["body"],
    },
  ]);
  expect(backendPolicyConsumers(d, ref("policy"))).toHaveLength(2);
});
it("chat exposes the shared bounded data, type and access operation schemas", () => {
  const schema = JSON.stringify(
    need(toolDefinitions().find((tool) => tool.name === "applyOperations")).parameters,
  );
  for (const name of [
    "accessPolicies",
    "accessBindings",
    "sourcePolicies",
    "authorized-scope",
    "deny-wins",
    "persisted-role-store",
    "service-purpose",
    "idempotent-replay",
    "tagged-union",
    "maxEntries",
  ])
    expect(schema).toContain(name);
});

it("shows provided-operation output paths without treating transport fields as persisted authority", () => {
  const d = fixture(),
    a = need(d.architecture),
    b = need(need(model(d).accessBindings)[0]);
  need(a.contracts).push(
    architectureContractSchema.parse({
      id: "api-contract",
      version: "v1",
      name: "API contract",
      kind: "api",
      shape: {
        operations: [
          {
            id: "read",
            name: "Read",
            input: [],
            output: [
              {
                id: "body",
                name: "Body",
                description: "",
                required: true,
                type: "text",
                maxLength: 100,
              },
            ],
          },
        ],
        payload: [],
      },
    }),
  );
  b.target = {
    kind: "operation",
    contract: ref("api-contract"),
    operation: "read",
    owner: { kind: "element", id: "api" },
  };
  expect(backendPolicyConsumers(d, ref("policy"))[1]).toMatchObject({
    kind: "access-binding",
    fields: [],
    outputPaths: ["output/body"],
  });
});
