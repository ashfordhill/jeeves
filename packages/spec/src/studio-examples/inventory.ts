/** Source-pinned field study; application/runtime implementation remains separate. */
import initialLayout from "./inventory.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const INVENTORY_STUDIO_EXAMPLE = {
  id: "studio-inventory",
  version: "1.0.0",
  name: "Inventory labeling \u00b7 limited study",
  description:
    "Bounded software foundation plus external terminal/printer integration. Hardware, fields/actions, app identity and offline requirements remain unknown; no full-product or stock-runtime claim.",
  goalManifestSha256: "e9bde3ee4cabb5f58b7e1bfb35a4179bf6279bcd4cbdb2ceca32843649a13056",
} as const;

export function inventoryStudioExample() {
  return createStudioStudy(
    INVENTORY_STUDIO_EXAMPLE,
    [
      {
        id: "api",
        name: "Inventory application",
        description:
          "Owns authoritative records and application actions. Exact fields/actions remain unresolved; no firmware or driver implementation.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "unspecified",
          exposure: "internal",
        },
      },
      {
        id: "db",
        name: "Inventory authority",
        description:
          "Authoritative item records and retained intent from the separate P56 architecture study; no implemented schema or stock contract.",
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
        id: "worker",
        name: "Stock work processor",
        description:
          "Independent worker from the P56 software study. Atomic stock/outbox/deduplication behavior remains future work.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "unspecified",
        },
      },
      {
        id: "queue",
        name: "Stock changes",
        description:
          "One logical stock-work identity from P56; broker/provider not chosen and no transactional guarantee supplied.",
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
      {
        id: "web",
        name: "Inventory workspace",
        description:
          "Software-study browser workspace. The handheld remains usable without making a phone/browser mandatory per label.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "terminal",
        name: "Standalone terminal",
        description:
          "External screen/buttons/Wi-Fi device integration. Exact hardware, optional scanner/location and offline support remain unresolved.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "unspecified",
        },
      },
      {
        id: "printer",
        name: "Label printer boundary",
        description:
          "External physical output boundary. Driver, language, dimensions, transport and acknowledgement remain unresolved; not a Docker microservice.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "unspecified",
        },
      },
    ],
    [
      {
        id: "terminal-api",
        from: "terminal",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Uses configured application endpoint",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "terminal-printer",
        from: "terminal",
        to: "printer",
        kind: "depends-on",
        planned: {
          label: "Requests tracked physical label output",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "web-api",
        from: "web",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Uses inventory workspace operations",
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
          label: "Reads and writes authoritative records",
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
          label: "Claims and records stock work",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-queue",
        from: "api",
        to: "queue",
        kind: "depends-on",
        planned: {
          label: "Records future durable stock intent",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "publish",
        },
      },
      {
        id: "queue-worker",
        from: "queue",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Delivers stock-work references",
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
        name: "Inventory labeling \u00b7 limited study",
        description:
          "Bounded software foundation plus external terminal/printer integration. Hardware, fields/actions, app identity and offline requirements remain unknown; no full-product or stock-runtime claim.",
      },
      nodes: [
        {
          id: "operator",
          kind: "person",
          name: "Inventory operator",
          description: "Works through a standalone terminal or optional study workspace.",
        },
        {
          id: "terminal-external",
          kind: "external-system",
          name: "Standalone terminal",
          container: "terminal",
          description: "Application/device integration with unresolved hardware.",
        },
        {
          id: "printer-external",
          kind: "external-system",
          name: "Physical label printer",
          container: "printer",
          description: "Physical printing and feedback remain unverified.",
        },
      ],
      relationships: [
        {
          id: "operator-system",
          from: "operator",
          to: "system",
          description: "Registers and reviews items",
          container: "api",
        },
        {
          id: "terminal-system",
          from: "terminal-external",
          to: "system",
          description: "Uses configured application profile",
          container: "api",
        },
        {
          id: "system-printer",
          from: "system",
          to: "printer-external",
          description: "Coordinates tracked label output via terminal",
          container: "api",
        },
      ],
    },
    initialLayout,
  );
}
