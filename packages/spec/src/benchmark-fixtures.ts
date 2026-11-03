/** Fixed, inspectable acceptance inputs/expectations; no runner or application implementation. */
import { z } from "zod";
import { type BenchmarkLedger, benchmarkCanonical, parseBenchmarkLedger } from "./benchmark.ts";
import {
  benchmarkErrorCodes,
  benchmarkErrorSchema,
  benchmarkErrorStatuses,
  benchmarkHeadersSchema,
  benchmarkIdempotencyKeySchema,
  benchmarkMutationProtectionSchema,
  benchmarkResponseHeadersSchema,
} from "./benchmark-protocol.ts";

const name = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{0,127}$/);
const text = z.string().trim().min(1).max(4000);
const version = z.string().regex(/^v[1-9]\d*$/);
const profile = z.enum(["discourse-core", "vendure-core", "zammad-core", "protocol-synthetic"]);
const prefix = {
  "discourse-core": "D",
  "vendure-core": "V",
  "zammad-core": "Z",
  "protocol-synthetic": "T",
};
const caseId = z.string().regex(/^[DVZT]\d{2}$/);
const observationId = z.string().regex(/^[DVZT]\d{2}-[a-z][a-z0-9-]*$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
// JSON is bounded before contract validation; no executable expressions or opaque evaluator.
function jsonSchema(depth: number): z.ZodType<Json> {
  const scalar = [z.null(), z.boolean(), z.number().finite(), z.string().max(65536)] as const;
  return depth === 0
    ? z.union(scalar)
    : z.union([
        ...scalar,
        z.array(jsonSchema(depth - 1)).max(1000),
        z
          .record(z.string().max(160), jsonSchema(depth - 1))
          .refine((v) => Object.keys(v).length <= 100),
      ]);
}
const json = jsonSchema(8);
const observation = z.strictObject({
  id: observationId,
  caseId,
  operationIds: z.array(name).min(1).max(100),
});
const assertion = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("equals"),
    path: z.array(z.union([name, z.int().nonnegative()])).max(20),
    value: json,
  }),
  z.strictObject({
    kind: z.literal("absent"),
    path: z
      .array(z.union([name, z.int().nonnegative()]))
      .min(1)
      .max(20),
  }),
]);
const request = z.strictObject({
  id: name,
  operationId: name,
  actor: name,
  validInput: z.boolean(),
  input: z.strictObject({ params: json, query: json, body: json, headers: benchmarkHeadersSchema }),
  expected: z.union([
    z.strictObject({
      status: z.int().min(200).max(599),
      headers: benchmarkResponseHeadersSchema,
      body: json,
    }),
    z.strictObject({ outcome: z.literal("connection-lost") }),
  ]),
});
const step = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("request"),
    id: name,
    requestId: name,
    observationIds: z.array(observationId).max(100),
    assertions: z.array(assertion).max(100),
  }),
  z.strictObject({
    kind: z.literal("parallel"),
    id: name,
    requestIds: z.array(name).min(2).max(100),
    observationIds: z.array(observationId).max(100),
    assertions: z.array(assertion).max(100),
  }),
  z.strictObject({
    kind: z.literal("control"),
    id: name,
    controlId: name,
    input: json,
    expected: json,
    observationIds: z.array(observationId).max(100),
    assertions: z.array(assertion).max(100),
  }),
]);
export const benchmarkFixtureSchema = z.strictObject({
  schemaVersion: z.literal(1),
  protocolVersion: z.literal("v1"),
  profile,
  version,
  fixtureVersion: version,
  ledgerHashes: z.strictObject({ manifest: hash, requirements: hash }).nullable(),
  seed: text,
  scopes: z.array(z.uuid()).min(1).max(20),
  actors: z
    .array(
      z.strictObject({
        id: name,
        kind: z.enum(["anonymous", "ordinary", "privileged", "revoked", "provider"]),
        principalId: z.uuid().nullable(),
        scopeId: z.uuid().nullable(),
      }),
    )
    .min(1)
    .max(100),
  datasets: z.array(z.strictObject({ id: name, rows: z.array(json).max(1000) })).max(100),
  observations: z.array(observation).min(1).max(1000),
  requests: z.array(request).min(1).max(2000),
  negativePayloads: z
    .array(
      z.strictObject({
        id: name,
        operationId: name,
        part: z.enum(["params", "query", "body"]),
        value: json,
      }),
    )
    .min(1)
    .max(1000),
  scenarios: z
    .array(z.strictObject({ id: name, description: text, steps: z.array(step).min(1).max(200) }))
    .min(1)
    .max(100),
});
export type BenchmarkFixture = z.infer<typeof benchmarkFixtureSchema>;
/** Contracts are authored in the acceptance pack before runtime code. Export their JSON Schemas to OpenAPI. */
export type BenchmarkProtocolOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  authentication: "public" | "session" | "provider";
  idempotency: "required" | "none" | "provider";
  input: { params: z.ZodType; query: z.ZodType; body: z.ZodType };
  responses: Record<number, z.ZodType>;
  /** Additional headers/content types for bytes, sessions or no-content responses, by status. */
  responseHeaders?: Record<number, z.ZodType>;
  errors: (typeof benchmarkErrorStatuses)[number][];
  /** Domain codes must be declared; common code meanings cannot be changed. */
  errorCodes?: Record<string, (typeof benchmarkErrorStatuses)[number]>;
};
export type BenchmarkFixtureContract = {
  operations: BenchmarkProtocolOperation[];
  datasets: Record<string, z.ZodType>;
  /** Privileged fixture support only: worker, fault, clock, provider or authoritative inspection. */
  controls: Record<
    string,
    {
      kind: "worker" | "fault" | "clock" | "provider" | "inspection";
      input: z.ZodType;
      output: z.ZodType;
    }
  >;
};
function unique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label}`);
}
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function validateAssertions(assertions: z.infer<typeof assertion>[], expected: Json) {
  for (const a of assertions) {
    let value: Json | undefined = expected;
    for (const part of a.path) {
      value =
        value !== null && typeof value === "object" && Object.hasOwn(value, part)
          ? (value as Record<string | number, Json>)[part]
          : undefined;
    }
    requireThat(
      a.kind === "absent"
        ? value === undefined
        : value !== undefined && benchmarkCanonical(value) === benchmarkCanonical(a.value),
      "Assertion contradicts fixed expectation",
    );
  }
}

/** Revalidate pinned ledgers, payloads and all cross-references. No SQL, HTTP, providers or scoring. */
export async function parseBenchmarkFixture(
  input: unknown,
  contract: BenchmarkFixtureContract,
  ledger?: BenchmarkLedger,
): Promise<BenchmarkFixture> {
  const fixture = benchmarkFixtureSchema.parse(input);
  if (fixture.profile === "protocol-synthetic") {
    requireThat(
      !ledger && fixture.ledgerHashes === null,
      "Synthetic fixtures cannot bind a scored ledger",
    );
  } else {
    requireThat(ledger, "Application fixtures require a frozen ledger");
    const pinned = await parseBenchmarkLedger(
      ledger.manifest,
      ledger.requirements,
      ledger.integrity,
    );
    requireThat(
      fixture.profile === pinned.manifest.profile &&
        fixture.version === pinned.manifest.version &&
        fixture.fixtureVersion === pinned.manifest.fixtureVersion &&
        fixture.ledgerHashes?.manifest === pinned.integrity.manifest &&
        fixture.ledgerHashes?.requirements === pinned.integrity.requirements,
      "Foreign/stale fixture identity",
    );
    const required = pinned.requirements.observations;
    requireThat(
      fixture.observations.length === required.length &&
        fixture.observations.every((o) =>
          required.some((r) => r.id === o.id && r.caseId === o.caseId),
        ),
      "Missing or unregistered ledger observations",
    );
    requireThat(
      fixture.scopes.length >= 2 &&
        ["anonymous", "privileged", "revoked"].every((kind) =>
          fixture.actors.some((a) => a.kind === kind),
        ) &&
        fixture.actors.filter((a) => a.kind === "ordinary").length >= 2 &&
        new Set(
          fixture.actors
            .filter((a) => a.kind === "ordinary")
            .map((a) => a.scopeId)
            .filter(Boolean),
        ).size >= 2,
      "Application fixtures need isolated scopes and ordinary/privileged/revoked/anonymous actors",
    );
  }
  unique(fixture.scopes, "scope");
  unique(
    fixture.actors.map((a) => a.id),
    "actor",
  );
  unique(
    fixture.actors.flatMap((a) => (a.principalId ? [a.principalId] : [])),
    "principal",
  );
  for (const actor of fixture.actors) {
    requireThat(
      actor.scopeId === null || fixture.scopes.includes(actor.scopeId),
      "Unknown actor scope",
    );
    requireThat(
      actor.kind === "anonymous"
        ? actor.principalId === null && actor.scopeId === null
        : !!actor.principalId,
      "Invalid actor identity",
    );
  }
  unique(
    contract.operations.map((o) => o.id),
    "operation ID",
  );
  unique(
    contract.operations.map((o) => `${o.method} ${o.path.replace(/\{[^}]+\}/g, "{}")}`),
    "route",
  );
  for (const op of contract.operations) {
    name.parse(op.id);
    z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).parse(op.method);
    z.enum(["public", "session", "provider"]).parse(op.authentication);
    z.enum(["required", "none", "provider"]).parse(op.idempotency);
    requireThat(
      /^\/(?:[A-Za-z0-9._~-]+|\{[A-Za-z][A-Za-z0-9]*\})(?:\/(?:[A-Za-z0-9._~-]+|\{[A-Za-z][A-Za-z0-9]*\}))*$/.test(
        op.path,
      ),
      "Invalid contract route",
    );
    unique(Object.keys(op.responses), "response status");
    requireThat(
      Object.keys(op.responses).length > 0 &&
        Object.keys(op.responses).every((s) => +s >= 200 && +s < 300),
      "Declare success responses separately from errors",
    );
    unique(op.errors.map(String), "error status");
    for (const [code, status] of Object.entries(op.errorCodes ?? {})) {
      benchmarkErrorSchema.shape.code.parse(code);
      const common = benchmarkErrorCodes[code as keyof typeof benchmarkErrorCodes];
      requireThat(
        op.errors.includes(status) && (common === undefined || common === status),
        "Invalid declared error code",
      );
    }
    requireThat(
      op.errors.every((s) => benchmarkErrorStatuses.includes(s)),
      "Undeclared protocol error status",
    );
    requireThat(
      op.method !== "GET" || op.idempotency === "none",
      "Reads cannot declare command idempotency",
    );
    requireThat(
      op.method === "GET" || op.authentication !== "session" || op.idempotency === "required",
      "Session commands require idempotency",
    );
  }
  const operation = (id: string) => {
    const op = contract.operations.find((o) => o.id === id);
    requireThat(op, `Unregistered operation ${id}`);
    return op;
  };
  unique(
    fixture.datasets.map((d) => d.id),
    "dataset",
  );
  for (const dataset of fixture.datasets) {
    const schema = contract.datasets[dataset.id];
    requireThat(schema, `Unregistered dataset ${dataset.id}`);
    for (const row of dataset.rows) schema.parse(row);
  }
  unique(
    fixture.observations.map((o) => o.id),
    "observation",
  );
  for (const o of fixture.observations) {
    requireThat(
      o.caseId.startsWith(prefix[fixture.profile]) && o.id.startsWith(`${o.caseId}-`),
      "Foreign case/observation identity",
    );
    unique(o.operationIds, "observation operation");
    for (const id of o.operationIds) operation(id);
  }
  unique(
    fixture.requests.map((r) => r.id),
    "request",
  );
  for (const r of fixture.requests) {
    const op = operation(r.operationId);
    requireThat(
      fixture.actors.some((a) => a.id === r.actor),
      `Unknown request actor ${r.actor}`,
    );
    const valid =
      (["params", "query", "body"] as const).every(
        (part) => op.input[part].safeParse(r.input[part]).success,
      ) &&
      (op.idempotency !== "required" ||
        benchmarkIdempotencyKeySchema.safeParse(r.input.headers["idempotency-key"]).success);
    requireThat(r.validInput === valid, "Request input validity contradicts contract");
    requireThat(
      r.validInput || ("status" in r.expected && r.expected.status === 400),
      "Invalid input requires HTTP 400",
    );
    if (!("status" in r.expected)) continue;
    if (op.authentication === "session" && op.method !== "GET" && r.expected.status < 300)
      benchmarkMutationProtectionSchema.parse(r.input.headers);
    const response = op.responses[r.expected.status];
    const headers = op.responseHeaders?.[r.expected.status];
    if (headers) headers.parse(r.expected.headers);
    else
      requireThat(
        r.expected.headers["content-type"] === "application/json",
        "Expected JSON content type",
      );
    if (response) response.parse(r.expected.body);
    else {
      requireThat(
        r.expected.headers["content-type"] === "application/json",
        "Errors require JSON content type",
      );
      requireThat(
        op.errors.includes(r.expected.status as (typeof benchmarkErrorStatuses)[number]),
        "Undeclared response status",
      );
      const error = benchmarkErrorSchema.parse(r.expected.body);
      const commonStatus = benchmarkErrorCodes[error.code as keyof typeof benchmarkErrorCodes];
      requireThat(
        (commonStatus ?? op.errorCodes?.[error.code]) === r.expected.status,
        "Error code/status mismatch",
      );
      requireThat(
        error.correlationId === r.expected.headers["x-correlation-id"],
        "Error correlation mismatch",
      );
    }
  }
  unique(
    fixture.negativePayloads.map((p) => p.id),
    "negative payload",
  );
  for (const p of fixture.negativePayloads)
    requireThat(
      !operation(p.operationId).input[p.part].safeParse(p.value).success,
      `Negative payload accepted: ${p.id}`,
    );
  unique(
    fixture.scenarios.map((s) => s.id),
    "scenario",
  );
  const usedRequests = new Set<string>();
  const observed = new Map<string, Set<string>>();
  for (const scenario of fixture.scenarios) {
    unique(
      scenario.steps.map((s) => s.id),
      "scenario step",
    );
    for (const s of scenario.steps) {
      unique(s.observationIds, "step observation");
      requireThat(
        s.observationIds.length === 0 || s.assertions.length > 0,
        "Observation needs explicit assertions",
      );
      if (s.kind === "request" || s.kind === "parallel") {
        const requestIds = s.kind === "request" ? [s.requestId] : s.requestIds;
        unique(requestIds, "parallel request");
        const requests = requestIds.map((id) => {
          const r = fixture.requests.find((r) => r.id === id);
          requireThat(r, `Unknown scenario request ${id}`);
          usedRequests.add(r.id);
          return r;
        });
        const expectedBody = (r: (typeof requests)[number]) =>
          "body" in r.expected ? r.expected.body : r.expected;
        validateAssertions(
          s.assertions,
          s.kind === "request"
            ? expectedBody(requests[0] as (typeof requests)[number])
            : Object.fromEntries(requests.map((r) => [r.id, expectedBody(r)])),
        );
        for (const id of s.observationIds) {
          const o = fixture.observations.find((o) => o.id === id);
          requireThat(
            o && requests.some((r) => o.operationIds.includes(r.operationId)),
            "Observation does not own request operation",
          );
          const ops = observed.get(id) ?? new Set<string>();
          for (const r of requests)
            if (o.operationIds.includes(r.operationId)) ops.add(r.operationId);
          observed.set(id, ops);
        }
      } else {
        const control = contract.controls[s.controlId];
        requireThat(control, `Unregistered fixture control ${s.controlId}`);
        control.input.parse(s.input);
        control.output.parse(s.expected);
        validateAssertions(s.assertions, s.expected);
        for (const id of s.observationIds)
          requireThat(
            fixture.observations.some((o) => o.id === id),
            "Unknown control observation",
          );
      }
    }
  }
  requireThat(usedRequests.size === fixture.requests.length, "Orphan request fixture");
  for (const o of fixture.observations)
    requireThat(
      o.operationIds.every((id) => observed.get(o.id)?.has(id)),
      `Missing scenario observation ${o.id}`,
    );
  return fixture;
}

/** Explicit absence planning, deliberately incapable of producing passed evidence. */
export function benchmarkFixtureUnavailable(
  fixture: BenchmarkFixture,
  status: "not-run" | "blocked",
  reason: string,
) {
  text.parse(reason);
  requireThat(status === "not-run" || status === "blocked", "Absence cannot be a pass");
  return {
    profile: fixture.profile,
    version: fixture.version,
    reason,
    observations: fixture.observations.map((o) => ({ id: o.id, caseId: o.caseId, status })),
  };
}

export function backendBehaviorId(profileId: string, versionId: string, operationId: string) {
  return `backend:${profile.parse(profileId)}:${version.parse(versionId)}:${name.parse(operationId)}`;
}
/** Explicit registration only; a backend namespace never grants access to legacy extensions/events. */
export const backendAcceptanceCatalogSchema = z
  .strictObject({ profile, version, observations: z.array(observation).min(1).max(1000) })
  .superRefine((catalog, ctx) => {
    const ids = catalog.observations.map((o) => o.id);
    if (
      new Set(ids).size !== ids.length ||
      catalog.observations.some(
        (o) =>
          !o.caseId.startsWith(prefix[catalog.profile]) ||
          !o.id.startsWith(`${o.caseId}-`) ||
          new Set(o.operationIds).size !== o.operationIds.length,
      )
    )
      ctx.addIssue({ code: "custom", message: "Duplicate or foreign backend acceptance identity" });
  });
export type BackendAcceptanceCatalog = z.infer<typeof backendAcceptanceCatalogSchema>;
export function backendAcceptanceCatalog(fixture: BenchmarkFixture): BackendAcceptanceCatalog {
  return backendAcceptanceCatalogSchema.parse({
    profile: fixture.profile,
    version: fixture.version,
    observations: fixture.observations,
  });
}
export function backendBehaviorRequirements(input: BackendAcceptanceCatalog) {
  const catalog = backendAcceptanceCatalogSchema.parse(input);
  const ids = [...new Set(catalog.observations.flatMap((o) => o.operationIds))];
  return ids.map((id) => ({
    id: backendBehaviorId(catalog.profile, catalog.version, id),
    acceptance: catalog.observations.filter((o) => o.operationIds.includes(id)).map((o) => o.id),
  }));
}
