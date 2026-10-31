import { readFileSync } from "node:fs";
import {
  CALLER_NOTE_PREFIX,
  createFakeProvider,
  type FakeProvider,
  type ModelItem,
  type ModelRequest,
  type Script,
  type ScriptStep,
} from "@jeeves/providers";
import { type DesignDocument, designSchema, type OperationInput } from "@jeeves/spec";
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
      "getDesign",
      "reviewSubtype",
      "applyOperations",
      "validateDesign",
      "explainFinding",
      "askUser",
    ]);
    expect(first.instructions).toMatch(/Never invent template IDs/);
    expect(textOf(first.items[0])).toMatch(/^\[Jeeves\] Context.*http-service@0\.3\.0/s);
    expect(textOf(first.items[0])).toMatch(/The design is empty/);
    expect(textOf(first.items[1])).toBe("Make me a link shortener like bit.ly");

    // Persisted, and sent as history with the next message.
    const listed = await h.call("GET", `/projects/${id}/chat`);
    expect(listed.body.turns).toEqual([turn]);
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
