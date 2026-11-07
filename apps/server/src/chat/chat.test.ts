import {
  createFakeProvider,
  type FakeProvider,
  type ModelItem,
  type ModelProvider,
  type ModelRequest,
  type Script,
} from "@jeeves/providers";
import {
  buildStudioCommand,
  type DesignDocument,
  designScopeSchema,
  studioPatternIds,
  studioPatterns,
} from "@jeeves/spec";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import { DesignService, type EditInput } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";
import { rasterizeSvg } from "./files.ts";
import scopeFixture from "./fixtures/nc01-scope-v1.json" with { type: "json" };
import {
  type ChatEvent,
  ChatService,
  type ChatTurn,
  MAX_ROUNDS,
  type ModelSource,
} from "./service.ts";

type State = {
  design: DesignDocument;
  findings: { code: string; target: { element?: string } }[];
  history: { canUndo: boolean; canRedo: boolean; latestEdit: number | null };
};

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await openTestDb());
});

it("bounds persistent scope repairs, allows preview after exhaustion and saves scope-only edits as one Undo", async () => {
  const initial = designScopeSchema.parse(scopeFixture.scope);
  const scoped = (requirement: string) => ({
    ...initial,
    customRequirements: [{ id: "custom-rule", requirement, criticality: "required" as const }],
  });
  const configure = (action: "preview" | "apply", scope = initial) => ({
    name: "configureDesignScope",
    arguments: { baseRevision: 0, action, scope, upgrade: true },
  });
  const review = { name: "reviewDesign", arguments: {} };
  const h = harness([
    { toolCalls: [configure("preview"), configure("apply"), review] },
    { toolCalls: [configure("apply", scoped("First repair")), review] },
    { toolCalls: [configure("apply", scoped("Second repair")), review] },
    {
      toolCalls: [
        configure("apply", scoped("Forbidden third repair")),
        configure("preview", scoped("Preview remains read-only")),
      ],
    },
    { text: "Saved the scope with unresolved contracts." },
  ]);
  try {
    const id = await h.project();
    const { turn, state } = await h.chat(
      id,
      "Select the narrow TinyURL profile and save my requirements.",
    );
    expect(turn.error).toBeNull();
    expect(state.design).toMatchObject({
      schemaVersion: 3,
      revision: 1,
      scope: scoped("Second repair"),
    });
    expect(
      turn.activity.filter((item) => item.tool === "configureDesignScope" && !item.ok),
    ).toContainEqual(
      expect.objectContaining({
        summary: expect.stringContaining("2 review repair passes are used"),
      }),
    );
    expect(
      turn.activity.filter(
        (item) => item.tool === "configureDesignScope" && item.summary.startsWith("Previewed"),
      ),
    ).toHaveLength(2);
    expect(turn.reply).toContain("one Undo step");
    expect(h.requests).toHaveLength(5);
    const outputs = h.requests
      .at(-1)
      ?.items.filter((item) => item.type === "tool-result")
      .map((item) => (item.type === "tool-result" ? JSON.parse(item.output) : null));
    expect(outputs).toContainEqual(
      expect.objectContaining({ note: expect.stringContaining("Preview only") }),
    );
    const undo = await h.call("POST", `/projects/${id}/undo`, { baseRevision: 1 });
    expect(undo.body.design).toEqual({
      schemaVersion: 2,
      revision: 2,
      elements: [],
      connections: [],
    });
  } finally {
    await h.app.close();
  }
});
afterAll(async () => {
  await close();
});

/** An app whose chat model is the given fake provider. */
function harness(input: Script | { models: ModelSource }) {
  let provider: FakeProvider | undefined;
  let models: ModelSource;
  if ("models" in input) {
    models = input.models;
  } else {
    const fake = createFakeProvider(input);
    provider = fake;
    models = () => ({ provider: fake, model: "fake-model" });
  }
  const app = buildTestApp(db, { models });
  const call = async (method: "GET" | "POST" | "PUT", url: string, body?: unknown) => {
    const res = await app.inject({
      method,
      url,
      ...(body === undefined ? {} : { payload: body as object }),
    });
    const json = res.headers["content-type"]?.toString().startsWith("application/json");
    return { status: res.statusCode, body: json ? res.json() : undefined, raw: res.body };
  };
  return {
    app,
    call,
    get requests(): ModelRequest[] {
      return provider?.requests ?? [];
    },
    async project() {
      const res = await call("POST", "/projects", { name: "Chat test" });
      return res.body.project.id as string;
    },
    design: async (id: string) => (await call("GET", `/projects/${id}/design`)).body as State,
    /** Sends a chat message and returns the streamed events. */
    async chat(
      id: string,
      message: string,
      extra: { fileIds?: string[]; selection?: string[] } = {},
    ) {
      const { design } = (await call("GET", `/projects/${id}/design`)).body as State;
      const res = await call("POST", `/projects/${id}/chat`, {
        message,
        baseRevision: design.revision,
        ...extra,
      });
      expect(res.status).toBe(200);
      const events = res.raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ChatEvent);
      const done = events.at(-1);
      if (done?.type !== "done") throw new Error(`no done event: ${res.raw}`);
      return {
        events,
        turn: done.turn,
        state: done.state as unknown as State,
      };
    },
  };
}

function textOf(item: ModelItem | undefined): string {
  if (item?.type !== "message") return "";
  return item.content.map((p) => (p.type === "text" ? p.text : "")).join("\n");
}

describe("design chat", () => {
  it.each(studioPatternIds)(
    "delivers %s and its support limits through the actual chat tool loop",
    async (patternId) => {
      const pattern = studioPatterns[patternId];
      const h = harness((request, round) => {
        const result = () => {
          const item = request.items.findLast((item) => item.type === "tool-result");
          if (item?.type !== "tool-result") throw new Error("Expected the previous tool's result");
          return JSON.parse(item.output);
        };
        if (
          request.items.some(
            (item) => item.type === "tool-call" && item.callId.startsWith("jeeves-review-"),
          )
        ) {
          const review = result();
          expect(review.structurallyValid).toBe(true);
          // Retrieval alone did not declare applicability.
          expect(review.scope.patterns).toEqual([]);
          return {
            text: "Reviewed the represented topology; behavior contracts remain outside this review.",
          };
        }
        if (round === 0) {
          expect(request.tools?.map((tool) => tool.name)).toContain("describeStudioPattern");
          expect(request.instructions).toContain("before building or substantially restructuring");
          expect(request.instructions).toContain("A trivial rename does not need retrieval");
          expect(request.instructions).toContain(
            "Retrieval alone does not establish that a pattern applies",
          );
          return { toolCalls: [{ name: "listStudioPatterns", arguments: {} }] };
        }
        if (round === 1) {
          expect(result().patterns.map((entry: { id: string }) => entry.id)).toContain(patternId);
          return { toolCalls: [{ name: "describeStudioPattern", arguments: { id: patternId } }] };
        }
        if (round === 2) {
          const received = result().pattern;
          expect(received).toEqual(pattern);
          expect(received.support).toMatchObject({
            templateAvailability: "none",
            runtimeVerification: "none",
          });
          if (pattern.example.kind === "commands") {
            return {
              toolCalls: [
                {
                  name: "applyStudioCommands",
                  arguments: { baseRevision: 0, commands: pattern.example.commands },
                },
              ],
            };
          }
          // The scripted provider reads a precise missing contract from the actual tool response.
          // This proves transport, not whether a live model follows the instruction or designs well.
          const missing = received.support.obligations.find(
            (item: { id: string }) => item.id === "same-owner-result",
          );
          return { text: `Implementation obligation: ${missing.implementation}` };
        }
        expect(result().ok).toBe(true);
        return {
          text: "Prepared the topology example. Implementation obligations remain; no runtime template or verification is supplied.",
        };
      });
      const id = await h.project();
      const { turn, state } = await h.chat(id, `Review and illustrate ${patternId}`);
      expect(turn.status).toBe("done");
      expect(turn.activity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tool: "listStudioPatterns", ok: true }),
          expect.objectContaining({ tool: "describeStudioPattern", ok: true }),
        ]),
      );
      if (pattern.example.kind === "obligation") {
        expect(turn.reply).toContain("never invent another independently owned service");
        expect(turn.reply).toContain("current attempt");
        expect(turn.operationId).toBeNull();
        expect(state.design.elements).toEqual([]);
        expect(state.design.revision).toBe(0);
      } else {
        expect(turn.operationId).toEqual(expect.any(Number));
        expect(state.design.revision).toBe(1);
        const undone = await h.call("POST", `/projects/${id}/undo`, { baseRevision: 1 });
        expect(undone.body.design.elements).toEqual([]);
      }
    },
  );

  it("stores an askUser question, ends the turn, and sends it as history with the answer", async () => {
    const h = harness([
      {
        text: "One question first.",
        toolCalls: [
          {
            name: "askUser",
            arguments: {
              question: "Do people need accounts?",
              choices: ["No accounts", "Email login"],
            },
          },
        ],
      },
      { text: "Noted: no accounts." },
    ]);
    const id = await h.project();
    const first = await h.chat(id, "Make me a link shortener");
    expect(first.turn.question).toEqual({
      question: "Do people need accounts?",
      choices: ["No accounts", "Email login"],
      allowFreeText: true,
    });
    expect(first.turn.operationId).toBeNull();
    expect(h.requests).toHaveLength(1);

    const second = await h.chat(id, "No accounts");
    expect(second.turn.status).toBe("done");
    expect(second.turn.reply).toContain("Noted: no accounts.");
    expect(h.requests).toHaveLength(2);
    const history = (h.requests[1] as ModelRequest).items.map(textOf);
    expect(history[0]).toBe("Make me a link shortener");
    expect(history[1]).toMatch(
      /One question first\.[\s\S]*\n\[Asked: Do people need accounts\? Choices: No accounts \| Email login\]/,
    );
    expect(history.at(-1)).toBe("No accounts");
  });

  it("commits a turn's studio commands as one chat edit and one undo step", async () => {
    const service = (id: string, name: string) => ({
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      link: "sync",
      tile: { id, name, kind: "service" },
      linkId: `upload-${id}`,
    });
    const h = harness([
      {
        toolCalls: [
          {
            name: "applyStudioCommands",
            arguments: {
              baseRevision: 0,
              commands: [{ ...service("links", "Links"), system: { name: "Shortener" } }],
            },
          },
          {
            name: "applyStudioCommands",
            arguments: { baseRevision: 0, commands: [service("redirect", "Redirect")] },
          },
          // Refused: nothing from this call is kept, the rest of the turn still commits.
          {
            name: "applyStudioCommands",
            arguments: { baseRevision: 0, commands: [{ type: "edit", element: "ghost" }] },
          },
        ],
      },
      { text: "Added two services." },
      { text: "Reviewed both services." },
    ]);
    const id = await h.project();
    const { turn, state } = await h.chat(id, "Add a link service and a redirect");
    expect(turn).toMatchObject({
      status: "done",
      reply: expect.stringContaining("Added two services."),
    });
    expect(turn.operationId).toEqual(expect.any(Number));
    expect(turn.changed).toEqual(expect.arrayContaining(["links", "redirect"]));
    expect(turn.activity.map((a) => a.ok)).toEqual(expect.arrayContaining([true, false]));
    expect(state.design.revision).toBe(1);
    expect(state.design.elements.map((e) => e.id)).toEqual(["links", "redirect"]);

    const undone = await h.call("POST", `/projects/${id}/undo`, { baseRevision: 1 });
    expect(undone.body.design.elements).toEqual([]);
  });

  it("fails the turn without changing anything when the provider fails or isn't set up", async () => {
    const h = harness([
      { toolCalls: [{ name: "listStudioDefinitions", arguments: {} }] },
      { error: "auth" },
    ]);
    const id = await h.project();
    const { turn, state } = await h.chat(id, "Add a service");
    expect(turn).toMatchObject({ status: "failed", error: "Scripted failure.", operationId: null });
    expect(state.design.elements).toEqual([]);

    // The default app has no key configured.
    const app = buildTestApp(db);
    const project = (
      await app.inject({ method: "POST", url: "/projects", payload: { name: "x" } })
    ).json().project.id;
    const res = await app.inject({
      method: "POST",
      url: `/projects/${project}/chat`,
      payload: { message: "hi", baseRevision: 0 },
    });
    const done = JSON.parse(res.body.trim().split("\n").at(-1) as string) as { turn: ChatTurn };
    expect(done.turn.status).toBe("failed");
    expect(done.turn.error).toMatch(/No OpenAI API key is set/);
  });

  it("refuses unknown projects and files", async () => {
    const h = harness([]);
    const id = await h.project();
    const missing = "00000000-0000-4000-8000-000000000000";
    expect(
      (await h.call("POST", `/projects/${missing}/chat`, { message: "hi", baseRevision: 0 }))
        .status,
    ).toBe(404);
    const unknownFile = await h.call("POST", `/projects/${id}/chat`, {
      message: "hi",
      baseRevision: 0,
      fileIds: [missing],
    });
    expect(unknownFile).toMatchObject({ status: 422, body: { code: "UNKNOWN_FILE" } });
    expect(
      (await h.call("POST", `/projects/${id}/chat`, { message: "  ", baseRevision: 0 })).status,
    ).toBe(400);
  });
});

const toolOutput = (request: ModelRequest) => {
  const item = request.items.findLast((item) => item.type === "tool-result");
  if (item?.type !== "tool-result") throw new Error("Expected a tool result");
  return JSON.parse(item.output);
};
const firstUpload = {
  type: "addTile",
  from: { lane: "upload" },
  side: "after",
  tile: { id: "uploads", name: "Uploads", kind: "uploads" },
  linkId: "upload-uploads",
  system: { name: "Media" },
};
const originalStorage = {
  type: "addTile",
  from: { tile: "uploads" },
  side: "after",
  tile: { id: "originals", name: "Originals", kind: "object-store" },
  linkId: "uploads-originals",
};
const apply = (...commands: unknown[]) => ({
  name: "applyStudioCommands",
  arguments: { baseRevision: 0, commands },
});

describe("proposed-design review in ChatService", () => {
  it("previews multi-command staged changes without persistence, repairs from received diagnostics, and undoes once", async () => {
    const fake = createFakeProvider((request, round) => {
      if (round === 0)
        return {
          toolCalls: [
            apply(firstUpload, { type: "edit", element: "uploads", name: "Video uploads" }),
            { name: "reviewDesign", arguments: {} },
          ],
        };
      const review = toolOutput(request);
      if (round === 1) {
        expect(review.changes).toContainEqual(
          expect.objectContaining({
            type: "element",
            id: "uploads",
            change: "added",
            name: "Video uploads",
          }),
        );
        expect(review.findings).toContainEqual(
          expect.objectContaining({
            code: "DESIGN_WARNING",
            target: { element: "uploads" },
            introduced: true,
          }),
        );
        return { toolCalls: [apply(originalStorage)] };
      }
      if (round === 2) return { text: "The storage relationship is prepared." };
      expect(review.changes.map((item: { id: string }) => item.id)).toContain("originals");
      expect(review.findings).toEqual([]);
      return { text: "Reviewed the final staged topology." };
    });
    let id = "";
    const provider: ModelProvider = {
      ...fake,
      respond: async (request, options) => {
        if (fake.requests.length > 0) {
          const stored = await h.design(id);
          expect(stored.design.revision).toBe(0);
          expect(stored.design.elements).toEqual([]);
        }
        return fake.respond(request, options);
      },
    };
    const h = harness({ models: () => ({ provider, model: "fake" }) });
    id = await h.project();
    const { turn, state } = await h.chat(id, "Add durable uploads");
    expect(turn.status).toBe("done");
    expect(fake.requests).toHaveLength(4);
    expect(state.design.revision).toBe(1);
    expect(state.design.elements.map((item) => item.id)).toEqual(["uploads", "originals"]);
    expect(turn.reply).toContain("Saved");
    expect(turn.reply).toContain("one Undo step");
    const undone = await h.call("POST", `/projects/${id}/undo`, { baseRevision: 1 });
    expect(undone.body.design.elements).toEqual([]);
    expect(undone.body.history.canUndo).toBe(false);
  });

  it("forces review when the model ends, invalidates it after later commands, and saves warnings", async () => {
    const h = harness((request, round) => {
      if (round === 0) return { toolCalls: [apply(firstUpload)] };
      if (round === 1) return { text: "Finished." }; // No explicit review call.
      if (round === 2) {
        expect(toolOutput(request).findings[0].target).toEqual({ element: "uploads" });
        return {
          toolCalls: [apply({ type: "edit", element: "uploads", name: "Still missing storage" })],
        };
      }
      if (round === 3) return { text: "Finished again." };
      expect(toolOutput(request).changes).toContainEqual(
        expect.objectContaining({ id: "uploads", name: "Still missing storage" }),
      );
      return { text: "Storage remains unresolved in this scope." };
    });
    const id = await h.project();
    const { turn, state } = await h.chat(id, "Prepare the upload entry only");
    expect(turn.status).toBe("done");
    expect(h.requests).toHaveLength(5);
    expect(state.findings).toContainEqual(
      expect.objectContaining({ code: "DESIGN_WARNING", target: { element: "uploads" } }),
    );
    expect(turn.reply).toContain("Unresolved: 1 design finding");
    expect(turn.activity.filter((item) => item.tool === "reviewDesign")).toHaveLength(2);
    expect(turn.activity.find((item) => item.tool === "reviewDetail")?.summary).toContain(
      "has no storage relationship",
    );
  });

  it("keeps a failing command batch atomic and structural invalidity rejected", async () => {
    const h = harness((request, round) => {
      if (round === 0)
        return {
          toolCalls: [
            apply(firstUpload, {
              type: "linkTiles",
              from: { tile: "uploads" },
              to: "uploads",
              linkId: "loop",
            }),
          ],
        };
      if (round === 1) {
        expect(toolOutput(request)).toMatchObject({
          ok: false,
          note: "Nothing changed for this call.",
        });
        return { toolCalls: [{ name: "reviewDesign", arguments: {} }] };
      }
      expect(toolOutput(request).changes).toEqual([]);
      return { text: "The invalid batch was refused." };
    });
    const id = await h.project();
    const { turn, state } = await h.chat(id, "Try an invalid batch");
    expect(turn.status).toBe("done");
    expect(turn.operationId).toBeNull();
    expect(state.design.revision).toBe(0);
    expect(state.design.elements).toEqual([]);
    expect(state.history.canUndo).toBe(false);
  });

  it("does not overwrite a concurrent canvas edit and reviews the actual saved state on conflict", async () => {
    const fake = createFakeProvider([
      { toolCalls: [apply(firstUpload)] },
      { text: "Prepared uploads." },
      { text: "Reviewed uploads." },
    ]);
    let id = "";
    const provider: ModelProvider = {
      ...fake,
      respond: async (request, options) => {
        if (fake.requests.length === 2) {
          const current = await h.design(id);
          const batch = buildStudioCommand(current.design, {
            type: "addAction",
            lane: "download",
            name: "Browse",
            system: { name: "Mouse design" },
          });
          expect(
            (await h.call("POST", `/projects/${id}/operations`, { ...batch, source: "canvas" }))
              .status,
          ).toBe(200);
        }
        return fake.respond(request, options);
      },
    };
    const h = harness({ models: () => ({ provider, model: "fake" }) });
    id = await h.project();
    const { turn, state } = await h.chat(id, "Prepare uploads while I edit");
    expect(turn.status).toBe("failed");
    expect(turn.error).toContain("design changed while");
    expect(turn.operationId).toBeNull();
    expect(turn.changed).toEqual([]);
    expect(state.design.revision).toBe(1);
    expect(state.design.elements).toEqual([]);
    expect(state.design.architecture?.system.name).toBe("Mouse design");
    expect(turn.reply).toContain("No design edits saved. Review of saved revision 1.");
    const details = turn.activity
      .filter((item) => item.tool === "reviewDetail")
      .map((item) => item.summary)
      .join(" ");
    expect(details).toContain("Browse has no entries");
    expect(details).not.toContain("Uploads has no storage");
  });

  it("reports explicit lifecycle obligations without an extra owner or any design mutation", async () => {
    const h = harness((request, round) => {
      if (round === 0)
        return {
          toolCalls: [
            { name: "describeStudioPattern", arguments: { id: "durable-background-job" } },
          ],
        };
      if (round === 1)
        return {
          toolCalls: [
            {
              name: "declareReviewScope",
              arguments: {
                patterns: [{ id: "durable-background-job", checklistIds: ["current-attempt"] }],
                assumptions: ["One logical owner receives processing results."],
                obligations: [],
              },
            },
            { name: "reviewDesign", arguments: {} },
          ],
        };
      const review = toolOutput(request);
      expect(
        review.obligations.every((item: { status: string }) => item.status === "not specified"),
      ).toBe(true);
      const missing = review.obligations.find(
        (item: { id: string }) => item.id === "same-owner-result",
      );
      expect(missing.version).toBe("1.0.0");
      expect(missing.requirement).toContain("never invent another independently owned service");
      return { text: "The same owner result remains not specified; no extra service repairs it." };
    });
    const id = await h.project();
    const before = await h.design(id);
    const { turn, state } = await h.chat(id, "Review a same-owner processing result");
    expect(turn.status).toBe("done");
    expect(turn.operationId).toBeNull();
    expect(state).toEqual(before);
    expect(turn.reply).toContain("4 requirements not specified");
    expect(
      turn.activity.find(
        (item) => item.tool === "reviewDetail" && item.summary.includes("same-owner-result"),
      ),
    ).toBeDefined();
  });

  it("keeps repair batches bounded and does not weaken the normal round limit", async () => {
    // Third response batch tries a further mutation after two accepted repairs.
    const script = createFakeProvider((request, round) => {
      if (round === 0)
        return { toolCalls: [apply(firstUpload), { name: "reviewDesign", arguments: {} }] };
      if (round <= 3)
        return {
          toolCalls: [
            apply({ type: "edit", element: "uploads", name: `Repair ${round}` }),
            { name: "reviewDesign", arguments: {} },
          ],
        };
      expect(
        request.items
          .filter((item) => item.type === "tool-result")
          .some(
            (item) => item.type === "tool-result" && item.output.includes("2 review repair passes"),
          ),
      ).toBe(true);
      return { text: "Remaining warning is explicit." };
    });
    const bounded = harness({ models: () => ({ provider: script, model: "fake" }) });
    const id = await bounded.project();
    const { turn, state } = await bounded.chat(id, "Repeated repairs");
    expect(turn.status).toBe("done");
    expect(state.design.elements[0]?.name).toBe("Repair 2");
    expect(
      turn.activity.filter((item) => item.tool === "applyStudioCommands" && !item.ok),
    ).toHaveLength(1);
    // Endless read tools still fail at the original limit, saving none of the staged edits.
    const endless = harness((_request, round) => ({
      toolCalls: round === 0 ? [apply(firstUpload)] : [{ name: "getDesign", arguments: {} }],
    }));
    const other = await endless.project();
    const failed = await endless.chat(other, "Never finish");
    expect(endless.requests).toHaveLength(MAX_ROUNDS);
    expect(failed.turn.status).toBe("failed");
    expect(failed.state.design.elements).toEqual([]);
    expect(failed.turn.reply).toContain("No design edits saved");
    expect(failed.turn.activity.find((item) => item.tool === "reviewDetail")).toBeUndefined();
  });

  it("answers a pure conversational turn without another model call or design write", async () => {
    const h = harness([{ text: "A queue separates the request from later work." }]);
    const id = await h.project();
    const before = await h.design(id);
    const result = await h.chat(id, "What is a queue?");
    expect(h.requests).toHaveLength(1);
    expect(result.turn.status).toBe("done");
    expect(result.turn.reply).toContain("A queue separates");
    expect(result.turn.reply).toContain("No design edits saved");
    expect(result.state).toEqual(before);
  });

  it("attributes only the chat snapshot when a canvas edit follows its commit", async () => {
    class InterleavedDesign extends DesignService {
      override async edit(projectId: string, input: EditInput) {
        const committed = await super.edit(projectId, input);
        if (committed.ok && input.source === "chat") {
          const batch = buildStudioCommand(
            committed.state.design,
            originalStorage as Parameters<typeof buildStudioCommand>[1],
          );
          expect((await super.edit(projectId, { ...batch, source: "canvas" })).ok).toBe(true);
        }
        return committed;
      }
    }
    const design = new InterleavedDesign(db);
    const fake = createFakeProvider([
      { toolCalls: [apply(firstUpload), { name: "reviewDesign", arguments: {} }] },
      { text: "Reviewed entry only." },
    ]);
    const chat = new ChatService(db, design, () => ({ provider: fake, model: "fake" }));
    const project = await design.createProject("Post-commit interleaving");
    const started = await chat.start(project.id, {
      message: "Prepare an entry",
      fileIds: [],
      selection: [],
      baseRevision: 0,
    });
    if (!started.ok) throw new Error(started.message);
    const turn = await started.run(() => {});
    expect(turn.status).toBe("done");
    expect(turn.reply).toContain("Saved 4 design changes at revision 1 as one Undo step");
    expect(turn.reply).toContain("Review of saved revision 2");
    expect(turn.reply).toContain("No represented structural/readiness findings");
    expect(turn.changed).toEqual(["uploads"]);
    expect((await design.getDesign(project.id))?.design.elements.map((item) => item.id)).toEqual([
      "uploads",
      "originals",
    ]);
  });

  it("finishes safely if the project is deleted during the provider call", async () => {
    const design = new DesignService(db);
    const project = await design.createProject("Deleted mid-turn");
    const fake = createFakeProvider([{ text: "No changes needed." }]);
    const provider: ModelProvider = {
      ...fake,
      respond: async (request, options) => {
        await design.deleteProject(project.id);
        return fake.respond(request, options);
      },
    };
    const chat = new ChatService(db, design, () => ({ provider, model: "fake" }));
    const started = await chat.start(project.id, {
      message: "Explain",
      fileIds: [],
      selection: [],
      baseRevision: 0,
    });
    if (!started.ok) throw new Error(started.message);
    const events: ChatEvent[] = [];
    const turn = await started.run((event) => events.push(event));
    expect(turn.status).toBe("failed");
    expect(turn.error).toContain("project was deleted");
    expect(turn.reply).toContain("Review unavailable");
    expect(events.at(-1)).toMatchObject({ type: "done", state: null, turn: { status: "failed" } });
  });

  it("preserves immediate questions with staged edits and skips no-op writes", async () => {
    const h = harness([
      {
        toolCalls: [
          apply(firstUpload),
          {
            name: "askUser",
            arguments: { question: "Is storage in scope next?", choices: ["Yes", "Later"] },
          },
        ],
      },
    ]);
    const id = await h.project();
    const asked = await h.chat(id, "Prepare an entry and ask");
    expect(h.requests).toHaveLength(1);
    expect(asked.turn.status).toBe("done");
    expect(asked.turn.question?.question).toBe("Is storage in scope next?");
    expect(asked.state.design.revision).toBe(1);
    expect(asked.turn.reply).toContain("Unresolved: 1 design finding");
    const noop = harness([
      {
        toolCalls: [
          {
            name: "applyStudioCommands",
            arguments: {
              baseRevision: 1,
              commands: [{ type: "edit", element: "uploads", name: "Uploads" }],
            },
          },
          { name: "reviewDesign", arguments: {} },
        ],
      },
      { text: "The name was already set." },
    ]);
    const before = await noop.design(id);
    const result = await noop.chat(id, "Keep the name");
    expect(result.turn.status).toBe("done");
    expect(result.turn.operationId).toBeNull();
    expect(result.state).toEqual(before);
  });
});

describe("chat files", () => {
  const upload = (
    app: FastifyInstance,
    id: string,
    name: string,
    type: string,
    data: Buffer | string,
  ) =>
    app.inject({
      method: "POST",
      url: `/projects/${id}/files`,
      headers: { "content-type": type, "x-file-name": encodeURIComponent(name) },
      payload: data,
    });

  it("stores Markdown, PNG, and SVG files and sends them to the model", async () => {
    const h = harness([{ text: "Read them." }]);
    const id = await h.project();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="teal"/></svg>';
    const png = rasterizeSvg(svg);

    const md = await upload(
      h.app,
      id,
      "brief.md",
      "text/markdown",
      "# Brief\nShort links for everyone.",
    );
    expect(md.statusCode).toBe(201);
    // No declared type: the extension decides.
    const image = await upload(h.app, id, "sketch.png", "application/octet-stream", png);
    const drawing = await upload(h.app, id, "diagram.svg", "image/svg+xml", svg);
    expect([image.statusCode, drawing.statusCode]).toEqual([201, 201]);
    const ids = [md, image, drawing].map((r) => r.json().file.id as string);
    expect(image.json().file).toMatchObject({
      name: "sketch.png",
      mediaType: "image/png",
      size: png.length,
    });

    const { turn } = await h.chat(id, "Design this", { fileIds: ids });
    expect(turn.files.map((f) => f.name)).toEqual(["brief.md", "sketch.png", "diagram.svg"]);

    const message = (h.requests[0] as ModelRequest).items.at(-1);
    if (message?.type !== "message") throw new Error("expected a message");
    const parts = message.content;
    expect(parts[0]).toEqual({ type: "text", text: "Design this" });
    expect(parts[1]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Short links for everyone."),
    });
    expect(
      parts.filter((p) => p.type === "image").map((p) => p.type === "image" && p.mediaType),
    ).toEqual(["image/png", "image/png"]);
    expect(parts.at(-1)).toMatchObject({ type: "text", text: expect.stringContaining("<rect") });

    const fetched = await h.app.inject({ method: "GET", url: `/projects/${id}/files/${ids[1]}` });
    expect(fetched.headers["content-type"]).toBe("image/png");
    expect(fetched.rawPayload.equals(png)).toBe(true);
  });

  it("refuses unsupported, mislabeled, and empty files", async () => {
    const h = harness([]);
    const id = await h.project();
    const pdf = await upload(h.app, id, "brief.pdf", "application/pdf", "%PDF-1.7");
    expect(pdf.statusCode).toBe(415);
    const fakePng = await upload(h.app, id, "photo.png", "image/png", "not a png");
    expect(fakePng.json()).toMatchObject({
      code: "INVALID_FILE",
      message: "This isn't a PNG image.",
    });
    const badSvg = await upload(h.app, id, "x.svg", "image/svg+xml", "<html></html>");
    expect(badSvg.statusCode).toBe(422);
    const noName = await h.app.inject({
      method: "POST",
      url: `/projects/${id}/files`,
      headers: { "content-type": "text/plain" },
      payload: "hello",
    });
    expect(noName.statusCode).toBe(400);
  });
});
