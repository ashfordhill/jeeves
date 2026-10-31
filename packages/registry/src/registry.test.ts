import { type DesignDocument, designSchema, type TemplateManifestInput } from "@jeeves/spec";
import httpService from "@jeeves/template-http-service";
import restApiServer from "@jeeves/template-rest-api-server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { builtinManifests, builtinRegistry } from "./builtin.ts";
import { createRegistry, RegistryError } from "./registry.ts";

const registry = builtinRegistry();
const v = (id: string) => ({ id, version: "0.1.0" });

function board(): DesignDocument {
  return designSchema.parse({
    schemaVersion: 1,
    revision: 0,
    elements: [
      {
        id: "svc",
        name: "Service",
        template: v("http-service"),
        attachments: [{ id: "svc-api", template: v("rest-api-server") }],
      },
      { id: "db", name: "DB", template: v("postgres") },
      { id: "web", name: "Web", template: v("web-app"), config: { title: "Web" } },
    ],
  });
}

describe("builtin registry", () => {
  it("retains published templates alongside new versions and capabilities", () => {
    expect(registry.list().map((m) => `${m.id}@${m.version}`)).toEqual([
      "durable-events@0.1.0",
      "http-service@0.1.0",
      "http-service@0.2.0",
      "postgres@0.1.0",
      "rest-api-client@0.1.0",
      "rest-api-server@0.1.0",
      "web-app@0.1.0",
    ]);
    expect(registry.latest("postgres")?.version).toBe("0.1.0");
    expect(registry.versions("nope")).toEqual([]);
  });

  it("groups element templates for the palette", () => {
    expect(registry.palette().map((g) => [g.group, g.templates.map((m) => m.id)])).toEqual([
      ["Services", ["http-service"]],
      ["Frontends", ["web-app"]],
      ["Data", ["postgres"]],
    ]);
  });

  it("describes a template with a JSON Schema for its config", () => {
    const description = registry.describe(v("http-service"));
    expect(description).toMatchObject({
      kind: "element",
      elementKind: "service",
      displayName: "HTTP service",
    });
    expect(description?.configJsonSchema).toMatchObject({
      type: "object",
      properties: {
        port: { type: "integer", default: 8080, title: "Port" },
        logLevel: { enum: ["debug", "info", "warn", "error"], default: "info" },
      },
    });
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    expect(registry.describe(v("nope"))).toBeUndefined();
  });

  it("lists compatible attachments per element template", () => {
    expect(registry.attachmentsFor(v("http-service")).map((m) => m.id)).toEqual([
      "rest-api-server",
      "rest-api-client",
    ]);
    expect(registry.attachmentsFor(v("web-app")).map((m) => m.id)).toEqual(["rest-api-client"]);
    expect(registry.attachmentsFor(v("postgres"))).toEqual([]);
  });
});

describe("canAttach", () => {
  it("allows a compatible attachment", () => {
    expect(registry.canAttach(board(), "web", v("rest-api-client"))).toEqual({ ok: true });
  });

  it("refuses an attachment the element has no slot for", () => {
    expect(registry.canAttach(board(), "web", v("rest-api-server"))).toMatchObject({
      ok: false,
      code: "ATTACHMENT_INCOMPATIBLE",
      reason: "A Web app can't take a REST API server.",
    });
  });

  it("refuses a second REST server", () => {
    expect(registry.canAttach(board(), "svc", v("rest-api-server"))).toMatchObject({
      ok: false,
      code: "ATTACHMENT_INCOMPATIBLE",
    });
  });

  it("refuses an element template as an attachment, and an unknown element", () => {
    expect(registry.canAttach(board(), "svc", v("postgres"))).toMatchObject({
      code: "TEMPLATE_KIND_MISMATCH",
    });
    expect(registry.canAttach(board(), "ghost", v("rest-api-client"))).toMatchObject({
      code: "UNKNOWN_REFERENCE",
    });
  });
});

describe("canConnect", () => {
  it("allows a service to use a database", () => {
    expect(
      registry.canConnect(board(), "uses-database", { element: "svc" }, { element: "db" }),
    ).toEqual({ ok: true });
  });

  it("refuses a frontend calling a service directly and suggests the attachments", () => {
    const result = registry.canConnect(board(), "calls", { element: "web" }, { element: "svc" });
    expect(result).toMatchObject({
      ok: false,
      code: "PORT_INCOMPATIBLE",
      reason: '"Web" has no outgoing "calls" connection.',
    });
    expect(!result.ok && result.suggestions).toEqual([
      {
        message: 'Add a REST API client to "Web" and connect from it.',
        addAttachment: { element: "web", template: v("rest-api-client") },
      },
      {
        message: 'Connect to the REST API server on "Service" instead.',
        useEndpoint: { element: "svc", attachment: "svc-api" },
      },
    ]);
  });

  it("suggests both a client and a server when neither end has one", () => {
    const doc = board();
    doc.elements[0]?.attachments.splice(0);
    const result = registry.canConnect(doc, "calls", { element: "web" }, { element: "svc" });
    expect(!result.ok && result.suggestions.map((s) => s.message)).toEqual([
      'Add a REST API client to "Web" and connect from it.',
      'Add a REST API server to "Service" and connect to it.',
    ]);
  });

  it("refuses a database using a service", () => {
    expect(
      registry.canConnect(board(), "uses-database", { element: "db" }, { element: "svc" }),
    ).toMatchObject({
      ok: false,
      code: "PORT_INCOMPATIBLE",
    });
  });

  it("refuses a second target for a client", () => {
    const doc = board();
    doc.elements[2]?.attachments.push({
      id: "web-client",
      template: v("rest-api-client"),
      config: {},
      notes: "",
    });
    doc.elements.push({
      id: "svc2",
      name: "Service 2",
      template: v("http-service"),
      config: {},
      attachments: [{ id: "svc2-api", template: v("rest-api-server"), config: {}, notes: "" }],
      notes: "",
    });
    const from = { element: "web", attachment: "web-client" };
    doc.connections.push({
      id: "c1",
      kind: "calls",
      from,
      to: { element: "svc", attachment: "svc-api" },
    });
    expect(
      registry.canConnect(doc, "calls", from, { element: "svc2", attachment: "svc2-api" }),
    ).toMatchObject({
      ok: false,
      code: "PORT_MULTIPLICITY",
    });
  });

  it("lists the connection kinds possible between two endpoints", () => {
    expect(registry.connectionKinds(board(), { element: "svc" }, { element: "db" })).toEqual([
      "uses-database",
    ]);
    expect(registry.connectionKinds(board(), { element: "web" }, { element: "svc" })).toEqual([
      "depends-on",
    ]);
    expect(registry.connectionKinds(board(), { element: "db" }, { element: "web" })).toEqual([]);
  });
});

describe("createRegistry", () => {
  const attachment = restApiServer as TemplateManifestInput;

  it("rejects an invalid manifest", () => {
    expect(() => createRegistry([{ ...attachment, id: "Bad Id" }])).toThrow(RegistryError);
  });

  it("rejects duplicates and unknown slot templates", () => {
    expect(() => createRegistry([attachment, attachment])).toThrow(/registered twice/);
    expect(() => createRegistry([httpService])).toThrow(/isn't a registered attachment template/);
  });

  it("rejects two ports with the same kind and direction", () => {
    const ports = [...(attachment.ports ?? []), ...(attachment.ports ?? [])];
    expect(() => createRegistry([{ ...attachment, ports }])).toThrow(/two "calls\/in" ports/);
  });

  it("rejects card chips and presets that don't match the config", () => {
    expect(() => createRegistry([{ ...attachment, card: { icon: "x", chips: ["nope"] } }])).toThrow(
      /chip/,
    );
    expect(() =>
      createRegistry([
        { ...attachment, presets: [{ id: "p", name: "P", config: { basePath: 1 } }] },
      ]),
    ).toThrow(/preset "p"/);
  });

  it("rejects a config schema that can't become JSON Schema", () => {
    const config = z.object({ when: z.date().default(new Date(0)) });
    expect(() => createRegistry([{ ...attachment, config, card: { icon: "x" } }])).toThrow(
      /JSON Schema/,
    );
  });

  it("serves the newest version as latest", () => {
    const newer = { ...attachment, version: "0.10.0" };
    const r = createRegistry([newer, attachment, { ...attachment, version: "0.2.0" }]);
    expect(r.versions("rest-api-server")).toEqual(["0.1.0", "0.2.0", "0.10.0"]);
    expect(r.latest("rest-api-server")?.version).toBe("0.10.0");
  });

  it("is what builtinRegistry uses", () => {
    expect(createRegistry(builtinManifests).list()).toHaveLength(7);
  });
});
