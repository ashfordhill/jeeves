import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { reviewArchitecture } from "./architecture-review.ts";
import type { ArchitectureDecision, ReviewRequirement } from "./architecture-review-model.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { blocksGenerate } from "./findings.ts";
import { sampleDesign, testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/architecture-review.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const codes = (d: DesignDocument) => reviewArchitecture(d).findings.map((f) => f.code);
const requirement = (d: DesignDocument, kind: ReviewRequirement["kind"]) =>
  d.architecture!.reviewRequirements!.find((r) => r.kind === kind)!;
const binding = (d: DesignDocument, id: string) =>
  d.architecture!.bindings!.find((b) => b.id === id)!;
function accept(d: DesignDocument, code: string): ArchitectureDecision {
  const f = reviewArchitecture(d).findings.find((f) => f.code === code)!;
  const record: ArchitectureDecision = {
    id: "decision-one",
    name: "Bounded deferred policy",
    context: f.message,
    decision: "Accept the documented risk during design exploration.",
    consequence: "Resolve before implementation handoff.",
    status: "Accepted",
    links: f.inputs,
    acknowledgements: [{ finding: f.id, fingerprint: f.fingerprint }],
  };
  d.architecture!.decisions = [record];
  return record;
}

it("reviews selected requirements without inventing cache-to-store wiring or runtime evidence", () => {
  const d = fixture();
  expect(reviewArchitecture(d)).toMatchObject({
    complete: true,
    findings: [],
    structuralFindings: [],
  });
  expect(d.connections.some((c) => c.from.element === "cache" && c.to.element === "records")).toBe(
    false,
  );
  expect(
    applyOperations(d, [{ op: "setArchitecture", architecture: d.architecture! }], testLookup).ok,
  ).toBe(true);
  expect(blocksGenerate(validateDesign(d, testLookup))).toBe(true);
});

it.each([
  [
    "CACHE_FRESHNESS_MISSING",
    (d: DesignDocument) => {
      delete binding(d, "lookup-cache-binding").policies!.freshness;
    },
  ],
  [
    "CACHE_FALLBACK_MISSING",
    (d: DesignDocument) => {
      const r = requirement(d, "cache");
      if (r.kind === "cache") delete r.fallback;
    },
  ],
  [
    "CACHE_UPDATE_MISSING",
    (d: DesignDocument) => {
      const r = requirement(d, "cache");
      if (r.kind === "cache") delete r.update;
    },
  ],
  [
    "ACCESS_POLICY_MISSING",
    (d: DesignDocument) => {
      delete binding(d, "update-store-binding").policies!.access;
    },
  ],
  [
    "ACCESS_REQUIREMENT_CONFLICT",
    (d: DesignDocument) => {
      binding(d, "update-store-binding").policies!.access!.identity = "User";
    },
  ],
  [
    "FAILURE_OUTCOME_MISSING",
    (d: DesignDocument) => {
      delete binding(d, "publish-visits-binding").policies!.failure;
    },
  ],
  [
    "FAILURE_REQUIREMENT_CONFLICT",
    (d: DesignDocument) => {
      binding(d, "publish-visits-binding").policies!.failure!.outcome = "Fail request";
    },
  ],
  [
    "DELIVERY_RESPONSIBILITY_MISSING",
    (d: DesignDocument) => {
      const r = requirement(d, "delivery");
      if (r.kind === "delivery") delete r.responsible;
    },
  ],
  [
    "CHANNEL_CONSUMER_MISSING",
    (d: DesignDocument) => {
      const r = requirement(d, "delivery");
      if (r.kind === "delivery") delete r.binding;
    },
  ],
] as const)(
  "reports %s only for an unmet selected requirement, with cited assumptions/inputs",
  (code, change) => {
    const d = fixture();
    expect(codes(d)).not.toContain(code);
    change(d);
    const finding = reviewArchitecture(d).findings.find((f) => f.code === code)!;
    expect(finding).toBeDefined();
    expect(finding.assumption.length).toBeGreaterThan(40);
    expect(finding.inputs.some((r) => r.kind === "requirement")).toBe(true);
    expect(finding.fingerprint).toMatch(/^v1-/);
    expect(reviewArchitecture(d).complete).toBe(false);
    const saved = applyOperations(
      fixture(),
      [{ op: "setArchitecture", architecture: d.architecture! }],
      testLookup,
    );
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.findings).toEqual(validateDesign(fixture(), testLookup));
    d.architecture!.reviewRequirements = [];
    expect(codes(d)).not.toContain(code);
  },
);

it("checks actual cache source/update ownership, exact versions and propagation bounds", () => {
  const d = fixture();
  const cache = requirement(d, "cache");
  if (cache.kind !== "cache") throw Error();
  cache.fallback = "invalidate-cache-binding";
  cache.update = "update-store-binding";
  expect(codes(d)).toEqual(
    expect.arrayContaining(["CACHE_FALLBACK_MISSING", "CACHE_UPDATE_MISSING"]),
  );
  cache.fallback = "lookup-store-binding";
  cache.update = "invalidate-cache-binding";
  binding(d, cache.update).policies!.freshness!.maxAgeSeconds = 31;
  expect(codes(d)).toContain("CACHE_UPDATE_MISSING");
  binding(d, cache.update).policies!.freshness!.maxAgeSeconds = 30;
  expect(codes(d)).toEqual([]);
});

it.each(["Schedule", "Request"] as const)(
  "accepts %s workers without a queue or consumer binding",
  (trigger) => {
    const d = fixture();
    d.architecture!.reviewRequirements = [
      {
        id: "scheduled",
        name: "Process on demand",
        kind: "delivery",
        trigger,
        responsible: { kind: "component", id: "visit-processor" },
      },
    ];
    d.architecture!.bindings = d.architecture!.bindings!.filter(
      (b) => b.id !== "consume-visits-binding",
    );
    d.architecture!.interfaces = d.architecture!.interfaces!.filter((i) => i.id !== "visit-use");
    expect(codes(d)).toEqual([]);
  },
);

it("accepts external consumers, synchronous search, personal billing and async-send-then-response", () => {
  const d = fixture();
  d.architecture!.nodes.push({
    id: "outside-processor",
    kind: "external-system",
    name: "Analytics vendor",
    description: "",
    container: "worker",
  });
  const worker = d.elements.find((e) => e.id === "worker")!;
  worker.planned = "third-party-service";
  const r = requirement(d, "delivery");
  if (r.kind !== "delivery") throw Error();
  r.responsible = { kind: "external-system", id: "outside-processor" };
  d.architecture!.interfaces!.find((i) => i.id === "visit-use")!.owner = r.responsible;
  d.architecture!.system.businessTenancy = "Personal workspaces";
  binding(d, "check-entitlement-binding").name = "Synchronous search";
  binding(d, "publish-visits-binding").name = "Send analytics, then return redirect response";
  expect(codes(d)).toEqual([]);
});

it("has no rules based on counts, duplicate family, visitors, private hosting or line style", () => {
  const d = fixture();
  d.architecture!.reviewRequirements = [];
  d.architecture!.system.deliveryModel = "Private deployment";
  for (let i = 0; i < 20; i++)
    d.architecture!.components!.push({
      ...d.architecture!.components![0]!,
      id: `extra-${i}`,
      name: `Extra ${i}`,
    });
  expect(codes(d)).toEqual([]);
});

it("accepts scoped tradeoffs, invalidates them on relevant changes and preserves unrelated edits", () => {
  const d = fixture();
  const r = requirement(d, "cache");
  if (r.kind !== "cache") throw Error();
  delete r.update;
  const record = accept(d, "CACHE_UPDATE_MISSING");
  expect(reviewArchitecture(d).complete).toBe(true);
  expect(reviewArchitecture(d).findings[0]!.acceptedBy).toBe(record.id);
  d.revision += 1;
  d.elements[0]!.notes = "Unrelated design notes";
  d.architecture!.system.description = "Unrelated wording";
  expect(reviewArchitecture(d).complete).toBe(true);
  binding(d, "lookup-cache-binding").policies!.freshness!.maxAgeSeconds = 20;
  expect(reviewArchitecture(d).findings[0]).toMatchObject({
    acceptedBy: undefined,
    expiredDecisions: [record.id],
  });
  expect(reviewArchitecture(d).complete).toBe(false);
});

it("does not acknowledge contradictions or structural invalidity and keeps explicit decisions unresolved", () => {
  const d = fixture();
  const b = binding(d, "lookup-cache-binding");
  d.architecture!.contracts!.push({ ...d.architecture!.contracts![0]!, version: "v2" });
  d.architecture!.interfaces!.find((i) => i.id === b.required)!.contract.version = "v2";
  accept(d, "CONTRACT_MISMATCH");
  expect(
    reviewArchitecture(d).findings.find((f) => f.code === "CONTRACT_MISMATCH")!.acceptedBy,
  ).toBeUndefined();
  expect(reviewArchitecture(d).complete).toBe(false);
  const clean = fixture();
  clean.architecture!.decisions = [
    { ...d.architecture!.decisions![0]!, status: "Unresolved", acknowledgements: [], links: [] },
  ];
  expect(reviewArchitecture(clean)).toMatchObject({
    complete: false,
    unresolvedDecisions: ["decision-one"],
  });
  clean.architecture!.decisions![0]!.status = "Superseded";
  expect(reviewArchitecture(clean).complete).toBe(true);
  clean.architecture!.reviewRequirements![0]!.id = "management";
  expect(reviewArchitecture(clean).structuralFindings.length).toBeGreaterThan(0);
  expect(reviewArchitecture(clean).complete).toBe(false);
});

it("rejects malformed/dangling review metadata atomically and permits historical repair", () => {
  const base = fixture();
  for (const change of [
    (d: DesignDocument) => {
      const r = requirement(d, "cache");
      if (r.kind === "cache") r.fallback = "missing";
    },
    (d: DesignDocument) => {
      d.architecture!.reviewRequirements![0]!.id = "management";
    },
    (d: DesignDocument) => {
      d.architecture!.decisions = [
        {
          id: "missing-link",
          name: "Decision",
          context: "Context",
          decision: "Reason",
          consequence: "Consequence",
          status: "Accepted",
          links: [{ kind: "component", id: "missing" }],
          acknowledgements: [],
        },
      ];
    },
  ]) {
    const d = fixture();
    change(d);
    expect(
      applyOperations(base, [{ op: "setArchitecture", architecture: d.architecture! }], testLookup)
        .ok,
    ).toBe(false);
    expect(base).toEqual(fixture());
    expect(
      applyOperations(d, [{ op: "setArchitecture", architecture: base.architecture! }], testLookup)
        .ok,
    ).toBe(true);
  }
});

it("legacy generatable designs retain the generation gate with review-only conflicts", () => {
  const d = sampleDesign();
  d.architecture = {
    system: { name: "Legacy", description: "" },
    nodes: [],
    relationships: [],
    objectives: [
      {
        id: "bad-objective",
        name: "Availability",
        scope: { kind: "system" },
        metric: "availability",
        value: 200,
        unit: "percent",
        boundary: "ingress",
        window: "monthly",
      },
    ],
  };
  expect(codes(d)).toContain("OBJECTIVE_UNIT_CONFLICT");
  expect(reviewArchitecture(d).complete).toBe(false);
  expect(blocksGenerate(validateDesign(d, testLookup))).toBe(false);
});

it("allows distinct source/cache representations while checking each binding's exact contract", () => {
  const d = fixture();
  const source = { ...d.architecture!.contracts![0]!, id: "source-data" };
  d.architecture!.contracts!.push(source);
  for (const i of d.architecture!.interfaces!.filter((i) =>
    ["store-data", "lookup-store-use", "link-write"].includes(i.id),
  ))
    i.contract = { id: source.id, version: source.version };
  for (const b of d.architecture!.bindings!.filter((b) =>
    ["lookup-store-binding", "update-store-binding"].includes(b.id),
  ))
    b.contract = { id: source.id, version: source.version };
  d.architecture!.datasets![0]!.contract = { id: source.id, version: source.version };
  expect(codes(d)).toEqual([]);
  expect(
    applyOperations(d, [{ op: "setArchitecture", architecture: d.architecture! }], testLookup).ok,
  ).toBe(true);
});

it("requires acknowledgements to retain all relevant linked identities", () => {
  const d = fixture();
  const r = requirement(d, "cache");
  if (r.kind === "cache") delete r.update;
  const decision = accept(d, "CACHE_UPDATE_MISSING");
  expect(reviewArchitecture(d).complete).toBe(true);
  decision.links = [];
  expect(reviewArchitecture(d).complete).toBe(false);
  expect(reviewArchitecture(d).findings[0]!.acceptedBy).toBeUndefined();
});
