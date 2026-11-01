/** Editable P56 studies. All stages use ordinary operations and P50 fragments, never runtime code. */
import { applyOperations } from "./apply.ts";
import type { Architecture } from "./architecture.ts";
import type { RelationshipPolicies } from "./architecture-bindings.ts";
import type { ArchitectureContract, ContractOwner } from "./architecture-contracts.ts";
import { deploymentEnvironmentSchema } from "./architecture-deployments.ts";
import { type PatternRequestInput, previewArchitecturePattern } from "./architecture-patterns.ts";
import { type DesignDocument, designSchema, elementSchema } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";
import type { TemplateLookup } from "./manifest.ts";
import type { OperationInput } from "./operations.ts";
import type { ScenarioStep } from "./scenarios.ts";

export type ProofProduct = "qrwty" | "inventory";
export const architectureProofSteps = [
  { id: "start", name: "Start with application hosts and primary data" },
  { id: "tenant", name: "Compose tenant workspace and access" },
  { id: "delivery", name: "Compose asynchronous work delivery" },
  { id: "billing", name: "Compose billing and entitlements" },
  { id: "lookup", name: "Compose cached public lookup" },
  { id: "behavior", name: "Specify product contracts, policies and six journeys" },
] as const;
export type ProofStep = (typeof architectureProofSteps)[number]["id"];
const plannedOnly: TemplateLookup = { get: () => undefined, versions: () => [] };
export function proofSteps(product: ProofProduct) {
  return architectureProofSteps.filter(
    (s) => product === "qrwty" || !["billing", "lookup"].includes(s.id),
  );
}

export function proofPatternRequest(
  product: ProofProduct,
  step: ProofStep,
  revision: number,
): PatternRequestInput {
  const patterns: Partial<Record<ProofStep, string>> = {
    tenant: "tenant-workspace-access",
    delivery: "asynchronous-work-delivery",
    billing: "billing-entitlements",
    lookup: "cached-public-lookup",
  };
  const pattern = patterns[step];
  if (!pattern) throw new Error("Select a composition stage.");
  return {
    pattern,
    version: "1.0.0",
    instanceId: step,
    baseRevision: revision,
    variant:
      step === "delivery"
        ? product === "inventory"
          ? "transactional-outbox"
          : "best-effort"
        : "standard",
    config: {
      name: {
        tenant: "Tenant access",
        delivery: product === "qrwty" ? "Visit analytics" : "Stock delivery",
        billing: "Billing",
        lookup: "Public redirect",
      }[step as "tenant" | "delivery" | "billing" | "lookup"],
      tenant: "Tenant scoped",
      channel: product === "qrwty" ? "Visit events" : "Stock changes",
      maxAgeSeconds: 15,
      lossWindowSeconds: 60,
    },
    roles: {
      api: {
        mode: "reuse",
        id: step === "lookup" || (step === "delivery" && product === "qrwty") ? "redirect" : "api",
      },
      store: { mode: "reuse", id: "db" },
      ...(step === "delivery" ? { worker: { mode: "reuse" as const, id: "worker" } } : {}),
    },
  };
}
const host = (id: string, name: string, planned: string, description: string) =>
  elementSchema.parse({
    id,
    name,
    planned,
    template: null,
    description,
    technology: planned === "relational-store" ? "PostgreSQL (proposed)" : "TypeScript (proposed)",
  });
export function architectureProofOperations(
  design: DesignDocument,
  product: ProofProduct,
  step: ProofStep,
  lookup: TemplateLookup = plannedOnly,
): OperationInput[] {
  const steps = proofSteps(product);
  const index = steps.findIndex((s) => s.id === step);
  if (index < 0) throw new Error("Stage is not part of this study.");
  if (step === "start") {
    if (design.elements.length || design.architecture)
      throw new Error("Start in an empty project; existing work is preserved.");
    return [
      ...[
        host(
          "api",
          "Application API",
          "application-api",
          "Owns tenant-authorized product operations and authoritative state.",
        ),
        host(
          "worker",
          "Background worker",
          "background-worker",
          "Checks tenant scope again before reports, exports and delivery.",
        ),
        host(
          "db",
          "Primary data",
          "relational-store",
          "Authoritative tenant records and product data; shared scoped storage.",
        ),
        ...(product === "qrwty"
          ? [
              host(
                "redirect",
                "Redirect service",
                "application-api",
                "Separately scalable public resolution; browser follows Location.",
              ),
            ]
          : []),
      ].map((element): OperationInput => ({ op: "addElement", element })),
      {
        op: "setArchitecture",
        architecture: {
          system: {
            name: product === "qrwty" ? "QRWTY target architecture" : "Inventory reuse study",
            description:
              "Editable architecture intent. No implementation or verification is inherited.",
            businessTenancy: "Organizations",
            authorization: "Roles and permissions",
            dataIsolation: "Shared scoped data",
            deliveryModel: "Hosted",
          },
          nodes: [],
          relationships: [],
        },
      },
    ];
  }
  if (!design.elements.some((e) => e.id === "api") || !design.elements.some((e) => e.id === "db"))
    throw new Error("Start with the study hosts first.");
  for (const previous of steps.slice(1, index))
    if (!design.architecture?.patternInstances?.some((p) => p.id === previous.id))
      throw new Error(`Compose ${previous.name} first.`);
  if (step !== "behavior") {
    const preview = previewArchitecturePattern(
      design,
      proofPatternRequest(product, step, design.revision),
      lookup,
    );
    if (!preview.ok) throw new Error([...preview.errors, ...preview.unfilled].join(" "));
    return preview.ops.map((op) =>
      op.op === "addElement"
        ? {
            ...op,
            element: {
              ...op.element,
              description: `Logical ${op.element.planned} with explicit responsibility and editable policies.`,
              technology:
                op.element.planned === "job-queue"
                  ? "AMQP-compatible channel (proposed)"
                  : op.element.planned === "distributed-cache"
                    ? "Redis compatible (proposed)"
                    : "External provider API (proposed)",
            },
          }
        : op,
    );
  }
  if (design.architecture?.decisions?.some((d) => d.id === "hosted-first"))
    throw new Error(
      "Product decisions are already present. Edit them through the normal inspectors.",
    );
  return productBehavior(design, product);
}

function productBehavior(design: DesignDocument, product: ProofProduct): OperationInput[] {
  const qr = product === "qrwty";
  const m = structuredClone(design.architecture!);
  const elements = [
    host(
      "web",
      qr ? "Owner web app" : "Inventory workspace",
      "browser-client",
      "Signed-in feature areas using exact tenant-scoped API contracts.",
    ),
  ];
  if (qr)
    elements.push(
      host(
        "admin",
        "Staff console",
        "browser-client",
        "Audited support and abuse decisions with explicit staff authorization.",
      ),
      host(
        "assets",
        "Artwork and export storage",
        "object-storage",
        "Versioned artwork, hosted content assets and expiring authorized exports.",
      ),
      host(
        "email",
        "E-mail provider",
        "third-party-service",
        "External delivery only; invitation and revocation policy stays in the application.",
      ),
      host(
        "dns",
        "DNS and certificate provider",
        "third-party-service",
        "External ownership challenges and certificate lifecycle; application owns domain policy.",
      ),
    );
  const connections: DesignDocument["connections"] = [];
  m.components ??= [];
  m.contracts ??= [];
  m.interfaces ??= [];
  m.bindings ??= [];
  m.datasets ??= [];
  m.componentRelationships ??= [];
  m.reviewRequirements ??= [];
  m.decisions ??= [];
  const fragmentScenarios = new Set(
    m.patternInstances?.map((p) => p.identities["pattern-journey"]),
  );
  m.scenarios = (m.scenarios ?? []).filter(
    (s) =>
      !fragmentScenarios.has(s.id) || s.actor || s.startCondition || s.outcomes || s.alternatives,
  );

  m.nodes = [
    ...m.nodes,
    {
      id: "member",
      kind: "person",
      name: qr ? "Link owner" : "Inventory operator",
      description: "Acts inside an authorized tenant workspace.",
    },
    ...(qr
      ? [
          {
            id: "visitor",
            kind: "person" as const,
            name: "QR visitor",
            description: "Scans a stable public URL; their browser follows the destination.",
          },
          {
            id: "staff",
            kind: "person" as const,
            name: "Support staff",
            description: "Uses audited scoped support privileges.",
          },
          {
            id: "payment-provider",
            kind: "external-system" as const,
            name: "Payment provider",
            description: "Signed subscription callbacks and external payment processing.",
            container: "billing-provider",
          },
          {
            id: "email-provider",
            kind: "external-system" as const,
            name: "E-mail provider",
            description: "Delivers transactional messages.",
            container: "email",
          },
          {
            id: "domain-provider",
            kind: "external-system" as const,
            name: "DNS and certificate provider",
            description: "Validates DNS challenges and operates certificate issuance.",
            container: "dns",
          },
          {
            id: "destination",
            kind: "external-system" as const,
            name: "Destination website",
            description:
              "Receives navigation from the visitor browser, never from the redirect service.",
          },
        ]
      : []),
  ];
  m.relationships = [
    ...m.relationships,
    {
      id: "member-system",
      from: "member",
      to: "system",
      description: "Manages tenant-owned records",
      container: "web",
    },
    ...(qr
      ? [
          {
            id: "visitor-system",
            from: "visitor",
            to: "system",
            description: "Resolves a printed URL",
            container: "redirect",
          },
          {
            id: "staff-system",
            from: "staff",
            to: "system",
            description: "Investigates abuse and support cases",
            container: "admin",
          },
          {
            id: "system-payment",
            from: "system",
            to: "payment-provider",
            description: "Accepts signed billing events",
            container: "api",
          },
          {
            id: "system-email",
            from: "system",
            to: "email-provider",
            description: "Delivers invitations and report notices",
            container: "worker",
          },
          {
            id: "system-domains",
            from: "system",
            to: "domain-provider",
            description: "Verifies domain ownership and TLS lifecycle",
            container: "api",
          },
          {
            id: "visitor-destination",
            from: "visitor",
            to: "destination",
            description: "Browser follows returned Location",
          },
        ]
      : []),
  ];
  const component = (
    id: string,
    name: string,
    element: string,
    capability: string,
    responsibility: string,
  ) =>
    m.components!.push({
      id,
      name,
      element,
      capability,
      responsibility,
      technology:
        element === "web" || element === "admin"
          ? "React / TypeScript (proposed)"
          : "TypeScript module (proposed)",
      config: {},
      members: [],
      usesConnections: [],
      usesResources: [],
    });
  const fields = (names: string[]): NonNullable<ArchitectureContract["shape"]>["payload"] =>
    names.map((name) => ({
      id: name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      name,
      type: ["allowed", "accepted", "enabled", "reprintRequired", "propagationPending"].includes(
        name,
      )
        ? "boolean"
        : ["quantity", "revision", "providerRevision"].includes(name)
          ? "integer"
          : name.endsWith("At")
            ? "timestamp"
            : ["printedUrl", "destination"].includes(name)
              ? "http-url"
              : name.endsWith("Id") && name !== "providerEventId"
                ? "uuid"
                : "text",
      required: true,
      description: "Explicit planned boundary; no runtime supplied.",
    }));
  const contract = (
    id: string,
    name: string,
    kind: ArchitectureContract["kind"],
    input: string[],
    output: string[] = [],
  ) => {
    m.contracts!.push({
      id,
      version: "v1",
      name,
      kind,
      description: "Proposed product contract. Review before implementation.",
      shape: {
        payload: kind === "data" || kind === "event" ? fields(input) : [],
        operations:
          kind === "api" || kind === "in-process"
            ? [
                {
                  id: `${id}-operation`,
                  name,
                  description: name,
                  input: fields(input),
                  output: fields(output),
                },
              ]
            : [],
      },
    });
  };
  const owner = (id: string): ContractOwner => ({
    kind: m.components!.some((c) => c.id === id) ? "component" : "element",
    id,
  });
  const hostOf = (id: string) => m.components!.find((c) => c.id === id)?.element ?? id;
  const access: RelationshipPolicies = {
    access: { identity: "Service", tenant: "Tenant scoped", network: "Private" },
    failure: {
      timeoutMs: 500,
      outcome: "Fail request",
      detail:
        "Fail closed, expose a retryable error, and never return another tenant's data. Illustrative timeout only.",
    },
  };
  // Specialize unresolved fragment payloads as explicit new versions and migrate every consumer.
  // v1 remains historical provenance; its shape is never rewritten under a referenced version.
  for (const c of [...m.contracts!]) {
    const unresolved = [
      ...(c.shape?.payload ?? []),
      ...(c.shape?.operations.flatMap((o) => [...o.input, ...o.output]) ?? []),
    ].some((f) => f.type === "unresolved");
    if (!unresolved) continue;
    const next = structuredClone(c);
    next.version = "v2";
    next.description =
      "Product-specialized v2. Explicitly supersedes the generic fragment v1; consumer migration is intentional.";
    const additions =
      c.id === "delivery-work-event"
        ? fields([
            "occurredAt",
            "recordId",
            "revision",
            ...(qr ? ["resolutionOutcome"] : ["quantity"]),
          ])
        : c.id.startsWith("billing-")
          ? fields(["providerEventId", "providerRevision", "effectivePlan", "effectiveAt"])
          : fields(["recordId", "revision", "quantity"]);
    const specialize = (items: NonNullable<ArchitectureContract["shape"]>["payload"]) =>
      Array.from(
        new Map(
          items.flatMap((f) => (f.type === "unresolved" ? additions : [f])).map((f) => [f.name, f]),
        ).values(),
      );
    if (next.shape) {
      next.shape.payload = specialize(next.shape.payload);
      for (const o of next.shape.operations) {
        o.input = specialize(o.input);
        o.output = specialize(o.output);
      }
    }
    m.contracts = m.contracts!.filter((entry) => entry !== c);
    m.contracts.push(next);
    for (const item of [...m.interfaces!, ...m.bindings!, ...m.datasets!])
      if (item.contract.id === c.id && item.contract.version === c.version)
        item.contract.version = "v2";
  }
  const bind = (
    id: string,
    from: string,
    to: string,
    ref: string,
    role: "request" | "read" | "write" = "request",
    policies: RelationshipPolicies = access,
  ) => {
    const local = hostOf(from) === hostOf(to);
    const existing = !local
      ? [...design.connections, ...connections].find(
          (c) =>
            c.from.element === hostOf(from) &&
            c.to.element === hostOf(to) &&
            c.planned?.protocol === (to === "db" ? "SQL" : "HTTPS/JSON") &&
            c.planned.interaction === "Request / response",
        )
      : undefined;
    const relationship = {
      kind: local ? ("component-relationship" as const) : ("connection" as const),
      id: existing?.id ?? `${id}-edge`,
    };
    const name = m.contracts!.find((c) => c.id === ref)!.name;
    if (local)
      m.componentRelationships!.push({
        id: relationship.id,
        from,
        to,
        description: name,
        protocol: "In process",
        interaction: "Request / response",
      });
    else if (!existing)
      connections.push({
        id: relationship.id,
        kind: "depends-on",
        from: { element: hostOf(from) },
        to: { element: hostOf(to) },
        planned: {
          label:
            to === "db"
              ? "Reads / writes tenant authority"
              : hostOf(from) === "web"
                ? "Uses tenant product APIs"
                : name,
          protocol: to === "db" ? "SQL" : "HTTPS/JSON",
          interaction: "Request / response",
          security: "Service identity",
        },
      });
    for (const id of [from, to]) {
      const c = m.components!.find((c) => c.id === id);
      if (c && !local && !c.usesConnections.includes(relationship.id))
        c.usesConnections.push(relationship.id);
    }
    const exact = { id: ref, version: m.contracts!.find((c) => c.id === ref)!.version };
    for (const direction of ["provided", "required"] as const)
      m.interfaces!.push({
        id: `${id}-${direction}`,
        name,
        owner: owner(direction === "provided" ? to : from),
        direction,
        necessity: "required",
        contract: exact,
      });
    m.bindings!.push({
      id,
      name,
      relationship,
      provided: `${id}-provided`,
      required: `${id}-required`,
      contract: exact,
      ...(m.contracts!.find((c) => c.id === ref)!.kind === "api" || local
        ? { operation: m.contracts!.find((c) => c.id === ref)!.shape!.operations[0]!.id }
        : {}),
      role,
      transport: local ? "In process" : to === "db" ? "SQL" : "HTTPS/JSON",
      businessSynchrony: "Synchronous",
      policies,
    });
    return id;
  };
  const data = (
    id: string,
    name: string,
    responsibility: string,
    payload: string[],
    store = "db",
    retentionDays = 90,
  ) => {
    contract(`${id}-records`, name, "data", payload);
    bind(`${id}-write`, responsibility, store, `${id}-records`, "write");
    m.datasets!.push({
      id: `${id}-dataset`,
      name,
      contract: { id: `${id}-records`, version: "v1" },
      owners: [owner(responsibility)],
      ownershipDecision:
        "This responsibility owns writes; other access requires an explicit binding and tenant check.",
      store,
      readers: [owner(responsibility)],
      writers: [owner(responsibility)],
      tenant: "Tenant scoped",
      retentionDays,
      deletion: "Delete",
      exportAccess: "Tenant admin",
    });
  };
  component(
    "library",
    qr ? "Library, creation and hosted content" : "Stock workspace",
    "web",
    "screen-group",
    "Creation, editing, version history and explicit loading, success, denial and failure states.",
  );
  component(
    "report-screens",
    "Analytics and exports",
    "web",
    "screen-group",
    "Authorized reporting, deletion requests and expiring export downloads.",
  );
  component(
    "settings-screens",
    qr ? "Team, billing and domain settings" : "Team and access settings",
    "web",
    "screen-group",
    qr
      ? "Membership, API-key revocation, entitlements and domain lifecycle decisions."
      : "Tenant membership, principal revocation and export access decisions.",
  );
  component(
    "records",
    qr ? "Stable links and destinations" : "Stock commands",
    "api",
    "domain-module",
    qr
      ? "Owns stable printed URL identity and destination revisions; encoded payloads and hosted page content have separate owners."
      : "Tenant-owned stock changes and durable event intent.",
  );
  component(
    "reporting",
    "Reporting and data lifecycle",
    "api",
    "data-lifecycle-module",
    "Tenant-authorized queries, exports, deletion, retention and recovery coordination.",
  );
  component(
    "audit",
    "Security audit",
    "api",
    "audit-log-module",
    "Records staff and tenant security changes without storing API keys or raw IP addresses.",
  );
  component(
    "export-jobs",
    "Authorized exports and recovery",
    "worker",
    "reports-module",
    "Recheck tenant access and revocation at execution and download; cancel revoked jobs and expire export objects.",
  );
  contract(
    "manage-records",
    qr ? "Create or edit link and payload" : "Change stock",
    "api",
    qr
      ? ["tenantId", "principalId", "recordId", "revision", "destination"]
      : ["tenantId", "principalId", "recordId", "revision", "quantity"],
    qr ? ["recordId", "revision", "printedUrl"] : ["recordId", "revision"],
  );
  bind("manage", "library", "records", "manage-records", "request", {
    ...access,
    access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
  });
  bind("record-access", "records", "tenant-access", "tenant-access-contract");
  if (qr)
    data("product", "Stable link and payload authority", "records", [
      "tenantId",
      "recordId",
      "revision",
      "printedUrl",
      "destination",
      "enabled",
      "propagationPending",
    ]);
  else bind("stock-commit", "records", "delivery-atomic-writer", "delivery-atomic-commit");
  contract(
    "report-contract",
    "Query, export or delete tenant analytics",
    "api",
    ["tenantId", "principalId", "action", "period"],
    ["jobId", "freshness", "expiresAt"],
  );
  bind("reports", "report-screens", "reporting", "report-contract", "request", {
    ...access,
    access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
  });
  bind("report-access", "reporting", "tenant-access", "tenant-access-contract");
  contract(
    "remote-access",
    "Check current tenant and principal remotely",
    "api",
    ["tenantId", "principalId", "action", "recordId"],
    ["allowed", "revision"],
  );
  bind("export-access", "export-jobs", "tenant-access", "remote-access");
  data(
    "audit",
    "Redacted security audit",
    "audit",
    ["tenantId", "principalId", "action", "recordId", "occurredAt"],
    "db",
    365,
  );
  data(
    "reports",
    "Tenant reporting and deletion state",
    "reporting",
    ["tenantId", "jobId", "period", "deletedAt"],
    "db",
    90,
  );
  contract(
    "member-command",
    "Invite, restrict or revoke access",
    "api",
    ["tenantId", "principalId", "subjectId", "action", "revision"],
    ["revision"],
  );
  bind("members", "settings-screens", "tenant-workspace", "member-command", "request", {
    ...access,
    access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
  });
  contract(
    "job-command",
    "Authorize export execution",
    "api",
    ["tenantId", "principalId", "jobId"],
    ["expiresAt"],
  );
  bind("export-job", "reporting", "export-jobs", "job-command");
  data(
    "export",
    "Expiring authorized exports",
    "export-jobs",
    ["tenantId", "jobId", "expiresAt"],
    qr ? "assets" : "db",
    7,
  );
  // Both products consume the same tenant-access and asynchronous delivery fragment versions.
  bind("worker-access", "delivery-handler", "tenant-access", "remote-access");
  bind("aggregate-write", "delivery-handler", "db", "reports-records", "write");
  bind("aggregate-query", "reporting", "db", "reports-records", "read");
  bind("aggregate-export", "export-jobs", "db", "reports-records", "read");
  const reportingData = m.datasets!.find((d) => d.id === "reports-dataset")!;
  reportingData.writers.push(owner("delivery-handler"));
  reportingData.readers.push(owner("export-jobs"));
  if (qr) {
    component(
      "studio",
      "Studio and encoded payload editor",
      "web",
      "screen-group",
      "Edits encoded payloads and versions artwork; changing static printed payload requires reprint.",
    );
    component(
      "payloads",
      "Encoded payload definitions",
      "api",
      "domain-module",
      "Owns versioned encoded URL/text/contact payload intent independently of stable redirect identity and hosted content; no infrastructure per content type.",
    );
    contract(
      "payload-command",
      "Version encoded payload",
      "api",
      ["tenantId", "recordId", "revision", "payloadType", "encodedPayload"],
      ["revision", "reprintRequired"],
    );
    bind("payload-binding", "studio", "payloads", "payload-command", "request", {
      ...access,
      access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
    });
    bind("payload-access", "payloads", "tenant-access", "tenant-access-contract");
    data("payload", "Encoded payload authority", "payloads", [
      "tenantId",
      "recordId",
      "revision",
      "payloadType",
      "encodedPayload",
    ]);
    component(
      "content",
      "Hosted landing content",
      "api",
      "domain-module",
      "Versions tenant-owned hosted landing-page content independently of printed URL and encoded payload.",
    );
    component(
      "artwork",
      "QR artwork",
      "api",
      "media-module",
      "Versions artwork and assets without changing printed URL identity.",
    );
    component(
      "domains",
      "Custom domain lifecycle",
      "api",
      "custom-domains-module",
      "Verifies ownership before attach or transfer; revokes old tenant routing; preserves paths; coordinates TLS removal.",
    );
    component(
      "abuse",
      "Abuse decisions",
      "api",
      "abuse-module",
      "Audited shutdown and appeal decisions propagate to authoritative lookup and cache within the illustrative enforcement bound.",
    );
    component(
      "staff-feature",
      "Staff support and abuse",
      "admin",
      "screen-group",
      "Explicit authorized staff actions and audited outcomes; no blanket cross-tenant privilege.",
    );
    contract(
      "content-command",
      "Version hosted page content",
      "api",
      ["tenantId", "recordId", "revision", "content"],
      ["revision"],
    );
    bind("content-binding", "library", "content", "content-command", "request", {
      ...access,
      access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
    });
    bind("content-access", "content", "tenant-access", "tenant-access-contract");
    data("content", "Hosted content authority", "content", [
      "tenantId",
      "recordId",
      "revision",
      "content",
    ]);
    contract(
      "artwork-command",
      "Version QR artwork",
      "api",
      ["tenantId", "recordId", "revision", "assetId"],
      ["revision"],
    );
    bind("artwork-binding", "studio", "artwork", "artwork-command", "request", {
      ...access,
      access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
    });
    bind("artwork-access", "artwork", "tenant-access", "tenant-access-contract");
    data(
      "artwork",
      "Versioned artwork",
      "artwork",
      ["tenantId", "recordId", "revision", "assetId"],
      "assets",
    );
    contract(
      "lookup-mutation",
      "Commit lookup change or disable",
      "api",
      ["tenantId", "recordId", "revision", "enabled", "destination"],
      ["revision"],
    );
    const propagation: RelationshipPolicies = {
      ...access,
      retry: {
        maxAttempts: 5,
        idempotency: "Required",
        key: "tenantId + recordId + monotonic revision",
      },
      failure: {
        timeoutMs: 500,
        outcome: "Buffer",
        detail:
          "Retain pending revision in source authority; replay propagation, fail closed and alert if the illustrative deadline is exceeded.",
      },
      freshness: {
        maxAgeSeconds: 15,
        invalidation: "On write",
        detail:
          "Illustrative mutation-to-lookup propagation bound includes authority revision and cache disable/invalidation.",
      },
    };
    bind("lookup-change", "records", "lookup-updates", "lookup-mutation", "request", propagation);
    bind("abuse-change", "abuse", "lookup-updates", "lookup-mutation", "request", propagation);
    bind("domain-change", "domains", "lookup-updates", "lookup-mutation", "request", propagation);
    contract(
      "domain-command",
      "Attach, transfer or remove custom domain",
      "api",
      ["tenantId", "principalId", "domain", "challenge", "action"],
      ["verification", "tlsState"],
    );
    bind("domains-binding", "settings-screens", "domains", "domain-command", "request", {
      ...access,
      access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
    });
    bind("dns-binding", "domains", "dns", "domain-command");
    data("domain", "Domain ownership and TLS state", "domains", [
      "tenantId",
      "domain",
      "challenge",
      "tlsState",
      "revision",
      "propagationPending",
    ]);
    contract(
      "abuse-command",
      "Disable or appeal abusive link",
      "api",
      ["tenantId", "principalId", "recordId", "reason"],
      ["revision"],
    );
    bind("abuse-binding", "staff-feature", "abuse", "abuse-command", "request", {
      ...access,
      access: { identity: "User", tenant: "Cross tenant", network: "Public" },
    });
    data("abuse", "Audited abuse state", "abuse", [
      "tenantId",
      "recordId",
      "reason",
      "revision",
      "propagationPending",
    ]);
    bind("domain-access", "domains", "tenant-access", "tenant-access-contract");
    contract(
      "audit-action",
      "Record redacted security action",
      "in-process",
      ["tenantId", "principalId", "recordId", "action"],
      ["accepted"],
    );
    for (const source of ["abuse", "domains", "tenant-workspace", "billing-billing"])
      bind(`${source}-audit`, source, "audit", "audit-action");
    elements.push(
      host(
        "api-client",
        "Developer integration",
        "third-party-service",
        "External API-key caller; tenant checks and revocation use the same access authority.",
      ),
    );
    m.nodes.push({
      id: "developer",
      kind: "external-system",
      name: "Developer integration",
      description: "Uses tenant-scoped API keys.",
      container: "api-client",
    });
    m.relationships.push({
      id: "developer-system",
      from: "developer",
      to: "system",
      description: "Manages links through a tenant API key",
      container: "api",
    });
    bind("api-key", "api-client", "records", "manage-records", "request", {
      ...access,
      access: { identity: "API key", tenant: "Tenant scoped", network: "Public" },
    });
    contract(
      "invitation",
      "Deliver tenant invitation",
      "api",
      ["tenantId", "principalId", "subjectId"],
      ["accepted"],
    );
    bind("email-binding", "export-jobs", "email", "invitation");
  }
  const tenantAccess = m.components!.find((c) => c.id === "tenant-access")!;
  tenantAccess.responsibility +=
    " Resolves authenticated session or API-key principal, reads current tenant membership/key status and authorizes each API, persistence, job and export action. Network privacy supplies no authorization.";
  for (const c of m.components!) c.technology ??= "TypeScript responsibility (proposed)";
  // Complete portable lifecycle fields without manufacturing measured objectives or passes.
  for (const d of m.datasets!) {
    d.retentionDays ??= 90;
    if (d.deletion === "Unknown") d.deletion = "Delete";
    if (d.exportAccess === "Unknown") d.exportAccess = "Tenant admin";
  }
  const decision = (
    id: string,
    name: string,
    text: string,
    links: NonNullable<Architecture["decisions"]>[number]["links"],
    unresolved = false,
  ) =>
    m.decisions!.push({
      id,
      name,
      context:
        "Illustrative architecture study; product owner and implementation review must confirm this choice.",
      decision: text,
      consequence: unresolved
        ? "Owner: product owner with operations lead. Blocks production implementation sizing and recovery approval; design exploration can continue."
        : "Required acceptance expectation; no runtime or verification is supplied.",
      status: unresolved ? "Unresolved" : "Accepted",
      links,
      acknowledgements: [],
    });
  decision(
    "hosted-first",
    "Hosted first; growth remains optional",
    "One hosted modular management API, separate redirect for public availability, one worker and relational authority. Cache and visit channel isolate derived work. Analytics stays relational initially; analytical storage/private delivery require a future justified decision.",
    [{ kind: "system", id: "system" }],
  );
  decision(
    "production-objectives",
    "Production workload, SLO and recovery remain open",
    "Production traffic, SLO, RPO/RTO, analytics freshness and commercial retention are unspecified. Values in binding policies are illustrative examples only. Recovery owner: operations; product owner approves loss and retention. Restore authority first, invalidate caches, replay retained durable work and reconcile billing with provider.",
    [{ kind: "system", id: "system" }],
    true,
  );
  decision(
    "tenant-revocation",
    "Tenant access and revocation",
    "Check principal, tenant and current membership/API-key state on every API, database operation, job start and export download. Revocation takes effect on the next authorization check; cancel queued jobs and deny old downloads. Public lookup discloses no tenant-private data.",
    [
      { kind: "component", id: "tenant-access" },
      { kind: "binding", id: "worker-access" },
      { kind: "binding", id: "export-access" },
    ],
  );
  decision(
    "stable-identity",
    qr ? "Stable printed identity and versioned content" : "Stock identity and atomic changes",
    qr
      ? "Printed short URL and paths remain stable across link, artwork and hosted content versions. Encoded payload is separate; changing a static printed payload requires reprint. Lookup mutations use monotonic revisions and propagate within illustrative 15 seconds, including disable; failed propagation retries from authority. Never acknowledge a domain mutation before authoritative commit."
      : "Stock changes and event intent commit in one transaction through the atomic writer; delivery records acknowledged progress and handler deduplicates tenantId/eventId.",
    [
      { kind: "component", id: "records" },
      { kind: "dataset", id: qr ? "product-dataset" : "delivery-domain-state" },
    ],
  );
  decision(
    "report-lifecycle",
    "Analytics meaning, retention and recovery",
    qr
      ? "A visit is an accepted public resolution attempt, not a unique human or a confirmed destination page view. Deduplicate retained event IDs; label gaps and freshness. Illustrative event/aggregate retention: 90 days; exports: 7 days. Delete or anonymize tenant data and objects, invalidate downloads; restored data reapplies deletion tombstones before access. Authorized staff security audit retains redacted actions for illustrative 365 days."
      : "A stock event is a committed quantity mutation at a recorded revision. Reports and exports require current tenant authorization and label freshness. Illustrative event retention is 90 days and exports 7 days. Deletion covers reports and objects; restore reapplies tombstones before access. Operations owns reconciliation; production RPO/RTO remain open.",
    [
      { kind: "component", id: "reporting" },
      { kind: "dataset", id: "reports-dataset" },
      { kind: "dataset", id: "export-dataset" },
    ],
  );
  if (qr) {
    decision(
      "redirect-loss",
      "Redirect availability with bounded analytics degradation",
      "Cache miss/unavailability falls back to authority. Source failure fails closed; disabled links return unavailable. Visit publication has no synchronous persisted-ack prerequisite: illustrative 25 ms attempt and 60-second loss window; beyond that window circuit-break visits until channel recovery, expose analytics gaps. Browser receives Location and follows it; service never fetches the destination. Recovery does not invent lost visits.",
      [
        { kind: "binding", id: "delivery-publish-work-binding" },
        { kind: "binding", id: "lookup-read-cache-binding" },
      ],
    );
    decision(
      "billing-downgrade",
      "Duplicate callbacks and printed links on downgrade",
      "Verify signature, persist provider eventId plus tenantId and acknowledge duplicates without repeating effects. Entitlements owns effective plan state; reconcile out-of-order callbacks with provider version. Downgrade blocks new paid features/exports but preserves existing safe printed links and hosted content; abuse and domain ownership revocation override this grace.",
      [
        { kind: "component", id: "billing-entitlements" },
        { kind: "binding", id: "billing-receive-callback-binding" },
      ],
    );
    decision(
      "domain-enforcement",
      "Domain, TLS and abuse enforcement",
      "Application owns attach/transfer/removal and path identity. DNS provider validates fresh challenge, operates TLS issuance/renewal and certificate removal. Transfer first revokes old tenant routing; no new routing until ownership and TLS are valid. Removal fails closed; provider failure retains pending state. Abuse shutdown updates authority and invalidates cached destinations within illustrative 15 seconds, with audit and monitored overdue enforcement.",
      [
        { kind: "component", id: "domains" },
        { kind: "component", id: "abuse" },
        { kind: "binding", id: "dns-binding" },
      ],
    );
  }
  m.objectives = [
    ...(m.objectives ?? []),
    {
      id: "production-recovery",
      name: "Unspecified production recovery objective",
      scope: { kind: "element", id: "db" },
      metric: "recovery-time",
      boundary:
        "Authoritative store restored, deletion tombstones reapplied, tenant access re-enabled; owner: operations",
      window: "Production value and measurement window require owner decision",
    },
  ];
  m.reviewRequirements.push({
    id: "tenant-access-required",
    name: "Worker authorization is tenant scoped",
    kind: "access",
    binding: "worker-access",
    identity: "Service",
    tenant: "Tenant scoped",
  });
  if (qr)
    m.reviewRequirements.push(
      {
        id: "cache-failure-required",
        name: "Cache failure falls back to authority",
        kind: "failure",
        binding: "lookup-read-cache-binding",
        outcome: "Source fallback",
      },
      {
        id: "cache-required",
        name: "Lookup fallback and bounded disable propagation",
        kind: "cache",
        binding: "lookup-read-cache-binding",
        fallback: "lookup-read-source-binding",
        update: "lookup-invalidate-cache-binding",
      },
      {
        id: "loss-required",
        name: "Public redirect tolerates bounded visit loss",
        kind: "failure",
        binding: "delivery-publish-work-binding",
        outcome: "Bounded loss",
      },
    );
  m.reviewRequirements.push({
    id: "delivery-required",
    name: "Named work handler owns delivery",
    kind: "delivery",
    trigger: "Channel",
    channel: "delivery-channel",
    responsible: { kind: "component", id: "delivery-handler" },
    binding: "delivery-consume-work-binding",
  });
  m.reviewRequirements.push({
    id: "owner-access-required",
    name: "Owner operations require tenant authorization",
    kind: "access",
    binding: "manage",
    identity: "User",
    tenant: "Tenant scoped",
  });
  if (qr)
    m.reviewRequirements.push({
      id: "key-access-required",
      name: "API keys require tenant authorization",
      kind: "access",
      binding: "api-key",
      identity: "API key",
      tenant: "Tenant scoped",
    });
  const step = (
    id: string,
    binding: string,
    text: string,
    phase: ScenarioStep["phase"] = "request",
    client?: ScenarioStep["client"],
  ): ScenarioStep => {
    const c2Binding: Record<string, string> = {
      "record-access": "manage",
      "report-access": "reports",
      "billing-update-entitlements-binding": "billing-persist-billing-binding",
      "delivery-commit-domain-event-binding": "delivery-persist-domain-binding",
      content: "content-binding",
      artwork: "artwork-binding",
      domains: "domains-binding",
      dns: "dns-binding",
      abuse: "abuse-binding",
    };
    binding = c2Binding[binding] ?? binding;
    const b = m.bindings!.find((b) => b.id === binding)!;
    if (!b) throw new Error(`Missing study binding ${binding}`);
    return {
      id,
      binding,
      relationship: {
        kind: b.relationship.kind === "connection" ? "connection" : "componentRelationship",
        id: b.relationship.id,
      },
      text,
      phase,
      ...(client ? { client } : {}),
    };
  };
  const scenario = (
    id: string,
    name: string,
    actor: string,
    trigger: string,
    steps: ScenarioStep[],
    success: string,
    failureSteps: ScenarioStep[],
    failure: string,
    decisions: string[],
    requirements: string[] = [],
  ) => {
    m.scenarios!.push({
      id,
      name,
      actor,
      startCondition: trigger,
      scope: { level: "containers" },
      steps,
      mainOutcomes: ["success"],
      outcomes: [
        {
          id: "success",
          text: success,
          invariants: ["Authored expectation only; no execution evidence."],
          decisions,
          requirements,
        },
        {
          id: "failure",
          text: failure,
          invariants: ["Do not cross tenant boundaries or invent success."],
          decisions,
          requirements,
        },
      ],
      alternatives: [
        {
          id: "failure-path",
          name: "Denied or dependency unavailable",
          kind: "failure",
          condition: failure,
          afterStep: steps[0]!.id,
          steps: failureSteps,
          outcomes: ["failure"],
        },
      ],
    });
  };
  scenario(
    "create-edit",
    qr ? "Create or edit link, artwork and hosted content" : "Commit stock change",
    "member",
    "Authorized owner edits a versioned record.",
    [
      step("submit", "manage", "Submit tenant-owned revision", "request", {
        component: "library",
        state: "loading",
      }),
      step("authorize", "record-access", "Check tenant and principal"),
      step(
        "persist",
        qr ? "product-write" : "delivery-persist-domain-binding",
        qr
          ? "Persist stable identity and new revision"
          : "Atomic writer persists stock state and matching event intent",
      ),
      ...(qr
        ? [
            step(
              "payload",
              "payload-binding",
              "Version encoded payload separately; static payload changes require reprint",
            ),
            step("content", "content-binding", "Version hosted content independently"),
            step("artwork", "artwork-binding", "Version artwork without changing printed identity"),
            step(
              "propagate",
              "lookup-change",
              "Commit lookup revision and propagate bounded cache invalidation",
            ),
          ]
        : [
            step(
              "atomic",
              "delivery-commit-domain-event-binding",
              "Commit stock state and event intent atomically",
            ),
          ]),
      step("response", "manage", "Return committed identity and version", "response", {
        component: "library",
        state: "success",
      }),
    ],
    qr
      ? "Printed URL remains stable; encoded payload, page content and artwork retain distinct versions; lookup updates remain bounded."
      : "Stock and event intent commit together; downstream delivery can recover.",
    [
      step("denied", "manage", "Deny revoked or foreign tenant access", "response", {
        component: "library",
        state: "denied",
      }),
    ],
    "Unauthorized edits fail closed; version conflicts preserve previous committed state.",
    ["stable-identity", "tenant-revocation"],
  );
  scenario(
    "membership",
    "Invite, restrict a member or revoke an API key",
    "member",
    "Tenant administrator changes membership or API-key status.",
    [
      step("invite", "members", "Check administrator and persist membership revision"),
      step("worker", "worker-access", "Recheck access on worker job execution"),
      step("export", "export-access", "Recheck access at export execution and download"),
    ],
    "Revocation denies the next API/data/job/download authorization check; old jobs cancel and links disclose no private tenant data.",
    [
      step("deny", "members", "Deny unauthorized membership change", "response", {
        component: "settings-screens",
        state: "denied",
      }),
    ],
    "Foreign tenant or revoked credentials cannot mutate membership or read exports.",
    ["tenant-revocation"],
    ["tenant-access-required"],
  );
  scenario(
    "analytics-lifecycle",
    "Query, export, delete analytics and recover",
    "member",
    "Authorized tenant requests reporting or deletion; operations may restore state.",
    [
      step("query", "reports", "Authorize tenant report request", "request", {
        component: "report-screens",
        state: "loading",
      }),
      step("access", "report-access", "Check current access before data selection"),
      step("job", "export-job", "Run authorized export or deletion job"),
      step("recheck", "export-access", "Recheck authorization before download"),
      step("objects", "export-write", "Expire export objects or apply deletion tombstones"),
      step("result", "reports", "Return freshness and authorized expiring result", "response", {
        component: "report-screens",
        state: "success",
      }),
    ],
    "Report labels event meaning, gaps and freshness. Deletion covers aggregates and objects; restore reapplies tombstones before reads. Production RPO/RTO remain assigned open decisions.",
    [
      step("fail", "reports", "Expose incomplete report or denied access", "response", {
        component: "report-screens",
        state: "failed",
      }),
    ],
    "No cross-tenant download, silent stale report or resurrection of deleted data after recovery.",
    ["report-lifecycle", "production-objectives", "tenant-revocation"],
  );
  if (qr) {
    scenario(
      "follow-qr",
      "Follow QR during cache or queue failure",
      "visitor",
      "Visitor browser opens an enabled printed URL.",
      [
        step("cache", "lookup-read-cache-binding", "Read cached public destination"),
        step(
          "visit",
          "delivery-publish-work-binding",
          "Attempt bounded visit publication without persisted-ack prerequisite",
          "continuation",
        ),
        {
          id: "response",
          relationship: { kind: "contextRelationship", id: "visitor-system" },
          phase: "response",
          text: "Return Location; browser follows destination, service never fetches it.",
        },
      ],
      "Enabled destination resolves within selected illustrative policies; analytics can degrade within bounded loss window.",
      [
        step(
          "fallback",
          "lookup-read-source-binding",
          "On cache miss or failure, read authority; source failure fails closed",
        ),
        step(
          "queue-fail",
          "delivery-publish-work-binding",
          "Channel unavailable: continue redirect, label analytics gaps and stop attempts after loss window",
          "continuation",
        ),
        {
          id: "fallback-response",
          relationship: { kind: "contextRelationship", id: "visitor-system" },
          phase: "response",
          text: "Return Location only for enabled authoritative record.",
        },
      ],
      "Cache/channel failure does not require a persisted analytics acknowledgement. Source failure or disabled link returns unavailable.",
      ["redirect-loss", "stable-identity"],
      ["cache-required", "loss-required"],
    );
    scenario(
      "billing-webhook",
      "Duplicate billing webhook or downgrade",
      "payment-provider",
      "Provider delivers a signed event, possibly duplicate or out of order.",
      [
        step(
          "callback",
          "billing-receive-callback-binding",
          "Verify signature and durable acceptance before acknowledgement",
        ),
        step(
          "dedup",
          "billing-persist-billing-binding",
          "Deduplicate provider eventId and tenantId",
        ),
        step(
          "entitlement",
          "billing-update-entitlements-binding",
          "Apply effective entitlements; preserve existing safe printed links",
        ),
      ],
      "One effective billing change; duplicate acknowledged without repeating side effects. Downgrade blocks new paid features and preserves safe printed links.",
      [
        step(
          "duplicate",
          "billing-receive-callback-binding",
          "Acknowledge already persisted event; reject invalid signatures",
          "response",
        ),
      ],
      "Invalid signatures fail; duplicate events have no repeated effect; provider reconciliation handles ordering.",
      ["billing-downgrade"],
    );
    scenario(
      "domain-abuse",
      "Domain attach, transfer, removal and abuse shutdown",
      "member",
      "Owner requests domain lifecycle change, or staff confirms abuse.",
      [
        step("domain", "domains", "Authorize attach/transfer/removal and preserve path identity"),
        step("verify", "dns", "Verify fresh DNS challenge and TLS readiness before routing"),
        step(
          "change",
          "domain-change",
          "Revoke old tenant routing and publish authoritative revision",
        ),
        step("abuse", "abuse-binding", "Authorized staff records shutdown and audit reason"),
        step(
          "disable",
          "abuse-change",
          "Disable authority and propagate cache enforcement within illustrative 15 seconds",
        ),
      ],
      "Verified TLS/ownership precede attach; transfer revokes old tenant; removal and abuse fail closed with preserved path identity and monitored enforcement.",
      [
        step(
          "provider-failed",
          "dns",
          "Provider unavailable or ownership invalid: retain pending state; never activate routing",
        ),
      ],
      "No routing before ownership/TLS verification; revoked domain or abusive link cannot continue beyond the selected bound.",
      ["domain-enforcement", "stable-identity"],
    );
  }
  const analytics = m.scenarios!.find((s) => s.id === "analytics-lifecycle")!;
  analytics.alternatives!.push(
    {
      id: "deletion",
      name: "Delete tenant analytics",
      kind: "alternative",
      condition: "Authorized tenant chooses deletion instead of export.",
      afterStep: "query",
      steps: [
        step("delete-access", "export-access", "Recheck authorization; cancel pending exports"),
        step(
          "delete-data",
          "reports-write",
          "Persist deletion tombstone and delete/anonymize tenant reporting data",
        ),
        step(
          "delete-objects",
          "export-write",
          "Delete objects and invalidate all download references",
        ),
      ],
      outcomes: ["success"],
    },
    {
      id: "recovery",
      name: "Restore and reconcile",
      kind: "alternative",
      condition:
        "Operations restores authoritative data after loss; production RPO/RTO need owner approval.",
      afterStep: "query",
      steps: [
        step(
          "restore",
          "reports-write",
          "Operations restores tenant authority and reapplies deletion tombstones before access",
        ),
        step(
          "reconcile",
          "aggregate-query",
          "Reconcile retained events and expose unrecoverable visit gaps",
        ),
        step(
          "authorize-restored",
          "export-access",
          "Recheck current tenant authorization before restored data is accessible",
        ),
      ],
      outcomes: ["success"],
    },
  );
  if (qr) {
    const membership = m.scenarios!.find((s) => s.id === "membership")!;
    membership.alternatives!.push({
      id: "api-key",
      name: "API key and revocation",
      kind: "alternative",
      condition: "Integration uses a tenant API key, then administrator revokes it.",
      afterStep: "invite",
      steps: [
        step("key", "api-key", "Resolve tenant and key status through the shared access authority"),
        step(
          "revoke",
          "members",
          "Persist revocation; next API/data/job/download check denies use",
        ),
        step("job-denied", "worker-access", "Cancel jobs whose principal is now revoked"),
      ],
      outcomes: ["success"],
    });
    const follow = m.scenarios!.find((s) => s.id === "follow-qr")!;
    const outcome = (id: string, text: string) => ({
      id,
      text,
      invariants: ["Disabled or unauthorized records never return a destination."],
      decisions: ["redirect-loss", "stable-identity"],
      requirements: ["cache-required", "loss-required"],
    });
    follow.outcomes!.push(
      outcome(
        "fallback",
        "Cache miss or failure uses authoritative enabled destination; browser follows returned Location.",
      ),
      outcome(
        "analytics-degraded",
        "Redirect succeeds without persisted analytics acknowledgement; loss is bounded by illustrative 60-second window, then visits circuit-break until recovery.",
      ),
      outcome(
        "unavailable",
        "Source unavailable, unknown key or disabled record fails closed; no stale destination escapes the selected age bound.",
      ),
    );
    follow.alternatives = [
      {
        id: "cache-miss",
        name: "Cache miss or unavailable",
        kind: "alternative",
        condition: "Lookup misses or cache fails within illustrative 25 ms attempt.",
        afterStep: "cache",
        steps: [
          step("source", "lookup-read-source-binding", "Read enabled authoritative destination"),
          step(
            "publish",
            "delivery-publish-work-binding",
            "Attempt best-effort visit publication",
            "continuation",
          ),
          {
            id: "fallback-return",
            relationship: { kind: "contextRelationship", id: "visitor-system" },
            phase: "response",
            text: "Return Location; browser follows the destination.",
          },
        ],
        outcomes: ["fallback"],
      },
      {
        id: "channel-failed",
        name: "Visit channel unavailable",
        kind: "failure",
        condition: "Visit channel cannot accept work; public resolution authority is available.",
        afterStep: "cache",
        steps: [
          step(
            "lost-visit",
            "delivery-publish-work-binding",
            "Continue resolution; mark loss window and stop attempts beyond it",
            "continuation",
          ),
          {
            id: "degraded-return",
            relationship: { kind: "contextRelationship", id: "visitor-system" },
            phase: "response",
            text: "Return enabled Location without awaiting persisted acknowledgement.",
          },
        ],
        outcomes: ["analytics-degraded"],
      },
      {
        id: "source-failed",
        name: "Authority unavailable or disabled",
        kind: "failure",
        condition: "Cache misses and authority fails, or authoritative record is disabled.",
        afterStep: "cache",
        steps: [
          step(
            "failed-source",
            "lookup-read-source-binding",
            "Fail closed within illustrative source timeout; return unavailable",
          ),
        ],
        outcomes: ["unavailable"],
      },
    ];
    const billing = m.scenarios!.find((s) => s.id === "billing-webhook")!;
    billing.outcomes!.push({
      id: "duplicate-accepted",
      text: "Previously persisted provider event is acknowledged; no entitlement or financial side effect repeats.",
      invariants: ["Deduplicate provider eventId plus tenantId."],
      decisions: ["billing-downgrade"],
      requirements: [],
    });
    billing.alternatives!.push({
      id: "duplicate-path",
      name: "Duplicate signed callback",
      kind: "alternative",
      condition: "Signature is valid and eventId/tenantId is already persisted.",
      afterStep: "callback",
      steps: [
        step(
          "existing",
          "billing-persist-billing-binding",
          "Read persisted deduplication identity; skip side effects",
        ),
        step(
          "ack",
          "billing-receive-callback-binding",
          "Acknowledge duplicate durable acceptance",
          "response",
        ),
      ],
      outcomes: ["duplicate-accepted"],
    });
    const domains = m.scenarios!.find((s) => s.id === "domain-abuse")!;
    domains.steps = domains.steps.slice(0, 3);
    domains.alternatives!.push(
      {
        id: "transfer",
        name: "Transfer domain",
        kind: "alternative",
        condition: "New tenant requests domain transfer with a fresh ownership challenge.",
        afterStep: "domain",
        steps: [
          step(
            "revoke-old",
            "domain-change",
            "Revoke old tenant routing first; retain path identity",
          ),
          step(
            "reverify",
            "dns-binding",
            "Verify new tenant ownership and TLS before new routing activates",
          ),
        ],
        outcomes: ["success"],
      },
      {
        id: "remove",
        name: "Remove domain",
        kind: "alternative",
        condition: "Authorized owner removes the domain.",
        afterStep: "domain",
        steps: [
          step(
            "remove-route",
            "domain-change",
            "Disable authority and propagate cache invalidation; preserve path records",
          ),
          step(
            "remove-tls",
            "dns-binding",
            "Provider removes certificate association; routing remains disabled if provider fails",
          ),
        ],
        outcomes: ["success"],
      },
      {
        id: "shutdown",
        name: "Staff abuse shutdown",
        kind: "failure",
        condition: "Authorized staff confirms abuse; this overrides billing grace.",
        afterStep: "domain",
        steps: [
          {
            id: "staff-entry",
            relationship: { kind: "contextRelationship", id: "staff-system" },
            text: "Staff enters audited support boundary.",
          },
          step("decision", "abuse-binding", "Record authorized abuse shutdown and audit reason"),
          step(
            "disable",
            "abuse-change",
            "Disable authority and propagate within illustrative 15 seconds; monitor overdue enforcement",
          ),
        ],
        outcomes: ["success"],
      },
    );
  }
  // Several exact operations share one C2 communication boundary. Keep C3 ownership/bindings.
  const retained = new Map<string, DesignDocument["connections"][number]>();
  const remap = new Map<string, string>();
  for (const c of [...design.connections, ...connections]) {
    const key = `${c.from.element}/${c.to.element}/${c.planned?.protocol}/${c.planned?.interaction}`;
    const prior = retained.get(key);
    if (prior) remap.set(c.id, prior.id);
    else retained.set(key, c);
  }
  for (const b of m.bindings!)
    if (b.relationship.kind === "connection")
      b.relationship.id = remap.get(b.relationship.id) ?? b.relationship.id;
  for (const c of m.components!)
    c.usesConnections = [...new Set(c.usesConnections.map((id) => remap.get(id) ?? id))];
  for (const s of m.scenarios!)
    for (const steps of [s.steps, ...(s.alternatives?.map((a) => a.steps) ?? [])])
      for (const step of steps)
        if (step.relationship.kind === "connection")
          step.relationship.id = remap.get(step.relationship.id) ?? step.relationship.id;
  const allElements = [...design.elements, ...elements];
  const external = allElements.filter((e) =>
    ["third-party-service", "billing-provider"].includes(e.planned ?? ""),
  );
  m.deployments = [
    ...(m.deployments ?? []),
    deploymentEnvironmentSchema.parse({
      id: "hosted-study",
      name: "Hosted first — illustrative placement",
      kind: "Hosted",
      description:
        "Placement intent only; replicas, regions and recovery capacity require production decisions.",
      nodes: [
        {
          id: "applications",
          name: "Hosted application tier",
          kind: "deployment",
          responsibility:
            "Operate management, redirect and worker processes with separate failure budgets.",
          operation: "Self operated",
        },
        {
          id: "managed-data",
          name: "Managed data services",
          kind: "deployment",
          responsibility:
            "Platform operates storage/cache; operations owns restore drills and deletion reconciliation.",
          operation: "Externally operated",
        },
        {
          id: "broker",
          name: "Managed message broker",
          kind: "infrastructure",
          responsibility:
            "Hosts named logical channels; sharing infrastructure does not share delivery policies.",
          operation: "Externally operated",
        },
        {
          id: "ingress",
          name: "HTTPS ingress and TLS termination",
          kind: "infrastructure",
          responsibility:
            "Hosted platform terminates TLS; custom-domain provider owns challenge, issuance/renewal and removal.",
          operation: "Externally operated",
        },
      ],
      instances: allElements
        .filter((e) => !external.includes(e))
        .map((e) => ({
          id: `instance-${e.id}`,
          element: e.id,
          node:
            e.planned === "job-queue"
              ? "broker"
              : ["relational-store", "distributed-cache", "object-storage"].includes(
                    e.planned ?? "",
                  )
                ? "managed-data"
                : "applications",
        })),
      externals: external.map((e) => ({
        id: `external-${e.id}`,
        reference: { kind: "element", id: e.id },
      })),
      interactions: [],
    }),
  ];
  return [
    ...elements.map((element): OperationInput => ({ op: "addElement", element })),
    ...connections
      .filter((c) => !remap.has(c.id))
      .map((connection): OperationInput => ({ op: "connect", connection })),
    ...design.connections
      .filter((c) => remap.has(c.id))
      .map((c): OperationInput => ({ op: "disconnect", id: c.id })),
    ...[...retained.values()].map(
      (c): OperationInput => ({
        op: "updateConnection",
        id: c.id,
        label:
          c.to.element === "db"
            ? "Reads / writes authoritative data"
            : c.to.element === "lookup-cache"
              ? "Reads / invalidates cached lookup"
              : c.planned!.label,
      }),
    ),
    { op: "setArchitecture", architecture: m },
  ];
}

export function architectureProof(product: ProofProduct) {
  let design = designSchema.parse({ schemaVersion: 2, revision: 0 });
  for (const s of proofSteps(product)) {
    const result = applyOperations(
      design,
      architectureProofOperations(design, product, s.id),
      plannedOnly,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    design = result.design;
  }
  // Example creation is one saved batch; staged authoring retains its own semantic history.
  design.revision = 0;
  const layout: LayoutDocument = {
    schemaVersion: 1,
    items: Object.fromEntries(
      design.elements.map((e, i) => [
        e.id,
        { x: (i % 3) * 420 + 40, y: Math.floor(i / 3) * 310 + 40 },
      ]),
    ),
    architecture: {
      "focus-management": {
        name: "Management",
        members: [
          "container:web",
          "container:api",
          "container:db",
          ...(product === "qrwty" ? ["container:assets"] : []),
        ],
        includeDependencies: false,
        positions: {},
      },
      ...(product === "qrwty"
        ? {
            "focus-redirect": {
              name: "Public redirect",
              members: [
                "container:redirect",
                "container:lookup-cache",
                "container:db",
                "container:delivery-channel",
              ],
              includeDependencies: false,
              positions: {},
            },
          }
        : {}),
      "focus-analytics": {
        name: "Analytics",
        members: [
          "container:worker",
          "container:delivery-channel",
          "container:db",
          ...(product === "qrwty" ? ["container:assets"] : []),
        ],
        includeDependencies: false,
        positions: {},
      },
    },
  };
  return { name: design.architecture!.system.name, design, layout };
}
