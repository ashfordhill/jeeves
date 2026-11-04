/** Source-pinned field study; application/runtime implementation remains separate. */
import initialLayout from "./dropshipping.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const DROPSHIPPING_STUDIO_EXAMPLE = {
  id: "studio-dropshipping",
  version: "1.0.0",
  name: "Dropshipping \u00b7 studio reference",
  description:
    "Demo-only single Worker, bundled storefront/admin, D1, R2 and hosted checkout. Durable orders and integrations remain C4b; scaffold is not the completed product. Guest checkout has no customer accounts.",
  goalManifestSha256: "64af0673cfd7451b55a1775cee946a6584c38fb61f3f538279a57e78605e41e4",
} as const;

export function dropshippingStudioExample() {
  return createStudioStudy(
    DROPSHIPPING_STUDIO_EXAMPLE,
    [
      {
        id: "storefront",
        name: "Storefront browser",
        description:
          "Guest browse, cart and status-page assets bundled into the same Worker deployment.",
        settings: {
          kind: "browser",
          delivery: "bundled",
          servedBy: "worker",
        },
      },
      {
        id: "admin",
        name: "Admin browser",
        description:
          "Separate back-office bundle served by the same Worker; operator Access verification remains C4b.",
        settings: {
          kind: "browser",
          delivery: "bundled",
          servedBy: "worker",
        },
      },
      {
        id: "worker",
        name: "Storefront Worker",
        description:
          "One Cloudflare Worker serves every demo brand and both browser bundles; API, cron and workflow class stay in this deployment.",
        settings: {
          kind: "service",
          execution: "managed",
          host: "cloudflare-workers",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "db",
        name: "D1 catalog and orders",
        description:
          "Documented D1 authority. Scaffold has no application tables; schema and business behavior remain future work.",
        settings: {
          kind: "database",
          engine: "sqlite",
          provider: "cloudflare-d1",
        },
        owner: {
          kind: "element",
          id: "worker",
        },
      },
      {
        id: "media",
        name: "R2 media",
        description:
          "Documented R2 product/brand bytes. Private foundation does not promise public delivery/signing integration.",
        settings: {
          kind: "object-store",
          provider: "cloudflare-r2",
          access: "private",
        },
        owner: {
          kind: "element",
          id: "worker",
        },
      },
      {
        id: "payments",
        name: "Stripe hosted checkout",
        description:
          "External hosted checkout and signed payment events. Card data never touches application code.",
        settings: {
          kind: "external-api",
          category: "payments",
          provider: "external",
        },
      },
      {
        id: "workflow",
        name: "Cloudflare Workflows",
        description:
          "Managed durable orchestration capability bound to the same Worker class, not an independent application or message queue. OrderWorkflow is a scaffold stub.",
        settings: {
          kind: "external-api",
          category: "workflow",
          provider: "cloudflare",
        },
      },
      {
        id: "email",
        name: "Cloudflare Email Sending",
        description:
          "Documented email binding behind EmailSender; Resend fallback remains source integration work.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "cloudflare",
        },
      },
      {
        id: "access",
        name: "Cloudflare Access",
        description:
          "Operator admin access boundary only. Guest shoppers have no customer accounts.",
        settings: {
          kind: "external-api",
          category: "identity",
          provider: "cloudflare",
        },
      },
      {
        id: "vendors",
        name: "Vendor adapter boundary",
        description:
          "Future mock/assisted/API adapters. No vendor API credentials, permissions, availability or unattended purchases are assumed.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "unspecified",
        },
      },
    ],
    [
      {
        id: "storefront-worker",
        from: "storefront",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Browses, checks out and looks up orders",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Public",
        },
        settings: {},
      },
      {
        id: "admin-worker",
        from: "admin",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Uses operator administration",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "worker-db",
        from: "worker",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads and writes brand and order data",
          protocol: "Native binding",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-media",
        from: "worker",
        to: "media",
        kind: "depends-on",
        planned: {
          label: "Stores brand and product bytes",
          protocol: "Native binding",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "storefront-payments",
        from: "storefront",
        to: "payments",
        kind: "depends-on",
        planned: {
          label: "Continues to hosted checkout",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Public",
        },
        settings: {},
      },
      {
        id: "worker-payments",
        from: "worker",
        to: "payments",
        kind: "depends-on",
        planned: {
          label: "Creates checkout and refund requests",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "payments-worker",
        from: "payments",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Delivers signed payment events",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-workflow",
        from: "worker",
        to: "workflow",
        kind: "depends-on",
        planned: {
          label: "Starts durable order orchestration",
          protocol: "Native binding",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "workflow-worker",
        from: "workflow",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Resumes Worker order steps",
          protocol: "Native binding",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-email",
        from: "worker",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Sends brand email via binding",
          protocol: "Native binding",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-access",
        from: "worker",
        to: "access",
        kind: "depends-on",
        planned: {
          label: "Verifies operator access",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-vendors",
        from: "worker",
        to: "vendors",
        kind: "depends-on",
        planned: {
          label: "Routes through future vendor adapters",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "vendors-worker",
        from: "vendors",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Supplies recorded fulfillment status",
          protocol: "Unspecified",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "Dropshipping \u00b7 studio reference",
        description:
          "Demo-only single Worker, bundled storefront/admin, D1, R2 and hosted checkout. Durable orders and integrations remain C4b; scaffold is not the completed product. Guest checkout has no customer accounts.",
      },
      nodes: [
        {
          id: "shopper",
          kind: "person",
          name: "Guest shopper",
          description: "Browses and looks up an order by number/email; no customer account.",
        },
        {
          id: "operator",
          kind: "person",
          name: "Store operator",
          description: "Handles authorized administration and assisted fulfillment.",
        },
        {
          id: "payments-external",
          kind: "external-system",
          name: "Stripe hosted checkout",
          container: "payments",
          description: "Hosted payment provider; no custom card flow.",
        },
        {
          id: "workflow-external",
          kind: "external-system",
          name: "Cloudflare Workflows",
          container: "workflow",
          description: "Managed orchestration bound to the same Worker; no queue equivalence.",
        },
        {
          id: "email-external",
          kind: "external-system",
          name: "Email delivery",
          container: "email",
          description: "Cloudflare EmailSender integration with documented fallback.",
        },
        {
          id: "access-external",
          kind: "external-system",
          name: "Cloudflare Access",
          container: "access",
          description: "Operator identity boundary.",
        },
        {
          id: "vendors-external",
          kind: "external-system",
          name: "Vendor adapters",
          container: "vendors",
          description: "Future assisted/mock/API integrations; API access unverified.",
        },
      ],
      relationships: [
        {
          id: "shopper-system",
          from: "shopper",
          to: "system",
          description: "Browses and manages guest orders",
          container: "storefront",
        },
        {
          id: "operator-system",
          from: "operator",
          to: "system",
          description: "Handles administration and tasks",
          container: "admin",
        },
        {
          id: "system-payments",
          from: "system",
          to: "payments-external",
          description: "Creates hosted checkout sessions",
          container: "worker",
        },
        {
          id: "payments-system",
          from: "payments-external",
          to: "system",
          description: "Delivers signed payment events",
          container: "worker",
        },
        {
          id: "system-workflow",
          from: "system",
          to: "workflow-external",
          description: "Starts durable order work",
          container: "worker",
        },
        {
          id: "system-email",
          from: "system",
          to: "email-external",
          description: "Sends order notifications",
          container: "worker",
        },
        {
          id: "system-access",
          from: "system",
          to: "access-external",
          description: "Verifies operator access",
          container: "worker",
        },
        {
          id: "system-vendors",
          from: "system",
          to: "vendors-external",
          description: "Uses future fulfillment adapters",
          container: "worker",
        },
      ],
    },
    initialLayout,
  );
}
