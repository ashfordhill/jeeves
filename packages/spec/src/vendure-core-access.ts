/** Exact current access and bounded reads. No persisted policy/query execution. */

import type { BackendQuery } from "./backend-model.ts";
import type { BackendAccessPolicy } from "./backend-policy-model.ts";
import type { DesignDocument } from "./design.ts";
import { vcEntity, vcRef } from "./vendure-core-data.ts";

const sites = [
  "read",
  "write",
  "search",
  "bytes",
  "materialization",
  "delivery",
  "export",
  "job",
  "idempotent-replay",
] as const;
const all = (...clauses: string[]) => ({ operator: "all" as const, clauses });
export function vendureCoreAccess(design: DesignDocument) {
  const model = design.architecture!,
    b = model.backend!;
  const entity = (id: string) => b.entities.find((e) => e.id === `vc-${id}-entity`)!;
  const selection = (id: string, suffix = "") => ({
    kind: "policy" as const,
    reference: vcRef(`vc-${id}${suffix}-policy`),
  });
  const role = (id: string, values: string[]): BackendAccessPolicy["clauses"][number] => ({
    id,
    kind: "role",
    authority: "persisted-role-store",
    entity: vcEntity("membership"),
    principal: "principal-id",
    field: "role",
    values,
  });
  const privateFields: Record<string, string[]> = {
    variant: ["cost", "stock-location-id"],
    asset: ["object-key"],
    payment: ["request-key"],
    "provider-event": ["original-sha256"],
  };
  const writable: Record<string, string[]> = {
    product: ["name", "published"],
    variant: ["sku", "published", "price"],
    cart: ["state"],
    "cart-line": ["variant-id", "quantity"],
    order: ["state"],
    reservation: ["state"],
    payment: ["state"],
    shipment: ["order-id"],
    seller: ["fee-bps"],
    "seller-line": [],
    settlement: ["state"],
    refund: [],
  };
  const parents: Record<string, string> = {
    "cart-line": "cart",
    quote: "cart",
    "quote-line": "quote",
    "order-line": "order",
    reservation: "order",
    payment: "order",
    shipment: "order",
    "shipment-line": "order",
    history: "order",
    audit: "order",
    refund: "order",
    "seller-line": "seller",
    settlement: "seller",
  };
  const publicRoots = new Set(["product", "variant", "asset", "search-projection"]);
  for (const e of b.entities) {
    const id = e.id.slice(3, -7),
      pub = publicRoots.has(id);
    const clauses: BackendAccessPolicy["clauses"] = pub
      ? []
      : [
          { id: "authenticated", kind: "authenticated" },
          {
            id: "member",
            kind: "membership",
            scope: "organization",
            entity: vcEntity("membership"),
            principal: "principal-id",
            relation: "shop",
            ...(id === "shop" ? {} : { via: "shop" }),
            active: { field: "active", value: true },
          },
          role("admin", ["administrator"]),
          role("staff", ["administrator", "fulfillment"]),
        ];
    let reads: string[][] = [["member", "admin"]],
      writes: string[][] = [["member", "admin"]];
    if (pub) {
      if (id === "product")
        clauses.push({
          id: "product-published",
          kind: "visibility",
          field: "published",
          value: true,
        });
      else
        clauses.push({
          id: "product-published",
          kind: "visibility",
          via: "product",
          field: "published",
          value: true,
        });
      reads = [["product-published"]];
      writes = [];
      if (id === "variant") {
        clauses.push({
          id: "variant-published",
          kind: "visibility",
          field: "published",
          value: true,
        });
        reads = [["product-published", "variant-published"]];
      }
      if (id === "asset") {
        clauses.push(
          { id: "product-asset", kind: "visibility", field: "variant-id", value: null },
          {
            id: "variant-published",
            kind: "visibility",
            via: "variant",
            field: "published",
            value: true,
          },
        );
        reads = [
          ["product-published", "product-asset"],
          ["product-published", "variant-published"],
        ];
      }
      if (id === "search-projection") {
        clauses.push({
          id: "variant-published",
          kind: "visibility",
          via: "variant",
          field: "published",
          value: true,
        });
        reads = [["product-published", "variant-published"]];
      }
    } else {
      const parent = parents[id],
        ownField = e.fields.some((f) => f.field === "owner-id")
          ? "owner-id"
          : id === "seller"
            ? "principal-id"
            : id === "notification"
              ? "recipient-id"
              : undefined;
      if (ownField) clauses.push({ id: "owner", kind: "owner", field: ownField });
      else if (parent && ["cart", "quote", "order", "seller"].includes(parent))
        clauses.push({
          id: "owner",
          kind: "owner",
          via: parent,
          field: parent === "seller" ? "principal-id" : "owner-id",
        });
      if (clauses.some((c) => c.id === "owner")) {
        reads = [
          ["member", "owner"],
          ["member", "staff"],
        ];
        writes = [
          ["member", "owner"],
          ["member", "admin"],
        ];
      }
      if (["cart", "cart-line", "quote"].includes(id)) reads = writes = [["member", "owner"]];
      if (
        [
          "quote-line",
          "order-line",
          "history",
          "payment",
          "shipment",
          "shipment-line",
          "refund",
        ].includes(id)
      )
        writes = [["member", "admin"]];
      if (id === "shipment" || id === "shipment-line") writes = [["member", "staff"]];
      if (["seller", "seller-line", "settlement"].includes(id)) {
        clauses.push({
          id: "seller-active",
          kind: "visibility",
          ...(id === "seller" ? {} : { via: "seller" }),
          field: "active",
          value: true,
        });
        reads = writes = [
          ["member", "owner", "seller-active"],
          ["member", "admin"],
        ];
      }
      if (id === "notification") {
        clauses.push({
          id: "recipient-active",
          kind: "visibility",
          via: "recipient-membership",
          field: "active",
          value: true,
        });
        reads = [["member", "owner", "recipient-active"]];
        writes = [];
      }
      if (
        [
          "quote",
          "quote-line",
          "order-line",
          "history",
          "audit",
          "provider-event",
          "source-receipt",
          "rate",
          "seller-line",
        ].includes(id)
      )
        writes = [];
    }
    const p: BackendAccessPolicy = {
      id: `vc-${id}-policy`,
      version: "v1",
      name: `${e.name} ${pub ? "current public publication" : "current access"}`,
      resource: vcRef(e.id),
      context: {
        identity: pub ? "public" : "session-principal",
        authentication: "server-established",
        scope: "authorized-scope",
        correlation: "server-established",
      },
      default: "deny",
      conflict: "deny-wins",
      clauses,
      rules: [
        ...reads.map((c, i) => ({
          id: `read-${i + 1}`,
          effect: "allow" as const,
          actions: ["read", "list", "search", "bytes", "export", "idempotent-replay"],
          when: all(...c),
        })),
        ...writes.map((c, i) => ({
          id: `write-${i + 1}`,
          effect: "allow" as const,
          actions: ["write"],
          when: all(...c),
        })),
      ],
      projections: [
        {
          id: "read",
          mode: "read",
          fields: e.fields
            .map((f) => f.field)
            .filter((f) => !(privateFields[id] ?? []).includes(f)),
          when: { operator: "any", clauses: clauses.map((c) => c.id) },
          unknownFields: "reject",
        },
        ...(writes.length && writable[id]?.length
          ? [
              {
                id: "write",
                mode: "write" as const,
                fields: writable[id]!,
                when: { operator: "any" as const, clauses: clauses.map((c) => c.id) },
                unknownFields: "reject" as const,
              },
            ]
          : []),
      ],
      revocation: { strategy: "current-state", cache: "none", recheck: [...sites] },
    };
    b.accessPolicies!.push(p);
  }
  const notification = entity("notification");
  b.accessPolicies!.push({
    id: "vc-notification-service-policy",
    version: "v1",
    name: "Current persisted delivery recipient",
    resource: vcRef(notification.id),
    context: {
      identity: "verified-service",
      authentication: "server-established",
      scope: "authorized-scope",
      correlation: "server-established",
      service: {
        purpose: "commerce-notification",
        authority: "server-service-identity",
        scope: "selected-resource",
        initiatingActor: "provenance-only",
      },
    },
    default: "deny",
    conflict: "deny-wins",
    clauses: [
      { id: "service", kind: "service-purpose", purpose: "commerce-notification" },
      {
        id: "recipient-active",
        kind: "visibility",
        via: "recipient-membership",
        field: "active",
        value: true,
      },
    ],
    rules: [
      {
        id: "eligible-recipient",
        effect: "allow",
        actions: ["read", "materialization", "delivery", "job"],
        when: all("service", "recipient-active"),
      },
    ],
    projections: [
      {
        id: "read",
        mode: "read",
        fields: notification.fields.map((f) => f.field),
        when: all("service", "recipient-active"),
        unknownFields: "reject",
      },
    ],
    revocation: { strategy: "current-state", cache: "none", recheck: [...sites] },
  });
  // Admin mutation access is a distinct private context; public catalog read does not authorize writes.
  for (const id of ["product", "variant"]) {
    const e = entity(id);
    b.accessPolicies!.push({
      id: `vc-${id}-admin-policy`,
      version: "v1",
      name: `${e.name} current administrator`,
      resource: vcRef(e.id),
      context: {
        identity: "session-principal",
        authentication: "server-established",
        scope: "authorized-scope",
        correlation: "server-established",
      },
      default: "deny",
      conflict: "deny-wins",
      clauses: [
        {
          id: "member",
          kind: "membership",
          scope: "organization",
          entity: vcEntity("membership"),
          principal: "principal-id",
          relation: "shop",
          via: "shop",
          active: { field: "active", value: true },
        },
        role("admin", ["administrator"]),
      ],
      rules: [
        {
          id: "admin",
          effect: "allow",
          actions: ["read", "write", "idempotent-replay"],
          when: all("member", "admin"),
        },
      ],
      projections: [
        {
          id: "read",
          mode: "read",
          fields: e.fields.map((f) => f.field),
          when: all("member", "admin"),
          unknownFields: "reject",
        },
        {
          id: "write",
          mode: "write",
          fields: writable[id]!,
          when: all("member", "admin"),
          unknownFields: "reject",
        },
      ],
      revocation: { strategy: "current-state", cache: "none", recheck: [...sites] },
    });
  }
  const paymentAdmin = structuredClone(
    b.accessPolicies!.find((p) => p.id === "vc-payment-policy")!,
  );
  paymentAdmin.id = "vc-payment-admin-policy";
  paymentAdmin.name = "Payment administrator reconciliation";
  paymentAdmin.rules = [
    {
      id: "admin",
      effect: "allow",
      actions: ["read", "write", "idempotent-replay"],
      when: all("member", "admin"),
    },
  ];
  b.accessPolicies!.push(paymentAdmin);
  const query = (
    id: string,
    root: string,
    fields: string[],
    filters: string[] = [],
    site: "read" | "search" = "read",
  ) => {
    const q: BackendQuery = {
      id: `vc-${id}-query`,
      version: "v1",
      name: id.replaceAll("-", " "),
      root: vcEntity(root),
      joins: [],
      filters: filters.map((field) => ({
        id: field,
        field: { source: "root", field },
        comparisons: ["eq"],
      })),
      projection: fields.map((field) => ({ id: field, field: { source: "root", field } })),
      order: ["created-at", "id"].map((field) => ({
        field: { source: "root", field },
        direction: "asc",
      })),
      limit: { default: 25, maximum: 100 },
      cursor: {
        kind: "keyset",
        fields: ["created-at", "id"].map((field) => ({ source: "root", field })),
      },
      accessPolicy: selection(root),
      accessProjection: "read",
      accessSite: site,
      sourcePolicies: [],
      freshness: { kind: "authoritative" },
    };
    b.queries!.push(q);
    return q;
  };
  const catalog = query(
    "catalog",
    "variant",
    ["id", "product-id", "sku", "price", "price-version"],
    ["product-id"],
  );
  catalog.joins = [{ id: "product", from: "root", relation: "product", kind: "inner" }];
  catalog.sourcePolicies = [
    { source: "product", policy: selection("product"), projection: "read" },
  ];
  catalog.order = [
    { field: { source: "product", field: "created-at" }, direction: "asc" },
    { field: { source: "product", field: "id" }, direction: "asc" },
    { field: { source: "root", field: "id" }, direction: "asc" },
  ];
  catalog.cursor.fields = catalog.order.map((o) => o.field);
  catalog.projection.push({ id: "name", field: { source: "product", field: "name" } });
  query(
    "public-assets",
    "asset",
    ["id", "product-id", "variant-id", "mime", "size", "sha256"],
    ["product-id"],
  );
  const search = query(
    "search",
    "search-projection",
    ["id", "variant-id", "product-id", "text", "projection-version"],
    ["text"],
    "search",
  );
  search.joins = [
    { id: "product", from: "root", relation: "product", kind: "inner" },
    { id: "variant", from: "root", relation: "variant", kind: "inner" },
  ];
  search.sourcePolicies = [
    { source: "product", policy: selection("product"), projection: "read" },
    { source: "variant", policy: selection("variant"), projection: "read" },
  ];
  search.order = [
    { field: { source: "product", field: "created-at" }, direction: "asc" },
    { field: { source: "product", field: "id" }, direction: "asc" },
    { field: { source: "root", field: "variant-id" }, direction: "asc" },
  ];
  search.cursor.fields = search.order.map((o) => o.field);
  search.projection.push(
    { id: "name", field: { source: "product", field: "name" } },
    { id: "price", field: { source: "variant", field: "price" } },
  );
  search.filters[0]!.comparisons = ["prefix"];
  query(
    "orders",
    "order",
    entity("order").fields.map((f) => f.field),
    ["state"],
  );
  for (const id of ["history", "audit", "notification", "shipment"]) {
    const q = query(
      id === "notification" ? "inbox" : id,
      id,
      id === "notification"
        ? ["id", "order-id", "recipient-id", "event-id", "action", "at"]
        : id === "shipment"
          ? ["id", "order-id", "state", "order-version", "version", "at"]
          : ["id", "order-id", "actor-id", "action", "at"],
      ["order-id"],
    );
    q.order = ["at", "id"].map((field) => ({ field: { source: "root", field }, direction: "asc" }));
    q.cursor.fields = q.order.map((o) => o.field);
  }
  query(
    "seller-attributions",
    "seller-line",
    ["id", "seller-id", "order-id", "line-id", "merchandise", "fee-policy"],
    ["seller-id"],
  );
  query("settlements", "settlement", ["id", "seller-id", "amount", "fee", "state"], ["seller-id"]);
  const uses: Record<string, [string, string?]> = {
    "put-product": ["product", "-admin"],
    "put-variant": ["variant", "-admin"],
    publish: ["product", "-admin"],
    "set-price": ["variant", "-admin"],
    "list-catalog": ["variant"],
    "get-product": ["product"],
    "get-asset": ["asset"],
    search: ["search-projection"],
    "create-cart": ["cart"],
    "get-cart": ["cart"],
    "add-line": ["cart"],
    "change-line": ["cart"],
    "remove-line": ["cart"],
    quote: ["cart"],
    checkout: ["cart"],
    "release-reservation": ["reservation"],
    "transition-order": ["order"],
    "start-payment": ["order"],
    "get-payment": ["payment"],
    "reconcile-payment": ["payment", "-admin"],
    "get-order": ["order"],
    "list-orders": ["order"],
    "order-history": ["history"],
    "download-order": ["order"],
    "create-shipment": ["shipment"],
    "list-shipments": ["shipment"],
    audit: ["audit"],
    inbox: ["notification"],
    promotions: ["cart"],
    "tax-quote": ["cart"],
    "shipping-rates": ["cart"],
    "return-refund": ["order"],
    "seller-settlement": ["settlement"],
    "convert-currency": ["cart"],
    "stripe-payment": ["order"],
  };
  for (const [id, root, purpose] of [
    ["reference-callback", "payment", "reference-callback"],
    ["stripe-callback", "payment", "stripe-callback"],
    ["sync-inventory", "inventory-mapping", "warehouse-sync"],
  ]) {
    const e = entity(root!);
    b.accessPolicies!.push({
      id: `vc-${id}-policy`,
      version: "v1",
      name: `Verified ${purpose}`,
      resource: vcRef(e.id),
      context: {
        identity: "verified-service",
        authentication: "server-established",
        scope: "authorized-scope",
        correlation: "server-established",
        service: {
          purpose: purpose!,
          authority: "server-service-identity",
          scope: "selected-resource",
          initiatingActor: "provenance-only",
        },
      },
      default: "deny",
      conflict: "deny-wins",
      clauses: [{ id: "provider", kind: "service-purpose", purpose: purpose! }],
      rules: [
        {
          id: "verified-mapping",
          effect: "allow",
          actions: ["write", "job"],
          when: all("provider"),
        },
      ],
      projections: [
        {
          id: "write",
          mode: "write",
          fields: [root === "payment" ? "state" : "last-revision"],
          when: all("provider"),
          unknownFields: "reject",
        },
      ],
      revocation: { strategy: "current-state", cache: "none", recheck: [...sites] },
    });
    uses[id!] = [root!];
  }
  for (const contract of model.contracts!.filter((c) => c.kind === "api"))
    for (const op of contract.shape!.operations) {
      const use = uses[op.id];
      if (!use) continue;
      const [root, suffix] = use;
      const provided = model.interfaces!.find(
        (i) => i.direction === "provided" && i.contract.id === contract.id,
      )!;
      if (provided.owner.kind === "external-system") continue;
      const write = !["GET", "HEAD"].includes(op.transport!.method);
      b.accessBindings!.push({
        id: `vc-${op.id}-access-use`,
        version: "v1",
        name: `${op.name} current access`,
        target: {
          kind: "operation",
          contract: vcRef(contract.id),
          operation: op.id,
          owner: provided.owner,
        },
        resource: vcEntity(root),
        policy: ["reference-callback", "stripe-callback", "sync-inventory"].includes(op.id)
          ? { kind: "policy", reference: vcRef(`vc-${op.id}-policy`) }
          : selection(root, suffix),
        action: op.id === "search" ? "search" : write ? "write" : "read",
        site: ["get-asset", "download-order"].includes(op.id)
          ? "bytes"
          : op.id === "search"
            ? "search"
            : write
              ? "write"
              : "read",
        projection: write ? "write" : "read",
        relationshipBinding: ["reference-callback", "stripe-callback", "sync-inventory"].includes(
          op.id,
        )
          ? `vc-${op.id}-source-binding`
          : `${contract.id}-binding`,
      });
    }
}
