import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { createStudioComponentSettings } from "./studio-components.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { createStudioSettings } from "./studio-model.ts";
import {
  buildStudioCommand,
  type StudioCommand,
  type StudioConnectionCreation,
} from "./studio-operations.ts";

const tinyurl = () => studioArchitectureExample("studio-tinyurl").design;

/** Builds the command and applies its batch, as the studio and chat do. */
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  expect(batch.baseRevision).toBe(design.revision);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { ops: batch.ops.map((op) => op.op), design: result.design };
}
const studio = (design: DesignDocument) => {
  const model = design.architecture?.studio;
  if (!model) throw new Error("No studio model.");
  return model;
};
const call = (id: string, from: string, to: string): StudioConnectionCreation => ({
  id,
  from,
  to,
  kind: "calls",
  planned: {
    label: "Calls",
    protocol: "HTTPS",
    interaction: "Request / response",
    security: "Service identity",
  },
  settings: { retry: { mode: "unspecified" } },
});
const sql = (id: string, from: string, to: string): StudioConnectionCreation => ({
  ...call(id, from, to),
  kind: "uses-database",
  planned: { ...call(id, from, to).planned, label: "Reads", protocol: "SQL" },
  // Timeouts and retries belong to request/response protocols only.
  settings: {},
});

describe("buildStudioCommand", () => {
  it("creates the system with the first box, and refuses studio commands before that", () => {
    const service = { id: "links", name: "Links", settings: createStudioSettings("service") };
    expect(() =>
      buildStudioCommand(emptyDesign(), { type: "create", elements: [service] }),
    ).toThrow(/architecture system/);
    const { ops, design } = run(emptyDesign(), {
      type: "create",
      system: { name: "Shortener" },
      elements: [service],
    });
    expect(ops).toEqual(["setArchitecture", "addElement", "setStudio"]);
    expect(design.architecture?.system.name).toBe("Shortener");
    expect(studio(design).elements).toEqual([
      expect.objectContaining({ element: "links", settings: createStudioSettings("service") }),
    ]);
  });

  it("creates boxes, their connections and a package in one batch", () => {
    const { design } = run(tinyurl(), {
      type: "create",
      elements: [
        { id: "admin", name: "Admin API", settings: createStudioSettings("service") },
        { id: "audit-db", name: "Audit DB", settings: createStudioSettings("database") },
      ],
      connections: [sql("admin-audit", "admin", "audit-db")],
      package: {
        id: "link-platform",
        name: "Link platform",
        description: "",
        members: ["shorten-api", "redirect", "admin"],
      },
    });
    expect(design.connections.at(-1)?.id).toBe("admin-audit");
    expect(studio(design).connections.at(-1)?.connection).toBe("admin-audit");
    expect(studio(design).packages[0]?.members).toEqual(["shorten-api", "redirect", "admin"]);
  });

  it("edits a box's text and settings, and the system text in place", () => {
    const settings = { ...createStudioSettings("service"), language: "go" as const };
    const edited = run(tinyurl(), {
      type: "edit",
      element: "shorten-api",
      name: "Create API",
      settings,
    });
    expect(edited.ops).toEqual(["updateElement", "setStudio"]);
    expect(edited.design.elements.find((e) => e.id === "shorten-api")?.name).toBe("Create API");
    expect(
      studio(edited.design).elements.find((b) => b.element === "shorten-api")?.settings,
    ).toEqual(settings);

    const system = run(tinyurl(), { type: "editSystem", description: "Short links." });
    expect(system.ops).toEqual(["updateArchitectureSystem"]);
    expect(system.design.architecture?.system.description).toBe("Short links.");
    expect(run(emptyDesign(), { type: "editSystem", name: "New" }).ops).toEqual([
      "setArchitecture",
    ]);
  });

  it("connects, records a redirect lookup, and edits the relationship", () => {
    const base = run(tinyurl(), {
      type: "create",
      elements: [{ id: "replica", name: "Replica", settings: createStudioSettings("database") }],
    }).design;
    const connected = run(base, {
      type: "connect",
      connection: sql("redirect-replica", "redirect", "replica"),
      lookup: { element: "redirect", resource: "database" },
    }).design;
    const redirect = studio(connected).elements.find((b) => b.element === "redirect");
    expect(redirect?.settings).toMatchObject({ lookupStoreConnection: "redirect-replica" });
    expect(() =>
      buildStudioCommand(base, {
        type: "connect",
        connection: sql("shorten-replica", "shorten-api", "replica"),
        lookup: { element: "shorten-api", resource: "database" },
      }),
    ).toThrow(/Redirect/);

    const edited = run(connected, {
      type: "editConnection",
      connection: "web-shorten",
      planned: { label: "Creates links" },
      settings: { timeoutMs: 500 },
    });
    expect(edited.ops).toEqual(["updatePlannedConnection", "setStudio"]);
    expect(edited.design.connections.find((c) => c.id === "web-shorten")?.planned).toMatchObject({
      label: "Creates links",
      protocol: "HTTPS",
    });
    expect(
      studio(edited.design).connections.find((b) => b.connection === "web-shorten")?.settings,
    ).toEqual({ timeoutMs: 500 });
    // The same settings on a SQL relationship are refused.
    expect(
      applyOperations(
        connected,
        buildStudioCommand(connected, {
          type: "editConnection",
          connection: "redirect-replica",
          settings: { timeoutMs: 500 },
        }).ops,
      ).ok,
    ).toBe(false);
  });

  it("groups, removes members (dissolving below two) and ungroups", () => {
    expect(
      studio(
        run(tinyurl(), { type: "removeMembers", package: "link-platform", members: ["redirect"] })
          .design,
      ).packages,
    ).toEqual([]);
    expect(() =>
      buildStudioCommand(tinyurl(), {
        type: "removeMembers",
        package: "link-platform",
        members: ["analytics"],
      }),
    ).toThrow(/only members/);
    const grouped = run(tinyurl(), {
      type: "group",
      package: {
        id: "backoffice",
        name: "Back office",
        description: "",
        members: ["analytics", "web"],
      },
    }).design;
    expect(studio(grouped).packages.map((p) => p.id)).toEqual(["link-platform", "backoffice"]);
    expect(
      studio(run(grouped, { type: "ungroup", package: "backoffice" }).design).packages.map(
        (p) => p.id,
      ),
    ).toEqual(["link-platform"]);
  });

  it("adds, edits, links and removes components", () => {
    const component = {
      id: "analytics-guard",
      host: "analytics",
      name: "Guard",
      settings: createStudioComponentSettings("auth-guard"),
    };
    expect(() =>
      buildStudioCommand(tinyurl(), {
        type: "createComponent",
        component: { ...component, host: "ghost" },
      }),
    ).toThrow(/no editable studio binding/);
    let design = run(tinyurl(), {
      type: "createComponent",
      component,
      links: [
        {
          link: {
            id: "guard-data",
            from: "analytics-guard",
            to: { kind: "component", id: "analytics-data" },
          },
        },
      ],
    }).design;
    expect(studio(design).componentConnections?.at(-1)?.id).toBe("guard-data");

    expect(() =>
      buildStudioCommand(design, {
        type: "editComponent",
        component: "analytics-guard",
        settings: createStudioComponentSettings("custom"),
      }),
    ).toThrow(/kind cannot change/);
    design = run(design, {
      type: "editComponent",
      component: "analytics-guard",
      name: "Checks keys",
    }).design;
    expect(studio(design).components?.at(-1)?.name).toBe("Checks keys");

    design = run(design, { type: "removeComponent", components: ["analytics-guard"] }).design;
    expect(studio(design).components?.some((c) => c.id === "analytics-guard")).toBe(false);
    expect(studio(design).componentConnections?.some((l) => l.id === "guard-data")).toBe(false);
  });

  it("disconnects a component link but keeps the C2 connection it traced", () => {
    const { design } = run(tinyurl(), {
      type: "disconnectComponent",
      links: ["cache-reader-redis"],
    });
    expect(studio(design).componentConnections?.some((l) => l.id === "cache-reader-redis")).toBe(
      false,
    );
    expect(design.connections.some((c) => c.id === "redirect-cache")).toBe(true);
  });

  it("deletes a package with its members in one batch", () => {
    const { ops, design } = run(tinyurl(), {
      type: "delete",
      package: "link-platform",
      packageAction: "delete-members",
      elements: ["links-db", "link-cache", "click-events"],
    });
    expect(ops.filter((op) => op === "removeElement")).toHaveLength(5);
    expect(design.elements.map((e) => e.id).sort()).toEqual([
      "analytics",
      "analytics-store",
      "cdn",
      "reputation",
      "web",
    ]);
    expect(studio(design).packages).toEqual([]);
  });

  it("rejects commands outside the finite vocabulary", () => {
    expect(() =>
      buildStudioCommand(tinyurl(), { type: "addRoute", path: "/x" } as unknown as StudioCommand),
    ).toThrow();
    expect(() =>
      buildStudioCommand(tinyurl(), {
        type: "edit",
        element: "redirect",
        settings: { kind: "service", runtime: "cobol" },
      } as unknown as StudioCommand),
    ).toThrow();
  });
});
