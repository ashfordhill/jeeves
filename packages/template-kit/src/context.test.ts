import { defineTemplate, designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createGenerateContext,
  elementDir,
  GenerateContextError,
  manifestLookup,
} from "./context.ts";

const service = defineTemplate({
  id: "svc",
  version: "0.1.0",
  kind: "element",
  elementKind: "service",
  displayName: "Service",
  description: "A service",
  config: z.object({ port: z.int().default(8080) }),
  ports: [{ kind: "uses-database", direction: "out", label: "DB" }],
  attachmentSlots: [{ template: "client" }],
  card: { icon: "server" },
});
const database = defineTemplate({
  id: "db",
  version: "0.1.0",
  kind: "element",
  elementKind: "database",
  displayName: "DB",
  description: "A database",
  config: z.object({}),
  ports: [{ kind: "uses-database", direction: "in", label: "Consumers" }],
  card: { icon: "database" },
});
const client = defineTemplate({
  id: "client",
  version: "0.1.0",
  kind: "attachment",
  displayName: "Client",
  description: "A client",
  config: z.object({ timeoutMs: z.int().default(5000) }),
  ports: [{ kind: "calls", direction: "out", label: "Calls" }],
  card: { icon: "plug" },
});
const lookup = manifestLookup([service, database, client]);
const ref = (id: string) => ({ id, version: "0.1.0" });

const design = designSchema.parse({
  schemaVersion: 1,
  revision: 3,
  elements: [
    { id: "api", name: "API", template: ref("svc"), config: { port: 9000 } },
    {
      id: "web",
      name: "Web",
      template: ref("svc"),
      attachments: [{ id: "web-client", template: ref("client") }],
    },
    { id: "store", name: "Store", template: ref("db") },
    { id: "sms", name: "SMS", template: null },
  ],
  connections: [
    { id: "c1", kind: "uses-database", from: { element: "api" }, to: { element: "store" } },
    {
      id: "c2",
      kind: "calls",
      from: { element: "web", attachment: "web-client" },
      to: { element: "api" },
    },
  ],
});

describe("createGenerateContext", () => {
  it("resolves config defaults, directories, and both directions of connections", () => {
    const api = createGenerateContext(design, lookup, "api");
    expect(api.config).toEqual({ port: 9000 });
    expect(api.dir).toBe("services/api");
    expect(api.outgoing.map((c) => [c.connection.id, c.peer.dir])).toEqual([
      ["c1", "databases/store"],
    ]);
    // c2 ends on the element itself, so it counts as incoming for the element.
    expect(api.incoming.map((c) => c.connection.id)).toEqual(["c2"]);
    expect(api.incoming[0]?.peer.attachment?.id).toBe("web-client");
    expect(api.incoming[0]?.peer.manifest?.id).toBe("client");
  });

  it("scopes an attachment's context to connections on the attachment", () => {
    const ctx = createGenerateContext(design, lookup, "web", "web-client");
    expect(ctx.manifest.id).toBe("client");
    expect(ctx.config).toEqual({ timeoutMs: 5000 });
    expect(ctx.dir).toBe("services/web");
    expect(ctx.outgoing.map((c) => c.connection.id)).toEqual(["c2"]);
    expect(createGenerateContext(design, lookup, "web").outgoing).toEqual([]);
  });

  it("refuses elements that can't be generated", () => {
    expect(() => createGenerateContext(design, lookup, "sms")).toThrow(GenerateContextError);
    expect(() => createGenerateContext(design, lookup, "nope")).toThrow(/No element/);
    expect(() => createGenerateContext(design, lookup, "web", "nope")).toThrow(/No attachment/);
  });
});

describe("elementDir", () => {
  it("follows the PLAN §9 layout", () => {
    expect(elementDir("service", "a")).toBe("services/a");
    expect(elementDir("worker", "a")).toBe("services/a");
    expect(elementDir("frontend", "a")).toBe("frontends/a");
    expect(elementDir("library", "a")).toBe("packages/a");
    expect(elementDir("database", "a")).toBe("databases/a");
  });
});
