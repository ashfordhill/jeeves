import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBenchmarkLedger } from "./benchmark.ts";
import {
  type BenchmarkFixtureContract,
  backendAcceptanceCatalog,
  backendAcceptanceCatalogSchema,
  backendBehaviorRequirements,
  benchmarkFixtureUnavailable,
  parseBenchmarkFixture,
} from "./benchmark-fixtures.ts";
import {
  BENCHMARK_REPLAY_SECONDS,
  benchmarkCommandIdentitySchema,
  benchmarkCredentialsSchema,
  benchmarkCursorSchema,
  benchmarkErrorSchema,
  benchmarkExpectedVersionSchema,
  benchmarkHeadersSchema,
  benchmarkIdempotencyKeySchema,
  benchmarkMutationProtectionSchema,
  benchmarkPageQuerySchema,
  benchmarkPageSchema,
  benchmarkProtocolComponents,
  benchmarkSessionIdentitySchema,
  benchmarkSessionSecurityScheme,
} from "./benchmark-protocol.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const example = () => read("../../../benchmarks/protocol/v1/synthetic.json");
const token = z.strictObject({
  id: z.uuid(),
  label: z.string().min(1).max(80),
  version: benchmarkExpectedVersionSchema,
});
const params = z.strictObject({ scopeId: z.uuid() });
const empty = z.strictObject({});
const contract = (): BenchmarkFixtureContract => ({
  operations: [
    {
      id: "createToken",
      method: "POST",
      path: "/api/scopes/{scopeId}/tokens",
      authentication: "session",
      idempotency: "required",
      input: {
        params,
        query: empty,
        body: z.strictObject({
          label: z.string().min(1).max(80),
          expectedVersion: benchmarkExpectedVersionSchema,
        }),
      },
      responses: { 201: token },
      errors: [400, 401, 403, 404, 409, 422, 503],
    },
    {
      id: "listTokens",
      method: "GET",
      path: "/api/scopes/{scopeId}/tokens",
      authentication: "session",
      idempotency: "none",
      input: { params, query: benchmarkPageQuerySchema, body: z.null() },
      responses: { 200: benchmarkPageSchema(token) },
      errors: [400, 401, 404],
    },
  ],
  datasets: { tokens: token },
  controls: {
    inspectTokens: {
      kind: "inspection",
      input: params,
      output: z.strictObject({ tokens: z.int().nonnegative(), receipts: z.int().nonnegative() }),
    },
  },
});

describe("independent benchmark protocol", () => {
  it("validates a tiny synthetic protocol pack without producing evidence", async () => {
    const fixture = await parseBenchmarkFixture(example(), contract());
    expect(fixture.profile).toBe("protocol-synthetic");
    expect(fixture.observations).toHaveLength(4);
    expect(backendBehaviorRequirements(backendAcceptanceCatalog(fixture))).toEqual([
      {
        id: "backend:protocol-synthetic:v1:createToken",
        acceptance: ["T01-create", "T01-denied", "T01-replay"],
      },
      { id: "backend:protocol-synthetic:v1:listTokens", acceptance: ["T02-page"] },
    ]);
    for (const status of ["not-run", "blocked"] as const) {
      const report = benchmarkFixtureUnavailable(
        fixture,
        status,
        "Synthetic application deliberately absent",
      );
      expect(report.observations).toHaveLength(4);
      expect(report.observations.every((o) => o.status === status)).toBe(true);
      expect(report).not.toHaveProperty("points");
    }
    expect(() => benchmarkFixtureUnavailable(fixture, "passed" as "not-run", "absent")).toThrow(
      "cannot be a pass",
    );
    expect(() => benchmarkFixtureUnavailable(fixture, "not-run", " ")).toThrow();
  });

  it.each([
    [
      "unknown-field",
      (f: ReturnType<typeof example>) => {
        f.requests[0].input.body.role = "administrator";
      },
    ],
    [
      "bad-success-payload",
      (f: ReturnType<typeof example>) => {
        f.requests[0].expected.body.version = 0;
      },
    ],
    [
      "bad-error-payload",
      (f: ReturnType<typeof example>) => {
        f.requests[2].expected.body.privateTitle = "secret";
      },
    ],
    [
      "error-status",
      (f: ReturnType<typeof example>) => {
        f.requests[2].expected.status = 404;
      },
    ],
    [
      "correlation",
      (f: ReturnType<typeof example>) => {
        f.requests[2].expected.body.correlationId = "other";
      },
    ],
    [
      "duplicate-request",
      (f: ReturnType<typeof example>) => {
        f.requests.push(f.requests[0]);
      },
    ],
    [
      "duplicate-observation",
      (f: ReturnType<typeof example>) => {
        f.observations.push(f.observations[0]);
      },
    ],
    [
      "foreign-case",
      (f: ReturnType<typeof example>) => {
        f.observations[0].caseId = "D01";
      },
    ],
    [
      "foreign-operation",
      (f: ReturnType<typeof example>) => {
        f.observations[0].operationIds = ["notRegistered"];
      },
    ],
    [
      "missing-observation",
      (f: ReturnType<typeof example>) => {
        f.scenarios[0].steps[0].observationIds = [];
      },
    ],
    [
      "missing-assertion",
      (f: ReturnType<typeof example>) => {
        f.scenarios[0].steps[0].assertions = [];
      },
    ],
    [
      "wrong-assertion",
      (f: ReturnType<typeof example>) => {
        f.scenarios[0].steps[0].assertions[0].value = 9;
      },
    ],
    [
      "negative-accepted",
      (f: ReturnType<typeof example>) => {
        f.negativePayloads[0].value = f.requests[0].input.body;
      },
    ],
    [
      "unknown-control",
      (f: ReturnType<typeof example>) => {
        f.scenarios[0].steps[2].controlId = "publicInspectionRoute";
      },
    ],
    [
      "bad-state-expectation",
      (f: ReturnType<typeof example>) => {
        f.scenarios[0].steps[2].expected.tokens = -1;
      },
    ],
    [
      "orphan-request",
      (f: ReturnType<typeof example>) => {
        f.scenarios[0].steps.pop();
      },
    ],
    [
      "unknown-actor",
      (f: ReturnType<typeof example>) => {
        f.requests[0].actor = "mallory";
      },
    ],
    [
      "missing-key",
      (f: ReturnType<typeof example>) => {
        delete f.requests[0].input.headers["idempotency-key"];
      },
    ],
    [
      "header-injection",
      (f: ReturnType<typeof example>) => {
        f.requests[0].input.headers["idempotency-key"] = "key\r\nx: y";
      },
    ],
    [
      "schema-version",
      (f: ReturnType<typeof example>) => {
        f.schemaVersion = 2;
      },
    ],
  ])("rejects invalid fixture %s", async (_, mutate) => {
    const fixture = example();
    mutate(fixture);
    await expect(parseBenchmarkFixture(fixture, contract())).rejects.toThrow();
  });

  it("rejects duplicate IDs and equivalent parameterized routes in independent contracts", async () => {
    const c = contract();
    const first = c.operations.at(0);
    if (!first) throw new Error("Missing independent operation");
    c.operations.push(first);
    await expect(parseBenchmarkFixture(example(), c)).rejects.toThrow("Duplicate operation");
    c.operations[2] = {
      ...first,
      id: "other",
      path: "/api/scopes/{differentId}/tokens",
    };
    await expect(parseBenchmarkFixture(example(), c)).rejects.toThrow("Duplicate route");
  });
  it("represents lost responses and concurrent requests without claiming they ran", async () => {
    const fixture = example();
    fixture.requests[0].expected = { outcome: "connection-lost" };
    fixture.scenarios[0].steps[0].assertions = [
      { kind: "equals", path: ["outcome"], value: "connection-lost" },
    ];
    await expect(parseBenchmarkFixture(fixture, contract())).resolves.toBeDefined();
    const concurrent = example();
    concurrent.scenarios[0].steps.splice(0, 2, {
      kind: "parallel",
      id: "race",
      requestIds: ["create", "replay"],
      observationIds: ["T01-create", "T01-replay"],
      assertions: [
        { kind: "equals", path: ["create", "id"], value: concurrent.requests[0].expected.body.id },
        { kind: "equals", path: ["replay", "id"], value: concurrent.requests[0].expected.body.id },
      ],
    });
    await expect(parseBenchmarkFixture(concurrent, contract())).resolves.toBeDefined();
    concurrent.scenarios[0].steps[0].requestIds.push("create");
    await expect(parseBenchmarkFixture(concurrent, contract())).rejects.toThrow(
      "Duplicate parallel request",
    );
  });
  it("validates explicit malformed-request examples and rejects undeclared domain codes", async () => {
    const fixture = example();
    fixture.requests[0].validInput = false;
    fixture.requests[0].input.body.role = "administrator";
    fixture.requests[0].expected = structuredClone(fixture.requests[2].expected);
    fixture.requests[0].expected.status = 400;
    fixture.requests[0].expected.body.code = "INVALID_INPUT";
    fixture.scenarios[0].steps[0].assertions = [
      { kind: "equals", path: ["code"], value: "INVALID_INPUT" },
    ];
    await expect(parseBenchmarkFixture(fixture, contract())).resolves.toBeDefined();
    fixture.requests[0].expected.body.code = "CUSTOM_FAILURE";
    await expect(parseBenchmarkFixture(fixture, contract())).rejects.toThrow(
      "Error code/status mismatch",
    );
    const c = contract();
    const op = c.operations.at(0);
    if (!op) throw new Error("Missing independent operation");
    op.errorCodes = { CUSTOM_FAILURE: 400 };
    fixture.scenarios[0].steps[0].assertions[0].value = "CUSTOM_FAILURE";
    await expect(parseBenchmarkFixture(fixture, c)).resolves.toBeDefined();
  });
  it("permits declared byte and no-content response contracts with common safe headers", async () => {
    const fixture = example();
    const c = contract();
    const op = c.operations.at(1);
    if (!op) throw new Error("Missing independent operation");
    op.responses = { 204: z.null() };
    op.responseHeaders = { 204: z.object({ "cache-control": z.literal("no-store") }) };
    fixture.requests[3].expected.status = 204;
    fixture.requests[3].expected.body = null;
    delete fixture.requests[3].expected.headers["content-type"];
    fixture.scenarios[0].steps[4].assertions = [{ kind: "equals", path: [], value: null }];
    await expect(parseBenchmarkFixture(fixture, c)).resolves.toBeDefined();
    op.responses = {
      200: z.strictObject({ fixtureFile: z.literal("example.txt"), size: z.literal(7) }),
    };
    op.responseHeaders = { 200: z.object({ "content-type": z.literal("text/plain") }) };
    fixture.requests[3].expected.status = 200;
    fixture.requests[3].expected.body = { fixtureFile: "example.txt", size: 7 };
    fixture.requests[3].expected.headers["content-type"] = "text/plain";
    fixture.scenarios[0].steps[4].assertions = [{ kind: "equals", path: ["size"], value: 7 }];
    await expect(parseBenchmarkFixture(fixture, c)).resolves.toBeDefined();
  });

  it("requires frozen ledger identity and complete mandatory observations for real apps", async () => {
    const ledger = await parseBenchmarkLedger(
      read("../../../benchmarks/discourse-core/v1/manifest.json"),
      read("../../../benchmarks/discourse-core/v1/requirements.json"),
      read("../../../benchmarks/discourse-core/v1/integrity.json"),
    );
    const fixture = example();
    fixture.profile = "discourse-core";
    await expect(parseBenchmarkFixture(fixture, contract())).rejects.toThrow(
      "require a frozen ledger",
    );
    await expect(parseBenchmarkFixture(fixture, contract(), ledger)).rejects.toThrow(
      "Foreign/stale",
    );
    fixture.ledgerHashes = { ...ledger.integrity };
    delete fixture.ledgerHashes.algorithm;
    await expect(parseBenchmarkFixture(fixture, contract(), ledger)).rejects.toThrow(
      "Missing or unregistered",
    );
    await expect(parseBenchmarkFixture(example(), contract(), ledger)).rejects.toThrow(
      "cannot bind a scored ledger",
    );
  });

  it("rejects duplicate and foreign observation registrations", () => {
    const catalog = {
      profile: "discourse-core",
      version: "v1",
      observations: [{ id: "D01-session-cycle", caseId: "D01", operationIds: ["login"] }],
    };
    expect(backendAcceptanceCatalogSchema.safeParse(catalog).success).toBe(true);
    expect(
      backendAcceptanceCatalogSchema.safeParse({
        ...catalog,
        observations: [...catalog.observations, ...catalog.observations],
      }).success,
    ).toBe(false);
    expect(
      backendAcceptanceCatalogSchema.safeParse({ ...catalog, profile: "vendure-core" }).success,
    ).toBe(false);
  });

  it("bounds errors, command identities, cursors, fields, versions and pages", () => {
    expect(BENCHMARK_REPLAY_SECONDS).toBe(604800);
    for (const key of ["", "a".repeat(129), "space key", "a/b", "line\nbreak"])
      expect(benchmarkIdempotencyKeySchema.safeParse(key).success).toBe(false);
    expect(benchmarkIdempotencyKeySchema.safeParse("checkout-001:retry").success).toBe(true);
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(benchmarkExpectedVersionSchema.safeParse(value).success).toBe(false);
    expect(benchmarkCursorSchema.safeParse("_valid-base64url-001").success).toBe(true);
    for (const cursor of ["", "a/b", "a".repeat(2049)])
      expect(benchmarkCursorSchema.safeParse(cursor).success).toBe(false);
    expect(benchmarkPageQuerySchema.parse({})).toEqual({}); // Default 25 belongs to the adapter contract.
    for (const query of [{ limit: 0 }, { limit: 101 }, { limit: "25" }, { scopeId: "forged" }])
      expect(benchmarkPageQuerySchema.safeParse(query).success).toBe(false);
    expect(
      benchmarkPageSchema(token).safeParse({ items: [], nextCursor: null, total: 100 }).success,
    ).toBe(false);
    expect(benchmarkHeadersSchema.safeParse({ Cookie: "raw" }).success).toBe(false);
    const error = example().requests[2].expected.body;
    expect(
      benchmarkErrorSchema.safeParse({
        ...error,
        fieldErrors: Array(21).fill({ field: "title", message: "Invalid" }),
      }).success,
    ).toBe(false);
    expect(benchmarkErrorSchema.safeParse({ ...error, stack: "private" }).success).toBe(false);
    const identity = {
      profile: "discourse-core",
      version: "v1",
      operationId: "createTopic",
      scopeId: example().scopes[0],
      principalId: example().actors[0].principalId,
      key: "request-001",
    };
    expect(benchmarkCommandIdentitySchema.safeParse(identity).success).toBe(true);
    expect(
      benchmarkCommandIdentitySchema.safeParse({ ...identity, role: "administrator" }).success,
    ).toBe(false);
  });
  it("reuses session contracts and bounds authentication transport without granting authority", () => {
    const credentials = { email: "alice@example.test", password: "local-fixture-only" };
    expect(benchmarkCredentialsSchema.safeParse(credentials).success).toBe(true);
    expect(benchmarkCredentialsSchema.safeParse({ ...credentials, role: "admin" }).success).toBe(
      false,
    );
    expect(
      benchmarkSessionIdentitySchema.safeParse({
        id: example().actors[0].principalId,
        csrfToken: "a".repeat(64),
      }).success,
    ).toBe(true);
    expect(
      benchmarkMutationProtectionSchema.safeParse({
        origin: "http://127.0.0.1:4301",
        "x-csrf-token": "a".repeat(64),
      }).success,
    ).toBe(true);
    for (const origin of [
      "null",
      "https://example.test/path",
      "https://example.test/",
      "file:///tmp",
    ]) {
      expect(
        benchmarkMutationProtectionSchema.safeParse({ origin, "x-csrf-token": "a".repeat(64) })
          .success,
      ).toBe(false);
    }
    expect(benchmarkSessionSecurityScheme(`jeeves_session_${"a".repeat(32)}`)).toEqual({
      type: "apiKey",
      in: "cookie",
      name: `jeeves_session_${"a".repeat(32)}`,
    });
    expect(() => benchmarkSessionSecurityScheme("session")).toThrow();
  });

  it("keeps the portable OpenAPI components equal to the independent protocol schemas", () => {
    const document = read("../../../benchmarks/protocol/v1/components.openapi.json");
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths).toEqual({});
    expect(document.components).toEqual(benchmarkProtocolComponents());
  });
});
