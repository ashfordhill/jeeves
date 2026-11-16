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

describe("Label-stable runtime identities", () => {
  it("preserves every tile/module/link/selection and ownership identity across label-only edits", () => {
    const before = mouseDesign();
    const { batch, design } = run(before, {
      type: "edit",
      element: "worker-service",
      name: "Video lifecycle worker",
    });
    expect(renamedIds(batch.ops)).toEqual([]);
    expect(tileIds(design)).toEqual(tileIds(before));
    expect(studioOf(design)).toEqual(studioOf(before));
    expect(design.connections).toEqual(before.connections);
    expect(designGeneration(design)).toEqual(designGeneration(before));
    expect(designOwnership(design)).toEqual(designOwnership(before));
    expect(design.elements.find((item) => item.id === "worker-service")?.name).toBe(
      "Video lifecycle worker",
    );
    const next = run(design, {
      type: "editComponent",
      component: "worker-service-data-access",
      name: "State writer",
    });
    expect(renamedIds(next.batch.ops)).toEqual([]);
    expect(moduleIds(next.design)).toEqual(moduleIds(before));
    expect(studioOf(next.design).componentConnections).toEqual(
      studioOf(before).componentConnections,
    );
    expect(designGeneration(next.design)).toEqual(designGeneration(before));
    // Repeated owner tile labels preserve the logical owner and permissions too.
    const api = run(before, { type: "edit", element: "microservice", name: "Watch API" }).design;
    expect(designOwnership(api)).toEqual(designOwnership(before));
  });

  it("rebuilds v2 with stable creation IDs and matches the design built with those IDs", () => {
    // As the mouse does: IDs start at creation and remain stable as labels change.
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
    // Every ID preserves its creation identity after labels change.
    expect(final.get("watch")).toBe("microservice");
    expect(final.get("watch-cache-reader")).toBe("microservice-cache-reader");
    expect(final.get("completion-handler")).toBe("worker-service-3");
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
      ["TinyURL foundation", studioArchitectureExample("studio-tinyurl-foundation").design],
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
        // Authoring refuses the explicit identity operation; direct helper remains import tooling.
        const result = applyOperations(design, [{ op: "rekey", from: id, to }]);
        expect(result).toMatchObject({
          ok: false,
          errors: [{ code: "INVALID_OPERATION", message: expect.stringContaining("migration") }],
        });
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

  it("allows duplicate display labels and keeps context references intact", () => {
    const before = mouseDesign();
    before.architecture?.relationships.push({
      id: "context-worker",
      from: "system",
      to: "worker-service",
      description: "Runs it",
    });
    const { design } = run(before, {
      type: "edit",
      element: "worker-service",
      name: "Microservice",
    });
    expect(tileIds(design)).toEqual(tileIds(before));
    expect(design.architecture?.relationships).toEqual(before.architecture?.relationships);
    expect(renameRefusal(before, { element: "worker-service" }, "Microservice")).toBeUndefined();
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
    // IDs that historically followed names are preserved too.
    expect(planRename(modules, { element: "transcoder" }, "Video transcoder")).toEqual([]);
  });

  it("preserves IDs for repeated, punctuation and long labels, and refuses explicit rekey without migration", () => {
    const before = mouseDesign();
    for (const name of ["Worker service", "Second worker", "!!!", "a".repeat(120)]) {
      const after = run(before, { type: "edit", element: "worker-service", name }).design;
      expect(tileIds(after)).toEqual(tileIds(before));
      expect(moduleIds(after)).toEqual(moduleIds(before));
    }
    for (const [from, to] of [
      ["worker-service", "new-worker"],
      ["missing", "free"],
      ["worker-service", "cache"],
    ] as const)
      expect(applyOperations(before, [{ op: "rekey", from, to }])).toMatchObject({
        ok: false,
        errors: [{ code: "INVALID_OPERATION", message: expect.stringContaining("migration") }],
      });
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
