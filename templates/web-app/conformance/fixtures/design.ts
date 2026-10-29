import { type DesignDocument, designSchema } from "@jeeves/spec";
import httpService from "@jeeves/template-http-service";
import { manifestLookup } from "@jeeves/template-kit";
import restApiClient from "@jeeves/template-rest-api-client";
import restApiServer from "@jeeves/template-rest-api-server";
import webApp from "../../manifest.ts";

export const lookup = manifestLookup([httpService, restApiServer, restApiClient, webApp]);

/** A title that needs escaping in JSON, HTML, and docker-compose.yml. */
export const WEB_TITLE = 'Links & "Co" $5 <beta>';

/**
 * `links` (http-service with a bearer-auth API at `/v1`), `web` (a web-app calling it through
 * the rest-api-client `web-links`), and `docs` (a web-app with no APIs).
 */
export function webDesign(): DesignDocument {
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
        id: "web",
        name: "Links web",
        template: { id: "web-app", version: "0.1.0" },
        config: { title: WEB_TITLE },
        attachments: [{ id: "web-links", template: { id: "rest-api-client", version: "0.1.0" } }],
      },
      {
        id: "docs",
        name: "Docs",
        template: { id: "web-app", version: "0.1.0" },
        config: { title: "Docs", port: 8000 },
      },
    ],
    connections: [
      {
        id: "c1",
        kind: "calls",
        from: { element: "web", attachment: "web-links" },
        to: { element: "links", attachment: "links-api" },
      },
    ],
  });
}
