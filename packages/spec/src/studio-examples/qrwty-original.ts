/** Source-pinned field study; application/runtime implementation remains separate. */
import initialLayout from "./qrwty-original.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const QRWTY_ORIGINAL_STUDIO_EXAMPLE = {
  id: "studio-qrwty-original",
  version: "1.0.0",
  name: "QRWTY original goal \u00b7 studio reference",
  description:
    "Approved original browser/API/Postgres proving goal, separate from the target study and supported legacy recipe. Historical hardware scope remains excluded; no new runtime is supplied.",
  goalManifestSha256: "167667e29ea2d3866ffb6587a3e1673354fe0bdebf94a1ba0429b74351802176",
} as const;

export function qrwtyOriginalStudioExample() {
  return createStudioStudy(
    QRWTY_ORIGINAL_STUDIO_EXAMPLE,
    [
      {
        id: "web",
        name: "QR browser",
        description:
          "Owner sign-in, private QR management, image download and request activity; no new UI implementation.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "api",
        name: "QR application",
        description:
          "One cohesive application owns sessions, QR records, stable public redirects, image generation and activity. No separate identity or redirect deployment.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "db",
        name: "QR PostgreSQL",
        description: "Authoritative owner-scoped QR resources, sessions and request history.",
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
    ],
    [
      {
        id: "web-api",
        from: "web",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Manages private QR resources",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "api-db",
        from: "api",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Persists sessions, links and requests",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "QRWTY original goal \u00b7 studio reference",
        description:
          "Approved original browser/API/Postgres proving goal, separate from the target study and supported legacy recipe. Historical hardware scope remains excluded; no new runtime is supplied.",
      },
      nodes: [
        {
          id: "owner",
          kind: "person",
          name: "QR owner",
          description: "Creates and manages private stable links.",
        },
        {
          id: "visitor",
          kind: "person",
          name: "Link visitor",
          description: "Follows public redirect URLs; requests are not unique people.",
        },
      ],
      relationships: [
        {
          id: "owner-system",
          from: "owner",
          to: "system",
          description: "Manages links and views request activity",
          container: "web",
        },
        {
          id: "visitor-system",
          from: "visitor",
          to: "system",
          description: "Follows a stable public redirect",
          container: "api",
        },
      ],
    },
    initialLayout,
  );
}
