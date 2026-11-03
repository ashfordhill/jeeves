import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import {
  type ArchitectureContract,
  architectureContractSchema,
  type ContractField,
  type ContractShape,
  type ContractValue,
  contractBinaryBodySchema,
  contractCanonical,
  contractSources,
  inspectContractShape,
  inspectContractTransport,
  resolveContractSource,
  validateArchitectureContracts,
} from "./architecture-contracts.ts";
import {
  buildArchitectureHandoff,
  handoffFingerprint,
  handoffJson,
} from "./architecture-handoff.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import { targetChanges } from "./architecture-targets.ts";
import { type ContractJsonSchema, exportContractJsonSchema } from "./contract-json-schema.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { resourceConfigSchema } from "./resources.ts";
import { testLookup } from "./test-support.ts";

function need<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Missing test fixture value");
  return value;
}

const field = (id: string, value: ContractValue, required = true, name = id): ContractField => ({
  id,
  name,
  required,
  description: "",
  ...value,
});
const ref = (id: string, version = "v1"): ContractValue => ({ type: "ref", ref: { id, version } });
const outcome = (id: string, status: number, payload?: ContractField[]) => ({
  id,
  name: id,
  kind: id === "missing" ? ("Rejection" as const) : ("Success" as const),
  status,
  condition: id,
  state: "Unchanged" as const,
  retry: "Safe" as const,
  ...(payload ? { payload } : {}),
});
function definition(): ArchitectureContract {
  return architectureContractSchema.parse({
    id: "payments",
    version: "v1",
    name: "Payments and files",
    kind: "api",
    coverage: "Complete",
    shape: {
      types: [
        {
          id: "identity",
          version: "v1",
          name: "Identity",
          value: { type: "text", minLength: 1, maxLength: 64 },
        },
        {
          id: "money",
          version: "v1",
          name: "Money",
          value: {
            type: "object",
            fields: [
              field("minor", { type: "integer", minimum: 0, maximum: 999999 }),
              field("currency", { type: "text", enumValues: ["USD"] }),
            ],
          },
        },
        {
          id: "address",
          version: "v1",
          name: "Address",
          value: { type: "object", fields: [field("line", { type: "text", maxLength: 80 })] },
        },
        {
          id: "paid",
          version: "v1",
          name: "Paid",
          value: {
            type: "object",
            fields: [
              field("status", { type: "text", enumValues: ["paid"] }),
              field("amount", ref("money")),
            ],
          },
        },
        {
          id: "pending",
          version: "v1",
          name: "Pending",
          value: {
            type: "object",
            fields: [
              field("status", { type: "text", enumValues: ["pending"] }),
              field("amount", ref("money")),
            ],
          },
        },
      ],
      payload: [],
      operations: [
        {
          id: "pay",
          name: "Pay",
          input: [
            field("identity", ref("identity")),
            field("trace", { type: "text", maxLength: 80 }),
            field("verbose", { type: "boolean" }, false),
            field("subtotal", ref("money")),
            field("total", ref("money")),
            field("address", { ...ref("address"), nullable: true }, false),
            field("history", {
              type: "map",
              keys: { minLength: 1, maxLength: 20 },
              minEntries: 1,
              maxEntries: 2,
              values: {
                type: "array",
                maxItems: 2,
                items: { type: "integer", minimum: 0, maximum: 5 },
              },
            }),
          ],
          output: [
            field("payment", {
              type: "tagged-union",
              discriminator: "status",
              variants: [ref("paid"), ref("pending")],
            }),
            field("trace", { type: "text", maxLength: 80 }),
          ],
          outcomes: [
            outcome("paid", 201),
            outcome("missing", 404, [field("error", { type: "text", enumValues: ["missing"] })]),
          ],
          transport: {
            protocol: "http",
            method: "POST",
            path: "/payments/{paymentId}",
            parameters: [
              { field: "identity", in: "path", name: "paymentId" },
              { field: "trace", in: "header", name: "X-Trace" },
              { field: "verbose", in: "query", name: "verbose" },
            ],
            request: {
              kind: "json",
              contentType: "application/json",
              fields: ["subtotal", "total", "address", "history"],
            },
            responses: [
              {
                outcome: "paid",
                status: 201,
                headers: [{ field: "trace", name: "X-Trace" }],
                body: { kind: "json", contentType: "application/json", fields: ["payment"] },
              },
              {
                outcome: "missing",
                status: 404,
                headers: [],
                body: { kind: "json", contentType: "application/problem+json", fields: ["error"] },
              },
            ],
          },
        },
        {
          id: "download",
          name: "Download",
          input: [field("identity", ref("identity"))],
          output: [field("disposition", { type: "text", maxLength: 200 })],
          outcomes: [
            outcome("downloaded", 200),
            outcome("missing", 404, [field("error", { type: "text" })]),
          ],
          transport: {
            protocol: "http",
            method: "GET",
            path: "/home/files/{fileId}",
            parameters: [{ field: "identity", in: "path", name: "fileId" }],
            responses: [
              {
                outcome: "downloaded",
                status: 200,
                headers: [{ field: "disposition", name: "Content-Disposition" }],
                body: {
                  kind: "binary",
                  contentType: "application/octet-stream",
                  maxBytes: 1048576,
                },
              },
              {
                outcome: "missing",
                status: 404,
                headers: [],
                body: { kind: "json", contentType: "application/json", fields: ["error"] },
              },
            ],
          },
        },
      ],
    },
  });
}
function shapeOf(c: ArchitectureContract): ContractShape {
  if (!c.shape) throw new Error("Missing shape");
  return c.shape;
}
function base(contract = definition(), consumed = false): DesignDocument {
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [{ id: "api", name: "API", template: null, planned: "application-api" }],
    architecture: {
      system: { name: "Transport" },
      contracts: [contract],
      ...(consumed
        ? {
            interfaces: [
              {
                id: "payments-api",
                name: "Payments",
                owner: { kind: "element", id: "api" },
                direction: "provided",
                necessity: "required",
                contract: { id: contract.id, version: contract.version },
              },
            ],
          }
        : {}),
    },
  });
}
const commit = (before: DesignDocument, after: DesignDocument) =>
  applyOperations(
    before,
    [
      { op: "setNotes", id: need(before.elements[0]).id, notes: "Atomic edit" },
      { op: "setArchitecture", architecture: after.architecture ?? null },
    ],
    testLookup,
  );
function schemaOf(c: ArchitectureContract): ContractJsonSchema {
  const result = exportContractJsonSchema(c);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.schema;
}
const reader = (schema: ContractJsonSchema, key?: string) => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile({ ...schema, ...(key ? { $ref: `#/$defs/${key}` } : {}) });
  return { safeParse: (value: unknown) => ({ success: validate(value), errors: validate.errors }) };
};

it("declares method, path, scalar input locations, JSON/outcome responses, headers and bounded binary bytes independently of logical values", () => {
  const contract = definition();
  const shape = shapeOf(contract);
  expect(inspectContractShape(shape).ok).toBe(true);
  expect(inspectContractTransport(shape)).toEqual({ ok: true, issues: [] });
  const design = base();
  const blank = base();
  need(blank.architecture).contracts = [];
  expect(commit(blank, design).ok).toBe(true);
  expect(designSchema.parse(JSON.parse(JSON.stringify(design)))).toEqual(design);
  const download = need(shape.operations[1]);
  expect(download.output.map((f) => f.id)).toEqual(["disposition"]);
  expect(need(need(download.transport).responses[0]).body).toEqual({
    kind: "binary",
    contentType: "application/octet-stream",
    maxBytes: 1048576,
  });
  expect(architectureContractSchema.safeParse({ ...contract, kind: "in-process" }).success).toBe(
    false,
  );
});

it("rejects malformed methods, names, content types, statuses and unbounded binary descriptors at the schema boundary", () => {
  for (const value of [
    { kind: "binary", contentType: "application/octet-stream" },
    { kind: "binary", contentType: "*/*", maxBytes: 1 },
    { kind: "binary", contentType: "text/plain\r\nX-Injection: true", maxBytes: 1 },
    { kind: "binary", contentType: "image/png", maxBytes: 0 },
    { kind: "binary", contentType: "image/png", maxBytes: 1000000001 },
    { kind: "binary", contentType: "image/png", maxBytes: 1.5 },
    { kind: "binary", contentType: "image/png", maxBytes: 1, fields: ["bytes"] },
  ])
    expect(contractBinaryBodySchema.safeParse(value).success).toBe(false);
  for (const change of [
    { method: "TRACE" },
    { path: "https://example.test/pay" },
    { path: "/pay?mode=1" },
    { parameters: [{ field: "identity", in: "cookie", name: "identity" }] },
    { parameters: [{ field: "identity", in: "header", name: "X\r\nInjected" }] },
    { request: { kind: "json", contentType: "text/plain", fields: [] } },
    { responses: [{ status: 600, headers: [] }] },
    { responses: [{ status: 199, headers: [] }] },
  ]) {
    const c = definition();
    Object.assign(need(need(shapeOf(c).operations[0]).transport), change);
    expect(architectureContractSchema.safeParse(c).success, JSON.stringify(change)).toBe(false);
  }
});

it("rejects invalid and conflicting transport mappings atomically without relying on immutability", () => {
  const mutations: ((s: ContractShape) => void)[] = [
    (s) => {
      need(need(s.operations[0]).transport).path = "/payments/{absent}";
    },
    (s) => {
      need(need(s.operations[0]).transport).path = "/payments/{paymentId}/{paymentId}";
    },
    (s) => {
      need(need(s.operations[0]).transport).path = "/payments/prefix{paymentId}";
    },
    (s) => {
      need(need(s.operations[0]).transport).path = "/payments/../{paymentId}";
    },
    (s) => {
      need(need(s.operations[0]).transport).path = "/payments//{paymentId}";
    },
    (s) => {
      need(need(s.operations[0]).transport).path = "/payments/{paymentId";
    },
    (s) => {
      need(need(s.operations[0]).input[0]).required = false;
    },
    (s) => {
      need(need(s.operations[0]).input[0]).nullable = true;
    },
    (s) => {
      need(s.operations[0]).input[0] = field("identity", ref("money"));
    },
    (s) => {
      need(need(s.operations[0]).transport).parameters.push({
        field: "verbose",
        in: "header",
        name: "x-trace",
      });
    },
    (s) => {
      need(need(need(s.operations[0]).transport).parameters[0]).field = "absent";
    },
    (s) => {
      need(need(s.operations[0]).transport).parameters.pop();
    },
    (s) => {
      need(need(need(s.operations[0]).transport).parameters[1]).name = "Content-Type";
    },
    (s) => {
      need(need(s.operations[0]).transport).request = {
        kind: "json",
        contentType: "application/json",
        fields: ["subtotal", "total", "address", "history", "trace"],
      };
    },
    (s) => {
      need(need(s.operations[0]).transport).method = "GET";
    },
    (s) => {
      need(need(need(s.operations[0]).transport).responses[0]).outcome = "absent";
    },
    (s) => {
      need(need(need(s.operations[0]).transport).responses[0]).status = 202;
    },
    (s) => {
      need(need(s.operations[0]).transport).responses.pop();
    },
    (s) => {
      need(need(need(s.operations[0]).outcomes)[0]).kind = "Rejection";
    },
    (s) => {
      need(need(need(s.operations[0]).transport).responses[0]).headers.push({
        field: "trace",
        name: "x-trace",
      });
    },
    (s) => {
      need(need(need(need(s.operations[0]).transport).responses[0]).headers[0]).field = "payment";
    },
    (s) => {
      need(need(need(need(s.operations[0]).transport).responses[0]).headers[0]).name =
        "Content-Length";
    },
    (s) => {
      need(need(need(s.operations[0]).transport).responses[0]).body = {
        kind: "json",
        contentType: "application/json",
        fields: ["absent"],
      };
    },
    (s) => {
      need(need(need(s.operations[1]).transport).responses[0]).status = 204;
      need(need(need(s.operations[1]).outcomes)[0]).status = 204;
    },
    (s) => {
      need(need(s.operations[1]).transport).method = "HEAD";
    },
    (s) => {
      need(need(s.operations[1]).transport).responses.push({ status: 200, headers: [] });
    },
    (s) => {
      need(need(s.operations[1]).transport).responses.push({
        outcome: "downloaded",
        status: 201,
        headers: [],
      });
    },
    (s) => {
      const duplicate = structuredClone(need(s.operations[0]));
      duplicate.id = "duplicate";
      need(duplicate.transport).path = "/payments/{otherId}";
      need(need(duplicate.transport).parameters[0]).name = "otherId";
      s.operations.push(duplicate);
    },
  ];
  for (const mutate of mutations) {
    const candidate = base();
    mutate(shapeOf(need(need(need(candidate.architecture).contracts)[0])));
    const original = base();
    need(original.architecture).contracts = [];
    const snapshot = structuredClone(original);
    expect(validateArchitectureContracts(candidate).some((f) => f.code === "CONFIG_INVALID")).toBe(
      true,
    );
    const report = exportContractJsonSchema(need(need(need(candidate.architecture).contracts)[0]));
    expect(report.ok).toBe(false);
    expect(report).not.toHaveProperty("schema");
    expect(commit(original, candidate).ok).toBe(false);
    expect(original).toEqual(snapshot);
  }
});

it("supports finite binary uploads and bodyless HTTP output without adding bytes to JSON contracts", () => {
  const c = definition();
  const s = shapeOf(c);
  s.operations = [need(s.operations[1])];
  const op = need(s.operations[0]);
  op.transport = {
    protocol: "http",
    method: "PUT",
    path: "/files/{id}",
    parameters: [{ field: "identity", in: "path", name: "id" }],
    request: { kind: "binary", contentType: "image/png", maxBytes: 1024 },
    responses: [{ status: 204, headers: [] }],
  };
  op.output = [];
  delete op.outcomes;
  expect(inspectContractTransport(s).ok).toBe(true);
  expect(schemaOf(c)["x-jeeves"]).toMatchObject({
    operations: [
      { transport: { request: { kind: "binary", maxBytes: 1024 }, responses: [{ status: 204 }] } },
    ],
  });
  op.transport.method = "HEAD";
  delete op.transport.request;
  expect(inspectContractTransport(s).ok).toBe(true);
});

it("exports standalone exact $defs consumed by an independent schema reader with map/union/nullable and presence semantics", () => {
  const c = definition();
  const schema = schemaOf(c);
  const money = { minor: 1250, currency: "USD" };
  const request = { subtotal: money, total: money, history: { created: [1, 2] } };
  const readRequest = reader(schema, "operation.pay.request");
  expect(readRequest.safeParse(request).success).toBe(true);
  expect(readRequest.safeParse({ ...request, address: null }).success).toBe(true);
  expect(readRequest.safeParse({ ...request, address: { line: "Street" } }).success).toBe(true);
  for (const invalid of [
    { ...request, subtotal: undefined },
    { ...request, total: null },
    { ...request, total: { minor: 1.5, currency: "USD" } },
    { ...request, total: { minor: 1000000, currency: "USD" } },
    { ...request, total: { minor: 1, currency: "EUR" } },
    { ...request, address: {} },
    { ...request, trace: "header must stay outside body" },
    { ...request, history: {} },
    { ...request, history: { a: [], b: [], c: [] } },
    { ...request, history: { ["x".repeat(21)]: [] } },
    { ...request, history: { "": [] } },
    { ...request, history: { a: [1, 2, 3] } },
    { ...request, history: { a: [6] } },
  ])
    expect(readRequest.safeParse(invalid).success, JSON.stringify(invalid)).toBe(false);
  const response = reader(schema, "operation.pay.response.0");
  for (const status of ["paid", "pending"])
    expect(response.safeParse({ payment: { status, amount: money } }).success).toBe(true);
  for (const invalid of [
    { status: "unknown", amount: money },
    { status: "paid" },
    { status: null, amount: money },
  ])
    expect(response.safeParse({ payment: invalid }).success).toBe(false);
  expect(schema.$defs?.["operation.pay.input"]?.properties?.subtotal).toEqual({
    $ref: "#/$defs/type.money@v1",
  });
  expect(schema.$defs?.["operation.pay.input"]?.properties?.total).toEqual({
    $ref: "#/$defs/type.money@v1",
  });
  // Also export a data root, including exact versions and nullable referenced targets.
  const data = structuredClone(c);
  data.kind = "data";
  need(data.shape).payload = need(need(data.shape).operations[0]).input;
  need(data.shape).operations = [];
  const logical = { identity: "p1", trace: "trace", ...request };
  expect(reader(schemaOf(data)).safeParse(logical).success).toBe(true);
  expect(reader(schemaOf(data)).safeParse({ ...logical, identity: undefined }).success).toBe(false);
  need(need(data.shape).types).push({
    id: "identity",
    version: "v2",
    name: "Nullable identity",
    description: "",
    value: { type: "text", nullable: true },
  });
  need(data.shape).payload[0] = field("identity", { ...ref("identity", "v2"), nullable: false });
  expect(reader(schemaOf(data)).safeParse({ ...logical, identity: null }).success).toBe(true);
  expect(schemaOf(data).$defs).toHaveProperty("type.identity@v1");
  expect(schemaOf(data).$defs).toHaveProperty("type.identity@v2");
  const renamed = structuredClone(data);
  need(need(need(renamed.shape).types)[0]).name = "Renamed label";
  expect(schemaOf(renamed)).toEqual(schemaOf(data));
});

it("exports diagnostics and the intact draft instead of a partial handoff schema", async () => {
  const design = base();
  const contract = need(need(need(design.architecture).contracts)[0]);
  need(shapeOf(contract).operations[0]).input[3] = field("subtotal", { type: "ref" });
  const snapshot = await buildArchitectureHandoff({
    design,
    project: { id: "draft", name: "Draft" },
    lookup: testLookup,
  });
  const exported = need(snapshot.contracts[0]);
  expect(exported.definition).toEqual(contract.shape);
  expect(exported).not.toHaveProperty("jsonSchema");
  expect(exported.schemaIssues).toContainEqual(expect.objectContaining({ code: "UNRESOLVED" }));
  expect(snapshot.openItems).toContainEqual(
    expect.objectContaining({
      critical: true,
      message: expect.stringContaining("UNRESOLVED_CONTRACT"),
    }),
  );
});

it("normalizes optional undefined properties to portable JSON without redacting typed semantics", async () => {
  const design = base();
  const contract = need(need(need(design.architecture).contracts)[0]);
  const operation = need(shapeOf(contract).operations[1]);
  need(operation.input[0]).nullable = undefined;
  need(operation.transport).request = undefined;
  const schema = schemaOf(contract);
  expect(schema).toEqual(JSON.parse(JSON.stringify(schema)));
  const snapshot = await buildArchitectureHandoff({
    design,
    project: { id: "optional", name: "Optional" },
    lookup: testLookup,
  });
  expect(need(snapshot.contracts[0]).definition).toEqual(
    JSON.parse(JSON.stringify(contract.shape)),
  );
  expect(need(snapshot.contracts[0]).jsonSchema).toEqual(schema);
});

it("refuses partial schema exports for unresolved, stale, cyclic, ambiguous or over-budget local types", () => {
  for (const mutate of [
    (s: ContractShape) => {
      need(s.operations[0]).input[3] = field("subtotal", { type: "unresolved" });
    },
    (s: ContractShape) => {
      need(s.operations[0]).input[3] = field("subtotal", ref("money", "v99"));
    },
    (s: ContractShape) => {
      need(s.types).push({
        id: "recursive",
        version: "v1",
        name: "Recursive",
        description: "",
        value: ref("recursive"),
      });
    },
    (s: ContractShape) => {
      need(need(need(need(s.types).find((t) => t.id === "pending")).value.fields)[0]).enumValues = [
        "paid",
      ];
    },
    (s: ContractShape) => {
      need(s.types).push({
        id: "n0",
        version: "v1",
        name: "Leaf",
        description: "",
        value: { type: "text" },
      });
      for (let i = 1; i <= 12; i++)
        need(s.types).push({
          id: `n${i}`,
          version: "v1",
          name: "Wide",
          description: "",
          value: {
            type: "object",
            fields: [field("left", ref(`n${i - 1}`)), field("right", ref(`n${i - 1}`))],
          },
        });
    },
  ]) {
    const c = definition();
    mutate(shapeOf(c));
    const result = exportContractJsonSchema(c);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("schema");
  }
});

it("retains typed schema names and semantic paths through library remapping, exact reuse, target diffs and deterministic handoff JSON", async () => {
  const source = base(undefined, true);
  const shape = shapeOf(need(need(need(source.architecture).contracts)[0]));
  need(shape.operations[0]).input.push(
    field("config", { type: "text", enumValues: ["/home/semantic/value"] }, false),
  );
  const request = need(need(need(shape.operations[0]).transport).request);
  if (request.kind === "json") request.fields.push("config");
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api"] },
    { id: "portable-payments", version: "1.0.0", name: "Portable", purpose: "Reuse" },
    testLookup,
  );
  const entry: ArchitectureLibraryEntry = {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "a".repeat(64),
    availability: "architecture only",
  };
  const empty = designSchema.parse({ schemaVersion: 2, revision: 0 });
  const insert = {
    id: entry.id,
    version: entry.version,
    contentHash: entry.contentHash,
    instanceId: "copy",
    baseRevision: 0,
    name: "Copy",
  };
  const preview = previewArchitectureTemplate(empty, entry, insert, testLookup);
  expect(preview.errors).toEqual([]);
  const applied = applyOperations(empty, preview.ops, testLookup);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return;
  const inserted = need(need(need(applied.design.architecture).contracts)[0]);
  expect(inserted.id).not.toBe("payments");
  expect(inserted.shape).toEqual(shape);
  const snapshot = await buildArchitectureHandoff({
    design: applied.design,
    project: { id: "transport", name: "Transport" },
    lookup: testLookup,
  });
  const portable = JSON.parse(handoffJson(snapshot));
  expect(portable.contracts[0].definition).toEqual(shape);
  expect(portable.contracts[0].jsonSchema).toEqual(schemaOf(inserted));
  expect(
    reader(portable.contracts[0].jsonSchema, "operation.pay.request").safeParse({
      subtotal: { minor: 1, currency: "USD" },
      total: { minor: 1, currency: "USD" },
      history: { a: [] },
      config: "/home/semantic/value",
    }).success,
  ).toBe(true);
  const references = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref") {
        expect(typeof child).toBe("string");
        let target: unknown = portable.contracts[0].jsonSchema;
        for (const segment of String(child).slice(2).split("/"))
          target = (target as Record<string, unknown>)[
            segment.replace(/~1/g, "/").replace(/~0/g, "~")
          ];
        expect(target).toBeDefined();
      } else references(child);
    }
  };
  references(portable.contracts[0].jsonSchema);
  expect(
    handoffJson(
      await buildArchitectureHandoff({
        design: applied.design,
        project: { id: "transport", name: "Transport" },
        lookup: testLookup,
      }),
    ),
  ).toBe(handoffJson(snapshot));
  const local = need(need(fragment.architecture.contracts)[0]).id;
  expect(
    previewArchitectureTemplate(
      applied.design,
      entry,
      {
        ...insert,
        instanceId: "again",
        baseRevision: applied.design.revision,
        definitions: { [local]: inserted.id },
      },
      testLookup,
    ).ok,
  ).toBe(true);
  const changed = structuredClone(applied.design);
  need(
    need(
      need(need(need(need(need(changed.architecture).contracts)[0]).shape).operations[1]).transport,
    ).responses[0],
  ).body = {
    kind: "binary",
    contentType: "image/png",
    maxBytes: 2048,
  };
  expect(targetChanges(applied.design, changed)).toContainEqual(
    expect.objectContaining({ path: `architecture/contracts/${inserted.id}@v1`, kind: "changed" }),
  );
  expect(await handoffFingerprint(changed, { id: "transport", name: "Transport" })).not.toBe(
    snapshot.designFingerprint,
  );
  expect(
    previewArchitectureTemplate(
      changed,
      entry,
      {
        ...insert,
        instanceId: "again",
        baseRevision: changed.revision,
        definitions: { [local]: inserted.id },
      },
      testLookup,
    ).ok,
  ).toBe(false);
});

it("protects transport semantics and referenced contract deletion across same-batch consumer migrations", () => {
  const before = base(undefined, true);
  const changed = structuredClone(before);
  need(changed.architecture).interfaces = [];
  need(
    need(
      need(need(need(need(need(changed.architecture).contracts)[0]).shape).operations[1]).transport,
    ).responses[0],
  ).body = {
    kind: "binary",
    contentType: "image/png",
    maxBytes: 2048,
  };
  expect(commit(before, changed).ok).toBe(false);
  // No local type references: removal must still preserve the consumed exact contract.
  const plain = base(
    architectureContractSchema.parse({
      id: "plain",
      version: "v1",
      name: "Plain",
      kind: "api",
      shape: {
        payload: [],
        operations: [
          {
            id: "read",
            name: "Read",
            input: [],
            output: [],
            transport: {
              protocol: "http",
              method: "GET",
              path: "/",
              parameters: [],
              responses: [{ status: 204, headers: [] }],
            },
          },
        ],
      },
    }),
    true,
  );
  const removed = structuredClone(plain);
  need(removed.architecture).interfaces = [];
  need(removed.architecture).contracts = [];
  expect(commit(plain, removed).ok).toBe(false);
  const successor = structuredClone(before);
  const v2 = structuredClone(need(need(need(changed.architecture).contracts)[0]));
  v2.version = "v2";
  need(need(successor.architecture).contracts).push(v2);
  need(need(need(successor.architecture).interfaces)[0]).contract.version = "v2";
  expect(commit(before, successor).ok).toBe(true);
  expect(need(need(successor.architecture).contracts)[0]).toEqual(
    need(need(before.architecture).contracts)[0],
  );
});

it("keeps source-backed legacy contracts authoritative, detects source changes and requires a new captured source version", async () => {
  const original = designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );
  const source = need(contractSources(original).find((s) => s.source.kind === "resource")).source;
  const contract = architectureContractSchema.parse({
    id: "legacy",
    version: "v1",
    name: "Legacy",
    kind: "data",
    source,
    sourceSnapshot: contractCanonical(resolveContractSource(original, source)),
    sourceDesignRevision: original.revision,
  });
  const next = structuredClone(original);
  next.architecture = {
    system: { name: "Legacy", description: "" },
    nodes: [],
    relationships: [],
    contracts: [contract],
  };
  const capture = commit(original, next);
  expect(capture.ok).toBe(true);
  if (!capture.ok) return;
  const saved = capture.design;
  for (const mutate of [
    (c: ArchitectureContract) => {
      delete c.source;
      delete c.sourceSnapshot;
      delete c.sourceDesignRevision;
      c.shape = { operations: [], payload: [field("fake", { type: "text" })] };
    },
    (c: ArchitectureContract) => {
      c.sourceSnapshot = "{}";
    },
    (c: ArchitectureContract) => {
      c.sourceDesignRevision = saved.revision;
    },
  ]) {
    const forged = structuredClone(saved);
    mutate(need(need(need(forged.architecture).contracts)[0]));
    expect(commit(saved, forged).ok).toBe(false);
  }
  const changed = structuredClone(saved);
  const attachment = need(
    need(changed.elements.find((e) => e.id === source.element)).attachments.find(
      (a) => a.id === source.attachment,
    ),
  );
  const resources = resourceConfigSchema.parse(attachment.config.model);
  need(need(resources.resources[0]).fields[0]).name = "changed";
  attachment.config.model = resources;
  const recaptured = structuredClone(changed);
  need(need(need(recaptured.architecture).contracts)[0]).sourceSnapshot = contractCanonical(
    resolveContractSource(changed, source),
  );
  need(need(need(recaptured.architecture).contracts)[0]).sourceDesignRevision = saved.revision;
  expect(commit(changed, recaptured).ok).toBe(false);
  need(recaptured.architecture).contracts = [
    contract,
    { ...need(need(need(recaptured.architecture).contracts)[0]), version: "v2" },
  ];
  expect(commit(changed, recaptured).ok).toBe(true);
  const report = exportContractJsonSchema(contract);
  expect(report).toMatchObject({ ok: false, issues: [{ code: "SOURCE_REFERENCE" }] });
  const handoff = await buildArchitectureHandoff({
    design: saved,
    project: { id: "legacy", name: "Legacy" },
    lookup: testLookup,
  });
  expect(need(handoff.contracts[0]).definition).toBeDefined();
  expect(handoff.contracts[0]).not.toHaveProperty("jsonSchema");
  expect(need(need(saved.architecture).contracts)[0]).toEqual(contract);
});

it("exposes typed transports and binary limits in the chat operation schema and leaves nested legacy contracts unchanged", () => {
  const schema = JSON.stringify(operationBatchJsonSchema());
  for (const key of [
    "transport",
    "protocol",
    "parameters",
    "responses",
    "outcome",
    "contentType",
    "maxBytes",
    "binary",
    "types",
    "discriminator",
  ])
    expect(schema).toContain(`"${key}"`);
  const old = architectureContractSchema.parse({
    id: "nested",
    version: "v1",
    name: "Nested",
    kind: "event",
    shape: {
      payload: [
        field("items", {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            fields: [field("label", { type: "text", nullable: true }, false)],
          },
        }),
      ],
      operations: [],
    },
  });
  expect(architectureContractSchema.parse(JSON.parse(JSON.stringify(old)))).toEqual(old);
  expect(old.shape).not.toHaveProperty("types");
  expect(
    reader(schemaOf(old)).safeParse({ items: [{}, { label: null }, { label: "hello" }] }).success,
  ).toBe(true);
  expect(reader(schemaOf(old)).safeParse({ items: [{ label: 42 }] }).success).toBe(false);
});
