import { type DesignDocument, designSchema } from "@jeeves/spec";
import httpService from "@jeeves/template-http-service";
import { manifestLookup } from "@jeeves/template-kit";
import postgres from "../../manifest.ts";

export const lookup = manifestLookup([httpService, postgres]);

const service = { id: "http-service", version: "0.1.0" };

/** Two services (or more, via `extra`) sharing one postgres element called `main-db`. */
export function sharedDatabaseDesign(extra: string[] = []): DesignDocument {
  const consumers = ["links", "stats", ...extra];
  return designSchema.parse({
    schemaVersion: 1,
    revision: 1,
    elements: [
      ...consumers.map((id) => ({ id, name: `${id} service`, template: service })),
      { id: "main-db", name: "Main DB", template: { id: "postgres", version: "0.1.0" } },
    ],
    connections: consumers.map((id) => ({
      id: `${id}-db`,
      kind: "uses-database",
      from: { element: id },
      to: { element: "main-db" },
    })),
  });
}
