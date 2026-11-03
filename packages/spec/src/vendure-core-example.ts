/** P72a partial Vendure study. P72b owns commands/payment/recovery/H/scenarios/final trace. */
import type { Architecture, ArchitectureComponent } from "./architecture.ts";
import { architectureSchema } from "./architecture.ts";
import type { DesignDocument } from "./design.ts";
import { emptyDesign } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";
import { vendureCoreAccess } from "./vendure-core-access.ts";
import { vendureCoreAdapters } from "./vendure-core-adapters.ts";
import { vendureCoreContracts } from "./vendure-core-contracts.ts";
import { vcRef, vendureCoreData } from "./vendure-core-data.ts";
export const VENDURE_CORE_EXAMPLE = {
  id: "vendure-core",
  name: "Vendure core · partial backend design",
  description:
    "P72a REST/data/access study: exact minor-unit money and immutable quote/order snapshots. P72b behavior, hooks and five scenarios remain incomplete; no runtime or observed acceptance.",
  useCases: "Partial design · V01–V20 foundations · zero observed points",
  accent: "orange",
} as const;
const responsibilities: [string, string, string, string, string][] = [
  [
    "sessions",
    "vc-api",
    "Account & session adapter",
    "authorization-module",
    "Reuse existing durable principal/session ownership, application-specific cookies, exact Origin/CSRF and restart/logout revocation. Registration cannot grant shop roles.",
  ],
  [
    "access",
    "vc-api",
    "Shop access & membership",
    "authorization-module",
    "Own current active shop membership and persisted customer/admin/fulfillment/seller roles. Trusted scope comes from server checks; body/header/cursor identity grants nothing.",
  ],
  [
    "catalog",
    "vc-api",
    "Catalog & publication",
    "domain-module",
    "Own products/variants/current USD prices and allowed asset associations. Publication is checked before public detail/list/search/bytes. Prices are independently versioned per variant.",
  ],
  [
    "carts",
    "vc-api",
    "Carts & exact quotes",
    "domain-module",
    "Own bounded versioned carts and immutable five-minute line/address/price/tax/shipping snapshots. Checked safe integer minor units; no client price authority or floating arithmetic.",
  ],
  [
    "inventory",
    "vc-api",
    "Inventory & reservations",
    "domain-module",
    "Own one-location stock, active/held/consumed reservations and allocated unshipped units. Unknown payments hold stock. P72b binds lock order, expiry and last-item behavior.",
  ],
  [
    "orders",
    "vc-api",
    "Orders & immutable snapshots",
    "domain-module",
    "Own converted-cart orders, purchased lines and exact immutable commercial provenance. State/version are distinct from purchased quantities/prices. P72b binds checkout atomicity and guarded lifecycle.",
  ],
  [
    "payments",
    "vc-api",
    "Durable payment attempts",
    "integration-adapter",
    "Own persisted provider/request/amount/event identities. Network calls are outside SQL; unknown does not roll back a charge or authorize a new key. P72b binds callbacks, holds and reconciliation.",
  ],
  [
    "fulfillment",
    "vc-api",
    "Fulfillment & quantity ceilings",
    "domain-module",
    "Own shipments and per-line quantities under paid/allocated ceilings, current fulfillment roles and order version. Sum all shipments; purchased line snapshots remain unchanged.",
  ],
  [
    "audit",
    "vc-api",
    "Safe history & audit",
    "domain-module",
    "Own append-only actor/action/order/time metadata, current owner/staff history and administrator-only audit. No address/cost/stock/provider secrets in audit.",
  ],
  [
    "search",
    "vc-api",
    "Public search & discovery",
    "search-module",
    "Read PostgreSQL projection through current source publication before matching/snippets/keyset pages. Rebuild cannot restore hidden products or leak cost/stock.",
  ],
  [
    "promotions",
    "vc-api",
    "Promotion policy seam",
    "domain-module",
    "H13 pure bounded promotion allocation over trusted quote inputs remains P72b; no implemented promotion engine.",
  ],
  [
    "rates",
    "vc-api",
    "Tax & shipping quote seams",
    "integration-adapter",
    "H14 and H15 independently typed tax/carrier quote/provenance/expiry remain P72b. Fixture 750bps tax and flat500 shipping do not supply production adapters.",
  ],
  [
    "returns",
    "vc-api",
    "Returns & refund policy seam",
    "domain-module",
    "H16 return quantities/refundable merchandise-tax ceiling and stable unknown refund identity remain P72b. Shipping stays nonrefundable.",
  ],
  [
    "marketplace",
    "vc-api",
    "Seller attribution & settlement seam",
    "domain-module",
    "H17 same-shop seller line subset and fee/net payout remain distinct from customer charge and private order address. No marketplace runtime supplied.",
  ],
  [
    "currency",
    "vc-api",
    "Immutable conversion policy seam",
    "domain-module",
    "H18 snapshotted rational USD→EUR/half-even provenance remains P72b. Core USD and completed order amounts never change interpretation.",
  ],
  [
    "provider",
    "vc-api",
    "Stripe adapter policy seam",
    "integration-adapter",
    "H19 concrete Stripe protocol/evidence remains separate from the V08 reference protocol. No live adapter availability is claimed.",
  ],
  [
    "sync",
    "vc-api",
    "Warehouse authority seam",
    "integration-adapter",
    "H20 verified absolute-on-hand source mapping, revision receipt and commitment reconciliation remain P72b. No connector execution.",
  ],
  [
    "notifications",
    "vc-worker",
    "Notification materialization & delivery",
    "notifications-module",
    "Recheck persisted recipient membership/order ownership before materialization/read/send. Event-recipient worker receipts differ from command replay; P72b binds durable effects.",
  ],
  [
    "projections",
    "vc-worker",
    "Catalog projection maintenance",
    "workflow-module",
    "Bounded authoritative source rebuilds retain stable product/variant identities and current publication. No external search cluster or freshness measurement.",
  ],
  [
    "expiry",
    "vc-worker",
    "Reservation expiry & reconciliation",
    "workflow-module",
    "Bounded fenced work over current order/reservation/stock. Held or consumed units never blindly expire. P72b owns leases/retries and payment race semantics.",
  ],
];
export function vendureCoreExample(): {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
} {
  const design = emptyDesign();
  const model: Architecture = architectureSchema.parse({
    system: {
      name: VENDURE_CORE_EXAMPLE.name,
      description: VENDURE_CORE_EXAMPLE.description,
      businessTenancy: "Personal workspaces",
      authorization: "Roles and permissions",
      dataIsolation: "Shared scoped data",
      deliveryModel: "Hosted and private",
    },
    contracts: structuredClone(vendureCoreContracts),
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
      "vc-api",
      "application-api",
      "Commerce API",
      "One modular application owns shop state and command authority.",
      "TypeScript · proposed",
    ],
    [
      "vc-worker",
      "background-worker",
      "Commerce worker",
      "Independent process for SQL-backed expiry/delivery/projection/reconciliation channels.",
      "TypeScript · proposed",
    ],
    [
      "vc-db",
      "relational-store",
      "Commerce PostgreSQL",
      "Single authoritative domain store. SQL transactions never include external providers or bytes.",
      "PostgreSQL · planned",
    ],
    [
      "vc-client",
      "third-party-service",
      "External thin client",
      "Explicit REST consumer outside generated backend scope.",
      "REST/JSON consumer · external",
    ],
    [
      "vc-files",
      "object-storage",
      "Catalog & receipt byte store",
      "External bytes; public catalog association and private order receipt require separate current policies.",
      "Byte-store adapter · unresolved",
    ],
    [
      "vc-email",
      "third-party-service",
      "Notification provider",
      "External delivery with durable identity and visible uncertainty.",
      "Delivery adapter · unresolved",
    ],
    [
      "vc-payment",
      "third-party-service",
      "Payment providers",
      "Reference-v1 protocol and separately pinned Stripe protocol; neither is an implemented live provider.",
      "Reference/Stripe adapters · unresolved",
    ],
    [
      "vc-warehouse",
      "third-party-service",
      "Warehouse source",
      "Original-byte authenticated warehouse-v1 with exact persisted shop/SKU mapping.",
      "Warehouse adapter · unresolved",
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
        "P72a partial design only; no application runtime, generation or benchmark pass. See docs/examples/vendure-core.md.",
    });
  const connect = (
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
  connect(
    "vc-client-api",
    "vc-client",
    "vc-api",
    "Calls scoped exact REST operations",
    "HTTPS/JSON",
  );
  connect("vc-api-db", "vc-api", "vc-db", "Owns authoritative state and atomic intent", "SQL");
  connect(
    "vc-worker-db",
    "vc-worker",
    "vc-db",
    "Executes granted bounded modules and claims channels",
    "SQL",
    true,
  );
  connect(
    "vc-api-files",
    "vc-api",
    "vc-files",
    "Proxies currently authorized catalog and receipt bytes",
    "HTTPS/S3",
  );
  connect(
    "vc-worker-email",
    "vc-worker",
    "vc-email",
    "Delivers eligible notifications",
    "SMTP/TLS",
    true,
  );
  connect(
    "vc-api-payment",
    "vc-api",
    "vc-payment",
    "Dispatches/looks up durable payment identities",
    "HTTPS/JSON",
  );
  connect(
    "vc-payment-api",
    "vc-payment",
    "vc-api",
    "Supplies original-byte authenticated callbacks",
    "HTTPS/JSON",
    true,
  );
  connect(
    "vc-warehouse-api",
    "vc-warehouse",
    "vc-api",
    "Supplies verified source revision envelopes",
    "HTTPS/JSON",
    true,
  );
  design.elements.find((e) => e.id === "vc-files")!.classification = {
    kind: "Data store",
    ownership: "External responsibility",
    operation: "Externally operated",
  };
  model.components = responsibilities.map(
    ([id, element, name, capability, responsibility]): ArchitectureComponent => ({
      id: `vc-${id}`,
      element,
      name,
      capability,
      responsibility,
      technology: "Proposed TypeScript responsibility; no implementation selected",
      config: {},
      members: [],
      usesResources: [],
      usesConnections:
        element === "vc-worker"
          ? ["vc-worker-db", ...(id === "notifications" ? ["vc-worker-email"] : [])]
          : [
              "vc-api-db",
              ...(id === "catalog" || id === "orders" ? ["vc-api-files"] : []),
              ...(id === "payments" || id === "provider"
                ? ["vc-api-payment", "vc-payment-api"]
                : id === "sync"
                  ? ["vc-warehouse-api"]
                  : []),
            ],
    }),
  );
  for (const [from, to, description] of [
    ["carts", "catalog", "Selects current trusted variant prices"],
    ["orders", "carts", "Consumes exact immutable quote"],
    ["orders", "inventory", "Reserves/allocates authoritative stock"],
    ["payments", "orders", "Requests guarded payment state"],
    ["payments", "inventory", "Preserves held stock on uncertainty"],
    ["fulfillment", "orders", "Checks paid snapshot and CAS"],
    ["fulfillment", "inventory", "Consumes unshipped allocations"],
    ["catalog", "access", "Checks current administrator"],
    ["orders", "access", "Checks current owner/staff"],
    ["marketplace", "access", "Checks current seller subset"],
    ["provider", "payments", "Maps concrete provider protocol"],
    ["sync", "inventory", "Validates source authority and commitments"],
  ])
    model.componentRelationships!.push({
      id: `vc-${from}-${to}`,
      from: `vc-${from}`,
      to: `vc-${to}`,
      description: description!,
      protocol: "In process",
      interaction: "Request / response",
    });
  const people = [
    ["visitor", "Catalog visitor", "Reads explicitly public published catalog/search/assets."],
    ["customer", "Customer", "Owns carts and currently authorized orders/payments/receipts."],
    [
      "administrator",
      "Shop administrator",
      "Manages catalog, payment reconciliation and safe audit; public registration cannot grant this role.",
    ],
    [
      "fulfillment-operator",
      "Fulfillment operator",
      "Ships only paid allocated quantities within current shop.",
    ],
    [
      "seller-actor",
      "Seller",
      "Sees only attributed lines/entitlements for the current seller principal.",
    ],
  ];
  model.nodes = [
    ...people.map(([id, name, description]) => ({
      id: `vc-${id}`,
      kind: "person" as const,
      name: name!,
      description: description!,
    })),
    ...["client", "files", "email", "payment", "warehouse"].map((id) => ({
      id: `vc-${id}-external`,
      kind: "external-system" as const,
      name: design.elements.find((e) => e.id === `vc-${id}`)!.name,
      container: `vc-${id}`,
      description: "Explicit external contract; no implementation availability implied.",
    })),
  ];
  model.relationships = [
    ...people.map(([id]) => ({
      id: `vc-${id}-system`,
      from: `vc-${id}`,
      to: "system",
      description:
        id === "visitor" ? "Browses published catalog" : "Uses current authorized shop operations",
      container: "vc-api",
    })),
    ...(["client", "files", "email", "payment", "warehouse"] as const).map((id) => ({
      id: `vc-system-${id}`,
      from: id === "client" || id === "warehouse" ? `vc-${id}-external` : "system",
      to: id === "client" || id === "warehouse" ? "system" : `vc-${id}-external`,
      description: "Uses exact adapter contract and current scoped authority",
      container: id === "email" ? "vc-worker" : "vc-api",
    })),
  ];
  for (const contract of vendureCoreContracts) {
    const key = contract.id.slice(3, -4);
    if (["reference-events", "stripe-events", "warehouse-events"].includes(key)) {
      model.interfaces!.push({
        id: `${contract.id}-provided`,
        name: contract.name,
        owner: {
          kind: "component",
          id:
            key === "reference-events"
              ? "vc-payments"
              : key === "stripe-events"
                ? "vc-provider"
                : "vc-sync",
        },
        direction: "provided",
        necessity: "required",
        contract: vcRef(contract.id),
      });
      continue;
    }
    const provider =
      key === "notifications"
        ? "vc-orders"
        : ["tax", "shipping"].includes(key)
          ? "vc-rates"
          : `vc-${key}`;
    model.interfaces!.push(
      {
        id: `${contract.id}-provided`,
        name: contract.name,
        owner: { kind: "component", id: provider },
        direction: "provided",
        necessity: "required",
        contract: vcRef(contract.id),
      },
      {
        id: `${contract.id}-required`,
        name: `External ${contract.name}`,
        owner: { kind: "element", id: "vc-client" },
        direction: "required",
        necessity: "required",
        contract: vcRef(contract.id),
      },
    );
    model.bindings!.push({
      id: `${contract.id}-binding`,
      name: `REST ${contract.name}`,
      relationship: { kind: "connection", id: "vc-client-api" },
      provided: `${contract.id}-provided`,
      required: `${contract.id}-required`,
      contract: vcRef(contract.id),
      role: "request",
      transport: "HTTPS/JSON",
      businessSynchrony: "Synchronous",
      policies: {
        access: {
          identity: ["sessions", "catalog", "search"].includes(key) ? "Public" : "User",
          tenant: key === "sessions" ? "Public" : "Tenant scoped",
          network: "Public",
        },
      },
    });
  }
  model.backend = vendureCoreData(model);
  vendureCoreAccess(design);
  vendureCoreAdapters(model);
  for (const [id, name, context, decision] of [
    [
      "partial-boundary",
      "P72a exact child boundary",
      "P72a owns boundaries/contracts/money/data/access only.",
      "P72b must bind state/transaction/payment/recovery, all eight H briefs, five scenarios, focused views/deployment and final V01–V20 trace. No operation/effect/lifecycle/hook implementation or readiness is claimed.",
    ],
    [
      "source-adaptation",
      "Pinned source and REST adaptation",
      "P60b pins Vendure v3.3.0 at a4c56359ec831b0c54dd01eab14fb75455c43ab7; source-map.json distinguishes inspected inspiration and JV/JH adaptations.",
      "Use the independent frozen P61c REST/JSON/OpenAPI contract. Upstream uses GraphQL; compatibility/parity remains excluded as X1. No source/runtime/license text is copied. Reference protocol evidence does not establish live Stripe availability.",
    ],
    [
      "money-snapshots",
      "Exact money and immutable snapshots",
      "Core USD 0..9007199254740991 minor units; quantity 1..1000; at most100 distinct variant lines.",
      "Validate checked exact integer products/sums/tax rounding before persistence. Fixed fixture tax is750bps half-up on merchandise only; shipping500 is nonrefundable. Preserve each variant price version, cart/quote/version/quantities/address/expiry. Quote/order snapshots never mutate with catalog/rate changes; H currency conversion preserves immutable rational provenance and stays separate.",
    ],
    [
      "atomicity",
      "One SQL authority and external uncertainty",
      "Cart/order/reservations/audit/receipt/event intent share SQL only when P72b binds their command.",
      "No provider call or byte store shares a database transaction. Payment/refund/payout identities are durable before network dispatch. Unknown remains explicit; no external charge rollback, time-based stock release on uncertainty or new charge key is implied.",
    ],
  ])
    model.decisions!.push({
      id: `vc-${id}`,
      name: name!,
      context: context!,
      decision: decision!,
      status: "Accepted",
      consequence:
        "Partial design intent only. All applications absent/not run; zero observed implementation points.",
      links: [{ kind: "system", id: "system" }],
      acknowledgements: [],
    });
  return { name: VENDURE_CORE_EXAMPLE.name, design, layout: { schemaVersion: 1, items: {} } };
}
