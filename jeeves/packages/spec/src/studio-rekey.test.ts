import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema, emptyDesign } from "./design.ts";
import { v2Diff, v2DiffReport } from "./fixtures/v2-diff.ts";
import {
  frozenV2Design,
  runStudioCommand,
  runStudioCommands,
  v2ModuleDesign,
  v2Modules,
  v2TileCommands,
} from "./fixtures/v2-modules.ts";
import { designGeneration } from "./generation.ts";
import { designOwnership } from "./ownership.ts";
import { studioArchitectureExample, studioArchitectureExamples } from "./studio-examples/index.ts";
import { newLinkId, newTileIdentity } from "./studio-lane-commands.ts";
import type { StudioKind } from "./studio-model.ts";
import { newModuleIdentity } from "./studio-modules.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";
import {
  idsPinned,
  moduleIdFollows,
  planRename,
  rekeyDesign,
  rekeyLeftovers,
  renamedIds,
  renameRefusal,
  tileIdFollows,
} from "./studio-rekey.ts";

const studioOf = (design: DesignDocument) => {
  const studio = design.architecture?.studio;
  if (!studio) throw new Error("No studio model.");
  return studio;
};
const tileIds = (design: DesignDocument) => design.elements.map((item) => item.id);
const moduleIds = (design: DesignDocument) =>
  (studioOf(design).components ?? []).map((item) => item.id);
/** Builds a command, applies its batch as one revision, and returns both. */
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  const result = applyOperations(design, batch.ops, { baseRevision: design.revision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  expect(result.design.revision).toBe(design.revision + 1);
  return { batch, design: result.design };
}
/** A new tile as the link fan adds one: the kind's name and ID, and `source-target` for its link. */
function addTile(design: DesignDocument, from: string, kind: StudioKind) {
  const tile = newTileIdentity(design, kind);
  const source: { lane: "upload" | "download" } | { tile: string } =
    from === "upload" || from === "download" ? { lane: from } : { tile: from };
  return runStudioCommand(design, {
    type: "addTile",
    from: source,
    side: "after",
    tile: { ...tile, kind },
    linkId: newLinkId(design, source, tile.id),
    ...(!design.architecture && { system: { name: "Video" } }),
  });
}

/**
 * Blank → Upload lane → Microservice (a lane entry) with a Cache and a Database; a positive cache
 * read from its Cache reader, Data access and loader, so a template, an owner and grants derive;
 * then a Message channel and a Worker service with an Event consumer, a Data access and a module
 * whose ID was chosen by hand.
 */
function mouseDesign() {
  let design = addTile(emptyDesign(), "upload", "service");
  design = addTile(design, "microservice", "cache");
  design = addTile(design, "microservice", "database");
  design = runStudioCommands(design, [
    { type: "addModule", host: "microservice", kind: "cache-reader" },
    { type: "addModule", host: "microservice", kind: "data-access" },
    {
      type: "connectModule",
      module: "microservice-cache-reader",
      slot: "cache",
      target: { tile: "cache" },
    },
    {
      type: "connectModule",
      module: "microservice-data-access",
      slot: "database",
      target: { tile: "database" },
    },
    {
      type: "connectModule",
      module: "microservice-cache-reader",
      slot: "loader",
      target: { module: "microservice-data-access" },
    },
  ]);
  design = addTile(design, "microservice", "queue");
  design = addTile(design, "message-channel", "worker");
  return runStudioCommands(design, [
    { type: "addModule", host: "worker-service", kind: "event-consumer" },
    { type: "addModule", host: "worker-service", kind: "data-access" },
    { type: "addModule", host: "worker-service", kind: "custom", id: "hand-chosen" },
    {
      type: "connectModule",
      module: "worker-service-event-consumer",
      slot: "channel",
      target: { tile: "message-channel" },
    },
  ]);
}

/** Every link, module link and entry ID replaced by its ends, so designs compare without them. */
function withoutLinkIds(design: DesignDocument): unknown {
  const studio = studioOf(design);
  const names = new Map<string, string>([
    ...design.connections.map(
      (item) => [item.id, `link:${item.from.element}>${item.to.element}`] as const,
    ),
    ...(studio.componentConnections ?? []).map(
      (item) => [item.id, `module-link:${item.from}>${item.to.id}`] as const,
    ),
    ...(studio.entries ?? []).map(
      (item) => [item.id, `entry:${item.lane}>${item.element}`] as const,
    ),
  ]);
  return JSON.parse(
    JSON.stringify({ ...design, revision: 0 }, (_key, value) =>
      typeof value === "string" ? (names.get(value) ?? value) : value,
    ),
  );
}

describe("IDs follow names", () => {
  it("re-keys a renamed tile and its following modules, with every reference, in one batch", () => {
    const before = mouseDesign();
    const { batch, design } = run(before, {
      type: "edit",
      element: "worker-service",
      name: "Video lifecycle worker",
    });
    expect(renamedIds(batch.ops)).toEqual([
      { from: "worker-service", to: "video-lifecycle-worker" },
      { from: "worker-service-event-consumer", to: "video-lifecycle-worker-event-consumer" },
      { from: "worker-service-data-access", to: "video-lifecycle-worker-data-access" },
    ]);
    expect(tileIds(design)).toEqual([
      "microservice",
      "cache",
      "database",
      "message-channel",
      "video-lifecycle-worker",
    ]);
    const studio = studioOf(design);
    // The hand-chosen ID stays; its host follows.
    expect(studio.components?.map((item) => [item.id, item.host])).toEqual([
      ["microservice-cache-reader", "microservice"],
      ["microservice-data-access", "microservice"],
      ["video-lifecycle-worker-event-consumer", "video-lifecycle-worker"],
      ["video-lifecycle-worker-data-access", "video-lifecycle-worker"],
      ["hand-chosen", "video-lifecycle-worker"],
    ]);
    // Links keep their IDs and follow their ends.
    expect(design.connections.map((item) => [item.id, item.from.element, item.to.element])).toEqual(
      before.connections.map((item) => [
        item.id,
        item.from.element,
        item.to.element === "worker-service" ? "video-lifecycle-worker" : item.to.element,
      ]),
    );
    expect(studio.componentConnections?.at(-1)).toEqual({
      id: "worker-service-event-consumer-message-channel",
      from: "video-lifecycle-worker-event-consumer",
      to: { kind: "element", id: "message-channel", via: "message-channel-worker-service" },
    });
    // The stubs' selections follow the module IDs, in one revision with the name.
    expect(designGeneration(design)?.selections.map((item) => item.id)).toEqual([
      "microservice-cache-reader",
      "video-lifecycle-worker-event-consumer",
      "video-lifecycle-worker-data-access",
      "hand-chosen",
    ]);
    expect(rekeyLeftovers(design, ["worker-service", "worker-service-event-consumer"])).toEqual([]);
  });

  it("re-keys ownership and its owner when a template's tile is renamed, then a module", () => {
    const before = mouseDesign();
    expect(designOwnership(before).owners).toEqual([
      { id: "microservice-owner", name: "Microservice" },
    ]);
    let { design } = run(before, { type: "edit", element: "microservice", name: "Watch API" });
    design = run(design, { type: "edit", element: "cache", name: "Metadata cache" }).design;
    const ownership = designOwnership(design);
    expect(ownership.owners).toEqual([{ id: "watch-api-owner", name: "Watch API" }]);
    expect(ownership.roles).toEqual([
      { element: "watch-api", owner: "watch-api-owner", kind: "api" },
    ]);
    expect(ownership.grants.map((item) => `${item.role}/${item.resource}`)).toEqual([
      "watch-api/database",
      "watch-api/metadata-cache",
    ]);
    expect(studioOf(design).entries?.map((item) => item.element)).toEqual(["watch-api"]);
    const reader = designGeneration(design)?.selections[0];
    expect(reader).toMatchObject({
      id: "watch-api-cache-reader",
      target: { kind: "component", component: "watch-api-cache-reader", host: "watch-api" },
      binding: { kind: "positive-cache-read", cache: { resource: "metadata-cache" } },
    });
    // A module's own rename: its selection, its loader link and its status follow.
    design = run(design, {
      type: "editComponent",
      component: "watch-api-data-access",
      name: "Details reader",
    }).design;
    expect(moduleIds(design)).toContain("watch-api-details-reader");
    expect(studioOf(design).componentConnections).toContainEqual(
      expect.objectContaining({
        from: "watch-api-cache-reader",
        to: { kind: "component", id: "watch-api-details-reader" },
      }),
    );
    expect(rekeyLeftovers(design, ["microservice", "cache", "watch-api-data-access"])).toEqual([]);
  });

  it("equals the design built with the final IDs from the start, links aside", () => {
    let renamed = mouseDesign();
    for (const [element, name] of [
      ["microservice", "Watch API"],
      ["cache", "Metadata cache"],
      ["database", "Metadata database"],
      ["message-channel", "View events"],
      ["worker-service", "View counter"],
    ] as const)
      renamed = runStudioCommand(renamed, { type: "edit", element, name });
    renamed = runStudioCommand(renamed, {
      type: "editComponent",
      component: "view-counter-data-access",
      name: "Count writer",
    });
    const tile = (from: string, id: string, name: string, kind: StudioKind): StudioCommand => ({
      type: "addTile",
      from: from === "upload" ? { lane: "upload" } : { tile: from },
      side: "after",
      tile: { id, name, kind },
      linkId: `${from}-${id}`,
      ...(from === "upload" && { system: { name: "Video" } }),
    });
    const fresh = runStudioCommands(emptyDesign(), [
      tile("upload", "watch-api", "Watch API", "service"),
      tile("watch-api", "metadata-cache", "Metadata cache", "cache"),
      tile("watch-api", "metadata-database", "Metadata database", "database"),
      { type: "addModule", host: "watch-api", kind: "cache-reader" },
      { type: "addModule", host: "watch-api", kind: "data-access" },
      {
        type: "connectModule",
        module: "watch-api-cache-reader",
        slot: "cache",
        target: { tile: "metadata-cache" },
      },
      {
        type: "connectModule",
        module: "watch-api-data-access",
        slot: "database",
        target: { tile: "metadata-database" },
      },
      {
        type: "connectModule",
        module: "watch-api-cache-reader",
        slot: "loader",
        target: { module: "watch-api-data-access" },
      },
      tile("watch-api", "view-events", "View events", "queue"),
      tile("view-events", "view-counter", "View counter", "worker"),
      { type: "addModule", host: "view-counter", kind: "event-consumer" },
      { type: "addModule", host: "view-counter", kind: "data-access", name: "Count writer" },
      { type: "addModule", host: "view-counter", kind: "custom", id: "hand-chosen" },
      {
        type: "connectModule",
        module: "view-counter-event-consumer",
        slot: "channel",
        target: { tile: "view-events" },
      },
    ]);
    expect(moduleIds(fresh)).toEqual(moduleIds(renamed));
    expect(withoutLinkIds(renamed)).toEqual(withoutLinkIds(fresh));
  });

  it("rebuilds v2 renaming as it goes: equal to v2 built with the final IDs, and the v2 diff passes", () => {
    // As the mouse does: each tile and module starts with its kind's name and ID and is renamed
    // to v2's name at once; links take `source-target` from the IDs of the moment.
    const final = new Map<string, string>();
    const at = (id: string) => final.get(id) ?? id;
    const fixed: StudioCommand[] = [];
    let design = emptyDesign();
    for (const command of v2TileCommands) {
      if (command.type === "addTile") {
        const from = "lane" in command.from ? command.from : { tile: at(command.from.tile) };
        const created = newTileIdentity(design, command.tile.kind);
        const linkId = newLinkId(design, from, created.id);
        design = runStudioCommand(design, {
          ...command,
          from,
          tile: { ...created, kind: command.tile.kind },
          linkId,
        });
        const { batch, design: next } = run(design, {
          type: "edit",
          element: created.id,
          name: command.tile.name,
        });
        design = next;
        final.set(command.tile.id, renamedIds(batch.ops)[0]?.to ?? created.id);
        fixed.push({
          ...command,
          from,
          tile: { ...command.tile, id: at(command.tile.id) },
          linkId,
        });
      } else if (command.type === "linkTiles" && "tile" in command.from) {
        const from = { tile: at(command.from.tile) };
        const linkId = newLinkId(design, from, at(command.to));
        const linked = { ...command, from, to: at(command.to), linkId };
        design = runStudioCommand(design, linked);
        fixed.push(linked);
      } else {
        design = runStudioCommand(design, command);
        fixed.push(command);
      }
    }
    for (const command of v2Modules) {
      if (command.type === "addModule") {
        const host = at(command.host);
        const created = newModuleIdentity(design, host, command.kind);
        design = runStudioCommand(design, { type: "addModule", host, kind: command.kind });
        const { batch, design: next } = run(design, {
          type: "editComponent",
          component: created.id,
          name: command.name ?? created.name,
        });
        design = next;
        if (command.id) final.set(command.id, renamedIds(batch.ops)[0]?.to ?? created.id);
        fixed.push({ ...command, host, ...(command.id && { id: at(command.id) }) });
      } else if (command.type === "connectModule") {
        const connected: StudioCommand = {
          ...command,
          module: at(command.module),
          target:
            "tile" in command.target
              ? { tile: at(command.target.tile) }
              : { module: at(command.target.module) },
        };
        design = runStudioCommand(design, connected);
        fixed.push(connected);
      }
    }
    // Every ID follows its name: `watch-api`, `watch-api-details-cache`…
    expect(final.get("watch")).toBe("watch-api");
    expect(final.get("watch-cache-reader")).toBe("watch-api-details-cache");
    expect(final.get("completion-handler")).toBe("video-lifecycle-worker");
    expect(tileIds(design)).toEqual(tileIds(v2ModuleDesign()).map(at));
    const built = runStudioCommands(emptyDesign(), fixed);
    expect({ ...design, revision: 0 }).toEqual({ ...built, revision: 0 });
    // Compared by name, the rebuild is the command-built twin's (its v2 diff test).
    const report = v2DiffReport(v2Diff(frozenV2Design(), design));
    const twin = v2DiffReport(v2Diff(frozenV2Design(), v2ModuleDesign()));
    expect(report.unexpected).toEqual(twin.unexpected);
    expect(report.unexpected).toHaveLength(14);
    expect(report.unused.map((rule) => rule.area)).toEqual(["module name"]);
  });

  it("updates every kind of reference, exactly where the completeness walk finds them", () => {
    const studies = studioArchitectureExamples.map(
      (item) => [item.id, studioArchitectureExample(item.id).design] as const,
    );
    const designs: (readonly [string, DesignDocument])[] = [
      ...studies,
      ["frozen v2", frozenV2Design()],
      ["v2 modules", v2ModuleDesign()],
      ["mouse", mouseDesign()],
      ["the rest", otherReferences()],
    ];
    const shapes = new Set<string>();
    for (const [name, design] of designs)
      for (const id of [...tileIds(design), ...moduleIds(design)]) {
        const to = `re-${id}`.slice(0, 63).replace(/-+$/, "");
        const paths = rekeyLeftovers(design, [id]);
        const after = structuredClone(design);
        rekeyDesign(after, id, to);
        expect(rekeyLeftovers(after, [id]), `${name}: ${id}`).toEqual([]);
        expect(changedPaths(design, after), `${name}: ${id}`).toEqual(paths);
        for (const path of paths) expect(valueAt(after, path)).toBe(to);
        for (const path of paths) shapes.add(path.replace(/\.\d+/g, ".*"));
        if (name === "the rest") continue;
        // The operation does the same, and the result validates as the original did.
        const result = applyOperations(design, [{ op: "rekey", from: id, to }]);
        if (!result.ok) throw new Error(`${name}: ${id}: ${JSON.stringify(result.errors)}`);
        expect({ ...result.design, revision: 0 }).toEqual({ ...after, revision: 0 });
      }
    expect([...shapes].sort()).toEqual(
      [
        "elements.*.id",
        "connections.*.from.element",
        "connections.*.to.element",
        "architecture.nodes.*.container",
        "architecture.relationships.*.container",
        "architecture.studio.elements.*.element",
        "architecture.studio.elements.*.owner.id",
        "architecture.studio.elements.*.settings.origin",
        "architecture.studio.elements.*.settings.servedBy",
        "architecture.studio.packages.*.members.*",
        "architecture.studio.entries.*.element",
        "architecture.studio.components.*.id",
        "architecture.studio.components.*.host",
        "architecture.studio.components.*.settings.deadLetterQueue",
        "architecture.studio.componentConnections.*.from",
        "architecture.studio.componentConnections.*.to.id",
        "scope.customRequirements.*.element",
        "ownership.roles.*.element",
        "ownership.resources.*.element",
        "ownership.resources.*.source",
        "ownership.grants.*.role",
        "ownership.grants.*.resource",
        "operations.receivers.*.role",
        "operations.calls.*.caller.element",
        "operations.calls.*.caller.role",
        "operations.calls.*.receiverRole",
        "generation.selections.*.id",
        "generation.selections.*.target.element",
        "generation.selections.*.target.component",
        "generation.selections.*.target.host",
        "generation.selections.*.binding.upload",
        "generation.selections.*.binding.identity.element",
        "generation.selections.*.binding.identity.guard",
        ...[
          "cache",
          "counts",
          "events",
          "index",
          "jobs",
          "objects",
          "originals",
          "outputs",
          "publication",
          "results",
          "source",
          "state",
        ].map((field) => `generation.selections.*.binding.${field}.resource`),
      ].sort(),
    );
  });

  it("walks past free text, vocabularies and other IDs, and finds a reference it missed", () => {
    const design = mouseDesign();
    // A tile ID may equal a kind (`cache`), a name or a description; neither is a reference.
    const studio = studioOf(design);
    const element = design.elements.find((item) => item.id === "cache");
    if (!element || design.schemaVersion !== 3) throw new Error("The mouse design has a cache");
    element.description = "cache";
    design.ownership = {
      ...designOwnership(design),
      owners: [...designOwnership(design).owners, { id: "cache", name: "cache" }],
    };
    expect(studio.elements.find((item) => item.element === "cache")?.settings.kind).toBe("cache");
    expect(rekeyLeftovers(design, ["cache"]).length).toBeGreaterThan(0);
    rekeyDesign(design, "cache", "metadata-cache");
    expect(rekeyLeftovers(design, ["cache"])).toEqual([]);
    // A missed reference: a context relationship's end, which no tile may be.
    design.architecture?.relationships.push({
      id: "context-cache",
      from: "system",
      to: "metadata-cache",
      description: "Reads it",
    });
    expect(rekeyLeftovers(design, ["metadata-cache"])).toContain("architecture.relationships.0.to");
  });

  it("refuses a rename that can't update every use of the old ID", () => {
    const design = mouseDesign();
    design.architecture?.relationships.push({
      id: "context-worker",
      from: "system",
      to: "worker-service",
      description: "Runs it",
    });
    expect(() =>
      buildStudioCommand(design, { type: "edit", element: "worker-service", name: "Video worker" }),
    ).toThrow(
      "Renaming can't update every use of its old ID (architecture.relationships.0.to), so nothing was changed.",
    );
  });

  it("refuses a clash in plain words: a tile's, a link's, a cascaded module's and a module's", () => {
    let design = addTile(mouseDesign(), "message-channel", "worker");
    expect(tileIds(design).at(-1)).toBe("worker-service-2");
    const refusal = (command: StudioCommand) => () => buildStudioCommand(design, command);
    expect(refusal({ type: "edit", element: "worker-service-2", name: "Worker service" })).toThrow(
      "Worker service would take the ID worker-service, which Worker service already uses. Choose another name.",
    );
    expect(
      renameRefusal(design, { element: "worker-service-2" }, "Message channel worker service"),
    ).toBe(
      "Message channel worker service would take the ID message-channel-worker-service, which a link already uses. Choose another name.",
    );
    design = runStudioCommand(design, {
      type: "edit",
      element: "worker-service-2",
      name: "Video data access",
    });
    expect(tileIds(design).at(-1)).toBe("video-data-access");
    expect(refusal({ type: "edit", element: "worker-service", name: "Video" })).toThrow(
      "Data access in Video would take the ID video-data-access, which Video data access already uses. Choose another name.",
    );
    design = runStudioCommand(design, {
      type: "addModule",
      host: "worker-service",
      kind: "data-access",
    });
    expect(moduleIds(design)).toContain("worker-service-data-access-2");
    expect(
      refusal({
        type: "editComponent",
        component: "worker-service-data-access-2",
        name: "Data access",
      }),
    ).toThrow(
      "Data access would take the ID worker-service-data-access, which Data access in Worker service already uses. Choose another name.",
    );
    // No clash, no refusal; the rename is free again once the other moved away.
    expect(renameRefusal(design, { element: "worker-service" }, "Video worker")).toBeUndefined();
  });

  it("keeps every ID in pinned designs and for IDs that don't follow; only the name changes", () => {
    const pinned: (readonly [string, DesignDocument])[] = [
      ...studioArchitectureExamples.map(
        (item) => [item.id, studioArchitectureExample(item.id).design] as const,
      ),
      ["frozen v2", frozenV2Design()],
    ];
    // Without its origin, frozen v2 is still pinned by its tile-level selections or its preset.
    const selections = frozenV2Design();
    delete studioOf(selections).origin;
    const generation = designGeneration(selections);
    if (!generation) throw new Error("v2 has a generation");
    pinned.push(["tile-level selections", structuredClone(selections)]);
    delete generation.preset;
    pinned.push(["tile-level selections only", structuredClone(selections)]);
    generation.selections = [];
    generation.preset = designGeneration(frozenV2Design())?.preset;
    pinned.push(["a preset", selections]);
    for (const [name, design] of pinned) {
      expect(idsPinned(design), name).toBe(true);
      // Many study IDs follow their names (`transcoder`); they are kept all the same.
      const tile = design.elements.find((item) => tileIdFollows(design, item.id));
      const module = studioOf(design).components?.find((item) => moduleIdFollows(design, item.id));
      if (!tile) throw new Error(`${name} has a following tile ID`);
      const edited = run(design, { type: "edit", element: tile.id, name: "Renamed tile" });
      expect(renamedIds(edited.batch.ops), name).toEqual([]);
      expect(tileIds(edited.design)).toEqual(tileIds(design));
      expect(edited.design.elements.find((item) => item.id === tile.id)?.name).toBe("Renamed tile");
      if (!module) continue;
      const renamed = run(design, {
        type: "editComponent",
        component: module.id,
        name: "Renamed module",
      });
      expect(renamedIds(renamed.batch.ops), name).toEqual([]);
      expect(moduleIds(renamed.design)).toEqual(moduleIds(design));
    }
    // v2's own IDs don't follow its names (`watch` is "Watch API"): the module design keeps them.
    const modules = v2ModuleDesign();
    expect(idsPinned(modules)).toBe(false);
    expect(planRename(modules, { element: "watch" }, "Watch service")).toEqual([]);
    expect(planRename(modules, { component: "watch-details" }, "Details")).toEqual([]);
    // Its IDs that do follow re-key: `transcoder` and its `transcoder-packager`.
    expect(planRename(modules, { element: "transcoder" }, "Video transcoder")).toEqual([
      { from: "transcoder", to: "video-transcoder" },
      { from: "transcoder-packager", to: "video-transcoder-packager" },
    ]);
  });

  it("keeps the ID for an unchanged name or slug and a name that is no ID, and cuts a long one", () => {
    const design = mouseDesign();
    const plan = (name: string) => planRename(design, { element: "worker-service" }, name);
    expect(plan("Worker service")).toEqual([]);
    expect(plan("worker  SERVICE")).toEqual([]);
    expect(plan("2nd worker")).toEqual([]);
    expect(plan("!!!")).toEqual([]);
    expect(planRename(design, { component: "worker-service-data-access" }, "???")).toEqual([]);
    // A name that is no ID still renames the tile; its ID stays.
    const renamed = run(design, { type: "edit", element: "worker-service", name: "2nd worker" });
    expect(tileIds(renamed.design)).toEqual(tileIds(design));
    // Kept IDs still follow their creation form, so a later rename re-keys them.
    expect(planRename(renamed.design, { element: "worker-service" }, "Second worker")[0]).toEqual({
      from: "worker-service",
      to: "second-worker",
    });
    // A long name is cut like `freshId`: 63 characters, never ending in a hyphen.
    const long = `${"Very long cache name ".repeat(5)}end`;
    const cut = (name: string) => planRename(design, { element: "cache" }, name)[0]?.to;
    expect(cut(long)).toBe("very-long-cache-name-very-long-cache-name-very-long-cache-name");
    expect(cut(`${"a".repeat(62)} b`)).toBe("a".repeat(62));
    // A tile cut to 63 characters leaves its modules no room for their own IDs: refused.
    expect(() => plan(long)).toThrow(/would take the ID very-long-cache-name/);
  });

  it("refuses a rekey operation for an unknown ID or one in use", () => {
    const design = mouseDesign();
    expect(applyOperations(design, [{ op: "rekey", from: "missing", to: "free" }])).toMatchObject({
      ok: false,
      errors: [{ code: "UNKNOWN_REFERENCE" }],
    });
    expect(
      applyOperations(design, [{ op: "rekey", from: "worker-service", to: "cache" }]),
    ).toMatchObject({ ok: false, errors: [{ code: "DUPLICATE_ID" }] });
  });
});

/** The reference kinds no study holds: C1 bindings, a group, a dead-letter queue, a bundled
 * browser, a custom requirement and a connection caller. It needs to parse, not to validate. */
function otherReferences(): DesignDocument {
  const design = mouseDesign();
  if (design.schemaVersion !== 3) throw new Error("The mouse design is schema 3");
  const architecture = design.architecture;
  if (!architecture?.studio) throw new Error("The mouse design has a studio");
  architecture.nodes.push({
    id: "partner",
    kind: "external-system",
    name: "Partner",
    description: "",
    container: "database",
  });
  architecture.relationships.push({
    id: "partner-calls",
    from: "partner",
    to: "system",
    description: "Calls it",
    container: "microservice",
  });
  architecture.studio.packages.push({
    id: "core",
    name: "Core",
    description: "",
    members: ["microservice", "worker-service"],
  });
  const consumer = architecture.studio.components?.find(
    (item) => item.id === "worker-service-event-consumer",
  );
  if (consumer?.settings.kind === "event-consumer")
    consumer.settings.deadLetterQueue = "message-channel";
  design.elements.push({ id: "app", name: "App" });
  architecture.studio.elements.push({
    element: "app",
    definition: { id: "studio-browser", version: "1.0.0" },
    settings: { kind: "browser", delivery: "bundled", servedBy: "microservice" },
  });
  design.scope.customRequirements.push({
    id: "audit",
    requirement: "Audit each change",
    criticality: "required",
    element: "worker-service",
  });
  const link = design.connections[1]?.id ?? "";
  design.operations = {
    receivers: [],
    calls: [
      {
        id: "call",
        caller: { kind: "connection", connection: link, role: "microservice" },
        receiverBinding: "receiver",
        receiverRole: "cache",
        expects: {
          operation: { id: "op", version: "1.0.0", sha256: "a".repeat(64) },
          request: { id: "request", version: "1.0.0", sha256: "a".repeat(64) },
          success: { id: "success", version: "1.0.0", sha256: "a".repeat(64) },
          errors: { id: "errors", version: "1.0.0", sha256: "a".repeat(64) },
          auth: "public",
          idempotency: "none",
          timeoutMs: 1000,
        },
      },
    ],
  };
  return designSchema.parse(design);
}

/** The paths where two designs' strings differ (their shapes are the same). */
function changedPaths(a: unknown, b: unknown, path: (string | number)[] = []): string[] {
  if (typeof a === "string" || typeof b === "string") return a === b ? [] : [path.join(".")];
  if (Array.isArray(a) && Array.isArray(b))
    return a.flatMap((item, index) => changedPaths(item, b[index], [...path, index]));
  if (a && b && typeof a === "object" && typeof b === "object")
    return Object.keys(a).flatMap((key) =>
      changedPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], [
        ...path,
        key,
      ]),
    );
  return [];
}
const valueAt = (value: unknown, path: string) =>
  path
    .split(".")
    .reduce<unknown>((object, key) => (object as Record<string, unknown>)?.[key], value);
