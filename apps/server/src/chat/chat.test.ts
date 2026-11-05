import {
  createFakeProvider,
  type FakeProvider,
  type ModelItem,
  type ModelRequest,
  type Script,
} from "@jeeves/providers";
import type { DesignDocument } from "@jeeves/spec";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";
import { rasterizeSvg } from "./files.ts";
import type { ChatEvent, ChatTurn, ModelSource } from "./service.ts";

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
