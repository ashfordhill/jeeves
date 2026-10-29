import { type DesignDocument, defineTemplate, designSchema } from "@jeeves/spec";
import { manifestLookup } from "@jeeves/template-kit";
import { z } from "zod";
import httpService from "../../manifest.ts";

// Stand-ins with the real IDs and config: importing the real packages would make a workspace
// cycle (their conformance tests import this template).
const postgres = defineTemplate({
  id: "postgres",
  version: "0.1.0",
  kind: "element",
  elementKind: "database",
  displayName: "PostgreSQL",
  description: "stand-in",
  config: z.object({ version: z.enum(["17"]).default("17") }),
  ports: [{ kind: "uses-database", direction: "in", label: "Consumers" }],
  card: { icon: "database" },
});
const restApiServer = defineTemplate({
  id: "rest-api-server",
  version: "0.1.0",
  kind: "attachment",
  displayName: "REST API server",
  description: "stand-in",
  config: z.object({
    basePath: z.string().default("/api"),
    auth: z.enum(["none", "bearer"]).default("none"),
  }),
  ports: [{ kind: "calls", direction: "in", label: "API" }],
  card: { icon: "api" },
});
const restApiClient = defineTemplate({
  id: "rest-api-client",
  version: "0.1.0",
  kind: "attachment",
  displayName: "REST API client",
  description: "stand-in",
  config: z.object({ timeoutMs: z.int().default(5000), retries: z.int().default(0) }),
  ports: [{ kind: "calls", direction: "out", label: "Target API", required: true }],
  card: { icon: "plug-connected" },
});

export const lookup = manifestLookup([httpService, postgres, restApiServer, restApiClient]);

export interface DesignOptions {
  database?: boolean;
  restServer?: Record<string, unknown>;
  config?: Record<string, unknown>;
  /** Adds a `stats` service whose rest-api-client `stats-links` calls `links` (needs restServer). */
  client?: boolean;
}

/** One http-service element `links`, optionally with a database and a REST server. */
export function serviceDesign(options: DesignOptions = {}): DesignDocument {
  return designSchema.parse({
    schemaVersion: 1,
    revision: 1,
    elements: [
      {
        id: "links",
        name: "Links service",
        template: { id: "http-service", version: "0.1.0" },
        config: options.config ?? {},
        attachments: options.restServer
          ? [
              {
                id: "links-api",
                template: { id: "rest-api-server", version: "0.1.0" },
                config: options.restServer,
              },
            ]
          : [],
      },
      ...(options.database
        ? [{ id: "main-db", name: "Main DB", template: { id: "postgres", version: "0.1.0" } }]
        : []),
      ...(options.client
        ? [
            {
              id: "stats",
              name: "Stats service",
              template: { id: "http-service", version: "0.1.0" },
              attachments: [
                { id: "stats-links", template: { id: "rest-api-client", version: "0.1.0" } },
              ],
            },
          ]
        : []),
    ],
    connections: [
      ...(options.database
        ? [
            {
              id: "c1",
              kind: "uses-database",
              from: { element: "links" },
              to: { element: "main-db" },
            },
          ]
        : []),
      ...(options.client
        ? [
            {
              id: "c2",
              kind: "calls",
              from: { element: "stats", attachment: "stats-links" },
              to: { element: "links", attachment: "links-api" },
            },
          ]
        : []),
    ],
  });
}
