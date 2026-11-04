/** Separate high-level studio reference; frozen benchmarks and paused backend work remain unchanged. */

import { createStudioStudy } from "./study.ts";
import initialLayout from "./zammad-foundation.layout.json" with { type: "json" };

export const ZAMMAD_FOUNDATION_STUDIO_EXAMPLE = {
  id: "studio-zammad-foundation",
  version: "1.0.0",
  name: "Zammad · studio reference",
  description:
    "Small high-level support foundation/reference only. Detailed Zammad P73a/P73b design remains incomplete and paused; no complete benchmark example or runtime is registered.",
  goalManifestSha256: "522ad7eb92a97e4a7947dede1af28a0f2114e4bd5c58cf6f516a81f822b18d1a",
} as const;

export function zammadFoundationStudioExample() {
  return createStudioStudy(
    ZAMMAD_FOUNDATION_STUDIO_EXAMPLE,
    [
      {
        id: "api",
        name: "Support API",
        description:
          "Modular support API foundation. Ticket, article visibility, access, routing and SLA behavior remain future fixed/custom work.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "worker",
        name: "Support worker",
        description:
          "Independent background process for due escalation, notification and projection work; no implemented deadline engine.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "typescript",
        },
      },
      {
        id: "db",
        name: "Support PostgreSQL",
        description:
          "Authoritative tickets, articles, current access, deadline snapshots and durable intent. No schema or calculator is implemented.",
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
        id: "files",
        name: "Private article files",
        description:
          "Private ticket/article attachment bytes; every observation must enforce current ticket and article visibility.",
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
        name: "Email channel provider",
        description:
          "External inbound/outbound email boundary; authentication, MIME, threading and duplicate recovery remain C4b.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "external",
        },
      },
      {
        id: "client",
        name: "External support client",
        description:
          "External customer/agent/admin contract consumer. No generated browser or page layout is supplied.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "external",
        },
      },
      {
        id: "customer-source",
        name: "External customer system",
        description:
          "Future authenticated customer-system connector with explicit field/source authority and reconciliation.",
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
        id: "client-api",
        from: "client",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Uses scoped support operations",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-db",
        from: "api",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads and writes support authority",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-db",
        from: "worker",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Claims due work and eligible effects",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-files",
        from: "api",
        to: "files",
        kind: "depends-on",
        planned: {
          label: "Proxies authorized private article bytes",
          protocol: "HTTPS",
          interaction: "Request / response",
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
          label: "Sends eligible redacted notifications",
          protocol: "Unspecified",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "email-api",
        from: "email",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Supplies authenticated inbound messages",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "customer-api",
        from: "customer-source",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Supplies verified customer revisions",
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
        name: "Zammad · studio reference",
        description:
          "Small high-level support foundation/reference only. Detailed Zammad P73a/P73b design remains incomplete and paused; no complete benchmark example or runtime is registered.",
      },
      nodes: [
        {
          id: "customer",
          kind: "person",
          name: "Customer",
          description: "Uses own authorized tickets; internal notes remain excluded.",
        },
        {
          id: "agent",
          kind: "person",
          name: "Support agent",
          description: "Works within current scoped group capabilities.",
        },
        {
          id: "admin",
          kind: "person",
          name: "Administrator",
          description: "Manages authorized support membership and policies.",
        },
        {
          id: "client-external",
          kind: "external-system",
          name: "External support client",
          description: "External contract consumer, not a generated UI.",
          container: "client",
        },
        {
          id: "email-external",
          kind: "external-system",
          name: "Email channel provider",
          description: "Inbound and outbound channel integration remains unimplemented.",
          container: "email",
        },
        {
          id: "customer-source-external",
          kind: "external-system",
          name: "Customer system",
          description: "Future connector and source authority.",
          container: "customer-source",
        },
      ],
      relationships: [
        {
          id: "customer-system",
          from: "customer",
          to: "system",
          description: "Uses currently authorized support operations",
          container: "api",
        },
        {
          id: "agent-system",
          from: "agent",
          to: "system",
          description: "Uses currently authorized support operations",
          container: "api",
        },
        {
          id: "admin-system",
          from: "admin",
          to: "system",
          description: "Uses currently authorized support operations",
          container: "api",
        },
        {
          id: "system-email",
          from: "system",
          to: "email-external",
          description: "Delivers authorized notifications",
          container: "worker",
        },
        {
          id: "email-system",
          from: "email-external",
          to: "system",
          description: "Supplies authenticated inbound messages",
          container: "api",
        },
        {
          id: "client-system",
          from: "client-external",
          to: "system",
          description: "Uses support contracts",
          container: "api",
        },
        {
          id: "customer-source-system",
          from: "customer-source-external",
          to: "system",
          description: "Supplies verified customer source revisions",
          container: "api",
        },
      ],
    },
    initialLayout,
  );
}
