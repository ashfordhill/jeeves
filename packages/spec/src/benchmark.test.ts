import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type BenchmarkEvidence,
  type BenchmarkInputs,
  type BenchmarkLedger,
  type BenchmarkManifest,
  type BenchmarkOrigin,
  benchmarkCanonical,
  benchmarkHash,
  benchmarkSummaryJson,
  benchmarkSummaryText,
  diffBenchmarkVersions,
  evaluateBenchmark,
  parseBenchmarkLedger,
} from "./benchmark.ts";

const profiles = ["discourse-core", "vendure-core", "zammad-core"] as const;
// These pins are independently reviewed v1 identities; changes belong in a new directory/version.
const pins = {
  "discourse-core": [
    "4eeaa5032e48783091e2b3300c6df9feae574117bec432c5c1fe3a50ba1925a7",
    "67ea5037e54172e1a73f2ee05b729152e0067f882192e44a2cd8aed09e844691",
  ],
  "vendure-core": [
    "126b31b7f5639dfa6084cdcb7bb21f40f49643bb7c0f8a2f42890d136aee6bdd",
    "46cec50d621ee2f1cb22a0ec73d56d8d9da1ead7fa7133b5bcc337f168e80b98",
  ],
  "zammad-core": [
    "f21c75ab05b05b2fc7091231e32c2bfdaf435bcb8c0a0cd0dfd73c27e1c7f1f3",
    "63342b9eb79e7b78c84a9551ef521239b6b161a5f1a48a85b13ce1b14217e631",
  ],
};
const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const json = (path: string): unknown => JSON.parse(read(path));
const ledgers = await Promise.all(
  profiles.map((profile) => {
    const dir = `benchmarks/${profile}/v1`;
    return parseBenchmarkLedger(
      json(`${dir}/manifest.json`),
      json(`${dir}/requirements.json`),
      json(`${dir}/integrity.json`),
    );
  }),
);
function must<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Missing synthetic test fixture");
  return value;
}
const discourse = must(ledgers[0]);
const fingerprint = (name: string) => createHash("sha256").update(name).digest("hex");
function inputsFor(ledger = discourse): BenchmarkInputs {
  return {
    profile: ledger.manifest.profile,
    version: ledger.manifest.version,
    manifestHash: ledger.integrity.manifest,
    requirementsHash: ledger.integrity.requirements,
    designHash: fingerprint("test-only design"),
    dependencyLockHash: fingerprint("test-only lock"),
    contractHash: fingerprint("test-only contract"),
    fixtureHash: fingerprint("test-only fixture"),
    fixtureVersion: "v1",
    fixtureSeed: "test-only-seed",
    testPackHash: fingerprint("test-only pack"),
    templateHashes: { "test-only@1.0.0": fingerprint("template") },
    runtimeHashes: { "test-only@1.0.0": fingerprint("runtime") },
    archiveHashes: { "test-only@1.0.0": fingerprint("archive") },
    generatedSourceHash: fingerprint("test-only output"),
    database: { version: "test-only", imageDigest: fingerprint("test-only database") },
    environment: {
      profile: "evaluator-unit-test",
      fingerprint: fingerprint("test-only environment"),
    },
  };
}
/** Synthetic evaluator inputs only, never persisted as real benchmark evidence or runtime fixtures. */
function recorded(
  ledger = discourse,
  ids = ledger.manifest.capabilities.filter((r) => r.targetOrigin === "G").map((r) => r.id),
  origin: BenchmarkOrigin = "shared-template",
): BenchmarkEvidence {
  const inputs = inputsFor(ledger);
  return {
    declarations: [
      {
        inputs,
        cases: ids.map((caseId) => ({
          caseId,
          designReferences: [`test-only:${caseId}@1`],
          availability: "generated",
          origin,
          implementationReference: "test-only@1.0.0",
        })),
      },
    ],
    runs: [
      {
        id: "test-only-attempt",
        inputs: structuredClone(inputs),
        command: "test-only-independent-check",
        startedAt: "2026-11-02T00:00:00Z",
        finishedAt: "2026-11-02T00:00:01Z",
        status: "completed",
        generation: "fresh",
        cases: ids.map((caseId) => ({
          caseId,
          origin,
          implementationReference: "test-only@1.0.0",
          providerMode: must(ledger.manifest.capabilities.find((r) => r.id === caseId))
            .providerMode,
          usesProjectCode: origin === "project-hook",
          observations: ledger.requirements.observations
            .filter((o) => o.caseId === caseId)
            .map((o) => ({
              id: o.id,
              status: "passed",
              report: { path: "test-only-report", hash: fingerprint(o.id) },
              reason: null,
            })),
        })),
      },
    ],
  };
}
const firstCase = (evidence: BenchmarkEvidence) => must(must(evidence.runs[0]).cases[0]);
const firstObservation = (evidence: BenchmarkEvidence) => must(firstCase(evidence).observations[0]);
const score = (evidence?: BenchmarkEvidence) => evaluateBenchmark(discourse, inputsFor(), evidence);
async function repin(manifest: BenchmarkManifest, requirements = discourse.requirements) {
  return parseBenchmarkLedger(manifest, requirements, {
    algorithm: "canonical-json-sha256-v1",
    manifest: await benchmarkHash(manifest),
    requirements: await benchmarkHash(requirements),
  });
}

describe.each(ledgers)("frozen $manifest.profile/v1", (ledger) => {
  it("transcribes every original row exactly, with 100 points and a 66-point G target", async () => {
    const rows = ledger.manifest.capabilities;
    const original = [
      ...read("docs/plans/backend-benchmarks/benchmarks.md").matchAll(
        /^\| ([DVZ]\d{2}) \| (\d+) \| ([GH]) \| (.*?) \|$/gm,
      ),
    ]
      .filter((m) => must(m[1]).startsWith(must(must(rows[0]).id[0])))
      .map((m) => ({ id: m[1], weight: Number(m[2]), targetOrigin: m[3], description: m[4] }));
    expect(
      rows.map(({ id, weight, targetOrigin, description }) => ({
        id,
        weight,
        targetOrigin,
        description,
      })),
    ).toEqual(original);
    expect(rows).toHaveLength(20);
    expect(rows.reduce((sum, r) => sum + r.weight, 0)).toBe(100);
    expect(rows.slice(0, 12).every((r) => r.targetOrigin === "G")).toBe(true);
    expect(rows.slice(12).every((r) => r.targetOrigin === "H")).toBe(true);
    const summary = await evaluateBenchmark(ledger, inputsFor(ledger));
    expect(summary.points).toEqual({
      targetTemplate: 66,
      designed: 0,
      sharedTemplate: 0,
      domainTemplate: 0,
      template: 0,
      productRecipe: 0,
      upstreamIntegration: 0,
      custom: 0,
      completion: 0,
      missing: 100,
      failed: 0,
    });
    expect(summary.foundation).toBe("incomplete");
    expect(summary.application).toBe("incomplete");
  });
  it("matches independently pinned canonical hashes and does not hash file whitespace", () => {
    expect([ledger.integrity.manifest, ledger.integrity.requirements]).toEqual(
      pins[ledger.manifest.profile],
    );
    for (const key of ["manifest", "requirements"] as const)
      expect(createHash("sha256").update(benchmarkCanonical(ledger[key])).digest("hex")).toBe(
        ledger.integrity[key],
      );
  });
  it("earns the candidate 66 points only after all supplied observations pass", async () => {
    const summary = await evaluateBenchmark(ledger, inputsFor(ledger), recorded(ledger));
    expect(summary.points).toMatchObject({ template: 66, completion: 66, missing: 34, failed: 0 });
    expect(summary.foundation).toBe("passed");
    expect(summary.application).toBe("incomplete");
  });
  it("requires success, rejection and every applicable failure observation without extra N/A points", () => {
    const ids = ledger.requirements.observations.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ledger.manifest.capabilities.flatMap((r) => r.requiredObservationIds).sort()).toEqual(
      [...ids].sort(),
    );
    for (const row of ledger.manifest.capabilities) {
      const observations = ledger.requirements.observations.filter((o) => o.caseId === row.id);
      expect(observations.some((o) => o.category === "success")).toBe(true);
      expect(observations.some((o) => o.category === "rejection")).toBe(true);
      expect(
        observations.some((o) => o.category === "failure") ||
          ledger.requirements.notApplicable.some(
            (na) => na.caseId === row.id && na.reason.length > 20,
          ),
      ).toBe(true);
    }
  });
});

it("expands every named critical boundary into stable veto observations", () => {
  expect(
    ledgers.map((l) => l.requirements.observations.filter((o) => o.critical).map((o) => o.id)),
  ).toEqual([
    [
      "D03-atomicity",
      "D03-lost-response-retry",
      "D04-stale-write",
      "D06-denied-detail",
      "D06-denied-list",
      "D06-denied-search",
      "D06-denied-bytes",
      "D06-pending-notification",
      "D08-crash-deduplication",
      "D09-foreign-byte-access",
      "D12-removed-history-visibility",
      "D12-removed-search-visibility",
    ],
    [
      "V03-exact-arithmetic",
      "V03-money-bounds",
      "V05-checkout-atomicity",
      "V06-last-item-race",
      "V07-transition-guards",
      "V08-callback-authentication",
      "V08-unknown-outcome",
      "V09-quantity-ceiling",
      "V11-direct-isolation",
      "V11-list-isolation",
      "V11-download-isolation",
      "V11-callback-isolation",
    ],
    [
      "Z02-direct-cross-scope",
      "Z02-list-cross-scope",
      "Z02-assignment-cross-scope",
      "Z04-internal-detail-history",
      "Z04-internal-attachment",
      "Z04-internal-search",
      "Z04-internal-notification",
      "Z05-assignment-race",
      "Z07-business-calendar",
      "Z07-timezone-boundaries",
      "Z07-clock-stop-policy",
      "Z07-calendar-snapshot",
      "Z08-one-logical-escalation",
      "Z10-bytes-authorization",
      "Z11-revoked-group-projection",
    ],
  ]);
});
it("freezes workload targets as unmeasured, preserving rates, data and measurement conditions", () => {
  expect(
    ledgers.map((l) => [
      l.manifest.workloadProfile.id,
      l.manifest.workloadProfile.requestsPerSecond,
    ]),
  ).toEqual([
    ["D-core", 50],
    ["V-core", 20],
    ["Z-core", 25],
  ]);
  expect(must(ledgers[0]).manifest.workloadProfile.cardinalities).toEqual({
    principals: 10000,
    topics: 100000,
    posts: 1000000,
  });
  expect(must(ledgers[1]).manifest.workloadProfile.cardinalities).toEqual({
    products: 50000,
    variants: 200000,
    historicalOrders: 100000,
  });
  expect(must(ledgers[2]).manifest.workloadProfile.cardinalities).toEqual({
    customers: 20000,
    agents: 1000,
    tickets: 100000,
    articles: 1000000,
  });
  expect(must(ledgers[0]).manifest.workloadProfile.minimumActiveClients).toBe(20);
  for (const ledger of ledgers) {
    expect(ledger.manifest.workloadProfile.status).toBe("unmeasured-target");
    expect(ledger.manifest.workloadProfile.durationSeconds).toBe(600);
    expect(ledger.manifest.workloadProfile.conditions.join(" ")).toContain(
      "one and two API instances",
    );
  }
});

it("counts designed intent separately and refuses synthetic implemented declarations", async () => {
  const evidence = recorded();
  evidence.runs = [];
  expect((await score(evidence)).points).toMatchObject({
    designed: 66,
    template: 0,
    completion: 0,
  });
  const malformed = structuredClone(evidence);
  Reflect.set(must(must(malformed.declarations[0]).cases[0]), "availability", "implemented");
  await expect(score(malformed)).rejects.toThrow();
});
it.each(["skipped", "not-run", "blocked", "unavailable", "failed"] as const)(
  "gives a %s row zero points",
  async (status) => {
    const evidence = recorded(discourse, ["D01"]);
    firstObservation(evidence).status = status;
    const result = await score(evidence);
    expect(result.points.template).toBe(0);
    expect(must(result.rows[0]).status).toBe(status === "failed" ? "failed" : "missing");
  },
);
it("gives partial, unexecuted, unsupported and unimplemented hooks no points", async () => {
  for (const transform of [
    (e: BenchmarkEvidence) => {
      firstCase(e).observations.pop();
    },
    (e: BenchmarkEvidence) => {
      e.runs = [];
    },
    (e: BenchmarkEvidence) => {
      must(must(e.declarations[0]).cases[0]).availability = "unsupported";
    },
    (e: BenchmarkEvidence) => {
      must(must(e.declarations[0]).cases[0]).availability = "custom-required";
    },
    (e: BenchmarkEvidence) => {
      firstObservation(e).report = null;
    },
  ]) {
    const evidence = recorded(discourse, ["D01"]);
    transform(evidence);
    expect((await score(evidence)).points.completion).toBe(0);
  }
});
it.each(["interrupted", "not-run"] as const)(
  "refuses %s run passes, retaining actual observed failures",
  async (status) => {
    const evidence = recorded();
    must(evidence.runs[0]).status = status;
    must(evidence.runs[0]).finishedAt = null;
    expect((await score(evidence)).points.completion).toBe(0);
    const atomicity = must(
      must(must(evidence.runs[0]).cases.find((c) => c.caseId === "D03")).observations.find(
        (o) => o.id === "D03-atomicity",
      ),
    );
    atomicity.status = "failed";
    expect(await score(evidence)).toMatchObject({
      foundation: "failed",
      criticalFailures: ["D03-atomicity"],
    });
  },
);
it.each(["existing", "absent"] as const)(
  "refuses template credit for %s generation",
  async (generation) => {
    const evidence = recorded();
    must(evidence.runs[0]).generation = generation;
    expect((await score(evidence)).points.template).toBe(0);
  },
);
it("cannot relabel project code or a different implementation as a shared template pass", async () => {
  const evidence = recorded(discourse, ["D01"]);
  firstCase(evidence).usesProjectCode = true;
  expect((await score(evidence)).points.template).toBe(0);
  firstCase(evidence).usesProjectCode = false;
  firstCase(evidence).origin = "project-hook";
  expect((await score(evidence)).points.completion).toBe(0);
  firstCase(evidence).origin = "shared-template";
  firstCase(evidence).implementationReference = "different@1.0.0";
  expect((await score(evidence)).points.completion).toBe(0);
});
it("requires the selected exact template hash and rejects local-reference evidence for concrete providers", async () => {
  const evidence = recorded(discourse, ["D01"]);
  must(evidence.runs[0]).inputs.templateHashes = {};
  must(evidence.declarations[0]).inputs.templateHashes = {};
  const inputs = inputsFor();
  inputs.templateHashes = {};
  expect((await evaluateBenchmark(discourse, inputs, evidence)).points.template).toBe(0);
  const vendure = must(ledgers[1]);
  const provider = recorded(
    vendure,
    vendure.manifest.capabilities.map((r) => r.id),
    "project-hook",
  );
  const concrete = must(must(provider.runs[0]).cases.find((r) => r.caseId === "V19"));
  concrete.providerMode = "local-reference";
  const result = await evaluateBenchmark(vendure, inputsFor(vendure), provider);
  expect(result.rows.find((r) => r.id === "V08")?.status).toBe("verified");
  expect(result.rows.find((r) => r.id === "V19")?.status).toBe("missing");
});
it("does not count an unavailable required hook as custom completion", async () => {
  const evidence = recorded(
    discourse,
    discourse.manifest.capabilities.map((r) => r.id),
    "project-hook",
  );
  const hook = must(must(evidence.runs[0]).cases.find((r) => r.caseId === "D13"));
  for (const observation of hook.observations) observation.status = "unavailable";
  expect((await score(evidence)).points).toMatchObject({
    custom: 96,
    template: 0,
    completion: 96,
    missing: 4,
  });
});

const inputMutations: [string, (i: BenchmarkInputs) => void][] = [
  ...[
    "designHash",
    "dependencyLockHash",
    "contractHash",
    "fixtureHash",
    "testPackHash",
    "generatedSourceHash",
  ].map(
    (key) =>
      [key, (i: BenchmarkInputs) => Reflect.set(i, key, fingerprint(`changed ${key}`))] as [
        string,
        (i: BenchmarkInputs) => void,
      ],
  ),
  [
    "fixtureSeed",
    (i) => {
      i.fixtureSeed = "changed";
    },
  ],
  [
    "fixtureVersion",
    (i) => {
      i.fixtureVersion = "v2";
    },
  ],
  [
    "version",
    (i) => {
      i.version = "v2";
    },
  ],
  [
    "manifestHash",
    (i) => {
      i.manifestHash = fingerprint("changed ledger");
    },
  ],
  [
    "requirementsHash",
    (i) => {
      i.requirementsHash = fingerprint("changed observations");
    },
  ],
  [
    "templates",
    (i) => {
      i.templateHashes = { changed: fingerprint("changed template") };
    },
  ],
  [
    "runtimes",
    (i) => {
      i.runtimeHashes = { changed: fingerprint("changed runtime") };
    },
  ],
  [
    "archives",
    (i) => {
      i.archiveHashes = { changed: fingerprint("changed archive") };
    },
  ],
  [
    "database version",
    (i) => {
      i.database.version = "changed";
    },
  ],
  [
    "database image",
    (i) => {
      i.database.imageDigest = fingerprint("changed image");
    },
  ],
  [
    "environment profile",
    (i) => {
      i.environment.profile = "changed";
    },
  ],
  [
    "environment fingerprint",
    (i) => {
      i.environment.fingerprint = fingerprint("changed environment");
    },
  ],
];
it.each(inputMutations)("invalidates old passes when %s differs", async (_label, mutate) => {
  const evidence = recorded();
  mutate(must(evidence.runs[0]).inputs);
  expect(await score(evidence)).toMatchObject({
    points: { template: 0, completion: 0 },
    ignored: { staleRuns: 1 },
  });
});
it("does not borrow stale design declarations or evidence from another application", async () => {
  const evidence = recorded();
  must(evidence.declarations[0]).inputs = structuredClone(inputsFor());
  must(evidence.declarations[0]).inputs.designHash = fingerprint("old design");
  expect((await score(evidence)).points).toMatchObject({ designed: 0, completion: 0 });
  const foreign = recorded(must(ledgers[1]));
  const result = await score(foreign);
  expect(result.points.completion).toBe(0);
  expect(result.ignored).toMatchObject({ staleDeclarations: 1, staleRuns: 1 });
  must(foreign.runs[0]).inputs = inputsFor();
  await expect(score(foreign)).rejects.toThrow("Unknown/foreign case");
});
it.each(["product-recipe", "upstream-integration", "project-hook", "domain-template"] as const)(
  "keeps %s coverage separate from shared-template points",
  async (origin) => {
    const result = await score(recorded(discourse, undefined, origin));
    expect(result.points.completion).toBe(66);
    expect(result.points.sharedTemplate).toBe(0);
    expect(result.points.template).toBe(origin === "domain-template" ? 66 : 0);
    expect(result.points).toMatchObject({
      productRecipe: origin === "product-recipe" ? 66 : 0,
      upstreamIntegration: origin === "upstream-integration" ? 66 : 0,
      custom: origin === "project-hook" ? 66 : 0,
    });
  },
);
it("custom verified work increases completion without changing the target or template percentage", async () => {
  const evidence = recorded();
  const hook = recorded(discourse, ["D13"], "project-hook");
  must(evidence.declarations[0]).cases.push(...must(hook.declarations[0]).cases);
  must(evidence.runs[0]).cases.push(...must(hook.runs[0]).cases);
  expect((await score(evidence)).points).toMatchObject({
    targetTemplate: 66,
    template: 66,
    custom: 4,
    completion: 70,
  });
});
it("vetoes a critical failure even with more than 60 verified template points and 90 total", async () => {
  const evidence = recorded();
  const hooks = recorded(
    discourse,
    discourse.manifest.capabilities.slice(12).map((r) => r.id),
    "project-hook",
  );
  must(evidence.declarations[0]).cases.push(...must(hooks.declarations[0]).cases);
  must(evidence.runs[0]).cases.push(...must(hooks.runs[0]).cases);
  const removal = must(
    must(must(evidence.runs[0]).cases.find((c) => c.caseId === "D12")).observations.find(
      (o) => o.id === "D12-removed-search-visibility",
    ),
  );
  removal.status = "failed";
  const result = await score(evidence);
  expect(result).toMatchObject({
    foundation: "failed",
    application: "failed",
    criticalFailures: [removal.id],
  });
  expect(result.points).toMatchObject({
    template: 61,
    custom: 30,
    completion: 91,
    failed: 5,
    missing: 4,
  });
  expect(must(result.rows.find((r) => r.id === "D18")).blockedBy).toEqual(["D12"]);
});
it("a missing critical observation or any noncritical supplied failure prevents a foundation pass", async () => {
  const evidence = recorded();
  const removal = must(must(evidence.runs[0]).cases.find((c) => c.caseId === "D12"));
  removal.observations = removal.observations.filter(
    (o) => o.id !== "D12-removed-search-visibility",
  );
  const missing = await score(evidence);
  expect(missing.foundation).toBe("incomplete");
  expect(missing.points.template).toBe(61);
  expect(missing.criticalMissing).toContain("D12-removed-search-visibility");
  const noncritical = recorded();
  must(
    must(must(noncritical.runs[0]).cases.find((c) => c.caseId === "D11")).observations[0],
  ).status = "failed";
  expect(await score(noncritical)).toMatchObject({
    foundation: "failed",
    points: { template: 61 },
  });
});
it("does not ignore incomplete paths advertised as supplied after the numerical threshold passes", async () => {
  const evidence = recorded();
  must(evidence.declarations[0]).cases.push(
    ...must(recorded(discourse, ["D14"], "project-hook").declarations[0]).cases,
  );
  expect(await score(evidence)).toMatchObject({
    foundation: "incomplete",
    suppliedIncomplete: ["D14"],
    points: { template: 66 },
  });
});
it("retains raw failures and skipped outcomes regardless of run order or later passes", async () => {
  const evidence = recorded();
  const failed = structuredClone(must(evidence.runs[0]));
  failed.id = "second-attempt";
  must(
    must(failed.cases.find((c) => c.caseId === "D03")).observations.find(
      (o) => o.id === "D03-atomicity",
    ),
  ).status = "failed";
  evidence.runs.push(failed);
  const forward = await score(evidence);
  evidence.runs.reverse();
  expect(await score(evidence)).toEqual(forward);
  expect(forward.criticalFailures).toEqual(["D03-atomicity"]);
  must(
    must(failed.cases.find((c) => c.caseId === "D03")).observations.find(
      (o) => o.id === "D03-atomicity",
    ),
  ).status = "skipped";
  expect(must((await score(evidence)).rows.find((r) => r.id === "D03")).status).toBe("missing");
});
it("a current interrupted attempt cannot borrow a previous complete pass", async () => {
  const evidence = recorded();
  const interrupted = structuredClone(must(evidence.runs[0]));
  interrupted.id = "interrupted";
  interrupted.status = "interrupted";
  interrupted.finishedAt = null;
  must(interrupted.cases[0]).observations = [];
  evidence.runs.push(interrupted);
  expect((await score(evidence)).points.template).toBe(0);
});
it("cannot hide a matching-input failure by relabeling its origin or implementation reference", async () => {
  const evidence = recorded();
  const alternate = structuredClone(must(evidence.runs[0]));
  alternate.id = "contradictory-origin";
  const failed = must(alternate.cases.find((r) => r.caseId === "D03"));
  failed.origin = "product-recipe";
  failed.implementationReference = "different-origin@1.0.0";
  must(failed.observations.find((o) => o.id === "D03-atomicity")).status = "failed";
  evidence.runs.push(alternate);
  expect(await score(evidence)).toMatchObject({
    foundation: "failed",
    criticalFailures: ["D03-atomicity"],
  });
});

it.each([
  [
    "observation",
    (e: BenchmarkEvidence) => {
      firstCase(e).observations.push(structuredClone(firstObservation(e)));
    },
  ],
  [
    "case",
    (e: BenchmarkEvidence) => {
      must(e.runs[0]).cases.push(structuredClone(firstCase(e)));
    },
  ],
  [
    "run",
    (e: BenchmarkEvidence) => {
      e.runs.push(structuredClone(must(e.runs[0])));
    },
  ],
  [
    "declaration",
    (e: BenchmarkEvidence) => {
      e.declarations.push(structuredClone(must(e.declarations[0])));
    },
  ],
] as const)("rejects duplicate %s identities", async (_label, mutate) => {
  const evidence = recorded();
  mutate(evidence);
  await expect(score(evidence)).rejects.toThrow("Duplicate");
});
it("rejects unknown-case and unknown/foreign-observation passes", async () => {
  const evidence = recorded();
  firstCase(evidence).caseId = "D99";
  await expect(score(evidence)).rejects.toThrow("Unknown/foreign case");
  firstCase(evidence).caseId = "D01";
  for (const id of ["D01-invented-pass", "D02-category-grants", "V01-customer-admin-sessions"]) {
    firstObservation(evidence).id = id;
    await expect(score(evidence)).rejects.toThrow("Unknown/foreign observation");
  }
});
it("rejects omitted fingerprints, unknown evidence fields and unfinished completed records", async () => {
  const evidence = recorded();
  Reflect.deleteProperty(must(evidence.runs[0]).inputs, "dependencyLockHash");
  await expect(score(evidence)).rejects.toThrow();
  const extra = recorded();
  Reflect.set(extra, "implemented", true);
  await expect(score(extra)).rejects.toThrow();
  const unfinished = recorded();
  must(unfinished.runs[0]).finishedAt = null;
  await expect(score(unfinished)).rejects.toThrow("Completed runs must finish");
});

it("rejects changed frozen data even if the caller mutates a previously parsed ledger", async () => {
  const changed = structuredClone(discourse);
  must(changed.manifest.capabilities[0]).description = "changed";
  await expect(evaluateBenchmark(changed, inputsFor())).rejects.toThrow(
    "Frozen benchmark hash mismatch",
  );
  const wrong = inputsFor();
  wrong.manifestHash = fingerprint("other manifest");
  await expect(evaluateBenchmark(discourse, wrong)).rejects.toThrow("Evaluation inputs");
});
it("rejects malformed manifests, duplicated observations, missing categories, bad N/A and cyclic dependencies", async () => {
  const mutations: ((m: BenchmarkManifest, r: BenchmarkLedger["requirements"]) => void)[] = [
    (m) => {
      Reflect.set(m, "implemented", true);
    },
    (m) => {
      must(m.capabilities[0]).weight++;
    },
    (m) => {
      must(m.capabilities[0]).id = "V01";
    },
    (m) => {
      m.capabilities.reverse();
    },
    (m) => {
      must(m.workloadProfile.mix[0]).percent++;
    },
    (m) => {
      must(m.capabilities[0]).dependencies = ["D99"];
    },
    (m) => {
      must(m.capabilities[0]).dependencies = ["D02"];
    },
    (m) => {
      must(m.capabilities[2]).critical = false;
    },
    (_m, r) => {
      r.observations.push(structuredClone(must(r.observations[0])));
    },
    (_m, r) => {
      must(r.observations[0]).caseId = "D02";
    },
    (_m, r) => {
      must(r.observations[0]).category = "rejection";
    },
    (_m, r) => {
      r.notApplicable.push({
        caseId: "D01",
        category: "failure",
        reason: "Contradicts existing material failure",
      });
    },
    (_m, r) => {
      r.notApplicable.push({ caseId: "D99", category: "failure", reason: "Unknown case" });
    },
  ];
  for (const mutate of mutations) {
    const manifest = structuredClone(discourse.manifest);
    const requirements = structuredClone(discourse.requirements);
    mutate(manifest, requirements);
    await expect(repin(manifest, requirements)).rejects.toThrow();
  }
});
it("requires a newer version and exposes requirement/weight changes in a deterministic diff", async () => {
  const manifest = structuredClone(discourse.manifest);
  must(manifest.capabilities[0]).weight++;
  must(manifest.capabilities[1]).weight--;
  const sameVersion = await repin(manifest);
  expect(() => diffBenchmarkVersions(discourse, sameVersion)).toThrow("newer benchmark version");
  manifest.version = "v2";
  const requirements = structuredClone(discourse.requirements);
  requirements.version = "v2";
  must(requirements.observations[0]).expected = "Reviewed new expectation";
  const next = await repin(manifest, requirements);
  const changes = diffBenchmarkVersions(discourse, next);
  expect(changes).toContain("manifest.capabilities[0].weight: 5 -> 6");
  expect(changes.some((line) => line.startsWith("requirements.observations[0].expected:"))).toBe(
    true,
  );
  expect(diffBenchmarkVersions(discourse, discourse)).toEqual([]);
});
it("produces deterministic JSON/text summaries without depending on evidence order or object key order", async () => {
  const evidence = recorded();
  const before = await score(evidence);
  must(evidence.runs[0]).cases.reverse();
  for (const row of must(evidence.runs[0]).cases) row.observations.reverse();
  must(evidence.runs[0]).inputs = Object.fromEntries(
    Object.entries(must(evidence.runs[0]).inputs).reverse(),
  ) as BenchmarkInputs;
  const after = await score(evidence);
  expect(benchmarkSummaryJson(after)).toBe(benchmarkSummaryJson(before));
  expect(JSON.parse(benchmarkSummaryJson(after))).toEqual(after);
  expect(benchmarkSummaryText(after)).toBe(benchmarkSummaryText(before));
  expect(benchmarkSummaryText(after)).toContain("Verified template: 66/100 (shared 66, domain 0)");
});
