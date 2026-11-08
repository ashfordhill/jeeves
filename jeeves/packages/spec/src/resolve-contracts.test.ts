import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { tinyurlDesignScope, unresolvedDesignScope } from "./design-scope.ts";
import { isStructural } from "./findings.ts";
import legacy from "./fixtures/nc01-schema2.json" with { type: "json" };
import owners from "./fixtures/nc02-ownership-v1.json" with { type: "json" };
import { compatibleResolveDesign } from "./fixtures/nc04-compatible.ts";
import fixture from "./fixtures/nc04-resolve-v1.json" with { type: "json" };
import {
  buildOperationsCommand,
  contractRecords,
  createLinkOperation,
  designOperations,
  findingsForOperationBinding,
  knownResolveSignature,
  knownSchemaRefs,
  operationContractFindings,
  operationContractsSchema,
  operationRecords,
  positiveCachePolicy,
  previewOperations,
  resolveLinkOperation,
} from "./operation-contracts.ts";
import {
  cleanOwnershipChange,
  designOwnership,
  ownershipFindings,
  ownershipSchema,
  previewOwnership,
} from "./ownership.ts";
import { designBlueprint, designBlueprintV3, unsupportedBlueprintV2 } from "./studio-blueprint.ts";
import { buildStudioCommand } from "./studio-operations.ts";

const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error();
  return value;
};
const apply = (design: DesignDocument, ops: Parameters<typeof applyOperations>[1]) => {
  const result = applyOperations(design, ops);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
const model = () => operationContractsSchema.parse(fixture);

const bound = () =>
  apply(
    compatibleResolveDesign(),
    buildOperationsCommand(compatibleResolveDesign(), { operations: model() }).ops,
  );
const canonical = (x: unknown): string =>
  JSON.stringify(
    x && typeof x === "object"
      ? Array.isArray(x)
        ? x.map((x) => JSON.parse(canonical(x)))
        : Object.fromEntries(
            Object.entries(x)
              .sort(([a], [b]) => a.localeCompare(b, "en"))
              .map(([k, v]) => [k, JSON.parse(canonical(v))]),
          )
      : x,
  );
const hash = (x: unknown) => createHash("sha256").update(canonical(x)).digest("hex");

describe("finite public resolve and positive-cache declarations", () => {
  it("pins actual schemas and complete behavior without changing frozen Create identity", () => {
    // Use ASCII lexicographic key ordering independently from product code.
    const canonicalHash = (x: unknown): string => {
      const sort = (v: unknown): unknown =>
        v && typeof v === "object"
          ? Array.isArray(v)
            ? v.map(sort)
            : Object.fromEntries(
                Object.entries(v)
                  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                  .map(([k, v]) => [k, sort(v)]),
              )
          : v;
      return createHash("sha256")
        .update(JSON.stringify(sort(x)))
        .digest("hex");
    };
    for (const record of [resolveLinkOperation, positiveCachePolicy]) {
      expect(canonicalHash(record.definition)).toBe(record.ref.sha256);
      for (const schema of Object.values(record.definition.schemas))
        expect(canonicalHash(schema.definition)).toBe(schema.ref.sha256);
      expect(Object.isFrozen(record.definition)).toBe(true);
    }
    for (const records of [operationRecords, contractRecords, knownSchemaRefs])
      expect(Object.isFrozen(records)).toBe(true);
    expect(createLinkOperation.ref.sha256).toBe(
      "bac402c10fbee06292b333d35b698fa96c9f6baa88062a7e53b11bdfad18612f",
    );
    expect(resolveLinkOperation.definition.schemas.success.definition.properties).toMatchObject({
      status: { const: 307 },
      headers: {
        properties: { "Cache-Control": { const: "no-store" }, Location: { type: "string" } },
      },
      body: { type: "null" },
    });
    expect(
      resolveLinkOperation.definition.schemas.errors.definition.oneOf.map((x) => [
        x.properties.status.const,
        x.properties.body.properties.code.const,
        x.properties.headers.properties["Cache-Control"].const,
      ]),
    ).toEqual([
      [400, "invalid-input", "no-store"],
      [404, "unknown", "no-store"],
      [410, "expired", "no-store"],
      [503, "dependency-failure", "no-store"],
      [503, "overloaded", "no-store"],
    ]);
    const pattern = new RegExp(
      resolveLinkOperation.definition.schemas.request.definition.properties.path.properties.code
        .pattern,
    );
    for (const tail of ["A", "Q", "g", "w"]) expect(pattern.test("a".repeat(21) + tail)).toBe(true);
    for (const code of [
      "a".repeat(22),
      `${"a".repeat(21)}=`,
      `%41${"a".repeat(19)}`,
      "a".repeat(21),
      "a".repeat(23),
    ])
      expect(pattern.test(code)).toBe(false);
    expect(positiveCachePolicy.definition.behavior).toMatchObject({
      maxTtlSeconds: 300,
      cacheOperationMs: 50,
      primaryOperationMs: 1000,
      maxPrimaryInFlightPerInstance: 64,
      totalDeadlineMs: 1200,
    });
    expect(positiveCachePolicy.definition.behavior.deadlines).toContain(
      "shared across all resolve bindings",
    );
    expect(positiveCachePolicy.definition.behavior.deadlines).toContain("retains its slot");
    expect(positiveCachePolicy.definition.behavior.fillFailure).toContain(
      "exhausted total deadline",
    );
    expect(hash({ ...positiveCachePolicy.definition, name: "Changed" })).not.toBe(
      positiveCachePolicy.ref.sha256,
    );
  });
  it("keeps unknown refs unresolved, wrong record categories atomic and exact caller contracts", () => {
    const base = compatibleResolveDesign(),
      next = model(),
      receiver = required(next.receivers[1]);
    receiver.implementation.operation.sha256 = "a".repeat(64);
    receiver.implementation.request = { ...positiveCachePolicy.definition.schemas.record.ref };
    required(next.calls[1]).expects = structuredClone(receiver.implementation);
    expect(previewOperations(base, next).canApply).toBe(true);
    expect(
      previewOperations(base, next).findings.some((x) =>
        x.message.includes("Unknown exact operation"),
      ),
    ).toBe(true);
    expect(knownResolveSignature(receiver.implementation)).toBe(false);
    for (const ref of [
      resolveLinkOperation.ref,
      positiveCachePolicy.definition.schemas.record.ref,
    ]) {
      const bad = model();
      const r = required(bad.receivers[1]);
      if (r.binding.kind !== "resolve-link") throw new Error();
      r.binding.cachePolicy = { ...ref };
      expect(previewOperations(base, bad).canApply).toBe(false);
    }
    for (const mutate of [
      (m: ReturnType<typeof model>) => {
        required(m.calls[1]).expects.auth = "verified-principal";
      },
      (m: ReturnType<typeof model>) => {
        required(m.receivers[1]).implementation.success = {
          ...createLinkOperation.definition.schemas.success.ref,
        };
      },
      (m: ReturnType<typeof model>) => {
        required(m.receivers[1]).implementation.timeoutMs = 10000;
      },
    ]) {
      const bad = model();
      mutate(bad);
      expect(applyOperations(base, [{ op: "setOperations", operations: bad }]).ok).toBe(false);
      expect(designOperations(base).receivers).toEqual([]);
    }
    const unknown = model(),
      r = required(unknown.receivers[1]);
    if (r.binding.kind !== "resolve-link") throw new Error();
    r.binding.cachePolicy = { ...positiveCachePolicy.ref, sha256: "f".repeat(64) };
    const saved = apply(base, [{ op: "setOperations", operations: unknown }]);
    expect(
      operationContractFindings(saved).some((x) =>
        x.message.includes("Unknown exact cache policy"),
      ),
    ).toBe(true);
    expect(ownershipFindings(saved).some((x) => x.message.includes("population, freshness"))).toBe(
      true,
    );
  });
  it("diagnoses actual legacy settings without rewriting and accepts lower dependency caps", () => {
    const old = designSchema.parse(legacy.design),
      candidate = {
        ...old,
        schemaVersion: 3 as const,
        scope: tinyurlDesignScope(),
        ownership: ownershipSchema.parse(owners),
      };
    const preview = previewOperations(candidate, model());
    expect(preview.canApply).toBe(false);
    for (const text of ["1200ms", "replica reads", "no L1", "300-second", "fixed307"])
      expect(preview.findings.some((x) => x.message.includes(text))).toBe(true);
    expect(old).toEqual(legacy.design);
    const base = compatibleResolveDesign(),
      studio = required(base.architecture?.studio);
    const data = required(studio.components?.find((x) => x.id === "redirect-data"));
    if (data.settings.kind !== "data-access") throw new Error();
    data.settings.statementTimeoutMs = 800;
    const saved = apply(base, [{ op: "setOperations", operations: model() }]);
    expect(findingsForOperationBinding(saved, "resolve-link")).toEqual([]);
    expect(ownershipFindings(saved).some((x) => x.message.includes("population, freshness"))).toBe(
      false,
    );
    expect(
      unresolvedDesignScope(saved).some((x) =>
        ["resolve-contract", "expiry-cache-contract", "namespace-authority"].includes(x.id),
      ),
    ).toBe(false);
    for (const [id, settings] of [
      ["redirect-db", { timeoutMs: 1001 }],
      ["redirect-cache", { timeoutMs: 51 }],
      ["redirect-cache", { retry: { mode: "fixed", attempts: 2, delayMs: 10 } }],
      ["redirect-db", { channelUse: "publish" }],
    ] as const) {
      const bad = structuredClone(saved),
        row = required(bad.architecture?.studio?.connections.find((x) => x.connection === id));
      Object.assign(row.settings, settings); // Malformed/legacy represented dependency intent still diagnoses the policy contradiction.
      expect(operationContractFindings(bad).some(isStructural)).toBe(true);
    }
    const shortcut = structuredClone(saved),
      redirectSettings = required(
        shortcut.architecture?.studio?.elements.find((x) => x.element === "redirect"),
      ).settings;
    if (redirectSettings.kind !== "redirect") throw new Error();
    redirectSettings.lookupStoreConnection = "other-store";
    redirectSettings.lookupCacheConnection = "other-cache";
    expect(
      operationContractFindings(shortcut).filter((x) => x.message.includes("shortcut contradicts")),
    ).toHaveLength(2);
    const db = required(saved.connections.find((x) => x.id === "redirect-db"));
    db.planned.protocol = "HTTPS";
    expect(
      operationContractFindings(saved).some((x) => x.message.includes("dependency protocol HTTPS")),
    ).toBe(true);
  });
  it("shares one API without a global timeout and scopes modules through canonical dependencies", () => {
    const base = compatibleResolveDesign(),
      studio = required(base.architecture?.studio),
      m = model();
    const setting = required(studio.elements.find((x) => x.element === "redirect")).settings;
    if ("requestTimeoutMs" in setting) delete setting.requestTimeoutMs;
    const create = required(m.receivers[0]);
    create.role = "redirect";
    create.binding.storeConnection = "redirect-db";
    const call = required(m.calls[0]);
    call.receiverRole = "redirect";
    call.caller = {
      kind: "entry",
      entry: "download-redirect",
      lane: "download",
      element: "redirect",
    };
    const ownership = designOwnership(base);
    required(
      ownership.grants.find((x) => x.role === "redirect" && x.resource === "url-db"),
    ).access = "read-write";
    required(ownership.dependencies.find((x) => x.connection === "redirect-db")).access =
      "read-write";
    studio.components?.push({
      id: "unrelated-reader",
      host: "redirect",
      name: "Separate responsibility",
      settings: { kind: "data-access", readRouting: "replica", statementTimeoutMs: 5000 },
    });
    const saved = apply(base, [{ op: "setOperations", operations: m }]);
    expect(designOperations(saved).receivers.map((x) => x.implementation.timeoutMs)).toEqual([
      10000, 1200,
    ]);
    expect(findingsForOperationBinding(saved, "resolve-link")).toEqual([]);
    if ("requestTimeoutMs" in setting) throw new Error();
    Object.assign(setting, { requestTimeoutMs: 1200 });
    expect(previewOperations(base, m).canApply).toBe(false);
  });
  it("enforces source read/cache fill grants, source projection and profile-only namespace agreement", () => {
    const saved = bound();
    expect(ownershipFindings(saved).filter((x) => x.target.element === "url-cache")).toEqual([]);
    for (const resource of ["url-db", "url-cache"]) {
      const bad = structuredClone(saved),
        grants = designOwnership(bad).grants,
        grant = required(grants.find((x) => x.role === "redirect" && x.resource === resource));
      grant.access = resource === "url-db" ? "write" : "read";
      expect(operationContractFindings(bad).some((x) => x.message.includes("exceeds"))).toBe(true);
    }
    const arbitrary = structuredClone(saved);
    if (arbitrary.schemaVersion !== 3) throw new Error();
    arbitrary.scope.profile = null;
    const studio = required(arbitrary.architecture?.studio),
      oldDb = required(arbitrary.elements.find((x) => x.id === "url-db"));
    arbitrary.elements.push({ ...oldDb, id: "other-db" });
    studio.elements.push({
      ...structuredClone(required(studio.elements.find((x) => x.element === "url-db"))),
      element: "other-db",
    });
    const link = required(arbitrary.connections.find((x) => x.id === "shorten-db"));
    link.to.element = "other-db";
    designOwnership(arbitrary).resources.push({
      element: "other-db",
      kind: "source",
      authority: "links",
    });
    designOwnership(arbitrary).grants.push({
      role: "shorten",
      resource: "other-db",
      access: "write",
    });
    expect(
      operationContractFindings(arbitrary).some((x) =>
        x.message.includes("one-public-namespace profile requires"),
      ),
    ).toBe(false);
    arbitrary.scope = tinyurlDesignScope();
    expect(
      operationContractFindings(arbitrary).some(
        (x) =>
          x.code === "CONFIG_INVALID" &&
          x.message.includes("one-public-namespace profile requires"),
      ),
    ).toBe(true);
  });
  it("checks attached CDN/public callers, authority and edge cleanup, exact entry moves and namespace blockers once", () => {
    const saved = bound(),
      studio = required(saved.architecture?.studio);
    // Attach typed CDN intent via its explicit origin; no inferred operation from a name.
    const cdn = {
      element: "cdn",
      definition: { id: "cdn", version: "1.0.0" },
      settings: {
        kind: "cdn" as const,
        provider: "cloudflare" as const,
        origin: "redirect",
        cacheRedirects: "enabled" as const,
      },
    };
    const candidate = structuredClone(saved);
    required(candidate.architecture?.studio).elements.push(cdn);
    expect(
      operationContractFindings(candidate).some(
        (x) => x.code === "CONFIG_INVALID" && x.message.includes("Attached CDN"),
      ),
    ).toBe(true);
    const edgeAdded = apply(
      saved,
      buildStudioCommand(saved, {
        type: "linkTiles",
        from: { tile: "shorten" },
        to: "url-cache",
        linkId: "shorten-cache",
      }).ops,
    );
    const edgeRemoved = apply(
      edgeAdded,
      buildStudioCommand(edgeAdded, { type: "removeLink", link: "redirect-cache" }).ops,
    );
    expect(designOperations(edgeRemoved).receivers.map((x) => x.id)).toEqual(["create-link"]);
    const moved = apply(
      saved,
      buildStudioCommand(saved, {
        type: "setEntryLane",
        entry: "download-redirect",
        lane: "upload",
      }).ops,
    );
    expect(designOperations(moved).receivers).toEqual(designOperations(saved).receivers);
    expect(designOperations(moved).calls.map((x) => x.id)).toEqual(["create-upload"]);
    const ownership = structuredClone(designOwnership(saved));
    ownership.owners.push({ id: "other", name: "Other" });
    const source = required(ownership.resources.find((x) => x.element === "url-db"));
    source.authority = "other";
    const cleaned = cleanOwnershipChange(saved, ownership);
    expect(previewOwnership(saved, cleaned).operationChanges).toHaveLength(4);
    expect(designOperations(apply(saved, [{ op: "setOwnership", ownership: cleaned }]))).toEqual({
      receivers: [],
      calls: [],
    });
    const absent = compatibleResolveDesign();
    expect(
      unresolvedDesignScope(absent).filter((x) => x.id === "namespace-authority"),
    ).toHaveLength(1);
    expect(studio.elements.some((x) => x.element === "cdn")).toBe(false);
  });
  it("retains complete v3/pure views and exact removal/authority-transfer cleanup", () => {
    const saved = bound(),
      full = designBlueprintV3(saved);
    expect(full.operations).toEqual(model());
    expect(full.templateAvailability).toBe("none");
    expect(full.runtimeVerification).toBe("none");
    expect(() => designBlueprint(saved)).toThrow();
    expect(unsupportedBlueprintV2(saved).filter((x) => x.path[0] === "operations")).toHaveLength(4);
    expect(designSchema.parse(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const removed = apply(
      saved,
      buildStudioCommand(saved, { type: "removeTile", tile: "url-cache" }).ops,
    );
    expect(designOperations(removed).receivers.map((x) => x.id)).toEqual(["create-link"]);
    expect(designOperations(removed).calls.map((x) => x.id)).toEqual(["create-upload"]);
    const ownership = structuredClone(designOwnership(saved));
    ownership.owners.push({ id: "other", name: "Other" });
    required(ownership.roles.find((x) => x.element === "redirect")).owner = "other";
    const preview = previewOwnership(saved, ownership);
    expect(preview.operationChanges.map((x) => x.id).sort()).toEqual([
      "resolve-download",
      "resolve-link",
    ]);
    expect(
      designOperations(
        apply(saved, [{ op: "setOwnership", ownership: cleanOwnershipChange(saved, ownership) }]),
      ).receivers.map((x) => x.id),
    ).toEqual(["create-link"]);
    expect(designBlueprintV3(saved)).toEqual(full);
  });
});
