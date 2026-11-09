import { createFakeProvider, type ModelRequest } from "@jeeves/providers";
import {
  applyOperations,
  buildStudioCommand,
  type DesignDocument,
  designBlueprintV3,
  designReadiness,
  designSchema,
  emptyDesign,
  type StudioCommand,
  studioProtocolSchema,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import mouseEvidence from "../../../../../docs/plans/reliable-foundations/evidence/nc06/mouse-built-design.json" with {
  type: "json",
};
import { ChatService } from "../chat/service.ts";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

/** Explicit IDs copied from an actual blank-canvas mouse build, never a fixture API seed. */
function construction(design: DesignDocument): StudioCommand[] {
  if (design.schemaVersion !== 3 || !design.operations || !design.architecture?.studio)
    throw new Error();
  const studio = design.architecture.studio;
  const create = design.operations.receivers.find((x) => x.binding.kind === "create-link"),
    resolve = design.operations.receivers.find((x) => x.binding.kind === "resolve-link");
  if (!create || !resolve) throw new Error();
  const add = (
    id: string,
    from: { lane: "upload" | "download" } | { tile: string },
    linkId: string,
  ): StudioCommand => {
    const element = design.elements.find((x) => x.id === id),
      binding = studio.elements.find((x) => x.element === id);
    if (!element || !binding) throw new Error();
    return {
      type: "addTile",
      from,
      side: "after",
      tile: { id, name: element.name, kind: binding.settings.kind },
      linkId,
    };
  };
  const entry = (role: string) => {
    const e = studio.entries?.find((x) => x.element === role);
    if (!e) throw new Error();
    return e;
  };
  const re = entry(resolve.role),
    ce = entry(create.role),
    source = design.ownership?.resources.find((x) => x.kind === "source"),
    cache = design.ownership?.resources.find((x) => x.kind === "projection");
  if (!source || !cache) throw new Error();
  const connection = (from: string, to: string) => {
    const c = design.connections.find((x) => x.from.element === from && x.to.element === to);
    if (!c) throw new Error();
    return c.id;
  };
  return [
    ...(studio.actions ?? []).map((x) => ({
      type: "addAction" as const,
      ...x,
      system: design.architecture?.system,
    })),
    add(resolve.role, { lane: re.lane }, re.id),
    add(source.element, { tile: resolve.role }, connection(resolve.role, source.element)),
    add(cache.element, { tile: resolve.role }, connection(resolve.role, cache.element)),
    add(create.role, { lane: ce.lane }, ce.id),
    {
      type: "linkTiles",
      from: { tile: create.role },
      to: source.element,
      linkId: connection(create.role, source.element),
    },
    ...studio.elements.map((binding): StudioCommand => {
      const element = design.elements.find((x) => x.id === binding.element);
      if (!element) throw new Error();
      return {
        type: "edit",
        element: element.id,
        name: element.name,
        ...(element.description !== undefined ? { description: element.description } : {}),
        settings: binding.settings,
        owner: binding.owner ?? null,
      };
    }),
    ...design.connections.map(
      (x): StudioCommand => ({
        type: "editConnection",
        connection: x.id,
        planned: { ...x.planned, protocol: studioProtocolSchema.parse(x.planned.protocol) },
        settings: studio.connections.find((c) => c.connection === x.id)?.settings ?? {},
      }),
    ),
  ];
}
it("preserves historical mouse source while ChatService declares exact contracts/report in one Undo", async () => {
  const expected = designSchema.parse(mouseEvidence);
  if (expected.schemaVersion !== 3) throw new Error();
  const database = await openTestDb(),
    service = new DesignService(database.db),
    app = buildTestApp(database.db);
  const configure = (name: string, value: object) =>
    ["preview", "apply"].map((action) => ({
      name,
      arguments: { baseRevision: 1, action, upgrade: true, ...value },
    }));
  const requests: ModelRequest[] = [];
  const steps = [
    { toolCalls: configure("configureDesignScope", { scope: expected.scope }) },
    { toolCalls: configure("configureOwnership", { ownership: expected.ownership }) },
    { toolCalls: configure("configureOperations", { operations: expected.operations }) },
    {
      toolCalls: [
        { name: "reviewDesign", arguments: {} },
        { name: "readReadiness", arguments: {} },
      ],
    },
    {
      text: "Declared create/resolve only. Concrete authentication, templates and runtime proof remain unavailable.",
    },
  ];
  const provider = createFakeProvider((request, round) => {
    requests.push(request);
    return steps[round] ?? { text: "Done" };
  });
  try {
    const project = await service.createProject("NC06 scripted construction"),
      chat = new ChatService(database.db, service, () => ({ provider, model: "offline-script" }));
    let historical = emptyDesign();
    const sourceOps = [];
    for (const command of construction(expected)) {
      const batch = buildStudioCommand(historical, command);
      const result = applyOperations(historical, batch.ops);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      historical = result.design;
      sourceOps.push(...batch.ops);
    }
    expect(
      (await service.edit(project.id, { baseRevision: 0, ops: sourceOps, source: "canvas" })).ok,
    ).toBe(true);
    const started = await chat.start(project.id, {
      message: "Build the narrow TinyURL foundation with the explicit chosen canonical identities.",
      fileIds: [],
      selection: [],
      baseRevision: 1,
    });
    if (!started.ok) throw new Error(started.message);
    const turn = await started.run(() => {}),
      state = await service.getDesign(project.id);
    expect(turn.status).toBe("done");
    expect(turn.error).toBeNull();
    expect(turn.activity.filter((x) => !x.ok)).toEqual([]);
    if (!state) throw new Error();
    expect(state.design.revision).toBe(2);
    expect(designBlueprintV3({ ...state.design, revision: 0 })).toEqual(
      designBlueprintV3({ ...expected, revision: 0 }),
    );
    expect(designReadiness(state.design)).toEqual(designReadiness(expected));
    if (state.design.schemaVersion !== 3) throw new Error();
    expect(state.design.operations).toEqual(expected.operations);
    expect(state.design.ownership).toEqual(expected.ownership);
    expect(state.design.scope).toEqual(expected.scope);
    expect(requests).toHaveLength(5);
    const undo = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/undo`,
      payload: { baseRevision: 2 },
    });
    expect(undo.json().design).toEqual({ ...historical, revision: 3 });
    expect(undo.json().history.canUndo).toBe(true);
    const undoSource = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/undo`,
      payload: { baseRevision: 3 },
    });
    expect(undoSource.json().design).toEqual({ ...emptyDesign(), revision: 4 });
    expect(undoSource.json().history.canUndo).toBe(false);
  } finally {
    await app.close();
    await database.close();
  }
}, 15000);
