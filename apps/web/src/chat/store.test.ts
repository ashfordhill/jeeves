import { applyOperations, noTemplates, validateDesign } from "@jeeves/spec";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, ChatTurn } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import { fakeApi, TEST_PROJECT } from "../test-api.ts";
import { mediaTypeOf, useChat } from "./store.ts";

const turn = (patch: Partial<ChatTurn>): ChatTurn => ({
  id: 1,
  message: "Add a service",
  files: [],
  selection: [],
  status: "done",
  reply: "Added it.",
  question: null,
  operationId: null,
  changed: [],
  activity: [],
  usage: null,
  model: "fake",
  error: null,
  createdAt: "2026-10-29T00:00:00.000Z",
  ...patch,
});

const ndjson = (events: ChatEvent[]) =>
  new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(""), {
    headers: { "content-type": "application/x-ndjson" },
  });

describe("chat store", () => {
  let api: ReturnType<typeof fakeApi>;
  let posted: unknown[];
  let chatResponse: () => Response;

  beforeEach(async () => {
    api = fakeApi();
    posted = [];
    // The fake server: a chat turn adds one element as one edit, then streams the result.
    chatResponse = () => {
      const result = applyOperations(
        api.state.design,
        [
          {
            op: "addElement",
            element: { id: "api", name: "API", template: { id: "http-service", version: "0.1.0" } },
          },
        ],
        noTemplates,
      );
      if (!result.ok) throw new Error("bad fixture");
      api.state.done.push({ before: api.state.design, after: result.design });
      api.state.design = result.design;
      const state = {
        projectId: TEST_PROJECT,
        design: result.design,
        findings: validateDesign(result.design, noTemplates),
        history: { canUndo: true, canRedo: false, latestEdit: api.state.done.length },
      };
      const done = turn({ operationId: api.state.done.length, changed: ["api"] });
      return ndjson([
        { type: "turn", turn: turn({ status: "running", reply: "" }) },
        { type: "text", delta: "Added " },
        {
          type: "activity",
          activity: { tool: "applyOperations", ok: true, summary: "Prepared 1 change" },
        },
        { type: "text", delta: "it." },
        {
          type: "done",
          turn: done,
          state,
          layout: { schemaVersion: 1, items: { api: { x: 400, y: 80 } } },
        },
      ]);
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), "http://localhost").pathname;
        if (path === `/api/projects/${TEST_PROJECT}/chat`) {
          if (init?.method !== "POST") return Response.json({ turns: [] });
          posted.push(JSON.parse(String(init.body)));
          return chatResponse();
        }
        return api.fetch(input, init);
      }),
    );
    await useDraw.getState().open(TEST_PROJECT);
    useChat.setState({
      projectId: undefined,
      status: "idle",
      turns: [],
      live: undefined,
      draft: "",
      staged: [],
      error: undefined,
    });
    await useChat.getState().load(TEST_PROJECT);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams a turn, hands the design and placed layout to the board, and highlights changes", async () => {
    useDraw.getState().focus({ nodes: [] });
    useChat.getState().setDraft("Add a service");
    const sending = useChat.getState().send();
    expect(useChat.getState().live?.message).toBe("Add a service");
    expect(useChat.getState().draft).toBe("");
    await sending;

    expect(posted).toEqual([{ message: "Add a service", fileIds: [], selection: [] }]);
    const chat = useChat.getState();
    expect(chat.live).toBeUndefined();
    expect(chat.turns).toMatchObject([{ reply: "Added it.", changed: ["api"] }]);

    const draw = useDraw.getState();
    expect(draw.loaded?.design.elements.map((e) => e.id)).toEqual(["api"]);
    expect(draw.loaded?.layout.items.api).toEqual({ x: 400, y: 80 });
    expect(draw.selection).toEqual({ nodes: ["api"], edges: [] });
    expect(draw.focusRequest).toMatchObject({ nodes: ["api"], zoom: true });

    // The turn's undo is the board's newest design step.
    expect(await useDraw.getState().undoEdit(99)).toBe(false);
    expect(await useDraw.getState().undoEdit(1)).toBe(true);
    expect(useDraw.getState().loaded?.design.elements).toEqual([]);
    expect(useDraw.getState().undoSteps).toEqual([]);
  });

  it("keeps the draft and says why when the message can't be sent", async () => {
    chatResponse = () =>
      Response.json({ code: "CHAT_BUSY", message: "Still working." }, { status: 409 });
    useChat.getState().setDraft("Hello");
    await useChat.getState().send();
    expect(useChat.getState()).toMatchObject({
      draft: "Hello",
      error: "Message not sent: Still working.",
      live: undefined,
      turns: [],
    });
  });

  it("sends a clicked choice without touching the draft", async () => {
    useChat.getState().setDraft("half-typed");
    await useChat.getState().send("No accounts");
    expect(posted).toMatchObject([{ message: "No accounts" }]);
    expect(useChat.getState().draft).toBe("half-typed");
  });

  it("knows which files it accepts", () => {
    expect(mediaTypeOf("Brief.MD")).toBe("text/markdown");
    expect(mediaTypeOf("sketch.svg")).toBe("image/svg+xml");
    expect(mediaTypeOf("doc.pdf")).toBeUndefined();
  });
});
