import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { componentConnections } from "./architecture.ts";
import { architectureReview } from "./architecture-bindings.ts";
import {
  architectureContractReview,
  contractCanonical,
  resolveContractSource,
} from "./architecture-contracts.ts";
import { architectureViews } from "./architecture-view.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { blocksGenerate } from "./findings.ts";
import { sampleDesign, testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/relationship-policies.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const save = (design: DesignDocument, architecture = design.architecture!) =>
  applyOperations(design, [{ op: "setArchitecture", architecture }], testLookup);

it("models cache-aside, signed billing delivery and bounded visit loss with independent policies", () => {
  const design = fixture();
  expect(
    validateDesign(design, testLookup).filter((item) => item.code !== "NEEDS_TEMPLATE"),
  ).toEqual([]);
  expect(save(design).ok).toBe(true);
  expect(architectureReview(design)).toEqual([]);
  const callback = design.architecture!.bindings!.find((item) => item.role === "callback")!;
  expect(callback.businessSynchrony).toBe("Asynchronous");
  expect(callback.transport).toBe("HTTPS");
  expect(callback.policies?.delivery?.acknowledgement).toBe("Persisted");
  expect(callback.policies?.access?.identity).toBe("Signed callback");
  expect(
    design.connections.some(
      (item) => item.from.element === "cache" && item.to.element === "records",
    ),
  ).toBe(false);
  expect(
    design.architecture!.bindings!.find((item) => item.role === "publish")?.policies?.delivery
      ?.lossWindowSeconds,
  ).toBe(60);
});

it("derives cross-container C3 uses through the same C2 identity; local bindings stay in-process", () => {
  const design = fixture();
  const component = design.architecture!.components!.find((item) => item.id === "lookup")!;
  expect(component.usesConnections).toEqual([]);
  expect([...componentConnections(design, component).keys()].sort()).toEqual([
    "lookup-cache",
    "lookup-store",
    "publish-visits",
  ]);
  const view = architectureViews(design, testLookup, "Links").components.find(
    (item) => item.container === "redirect",
  )!;
  expect(
    view.edges
      .filter((item) => item.from === "responsibility:lookup")
      .map((item) => item.connection)
      .sort(),
  ).toEqual(["lookup-cache", "lookup-store", "publish-visits"]);
  expect(
    architectureContractReview(design).filter((item) => item.code === "UNBOUND_REQUIRED"),
  ).toEqual([]);
});

it("supports several distinguishable bindings on one C2 connection and exact operation selection", () => {
  const design = fixture();
  const next = structuredClone(design.architecture!);
  const callback = next.bindings!.find((item) => item.role === "callback")!;
  next.bindings!.push({
    ...callback,
    id: "billing-reconciliation",
    name: "Reconcile billing",
    operation: "billing-callback-op",
  });
  expect(save(design, next).ok).toBe(true);
  next.bindings!.at(-1)!.operation = "missing-operation";
  expect(save(design, next).ok).toBe(false);
});

it("keeps version mismatches and contradictory selected policies saveable and outside generation findings", () => {
  const design = fixture();
  const next = structuredClone(design.architecture!);
  next.contracts!.push({ ...next.contracts![0]!, version: "v2" });
  next.interfaces!.find((item) => item.id === "lookup-cache-use")!.contract.version = "v2";
  next.bindings![0]!.policies!.access = {
    identity: "Public",
    tenant: "Tenant scoped",
    network: "Private",
  };
  next.bindings![0]!.policies!.retry = { maxAttempts: 3, idempotency: "Unknown", key: "" };
  next.bindings![0]!.policies!.delivery = {
    guarantee: "At most once",
    ordering: "Unknown",
    acknowledgement: "Unknown",
  };
  const result = save(design, next);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.findings).toEqual(validateDesign(design, testLookup));
  const review = architectureReview(result.design);
  expect(review.map((item) => item.code)).toEqual(
    expect.arrayContaining([
      "CONTRACT_MISMATCH",
      "UNBOUND_REQUIRED",
      "TENANT_CONFLICT",
      "DELIVERY_CONFLICT",
      "UNDECIDED_POLICY",
    ]),
  );
  expect(review.find((item) => item.code === "CONTRACT_MISMATCH")?.message).toContain(
    "link-records@v2",
  );
});

it("does not infer identity from private reachability and preserves unknown policies", () => {
  const design = fixture();
  design.architecture!.bindings![0]!.policies!.access!.identity = "Unknown";
  design.architecture!.bindings![0]!.businessSynchrony = "Unknown";
  expect(save(design).ok).toBe(true);
  expect(
    architectureReview(design).some((item) => item.message.includes("does not authenticate")),
  ).toBe(true);
  expect(design.architecture!.bindings![0]!.policies!.access!.identity).toBe("Unknown");
});

it("explains contradictory interaction roles and direction without silently rewriting arrows", () => {
  const design = fixture();
  design.architecture!.bindings!.find((item) => item.role === "publish")!.role = "request";
  design.architecture!.bindings![0]!.policies!.failure!.timeoutMs = undefined;
  const result = save(fixture(), design.architecture);
  expect(result.ok).toBe(true);
  expect(architectureReview(design).map((item) => item.code)).toEqual(
    expect.arrayContaining(["INTERACTION_CONFLICT", "DIRECTION_CONFLICT", "UNDECIDED_POLICY"]),
  );
  expect(result.ok && result.design.connections).toEqual(design.connections);
});

it("rejects dangling references, wrong interface direction, endpoint containment and duplicate identities atomically", () => {
  const design = fixture();
  for (const mutate of [
    (d: DesignDocument) => {
      d.architecture!.bindings![0]!.provided = "missing";
    },
    (d: DesignDocument) => {
      d.architecture!.bindings![0]!.provided = "lookup-cache-use";
    },
    (d: DesignDocument) => {
      d.architecture!.bindings![0]!.relationship.id = "lookup-store";
    },
    (d: DesignDocument) => {
      d.architecture!.bindings![0]!.id = "link-records";
    },
    (d: DesignDocument) => {
      d.architecture!.bindings![0]!.contract.version = "absent";
    },
    (d: DesignDocument) => {
      d.architecture!.bindings!.at(-1)!.required = "lookup-cache-use";
    },
    (d: DesignDocument) => {
      d.architecture!.interfaces!.find((item) => item.id === "visit-use")!.owner.id = "management";
    },
  ]) {
    const next = structuredClone(design);
    mutate(next);
    expect(save(design, next.architecture).ok).toBe(false);
  }
  expect(design).toEqual(fixture());
});

it("preserves stable references on rename and requires explicit cleanup before removal", () => {
  const design = fixture();
  const renamed = structuredClone(design.architecture!);
  renamed.interfaces![0]!.name = "Renamed cache records";
  renamed.contracts![0]!.name = "Renamed shared records";
  renamed.components![0]!.name = "Renamed authority";
  const result = save(design, renamed);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.design.architecture!.bindings).toEqual(design.architecture!.bindings);
  expect(
    applyOperations(result.design, [{ op: "disconnect", id: "lookup-cache" }], testLookup).ok,
  ).toBe(false);
  expect(
    applyOperations(result.design, [{ op: "removeElement", id: "cache" }], testLookup).ok,
  ).toBe(false);
  const cleanup = structuredClone(result.design.architecture!);
  cleanup.bindings = cleanup.bindings!.filter((item) => item.relationship.id !== "lookup-cache");
  expect(
    applyOperations(
      result.design,
      [
        { op: "setArchitecture", architecture: cleanup },
        { op: "disconnect", id: "lookup-cache" },
      ],
      testLookup,
    ).ok,
  ).toBe(true);
  expect(
    applyOperations(result.design, [{ op: "setArchitecture", architecture: cleanup }], testLookup, {
      baseRevision: design.revision,
    }).ok,
  ).toBe(false);
});

it("requires explicit shared authority, existing stores and valid reader/writer identities", () => {
  const design = fixture();
  const next = structuredClone(design.architecture!);
  next.datasets![0]!.owners.push({ kind: "component", id: "billing" });
  expect(save(design, next).ok).toBe(false);
  next.datasets![0]!.ownershipDecision =
    "Links owns destinations; billing owns retained entitlement state; writes coordinate through Link management.";
  expect(save(design, next).ok).toBe(true);
  next.datasets![0]!.store = "management";
  expect(save(design, next).ok).toBe(false);
  next.datasets![0]!.store = "records";
  next.datasets![0]!.readers.push({ kind: "component", id: "absent" });
  expect(save(design, next).ok).toBe(false);
});

it("reports dataset access and tenant conflicts without guessing ownership or rewriting policies", () => {
  const design = fixture();
  design.architecture!.datasets![0]!.readers = [];
  design.architecture!.bindings![0]!.policies!.access!.tenant = "Cross tenant";
  expect(save(design).ok).toBe(true);
  expect(architectureReview(design).map((item) => item.code)).toEqual(
    expect.arrayContaining(["DATA_ACCESS_MISSING", "TENANT_CONFLICT"]),
  );
  design.architecture!.datasets![0]!.owners = [];
  expect(save(design).ok).toBe(true);
  expect(architectureReview(design).some((item) => item.code === "UNDECIDED_DATA")).toBe(true);
});

it("uses authoritative resource identity without a second data schema and protects referenced shapes", () => {
  const design = designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );
  const source = {
    kind: "resource" as const,
    element: design.elements[0]!.id,
    attachment: design.elements[0]!.attachments[0]!.id,
    resource: "link",
  };
  const model = design.elements[0]!.attachments[0]!.config.model as { resources: { id: string }[] };
  source.resource = model.resources[0]!.id;
  const sourceSnapshot = contractCanonical(resolveContractSource(design, source));
  design.architecture = {
    system: { name: "Resources", description: "" },
    nodes: [],
    relationships: [],
    contracts: [
      {
        id: "existing-records",
        name: "Existing records",
        version: "v1",
        kind: "data",
        description: "",
        source,
        sourceSnapshot,
        sourceDesignRevision: design.revision,
      },
    ],
    datasets: [
      {
        id: "resource-authority",
        name: "Resource authority",
        contract: { id: "existing-records", version: "v1" },
        owners: [{ kind: "element", id: source.element }],
        ownershipDecision: "",
        readers: [],
        writers: [],
        tenant: "Unknown",
        deletion: "Unknown",
        exportAccess: "Unknown",
      },
    ],
  };
  const next = structuredClone(design.architecture);
  next.contracts![0]!.sourceSnapshot = "{}";
  expect(save(design, next).ok).toBe(false);
});

it("keeps objective scope, units, measurement windows and unknown targets distinct", () => {
  const design = fixture();
  expect(design.architecture!.objectives!.map((item) => item.metric)).toEqual([
    "response-time",
    "analytics-lag",
    "job-completion",
  ]);
  design.architecture!.objectives![0]!.unit = "events/second";
  expect(save(design).ok).toBe(true);
  expect(architectureReview(design).some((item) => item.code === "OBJECTIVE_UNIT_CONFLICT")).toBe(
    true,
  );
  design.architecture!.objectives![0]!.value = undefined;
  expect(architectureReview(design).some((item) => item.code === "UNDECIDED_OBJECTIVE")).toBe(true);
  design.architecture!.objectives![0]!.scope = { kind: "binding", id: "missing" };
  expect(save(fixture(), design.architecture).ok).toBe(false);
});

it("preserves legacy serialization and generation gating when unimplemented review intent is added", () => {
  const legacy = sampleDesign();
  expect(designSchema.parse(legacy)).toEqual(legacy);
  const before = validateDesign(legacy, testLookup);
  legacy.architecture = {
    system: { name: "Legacy", description: "" },
    nodes: [],
    relationships: [],
    objectives: [
      {
        id: "unknown-target",
        name: "Unspecified goal",
        scope: { kind: "system" },
        metric: "availability",
        boundary: "",
        window: "",
      },
    ],
  };
  const result = save(legacy);
  expect(result.ok).toBe(true);
  if (result.ok) expect(blocksGenerate(result.findings)).toBe(blocksGenerate(before));
  expect(architectureReview(legacy)[0]?.code).toBe("UNDECIDED_OBJECTIVE");
});
