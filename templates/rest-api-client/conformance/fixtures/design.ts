import { type DesignDocument, defineTemplate, designSchema } from "@jeeves/spec";
import httpService from "@jeeves/template-http-service";
import { manifestLookup } from "@jeeves/template-kit";
import restApiServer from "@jeeves/template-rest-api-server";
import { z } from "zod";
import restApiClient from "../../manifest.ts";

// A stand-in with the real ID: the web-app package's conformance tests import this template, so
// importing it here would make a workspace cycle.
const webApp = defineTemplate({
  id: "web-app",
  version: "0.1.0",
  kind: "element",
  elementKind: "frontend",
  displayName: "Web app",
  description: "stand-in",
  config: z.object({ title: z.string(), port: z.int().default(5173) }),
  attachmentSlots: [{ template: "rest-api-client" }],
  card: { icon: "browser" },
});

export const lookup = manifestLookup([httpService, restApiServer, restApiClient, webApp]);

/**
 * Two http-service elements: `links` serves an API (`links-api`, bearer auth, base path `/v1`),
 * and `stats` calls it through its rest-api-client attachment `stats-links`.
 */
export function clientDesign(
  clientConfig: Record<string, unknown> = {},
  caller: "http-service" | "web-app" = "http-service",
): DesignDocument {
  return designSchema.parse({
    schemaVersion: 1,
    revision: 1,
    elements: [
      {
        id: "links",
        name: "Links service",
        template: { id: "http-service", version: "0.1.0" },
        attachments: [
          {
            id: "links-api",
            template: { id: "rest-api-server", version: "0.1.0" },
            config: { basePath: "/v1", auth: "bearer" },
          },
        ],
      },
      {
        id: "stats",
        name: "Stats service",
        template: { id: caller, version: "0.1.0" },
        config: caller === "web-app" ? { title: "Stats" } : { port: 8081 },
        attachments: [
          {
            id: "stats-links",
            template: { id: "rest-api-client", version: "0.1.0" },
            config: clientConfig,
          },
        ],
      },
    ],
    connections: [
      {
        id: "c1",
        kind: "calls",
        from: { element: "stats", attachment: "stats-links" },
        to: { element: "links", attachment: "links-api" },
      },
    ],
  });
}
