// Test-only manifests and lookup. Shaped like the v1 templates but independent of them so spec
// tests don't depend on template packages.
import { z } from "zod";
import type { DesignDocument, DesignDocumentInput } from "./design.ts";
import { designSchema } from "./design.ts";
import type { TemplateRef } from "./ids.ts";
import { type TemplateLookup, type TemplateManifest, templateManifestSchema } from "./manifest.ts";

const manifests: TemplateManifest[] = [
  {
    id: "svc",
    version: "1.0.0",
    kind: "element",
    elementKind: "service",
    displayName: "Service",
    description: "Test service",
    config: z.object({ port: z.int().min(1).max(65535).default(8080) }),
    ports: [
      {
        kind: "uses-database",
        direction: "out",
        label: "DB",
        accepts: { elementKinds: ["database"] },
      },
      { kind: "depends-on", direction: "out", label: "Depends on" },
      { kind: "depends-on", direction: "in", label: "Dependents" },
    ],
    attachmentSlots: [{ template: "server", max: 1 }, { template: "client" }],
    card: { icon: "server", chips: ["port"] },
  },
  {
    id: "db",
    version: "1.0.0",
    kind: "element",
    elementKind: "database",
    displayName: "Database",
    description: "Test database",
    config: z.object({}),
    ports: [{ kind: "uses-database", direction: "in", label: "Consumers" }],
    card: { icon: "database" },
  },
  {
    id: "web",
    version: "1.0.0",
    kind: "element",
    elementKind: "frontend",
    displayName: "Web",
    description: "Test frontend",
    config: z.object({ title: z.string().min(1) }),
    attachmentSlots: [{ template: "client" }],
    card: { icon: "browser" },
  },
  {
    id: "server",
    version: "1.0.0",
    kind: "attachment",
    displayName: "Server",
    description: "Test server attachment",
    config: z.object({ basePath: z.string().startsWith("/").default("/api") }),
    ports: [{ kind: "calls", direction: "in", label: "API" }],
    card: { icon: "api" },
  },
  {
    id: "client",
    version: "1.0.0",
    kind: "attachment",
    displayName: "Client",
    description: "Test client attachment",
    config: z.object({ timeoutMs: z.int().positive().default(5000) }),
    ports: [
      {
        kind: "calls",
        direction: "out",
        label: "Target",
        required: true,
        multiple: false,
        accepts: { templates: ["server"] },
      },
    ],
    card: { icon: "plug" },
  },
].map((m) => templateManifestSchema.parse(m));

export const testLookup: TemplateLookup = {
  get: (ref) => manifests.find((m) => m.id === ref.id && m.version === ref.version),
  versions: (id) => manifests.filter((m) => m.id === id).map((m) => m.version),
};

export const t = (id: string): TemplateRef => ({ id, version: "1.0.0" });

export function design(
  input: Omit<DesignDocumentInput, "schemaVersion" | "revision">,
): DesignDocument {
  return designSchema.parse({ schemaVersion: 1, revision: 0, ...input });
}

/** Service with a server, a database it uses, and a web frontend whose client calls the server. */
export function sampleDesign(): DesignDocument {
  return design({
    elements: [
      {
        id: "api",
        name: "API",
        template: t("svc"),
        attachments: [{ id: "api-server", template: t("server") }],
      },
      { id: "api-db", name: "API DB", template: t("db") },
      {
        id: "site",
        name: "Site",
        template: t("web"),
        config: { title: "Site" },
        attachments: [{ id: "site-client", template: t("client") }],
      },
    ],
    connections: [
      { id: "c-db", kind: "uses-database", from: { element: "api" }, to: { element: "api-db" } },
      {
        id: "c-call",
        kind: "calls",
        from: { element: "site", attachment: "site-client" },
        to: { element: "api", attachment: "api-server" },
      },
    ],
    annotations: [
      { id: "frame", kind: "frame", title: "Backend" },
      { id: "arrow", kind: "arrow", from: "frame", to: "api" },
    ],
  });
}
