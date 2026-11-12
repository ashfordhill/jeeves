import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { testInstalledSupport as installed } from "./fixtures/installed-support.ts";
import { stubStackDesign } from "./fixtures/stub-stack.ts";
import { runStudioCommands } from "./fixtures/v2-modules.ts";
import { moduleStatus } from "./module-status.ts";
import {
  type DesignReviewCheck,
  type DesignReviewFinding,
  designReview,
} from "./studio-design-review.ts";
import { buildModulePattern, type ModulePattern } from "./studio-module-patterns.ts";
import type { StudioCommand } from "./studio-operations.ts";
import { buildSupportedAuthoringCommand } from "./supported-authoring.ts";

const pattern = (design: DesignDocument, ...steps: ModulePattern[]) =>
  steps.reduce((current, step) => buildModulePattern(current, step, installed).design, design);
const findings = (design: DesignDocument, check: DesignReviewCheck) =>
  designReview(design, installed).findings.filter((item) => item.check === check);
/** Runs a finding's fix commands as chat would send them. */
function fix(design: DesignDocument, finding: DesignReviewFinding | undefined) {
  expect(finding?.commands?.length).toBeGreaterThan(0);
  return (finding?.commands ?? []).reduce((current, command: StudioCommand) => {
    const batch = buildSupportedAuthoringCommand(current, command, installed);
    const result = applyOperations(current, batch.ops);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.design;
  }, design);
}
/** Edits the saved design directly, as an old or hand-made document could be. */
function edited(design: DesignDocument, change: (draft: DesignDocument) => void) {
  const draft = structuredClone(design);
  change(draft);
  return draft;
}
const service = (id: string, name: string, lane: "download" | "upload" = "download") =>
  ({
    type: "addTile",
    from: { lane },
    side: "after",
    tile: { id, name, kind: "service" },
    linkId: `${lane}-${id}`,
  }) satisfies StudioCommand;
const after = (from: string, id: string, name: string, kind: string) =>
  ({
    type: "addTile",
    from: { tile: from },
    side: "after",
    tile: { id, name, kind },
    linkId: `${from}-${id}`,
  }) as StudioCommand;
const module = (host: string, id: string, kind: string) =>
  ({ type: "addModule", host, id, kind }) as StudioCommand;
const connect = (id: string, slot: string, target: { tile: string } | { module: string }) =>
  ({ type: "connectModule", module: id, slot, target }) as StudioCommand;

describe("the design review chat runs after each change (V3-09)", () => {
  it("lists every module's status and names a lead that still needs something, with its fix", () => {
    const optional = pattern(emptyDesign(), {
      id: "sign-in",
      tile: "Account API",
      signIn: "optional",
    });
    // Favorites added by command beside the Optional guard stays a stub.
    const design = runStudioCommands(optional, [
      after("account-api", "favorites", "Favorites", "database"),
      module("account-api", "account-api-favorite-items", "favorites"),
      connect("account-api-favorite-items", "state", { tile: "favorites" }),
    ]);
    const review = designReview(design, installed);
    expect(review.modules.map((item) => [item.name, item.status])).toEqual([
      ["Viewer check", "template"],
      ["Favorites", "stub"],
    ]);
    const [needs] = findings(design, "module-status");
    expect(needs).toMatchObject({
      severity: "fix",
      module: "account-api-favorite-items",
      tile: "account-api",
      message:
        "Favorites in Account API is a Stub: Needs an Auth guard set to Required in Account API.",
      fix: "Set Viewer check's Sign-in to Required (an Optional guard lets anonymous callers in).",
    });
    expect(needs?.commands?.[0]).toMatchObject({
      type: "editComponent",
      component: "account-api-viewer-check",
    });
    expect(moduleStatus(fix(design, needs), "account-api-favorite-items")?.status).toBe("template");
  });

  it("names a Refused module with the saved value its template can't use", () => {
    const design = edited(pattern(emptyDesign(), { id: "cache-read" }), (draft) => {
      const link = draft.connections.find((item) => item.id === "watch-api-hot-metadata");
      if (link) link.planned.security = "Service identity";
    });
    expect(moduleStatus(design, "watch-api-video-details-cache")?.status).toBe("refused");
    const [refused] = findings(design, "module-status");
    expect(refused).toMatchObject({
      severity: "fix",
      module: "watch-api-video-details-cache",
      message: expect.stringContaining(
        "Video details cache in Watch API can't generate its template: The link from Watch API to Hot metadata uses Service identity",
      ),
    });
    // Its blocking finding isn't repeated as a generation finding.
    expect(
      findings(design, "generation").filter((item) => item.message.includes("Service identity")),
    ).toEqual([]);
  });

  it("names a needed slot left unconnected and connects it through the host's own link", () => {
    const design = runStudioCommands(pattern(emptyDesign(), { id: "cache-read" }), [
      module("watch-api", "watch-api-extra", "data-access"),
    ]);
    const [open] = findings(design, "unconnected-slot");
    expect(open).toMatchObject({
      severity: "fix",
      module: "watch-api-extra",
      message: "Data access in Watch API has nothing in its database slot: it needs a database.",
      fix: "Connect it to Metadata.",
      commands: [
        {
          type: "connectModule",
          module: "watch-api-extra",
          slot: "database",
          target: { tile: "metadata" },
        },
      ],
    });
    expect(findings(fix(design, open), "unconnected-slot")).toEqual([]);
    // An in-process slot with nothing to connect gets a new module for it.
    const lonely = runStudioCommands(emptyDesign(), [
      { ...service("api", "API"), system: { name: "Reads" } },
      after("api", "cache", "Cache", "cache"),
      module("api", "api-reader", "cache-reader"),
      connect("api-reader", "cache", { tile: "cache" }),
    ]);
    const [loader] = findings(lonely, "unconnected-slot");
    expect(loader?.commands?.map((item) => item.type)).toEqual(["addModule", "connectModule"]);
  });

  it("reports the resolver's generation findings, naming the tile", () => {
    const missing = {
      ...installed,
      templates: installed.templates.map((template) =>
        template.ref.id === "positive-cache-read"
          ? {
              ...template,
              consumers: template.consumers.filter((item) => item.input === "binding"),
            }
          : template,
      ),
    };
    const design = pattern(emptyDesign(), { id: "cache-read" });
    const generation = designReview(design, missing).findings.filter(
      (item) => item.check === "generation",
    );
    expect(generation[0]).toMatchObject({
      severity: "fix",
      tile: "watch-api",
      module: "watch-api-video-details-cache",
    });
    expect(generation[0]?.message).toMatch(
      /^Video details cache in Watch API: Installed template has no actual output consumer/,
    );
    expect(findings(design, "generation")).toEqual([]);
  });

  it("offers to clear a process's own out-of-range setting, which its control can reach (V3-18)", () => {
    // The stub stack's Links API runs only stubs, so its process consumes its limits itself.
    const valid = runStudioCommands(stubStackDesign(), [
      { type: "setRunnableProcesses", on: true },
    ]);
    const tile = valid.architecture?.studio?.elements.find((item) => item.element === "links-api");
    if (!tile) throw new Error("No Links API.");
    // An older saved revision with an out-of-range Request timeout, as V3-10 found.
    const design = edited(valid, (draft) => {
      const settings = draft.architecture?.studio?.elements.find(
        (item) => item.element === tile.element,
      )?.settings as Record<string, unknown>;
      settings.requestTimeoutMs = 99999999;
    });
    const [finding] = findings(design, "generation");
    expect(finding).toMatchObject({
      tile: tile.element,
      message: expect.stringContaining("Too big"),
      fix: "Clear it, and the process runs 1000; or set it from 1 to 300000.",
    });
    const fixed = fix(design, finding);
    expect(findings(fixed, "generation")).toEqual([]);
    expect(fixed.architecture?.studio?.elements).toEqual(valid.architecture?.studio?.elements);
  });

  it("finds a store with no writer: an ownerless one (fixed by choosing its owner) and one modules only read", () => {
    const ownerless = edited(
      runStudioCommands(emptyDesign(), [
        { ...service("api", "API"), system: { name: "Store" } },
        after("api", "records", "Records", "database"),
      ]),
      (draft) => {
        const row = draft.architecture?.studio?.elements.find((item) => item.element === "records");
        if (row) delete row.owner;
      },
    );
    const [store] = findings(ownerless, "store-without-writer");
    expect(store).toMatchObject({
      severity: "fix",
      tile: "records",
      fix: "Make API, its only user, its owner and writer.",
      commands: [{ type: "edit", element: "records", owner: { kind: "element", id: "api" } }],
    });
    expect(findings(fix(ownerless, store), "store-without-writer")).toEqual([]);
    // A search index only a Search query reads: search needs an indexer.
    const read = runStudioCommands(emptyDesign(), [
      { ...service("search-api", "Search API"), system: { name: "Find" } },
      after("search-api", "videos", "Videos", "search"),
      module("search-api", "search-api-query", "search-query"),
      connect("search-api-query", "index", { tile: "videos" }),
    ]);
    expect(findings(read, "store-without-writer")).toEqual([
      expect.objectContaining({
        tile: "videos",
        message: "Videos has no writer: Search query only reads it.",
        fix: "Add an Index writer in a worker fed by events that writes Videos (applyPattern search).",
      }),
    ]);
  });

  it("finds a worker writing stores for two concerns, and disconnects the second", () => {
    const design = runStudioCommands(emptyDesign(), [
      { ...service("api", "API", "upload"), system: { name: "Media" } },
      after("api", "jobs", "Jobs", "queue"),
      after("jobs", "processor", "Processor", "worker"),
      after("processor", "outputs", "Outputs", "database"),
      after("processor", "metadata", "Metadata", "database"),
      module("processor", "processor-jobs", "event-consumer"),
      connect("processor-jobs", "channel", { tile: "jobs" }),
      module("processor", "processor-output-writer", "data-access"),
      connect("processor-output-writer", "database", { tile: "outputs" }),
      module("processor", "processor-metadata-writer", "data-access"),
      connect("processor-metadata-writer", "database", { tile: "metadata" }),
    ]);
    const [worker] = findings(design, "unrelated-store");
    expect(worker).toMatchObject({
      severity: "check",
      tile: "processor",
      message:
        "Processor writes Outputs and Metadata: a worker that writes stores for more than one concern is hard to read and to generate.",
      fix: "Keep Processor writing Outputs, its own output; publish a completion event on a topic and let a worker after it write Metadata.",
      commands: [{ type: "disconnectModule", link: "processor-metadata-writer-metadata" }],
    });
    expect(findings(fix(design, worker), "unrelated-store")).toEqual([]);
  });

  it("finds the user reaching a store and removes the action's line when a service already reaches it", () => {
    const base = runStudioCommands(emptyDesign(), [
      { ...service("api", "API"), system: { name: "Files" } },
      after("api", "files", "Files", "object-store"),
    ]);
    const entry = (design: DesignDocument, element: string) =>
      edited(design, (draft) => {
        draft.architecture?.studio?.entries?.push({
          id: `download-${element}`,
          lane: "download",
          element,
        });
      });
    const design = entry(base, "files");
    const [reach] = findings(design, "user-reaches-store");
    expect(reach).toMatchObject({
      severity: "fix",
      tile: "files",
      link: "download-files",
      message: "The user reaches Files directly: a service checks every request before a store.",
      fix: "Remove the action's line to Files: API already reaches it.",
      commands: [{ type: "removeLink", link: "download-files" }],
    });
    expect(findings(fix(design, reach), "user-reaches-store")).toEqual([]);
    // A store only the action reaches can't lose its line by command: the fix says where to go.
    const only = entry(
      edited(base, (draft) => {
        draft.connections = draft.connections.filter((item) => item.id !== "api-files");
        if (draft.architecture?.studio)
          draft.architecture.studio.connections = draft.architecture.studio.connections.filter(
            (item) => item.connection !== "api-files",
          );
      }),
      "files",
    );
    const [alone] = findings(only, "user-reaches-store");
    expect(alone?.commands).toBeUndefined();
    expect(alone?.fix).toContain("fix it in Source & diagnostics");
  });

  it("flags a long line to a far store as advice, with no command", () => {
    const design = pattern(emptyDesign(), { id: "upload-pipeline", delivery: "Video delivery" });
    expect(findings(design, "long-line")).toEqual([
      {
        check: "long-line",
        severity: "check",
        tile: "metadata",
        message:
          "Upload API's line to Metadata crosses the board: Video lifecycle, at the end of a longer pipeline, uses it too.",
        fix: "The layout keeps Metadata beside its last user, so this line stays long. Check that Upload API belongs in its lane and reads Metadata directly; never add a tile just to shorten a line.",
      },
    ]);
  });

  it("flags a line whose style contradicts its channel, redraws it and keeps its module link", () => {
    // Metadata is also reached by the upload pipeline, so its line from Watch API can be redrawn.
    const base = pattern(
      emptyDesign(),
      { id: "upload-pipeline", delivery: "Video delivery" },
      { id: "cache-read" },
    );
    const dashed = (design: DesignDocument, id: string) =>
      edited(design, (draft) => {
        const link = draft.connections.find((item) => item.id === id);
        if (link) link.planned.interaction = "Asynchronous";
      });
    const design = dashed(base, "watch-api-metadata");
    const [style] = findings(design, "line-style");
    expect(style).toMatchObject({
      severity: "fix",
      link: "watch-api-metadata",
      message:
        "The line from Watch API to Metadata is dashed (async), but a link to a database is a direct call: the caller waits.",
      fix: "Remove the line and draw it again; the link table makes it solid.",
    });
    expect(style?.commands?.map((item) => item.type)).toEqual([
      "removeLink",
      "linkTiles",
      "connectModule",
    ]);
    const fixed = fix(design, style);
    expect(findings(fixed, "line-style")).toEqual([]);
    expect(moduleStatus(fixed, "watch-api-video-details-reader")?.status).toBe("template");
    // A line its store hangs off can't be removed first: the fix says where to change it.
    const [alone] = findings(dashed(base, "watch-api-hot-metadata"), "line-style");
    expect(alone?.commands).toBeUndefined();
    expect(alone?.fix).toBe(
      "Make it solid: removing it would cut Hot metadata off, and the lanes refuse new links while it is there, so fix its interaction in Source & diagnostics.",
    );
    // A dashed call between two applications is one the link table allows: accepted.
    const async = runStudioCommands(base, [
      {
        type: "addTile",
        from: { tile: "watch-api" },
        side: "after",
        link: "async",
        tile: { id: "recommend", name: "Recommendations", kind: "service" },
        linkId: "watch-api-recommend",
      },
    ]);
    expect(
      async.connections.find((item) => item.id === "watch-api-recommend")?.planned.interaction,
    ).toBe("Asynchronous");
    expect(findings(async, "line-style")).toEqual([]);
  });

  it("passes the design warnings on with what to do", () => {
    const design = runStudioCommands(emptyDesign(), [
      { ...service("api", "API"), system: { name: "Events" } },
      after("api", "events", "Events", "queue"),
    ]);
    expect(findings(design, "warning")).toEqual([
      {
        check: "warning",
        severity: "fix",
        tile: "events",
        message: "Events has no consumer: nothing takes its messages. Add a worker after it.",
        fix: "Nothing takes its messages. Add a worker after it.",
      },
    ]);
  });
});
