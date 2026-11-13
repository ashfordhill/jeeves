import {
  applyOperations,
  buildModulePattern,
  buildStudioCommand,
  buildSupportedAuthoringCommand,
  emptyDesign,
  linkFanOptions,
  modulePatternIds,
  newLinkId,
  newTileIdentity,
  type StudioCommand,
  studioArchitectureExample,
  studioLinkRules,
  studioWarningSentence,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  favoritesStackModuleCommands,
  favoritesStackTileCommands,
} from "../../../../packages/spec/src/fixtures/favorites-stack.ts";
import {
  signIn,
  signInStackCommands,
} from "../../../../packages/spec/src/fixtures/sign-in-stack.ts";
import { stubStackDesign } from "../../../../packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../../packages/spec/src/fixtures/v2-modules.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import {
  INSTRUCTIONS,
  isWorkspaceMutation,
  linkRuleText,
  toolDefinitions,
  turnContext,
  Workspace,
} from "./tools.ts";

const tinyurl = () => ({ ...studioArchitectureExample("studio-tinyurl").design, revision: 3 });
const description = (name: string) =>
  toolDefinitions().find((tool) => tool.name === name)?.description ?? "";
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
  it("names no strict-contract tool and keeps the retired declarations out of what chat reads", () => {
    const removed = [
      "configureDesignScope",
      "configureOwnership",
      "describeOperation",
      "configureOperations",
      "readReadiness",
    ];
    expect(toolDefinitions().filter((tool) => removed.includes(tool.name))).toEqual([]);
    // The foundation study declares a profile, ownership and operations.
    const design = {
      ...studioArchitectureExample("studio-tinyurl-foundation").design,
      revision: 3,
    };
    const summary = run(new Workspace(design), "getDesign");
    for (const key of ["readiness", "persistentScope", "declaredOperations", "declaredOwnership"])
      expect(summary).not.toHaveProperty(key);
    const review = run(new Workspace(design), "reviewDesign");
    for (const key of ["persistentScope", "operations", "ownership"])
      expect(review).not.toHaveProperty(key);
    const readiness = ["NEEDS_TEMPLATE", "CONFIG_REQUIRED", "ARCHITECTURE_UNBOUND"];
    const checked = run(new Workspace(design), "validateDesign");
    for (const findings of [summary.findings, review.findings, checked.findings])
      expect(findings.filter((item: { code: string }) => readiness.includes(item.code))).toEqual(
        [],
      );
    expect(checked.notSpecified).toMatch(/readiness findings? .*not design errors/);
    expect(turnContext(design, [], [])).not.toContain("Selected operation bindings");
  });
  it("offers exactly the finite studio toolset", () => {
    expect(toolDefinitions().map((t) => t.name)).toEqual([
      "listStudioDefinitions",
      "describeStudioDefinition",
      "listStudioPatterns",
      "describeStudioPattern",
      "getDesign",
      "applyStudioCommands",
      "applyPattern",
      "validateDesign",
      "declareReviewScope",
      "reviewDesign",
      "askUser",
    ]);
  });

  it("bounds pattern lookup and leaves the workspace unchanged", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    const listed = run(workspace, "listStudioPatterns");
    // The curated patterns applyPattern builds, and the four reviewed guidance records.
    expect(listed.patterns.map((item: { id: string }) => item.id)).toEqual(modulePatternIds);
    expect(listed.guidance.patterns).toHaveLength(4);
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
    // The kinds a new tile can be, as the canvas's link fan offers them.
    expect(catalog.linkFan).toEqual([
      { group: "application", kinds: ["service", "worker", "uploads", "identity"] },
      { group: "data", kinds: ["database", "search", "cache", "object-store"] },
      { group: "messaging", kinds: ["queue"] },
      { group: "edge", kinds: ["cdn", "external-api"] },
    ]);
    expect(catalog.caps).toEqual({ linksPerTile: 5, entriesPerLane: 4 });
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
    expect(redirect).toMatchObject({ type: "service", kind: "service" });
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
    // What the canvas sends for Redirect's link tab released on Cache (canvas/creation.tsx).
    const from = { tile: "redirect" };
    const option = linkFanOptions(base, from).find((o) => o.kind === "cache");
    expect(option).toEqual({ kind: "cache", group: "data" });
    const tile = newTileIdentity(base, "cache");
    const canvas = {
      type: "addTile" as const,
      from,
      side: "after" as const,
      tile: { ...tile, kind: "cache" as const },
      linkId: newLinkId(base, from, tile.id, [tile.id]),
    };
    expect(canvas).toEqual(addCache(3).commands[0]);
    const workspace = new Workspace(base);
    expect(run(workspace, "applyStudioCommands", addCache(3))).toMatchObject({ ok: true });
    expect(workspace.pending).toEqual(buildStudioCommand(base, canvas).ops);
  });

  it("adds a tile by its kind, as the link fan does, and inserts nothing before a tile", () => {
    const workspace = new Workspace(tinyurl());
    const add = (command: Record<string, unknown>) =>
      run(workspace, "applyStudioCommands", { baseRevision: 3, commands: [command] });
    // A Service after a queue stays a Service; a Worker is its own kind.
    const after = (id: string, kind: string) => ({
      type: "addTile",
      from: { tile: "click-events" },
      side: "after",
      tile: { id, name: id, kind },
      linkId: `click-events-${id}`,
    });
    expect(add(after("geo", "service")).ok).toBe(true);
    expect(add(after("indexer", "worker")).ok).toBe(true);
    const kinds = new Map(
      workspace.working.architecture?.studio?.elements.map((e) => [e.element, e.settings.kind]),
    );
    expect([kinds.get("geo"), kinds.get("indexer")]).toEqual(["service", "worker"]);
    const pending = workspace.pending.length;
    expect(add({ ...addCache(3).commands[0], side: "before" }).ok).toBe(false);
    expect(workspace.pending).toHaveLength(pending);
  });

  it("adds and connects modules with the canvas's commands and reads their status", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    const commands = [
      { type: "addModule", host: "shorten", kind: "rate-limiter", id: "shorten-limit" },
      { type: "addModule", host: "redirect", kind: "data-access", id: "redirect-urls" },
      {
        type: "connectModule",
        module: "redirect-urls",
        slot: "database",
        target: { tile: "url-db" },
      },
    ];
    expect(run(workspace, "applyStudioCommands", { baseRevision: 3, commands }).ok).toBe(true);
    // The same batches the mouse sends, one after another.
    let mouse = base;
    const ops = commands.flatMap((command) => {
      const batch = buildStudioCommand(mouse, command as StudioCommand);
      const result = applyOperations(mouse, batch.ops);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      mouse = result.design;
      return batch.ops;
    });
    expect(workspace.pending).toEqual(ops);
    const tiles = run(workspace, "getDesign").tiles as {
      id: string;
      modules?: { id: string; status?: string; reason?: string; unconnected?: string[] }[];
    }[];
    const shorten = tiles.find((tile) => tile.id === "shorten")?.modules;
    expect(shorten?.find((module) => module.id === "shorten-limit")).toMatchObject({
      status: "stub",
      reason: "Rate limiter has no template.",
      unconnected: ["store"],
    });
    // A kind its tile can't hold, and a slot it doesn't have, are refused in plain words.
    expect(
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [{ type: "addModule", host: "shorten", kind: "video-encoder" }],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining(
        "Video encoder can't go in Shorten service; it goes in a worker.",
      ),
    });
    const catalog = run(workspace, "listStudioDefinitions").modules as {
      kind: string;
      hosts: string[];
      generation: { kind: string };
    }[];
    expect(catalog).toHaveLength(19);
    expect(catalog.find((item) => item.kind === "video-encoder")).toMatchObject({
      hosts: ["worker"],
      as: { worker: "Template" },
      generation: { kind: "lead", template: "video-hls" },
      templateNames: ["Video encoding"],
    });
    // What a kind becomes depends on its tile, as the + menu groups it.
    expect(catalog.find((item) => item.kind === "cache-reader")).toMatchObject({
      as: { service: "Template", worker: "Stub" },
    });
  });

  it("sets an Auth guard's Sign-in with the module page's command, and reads it back", () => {
    const base = { ...runStudioCommands(emptyDesign(), signInStackCommands), revision: 3 };
    const workspace = new Workspace(base);
    const editable = (
      run(workspace, "getDesign").editableSettings as {
        input: string;
        selection: string;
        value: string;
        supported: unknown;
      }[]
    ).filter((item) => item.input === "guard.signIn");
    expect(editable.map((item) => [item.selection, item.value, item.supported])).toEqual([
      ["viewer-check", "required", { values: ["required", "optional"] }],
      ["creator-check", "required", { values: ["required", "optional"] }],
    ]);
    const command = signIn(base, "viewer-check", "optional");
    expect(run(workspace, "applyStudioCommands", { baseRevision: 3, commands: [command] }).ok).toBe(
      true,
    );
    // The same batch the module page sends.
    expect(workspace.pending).toEqual(
      buildSupportedAuthoringCommand(base, command, installedGenerationSupport()).ops,
    );
    const tiles = run(workspace, "getDesign").tiles as {
      id: string;
      modules?: { id: string; status?: string; settings?: { signIn?: string } }[];
    }[];
    const viewer = tiles.find((tile) => tile.id === "watch-api")?.modules?.[0];
    expect(viewer).toMatchObject({ id: "viewer-check", status: "template" });
    // Optional on the Creator check leaves Multipart uploads a stub, with the reason.
    expect(
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [signIn(base, "creator-check", "optional")],
      }).ok,
    ).toBe(true);
    const upload = (run(workspace, "getDesign").tiles as typeof tiles).find(
      (tile) => tile.id === "upload-api",
    )?.modules;
    expect(upload?.find((module) => module.id === "multipart-uploads")).toMatchObject({
      status: "stub",
      reason: "Needs an Auth guard set to Required in Upload API.",
    });
  });

  it("adds Favorites and connects its items with the canvas's commands; its status follows the guard", () => {
    const base = { ...runStudioCommands(emptyDesign(), favoritesStackTileCommands), revision: 3 };
    const workspace = new Workspace(base);
    const commands = favoritesStackModuleCommands;
    expect(run(workspace, "applyStudioCommands", { baseRevision: 3, commands }).ok).toBe(true);
    // The same batches the mouse sends: the + menu's addModule, the dots' and rows' connectModule.
    let mouse: typeof base = base;
    const ops = commands.flatMap((command) => {
      const batch = buildStudioCommand(mouse, command);
      const result = applyOperations(mouse, batch.ops);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      mouse = result.design;
      return batch.ops;
    });
    expect(workspace.pending).toEqual(ops);
    type Tiles = { id: string; modules?: { id: string; status?: string; reason?: string }[] }[];
    const account = () =>
      (run(workspace, "getDesign").tiles as Tiles).find((tile) => tile.id === "account-api")
        ?.modules;
    expect(account()?.map((module) => [module.id, module.status])).toEqual([
      ["account-check", "template"],
      ["favorite-items", "template"],
      ["item-reader", "template"],
      ["catalog-writer", "stub"],
    ]);
    // Its items are a Data access: chat is refused as the row drag is.
    expect(
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [
          {
            type: "connectModule",
            module: "favorite-items",
            slot: "items",
            target: { module: "account-check" },
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Favorite items' items must be a Data access in Account API."),
    });
    // Sign-in Optional, with the module page's command: Favorites waits for Required.
    const settings = { kind: "auth-guard", credential: "jwt", signIn: "optional" };
    expect(
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [{ type: "editComponent", component: "account-check", settings }],
      }).ok,
    ).toBe(true);
    expect(account()?.find((module) => module.id === "favorite-items")).toMatchObject({
      status: "stub",
      reason: "Needs an Auth guard set to Required in Account API.",
    });
    const catalog = run(workspace, "listStudioDefinitions").modules as {
      kind: string;
      description: string;
      hosts: string[];
      slots: { id: string; module?: string }[];
      generation: unknown;
    }[];
    expect(catalog.find((item) => item.kind === "favorites")).toMatchObject({
      description: "Keeps each signed-in account's favorite items.",
      hosts: ["service"],
      slots: [{ id: "state" }, { id: "items", module: "data-access" }],
      generation: { kind: "lead", template: "favorites" },
    });
  });

  it("turns Runnable processes on with the dialog's command, and refuses it on a study", () => {
    const study = new Workspace(tinyurl());
    expect(run(study, "getDesign").processes).toBe(false);
    expect(
      run(study, "applyStudioCommands", {
        baseRevision: 3,
        commands: [{ type: "setRunnableProcesses", on: true }],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Runnable processes needs a design built from modules."),
    });
    const workspace = new Workspace(emptyDesign());
    const commands = [
      { type: "addAction", lane: "download", name: "Visit", system: { name: "Links" } },
      {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        tile: { id: "api", name: "API", kind: "service" },
        linkId: "download-api",
      },
      { type: "addModule", host: "api", kind: "rate-limiter", name: "Limiter" },
      { type: "setRunnableProcesses", on: true },
    ];
    expect(run(workspace, "applyStudioCommands", { baseRevision: 0, commands }).ok).toBe(true);
    let mouse = emptyDesign();
    const ops = commands.flatMap((command) => {
      const batch = buildStudioCommand(mouse, command as StudioCommand);
      const result = applyOperations(mouse, batch.ops);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      mouse = result.design;
      return batch.ops;
    });
    expect(workspace.pending).toEqual(ops);
    expect(run(workspace, "getDesign").processes).toBe(true);
    expect(description("applyStudioCommands")).toContain("setRunnableProcesses {on: true|false}");
  });

  it("edits a stub tile's process limits with the Options form's command while processes are on (D5)", () => {
    const base = {
      ...runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
      revision: 3,
    };
    const workspace = new Workspace(base);
    const editable = (
      run(workspace, "getDesign").editableSettings as {
        input: string;
        process?: string;
        value: number;
      }[]
    ).filter((item) => item.process);
    expect(editable.map((item) => [item.process, item.input, item.value])).toEqual([
      ["links-api", "process.requestTimeoutMs", 1000],
      ["links-api", "process.concurrencyLimit", 1000],
      ["stats-api", "process.requestTimeoutMs", 1000],
      ["stats-api", "process.concurrencyLimit", 1000],
      ["upload-api", "process.requestTimeoutMs", 1000],
      ["upload-api", "process.concurrencyLimit", 1000],
      ["visit-worker", "process.concurrency", 1],
    ]);
    const settings = {
      ...base.architecture?.studio?.elements.find((item) => item.element === "links-api")?.settings,
      requestTimeoutMs: 250,
    };
    const command = { type: "edit", element: "links-api", settings } as StudioCommand;
    expect(run(workspace, "applyStudioCommands", { baseRevision: 3, commands: [command] }).ok).toBe(
      true,
    );
    // The same batch the tile's Options form sends.
    expect(workspace.pending).toEqual(
      buildSupportedAuthoringCommand(base, command, installedGenerationSupport()).ops,
    );
    // Off, the same edit has no control to reach.
    const off = new Workspace({ ...stubStackDesign(), revision: 3 });
    expect(run(off, "applyStudioCommands", { baseRevision: 3, commands: [command] })).toMatchObject(
      { ok: false },
    );
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
    // A stale baseRevision is ignored: a turn edits one working copy, and the commit checks for
    // a concurrent edit itself (V3-19).
    expect(run(new Workspace(workspace.base), "applyStudioCommands", addCache(2)).ok).toBe(true);
    expect(apply({ type: "addRoute", path: "/x" }).error).toMatch(/no "addRoute" command/);
    // The old island-making commands are gone; tiles hang off lanes.
    expect(apply({ type: "create", elements: [] }).error).toMatch(
      /no "create" command\. The commands are addAction, renameAction, removeAction, addTile, linkTiles/,
    );
    expect(apply({ type: "edit", element: "ghost", name: "Ghost" }).error).toContain(
      'There is no tile "ghost".',
    );
    // The second command would cut off the click path and the new cache; neither is kept.
    expect(apply(addCache(3).commands[0], { type: "removeTile", tile: "redirect" }).error).toBe(
      "Nothing changed: 1 command needs fixing. Command 2 (removeTile): Removing Redirect service would cut off Click events, URL cache, Cache and Analytics worker; list them in alsoRemove to remove them too. It takes removeTile {tile, alsoRemove?: [tile ids]}.",
    );
    const link = (from: string, to: string) =>
      apply({ type: "linkTiles", from: { tile: from }, to, link: "sync", linkId: `${from}-${to}` });
    expect(link("analytics", "redirect").error).toContain(
      "Redirect service already leads to Analytics worker; linking them would make a loop.",
    );
    expect(link("url-cache", "shorten").error).toContain(
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
      /This design has no system yet\. Start it with addAction/,
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
    // An action the lane already has is skipped as already there, not refused (V3-19).
    expect(apply({ type: "addAction", lane: "upload" })).toMatchObject({
      ok: true,
      commands: 0,
      skipped: [{ command: 1, why: "The upload lane already has its Publish action." }],
    });
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
    expect(apply(first).error).toMatch(/This design has no system yet\./);
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
    expect(apply({ type: "setEntryLane", entry: "upload-api", lane: "download" }).error).toContain(
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
    // The catalog's table is generated from studioLinkRules, row by row.
    const catalog = run(new Workspace(tinyurl()), "listStudioDefinitions");
    for (const rule of studioLinkRules) expect(catalog.linkRules).toContain(linkRuleText(rule));
    expect(studioLinkRules.map(linkRuleText)).toEqual(
      expect.arrayContaining([
        "Application -> queue: async (Publishes).",
        "External API -> service, redirect, identity, billing, uploads, gateway: sync (Calls).",
        "User -> action: sync.",
        "Action -> CDN: sync (a lane entry).",
      ]),
    );
    expect(catalog.linkRules.join(" ")).not.toMatch(/User -> (object-store|external|service)/);
    // So is the warnings sentence, from the spec's warning list.
    expect(catalog.warnings).toBe(studioWarningSentence);
    // The prompt stays short: the tools carry the knowledge.
    expect(INSTRUCTIONS.length).toBeLessThan(3000);
    expect(INSTRUCTIONS).toContain("plan, apply, review, fix");

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

  it("refuses a new tile of a legacy kind in plain words, as the link fan never offers one", () => {
    const workspace = new Workspace(tinyurl());
    const add = (kind: string) =>
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [
          {
            type: "addTile",
            from: { tile: "shorten" },
            side: "after",
            tile: { id: `new-${kind}`, name: kind, kind },
            linkId: `shorten-new-${kind}`,
          },
        ],
      });
    expect(add("billing")).toMatchObject({
      ok: false,
      error: expect.stringContaining(
        "A new tile can't be Billing: new tiles are the link fan's kinds (Microservice, Worker service, Uploads, Identity, Database, Search index, Cache, Object storage, Message channel, CDN, External API). Existing Billing tiles keep working. For payments, add a Service that owns its payment records and calls the provider as an External API.",
      ),
    });
    for (const kind of ["gateway", "redirect", "notification"])
      expect(add(kind)).toMatchObject({ ok: false, error: expect.stringContaining("can't be") });
    expect(workspace.pending).toEqual([]);
    // The fan never offers them either; existing Redirect tiles keep their modules.
    expect(linkFanOptions(tinyurl(), { tile: "shorten" }).map((item) => item.kind)).not.toContain(
      "billing",
    );
    expect(
      run(workspace, "applyStudioCommands", {
        baseRevision: 3,
        commands: [{ type: "addModule", host: "redirect", kind: "rate-limiter" }],
      }).ok,
    ).toBe(true);
    expect(run(workspace, "listStudioDefinitions").legacyKinds).toEqual([
      "billing",
      "redirect",
      "notification",
      "gateway",
    ]);
  });

  it("applies a pattern as one batch of the mouse's commands, with an automatic review", () => {
    const base = { ...emptyDesign(), revision: 2 };
    const workspace = new Workspace(base);
    const pattern = { id: "upload-pipeline", system: "Media", publication: "Publications" };
    const result = run(workspace, "applyPattern", { baseRevision: 2, pattern });
    expect(result).toMatchObject({ ok: true, pattern: "upload-pipeline", commands: 36 });
    // The patterns' defaults are neutral role names: a design's names come from its brief.
    expect(result.added.tiles.map((item: { name: string }) => item.name)).toEqual([
      "Ingest API",
      "Login",
      "Records",
      "Originals",
      "Jobs",
      "Processor",
      "Outputs",
      "Results",
      "Lifecycle",
      "Publications",
    ]);
    // The same commands, as the mouse would send them one by one.
    const { commands } = buildModulePattern(base, pattern as never, installedGenerationSupport());
    let mouse: typeof base = base;
    const ops = commands.flatMap((command) => {
      const batch = buildSupportedAuthoringCommand(mouse, command, installedGenerationSupport());
      const applied = applyOperations(mouse, batch.ops);
      if (!applied.ok) throw new Error(JSON.stringify(applied.errors));
      mouse = applied.design;
      return batch.ops;
    });
    expect(workspace.pending).toEqual(ops);
    expect(workspace.generation).toBe(1);
    // What is left comes back with the call: every module a template, and what to fix or check.
    expect(result.review.modules).toEqual({ template: 12 });
    expect(result.review.notTemplates).toEqual([]);
    expect(
      result.review.left.map((item: { check: string; tile?: string }) => [item.check, item.tile]),
    ).toEqual([
      ["warning", "outputs"],
      ["warning", "publications"],
      ["long-line", "records"],
    ]);
    // A refused pattern changes nothing and says why.
    const refused = run(workspace, "applyPattern", {
      baseRevision: 2,
      pattern: { id: "favorites", service: "Processor" },
    });
    expect(refused).toMatchObject({
      ok: false,
      error: expect.stringContaining(
        "Favorites: Processor is a worker; the account service must be a service. Nothing of the pattern was applied.",
      ),
    });
    expect(workspace.pending).toEqual(ops);
    // Applied again, nothing is added.
    expect(run(workspace, "applyPattern", { baseRevision: 2, pattern })).toMatchObject({
      ok: true,
      commands: 0,
    });
    expect(workspace.pending).toEqual(ops);
    // reviewDesign has every module's status and what is left.
    const review = run(workspace, "reviewDesign");
    expect(review.moduleStatuses).toHaveLength(12);
    expect(review.left).toEqual(result.review.left);
  });

  it("previews commands or a pattern without preparing or saving anything", () => {
    const base = tinyurl();
    const workspace = new Workspace(base);
    const before = {
      working: workspace.working,
      generation: workspace.generation,
      reviewed: workspace.reviewedGeneration,
    };
    const preview = run(workspace, "applyPattern", {
      preview: true,
      pattern: { id: "sign-in", tile: "Shorten service" },
    });
    expect(preview).toMatchObject({
      ok: true,
      preview: true,
      pattern: "sign-in",
      added: {
        tiles: [{ id: "login", name: "Login", kind: "identity" }],
        modules: [{ id: "shorten-auth-guard", name: "Auth guard", kind: "auth-guard" }],
      },
      note: expect.stringContaining("Preview only"),
    });
    expect(
      preview.statuses.find((item: { module: string }) => item.module === "shorten-auth-guard"),
    ).toMatchObject({ status: "template", template: "verified-identity" });
    const commands = run(workspace, "applyStudioCommands", {
      preview: true,
      commands: [{ type: "addModule", host: "shorten", kind: "data-access", id: "shorten-urls" }],
    });
    expect(commands.review.left).toContainEqual(
      expect.objectContaining({
        check: "unconnected-slot",
        module: "shorten-urls",
        commands: [
          {
            type: "connectModule",
            module: "shorten-urls",
            slot: "database",
            target: { tile: "url-db" },
          },
        ],
      }),
    );
    expect(workspace.working).toBe(before.working);
    expect(workspace.pending).toEqual([]);
    expect(workspace.generation).toBe(before.generation);
    expect(workspace.reviewedGeneration).toBe(before.reviewed);
    for (const [tool, args] of [
      ["applyStudioCommands", { preview: true }],
      ["applyStudioCommands", { preview: true, commands: [{ type: "editSystem", name: 3 }] }],
      ["applyPattern", { preview: true, pattern: { id: "search" } }],
    ] as const)
      expect(run(workspace, tool, args).ok).toBe(false);
    expect(workspace.pending).toEqual([]);
    expect(isWorkspaceMutation("applyStudioCommands", '{"preview":true}')).toBe(false);
    expect(isWorkspaceMutation("applyPattern", '{"preview":true,"pattern":{}}')).toBe(false);
    expect(isWorkspaceMutation("applyPattern", "{}")).toBe(true);
  });

  it("names every command to fix in a refused batch, with its shape, and keeps nothing (V3-19)", () => {
    const workspace = new Workspace(tinyurl());
    const refused = run(workspace, "applyStudioCommands", {
      commands: [
        { type: "editTile", tile: "url-db", name: "Links" },
        { type: "setOwner", element: "url-db", owner: "shorten" },
        { type: "addTile", from: { tile: "shorten" }, tile: { name: "Logs" } },
        "not a command",
      ],
    });
    expect(refused.ok).toBe(false);
    expect(refused.problems).toEqual([
      {
        command: 2,
        type: "setOwner",
        problem: 'There is no "setOwner" command; use editTile.',
        takes:
          "editTile {tile, name?, description?, owner?: tile id that writes this store, or null}",
      },
      {
        command: 3,
        type: "addTile",
        problem: expect.stringContaining("tile.kind"),
        takes: expect.stringContaining("addTile {from:"),
      },
      { command: 4, problem: expect.stringContaining("A command is an object with a type") },
    ]);
    expect(refused.error).toMatch(
      /^Nothing changed: 3 commands need fixing\. Command 2 \(setOwner\)/,
    );
    expect(refused.note).toContain("send the whole call again");
    expect(workspace.pending).toEqual([]);
    // Corrected, the same batch goes through, with IDs following the names.
    const accepted = run(workspace, "applyStudioCommands", {
      commands: [
        { type: "editTile", tile: "url-db", name: "Links" },
        { type: "addTile", from: { tile: "shorten" }, tile: { name: "Logs", kind: "database" } },
      ],
    });
    expect(accepted).toMatchObject({ ok: true, commands: 2 });
    expect(workspace.working.elements.map((item) => item.id)).toContain("logs");
    expect(workspace.working.connections.map((item) => item.id)).toContain("shorten-logs");
    // A setting is one setSetting, checked against the tile's own controls.
    const unknown = run(workspace, "applyStudioCommands", {
      commands: [{ type: "setSetting", tile: "logs", setting: "ttlSeconds", value: 5 }],
    });
    expect(unknown.problems[0].problem).toContain('Logs has no editable setting "ttlSeconds".');
    expect(isWorkspaceMutation("applyStudioCommands", "{}")).toBe(true);
    // A batch past the limit is refused in words, with what to do.
    const tooMany = run(workspace, "applyStudioCommands", {
      commands: Array.from({ length: 51 }, () => ({ type: "editSystem", name: "Links" })),
    });
    expect(tooMany.error).toBe(
      "One call takes at most 50 commands, and this one has 51. Split them into two applyStudioCommands calls in the same response: they run in order.",
    );
    // Refusals past the first are still found, each checked without the ones before it.
    const before = workspace.pending.length;
    const several = run(workspace, "applyStudioCommands", {
      commands: [
        { type: "linkTiles", from: { tile: "url-cache" }, to: "shorten" },
        { type: "addTile", from: { tile: "logs" }, tile: { name: "Log reader", kind: "service" } },
        { type: "editTile", tile: "ghost", name: "Ghost" },
        { type: "editSystem", name: "Links" },
      ],
    });
    expect(several.problems.map((item: { command: number }) => item.command)).toEqual([1, 2, 3]);
    expect(several.problems[1].problem).toContain(
      "(Checked without command 1; this may follow from it.)",
    );
    expect(workspace.pending).toHaveLength(before);
    // A command whose effect is already there is skipped, not refused: a resent batch goes through.
    const pending = workspace.pending.length;
    const resent = run(workspace, "applyStudioCommands", {
      commands: [
        { type: "addTile", from: { tile: "shorten" }, tile: { name: "Logs", kind: "database" } },
        { type: "linkTiles", from: { tile: "shorten" }, to: "logs" },
        { type: "editSystem", name: "Short links" },
      ],
    });
    expect(resent).toMatchObject({
      ok: true,
      commands: 1,
      skipped: [
        { command: 1, type: "addTile", why: "Logs (logs) is already there, linked from it." },
        { command: 2, type: "linkTiles", why: "shorten already links to logs." },
      ],
    });
    expect(workspace.pending.length).toBeGreaterThan(pending);
    // Readiness findings are a count with a note, not design errors to chase.
    const built = run(new Workspace(emptyDesign()), "applyPattern", {
      pattern: { id: "owned-store" },
    });
    expect(built.findings).toEqual([]);
    expect(built.notSpecified).toMatch(/readiness findings? .*not design errors/);
  });

  it("reads a compact design: each tile's label, its links and its modules' kinds, slots and status", () => {
    const workspace = new Workspace({
      ...runStudioCommands(emptyDesign(), signInStackCommands),
      revision: 3,
    });
    const design = run(workspace, "getDesign");
    const upload = design.tiles.find((tile: { id: string }) => tile.id === "upload-api");
    expect(upload).toMatchObject({ kind: "uploads", label: "Uploads" });
    expect(upload.links[0]).toEqual({
      id: "upload-api-sign-in",
      to: "sign-in",
      mode: "sync",
      label: "Calls",
    });
    expect(upload.modules[0]).toMatchObject({
      id: "creator-check",
      kind: "auth-guard",
      status: "template",
      template: "verified-identity",
      links: [{ id: "creator-check-sign-in", slot: "identity", to: { tile: "sign-in" } }],
    });
    expect(design.moduleStatuses).toEqual({ template: 7, stub: 1 });
    expect(design.tiles.find((tile: { id: string }) => tile.id === "upload-jobs").label).toBe(
      "Queue",
    );
    // Module-level selections read as statuses, not as raw declarations.
    expect(design.declaredGeneration).toBeUndefined();
    expect(design.editableSettings[0]).toMatchObject({
      input: "guard.signIn",
      module: "viewer-check",
      setting: "signIn",
      value: "required",
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
