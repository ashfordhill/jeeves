import { type DesignDocument, designSchema } from "@jeeves/spec";
import httpService from "@jeeves/template-http-service";
import { manifestLookup } from "@jeeves/template-kit";
import restApiServer from "../../manifest.ts";
import restApiServerV02 from "../../manifest-v02.ts";

export const lookup = manifestLookup([httpService, restApiServer, restApiServerV02]);

/** One http-service element `links` with a rest-api-server attachment `links-api`. */
export function serverDesign(
  config: Record<string, unknown> = {},
  version = "0.1.0",
): DesignDocument {
  return designSchema.parse({
    schemaVersion: 1,
    revision: 1,
    elements: [
      {
        id: "links",
        name: "Links service",
        template: { id: "http-service", version: "0.1.0" },
        attachments: [{ id: "links-api", template: { id: "rest-api-server", version }, config }],
      },
    ],
  });
}
