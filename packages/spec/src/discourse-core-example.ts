/** P71a partial design. P71b owns executable behavior, H briefs, scenarios and final traces. */

import type { ArchitectureComponent } from "./architecture.ts";
import { type Architecture, architectureSchema } from "./architecture.ts";
import type { DesignDocument } from "./design.ts";
import { emptyDesign } from "./design.ts";
import { discourseCoreAccess } from "./discourse-core-access.ts";
import { discourseCoreAdapters } from "./discourse-core-adapters.ts";
import { discourseCoreContracts } from "./discourse-core-contracts.ts";
import { dcRef, discourseCoreData } from "./discourse-core-data.ts";
import type { LayoutDocument } from "./layout.ts";

export const DISCOURSE_CORE_EXAMPLE = {
  id: "discourse-core",
  name: "Discourse core · partial backend design",
  description:
    "P71a: REST contracts, discussion authority and live category access. Commands, effects, typed H briefs and five journeys remain P71b. All runtime implementations are planned.",
  useCases: "Partial design · D01–D20 foundation · no runtime or observed acceptance",
  accent: "violet",
} as const;
const responsibilities: [string, string, string, string, string][] = [
  [
    "sessions",
    "dc-api",
    "Account & session adapter",
    "authorization-module",
    "Reuse the existing durable principal/session boundary, Origin/CSRF and application isolation. Public registration never grants workspace membership.",
  ],
  [
    "access",
    "dc-api",
    "Membership & access",
    "authorization-module",
    "Own current workspace/group membership and category grants. Read current persisted authority for every sensitive observation and replay; deny cross-scope references.",
  ],
  [
    "categories",
    "dc-api",
    "Category registry",
    "domain-module",
    "Own public/private category definitions; grant changes remain separate administrator operations. A category is not a tenant.",
  ],
  [
    "content",
    "dc-api",
    "Topics, posts & revisions",
    "domain-module",
    "Own atomic topic/initial-post creation, replies, per-post versions and immutable revisions. State transitions and command bindings remain P71b.",
  ],
  [
    "moderation",
    "dc-api",
    "Flag review & moderation",
    "domain-module",
    "Own unique active reporter/post flags and moderator review. Hide/remove actions require current category access, version fencing and protected audit.",
  ],
  [
    "subscriptions",
    "dc-api",
    "Subscriptions & preferences",
    "domain-module",
    "Own one subscription per scope/principal/topic, watch/mute and bounded inbox/email channels. Preferences never establish category authority.",
  ],
  [
    "attachments",
    "dc-api",
    "Private attachment lifecycle",
    "file-lifecycle",
    "Own stage/validate/attach metadata, private byte access and recoverable association. SQL and object bytes do not share atomicity.",
  ],
  [
    "search",
    "dc-api",
    "Scoped search & discovery",
    "search-module",
    "Read the PostgreSQL projection through current source/category policy before snippets and pagination. Ranking remains a project-owned H seam.",
  ],
  [
    "audit",
    "dc-api",
    "Protected audit",
    "domain-module",
    "Retain moderator-only actor/action/target/time metadata. Audit is not an alternate ordinary text/history export.",
  ],
  [
    "privacy",
    "dc-api",
    "Privacy requests & retention",
    "domain-module",
    "Own subject request progress, holds and delivery cancellation intent. The bounded export/erase policy is a P71b H brief.",
  ],
  [
    "notifications",
    "dc-worker",
    "Notification materialization & delivery",
    "notifications-module",
    "Own notification/digest selection and delivery; recheck current recipient membership/category/preferences before materialization, reads and send. Per-event/recipient receipts differ from command receipts.",
  ],
  [
    "projections",
    "dc-worker",
    "Projection maintenance",
    "workflow-module",
    "Apply bounded source-policy-aware search/ranking updates and rebuilds. Removed/hidden content cannot be resurrected from stale projection rows.",
  ],
  [
    "cleanup",
    "dc-worker",
    "Bounded cleanup",
    "workflow-module",
    "Reclaim only unlinked/incomplete private objects older than 24 hours; use fenced claims and recheck live association before destructive work.",
  ],
  [
    "mail",
    "dc-worker",
    "Inbound mail adapter",
    "integration-adapter",
    "Verify original bytes, provider identity/timestamp and message receipt before normal current posting policy. Parsing is a separate P71b pure H seam.",
  ],
];
export function discourseCoreExample(): {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
} {
  const design = emptyDesign();
  const model: Architecture = architectureSchema.parse({
    system: {
      name: "Discourse core · partial backend design",
      description:
        "P71a foundation only. Proposed TypeScript modular API and independent worker; REST/JSON/OpenAPI adaptation informed by pinned Discourse source. No upstream compatibility, runtime availability or observed benchmark completion. P71b owns commands/effects/H briefs/scenarios/focused views/final trace.",
      businessTenancy: "Personal workspaces",
      authorization: "Roles and permissions",
      dataIsolation: "Shared scoped data",
      deliveryModel: "Hosted and private",
    },
    contracts: structuredClone(discourseCoreContracts),
    components: [],
    componentRelationships: [],
    interfaces: [],
    bindings: [],
    datasets: [],
    decisions: [],
    scenarios: [],
  });
  design.architecture = model;
  for (const [id, planned, name, description, technology] of [
    [
      "dc-api",
      "application-api",
      "Discussion API",
      "One modular application owns current access and discussion mutations. Endpoint details live in contracts.",
      "TypeScript · proposed; no runtime selected",
    ],
    [
      "dc-worker",
      "background-worker",
      "Discussion worker",
      "Independent process for named database-backed notification/projection/cleanup/digest/mail channels.",
      "TypeScript · proposed; no runtime selected",
    ],
    [
      "dc-db",
      "relational-store",
      "Discussion PostgreSQL",
      "Authoritative scoped domain state and logical delivery channels. No Redis, search cluster or broker deployment is implied.",
      "PostgreSQL · planned",
    ],
    [
      "dc-files",
      "object-storage",
      "Private object store",
      "Explicit private byte adapter; proxy reads after current policy checks; no durable public URL authority.",
      "Object store adapter · unresolved implementation",
    ],
    [
      "dc-email",
      "third-party-service",
      "Email delivery provider",
      "External delivery with stable identities, finite retries and uncertain-outcome reconciliation.",
      "SMTP/provider adapter · unresolved implementation",
    ],
    [
      "dc-client",
      "third-party-service",
      "External thin client",
      "Contract consumer outside generated scope. No page layout or planned generated frontend.",
      "REST/JSON consumer · external implementation",
    ],
  ])
    design.elements.push({
      id: id!,
      planned: planned!,
      name: name!,
      description: description!,
      technology: technology!,
      template: null,
      config: {},
      attachments: [],
      notes:
        "P71a partial design. No runtime, generation or benchmark pass. See docs/examples/discourse-core.md.",
    });
  const connection = (
    id: string,
    from: string,
    to: string,
    label: string,
    protocol: NonNullable<DesignDocument["connections"][number]["planned"]>["protocol"],
    async = false,
  ) =>
    design.connections.push({
      id,
      kind: "depends-on",
      from: { element: from },
      to: { element: to },
      planned: {
        label,
        protocol,
        interaction: async ? "Asynchronous" : "Request / response",
        security: "Service identity",
      },
    });
  connection("dc-client-api", "dc-client", "dc-api", "Calls scoped REST operations", "HTTPS/JSON");
  connection("dc-api-db", "dc-api", "dc-db", "Reads/writes domain and atomic event intent", "SQL");
  connection(
    "dc-worker-db",
    "dc-worker",
    "dc-db",
    "Claims named channels and reads/writes eligible effects",
    "SQL",
    true,
  );
  connection(
    "dc-api-files",
    "dc-api",
    "dc-files",
    "Stages and proxies authorized private bytes",
    "HTTPS/S3",
  );
  connection(
    "dc-worker-files",
    "dc-worker",
    "dc-files",
    "Rechecks and removes eligible orphan bytes",
    "HTTPS/S3",
  );
  connection(
    "dc-worker-email",
    "dc-worker",
    "dc-email",
    "Delivers eligible mail or records uncertainty",
    "SMTP/TLS",
    true,
  );
  design.elements.find((e) => e.id === "dc-files")!.classification = {
    kind: "Data store",
    ownership: "External responsibility",
    operation: "Externally operated",
  };
  model.components = responsibilities.map(
    ([id, element, name, capability, responsibility]): ArchitectureComponent => ({
      id: `dc-${id}`,
      element,
      name,
      capability,
      responsibility,
      technology: "TypeScript responsibility · proposed adaptation",
      config: {},
      members: [],
      usesResources: [],
      usesConnections:
        element === "dc-api"
          ? ["dc-api-db", ...(id === "attachments" ? ["dc-api-files"] : [])]
          : [
              "dc-worker-db",
              ...(id === "cleanup"
                ? ["dc-worker-files"]
                : id === "notifications" || id === "digests"
                  ? ["dc-worker-email"]
                  : []),
            ],
    }),
  );
  for (const [from, to, description] of [
    ["content", "access", "Checks current category grants"],
    ["categories", "access", "Checks administrator grants"],
    ["moderation", "access", "Checks moderator and current category access"],
    ["moderation", "content", "Applies audited content decisions"],
    ["files", "access", "Checks owner and parent access"],
    ["files", "content", "Associates validated private attachments"],
    ["search", "access", "Filters before matching/snippets/pages"],
    ["subscriptions", "access", "Checks owner and current topic access"],
    ["content", "audit", "Appends protected mutation metadata"],
    ["privacy", "access", "Checks subject/admin authority and holds"],
  ])
    model.componentRelationships!.push({
      id: `dc-${from}-${to}`,
      from: `dc-${from === "files" ? "attachments" : from}`,
      to: `dc-${to === "files" ? "attachments" : to}`,
      description: description!,
      protocol: "In process",
      interaction: "Request / response",
    });
  const people = [
    [
      "visitor",
      "Visitor",
      "Uses public account/session endpoints only; scoped content requires current workspace membership.",
    ],
    ["member", "Member", "Reads authorized categories and publishes content."],
    ["moderator", "Moderator", "Reviews flags and performs authorized audited transitions."],
    ["administrator", "Administrator", "Manages memberships and grants; no public self-promotion."],
  ];
  model.nodes = [
    ...people.map(([id, name, description]) => ({
      id: `dc-${id}`,
      kind: "person" as const,
      name: name!,
      description: description!,
    })),
    ...["client", "files", "email"].map((id) => ({
      id: `dc-${id}-external`,
      kind: "external-system" as const,
      name: design.elements.find((e) => e.id === `dc-${id}`)!.name,
      container: `dc-${id}`,
      description: "Explicit external boundary; design contract only.",
    })),
  ];
  model.relationships = [
    ...people.map(([id]) => ({
      id: `dc-${id}-system`,
      from: `dc-${id}`,
      to: "system",
      description:
        id === "visitor"
          ? "Creates account or manages session"
          : "Uses currently authorized discussion operations",
      container: "dc-api",
    })),
    {
      id: "dc-system-files",
      from: "system",
      to: "dc-files-external",
      description: "Stores private bytes behind current application policy",
      container: "dc-api",
    },
    {
      id: "dc-system-email",
      from: "system",
      to: "dc-email-external",
      description: "Sends eligible notifications with reconciliation",
      container: "dc-worker",
    },
    {
      id: "dc-client-system",
      from: "dc-client-external",
      to: "system",
      description: "Consumes exact REST/JSON contracts",
      container: "dc-api",
    },
  ];
  // One provided interface per cohesive contract; the external client consumes each exact version.
  for (const contract of discourseCoreContracts) {
    const key = contract.id.replace(/^dc-/, "").replace(/-api$/, "");
    const owner =
      key === "files"
        ? "dc-attachments"
        : key === "trust"
          ? "dc-access"
          : key === "digests"
            ? "dc-subscriptions"
            : key === "inbound"
              ? "dc-access"
              : `dc-${key}`;
    model.interfaces!.push(
      {
        id: `${contract.id}-provided`,
        name: contract.name,
        owner: { kind: "component", id: owner },
        direction: "provided",
        necessity: "required",
        contract: dcRef(contract.id),
      },
      {
        id: `${contract.id}-required`,
        name: `External ${contract.name}`,
        owner: { kind: "element", id: "dc-client" },
        direction: "required",
        necessity: "required",
        contract: dcRef(contract.id),
      },
    );
    model.bindings!.push({
      id: `${contract.id}-binding`,
      name: `REST ${contract.name}`,
      relationship: { kind: "connection", id: "dc-client-api" },
      provided: `${contract.id}-provided`,
      required: `${contract.id}-required`,
      contract: dcRef(contract.id),
      role: "request",
      transport: "HTTPS/JSON",
      businessSynchrony: "Synchronous",
      policies: {
        access: {
          identity: key === "sessions" ? "Public" : "User",
          tenant: key === "sessions" ? "Public" : "Tenant scoped",
          network: "Public",
        },
      },
    });
  }
  model.backend = discourseCoreData(model);
  discourseCoreAccess(design);
  discourseCoreAdapters(model);
  model.decisions!.push(
    {
      id: "dc-partial-boundary",
      name: "P71a partial design boundary",
      context:
        "P71a owns context/C2/C3/contracts/data/access; the mandatory execution split leaves P71b separate.",
      decision:
        "Commands/effects, H implementation briefs, all five scenarios, focused views and final D case trace remain P71b. No runtime implementation is selected; all implementations remain planned. No benchmark case has run.",
      status: "Accepted",
      consequence: "All runtime availability and observed evidence remain absent; P71a is partial.",
      links: [{ kind: "system", id: "system" }],
      acknowledgements: [],
    },
    {
      id: "dc-provenance",
      name: "Pinned source and deliberate adaptation",
      context:
        "P60a pins Discourse v3.4.0 at 05a304006600f36c3e45d19c9c5919f43f5541c9 with source-map.json. Static inspiration does not establish upstream end-to-end guarantees.",
      decision:
        "REST/JSON/OpenAPI, TypeScript, immutable accepted edit history, atomic command receipt/event intent and current-policy byte proxying are Jeeves adaptations. No upstream code is copied; group/category and workspace boundaries remain separate.",
      status: "Accepted",
      consequence: "All runtime availability and observed evidence remain absent; P71a is partial.",
      links: [{ kind: "system", id: "system" }],
      acknowledgements: [],
    },
  );
  return { name: DISCOURSE_CORE_EXAMPLE.name, design, layout: { schemaVersion: 1, items: {} } };
}
