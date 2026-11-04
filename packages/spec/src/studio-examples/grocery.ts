/** Source-pinned field study; application/runtime implementation remains separate. */
import initialLayout from "./grocery.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const GROCERY_STUDIO_EXAMPLE = {
  id: "studio-grocery",
  version: "1.0.0",
  name: "Grocery review \u00b7 limited study",
  description:
    "Bounded capture/review API, private media/data and external recognition. Device choice, data/API permissions and recognition quality remain unknown; no full-product or AR-performance claim.",
  goalManifestSha256: "688b0c2a0c390e695e1271d3d2a64f6857ef77bfa779dadc841d83f548ceb8e8",
} as const;

export function groceryStudioExample() {
  return createStudioStudy(
    GROCERY_STUDIO_EXAMPLE,
    [
      {
        id: "client",
        name: "Capture and review client",
        description:
          "External capture/review boundary. Phone/tablet versus glasses is undecided; no native device or AR implementation is supplied.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "unspecified",
        },
      },
      {
        id: "api",
        name: "Field review application",
        description:
          "Bounded software API for consented captures and human review. Product workflow and priority logic remain future custom work.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "unspecified",
          exposure: "internal",
        },
      },
      {
        id: "db",
        name: "Review data",
        description:
          "Software-foundation authority for reference data/review results. Database engine/provider are unspecified by the concept.",
        settings: {
          kind: "database",
          engine: "unspecified",
          provider: "unspecified",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "media",
        name: "Private shelf media",
        description:
          "Consented/reference capture bytes only. Media access/retention and upload integration are future work.",
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
        id: "recognition",
        name: "Recognition integration",
        description:
          "External recognition adapter with no selected vendor, real API access or accuracy/latency claim. Uncertain matches require review.",
        settings: {
          kind: "external-api",
          category: "recognition",
          provider: "unspecified",
        },
      },
      {
        id: "data-source",
        name: "Reference data boundary",
        description:
          "Catalog/value/KPI inputs require permission and available sources. No Retailmotus/Trax API or backroom-data access is assumed.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "unspecified",
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
          label: "Submits captures and reviews candidates",
          protocol: "Unspecified",
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
          label: "Persists reference and review data",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-media",
        from: "api",
        to: "media",
        kind: "depends-on",
        planned: {
          label: "Stores consented reference captures",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-recognition",
        from: "api",
        to: "recognition",
        kind: "depends-on",
        planned: {
          label: "Requests candidate product matches",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-data",
        from: "api",
        to: "data-source",
        kind: "depends-on",
        planned: {
          label: "Ingests permitted reference data",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "Grocery review \u00b7 limited study",
        description:
          "Bounded capture/review API, private media/data and external recognition. Device choice, data/API permissions and recognition quality remain unknown; no full-product or AR-performance claim.",
      },
      nodes: [
        {
          id: "reviewer",
          kind: "person",
          name: "Field reviewer",
          description: "Reviews uncertain evidence and prioritizes permitted field work.",
        },
        {
          id: "capture-external",
          kind: "external-system",
          name: "Capture and review device",
          container: "client",
          description: "Phone/tablet/glasses choice remains unknown.",
        },
        {
          id: "recognition-external",
          kind: "external-system",
          name: "Recognition provider",
          container: "recognition",
          description: "Provider, API permissions and real-world performance remain unknown.",
        },
        {
          id: "data-external",
          kind: "external-system",
          name: "Permitted reference data",
          container: "data-source",
          description: "Catalog/value/KPI data availability and permissions remain unknown.",
        },
      ],
      relationships: [
        {
          id: "reviewer-system",
          from: "reviewer",
          to: "system",
          description: "Reviews shelf evidence and candidate priorities",
          container: "api",
        },
        {
          id: "capture-system",
          from: "capture-external",
          to: "system",
          description: "Supplies consented captures and corrections",
          container: "api",
        },
        {
          id: "system-recognition",
          from: "system",
          to: "recognition-external",
          description: "Requests uncertain candidate matches",
          container: "api",
        },
        {
          id: "data-system",
          from: "data-external",
          to: "system",
          description: "Supplies permitted reference data",
          container: "api",
        },
      ],
    },
    initialLayout,
  );
}
