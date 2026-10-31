import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureComponentSchema, architectureSchema } from "./architecture.ts";
import { architectureViews } from "./architecture-view.ts";
import { designSchema, type Element, emptyDesign } from "./design.ts";
import { blocksGenerate, isStructural } from "./findings.ts";
import {
  componentCompatible,
  componentHostRole,
  plannedCapabilities,
  plannedCapability,
  plannedConfigSchema,
} from "./planned-capabilities.ts";
import { sampleDesign, testLookup } from "./test-support.ts";

const additions = [
  "integration-adapter",
  "notifications-module",
  "billing-module",
  "organizations-module",
  "developer-api-module",
  "reports-module",
  "search-module",
  "scheduled-jobs-module",
  "event-handlers-module",
  "audit-log-module",
  "screen-group",
  "client-session",
  "api-facade",
  "local-state",
];

describe("SaaS component contracts", () => {
  it.each(additions)("%s validates every option and rejects malformed intent", (id) => {
    const capability = plannedCapability(id)!;
    expect(capability.scope).toBe("component");
    const schema = plannedConfigSchema(id);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ unknown: true }).success).toBe(false);
    for (const field of capability.fields) {
      if (field.options) {
        for (const option of field.options)
          expect(schema.safeParse({ [field.key]: option }).success).toBe(true);
        expect(schema.safeParse({ [field.key]: "Unknown" }).success).toBe(false);
      } else if (typeof field.default === "boolean") {
        expect(schema.safeParse({ [field.key]: !field.default }).success).toBe(true);
        expect(schema.safeParse({ [field.key]: "true" }).success).toBe(false);
      } else if (typeof field.default === "number") {
        expect(schema.safeParse({ [field.key]: 0 }).success).toBe(true);
        for (const invalid of [-1, 0.5, 1_000_000_001, "12"])
          expect(schema.safeParse({ [field.key]: invalid }).success).toBe(false);
      } else {
        expect(schema.safeParse({ [field.key]: "x".repeat(2000) }).success).toBe(true);
        for (const invalid of ["x".repeat(2001), 42])
          expect(schema.safeParse({ [field.key]: invalid }).success).toBe(false);
      }
    }
  });

  it.each(additions)("%s persists only on compatible hosts and remains planning-only", (id) => {
    const capability = plannedCapability(id)!;
    for (const host of [
      "application-api",
      "background-worker",
      "serverless-function",
      "browser-client",
      "mobile-client",
      "desktop-client",
      "relational-store",
      "third-party-service",
    ]) {
      const owner: Element = {
        id: "host",
        name: "Host",
        template: null,
        planned: host,
        config: {},
        attachments: [],
        notes: "",
      };
      const component = architectureComponentSchema.parse({
        id: "feature",
        name: capability.name,
        element: owner.id,
        capability: id,
        technology: "Repository",
        usesConnections: ["collaboration"],
      });
      const design = designSchema.parse({
        ...emptyDesign(),
        elements: [
          owner,
          { id: "provider", name: "Provider", template: null, planned: "third-party-service" },
        ],
        connections: [
          {
            id: "collaboration",
            kind: "depends-on",
            from: { element: owner.id },
            to: { element: "provider" },
            planned: {
              label: "Synchronizes provider records",
              protocol: "HTTPS/JSON",
              interaction: "Request / response",
              security: "Service identity",
            },
          },
        ],
      });
      const architecture = architectureSchema.parse({
        system: { name: "SaaS" },
        components: [component],
      });
      const result = applyOperations(design, [{ op: "setArchitecture", architecture }], testLookup);
      const compatible =
        capability.role === "frontend"
          ? ["browser-client", "mobile-client", "desktop-client"].includes(host)
          : ["application-api", "background-worker", "serverless-function"].includes(host);
      expect(componentCompatible(capability, componentHostRole(owner, testLookup))).toBe(
        compatible,
      );
      expect(result.ok, `${id} on ${host}`).toBe(compatible);
      expect(design.architecture).toBeUndefined();
      if (!result.ok) continue;
      expect(result.findings.filter(isStructural)).toEqual([]);
      expect(blocksGenerate(result.findings)).toBe(true);
      const view = architectureViews(result.design, testLookup, "SaaS").components.find(
        (item) => item.container === owner.id,
      )!;
      expect(view.nodes.find((node) => node.id === "responsibility:feature")).toMatchObject({
        technology: "Repository",
        support: "planned",
      });
      expect(view.edges).toContainEqual(
        expect.objectContaining({
          from: "responsibility:feature",
          to: "container:provider",
          description: "Synchronizes provider records",
          protocol: "HTTPS/JSON",
          planned: true,
        }),
      );
    }
  });

  it("uses registered roles for implemented hosts and keeps unknown hosts incompatible", () => {
    const design = sampleDesign();
    for (const owner of design.elements) {
      const role = componentHostRole(owner, testLookup);
      for (const entry of plannedCapabilities.filter((item) => item.scope === "component"))
        expect(componentCompatible(entry, role)).toBe(
          entry.role === "frontend"
            ? role === "frontend"
            : ["service", "worker"].includes(role ?? ""),
        );
    }
    expect(componentCompatible(plannedCapability("domain-module")!, undefined)).toBe(false);
    expect(componentCompatible(plannedCapability("application-api")!, "service")).toBe(false);
    const architecture = architectureSchema.parse({
      system: { name: "Test" },
      components: [{ id: "invalid", name: "Screen", element: "api", capability: "screen-group" }],
    });
    expect(applyOperations(design, [{ op: "setArchitecture", architecture }], testLookup).ok).toBe(
      false,
    );
  });

  it("bounds optional component technology without rewriting legacy components", () => {
    const legacy = architectureComponentSchema.parse({
      id: "feature",
      name: "Feature",
      element: "host",
    });
    expect(legacy).not.toHaveProperty("technology");
    expect(
      architectureComponentSchema.parse({ ...legacy, technology: "  REST controller  " })
        .technology,
    ).toBe("REST controller");
    expect(
      architectureComponentSchema.safeParse({ ...legacy, technology: "x".repeat(120) }).success,
    ).toBe(true);
    expect(
      architectureComponentSchema.safeParse({ ...legacy, technology: "x".repeat(121) }).success,
    ).toBe(false);
    expect(architectureComponentSchema.safeParse({ ...legacy, technology: 12 }).success).toBe(
      false,
    );
  });
});
