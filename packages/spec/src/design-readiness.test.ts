import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, jsonBytes } from "./content-hash.ts";
import { designSchema } from "./design.ts";
import { designReadiness } from "./design-readiness.ts";
import legacy from "./fixtures/nc01-schema2.json" with { type: "json" };
import { compatibleResolveDesign } from "./fixtures/nc04-compatible.ts";
import operationFixture from "./fixtures/nc04-resolve-v1.json" with { type: "json" };
import { narrowReadinessDesign } from "./fixtures/nc05-narrow.ts";
import {
  type ExactContractRef,
  operationContractsSchema,
  positiveCachePolicy,
} from "./operation-contracts.ts";
import {
  generationReceiptSchema,
  runtimeEvidenceSchema,
  type TrustedReadinessContext,
  templateManifestSchema,
} from "./readiness-artifacts.ts";
import {
  readinessSubject,
  tinyurlReadinessProfile,
  tinyurlReadinessProfileRef,
  tinyurlRuntimeCases,
} from "./readiness-subject.ts";
import { designReadinessSchema } from "./readiness-types.ts";
import { designBlueprint, designBlueprintV3, designBlueprintV3Schema } from "./studio-blueprint.ts";

const required = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error("Required fixture field");
  return v;
};
// Independent Node crypto oracle; product uses the portable SHA256 implementation.
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const codes = (
  result: ReturnType<typeof designReadiness>,
  stage: "implementationAvailability" | "runtimeEvidence" | "contractCompleteness",
) => result[stage].blockers.map((item) => item.code);

/** Trust plumbing fixtures only. These bytes are NOT generated software or runtime proof. */
function artifacts() {
  const contents = new Map<string, Uint8Array>();
  const key = (ref: ExactContractRef) => canonicalJson(ref);
  const put = (id: string, value: unknown): ExactContractRef => {
    const bytes = value instanceof Uint8Array ? value : jsonBytes(value);
    const ref = { id, version: "1.0.0", sha256: hash(bytes) };
    contents.set(key(ref), bytes);
    return ref;
  };
  const design = narrowReadinessDesign();
  if (design.schemaVersion !== 3) throw new Error();
  const verifier = put("fixture-verifier", new Uint8Array([1, 2, 3])),
    receiver = required(design.operations?.receivers[0]);
  if (receiver.binding.kind !== "create-link") throw new Error();
  receiver.binding.authVerifier = verifier;
  const manifest = templateManifestSchema.parse({
    format: "jeeves.template-manifest.v1",
    composition: readinessSubject(design),
    templates: [put("fixture-template", new Uint8Array([4, 5, 6]))],
    dependencies: [put("fixture-lock", new Uint8Array([7, 8, 9]))],
    authVerifiers: [verifier],
  });
  const manifestRef = put("fixture-manifest", manifest),
    compositionSha256 = hash(jsonBytes(readinessSubject(design)));
  const suite = put("fixture-suite", {
    format: "jeeves.runtime-suite.v1",
    cases: tinyurlRuntimeCases,
  });
  const receipt = generationReceiptSchema.parse({
    format: "jeeves.generated-receipt.v1",
    compositionSha256,
    profile: tinyurlReadinessProfileRef,
    manifest: manifestRef,
    templates: manifest.templates,
    dependencies: manifest.dependencies,
    authVerifiers: manifest.authVerifiers,
    output: put("fixture-output", new Uint8Array([10, 11, 12])),
    verification: {
      suite,
      environment: {
        id: "fixture-linux",
        imageSha256: "1".repeat(64),
        configurationSha256: "2".repeat(64),
      },
      notBefore: 100,
      notAfter: 200,
    },
  });
  const receiptRef = put("fixture-receipt", receipt);
  const evidence = runtimeEvidenceSchema.parse({
    format: "jeeves.runtime-evidence.v1",
    receipt: receiptRef,
    compositionSha256,
    profile: tinyurlReadinessProfileRef,
    manifest: manifestRef,
    templates: manifest.templates,
    dependencies: manifest.dependencies,
    authVerifiers: manifest.authVerifiers,
    output: receipt.output,
    suite,
    environment: receipt.verification.environment,
    completedAt: 150,
    outcomes: tinyurlRuntimeCases.map((caseId) => ({ case: caseId, outcome: "pass" })),
  });
  const context: TrustedReadinessContext = {
    manifest: manifestRef,
    expectedReceipt: receiptRef,
    evidence: put("fixture-evidence", evidence),
    resolve: (ref) => contents.get(key(ref)),
  };
  return { design, context, put, contents, key, manifest, receipt, evidence };
}

describe("one exact snapshot readiness report", () => {
  it("separates structural validity, exact contracts, artifacts and output evidence without changing the design", () => {
    const design = narrowReadinessDesign(),
      before = structuredClone(design),
      result = designReadiness(design);
    expect(result).toMatchObject({
      designValidity: { status: "valid" },
      contractCompleteness: { status: "complete", blockers: [] },
      implementationAvailability: { status: "unavailable" },
      runtimeEvidence: { status: "none" },
      generationEligible: false,
    });
    expect(codes(result, "implementationAvailability")).toEqual([
      "AUTH_VERIFIER_UNAVAILABLE",
      "MANIFEST_UNAVAILABLE",
    ]);
    expect(result.implementationAvailability.blockers[0]?.target).toEqual({
      element: "create-api",
      operation: "create-link",
    });
    expect(designReadinessSchema.parse(result)).toEqual(result);
    expect(designBlueprintV3(design).readiness).toEqual(result);
    expect(designBlueprintV3Schema.parse(designBlueprintV3(design))).toEqual(
      designBlueprintV3(design),
    );
    expect(hash(jsonBytes(result.composition.subject))).toBe(result.composition.sha256);
    expect(design).toEqual(before);
    expect(() => designBlueprint(design)).toThrow("version=3");
  });
  it("keeps old/generic and extended legacy behavior incomplete even when known operations exist", () => {
    const old = designSchema.parse(legacy.design),
      oldBytes = JSON.stringify(old),
      before = designBlueprint(old);
    expect(designReadiness(old).contractCompleteness.status).toBe("incomplete");
    expect(designReadiness(old).generationEligible).toBe(false);
    expect(designBlueprint(old)).toEqual(before);
    expect(JSON.stringify(old)).toBe(oldBytes);
    const extended = compatibleResolveDesign();
    if (extended.schemaVersion !== 3) throw new Error();
    extended.operations = operationContractsSchema.parse(operationFixture);
    const result = designReadiness(extended);
    expect(result.contractCompleteness.blockers).toContainEqual(
      expect.objectContaining({
        code: "BEHAVIOR_UNREPRESENTED",
        target: expect.objectContaining({ element: "analytics" }),
      }),
    );
    expect(result.generationEligible).toBe(false);
  });
  it("uses the complete structural validator, including IDs and C1 references", () => {
    const design = narrowReadinessDesign();
    design.elements.push(structuredClone(required(design.elements[0])));
    required(design.architecture).relationships.push({
      id: "missing-context",
      from: "missing",
      to: "system",
      container: "create-api",
      description: "Intent",
    });
    const report = designReadiness(design);
    expect(report.designValidity.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_ID", "UNKNOWN_REFERENCE"]),
    );
    expect(report.designValidity.status).toBe("invalid");
    expect(report.contractCompleteness.status).toBe("incomplete");
  });
  it("maps numeric validator paths to canonical tiles/edges without using sorted subject indexes", () => {
    const design = narrowReadinessDesign(),
      studio = required(design.architecture?.studio);
    studio.elements.reverse();
    const binding = required(studio.elements.find((item) => item.element === "links-db"));
    binding.definition.version = "99.0.0";
    studio.connections = [{ connection: "resolve-store", settings: { channelUse: "publish" } }];
    const report = designReadiness(design);
    expect(report.implementationAvailability.blockers).toContainEqual(
      expect.objectContaining({
        code: "NEEDS_TEMPLATE",
        target: expect.objectContaining({
          element: "links-db",
          path: ["architecture", "studio", "elements", 1, "definition"],
        }),
      }),
    );
    expect(report.designValidity.blockers).toContainEqual(
      expect.objectContaining({ target: expect.objectContaining({ connection: "resolve-store" }) }),
    );
  });
  it.each([
    "retention",
    "cache-policy",
    "unknown-operation",
    "unknown-profile",
    "grant",
    "custom",
    "excluded",
  ])("blocks the actual %s contract gap", (kind) => {
    const design = narrowReadinessDesign();
    if (design.schemaVersion !== 3) throw new Error();
    const receiver = required(design.operations?.receivers[0]),
      resolve = required(design.operations?.receivers[1]);
    if (kind === "retention" && receiver.binding.kind === "create-link")
      receiver.binding.successRetentionHours = null;
    if (kind === "cache-policy" && resolve.binding.kind === "resolve-link")
      resolve.binding.cachePolicy = { ...positiveCachePolicy.ref, sha256: "a".repeat(64) };
    if (kind === "unknown-operation") receiver.implementation.operation.version = "99.0.0";
    if (kind === "unknown-profile" && design.scope.profile) design.scope.profile.version = "99.0.0";
    if (kind === "grant") required(design.ownership).grants = [];
    if (kind === "custom")
      design.scope.customRequirements.push({
        id: "custom",
        requirement: "Do necessary custom work",
        criticality: "required",
      });
    if (kind === "excluded")
      required(
        design.scope.requirements.find((item) => item.feature === "exact-analytics"),
      ).disposition = "included";
    expect(designReadiness(design).contractCompleteness.status).toBe("incomplete");
  });
  it("keeps unknown concrete verifier availability separate from known auth behavior and surfaces advisories", () => {
    const design = narrowReadinessDesign();
    if (design.schemaVersion !== 3) throw new Error();
    const receiver = required(design.operations?.receivers[0]);
    if (receiver.binding.kind !== "create-link") throw new Error();
    receiver.binding.authVerifier = {
      id: "unknown-verifier",
      version: "9.0.0",
      sha256: "a".repeat(64),
    };
    design.scope.customRequirements.push({
      id: "advisory",
      requirement: "Explore analytics later",
      criticality: "advisory",
    });
    const result = designReadiness(design);
    expect(result.contractCompleteness.status).toBe("complete");
    expect(result.implementationAvailability.status).toBe("unavailable");
    expect(result.advisories).toContainEqual(
      expect.objectContaining({
        code: "REQUIREMENT_UNRESOLVED",
        message: expect.stringContaining("Explore analytics"),
      }),
    );
  });
  it("requires explicit Create reads as well as writes without rewriting old write-only intent", () => {
    const design = narrowReadinessDesign();
    if (design.schemaVersion !== 3 || !design.ownership) throw new Error();
    required(design.ownership.grants[0]).access = "write";
    required(design.ownership.dependencies[0]).access = "write";
    const before = structuredClone(design),
      report = designReadiness(design);
    expect(report.designValidity.status).toBe("valid");
    expect(report.contractCompleteness.blockers).toContainEqual(
      expect.objectContaining({
        code: "CONFIG_REQUIRED",
        message: expect.stringContaining("retained-result lookup"),
        target: expect.objectContaining({ operation: "create-link" }),
      }),
    );
    expect(report.contractCompleteness.status).toBe("incomplete");
    expect(design).toEqual(before);
  });
  it.each(["replica", "timeout"])(
    "does not accept an uncovered Create data-access %s promise",
    (mode) => {
      const design = narrowReadinessDesign(),
        studio = required(design.architecture?.studio);
      studio.components = [
        {
          id: "create-data",
          host: "create-api",
          name: "Data access",
          settings: {
            kind: "data-access",
            poolSize: 10,
            readRouting: mode === "replica" ? "replica" : "primary",
            statementTimeoutMs: mode === "timeout" ? 10001 : 1000,
          },
        },
      ];
      studio.componentConnections = [
        {
          id: "create-data-source",
          from: "create-data",
          to: { kind: "element", id: "links-db", via: "create-store" },
        },
      ];
      expect(designReadiness(design).contractCompleteness.blockers).toContainEqual(
        expect.objectContaining({
          code: "BEHAVIOR_UNREPRESENTED",
          message: expect.stringContaining("primary reads within"),
        }),
      );
    },
  );
  it("pins the actual immutable resolved profile definition and excludes future catalog additions", () => {
    expect(tinyurlReadinessProfileRef.sha256).toBe(
      "40130ff2ff51611631a540bb9289c3397de7d02ce162926ecfc279b03c441985",
    );
    const sort = (value: unknown): unknown =>
      value && typeof value === "object"
        ? Array.isArray(value)
          ? value.map(sort)
          : Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, sort((value as Record<string, unknown>)[key])]),
            )
        : value;
    expect(
      createHash("sha256")
        .update(JSON.stringify(sort(tinyurlReadinessProfile.definition)))
        .digest("hex"),
    ).toBe(tinyurlReadinessProfileRef.sha256);
    expect(Object.isFrozen(tinyurlReadinessProfile.definition)).toBe(true);
    expect(tinyurlReadinessProfile.definition.contracts.map((ref) => ref.id)).toEqual([
      "links-create",
      "links-resolve",
      "links-positive-cache",
    ]);
    expect(tinyurlReadinessProfile.definition.requiredRuntimeCases).toEqual(tinyurlRuntimeCases);
  });
  it("normalizes collection/key order and ignores only revision and origin provenance", () => {
    const design = narrowReadinessDesign(),
      before = designReadiness(design).composition.sha256;
    if (design.schemaVersion !== 3) throw new Error();
    design.elements.reverse();
    design.connections.reverse();
    design.revision += 10;
    const studio = required(design.architecture?.studio);
    studio.elements.reverse();
    studio.entries?.reverse();
    studio.actions?.reverse();
    studio.origin = {
      example: { id: "fixture", version: "1.0.0" },
      goalManifestSha256: "f".repeat(64),
    };
    design.scope.requirements.reverse();
    design.operations?.receivers.reverse();
    design.operations?.calls.reverse();
    for (const rows of Object.values(required(design.ownership))) rows.reverse();
    expect(designReadiness(design).composition.sha256).toBe(before);
  });
  it.each([
    "name",
    "description",
    "label",
    "action",
    "setting",
    "provider",
    "language",
    "deployable",
    "grant",
    "dependency",
    "operation",
    "caller",
    "policy",
    "scope",
    "module",
  ])("invalidates exact composition evidence on meaningful %s changes", (kind) => {
    const fixture = artifacts(),
      design = fixture.design;
    if (design.schemaVersion !== 3) throw new Error();
    const studio = required(design.architecture?.studio),
      receiver = required(design.operations?.receivers[0]);
    const settings = required(studio.elements[0]).settings;
    if (kind === "name") required(design.elements[0]).name = "Renamed output identifier";
    if (kind === "description")
      required(design.architecture).system.description = "Changed source prose";
    if (kind === "label") required(design.connections[0]).planned.label = "Changed relationship";
    if (kind === "action") required(studio.actions?.[0]).name = "Read";
    if (kind === "setting" && settings.kind === "service") settings.concurrencyLimit = 10;
    if (kind === "provider") {
      const cache = required(studio.elements[3]);
      if (cache.settings.kind === "cache") cache.settings.provider = "upstash";
    }
    if (kind === "language" && settings.kind === "service") settings.language = "go";
    if (kind === "deployable") required(design.ownership?.roles[0]).deployable = "another-runtime";
    if (kind === "grant") required(design.ownership?.grants[0]).access = "write";
    if (kind === "dependency") required(design.ownership?.dependencies[0]).access = "write";
    if (kind === "operation") receiver.id = "different-binding";
    if (kind === "caller") required(design.operations?.calls[0]).id = "different-call";
    if (kind === "policy") {
      const resolve = required(design.operations?.receivers[1]);
      if (resolve.binding.kind === "resolve-link") resolve.binding.cachePolicy = null;
    }
    if (kind === "scope")
      design.scope.customRequirements.push({
        id: "advisory",
        requirement: "Consider optional work",
        criticality: "advisory",
      });
    if (kind === "module")
      studio.components = [
        { id: "custom", host: "create-api", name: "Custom", settings: { kind: "custom" } },
      ];
    const report = designReadiness(design, fixture.context);
    expect(report.composition.sha256).not.toBe(fixture.receipt.compositionSha256);
    expect(codes(report, "implementationAvailability")).toContain("COMPOSITION_UNSUPPORTED");
    expect(codes(report, "runtimeEvidence")).toContain("RECEIPT_COMPOSITION_MISMATCH");
    expect(report.runtimeEvidence.status).toBe("insufficient");
    expect(report.generationEligible).toBe(false);
  });
});

describe("trusted isolated artifact/evidence resolution", () => {
  it("permits first generation with exact available artifacts without requiring future output evidence", () => {
    const fixture = artifacts(),
      context = { ...fixture.context, expectedReceipt: undefined, evidence: undefined };
    expect(designReadiness(fixture.design, context)).toMatchObject({
      generationEligible: true,
      implementationAvailability: { status: "available" },
      runtimeEvidence: { status: "none" },
    });
    expect(designReadiness(fixture.design).implementationAvailability.status).toBe("unavailable");
  });
  it("exercises a positive trust-plumbing path only for independently pinned exact fixture bytes", () => {
    const fixture = artifacts();
    expect(designReadiness(fixture.design, fixture.context)).toMatchObject({
      generationEligible: true,
      runtimeEvidence: { status: "verified", blockers: [] },
    });
    expect(designReadiness(fixture.design, fixture.context)).toEqual(
      designReadiness(fixture.design, fixture.context),
    );
  });
  it.each([
    "missing",
    "throwing",
    "bad-hash",
    "malformed",
    "unknown-field",
    "missing-template",
    "missing-dependency",
    "wrong-verifier",
  ])("refuses %s manifest/artifact resolution precisely", (mode) => {
    const fixture = artifacts(),
      context = { ...fixture.context };
    if (mode === "missing")
      context.manifest = { id: "missing", version: "1.0.0", sha256: "0".repeat(64) };
    if (mode === "throwing")
      context.resolve = () => {
        throw new Error("Resolver unavailable");
      };
    if (mode === "bad-hash")
      fixture.contents.set(fixture.key(required(context.manifest)), new Uint8Array([0]));
    if (mode === "malformed") context.manifest = fixture.put("bad-manifest", new Uint8Array([255]));
    if (mode === "unknown-field")
      context.manifest = fixture.put("bad-manifest", { ...fixture.manifest, verified: true });
    if (mode === "missing-template")
      fixture.contents.delete(fixture.key(required(fixture.manifest.templates[0])));
    if (mode === "missing-dependency")
      fixture.contents.delete(fixture.key(required(fixture.manifest.dependencies[0])));
    if (mode === "wrong-verifier") {
      fixture.manifest.authVerifiers = [fixture.put("other-verifier", new Uint8Array([99]))];
      context.manifest = fixture.put("other-manifest", fixture.manifest);
    }
    const result = designReadiness(fixture.design, context);
    expect(result.implementationAvailability.status).toBe("unavailable");
    expect(result.runtimeEvidence.status).toBe("insufficient");
    expect(result.generationEligible).toBe(false);
    expect(result.implementationAvailability.blockers.length).toBeGreaterThan(0);
  });
  it.each([
    "receipt",
    "output",
    "composition",
    "profile",
    "manifest",
    "template",
    "dependency",
    "suite",
    "environment",
    "stale",
    "future",
    "incomplete",
    "duplicate",
    "failed",
    "skipped",
  ])("rejects evidence with wrong %s without confusing generation eligibility", (mode) => {
    const fixture = artifacts(),
      evidence = fixture.evidence;
    if (mode === "receipt")
      evidence.receipt = fixture.put("self-asserted-receipt", fixture.receipt);
    if (mode === "output") evidence.output = fixture.put("different-output", new Uint8Array([14]));
    if (mode === "composition") evidence.compositionSha256 = "9".repeat(64);
    if (mode === "profile") evidence.profile = { ...tinyurlReadinessProfileRef, version: "2.0.0" };
    if (mode === "manifest") evidence.manifest.version = "2.0.0";
    if (mode === "template") required(evidence.templates[0]).version = "2.0.0";
    if (mode === "dependency")
      evidence.dependencies = [fixture.put("other-lock", new Uint8Array([15]))];
    if (mode === "suite") evidence.suite = fixture.put("other-suite", { cases: [] });
    if (mode === "environment") evidence.environment.configurationSha256 = "f".repeat(64);
    if (mode === "stale") evidence.completedAt = 99;
    if (mode === "future") evidence.completedAt = 201;
    if (mode === "incomplete") evidence.outcomes.pop();
    if (mode === "duplicate") evidence.outcomes.push(required(evidence.outcomes[0]));
    if (mode === "failed") required(evidence.outcomes[0]).outcome = "fail";
    if (mode === "skipped") required(evidence.outcomes[0]).outcome = "skip";
    fixture.context.evidence = fixture.put("changed-evidence", evidence);
    const result = designReadiness(fixture.design, fixture.context);
    expect(result.generationEligible).toBe(true);
    expect(result.runtimeEvidence.status).toBe("insufficient");
    expect(result.runtimeEvidence.blockers.length).toBeGreaterThan(0);
  });
  it("rejects self-claimed output hashes, missing expected receipts, missing/malformed evidence and missing output content", () => {
    for (const mode of [
      "no-receipt",
      "no-output",
      "bad-evidence",
      "missing-evidence",
      "bad-output",
      "bad-suite",
    ]) {
      const fixture = artifacts();
      if (mode === "no-receipt") fixture.context.expectedReceipt = undefined;
      if (mode === "no-output") fixture.contents.delete(fixture.key(fixture.receipt.output));
      if (mode === "bad-output")
        fixture.contents.set(fixture.key(fixture.receipt.output), new Uint8Array([0]));
      if (mode === "bad-evidence")
        fixture.context.evidence = fixture.put("bad-evidence", {
          verified: true,
          compositionSha256: fixture.receipt.compositionSha256,
        });
      if (mode === "missing-evidence")
        fixture.contents.delete(fixture.key(required(fixture.context.evidence)));
      if (mode === "bad-suite")
        fixture.contents.set(fixture.key(fixture.receipt.verification.suite), new Uint8Array([0]));
      expect(designReadiness(fixture.design, fixture.context).runtimeEvidence.status).toBe(
        "insufficient",
      );
    }
  });
  it("does not allow even a matching manifest to bless generic extras or unrelated modules", () => {
    const fixture = artifacts();
    const studio = required(fixture.design.architecture?.studio);
    studio.components = [
      { id: "custom", host: "create-api", name: "Unknown work", settings: { kind: "custom" } },
    ];
    fixture.manifest.composition = JSON.parse(canonicalJson(readinessSubject(fixture.design)));
    fixture.context.manifest = fixture.put("extra-manifest", fixture.manifest);
    expect(
      designReadiness(fixture.design, { ...fixture.context, evidence: undefined }),
    ).toMatchObject({
      contractCompleteness: { status: "incomplete" },
      implementationAvailability: { status: "available" },
      generationEligible: false,
    });
  });
});
