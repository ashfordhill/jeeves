import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { tinyurlDesignScope, unresolvedDesignScope } from "./design-scope.ts";
import { isStructural } from "./findings.ts";
import legacyFixture from "./fixtures/nc01-schema2.json" with { type: "json" };
import ownershipFixture from "./fixtures/nc02-ownership-v1.json" with { type: "json" };
import fixture from "./fixtures/nc03-create-v1.json" with { type: "json" };
import {
  buildOperationsCommand,
  createLinkOperation,
  createLinkSignature,
  designOperations,
  emptyOperationContracts,
  exactContractRefSchema,
  findingsForOperationBinding,
  knownCreateSignature,
  operationChanges,
  operationContractFindings,
  operationContractsSchema,
  operationDisplayName,
  previewOperations,
} from "./operation-contracts.ts";
import {
  buildOwnershipCommand,
  cleanOwnershipChange,
  designOwnership,
  ownershipSchema,
  previewOwnership,
} from "./ownership.ts";
import {
  designBlueprint,
  designBlueprintV3,
  designBlueprintV3Schema,
  unsupportedBlueprintV2,
} from "./studio-blueprint.ts";
import { buildStudioCommand } from "./studio-operations.ts";
import { studioChanges } from "./studio-review.ts";

const legacy = () => designSchema.parse(structuredClone(legacyFixture.design));
const model = () => operationContractsSchema.parse(structuredClone(fixture));
const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error("Missing fixture");
  return value;
};
const apply = (design: DesignDocument, ops: Parameters<typeof applyOperations>[1]) => {
  const result = applyOperations(design, ops);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
const alignedLegacy = () => {
  const design = legacy();
  const settings = required(
    design.architecture?.studio?.elements.find((x) => x.element === "shorten"),
  ).settings;
  if ("requestTimeoutMs" in settings) settings.requestTimeoutMs = 10000;
  return design;
};
const owned = () =>
  apply(
    alignedLegacy(),
    buildOwnershipCommand(alignedLegacy(), {
      ownership: ownershipSchema.parse(ownershipFixture),
      upgrade: true,
    }).ops,
  );
const bound = () => apply(owned(), buildOperationsCommand(owned(), { operations: model() }).ops);
const canonical = (value: unknown): string =>
  JSON.stringify(
    value && typeof value === "object"
      ? Array.isArray(value)
        ? value.map((x) => JSON.parse(canonical(x)))
        : Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, v]) => [k, JSON.parse(canonical(v))]),
          )
      : value,
  );
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

describe("exact finite Create link declarations", () => {
  it("binds hashes to the actual immutable schemas and full behavior, independent of runtime availability", () => {
    expect(hash(createLinkOperation.definition)).toBe(createLinkOperation.ref.sha256);
    for (const schema of Object.values(createLinkOperation.definition.schemas))
      expect(hash(schema.definition)).toBe(schema.ref.sha256);
    expect(Object.isFrozen(createLinkOperation.definition.behavior)).toBe(true);
    expect(createLinkOperation.definition.behavior.authentication).not.toHaveProperty(
      "adapterAvailability",
    );
    const changed = structuredClone(createLinkOperation.definition);
    changed.behavior.allocation.maxAttempts = 6;
    expect(hash(changed)).not.toBe(createLinkOperation.ref.sha256);
    expect(createLinkOperation.definition.behavior.allocation).toMatchObject({
      entropyBytes: 16,
      characters: 22,
      maxAttempts: 5,
    });
    expect(createLinkOperation.definition.behavior.idempotency.successRetentionHours).toBe(24);
    expect(createLinkOperation.definition.behavior.validation.order[1]).toContain(
      "even after link expiry",
    );
    expect(createLinkOperation.definition.behavior.idempotency.concurrent).toContain(
      "become observable",
    );
    expect(createLinkOperation.definition.behavior.transport.timeoutMs).toBe(10000);
    expect(
      createLinkOperation.definition.schemas.errors.definition.oneOf.map(
        (x) => x.properties.body.properties.code.const,
      ),
    ).toEqual([
      "invalid-input",
      "unauthenticated",
      "idempotency-conflict",
      "allocation-exhausted",
      "dependency-failure",
    ]);
  });
  it("preserves schema2 and explicit upgrade/empty-scope v2 refusal; v3 retains a complete contract snapshot", () => {
    const old = legacy();
    expect(designBlueprint(old)).toEqual(legacyFixture.blueprint);
    expect(designOperations(old)).toEqual(emptyOperationContracts());
    expect(() => buildOperationsCommand(old, { operations: model() })).toThrow(
      "explicitly upgrade",
    );
    expect(previewOperations(old, model()).canApply).toBe(false);
    expect(previewOperations(alignedLegacy(), model()).canApply).toBe(true);
    expect(old).toEqual(legacyFixture.design);
    const upgraded = apply(
      alignedLegacy(),
      buildOperationsCommand(alignedLegacy(), { operations: model(), upgrade: true }).ops,
    );
    expect(upgraded.schemaVersion).toBe(3);
    expect(unsupportedBlueprintV2(upgraded)).toEqual([
      {
        path: ["operations", "receivers", 0],
        reason: "Exact operation receivers binding is unsupported by blueprint v2.",
      },
      {
        path: ["operations", "calls", 0],
        reason: "Exact operation calls binding is unsupported by blueprint v2.",
      },
    ]);
    expect(() => designBlueprint(upgraded)).toThrow("?version=3");
    const design = bound(),
      bp = designBlueprintV3(design);
    expect(bp.operations).toEqual(model());
    expect(designBlueprintV3Schema.parse(bp)).toEqual(bp);
    expect({
      operations: bp.operations,
      operationCatalog: bp.operationCatalog,
      operationFindings: bp.operationFindings,
      templateAvailability: bp.templateAvailability,
      runtimeVerification: bp.runtimeVerification,
    }).toMatchSnapshot();
    expect(studioChanges(owned(), design).map((x) => x.type)).toContain("operations");
    expect(designSchema.parse(JSON.parse(JSON.stringify(design)))).toEqual(design);
    const scoped = apply(design, [{ op: "setDesignScope", scope: tinyurlDesignScope() }]);
    const unresolved = unresolvedDesignScope(scoped);
    expect(unresolved.some((x) => x.id === "create-contract")).toBe(false);
    expect(unresolved.some((x) => x.id === "namespace-authority")).toBe(true);
    expect(unresolved.some((x) => x.id === "resolve-contract")).toBe(true);
    expect(unresolved.some((x) => x.id === "expiry-cache-contract")).toBe(true);
    expect(unresolved.some((x) => x.requirement.includes("auth verifier"))).toBe(true);
  });
  it("refuses malformed exact versions/hashes and known payload/auth/idempotency/deadline contradictions atomically", () => {
    for (const version of ["01.0.0", "1.0", "latest", "1.0.0-beta", `${"1".repeat(41)}.0.0`])
      expect(
        exactContractRefSchema.safeParse({ ...createLinkOperation.ref, version }).success,
      ).toBe(false);
    expect(
      exactContractRefSchema.safeParse({ ...createLinkOperation.ref, sha256: "ABC" }).success,
    ).toBe(false);
    const before = owned();
    for (const edit of [
      (m: ReturnType<typeof model>) => {
        required(m.calls[0]).expects.auth = "public";
      },
      (m: ReturnType<typeof model>) => {
        required(m.calls[0]).expects.idempotency = "none";
      },
      (m: ReturnType<typeof model>) => {
        required(m.receivers[0]).implementation.request = {
          ...createLinkOperation.definition.schemas.success.ref,
        };
      },
      (m: ReturnType<typeof model>) => {
        required(m.calls[0]).expects.timeoutMs = 20000;
      },
      (m: ReturnType<typeof model>) => {
        required(m.calls[0]).receiverRole = "redirect";
      },
      (m: ReturnType<typeof model>) => {
        const c = required(m.calls[0]);
        if (c.caller.kind === "entry") c.caller.lane = "download";
      },
    ]) {
      const next = model();
      edit(next);
      expect(previewOperations(before, next).canApply).toBe(false);
      expect(applyOperations(before, [{ op: "setOperations", operations: next }]).ok).toBe(false);
    }
    expect(designOperations(before)).toEqual(emptyOperationContracts());
    const malformed = structuredClone(fixture);
    required(malformed.receivers[0]).binding.kind = "resolve-link";
    expect(operationContractsSchema.safeParse(malformed).success).toBe(false);
  });
  it("keeps unknown versions/hash/configuration saveable without applying create-specific semantics", () => {
    const next = model(),
      receiver = required(next.receivers[0]),
      call = required(next.calls[0]);
    receiver.implementation.operation = {
      ...createLinkOperation.ref,
      id: "future-operation",
      version: "99.1.0",
      sha256: "a".repeat(64),
    };
    receiver.implementation.request = { ...createLinkOperation.definition.schemas.success.ref };
    receiver.implementation.success = { ...createLinkOperation.definition.schemas.request.ref };
    receiver.role = "redirect";
    receiver.binding.storeConnection = "redirect-cache";
    if (receiver.binding.kind !== "create-link") throw new Error();
    receiver.binding.successRetentionHours = null;
    receiver.implementation.auth = "public";
    receiver.implementation.idempotency = "none";
    receiver.implementation.timeoutMs = 77;
    call.expects = structuredClone(receiver.implementation);
    call.receiverRole = "redirect";
    call.caller = {
      kind: "entry",
      entry: "download-redirect",
      lane: "download",
      element: "redirect",
    };
    const design = apply(owned(), [{ op: "setOperations", operations: next }]);
    expect(designOperations(design)).toEqual(next);
    expect(operationDisplayName(receiver.implementation)).toBe("Unknown future-operation@99.1.0");
    expect(operationContractFindings(design).every((x) => !isStructural(x))).toBe(true);
    expect(
      operationContractFindings(design)
        .map((x) => x.message)
        .join(" "),
    ).not.toMatch(/24-hour|auth verifier|source authority|Create link/);
    const unknownHash = model();
    required(unknownHash.receivers[0]).implementation.request.sha256 = "b".repeat(64);
    expect(previewOperations(owned(), unknownHash).canApply).toBe(true);
    expect(knownCreateSignature(required(unknownHash.receivers[0]).implementation)).toBe(false);
    expect(
      previewOperations(owned(), unknownHash).findings.some(
        (x) => x.target.path?.at(-1) === "request" && x.code === "CONFIG_REQUIRED",
      ),
    ).toBe(true);
    expect(designBlueprintV3(design).operations).toEqual(next);
  });
  it("uses separate binding IDs for multiple operations on one API/entry and refuses duplicate identities/routes", () => {
    const next = model(),
      unknown = structuredClone(required(next.receivers[0]));
    unknown.id = "future-create";
    unknown.implementation.operation = {
      ...unknown.implementation.operation,
      id: "future-operation",
    };
    next.receivers.push(unknown);
    next.calls.push({
      ...structuredClone(required(next.calls[0])),
      id: "future-call",
      receiverBinding: unknown.id,
      expects: structuredClone(unknown.implementation),
    });
    expect(previewOperations(owned(), next).canApply).toBe(true);
    expect(
      designOperations(apply(owned(), [{ op: "setOperations", operations: next }])).receivers,
    ).toHaveLength(2);
    const multi = apply(owned(), [{ op: "setOperations", operations: next }]);
    expect(
      findingsForOperationBinding(multi, "create-link")
        .map((x) => x.message)
        .join(" "),
    ).toContain("auth verifier");
    expect(
      findingsForOperationBinding(multi, "future-create")
        .map((x) => x.message)
        .join(" "),
    ).not.toContain("auth verifier");
    const duplicate = model();
    duplicate.receivers.push({
      ...structuredClone(required(duplicate.receivers[0])),
      id: "duplicate-route",
    });
    expect(previewOperations(owned(), duplicate).canApply).toBe(false);
    const ids = model();
    ids.calls.push({ ...structuredClone(required(ids.calls[0])) });
    expect(previewOperations(owned(), ids).canApply).toBe(false);
    const pair = model();
    pair.calls.push({ ...structuredClone(required(pair.calls[0])), id: "different-id" });
    expect(previewOperations(owned(), pair).canApply).toBe(false);
  });
  it("requires explicit same-owner source write grants and keeps missing retention/verifier/call declarations unresolved", () => {
    const design = owned(),
      next = model();
    const binding = required(next.receivers[0]).binding;
    if (binding.kind !== "create-link") throw new Error();
    binding.successRetentionHours = null;
    binding.authVerifier = {
      id: "unknown-verifier",
      version: "1.0.0",
      sha256: "c".repeat(64),
    };
    next.calls = [];
    const preview = previewOperations(design, next);
    expect(preview.canApply).toBe(true);
    expect(preview.findings.map((x) => x.target.path?.at(-1))).toEqual(
      expect.arrayContaining(["role", "successRetentionHours", "authVerifier"]),
    );
    const read = designOwnership(design);
    required(read.grants.find((x) => x.role === "shorten")).access = "read";
    required(read.dependencies.find((x) => x.connection === "shorten-db")).access = "read";
    const readOnly = apply(design, [{ op: "setOwnership", ownership: read }]);
    expect(previewOperations(readOnly, model()).canApply).toBe(false);
    const missing = designOwnership(owned());
    missing.grants = missing.grants.filter((x) => x.role !== "shorten");
    const incomplete = apply(owned(), [{ op: "setOwnership", ownership: missing }]);
    expect(previewOperations(incomplete, model()).canApply).toBe(true);
    expect(
      previewOperations(incomplete, model()).findings.some((x) =>
        x.message.includes("write role grant"),
      ),
    ).toBe(true);
    expect(
      designOwnership(bound()).dependencies.find((x) => x.connection === "redirect-db")?.access,
    ).toBe("read");
  });
  it("preserves stable binding IDs on rename and previews exact dependent clears on ownership transfer, entries and store edge removal", () => {
    const before = bound(),
      renamed = apply(
        before,
        buildStudioCommand(before, { type: "edit", element: "shorten", name: "Link creator" }).ops,
      );
    expect(designOperations(renamed)).toEqual(designOperations(before));
    const ownership = structuredClone(designOwnership(before));
    ownership.owners.push({ id: "other", name: "Other" });
    required(ownership.roles.find((x) => x.element === "shorten")).owner = "other";
    const cleaned = cleanOwnershipChange(before, ownership),
      preview = previewOwnership(before, cleaned);
    expect(preview.operationChanges.map((x) => x.id)).toEqual(["create-link", "create-upload"]);
    expect(preview.operationChanges.every((x) => x.change === "removed")).toBe(true);
    const transferred = apply(before, buildOwnershipCommand(before, { ownership: cleaned }).ops);
    expect(designOperations(transferred)).toEqual(emptyOperationContracts());
    const removed = apply(
      before,
      buildStudioCommand(before, { type: "removeLink", link: "shorten-db" }).ops,
    );
    expect(designOperations(removed)).toEqual(emptyOperationContracts());
    const linked = apply(before, [
      {
        op: "connect",
        connection: {
          id: "stats-create",
          kind: "calls",
          from: { element: "stats-api" },
          to: { element: "shorten" },
          planned: {
            label: "Create",
            protocol: "HTTPS",
            interaction: "Request / response",
            security: "User identity",
          },
        },
      },
    ]);
    const entryRemoved = apply(
      linked,
      buildStudioCommand(linked, { type: "removeLink", link: "upload-shorten" }).ops,
    );
    expect(designOperations(entryRemoved).receivers).toEqual(model().receivers);
    expect(designOperations(entryRemoved).calls).toEqual([]);
    const movable = apply(
      before,
      buildStudioCommand(before, { type: "removeTile", tile: "stats-api" }).ops,
    );
    const studio = structuredClone(required(movable.architecture?.studio));
    required(studio.entries?.find((x) => x.id === "upload-shorten")).lane = "download";
    // setStudio records a changed entry identity and clears its exact old binding, never retargets it.
    const moved = apply(movable, [{ op: "setStudio", studio }]);
    expect(designOperations(moved).calls).toEqual([]);
    expect(operationChanges(designOperations(before), designOperations(removed))).toHaveLength(2);
    expect(before).toEqual(bound());
  });
  it("keeps matching contracts compatible while exposing finite transport/retry/principal gaps on actual service calls", () => {
    const before = owned(),
      architecture = structuredClone(required(before.architecture)),
      studio = required(architecture.studio),
      client = required(studio.elements.find((x) => x.element === "stats-api"));
    // A separate API caller enters the same target; caller and graph endpoints are explicit.
    studio.entries = studio.entries?.filter((x) => x.id !== "upload-shorten");
    const connection = {
      id: "stats-create",
      kind: "calls" as const,
      from: { element: "stats-api" },
      to: { element: "shorten" },
      planned: {
        label: "Create",
        protocol: "HTTPS",
        interaction: "Request / response" as const,
        security: "Service identity" as const,
      },
    };
    const seeded = apply(before, [
      { op: "connect", connection },
      { op: "setArchitecture", architecture },
    ]);
    const next = model();
    next.calls = [
      {
        id: "service-call",
        caller: { kind: "connection", connection: connection.id, role: client.element },
        receiverBinding: "create-link",
        receiverRole: "shorten",
        expects: createLinkSignature(),
      },
    ];
    expect(previewOperations(seeded, next).canApply).toBe(true);
    const boundCall = apply(seeded, [{ op: "setOperations", operations: next }]);
    expect(
      findingsForOperationBinding(boundCall, "create-link").some(
        (x) => x.target.connection === connection.id,
      ),
    ).toBe(true);
    expect(
      previewOperations(seeded, next).findings.some((x) =>
        x.message.includes("verified user principal"),
      ),
    ).toBe(true);
    const changed = structuredClone(seeded);
    required(changed.architecture?.studio).connections.push({
      connection: connection.id,
      settings: { timeoutMs: 20000 },
    });
    expect(previewOperations(changed, next).canApply).toBe(false);
    required(required(changed.architecture?.studio).connections.at(-1)).settings = {
      timeoutMs: 10000,
      retry: { mode: "fixed", attempts: 2, delayMs: 20 },
    };
    expect(previewOperations(changed, next).canApply).toBe(true);
    expect(
      previewOperations(changed, next).findings.some((x) =>
        x.message.includes("same-key/principal"),
      ),
    ).toBe(true);
    required(changed.connections.find((x) => x.id === connection.id)).planned.interaction =
      "Asynchronous";
    expect(previewOperations(changed, next).canApply).toBe(false);
    expect(designOperations(seeded)).toEqual(emptyOperationContracts());
  });
});
