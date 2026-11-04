/** Separate high-level studio reference; frozen benchmarks and paused backend work remain unchanged. */
import initialLayout from "./discourse-foundation.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const DISCOURSE_FOUNDATION_STUDIO_EXAMPLE = {
  id: "studio-discourse-foundation",
  version: "1.0.0",
  name: "Discourse · studio foundation",
  description:
    "Discourse high-level API, worker, SQL authority, private files and external integration foundation. Frozen obligations remain future work; no runtime or observed points.",
  goalManifestSha256: "5a7908b80a73091ef1525265887a14af4297cbfd1331581c0d926b750ba80b88",
} as const;

export function discourseFoundationStudioExample() {
  return createStudioStudy(
    DISCOURSE_FOUNDATION_STUDIO_EXAMPLE,
    [
      {
        id: "api",
        name: "Discussion API",
        description:
          "One modular application owns current access and discussion mutations. Endpoint details live in contracts.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "worker",
        name: "Discussion worker",
        description:
          "Independent process for named database-backed notification/projection/cleanup/digest/mail channels.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "typescript",
        },
      },
      {
        id: "db",
        name: "Discussion PostgreSQL",
        description:
          "Authoritative scoped domain state and logical delivery channels. No Redis, search cluster or broker deployment is implied.",
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
        name: "Private object store",
        description:
          "Explicit private byte adapter; proxy reads after current policy checks; no durable public URL authority.",
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
        name: "Email delivery provider",
        description:
          "External delivery with stable identities, finite retries and uncertain-outcome reconciliation.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "external",
        },
      },
      {
        id: "client",
        name: "External thin client",
        description:
          "Contract consumer outside generated scope. No page layout or planned generated frontend.",
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
        id: "dc-client-api",
        from: "client",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Calls scoped REST operations",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "dc-api-db",
        from: "api",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads/writes domain and atomic event intent",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "dc-worker-db",
        from: "worker",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Claims named channels and reads/writes eligible effects",
          protocol: "SQL",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "dc-api-files",
        from: "api",
        to: "files",
        kind: "depends-on",
        planned: {
          label: "Stages and proxies authorized private bytes",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "dc-worker-files",
        from: "worker",
        to: "files",
        kind: "depends-on",
        planned: {
          label: "Rechecks and removes eligible orphan bytes",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "dc-worker-email",
        from: "worker",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Delivers eligible mail or records uncertainty",
          protocol: "Unspecified",
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
        name: "Discourse · studio foundation",
        description:
          "Discourse high-level API, worker, SQL authority, private files and external integration foundation. Frozen obligations remain future work; no runtime or observed points.",
      },
      nodes: [
        {
          id: "dc-visitor",
          kind: "person",
          name: "Visitor",
          description:
            "Uses public account/session endpoints only; scoped content requires current workspace membership.",
        },
        {
          id: "dc-member",
          kind: "person",
          name: "Member",
          description: "Reads authorized categories and publishes content.",
        },
        {
          id: "dc-moderator",
          kind: "person",
          name: "Moderator",
          description: "Reviews flags and performs authorized audited transitions.",
        },
        {
          id: "dc-administrator",
          kind: "person",
          name: "Administrator",
          description: "Manages memberships and grants; no public self-promotion.",
        },
        {
          id: "dc-client-external",
          kind: "external-system",
          name: "External thin client",
          container: "client",
          description: "Explicit external boundary; design contract only.",
        },
        {
          id: "dc-email-external",
          kind: "external-system",
          name: "Email delivery provider",
          container: "email",
          description: "Explicit external boundary; design contract only.",
        },
      ],
      relationships: [
        {
          id: "dc-visitor-system",
          from: "dc-visitor",
          to: "system",
          description: "Creates account or manages session",
          container: "api",
        },
        {
          id: "dc-member-system",
          from: "dc-member",
          to: "system",
          description: "Uses currently authorized discussion operations",
          container: "api",
        },
        {
          id: "dc-moderator-system",
          from: "dc-moderator",
          to: "system",
          description: "Uses currently authorized discussion operations",
          container: "api",
        },
        {
          id: "dc-administrator-system",
          from: "dc-administrator",
          to: "system",
          description: "Uses currently authorized discussion operations",
          container: "api",
        },
        {
          id: "dc-system-email",
          from: "system",
          to: "dc-email-external",
          description: "Sends eligible notifications with reconciliation",
          container: "worker",
        },
        {
          id: "dc-client-system",
          from: "dc-client-external",
          to: "system",
          description: "Consumes exact REST/JSON contracts",
          container: "api",
        },
      ],
    },
    initialLayout,
  );
}
