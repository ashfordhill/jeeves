import { createFakeProvider } from "@jeeves/providers";
import {
  applyOperations,
  isStructural,
  noTemplates,
  reviewArchitecture,
  validateDesign,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { DesignService } from "../design/service.ts";
import { openTestDb } from "../test-support.ts";
import { effectRef, effectsAuthoringFixture } from "./effects-authoring-fixture.ts";
import { ChatService } from "./service.ts";
import { toolDefinitions, Workspace } from "./tools.ts";

const registry = noTemplates;
function need<T>(value: T | undefined | null): T {
  if (value == null) throw new Error("Missing fixture value");
  return value;
}
it("scripted chat saves command/lifecycle/hook/effect/scenario edits as one real persisted undo step", async () => {
  const after = effectsAuthoringFixture(),
    before = structuredClone(after);
  const a = need(before.architecture),
    b = need(a.backend);
  delete b.operations;
  delete b.lifecycles;
  delete b.hooks;
  delete b.effects;
  const scenario = need(need(a.scenarios)[0]);
  scenario.outcomes = [];
  scenario.mainOutcomes = [];
  expect(validateDesign(after, registry).filter(isStructural)).toEqual([]);
  const db = await openTestDb();
  try {
    const designs = new DesignService(db.db);
    const project = await designs.createProject("P68b offline combined authoring");
    const seeded = await designs.edit(project.id, {
      baseRevision: 0,
      source: "api",
      ops: [
        ...before.elements.map((element) => ({ op: "addElement", element })),
        { op: "setArchitecture", architecture: before.architecture },
      ],
    });
    expect(seeded.ok).toBe(true);
    const fake = createFakeProvider([
      { toolCalls: [{ name: "getArchitectureContracts", arguments: {} }] },
      {
        toolCalls: [
          {
            name: "applyOperations",
            arguments: { ops: [{ op: "setArchitecture", architecture: after.architecture }] },
          },
        ],
      },
      { text: "Saved design intent. Hook implementation and verification remain unavailable." },
    ]);
    const chat = new ChatService(db.db, designs, () => ({
      provider: fake,
      model: "fake-model",
    }));
    const started = await chat.start(project.id, {
      message:
        "Add the exact typed command, hook, lifecycle, effect and recovery scenario in one turn",
      fileIds: [],
      selection: [],
    });
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error(started.message);
    const turn = await started.run(() => {});
    expect(turn.status).toBe("done");
    expect(turn.operationId).toBeTypeOf("number");
    const saved = need(await designs.getDesign(project.id));
    expect(saved.design.revision).toBe(2);
    expect(saved.design.architecture).toEqual(after.architecture);
    expect(
      saved.findings.some((f) => f.code === "NEEDS_TEMPLATE" && f.target.path?.[2] === "hooks"),
    ).toBe(true);
    expect(
      saved.findings.some((f) => f.code === "CONFIG_REQUIRED" && f.target.path?.[2] === "effects"),
    ).toBe(true);
    const undone = await designs.undo(project.id, saved.design.revision, "api");
    expect(undone.ok).toBe(true);
    expect(need(await designs.getDesign(project.id)).design.architecture).toEqual(
      before.architecture,
    );
    const current = need(await designs.getDesign(project.id));
    expect(current.history.latestEdit).not.toBe(turn.operationId);
    expect((await designs.redo(project.id, current.design.revision, "api")).ok).toBe(true);
    expect(need(await designs.getDesign(project.id)).design.architecture).toEqual(
      after.architecture,
    );
  } finally {
    await db.close();
  }
});

it("rejects dangling effect targets, unknown options and false hook success atomically without losing pending edits", () => {
  const before = effectsAuthoringFixture(),
    workspace = new Workspace(before);
  const edit = (architecture: NonNullable<typeof before.architecture>) =>
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "setArchitecture", architecture }] }),
      ),
    );
  const named = structuredClone(need(before.architecture));
  named.system.description = "Pending safe edit";
  expect(edit(named).ok).toBe(true);
  for (const kind of [
    "dangling",
    "unknown",
    "false-success",
    "unsafe-write",
    "protected",
  ] as const) {
    const invalid = structuredClone(named),
      model = need(invalid.backend),
      effect = need(need(model.effects)[0]),
      hook = need(need(model.hooks)[0]);
    if (kind === "dangling") effect.target = { kind: "operation", operation: effectRef("missing") };
    if (kind === "unknown") Object.assign(effect.delivery, { exactlyOnce: true });
    if (kind === "false-success") hook.unavailable.outcome = "ok";
    if (kind === "unsafe-write")
      hook.allowedWrites.push({ entity: effectRef("record"), field: "version" });
    if (kind === "protected") {
      need(need(model.operations)[0]).actions.shift();
      hook.timeoutSeconds = 1;
    }
    expect(edit(invalid).ok, kind).toBe(false);
    expect(workspace.working.architecture).toEqual(named);
    expect(workspace.pending).toHaveLength(1);
  }
});

it("discovers exact effects/hooks, safe outcomes and recovery references through the shared chat schema", () => {
  const before = effectsAuthoringFixture(),
    workspace = new Workspace(before);
  const discovered = JSON.parse(workspace.run("getArchitectureContracts", "{}"));
  const model = need(need(before.architecture).backend);
  expect(discovered.backend.effects).toEqual(model.effects);
  expect(discovered.backend.hooks).toEqual(model.hooks);
  expect(discovered.backendAuthoring).toContain("one atomic turn");
  const schema = JSON.stringify(
    need(toolDefinitions().find((t) => t.name === "applyOperations")).parameters,
  );
  for (const value of [
    "effects",
    "hooks",
    "unavailable",
    "invalidResult",
    "acceptance",
    "reconcile-before-retry",
    "atomic-intent",
    "separate-delivery-attempt",
  ])
    expect(schema).toContain(value);
});

it("Review retains exact backend source paths for field navigation without parsing prose", () => {
  const design = effectsAuthoringFixture();
  const findings = reviewArchitecture(design).findings;
  const recovery = findings.find(
    (f) =>
      f.sourcePath?.join("/") ===
      "architecture/backend/effects/outbox@v1/recovery/uncertain-commit",
  );
  expect(recovery).toMatchObject({ editor: "component", code: "BACKEND_EFFECT_GAP" });
  const missingHook = findings.find(
    (f) => f.sourcePath?.join("/") === "architecture/backend/hooks/hook@v1",
  );
  expect(missingHook?.editor).toBe("component");
  const architecture = need(design.architecture),
    model = need(architecture.backend);
  const refusal = applyOperations(
    design,
    [
      {
        op: "setArchitecture",
        architecture: {
          ...architecture,
          backend: {
            ...model,
            effects: [
              {
                ...need(need(model.effects)[0]),
                target: { kind: "hook", hook: effectRef("absent") },
              },
            ],
          },
        },
      },
    ],
    registry,
  );
  expect(refusal.ok).toBe(false);
});
