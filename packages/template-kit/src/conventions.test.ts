import { defineTemplate, designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createGenerateContext, manifestLookup } from "./context.ts";
import {
  apiEnvName,
  clientExportName,
  clientModulePath,
  contractPath,
  restClientTargets,
} from "./conventions.ts";

const service = defineTemplate({
  id: "http-service",
  version: "0.1.0",
  kind: "element",
  elementKind: "service",
  displayName: "Service",
  description: "stand-in",
  config: z.object({ port: z.int().default(8080) }),
  attachmentSlots: [{ template: "rest-api-server" }, { template: "rest-api-client" }],
  card: { icon: "server" },
});
const server = defineTemplate({
  id: "rest-api-server",
  version: "0.1.0",
  kind: "attachment",
  displayName: "Server",
  description: "stand-in",
  config: z.object({
    basePath: z.string().default("/api"),
    auth: z.enum(["none", "bearer"]).default("none"),
  }),
  ports: [{ kind: "calls", direction: "in", label: "API" }],
  card: { icon: "api" },
});
const client = defineTemplate({
  id: "rest-api-client",
  version: "0.1.0",
  kind: "attachment",
  displayName: "Client",
  description: "stand-in",
  config: z.object({ timeoutMs: z.int().default(5000), retries: z.int().default(0) }),
  ports: [{ kind: "calls", direction: "out", label: "Target" }],
  card: { icon: "plug" },
});
const lookup = manifestLookup([service, server, client]);
const ref = (id: string) => ({ id, version: "0.1.0" });

function design(clients: { id: string; to?: string }[]) {
  return designSchema.parse({
    schemaVersion: 1,
    revision: 1,
    elements: [
      {
        id: "link-store",
        name: "Links",
        template: ref("http-service"),
        config: { port: 9000 },
        attachments: [
          { id: "links-api", template: ref("rest-api-server"), config: { auth: "bearer" } },
        ],
      },
      {
        id: "stats",
        name: "Stats",
        template: ref("http-service"),
        attachments: clients.map((c) => ({ id: c.id, template: ref("rest-api-client") })),
      },
    ],
    connections: clients
      .filter((c) => c.to)
      .map((c, i) => ({
        id: `c${i}`,
        kind: "calls",
        from: { element: "stats", attachment: c.id },
        to: { element: c.to, attachment: "links-api" },
      })),
  });
}

describe("naming conventions", () => {
  it("derive paths, variables, and identifiers from element IDs", () => {
    expect(contractPath("link-store")).toBe("contracts/link-store.openapi.yaml");
    expect(apiEnvName("link-store", "URL")).toBe("API_LINK_STORE_URL");
    expect(apiEnvName("a1", "TOKEN")).toBe("API_A1_TOKEN");
    expect(clientModulePath("frontends/web", "link-store")).toBe(
      "frontends/web/src/clients/link-store.generated.ts",
    );
    expect(clientExportName("link-store")).toBe("linkStoreClient");
    expect(clientExportName("a-2b")).toBe("a2bClient");
  });
});

describe("restClientTargets", () => {
  it("resolves each client's target with the server's and the target's config defaults", () => {
    const ctx = createGenerateContext(
      design([{ id: "to-links", to: "link-store" }]),
      lookup,
      "stats",
    );
    expect(restClientTargets(ctx)).toEqual([
      expect.objectContaining({
        config: { timeoutMs: 5000, retries: 0 },
        target: expect.objectContaining({ id: "link-store" }),
        server: expect.objectContaining({ basePath: "/api", auth: "bearer" }),
        port: 9000,
      }),
    ]);
  });

  it("refuses an unconnected client and two clients for one target", () => {
    const unconnected = createGenerateContext(design([{ id: "to-links" }]), lookup, "stats");
    expect(() => restClientTargets(unconnected)).toThrow(
      "The REST client to-links on stats isn't connected to an API",
    );
    const twice = createGenerateContext(
      design([
        { id: "a", to: "link-store" },
        { id: "b", to: "link-store" },
      ]),
      lookup,
      "stats",
    );
    expect(() => restClientTargets(twice)).toThrow("stats has two REST clients for link-store");
  });
});
