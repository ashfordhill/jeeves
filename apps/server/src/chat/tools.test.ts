import { createStudioSettings, emptyDesign, studioArchitectureExample } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { toolDefinitions, Workspace } from "./tools.ts";

const tinyurl = () => ({ ...studioArchitectureExample("studio-tinyurl").design, revision: 3 });
const run = (workspace: Workspace, name: string, args: unknown = {}) =>
  JSON.parse(workspace.run(name, JSON.stringify(args)));
const addCache = (baseRevision: number) => ({
  baseRevision,
  commands: [
    {
      type: "create",
      elements: [{ id: "edge-cache", name: "Edge cache", settings: createStudioSettings("cache") }],
      // Every tile hangs off a lane: the cache is reached through the Redirect service.
      connections: [
        {
          id: "redirect-edge-cache",
          from: "redirect",
          to: "edge-cache",
          kind: "uses-database",
          planned: {
            label: "Reads",
            protocol: "Redis",
            interaction: "Request / response",
            security: "Service identity",
          },
          settings: {},
        },
      ],
    },
  ],
});

describe("studio chat tools", () => {
  it("offers exactly the finite studio toolset", () => {
    expect(toolDefinitions().map((t) => t.name)).toEqual([
      "listStudioDefinitions",
      "describeStudioDefinition",
      "getDesign",
      "applyStudioCommands",
      "validateDesign",
      "askUser",
    ]);
  });

  it("reads the catalog, a definition and the design", () => {
    const workspace = new Workspace(tinyurl());
    const kinds = run(workspace, "listStudioDefinitions").definitions.map(
      (d: { kind: string }) => d.kind,
    );
    expect(kinds).toEqual(expect.arrayContaining(["service", "database", "cache", "queue"]));
    expect(run(workspace, "describeStudioDefinition", { kind: "cache" }).settingsSchema).toBeTypeOf(
      "object",
    );
    const design = run(workspace, "getDesign");
    expect(design.baseRevision).toBe(3);
    expect(design.elements).toHaveLength(9);
    expect(design.findings).toEqual([]);
  });

  it("prepares accepted commands on the working copy without committing them", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    expect(run(workspace, "applyStudioCommands", addCache(3))).toMatchObject({
      ok: true,
      commands: 1,
    });
    expect(workspace.working.elements.map((e) => e.id)).toContain("edge-cache");
    expect(base.elements.map((e) => e.id)).not.toContain("edge-cache");
    expect(workspace.pending.map((op) => op.op)).toEqual(["addElement", "connect", "setStudio"]);
    // A second call builds on the working copy, still against the saved base revision.
    expect(
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [{ type: "edit", element: "edge-cache", name: "CDN cache" }],
      }).ok,
    ).toBe(true);
    expect(workspace.pending).toHaveLength(5);
  });

  it("changes nothing for a refused call", () => {
    const workspace = new Workspace(tinyurl());
    const before = workspace.working;
    const refusals = [
      ["applyStudioCommands", addCache(2)],
      ["applyStudioCommands", { baseRevision: 3, commands: [{ type: "addRoute", path: "/x" }] }],
      [
        "applyStudioCommands",
        { baseRevision: 3, commands: [{ type: "edit", element: "ghost", name: "Ghost" }] },
      ],
      // Removing an owner without its resources breaks ownership.
      [
        "applyStudioCommands",
        { baseRevision: 3, commands: [{ type: "delete", elements: ["redirect"] }] },
      ],
      ["editEntity", {}],
    ] as const;
    for (const [name, args] of refusals) expect(run(workspace, name, args).ok).toBe(false);
    expect(JSON.parse(workspace.run("getDesign", "{not json")).ok).toBe(false);
    expect(workspace.working).toBe(before);
    expect(workspace.pending).toEqual([]);
    expect(workspace.activity.every((a) => !a.ok)).toBe(true);
  });

  it("starts a design from nothing when the command names the system", () => {
    const workspace = new Workspace(emptyDesign());
    const island = {
      type: "create",
      system: { name: "Shortener" },
      elements: [{ id: "api", name: "API", settings: createStudioSettings("service") }],
    };
    // A first box that no lane reaches is an island; the first tile starts a lane instead.
    expect(run(workspace, "applyStudioCommands", { baseRevision: 0, commands: [island] }).ok).toBe(
      false,
    );
    const result = run(workspace, "applyStudioCommands", {
      baseRevision: 0,
      commands: [
        {
          type: "addTile",
          system: { name: "Shortener" },
          from: { lane: "upload" },
          side: "after",
          link: "sync",
          tile: { id: "api", name: "API", kind: "service" },
          linkId: "upload-api",
        },
      ],
    });
    expect(result).toMatchObject({ ok: true, findings: [] });
    expect(workspace.working.architecture?.system.name).toBe("Shortener");
  });

  it("records an askUser question for the turn", () => {
    const workspace = new Workspace(tinyurl());
    run(workspace, "askUser", { question: "Accounts?", choices: ["Yes", "No"] });
    expect(workspace.question).toEqual({
      question: "Accounts?",
      choices: ["Yes", "No"],
      allowFreeText: true,
    });
  });
});
