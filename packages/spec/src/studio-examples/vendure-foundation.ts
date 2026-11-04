/** Separate high-level studio reference; frozen benchmarks and paused backend work remain unchanged. */

import { createStudioStudy } from "./study.ts";
import initialLayout from "./vendure-foundation.layout.json" with { type: "json" };

export const VENDURE_FOUNDATION_STUDIO_EXAMPLE = {
  id: "studio-vendure-foundation",
  version: "1.0.0",
  name: "Vendure · studio foundation",
  description:
    "Vendure high-level API, worker, SQL authority, private files and external integration foundation. Frozen obligations remain future work; no runtime or observed points.",
  goalManifestSha256: "4de70d0e5d0e9aab00f5694c2ebf336b8b2480492d8a5bcd4bb084ff2123c39d",
} as const;

export function vendureFoundationStudioExample() {
  return createStudioStudy(
    VENDURE_FOUNDATION_STUDIO_EXAMPLE,
    [
      {
        id: "api",
        name: "Commerce API",
        description: "One modular application owns shop state and command authority.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "worker",
        name: "Commerce worker",
        description:
          "Independent process for SQL-backed expiry/delivery/projection/reconciliation channels.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "typescript",
        },
      },
      {
        id: "db",
        name: "Commerce PostgreSQL",
        description:
          "Single authoritative domain store. SQL transactions never include external providers or bytes.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "client",
        name: "External thin client",
        description: "Explicit REST consumer outside generated backend scope.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "external",
        },
      },
      {
        id: "files",
        name: "Catalog & receipt byte store",
        description:
          "External bytes; public catalog association and private order receipt require separate current policies.",
        settings: {
          kind: "object-store",
          provider: "unspecified",
          access: "private",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "email",
        name: "Notification provider",
        description: "External delivery with durable identity and visible uncertainty.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "external",
        },
      },
      {
        id: "payment",
        name: "Payment providers",
        description:
          "Reference-v1 protocol and separately pinned Stripe protocol; neither is an implemented live provider.",
        settings: {
          kind: "external-api",
          category: "payments",
          provider: "external",
        },
      },
      {
        id: "warehouse",
        name: "Warehouse source",
        description:
          "Original-byte authenticated warehouse-v1 with exact persisted shop/SKU mapping.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "external",
        },
      },
      {
        id: "work",
        name: "SQL background work",
        description:
          "Logical PostgreSQL-backed work intents shared by API and worker; provider unspecified. Source channels remain distinct future contracts. This is not an additional broker deployment.",
        settings: {
          kind: "queue",
          mode: "work-queue",
          provider: "unspecified",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
    ],
    [
      {
        id: "vc-client-api",
        from: "client",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Calls scoped exact REST operations",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vc-api-db",
        from: "api",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Owns authoritative state and atomic intent",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vc-worker-db",
        from: "worker",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Executes granted bounded modules and claims channels",
          protocol: "SQL",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vc-api-files",
        from: "api",
        to: "files",
        kind: "depends-on",
        planned: {
          label: "Proxies currently authorized catalog and receipt bytes",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vc-worker-email",
        from: "worker",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Delivers eligible notifications",
          protocol: "Unspecified",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vc-api-payment",
        from: "api",
        to: "payment",
        kind: "depends-on",
        planned: {
          label: "Dispatches/looks up durable payment identities",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vc-payment-api",
        from: "payment",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Supplies original-byte authenticated callbacks",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vc-warehouse-api",
        from: "warehouse",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Supplies verified source revision envelopes",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "publish-work",
        from: "api",
        to: "work",
        kind: "depends-on",
        planned: {
          label: "Commits background work intent",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "publish",
        },
      },
      {
        id: "consume-work",
        from: "work",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Delivers claimed background work",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "consume",
        },
      },
    ],
    {
      system: {
        name: "Vendure · studio foundation",
        description:
          "Vendure high-level API, worker, SQL authority, private files and external integration foundation. Frozen obligations remain future work; no runtime or observed points.",
      },
      nodes: [
        {
          id: "vc-visitor",
          kind: "person",
          name: "Catalog visitor",
          description: "Reads explicitly public published catalog/search/assets.",
        },
        {
          id: "vc-customer",
          kind: "person",
          name: "Customer",
          description: "Owns carts and currently authorized orders/payments/receipts.",
        },
        {
          id: "vc-administrator",
          kind: "person",
          name: "Shop administrator",
          description:
            "Manages catalog, payment reconciliation and safe audit; public registration cannot grant this role.",
        },
        {
          id: "vc-fulfillment-operator",
          kind: "person",
          name: "Fulfillment operator",
          description: "Ships only paid allocated quantities within current shop.",
        },
        {
          id: "vc-seller-actor",
          kind: "person",
          name: "Seller",
          description: "Sees only attributed lines/entitlements for the current seller principal.",
        },
        {
          id: "vc-client-external",
          kind: "external-system",
          name: "External thin client",
          container: "client",
          description: "Explicit external contract; no implementation availability implied.",
        },
        {
          id: "vc-email-external",
          kind: "external-system",
          name: "Notification provider",
          container: "email",
          description: "Explicit external contract; no implementation availability implied.",
        },
        {
          id: "vc-payment-external",
          kind: "external-system",
          name: "Payment providers",
          container: "payment",
          description: "Explicit external contract; no implementation availability implied.",
        },
        {
          id: "vc-warehouse-external",
          kind: "external-system",
          name: "Warehouse source",
          container: "warehouse",
          description: "Explicit external contract; no implementation availability implied.",
        },
      ],
      relationships: [
        {
          id: "vc-visitor-system",
          from: "vc-visitor",
          to: "system",
          description: "Browses published catalog",
          container: "api",
        },
        {
          id: "vc-customer-system",
          from: "vc-customer",
          to: "system",
          description: "Uses current authorized shop operations",
          container: "api",
        },
        {
          id: "vc-administrator-system",
          from: "vc-administrator",
          to: "system",
          description: "Uses current authorized shop operations",
          container: "api",
        },
        {
          id: "vc-fulfillment-operator-system",
          from: "vc-fulfillment-operator",
          to: "system",
          description: "Uses current authorized shop operations",
          container: "api",
        },
        {
          id: "vc-seller-actor-system",
          from: "vc-seller-actor",
          to: "system",
          description: "Uses current authorized shop operations",
          container: "api",
        },
        {
          id: "vc-system-client",
          from: "vc-client-external",
          to: "system",
          description: "Uses exact adapter contract and current scoped authority",
          container: "api",
        },
        {
          id: "vc-system-email",
          from: "system",
          to: "vc-email-external",
          description: "Uses exact adapter contract and current scoped authority",
          container: "worker",
        },
        {
          id: "vc-system-payment",
          from: "system",
          to: "vc-payment-external",
          description: "Uses exact adapter contract and current scoped authority",
          container: "api",
        },
        {
          id: "vc-system-warehouse",
          from: "vc-warehouse-external",
          to: "system",
          description: "Uses exact adapter contract and current scoped authority",
          container: "api",
        },
      ],
    },
    initialLayout,
  );
}
