import {
  applyOperations,
  buildDesignScopeCommand,
  buildStudioCommand,
  emptyDesign,
  laneOptions,
  newLinkId,
  newTileIdentity,
  studioArchitectureExample,
  studioLinkRules,
  studioWarningSentence,
  tinyurlDesignScope,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { INSTRUCTIONS, linkRuleText, toolDefinitions, Workspace } from "./tools.ts";

const tinyurl = () => ({ ...studioArchitectureExample("studio-tinyurl").design, revision: 3 });
const run = (workspace: Workspace, name: string, args: unknown = {}) =>
  JSON.parse(workspace.run(name, JSON.stringify(args)));
/**
 * A cache after the Redirect service, as the canvas names it (`redirect-cache` is taken), with
 * the pair's default mode.
 */
const addCache = (baseRevision: number) => ({
  baseRevision,
  commands: [
    {
      type: "addTile",
      from: { tile: "redirect" },
      side: "after",
      tile: { id: "cache", name: "Cache", kind: "cache" },
      linkId: "redirect-cache-2",
    },
  ],
});

describe("studio chat tools", () => {
  it("shares persistent scope commands with mouse edits and requires a fresh explicit upgrade preview", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    const scope = tinyurlDesignScope();
    scope.customRequirements.push({
      id: "custom-rule",
      requirement: "Define tenant policy",
      criticality: "required",
      element: "shorten",
    });
    const args = { baseRevision: base.revision, scope, upgrade: true };
    expect(run(workspace, "configureDesignScope", { ...args, action: "apply" }).ok).toBe(false);
    expect(run(workspace, "configureDesignScope", { ...args, action: "preview" }).ok).toBe(true);
    expect(workspace.pending).toEqual([]);
    expect(
      run(workspace, "configureDesignScope", { ...args, action: "apply", upgrade: undefined }).ok,
    ).toBe(false);
    expect(
      run(workspace, "configureDesignScope", { ...args, action: "apply", baseRevision: 0 }).ok,
    ).toBe(false);
    expect(run(workspace, "configureDesignScope", { ...args, action: "apply" }).ok).toBe(true);
    const mouse = applyOperations(
      base,
      buildDesignScopeCommand(base, { scope, upgrade: true }).ops,
    );
    if (!mouse.ok) throw new Error(JSON.stringify(mouse.errors));
    expect(workspace.working).toEqual(mouse.design);
    expect(workspace.pending).toEqual(buildDesignScopeCommand(base, { scope, upgrade: true }).ops);
    const review = run(workspace, "reviewDesign");
    expect(review.changes).toContainEqual(expect.objectContaining({ type: "scope" }));
    expect(review.persistentScope).toMatchObject({ ...scope, persistence: "saved design" });
    expect(review.scope.persistence).toBe("this turn only");
    expect(review.obligations).toContainEqual(
      expect.objectContaining({ source: "custom", id: "custom-rule", status: "not specified" }),
    );
    const generation = workspace.generation;
    const edited = structuredClone(scope);
    edited.customRequirements = edited.customRequirements.map((item) => ({
      ...item,
      requirement: "Refine tenant policy",
    }));
    run(workspace, "configureDesignScope", { ...args, action: "apply", scope: edited });
    expect(workspace.generation).toBe(generation + 1);
    expect(workspace.reviewedGeneration).toBeLessThan(workspace.generation);
    expect(run(workspace, "getDesign").persistentScope.customRequirements).toEqual(
      edited.customRequirements,
    );
  });
  it("offers exactly the finite studio toolset", () => {
    expect(toolDefinitions().map((t) => t.name)).toEqual([
      "describeOperation",
      "configureOperations",
      "listStudioDefinitions",
      "describeStudioDefinition",
      "listStudioPatterns",
      "describeStudioPattern",
      "getDesign",
      "configureDesignScope",
      "configureOwnership",
      "applyStudioCommands",
      "validateDesign",
      "readReadiness",
      "declareReviewScope",
      "reviewDesign",
      "askUser",
    ]);
  });

  it("bounds pattern lookup and leaves the workspace unchanged", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    expect(run(workspace, "listStudioPatterns").patterns).toHaveLength(4);
    expect(
      run(workspace, "describeStudioPattern", { id: "pending-order-payment" }).pattern,
    ).toMatchObject({
      support: { topology: "partial", templateAvailability: "none", runtimeVerification: "none" },
      example: { kind: "obligation" },
    });
    for (const args of [
      { id: "unknown" },
      { id: "durable-background-job", version: "latest" },
      { id: ["cache-aside-lookup"] },
    ]) {
      expect(run(workspace, "describeStudioPattern", args).ok).toBe(false);
    }
    expect(run(workspace, "listStudioPatterns", { query: "anything" }).ok).toBe(false);
    expect(workspace.working).toBe(base);
    expect(workspace.pending).toEqual([]);
  });

  it("declares bounded review scope explicitly and keeps previews read-only", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    run(workspace, "describeStudioPattern", { id: "cache-aside-lookup" });
    expect(run(workspace, "reviewDesign").obligations).toEqual([]);
    const scope = {
      patterns: [{ id: "cache-aside-lookup", checklistIds: ["cache-loss"] }],
      assumptions: ["Approximate analytics"],
      obligations: [
        {
          id: "custom-behavior",
          requirement: "Define custom visibility",
          element: "redirect",
          connection: "redirect-db",
        },
      ],
    };
    expect(run(workspace, "declareReviewScope", scope).ok).toBe(true);
    const generation = workspace.generation;
    const review = run(workspace, "reviewDesign");
    expect(review.changes).toEqual([]);
    expect(review.obligations).toHaveLength(4);
    expect(
      review.obligations.every((item: { status: string }) => item.status === "not specified"),
    ).toBe(true);
    expect(review.assumptions).toEqual(scope.assumptions);
    expect(review.scope.persistence).toBe("this turn only");
    expect(workspace.generation).toBe(generation);
    expect(workspace.working).toBe(base);
    expect(workspace.pending).toEqual([]);
    for (const invalid of [
      { ...scope, patterns: [{ id: "cache-aside-lookup", checklistIds: ["imaginary"] }] },
      { ...scope, patterns: [...scope.patterns, ...scope.patterns] },
      { ...scope, obligations: [{ id: "missing", requirement: "Something", element: "ghost" }] },
      { ...scope, assumptions: Array(9).fill("Too many") },
      { ...scope, verified: true },
    ])
      expect(run(workspace, "declareReviewScope", invalid).ok).toBe(false);
    expect(workspace.scope).toEqual(scope);
    expect(run(workspace, "reviewDesign", { save: true }).ok).toBe(false);
  });

  it("reads the tile types, a definition and the design in lane order", () => {
    const workspace = new Workspace(tinyurl());
    const catalog = run(workspace, "listStudioDefinitions");
    expect(catalog.tileTypes.map((t: { type: string }) => t.type)).toEqual([
      "service",
      "api",
      "database",
      "cache",
      "queue",
      "storage",
      "external",
    ]);
    expect(catalog.caps).toEqual({ linksPerTile: 4, entriesPerLane: 4 });
    expect(run(workspace, "describeStudioDefinition", { kind: "cache" }).settingsSchema).toBeTypeOf(
      "object",
    );
    const design = run(workspace, "getDesign");
    expect(design.baseRevision).toBe(3);
    expect(design.actions).toEqual([
      {
        lane: "download",
        name: "Open link",
        entries: [
          { id: "download-stats-api", tile: "stats-api" },
          { id: "download-redirect", tile: "redirect" },
        ],
        tiles: [
          "stats-api",
          "redirect",
          "analytics-store",
          "click-events",
          "url-cache",
          "url-db",
          "analytics",
        ],
      },
      {
        lane: "upload",
        name: "Shorten",
        entries: [{ id: "upload-shorten", tile: "shorten" }],
        tiles: ["shorten", "url-db"],
      },
    ]);
    expect(design.tiles).toHaveLength(8);
    const redirect = design.tiles.find((t: { id: string }) => t.id === "redirect");
    expect(redirect).toMatchObject({ type: "service", kind: "redirect" });
    // A link into a store says whether it writes (from the store's owner) or reads.
    expect(
      redirect.links.map(
        (l: { to: string; mode: string; access?: string }) =>
          `${l.to} ${l.mode}${l.access ? ` ${l.access}` : ""}`,
      ),
    ).toEqual(["click-events async", "url-cache sync write", "url-db sync read"]);
    const shorten = design.tiles.find((t: { id: string }) => t.id === "shorten");
    expect(shorten.links).toMatchObject([{ to: "url-db", access: "write" }]);
    expect(redirect.modules).toHaveLength(4);
    expect(design.findings).toEqual([]);
  });

  it("adds a tile through chat with the same batch as the canvas", () => {
    const base = tinyurl();
    // What the canvas sends for Redirect's right + released on Cache (canvas/creation.tsx).
    const from = { tile: "redirect" };
    const option = laneOptions(base, from, "after").find((o) => o.type === "cache");
    const tile = newTileIdentity(base, "cache");
    const canvas = {
      type: "addTile" as const,
      from,
      side: "after" as const,
      tile: { ...tile, kind: option && "kind" in option ? option.kind : "cache" },
      linkId: newLinkId(base, from, tile.id, [tile.id]),
    };
    expect(canvas).toEqual(addCache(3).commands[0]);
    const workspace = new Workspace(base);
    expect(run(workspace, "applyStudioCommands", addCache(3))).toMatchObject({ ok: true });
    expect(workspace.pending).toEqual(buildStudioCommand(base, canvas).ops);
  });

  it("prepares accepted commands on the working copy without committing them", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    expect(run(workspace, "applyStudioCommands", addCache(3))).toMatchObject({
      ok: true,
      commands: 1,
    });
    expect(workspace.working.elements.map((e) => e.id)).toContain("cache");
    expect(base.elements.map((e) => e.id)).not.toContain("cache");
    expect(workspace.pending.map((op) => op.op)).toEqual(["addElement", "connect", "setStudio"]);
    // A second call builds on the working copy, still against the saved base revision.
    expect(
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [{ type: "edit", element: "cache", name: "Redirect cache" }],
      }).ok,
    ).toBe(true);
    expect(workspace.pending).toHaveLength(5);
  });

  it("changes nothing for a refused call, and says why in plain words", () => {
    const workspace = new Workspace(tinyurl());
    const before = workspace.working;
    const apply = (...commands: unknown[]) =>
      run(workspace, "applyStudioCommands", { baseRevision: 3, commands });
    expect(run(workspace, "applyStudioCommands", addCache(2)).ok).toBe(false);
    expect(apply({ type: "addRoute", path: "/x" }).error).toMatch(/no "addRoute" command/);
    // The old island-making commands are gone; tiles hang off lanes.
    expect(apply({ type: "create", elements: [] }).error).toMatch(
      /no "create" command\. The commands are addAction, renameAction, removeAction, addTile, linkTiles/,
    );
    expect(apply({ type: "edit", element: "ghost", name: "Ghost" }).error).toBe(
      'There is no tile "ghost".',
    );
    // The second command would cut off the click path and the new cache; neither is kept.
    expect(apply(addCache(3).commands[0], { type: "removeTile", tile: "redirect" }).error).toBe(
      "Command 2 (removeTile): Removing Redirect service would cut off Click events, URL cache, Cache and Analytics worker; list them in alsoRemove to remove them too.",
    );
    const link = (from: string, to: string) =>
      apply({ type: "linkTiles", from: { tile: from }, to, link: "sync", linkId: `${from}-${to}` });
    expect(link("analytics", "redirect").error).toBe(
      "Redirect service already leads to Analytics worker; linking them would make a loop.",
    );
    expect(link("url-cache", "shorten").error).toBe(
      "URL cache can't link to Shorten service. A cache can't link onward.",
    );
    expect(run(workspace, "editEntity", {}).ok).toBe(false);
    expect(JSON.parse(workspace.run("getDesign", "{not json")).ok).toBe(false);
    expect(workspace.working).toBe(before);
    expect(workspace.pending).toEqual([]);
    expect(workspace.activity.every((a) => !a.ok)).toBe(true);
  });

  it("starts a design from nothing with an action that names the system, then renames it", () => {
    const workspace = new Workspace(emptyDesign());
    const apply = (...commands: unknown[]) =>
      run(workspace, "applyStudioCommands", { baseRevision: 0, commands });
    expect(apply({ type: "addAction", lane: "download" }).error).toMatch(
      /^This design has no system yet\. Start it with addAction/,
    );
    expect(
      apply(
        { type: "addAction", lane: "download", system: { name: "Videos" } },
        { type: "renameAction", lane: "download", name: "Watch" },
        { type: "addAction", lane: "upload", name: "Publish" },
      ),
    ).toMatchObject({
      ok: true,
      findings: [],
      // Actions with no entries are warnings, not refusals: the design is being built.
      warnings: [
        "Watch has no entries: nothing handles it yet. Add the service or API that handles it after it, or remove the action.",
        "Publish has no entries: nothing handles it yet. Add the service or API that handles it after it, or remove the action.",
      ],
    });
    const design = run(workspace, "getDesign");
    expect(design.actions).toEqual([
      { lane: "download", name: "Watch", entries: [], tiles: [] },
      { lane: "upload", name: "Publish", entries: [], tiles: [] },
    ]);
    expect(design.findings).toEqual([]);
    expect(design.warnings).toHaveLength(2);
    // One action per lane; the name is a word, not a sentence.
    expect(apply({ type: "addAction", lane: "upload" }).error).toBe(
      "This design already has a Produce action; each lane has one.",
    );
    expect(
      apply({ type: "renameAction", lane: "upload", name: "Publish a video to the channel" }).ok,
    ).toBe(false);
    expect(apply({ type: "removeAction", lane: "upload" })).toMatchObject({ ok: true });
    expect(run(workspace, "getDesign").actions).toHaveLength(1);
  });

  it("starts a design from nothing with a first tile on a lane that names the system, then moves it", () => {
    const workspace = new Workspace(emptyDesign());
    const first = {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      link: "sync",
      tile: { id: "api", name: "API", kind: "service" },
      linkId: "upload-api",
    };
    const apply = (command: unknown) =>
      run(workspace, "applyStudioCommands", { baseRevision: 0, commands: [command] });
    expect(apply(first).error).toMatch(/^This design has no system yet\./);
    const result = apply({ ...first, system: { name: "Shortener" } });
    expect(result).toMatchObject({ ok: true, findings: [] });
    expect(workspace.working.architecture?.system.name).toBe("Shortener");
    // The addTile from the lane added its action, with the default name.
    expect(run(workspace, "getDesign").actions).toEqual([
      {
        lane: "upload",
        name: "Produce",
        entries: [{ id: "upload-api", tile: "api" }],
        tiles: ["api"],
      },
    ]);
    // An entry is in one lane: "both" is refused, and setEntryLane moves it to the other lane's
    // action, which must exist.
    expect(apply({ type: "setEntryLane", entry: "upload-api", lane: "both" }).ok).toBe(false);
    expect(apply({ type: "setEntryLane", entry: "upload-api", lane: "download" }).error).toBe(
      "The download lane has no action yet; add its Consume action first.",
    );
    expect(apply({ type: "addAction", lane: "download" }).ok).toBe(true);
    expect(apply({ type: "setEntryLane", entry: "upload-api", lane: "download" }).ok).toBe(true);
    expect(run(workspace, "getDesign").actions).toEqual([
      {
        lane: "download",
        name: "Consume",
        entries: [{ id: "upload-api", tile: "api" }],
        tiles: ["api"],
      },
      { lane: "upload", name: "Produce", entries: [], tiles: [] },
    ]);
  });

  it("states the link table from the rules, and leaves the link mode optional", () => {
    // The instructions' table is generated from studioLinkRules, row by row.
    for (const rule of studioLinkRules) expect(INSTRUCTIONS).toContain(linkRuleText(rule));
    expect(studioLinkRules.map(linkRuleText)).toEqual(
      expect.arrayContaining([
        "Application -> queue: async (Publishes).",
        "External API -> application: sync or async, default sync (Calls).",
        "User -> action: sync.",
        "Action -> CDN: sync (a lane entry).",
      ]),
    );
    expect(INSTRUCTIONS).not.toMatch(/User -> (object-store|external|service)/);
    // So is the warnings sentence, from the spec's warning list.
    expect(INSTRUCTIONS).toContain(studioWarningSentence);

    // Without a link (the schema leaves it optional), each link takes its pair's default.
    const workspace = new Workspace(tinyurl());
    const result = run(workspace, "applyStudioCommands", {
      baseRevision: 3,
      commands: [
        {
          type: "addTile",
          from: { tile: "shorten" },
          side: "after",
          tile: { id: "link-events", name: "Link events", kind: "queue" },
          linkId: "shorten-link-events",
        },
        {
          type: "linkTiles",
          from: { tile: "link-events" },
          to: "analytics",
          linkId: "link-events-analytics",
        },
      ],
    });
    expect(result).toMatchObject({ ok: true, findings: [] });
    const planned = (id: string) =>
      workspace.working.connections.find((item) => item.id === id)?.planned;
    expect(planned("shorten-link-events")).toMatchObject({
      label: "Publishes",
      interaction: "Asynchronous",
    });
    expect(planned("link-events-analytics")).toMatchObject({
      label: "Consumes",
      interaction: "Asynchronous",
    });
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
