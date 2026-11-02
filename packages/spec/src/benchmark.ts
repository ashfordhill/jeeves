/** Frozen requirements and read-only evidence accounting; declarations alone never prove behavior. */
import { z } from "zod";
import { contractCanonical } from "./architecture-contracts.ts";

const text = z
  .string()
  .min(1)
  .max(4000)
  .refine((value) => value.trim().length > 0);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const profile = z.enum(["discourse-core", "vendure-core", "zammad-core"]);
const version = z.string().regex(/^v[1-9]\d*$/);
const caseId = z.string().regex(/^[DVZ]\d{2}$/);
const observationId = z.string().regex(/^[DVZ]\d{2}-[a-z][a-z0-9-]*$/);
const relativePath = z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/);
export const benchmarkOriginSchema = z.enum([
  "shared-template",
  "domain-template",
  "product-recipe",
  "upstream-integration",
  "project-hook",
]);
export type BenchmarkOrigin = z.infer<typeof benchmarkOriginSchema>;
const category = z.enum(["success", "rejection", "failure"]);
const providerMode = z.enum(["none", "local-reference", "concrete-adapter"]);
const capability = z.strictObject({
  id: caseId,
  weight: z.int().min(1).max(100),
  targetOrigin: z.enum(["G", "H"]),
  providerMode,
  description: text,
  requiredObservationIds: z.array(observationId).min(2).max(50),
  critical: z.boolean(),
  dependencies: z.array(caseId).max(20),
  excludedScope: z.array(text).max(20),
});
export const benchmarkManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  profile,
  version,
  scope: text,
  /** Locator reserved for P60's independently pinned source/adaptation map; not source evidence. */
  sourceMap: z.strictObject({ path: relativePath, assignment: z.enum(["P60a", "P60b", "P60c"]) }),
  fixtureVersion: version,
  excludedScope: z.array(text).min(1),
  workloadProfile: z.strictObject({
    id: z.enum(["D-core", "V-core", "Z-core"]),
    status: z.literal("unmeasured-target"),
    cardinalities: z.record(text, z.int().positive()),
    requestsPerSecond: z.int().positive(),
    durationSeconds: z.literal(600),
    mix: z.array(z.strictObject({ operation: text, percent: z.int().min(1).max(100) })).min(1),
    minimumActiveClients: z.int().positive().nullable(),
    targets: z.array(text).min(1),
    conditions: z.array(text).min(1),
  }),
  capabilities: z.array(capability).length(20),
});
export type BenchmarkManifest = z.infer<typeof benchmarkManifestSchema>;
export const benchmarkRequirementsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  profile,
  version,
  observations: z
    .array(
      z.strictObject({
        id: observationId,
        caseId,
        category,
        expected: text,
        critical: z.boolean(),
      }),
    )
    .min(1)
    .max(1000),
  notApplicable: z.array(z.strictObject({ caseId, category, reason: text })).max(60),
});
export type BenchmarkRequirements = z.infer<typeof benchmarkRequirementsSchema>;
export const benchmarkIntegritySchema = z.strictObject({
  algorithm: z.literal("canonical-json-sha256-v1"),
  manifest: hash,
  requirements: hash,
});
export type BenchmarkLedger = {
  manifest: BenchmarkManifest;
  requirements: BenchmarkRequirements;
  integrity: z.infer<typeof benchmarkIntegritySchema>;
};
const prefix = { "discourse-core": "D", "vendure-core": "V", "zammad-core": "Z" } as const;

/** Same sorted-key JSON convention as immutable contract snapshots; arrays retain their order. */
export const benchmarkCanonical = contractCanonical;
export async function benchmarkHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(benchmarkCanonical(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function unique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label}`);
}
function known<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((item) => item.id === id);
  if (!item) throw new Error(`Unknown identity ${id}`);
  return item;
}

/** Structural validation is used by evaluation too, even for callers bypassing the JSON loader. */
function validateLedger(manifestInput: unknown, requirementsInput: unknown) {
  const manifest = benchmarkManifestSchema.parse(manifestInput);
  const requirements = benchmarkRequirementsSchema.parse(requirementsInput);
  if (manifest.profile !== requirements.profile || manifest.version !== requirements.version)
    throw new Error("Requirements belong to a different benchmark/version");
  const rows = manifest.capabilities;
  const observations = requirements.observations;
  const ids = rows.map((row) => row.id);
  unique(ids, "capability identity");
  unique(
    observations.map((o) => o.id),
    "observation identity",
  );
  unique(
    requirements.notApplicable.map((o) => `${o.caseId}/${o.category}`),
    "not-applicable category",
  );
  if (rows.reduce((sum, row) => sum + row.weight, 0) !== 100)
    throw new Error("Benchmark weights must total 100");
  if (manifest.workloadProfile.mix.reduce((sum, item) => sum + item.percent, 0) !== 100)
    throw new Error("Workload mix must total 100");
  if (manifest.workloadProfile.id !== `${prefix[manifest.profile]}-core`)
    throw new Error("Workload profile belongs to a different application");
  for (const [index, row] of rows.entries()) {
    if (row.id !== `${prefix[manifest.profile]}${String(index + 1).padStart(2, "0")}`)
      throw new Error("Capabilities must retain their ordered, profile-scoped identities");
    unique(row.requiredObservationIds, `${row.id} required observation`);
    unique(row.dependencies, `${row.id} dependency`);
    if (row.dependencies.some((id) => !ids.includes(id) || id === row.id))
      throw new Error(`${row.id}: unknown/self dependency`);
    const required = row.requiredObservationIds.map((id) => {
      const observation = observations.find((o) => o.id === id && o.caseId === row.id);
      if (!observation || !id.startsWith(`${row.id}-`))
        throw new Error(`${row.id}: missing or foreign observation ${id}`);
      return observation;
    });
    if (row.critical !== required.some((o) => o.critical))
      throw new Error(`${row.id}: critical flag must reflect its observations`);
    for (const kind of category.options) {
      const applicable = required.some((o) => o.category === kind);
      const na = requirements.notApplicable.some((o) => o.caseId === row.id && o.category === kind);
      if (applicable === na || (kind !== "failure" && na))
        throw new Error(
          `${row.id}: declare ${kind} observations (or a reason for no material failure)`,
        );
    }
  }
  for (const observation of observations)
    if (
      !rows.some(
        (r) => r.id === observation.caseId && r.requiredObservationIds.includes(observation.id),
      )
    )
      throw new Error(`Unregistered observation ${observation.id}`);
  for (const na of requirements.notApplicable)
    if (!ids.includes(na.caseId)) throw new Error(`Unknown not-applicable case ${na.caseId}`);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Cyclic capability dependency");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of known(rows, id).dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  return { manifest, requirements };
}

/** Detached pins are checked before data can be evaluated. No filesystem or network access. */
export async function parseBenchmarkLedger(
  manifestInput: unknown,
  requirementsInput: unknown,
  integrityInput: unknown,
): Promise<BenchmarkLedger> {
  const { manifest, requirements } = validateLedger(manifestInput, requirementsInput);
  const integrity = benchmarkIntegritySchema.parse(integrityInput);
  if (
    (await benchmarkHash(manifest)) !== integrity.manifest ||
    (await benchmarkHash(requirements)) !== integrity.requirements
  )
    throw new Error(
      "Frozen benchmark hash mismatch; revise requirements in a new version with a diff",
    );
  return { manifest, requirements, integrity };
}

const hashMap = z.record(text, hash);
export const benchmarkInputsSchema = z.strictObject({
  profile,
  version,
  manifestHash: hash,
  requirementsHash: hash,
  designHash: hash,
  dependencyLockHash: hash,
  contractHash: hash,
  fixtureHash: hash,
  fixtureVersion: version,
  fixtureSeed: text,
  testPackHash: hash,
  templateHashes: hashMap,
  runtimeHashes: hashMap,
  archiveHashes: hashMap,
  generatedSourceHash: hash,
  database: z.strictObject({ version: text, imageDigest: hash }),
  environment: z.strictObject({ profile: text, fingerprint: hash }),
});
export type BenchmarkInputs = z.infer<typeof benchmarkInputsSchema>;
const availability = z.enum(["unsupported", "custom-required", "supported", "generated"]);
const declaration = z
  .strictObject({
    caseId,
    /** Exact design references, bound to inputs.designHash; these earn design coverage only. */
    designReferences: z.array(text).max(100),
    availability,
    origin: benchmarkOriginSchema.nullable(),
    implementationReference: text.nullable(),
  })
  .refine(
    (d) =>
      !["supported", "generated"].includes(d.availability) ||
      !!(d.origin && d.implementationReference),
    { message: "Supplied paths need an origin and exact implementation reference" },
  );
const observationStatus = z.enum([
  "passed",
  "failed",
  "skipped",
  "not-run",
  "blocked",
  "unavailable",
]);
const runSchema = z
  .strictObject({
    id: text,
    inputs: benchmarkInputsSchema,
    command: text,
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    status: z.enum(["completed", "interrupted", "not-run"]),
    generation: z.enum(["fresh", "existing", "absent"]),
    cases: z
      .array(
        z.strictObject({
          caseId,
          origin: benchmarkOriginSchema,
          implementationReference: text,
          providerMode,
          usesProjectCode: z.boolean(),
          observations: z
            .array(
              z.strictObject({
                id: observationId,
                status: observationStatus,
                /** Raw independent report locator and content hash; never a synthesized implementation flag. */
                report: z.strictObject({ path: text, hash }).nullable(),
                reason: text.nullable(),
              }),
            )
            .max(50),
        }),
      )
      .max(20),
  })
  .refine((r) => r.status !== "completed" || !!r.finishedAt, {
    message: "Completed runs must finish",
  })
  .refine((r) => !r.finishedAt || Date.parse(r.finishedAt) >= Date.parse(r.startedAt), {
    message: "Run finishes before it starts",
  });
export const benchmarkEvidenceSchema = z.strictObject({
  declarations: z
    .array(z.strictObject({ inputs: benchmarkInputsSchema, cases: z.array(declaration).max(20) }))
    .max(100),
  runs: z.array(runSchema).max(1000),
});
export type BenchmarkEvidence = z.infer<typeof benchmarkEvidenceSchema>;
export type BenchmarkObservationState = z.infer<typeof observationStatus> | "unrecorded";
export type BenchmarkRowSummary = {
  id: string;
  weight: number;
  targetOrigin: "G" | "H";
  critical: boolean;
  designed: boolean;
  availability: z.infer<typeof availability>;
  origin: BenchmarkOrigin | null;
  status: "verified" | "failed" | "missing";
  observations: { id: string; critical: boolean; status: BenchmarkObservationState }[];
  blockedBy: string[];
};
export type BenchmarkSummary = {
  profile: BenchmarkManifest["profile"];
  version: string;
  inputs: BenchmarkInputs;
  denominator: 100;
  points: {
    targetTemplate: number;
    designed: number;
    sharedTemplate: number;
    domainTemplate: number;
    template: number;
    productRecipe: number;
    upstreamIntegration: number;
    custom: number;
    completion: number;
    missing: number;
    failed: number;
  };
  foundation: "passed" | "failed" | "incomplete";
  application: "complete" | "failed" | "incomplete";
  criticalFailures: string[];
  criticalMissing: string[];
  suppliedIncomplete: string[];
  ignored: { staleDeclarations: number; staleRuns: number; ineligibleObservations: number };
  rows: BenchmarkRowSummary[];
};

/** Pure accounting of recorded observations, not execution, attestation or template availability. */
export async function evaluateBenchmark(
  ledgerInput: BenchmarkLedger,
  inputsInput: BenchmarkInputs,
  evidenceInput: BenchmarkEvidence = { declarations: [], runs: [] },
): Promise<BenchmarkSummary> {
  const ledger = await parseBenchmarkLedger(
    ledgerInput.manifest,
    ledgerInput.requirements,
    ledgerInput.integrity,
  );
  const inputs = benchmarkInputsSchema.parse(inputsInput);
  const evidence = benchmarkEvidenceSchema.parse(evidenceInput);
  const { manifest, requirements, integrity } = ledger;
  if (
    inputs.profile !== manifest.profile ||
    inputs.version !== manifest.version ||
    inputs.fixtureVersion !== manifest.fixtureVersion ||
    inputs.manifestHash !== integrity.manifest ||
    inputs.requirementsHash !== integrity.requirements
  )
    throw new Error("Evaluation inputs do not match the frozen benchmark");
  const ids = manifest.capabilities.map((r) => r.id);
  const matching = (other: BenchmarkInputs) =>
    benchmarkCanonical(other) === benchmarkCanonical(inputs);
  const declarations = new Map<string, z.infer<typeof declaration>>();
  const ignored = { staleDeclarations: 0, staleRuns: 0, ineligibleObservations: 0 };
  // Validate identities even in stale records: unknown cases can never smuggle in a pass.
  function checkIds(caseIds: string[], label: string, runProfile: BenchmarkInputs["profile"]) {
    unique(caseIds, label);
    for (const id of caseIds)
      if (
        !id.startsWith(prefix[runProfile]) ||
        Number(id.slice(1)) < 1 ||
        Number(id.slice(1)) > 20 ||
        (runProfile === manifest.profile && !ids.includes(id))
      )
        throw new Error(`Unknown/foreign case ${id}`);
  }
  for (const record of evidence.declarations) {
    checkIds(
      record.cases.map((r) => r.caseId),
      "declaration case",
      record.inputs.profile,
    );
    if (!matching(record.inputs)) {
      ignored.staleDeclarations++;
      continue;
    }
    for (const row of record.cases) {
      if (declarations.has(row.caseId))
        throw new Error(`Duplicate current declaration ${row.caseId}`);
      declarations.set(row.caseId, row);
    }
  }
  unique(
    evidence.runs.map((r) => r.id),
    "run identity",
  );
  const states = new Map<string, BenchmarkObservationState[]>();
  for (const run of evidence.runs) {
    checkIds(
      run.cases.map((r) => r.caseId),
      "run case",
      run.inputs.profile,
    );
    for (const row of run.cases) {
      unique(
        row.observations.map((o) => o.id),
        "recorded observation identity",
      );
      for (const o of row.observations)
        if (
          !o.id.startsWith(`${row.caseId}-`) ||
          (run.inputs.profile === manifest.profile &&
            !requirements.observations.some(
              (expected) => expected.caseId === row.caseId && expected.id === o.id,
            ))
        )
          throw new Error(`Unknown/foreign observation ${o.id}`);
    }
    if (!matching(run.inputs)) {
      ignored.staleRuns++;
      continue;
    }
    for (const row of run.cases) {
      const declared = declarations.get(row.caseId);
      const isTemplate = row.origin === "shared-template" || row.origin === "domain-template";
      const supplied = declared && ["supported", "generated"].includes(declared.availability);
      const sameImplementation =
        supplied &&
        declared.origin === row.origin &&
        declared.implementationReference === row.implementationReference;
      const eligible =
        sameImplementation &&
        run.status === "completed" &&
        run.generation !== "absent" &&
        row.providerMode === known(manifest.capabilities, row.caseId).providerMode &&
        (!isTemplate ||
          (run.generation === "fresh" &&
            !row.usesProjectCode &&
            Object.hasOwn(run.inputs.templateHashes, row.implementationReference)));
      const recorded = [...row.observations];
      if (supplied && !eligible) {
        for (const id of known(manifest.capabilities, row.caseId).requiredObservationIds)
          if (!recorded.some((o) => o.id === id))
            recorded.push({
              id,
              status: "not-run",
              report: null,
              reason: "Ineligible/incomplete run",
            });
      }
      for (const observation of recorded) {
        if (!supplied) {
          ignored.ineligibleObservations++;
          continue;
        }
        let status = observation.status;
        if (!eligible || (status === "passed" && !observation.report)) {
          ignored.ineligibleObservations++;
          // Incomplete/current attempts cannot hide an observed failure or borrow an earlier pass.
          if (status !== "failed") status = "blocked";
        }
        const statuses = states.get(observation.id) ?? [];
        statuses.push(status);
        states.set(observation.id, statuses);
      }
    }
  }
  const precedence: BenchmarkObservationState[] = [
    "failed",
    "unavailable",
    "blocked",
    "not-run",
    "skipped",
    "passed",
  ];
  const rows: BenchmarkRowSummary[] = manifest.capabilities.map((row) => {
    const declared = declarations.get(row.id);
    const observations = row.requiredObservationIds.map((id) => ({
      id,
      critical: known(requirements.observations, id).critical,
      status: precedence.find((s) => states.get(id)?.includes(s)) ?? "unrecorded",
    }));
    return {
      id: row.id,
      weight: row.weight,
      targetOrigin: row.targetOrigin,
      critical: row.critical,
      designed: !!declared?.designReferences.length,
      availability: declared?.availability ?? "unsupported",
      origin: declared?.origin ?? null,
      status: observations.some((o) => o.status === "failed")
        ? "failed"
        : observations.every((o) => o.status === "passed")
          ? "verified"
          : "missing",
      observations,
      blockedBy: [],
    };
  });
  const resolved = new Set<string>();
  function resolve(row: BenchmarkRowSummary) {
    if (resolved.has(row.id)) return;
    for (const dependency of known(manifest.capabilities, row.id).dependencies) {
      const parent = known(rows, dependency);
      resolve(parent);
      if (parent.status !== "verified") row.blockedBy.push(dependency);
    }
    if (row.blockedBy.length && row.status === "verified") row.status = "missing";
    resolved.add(row.id);
  }
  for (const row of rows) resolve(row);
  const sum = (predicate: (r: BenchmarkRowSummary) => boolean) =>
    rows.filter(predicate).reduce((n, r) => n + r.weight, 0);
  const originPoints = (origin: BenchmarkOrigin) =>
    sum((r) => r.status === "verified" && r.origin === origin);
  const sharedTemplate = originPoints("shared-template");
  const domainTemplate = originPoints("domain-template");
  const completion = sum((r) => r.status === "verified");
  const failed = sum((r) => r.status === "failed");
  const criticalFailures = rows.flatMap((r) =>
    r.observations.filter((o) => o.critical && o.status === "failed").map((o) => o.id),
  );
  const criticalMissing = rows.flatMap((r) =>
    r.observations
      .filter((o) => o.critical && o.status !== "passed" && o.status !== "failed")
      .map((o) => o.id),
  );
  const suppliedIncomplete = rows
    .filter((r) => ["supported", "generated"].includes(r.availability) && r.status !== "verified")
    .map((r) => r.id);
  return {
    profile: manifest.profile,
    version: manifest.version,
    inputs,
    denominator: 100,
    points: {
      targetTemplate: sum((r) => r.targetOrigin === "G"),
      designed: sum((r) => r.designed),
      sharedTemplate,
      domainTemplate,
      template: sharedTemplate + domainTemplate,
      productRecipe: originPoints("product-recipe"),
      upstreamIntegration: originPoints("upstream-integration"),
      custom: originPoints("project-hook"),
      completion,
      missing: 100 - completion - failed,
      failed,
    },
    foundation:
      failed || criticalFailures.length
        ? "failed"
        : sharedTemplate + domainTemplate >= 60 &&
            !criticalMissing.length &&
            !suppliedIncomplete.length &&
            rows.every((r) => !r.critical || r.status === "verified")
          ? "passed"
          : "incomplete",
    application: failed ? "failed" : completion === 100 ? "complete" : "incomplete",
    criticalFailures,
    criticalMissing,
    suppliedIncomplete,
    ignored,
    rows,
  };
}

/** Stable key order, row order, and trailing newline for both CLI and later UI consumers. */
export function benchmarkSummaryJson(summary: BenchmarkSummary): string {
  return `${benchmarkCanonical(summary)}\n`;
}
export function benchmarkSummaryText(summary: BenchmarkSummary): string {
  const p = summary.points;
  const lines = [
    `${summary.profile}/${summary.version}: foundation ${summary.foundation}; application ${summary.application}`,
    `Target template: ${p.targetTemplate}/100; designed: ${p.designed}/100`,
    `Verified template: ${p.template}/100 (shared ${p.sharedTemplate}, domain ${p.domainTemplate})`,
    `Recipe: ${p.productRecipe}/100; upstream integration: ${p.upstreamIntegration}/100; custom: ${p.custom}/100`,
    `Completion: ${p.completion}/100; missing: ${p.missing}/100; failed: ${p.failed}/100`,
    `Critical failed: ${summary.criticalFailures.join(", ") || "none"}; critical missing: ${summary.criticalMissing.join(", ") || "none"}`,
    ...summary.rows.map(
      (r) =>
        `${r.id} ${r.weight}: ${r.status}; ${r.availability}; ${r.origin ?? "no origin"}${r.blockedBy.length ? `; dependencies ${r.blockedBy.join(", ")}` : ""}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** A visible canonical diff is required alongside a new version; the old version stays intact. */
export function diffBenchmarkVersions(before: BenchmarkLedger, after: BenchmarkLedger): string[] {
  validateLedger(before.manifest, before.requirements);
  validateLedger(after.manifest, after.requirements);
  if (before.manifest.profile !== after.manifest.profile)
    throw new Error("Cannot diff different applications");
  const changes: string[] = [];
  function compare(path: string, left: unknown, right: unknown) {
    if (benchmarkCanonical(left) === benchmarkCanonical(right)) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      for (let index = 0; index < Math.max(left.length, right.length); index++)
        compare(`${path}[${index}]`, left[index], right[index]);
    } else if (left && right && typeof left === "object" && typeof right === "object") {
      for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort())
        compare(
          `${path}.${key}`,
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        );
    } else
      changes.push(
        `${path}: ${benchmarkCanonical(left) ?? "absent"} -> ${benchmarkCanonical(right) ?? "absent"}`,
      );
  }
  for (const key of ["manifest", "requirements"] as const) {
    compare(key, before[key], after[key]);
  }
  if (
    changes.length &&
    Number(after.manifest.version.slice(1)) <= Number(before.manifest.version.slice(1))
  )
    throw new Error("Changed requirements/weights need a newer benchmark version and a diff");
  return changes;
}
