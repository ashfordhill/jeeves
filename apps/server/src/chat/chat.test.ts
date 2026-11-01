import { readFileSync } from "node:fs";
import {
  CALLER_NOTE_PREFIX,
  createFakeProvider,
  type FakeProvider,
  type ModelItem,
  type ModelRequest,
  type Script,
  type ScriptByMessage,
  type ScriptStep,
} from "@jeeves/providers";
import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  architectureProofOperations,
  type DesignDocument,
  designSchema,
  type OperationInput,
  type PatternRequestInput,
  previewArchitecturePattern,
  proofSteps,
  reviewArchitecture,
} from "@jeeves/spec";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";
import { rasterizeSvg } from "./files.ts";
import type { ChatEvent, ChatTurn, ModelSource } from "./service.ts";

const linkShortener = designSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../../fixtures/designs/link-shortener.json", import.meta.url),
      "utf8",
    ),
  ),
);

/** The link-shortener fixture as one batch: elements, then connections. */
const linkShortenerOps: OperationInput[] = [
  ...linkShortener.elements.map((element) => ({ op: "addElement" as const, element })),
  ...linkShortener.connections.map((connection) => ({ op: "connect" as const, connection })),
];

const service = (id: string, name = id): OperationInput => ({
  op: "addElement",
  element: { id, name, template: { id: "http-service", version: "0.1.0" } },
});

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
    layout: async (id: string) =>
      (await call("GET", `/projects/${id}/layout`)).body.layout as {
        items: Record<string, { x: number; y: number }>;
      },
    /** Sends a chat message and returns the streamed events. */
    async chat(
      id: string,
      message: string,
      extra: { fileIds?: string[]; selection?: string[] } = {},
    ) {
      const res = await call("POST", `/projects/${id}/chat`, { message, ...extra });
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
        layout: done.layout,
      };
    },
  };
}

/** Wraps a fake provider so a test can act between model calls. */
function withHook(
  steps: ScriptStep[],
  hook: (call: number) => Promise<void> | void,
): { models: ModelSource; provider: FakeProvider } {
  const provider = createFakeProvider(steps);
  const models: ModelSource = () => ({
    model: "fake-model",
    provider: {
      ...provider,
      respond: async (request, options) => {
        await hook(provider.requests.length);
        return provider.respond(request, options);
      },
    },
  });
  return { models, provider };
}

function textOf(item: ModelItem | undefined): string {
  if (item?.type !== "message") return "";
  return item.content.map((p) => (p.type === "text" ? p.text : "")).join("\n");
}

describe("design chat", () => {
  it('turns "make me a link shortener" into valid elements and connections as one undo step', async () => {
    const h = harness([
      {
        text: "Let me check the templates.",
        toolCalls: [{ name: "listTemplates", arguments: {} }],
      },
      {
        toolCalls: [
          { name: "describeTemplate", arguments: { id: "http-service" } },
          { name: "applyOperations", arguments: { ops: linkShortenerOps } },
        ],
      },
      { text: "I added a links service with a REST API, its database, and a web app." },
    ]);
    const id = await h.project();
    const { events, turn, state, layout } = await h.chat(
      id,
      "Make me a link shortener like bit.ly",
    );

    expect(events[0]).toMatchObject({ type: "turn", turn: { status: "running" } });
    const streamed = events.flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("");
    expect(streamed).toBe(
      "Let me check the templates.\n\nI added a links service with a REST API, its database, and a web app.",
    );
    expect(turn).toMatchObject({
      status: "done",
      reply: streamed,
      error: null,
      model: "fake-model",
    });
    expect(turn.activity.map((a) => a.summary)).toEqual([
      "Listed templates",
      "Read template HTTP service",
      "Prepared 5 changes",
      "Applied 5 changes as one undo step",
    ]);
    expect(turn.usage).toEqual({ inputTokens: 300, outputTokens: 60, known: true });

    // Valid: every element and connection is there, with no findings.
    expect(state.design.elements.map((e) => e.id)).toEqual(["links", "links-db", "web"]);
    expect(state.design.connections.map((c) => c.kind)).toEqual(["uses-database", "calls"]);
    expect(state.findings).toEqual([]);
    expect([...turn.changed].sort()).toEqual(
      ["links", "links-db", "links-uses-db", "web", "web-calls-links"].sort(),
    );

    // One operation, from chat, and it's the step undo would revert.
    expect(state.history.latestEdit).toBe(turn.operationId);
    const undone = await h.call("POST", `/projects/${id}/undo`, {
      baseRevision: state.design.revision,
    });
    expect(undone.status).toBe(200);
    expect(undone.body.design.elements).toEqual([]);
    expect(undone.body.history.canUndo).toBe(false);

    // New elements were auto-placed without overlapping each other.
    const placed = ["links", "links-db", "web"].map((e) => layout.items[e]);
    expect(placed.every(Boolean)).toBe(true);
    expect(new Set(placed.map((p) => `${p?.x},${p?.y}`)).size).toBe(3);
    expect((await h.layout(id)).items).toEqual(layout.items);

    // The model saw the rules, the tools, the context, and the message.
    const first = h.requests[0] as ModelRequest;
    expect(first.tools.map((t) => t.name)).toEqual([
      "listTemplates",
      "describeTemplate",
      "listPlannedCapabilities",
      "describePlannedCapability",
      "listArchitectureLibrary",
      "describeArchitectureLibrary",
      "previewArchitectureLibrary",
      "applyArchitectureLibrary",
      "listArchitecturePatterns",
      "listArchitectureStudies",
      "previewArchitectureStudyStage",
      "applyArchitectureStudyStage",
      "describeArchitecturePattern",
      "previewArchitecturePattern",
      "applyArchitecturePattern",
      "getDesign",
      "getArchitectureContracts",
      "getArchitectureReview",
      "getArchitectureAnnotationDraft",
      "createTargetWorkspace",
      "reviewSubtype",
      "applyOperations",
      "validateDesign",
      "explainFinding",
      "askUser",
    ]);
    expect(first.instructions).toMatch(/Never invent template IDs/);
    expect(textOf(first.items[0])).toMatch(/^\[Jeeves\] Context.*http-service@0\.4\.0/s);
    expect(textOf(first.items[0])).toMatch(/The design is empty/);
    expect(textOf(first.items[1])).toBe("Make me a link shortener like bit.ly");

    // Persisted, and sent as history with the next message.
    const listed = await h.call("GET", `/projects/${id}/chat`);
    expect(listed.body.turns).toEqual([turn]);
  });

  it("plans bit.ly C1, C2 and C3 through catalog tools in one persistent undo step", async () => {
    const script = JSON.parse(
      readFileSync(new URL("../../../../fixtures/chat/e2e-script.json", import.meta.url), "utf8"),
    ) as ScriptByMessage;
    const steps = script.turns.find((turn) => turn.match === "Plan an app like bit.ly")!.steps;
    const h = harness(steps);
    const id = await h.project();
    const { turn, state } = await h.chat(id, "Plan an app like bit.ly");
    expect(turn.status).toBe("done");
    expect(turn.activity.every((activity) => activity.ok)).toBe(true);
    expect(state.design.revision).toBe(1);
    expect(state.design.elements.map((element) => element.planned)).toEqual([
      "browser-client",
      "application-api",
      "relational-store",
    ]);
    expect(
      state.design.elements.every(
        (element) => element.template === null && element.description && element.technology,
      ),
    ).toBe(true);
    expect(
      state.design.connections.every(
        (connection) => connection.planned?.label && connection.planned.protocol,
      ),
    ).toBe(true);
    expect(state.design.architecture?.nodes.map((node) => node.kind)).toEqual([
      "person",
      "person",
      "external-system",
    ]);
    expect(state.design.architecture?.components?.map((component) => component.capability)).toEqual(
      ["domain-module", "authorization-module", "analytics-module"],
    );
    expect(state.findings).toHaveLength(8);
    expect(state.findings.every((finding) => finding.code === "NEEDS_TEMPLATE")).toBe(true);
    expect(turn.activity.at(-1)?.summary).toBe("Applied 6 changes as one undo step");
    expect((await h.design(id)).design).toEqual(state.design);
    // The model sees every catalog option through the detail tools and pending C3 findings.
    const toolResults = h.requests.flatMap((request) =>
      request.items
        .filter((item) => item.type === "tool-result")
        .map((item) => JSON.parse(item.output)),
    );
    expect(toolResults).toContainEqual(
      expect.objectContaining({
        capability: expect.objectContaining({ id: "browser-client" }),
        configSchema: expect.objectContaining({
          properties: expect.objectContaining({ audience: expect.any(Object) }),
        }),
      }),
    );
    const undone = await h.call("POST", `/projects/${id}/undo`, { baseRevision: 1 });
    expect(undone.body.design).toMatchObject({ elements: [], connections: [] });
    expect(undone.body.design.architecture).toBeUndefined();
    expect(undone.body.history.canUndo).toBe(false);
    const redone = await h.call("POST", `/projects/${id}/redo`, { baseRevision: 2 });
    expect(redone.body.design).toEqual({ ...state.design, revision: 3 });
    // The next turn receives the complete saved C1/C3, planned IDs/options and labels.
    const followup = harness([{ text: "These capabilities remain planned." }]);
    await followup.chat(id, "Review this plan");
    const context = followup.requests[0]!.items.map(textOf).join("\n");
    expect(context).toContain("planned:application-api (no runtime)");
    expect(context).toContain(JSON.stringify(state.design.architecture));
    expect(context).toContain("Reads and writes links and click events");
  });

  it('turns an unknown capability into a "needs a template" element', async () => {
    const sms = {
      id: "sms",
      name: "SMS gateway",
      template: { id: "sms-gateway", version: "0.1.0" },
      notes: "Send a text when a link passes 1000 clicks.",
    };
    const h = harness([
      {
        toolCalls: [
          { name: "applyOperations", arguments: { ops: [{ op: "addElement", element: sms }] } },
        ],
      },
      {
        toolCalls: [
          {
            name: "applyOperations",
            arguments: { ops: [{ op: "addElement", element: { ...sms, template: null } }] },
          },
        ],
      },
      { text: "There's no SMS template yet, so I added it as an element that needs a template." },
    ]);
    const id = await h.project();
    const { turn, state } = await h.chat(id, "Text me when a link gets popular");

    // The invented template was refused, and the model was told why.
    const refusal = JSON.parse(
      (h.requests[1]?.items.at(-1) as { output: string } | undefined)?.output ?? "",
    );
    expect(refusal).toMatchObject({ ok: false, errors: [{ code: "UNKNOWN_TEMPLATE" }] });
    expect(turn.activity[0]).toMatchObject({
      ok: false,
      summary: expect.stringMatching(/^Edit refused/),
    });

    expect(state.design.elements).toEqual([
      { ...sms, template: null, config: {}, attachments: [] },
    ]);
    expect(state.findings).toMatchObject([{ code: "NEEDS_TEMPLATE", target: { element: "sms" } }]);
  });

  it("replays its edits when the canvas changed something unrelated meanwhile", async () => {
    let id = "";
    let h: ReturnType<typeof harness> | undefined;
    const { models } = withHook(
      [
        { toolCalls: [{ name: "applyOperations", arguments: { ops: [service("api")] } }] },
        { text: "Added the API service." },
      ],
      async (call) => {
        // A canvas edit lands while the model is answering the second time.
        if (call === 1) {
          const current = await h?.design(id);
          await h?.call("POST", `/projects/${id}/operations`, {
            baseRevision: current?.design.revision,
            ops: [service("billing")],
            source: "canvas",
          });
        }
      },
    );
    h = harness({ models });
    id = await h.project();
    const { turn, state } = await h.chat(id, "Add an API service");

    expect(turn.status).toBe("done");
    expect(state.design.elements.map((e) => e.id)).toEqual(["billing", "api"]);
    expect(turn.activity.map((a) => a.summary)).toContain(
      "The design changed meanwhile; replayed the edits on revision 1",
    );
    expect(turn.changed).toEqual(["api"]);
    // Two edits: the canvas one and the chat turn.
    expect(state.design.revision).toBe(2);
  });

  it("redoes its edits after re-reading when they no longer fit the newer design", async () => {
    let id = "";
    let h: ReturnType<typeof harness> | undefined;
    const steps: ScriptStep[] = [
      {
        toolCalls: [
          {
            name: "applyOperations",
            arguments: {
              ops: [
                {
                  op: "addElement",
                  element: { id: "db", name: "DB", template: { id: "postgres", version: "0.1.0" } },
                },
                {
                  op: "connect",
                  connection: {
                    id: "api-db",
                    kind: "uses-database",
                    from: { element: "api" },
                    to: { element: "db" },
                  },
                },
              ],
            },
          },
        ],
      },
      { text: "Connected the API to a new database." },
      { toolCalls: [{ name: "getDesign", arguments: {} }] },
      {
        toolCalls: [
          {
            name: "applyOperations",
            arguments: {
              ops: [
                service("api2", "API"),
                {
                  op: "addElement",
                  element: { id: "db", name: "DB", template: { id: "postgres", version: "0.1.0" } },
                },
                {
                  op: "connect",
                  connection: {
                    id: "api-db",
                    kind: "uses-database",
                    from: { element: "api2" },
                    to: { element: "db" },
                  },
                },
              ],
            },
          },
        ],
      },
      { text: "The API had been deleted, so I recreated it and connected it to the database." },
    ];
    const { models, provider } = withHook(steps, async (call) => {
      // Someone deletes the API service before the model finishes.
      if (call === 1) {
        const current = await h?.design(id);
        await h?.call("POST", `/projects/${id}/operations`, {
          baseRevision: current?.design.revision,
          ops: [{ op: "removeElement", id: "api" }],
          source: "canvas",
        });
      }
    });
    h = harness({ models });
    id = await h.project();
    await h.call("POST", `/projects/${id}/operations`, { baseRevision: 0, ops: [service("api")] });

    const { turn, state } = await h.chat(id, "Give the API a database");
    expect(turn.status).toBe("done");
    expect(turn.reply).toMatch(/recreated it/);

    // The model was told, re-read the design, and redid the edit.
    const note = (provider.requests[2] as ModelRequest).items.at(-1);
    expect(textOf(note)).toMatch(
      new RegExp(`^\\${CALLER_NOTE_PREFIX} Your edits were not applied`),
    );
    expect(turn.activity.map((a) => a.summary)).toEqual([
      "Prepared 2 changes",
      "The design changed meanwhile; redoing the edits",
      "Read the design",
      "Prepared 3 changes",
      "Applied 3 changes as one undo step",
    ]);
    expect(state.design.elements.map((e) => e.id)).toEqual(["api2", "db"]);
    expect(state.design.connections).toMatchObject([
      { from: { element: "api2" }, to: { element: "db" } },
    ]);
    expect(state.findings).toEqual([]);

    // Still one undo step for the turn: undo brings back the canvas state (no elements).
    const undone = await h.call("POST", `/projects/${id}/undo`, {
      baseRevision: state.design.revision,
    });
    expect(undone.body.design.elements).toEqual([]);
  });

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
    expect(second.turn.reply).toBe("Noted: no accounts.");
    const history = (h.requests[1] as ModelRequest).items.map(textOf);
    expect(history[0]).toBe("Make me a link shortener");
    expect(history[1]).toMatch(
      /One question first\.\n\[Asked: Do people need accounts\? Choices: No accounts \| Email login\]/,
    );
    expect(history.at(-1)).toBe("No accounts");
  });

  it("fails the turn without changing anything when the provider fails or isn't set up", async () => {
    const h = harness([
      { toolCalls: [{ name: "applyOperations", arguments: { ops: [service("api")] } }] },
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
      payload: { message: "hi" },
    });
    const done = JSON.parse(res.body.trim().split("\n").at(-1) as string) as { turn: ChatTurn };
    expect(done.turn.status).toBe("failed");
    expect(done.turn.error).toMatch(/No OpenAI API key is set/);
  });

  it("refuses unknown projects and files", async () => {
    const h = harness([]);
    const id = await h.project();
    const missing = "00000000-0000-4000-8000-000000000000";
    expect((await h.call("POST", `/projects/${missing}/chat`, { message: "hi" })).status).toBe(404);
    const unknownFile = await h.call("POST", `/projects/${id}/chat`, {
      message: "hi",
      fileIds: [missing],
    });
    expect(unknownFile).toMatchObject({ status: 422, body: { code: "UNKNOWN_FILE" } });
    expect((await h.call("POST", `/projects/${id}/chat`, { message: "  " })).status).toBe(400);
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

it("scripted pattern application matches mouse expansion and is one undo step with all discovery tools", async () => {
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/pattern-composition.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const req: PatternRequestInput = {
    pattern: "cached-public-lookup",
    version: "1.0.0",
    instanceId: "lookup",
    baseRevision: 1,
    config: { name: "Public redirect", maxAgeSeconds: 15 },
    roles: { api: { mode: "reuse", id: "api" }, store: { mode: "reuse", id: "store" } },
  };
  const h = harness([
    {
      toolCalls: [
        { name: "listArchitecturePatterns", arguments: {} },
        { name: "describeArchitecturePattern", arguments: { id: req.pattern } },
        { name: "previewArchitecturePattern", arguments: req },
      ],
    },
    { toolCalls: [{ name: "applyArchitecturePattern", arguments: req }] },
    {
      text: "Added cached public lookup with source fallback and bounded disable propagation as design intent.",
    },
  ]);
  const id = await h.project();
  await h.call("POST", `/projects/${id}/operations`, {
    baseRevision: 0,
    ops: [
      ...base.elements.map((element) => ({ op: "addElement", element })),
      { op: "setArchitecture", architecture: base.architecture },
    ],
  });
  const before = (await h.design(id)).design;
  const preview = previewArchitecturePattern(before, req, builtinRegistry());
  const expected = applyOperations(before, preview.ops, builtinRegistry());
  expect(expected.ok).toBe(true);
  const { state, turn } = await h.chat(
    id,
    "Add cached public lookup using the selected API and store.",
  );
  expect(turn.status).toBe("done");
  expect(turn.question).toBeNull();
  if (expected.ok) expect(state.design).toEqual(expected.design);
  const undone = await h.call("POST", `/projects/${id}/undo`, {
    baseRevision: state.design.revision,
  });
  expect(undone.body.design.elements).toEqual(before.elements);
  expect(undone.body.design.architecture).toEqual(before.architecture);
  const redone = await h.call("POST", `/projects/${id}/redo`, {
    baseRevision: undone.body.design.revision,
  });
  expect(redone.body.design.architecture).toEqual(state.design.architecture);
});

it("never replays a pattern snapshot over concurrent architecture edits", async () => {
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/pattern-composition.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const req = {
    pattern: "tenant-workspace-access",
    version: "1.0.0",
    instanceId: "tenant",
    baseRevision: 1,
    config: { name: "Tenant access" },
    roles: { api: { mode: "reuse", id: "api" }, store: { mode: "reuse", id: "store" } },
  };
  let h: ReturnType<typeof harness>;
  let id: string;
  const { models } = withHook(
    [
      { toolCalls: [{ name: "applyArchitecturePattern", arguments: req }] },
      { text: "Prepared tenant access." },
      { text: "The revision changed; the stale pattern was not applied." },
    ],
    async (call) => {
      if (call === 1) {
        const current = (await h.design(id)).design;
        const architecture = structuredClone(current.architecture!);
        architecture.system.description = "Concurrent context customization";
        expect(
          (
            await h.call("POST", `/projects/${id}/operations`, {
              baseRevision: current.revision,
              ops: [{ op: "setArchitecture", architecture }],
            })
          ).status,
        ).toBe(200);
      }
    },
  );
  h = harness({ models });
  id = await h.project();
  await h.call("POST", `/projects/${id}/operations`, {
    baseRevision: 0,
    ops: [
      ...base.elements.map((element) => ({ op: "addElement", element })),
      { op: "setArchitecture", architecture: base.architecture },
    ],
  });
  const { state, turn } = await h.chat(id, "Add tenant access with the selected hosts.");
  expect(state.design.revision).toBe(2);
  expect(state.design.architecture!.system.description).toBe("Concurrent context customization");
  expect(state.design.architecture!.patternInstances).toBeUndefined();
  expect(turn.operationId).toBeNull();
  expect(
    turn.activity.some((a) => a.summary === "Pattern revision conflict; nothing was added"),
  ).toBe(true);
});

it("records requirement-based review decisions in one scripted chat undo step", async () => {
  const { reviewArchitecture } = await import("@jeeves/spec");
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/architecture-review.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const cache = base.architecture!.reviewRequirements!.find((r) => r.kind === "cache")!;
  if (cache.kind === "cache") delete cache.update;
  const f = reviewArchitecture(base).findings[0]!;
  const architecture = structuredClone(base.architecture!);
  architecture.decisions = [
    {
      id: "exploration-risk",
      name: "Exploration risk",
      context: f.message,
      decision: "Accept bounded exploration risk",
      consequence: "Resolve before implementation",
      status: "Accepted",
      links: f.inputs,
      acknowledgements: [{ finding: f.id, fingerprint: f.fingerprint }],
    },
  ];
  const op = { op: "setArchitecture" as const, architecture };
  const h = harness([
    { toolCalls: [{ name: "getArchitectureReview", arguments: {} }] },
    { toolCalls: [{ name: "applyOperations", arguments: { ops: [op] } }] },
    { text: "Recorded the scoped tradeoff. Implementation remains unverified." },
  ]);
  const id = await h.project();
  await h.call("POST", `/projects/${id}/operations`, {
    baseRevision: 0,
    ops: [
      ...base.elements.map((element) => ({ op: "addElement", element })),
      ...base.connections.map((connection) => ({ op: "connect", connection })),
      { op: "setArchitecture", architecture: base.architecture },
    ],
  });
  const before = (await h.design(id)).design;
  const { state, turn } = await h.chat(
    id,
    "Accept the stated cache update gap while exploring, with its consequence.",
  );
  const mouse = applyOperations(before, [op], builtinRegistry());
  expect(mouse.ok).toBe(true);
  if (mouse.ok) expect(state.design).toEqual(mouse.design);
  expect(reviewArchitecture(state.design).complete).toBe(true);
  expect(turn.operationId).not.toBeNull();
  const undone = await h.call("POST", `/projects/${id}/undo`, {
    baseRevision: state.design.revision,
  });
  expect(undone.body.design.architecture).toEqual(before.architecture);
  const redone = await h.call("POST", `/projects/${id}/redo`, {
    baseRevision: undone.body.design.revision,
  });
  expect(redone.body.design.architecture).toEqual(state.design.architecture);
});

it("refuses stale chat review snapshots instead of overwriting concurrent architecture", async () => {
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/architecture-review.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const architecture = structuredClone(base.architecture!);
  architecture.decisions = [
    {
      id: "open-choice",
      name: "Open choice",
      context: "Compare options",
      decision: "Unresolved",
      consequence: "Needs a choice",
      status: "Unresolved",
      links: [{ kind: "system", id: "system" }],
      acknowledgements: [],
    },
  ];
  let h: ReturnType<typeof harness>;
  let id: string;
  const { models } = withHook(
    [
      {
        toolCalls: [
          {
            name: "applyOperations",
            arguments: { ops: [{ op: "setArchitecture", architecture }] },
          },
        ],
      },
      { text: "Prepared review." },
      { text: "The review changed. Read current inputs again." },
    ],
    async (call) => {
      if (call === 1) {
        const current = (await h.design(id)).design;
        const concurrent = structuredClone(current.architecture!);
        concurrent.system.description = "Concurrent design context";
        expect(
          (
            await h.call("POST", `/projects/${id}/operations`, {
              baseRevision: current.revision,
              ops: [{ op: "setArchitecture", architecture: concurrent }],
            })
          ).status,
        ).toBe(200);
      }
    },
  );
  h = harness({ models });
  id = await h.project();
  await h.call("POST", `/projects/${id}/operations`, {
    baseRevision: 0,
    ops: [
      ...base.elements.map((element) => ({ op: "addElement", element })),
      ...base.connections.map((connection) => ({ op: "connect", connection })),
      { op: "setArchitecture", architecture: base.architecture },
    ],
  });
  const { state, turn } = await h.chat(id, "Record the open design choice.");
  expect(state.design.architecture!.system.description).toBe("Concurrent design context");
  expect(state.design.architecture!.decisions).toBeUndefined();
  expect(turn.operationId).toBeNull();
  expect(
    turn.activity.some((a) => a.summary === "Review revision conflict; nothing was saved"),
  ).toBe(true);
});

it("creates a planning target through scripted chat without source edits or inherited history", async () => {
  const h = harness([
    {
      toolCalls: [
        { name: "createTargetWorkspace", arguments: { name: "Chat target", baseRevision: 1 } },
      ],
    },
    { text: "Prepared the separate planning workspace." },
  ]);
  try {
    const id = await h.project();
    await h.call("POST", `/projects/${id}/operations`, { baseRevision: 0, ops: linkShortenerOps });
    const before = await h.design(id);
    const result = await h.chat(id, "Create a target copy");
    expect(result.turn.status).toBe("done");
    expect(result.turn.operationId).toBeNull();
    expect(result.turn.reply).toContain("Planning target created:");
    const list = (await h.call("GET", "/projects")).body.projects;
    const target = list.find(
      (p: { target?: { sourceProjectId: string } }) => p.target?.sourceProjectId === id,
    );
    expect(target).toMatchObject({
      name: "Chat target",
      revision: 0,
      outputDir: null,
      target: { sourceRevision: 1 },
    });
    expect((await h.design(target.id)).design.elements).toEqual(before.design.elements);
    expect(await h.design(id)).toEqual(before);
  } finally {
    await h.app.close();
  }
});

it("creates no chat target on a stale saved source revision", async () => {
  let id = "";
  let edited = false;
  const scripted = withHook(
    [
      {
        toolCalls: [
          {
            name: "createTargetWorkspace",
            arguments: { name: "Stale chat target", baseRevision: 0 },
          },
        ],
      },
      { text: "Finish." },
      { text: "The source changed; a fresh baseline is needed." },
    ],
    async (call) => {
      if (call === 1 && !edited) {
        edited = true;
        await h.call("POST", `/projects/${id}/operations`, {
          baseRevision: 0,
          ops: [service("concurrent")],
        });
      }
    },
  );
  const h = harness(scripted);
  try {
    id = await h.project();
    const result = await h.chat(id, "Copy target");
    expect(result.turn.operationId).toBeNull();
    expect(
      (await h.call("GET", "/projects")).body.projects.some(
        (p: { name: string }) => p.name === "Stale chat target",
      ),
    ).toBe(false);
    expect((await h.design(id)).design.elements.map((e) => e.id)).toEqual(["concurrent"]);
  } finally {
    await h.app.close();
  }
});

it("does not replay sourced annotation drafts over concurrent edits", async () => {
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/generated-workspace.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const { suggestArchitectureAnnotations } = await import("@jeeves/spec");
  const architecture = suggestArchitectureAnnotations({ ...base, revision: 1 });
  let id = "",
    edited = false;
  const script = withHook(
    [
      { toolCalls: [{ name: "getArchitectureAnnotationDraft", arguments: {} }] },
      {
        toolCalls: [
          {
            name: "applyOperations",
            arguments: { ops: [{ op: "setArchitecture", architecture }] },
          },
        ],
      },
      { text: "Save annotations." },
      { text: "The annotation sources changed; a fresh draft is required." },
    ],
    async (call) => {
      if (call === 2 && !edited) {
        edited = true;
        await h.call("POST", `/projects/${id}/operations`, {
          baseRevision: 1,
          ops: [{ op: "setNotes", id: "inventory", notes: "Concurrent note" }],
        });
      }
    },
  );
  const h = harness(script);
  try {
    id = await h.project();
    await h.call("POST", `/projects/${id}/operations`, {
      baseRevision: 0,
      ops: [
        ...base.elements.map((element) => ({ op: "addElement", element })),
        ...base.connections.map((connection) => ({ op: "connect", connection })),
      ],
    });
    const result = await h.chat(id, "Suggest annotations");
    expect(result.turn.operationId).toBeNull();
    expect((await h.design(id)).design.architecture).toBeUndefined();
    expect((await h.design(id)).design.elements[0]?.notes).toBe("Concurrent note");
  } finally {
    await h.app.close();
  }
});

it("saves the same sourced annotation draft as mouse, including the saved project name, in one undo step", async () => {
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/generated-workspace.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const { suggestArchitectureAnnotations } = await import("@jeeves/spec");
  const h = harness((request, call) => {
    if (call === 0)
      return { toolCalls: [{ name: "getArchitectureAnnotationDraft", arguments: {} }] };
    if (call === 1) {
      const result = request.items.findLast((item) => item.type === "tool-result");
      if (result?.type !== "tool-result") throw new Error("Missing annotation preview");
      const draft = JSON.parse(result.output);
      return {
        toolCalls: [
          {
            name: "applyOperations",
            arguments: { ops: [{ op: "setArchitecture", architecture: draft.architecture }] },
          },
        ],
      };
    }
    return { text: "Saved sourced, editable annotations." };
  });
  try {
    const id = await h.project();
    await h.call("POST", `/projects/${id}/operations`, {
      baseRevision: 0,
      ops: [
        ...base.elements.map((element) => ({ op: "addElement", element })),
        ...base.connections.map((connection) => ({ op: "connect", connection })),
      ],
    });
    const before = await h.design(id);
    const result = await h.chat(id, "Suggest sourced responsibilities");
    expect(result.turn.status).toBe("done");
    expect(result.turn.operationId).not.toBeNull();
    expect(result.state.design.architecture).toEqual(
      suggestArchitectureAnnotations(before.design, "Chat test"),
    );
    expect(result.state.design.revision).toBe(2);
    const undone = await h.call("POST", `/projects/${id}/undo`, { baseRevision: 2 });
    expect(undone.body.design.architecture).toBeUndefined();
  } finally {
    await h.app.close();
  }
});

it.each([false, true])(
  "saves deployment plans as one mouse-equivalent undo step and refuses stale replay (concurrent=%s)",
  async (concurrent) => {
    const base = designSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../../../../fixtures/designs/architecture-deployments.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const architecture = base.architecture!;
    let id = "";
    const scripted = withHook(
      [
        { toolCalls: [{ name: "getDesign", arguments: {} }] },
        {
          toolCalls: [
            {
              name: "applyOperations",
              arguments: { ops: [{ op: "setArchitecture", architecture }] },
            },
          ],
        },
        { text: "Save planned deployment intent." },
        { text: "Read the current design before trying again." },
      ],
      async (call) => {
        if (concurrent && call === 2)
          await h.call("POST", `/projects/${id}/operations`, {
            baseRevision: 1,
            ops: [{ op: "setNotes", id: "redirect", notes: "Concurrent source edit" }],
          });
      },
    );
    const h = harness(scripted);
    try {
      id = await h.project();
      const initial = structuredClone(architecture);
      delete initial.deployments;
      expect(
        (
          await h.call("POST", `/projects/${id}/operations`, {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              ...base.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: initial },
            ],
          })
        ).status,
      ).toBe(200);
      const before = (await h.design(id)).design;
      const result = await h.chat(id, "Save the hosted deployment plan");
      const actual = (await h.design(id)).design;
      if (concurrent) {
        expect(result.turn.operationId).toBeNull();
        expect(actual.architecture?.deployments).toBeUndefined();
        expect(actual.elements[0]!.notes).toBe("Concurrent source edit");
      } else {
        const mouse = applyOperations(
          before,
          [{ op: "setArchitecture", architecture }],
          builtinRegistry(),
        );
        expect(mouse.ok).toBe(true);
        if (mouse.ok) expect(actual).toEqual(mouse.design);
        expect(result.turn.operationId).not.toBeNull();
        expect(
          (await h.call("POST", `/projects/${id}/undo`, { baseRevision: 2 })).body.design
            .architecture.deployments,
        ).toBeUndefined();
      }
    } finally {
      await h.app.close();
    }
  },
);

it.each([false, true])(
  "saves scenario expectations as one mouse-equivalent undo step and refuses stale replay (concurrent=%s)",
  async (concurrent) => {
    const base = designSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../../../../fixtures/designs/architecture-scenarios.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const architecture = base.architecture!;
    // Exercise the scenario-specific concurrency guard independently of P51 review guards.
    delete architecture.reviewRequirements;
    delete architecture.decisions;
    for (const scenario of architecture.scenarios!)
      for (const outcome of scenario.outcomes ?? []) {
        outcome.requirements = [];
        outcome.decisions = [];
      }
    let id = "";
    const scripted = withHook(
      [
        { toolCalls: [{ name: "getDesign", arguments: {} }] },
        {
          toolCalls: [
            {
              name: "applyOperations",
              arguments: { ops: [{ op: "setArchitecture", architecture }] },
            },
          ],
        },
        { text: "Save authored scenario expectations." },
        { text: "Read the current design before trying again." },
      ],
      async (call) => {
        if (concurrent && call === 2)
          await h.call("POST", `/projects/${id}/operations`, {
            baseRevision: 1,
            ops: [{ op: "setNotes", id: "redirect", notes: "Concurrent source edit" }],
          });
      },
    );
    const h = harness(scripted);
    try {
      id = await h.project();
      const initial = structuredClone(architecture);
      delete initial.scenarios;
      expect(
        (
          await h.call("POST", `/projects/${id}/operations`, {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              ...base.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: initial },
            ],
          })
        ).status,
      ).toBe(200);
      const before = (await h.design(id)).design;
      const result = await h.chat(id, "Save the scenario expectations");
      const actual = (await h.design(id)).design;
      if (concurrent) {
        expect(result.turn.operationId).toBeNull();
        expect(actual.architecture?.scenarios).toBeUndefined();
        expect(actual.elements.find((e) => e.id === "redirect")!.notes).toBe(
          "Concurrent source edit",
        );
      } else {
        const mouse = applyOperations(
          before,
          [{ op: "setArchitecture", architecture }],
          builtinRegistry(),
        );
        expect(mouse.ok).toBe(true);
        if (mouse.ok) expect(actual).toEqual(mouse.design);
        expect(result.turn.operationId).not.toBeNull();
        expect(
          (await h.call("POST", `/projects/${id}/undo`, { baseRevision: 2 })).body.design
            .architecture.scenarios,
        ).toBeUndefined();
      }
    } finally {
      await h.app.close();
    }
  },
);

it.each(["qrwty", "inventory"] as const)(
  "P56 scripted %s study preserves semantic authoring, open decisions, one undo step and reload",
  async (product) => {
    const scripts = JSON.parse(
      readFileSync(new URL("../../../../fixtures/chat/e2e-script.json", import.meta.url), "utf8"),
    ) as ScriptByMessage;
    const message = `Assemble P56 ${product} study`;
    const steps = scripts.turns.find((t) => t.match === message)!.steps;
    const h = harness(steps);
    const id = await h.project();
    let expected = designSchema.parse({ schemaVersion: 2, revision: 0 });
    for (const stage of proofSteps(product)) {
      const base = { ...expected, revision: 0 };
      const result = applyOperations(
        base,
        architectureProofOperations(base, product, stage.id, builtinRegistry()),
        builtinRegistry(),
      );
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      expected = result.design;
    }
    const { state, turn } = await h.chat(id, message);
    expect(state.design).toEqual(expected);
    expect(turn.operationId).not.toBeNull();
    expect(reviewArchitecture(state.design).unresolvedDecisions).toEqual(["production-objectives"]);
    expect(reviewArchitecture(state.design).complete).toBe(false);
    expect(turn.activity.filter((a) => !a.ok)).toEqual([]);
    const undone = await h.call("POST", `/projects/${id}/undo`, { baseRevision: 1 });
    expect(undone.body.design.elements).toEqual([]);
    const redone = await h.call("POST", `/projects/${id}/redo`, {
      baseRevision: undone.body.design.revision,
    });
    expect(redone.body.design.architecture).toEqual(expected.architecture);
    expect((await h.design(id)).design.architecture).toEqual(expected.architecture);
  },
);

it("P56 study stages refuse stale chat replay and preserve concurrent work", async () => {
  let h: ReturnType<typeof harness>;
  let id: string;
  const { models } = withHook(
    [
      {
        toolCalls: [
          {
            name: "applyArchitectureStudyStage",
            arguments: { product: "qrwty", stage: "start", baseRevision: 0 },
          },
          {
            name: "applyArchitectureStudyStage",
            arguments: { product: "qrwty", stage: "tenant", baseRevision: 0 },
          },
        ],
      },
      { text: "Prepared the supplied study stages." },
      { text: "Concurrent work changed the saved base; no study was replayed." },
    ],
    async (call) => {
      if (call === 1)
        expect(
          (
            await h.call("POST", `/projects/${id}/operations`, {
              baseRevision: 0,
              ops: [service("concurrent")],
            })
          ).status,
        ).toBe(200);
    },
  );
  h = harness({ models });
  id = await h.project();
  const { state, turn } = await h.chat(
    id,
    "Compose the supplied QR study start and tenant stages.",
  );
  expect(state.design.elements.map((e) => e.id)).toEqual(["concurrent"]);
  expect(state.design.architecture).toBeUndefined();
  expect(turn.operationId).toBeNull();
  expect(
    turn.activity.some((a) => a.summary === "Pattern revision conflict; nothing was added"),
  ).toBe(true);
});
