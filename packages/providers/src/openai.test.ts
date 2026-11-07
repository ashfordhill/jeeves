import { APIError } from "openai";
import { describe, expect, it } from "vitest";
import { createOpenAIProvider, toOpenAIInput, toProviderError } from "./openai.ts";
import type { ModelEvent, ModelRequest } from "./types.ts";

/** A fetch that answers every request with the given server-sent events. */
function sseFetch(events: Record<string, unknown>[], seen: unknown[] = []): typeof fetch {
  return async (_url, init) => {
    seen.push(JSON.parse(String(init?.body)));
    const body = events
      .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      .join("");
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
}

const request: ModelRequest = {
  model: "test-model",
  instructions: "Be brief.",
  tools: [
    {
      name: "getDesign",
      description: "Read the design.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  items: [
    {
      type: "message",
      role: "user",
      content: [
        { type: "text", text: "Hello" },
        { type: "image", mediaType: "image/png", data: "iVBORw0KGgo=" },
      ],
    },
  ],
};

const completed = {
  id: "resp_1",
  object: "response",
  status: "completed",
  output: [
    { type: "reasoning", id: "rs_1", summary: [], encrypted_content: "opaque" },
    {
      type: "message",
      id: "msg_1",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: "Hi there", annotations: [] }],
    },
    { type: "function_call", id: "fc_1", call_id: "call_1", name: "getDesign", arguments: "{}" },
  ],
  usage: {
    input_tokens: 12,
    output_tokens: 5,
    total_tokens: 17,
    input_tokens_details: { cached_tokens: 2 },
    output_tokens_details: { reasoning_tokens: 0 },
  },
};

describe("OpenAI adapter", () => {
  it("streams text, returns tool calls, opaque reasoning, and usage", async () => {
    const seen: unknown[] = [];
    const provider = createOpenAIProvider({
      apiKey: "sk-test",
      fetch: sseFetch(
        [
          { type: "response.output_text.delta", delta: "Hi ", sequence_number: 1 },
          { type: "response.output_text.delta", delta: "there", sequence_number: 2 },
          { type: "response.completed", response: completed, sequence_number: 3 },
        ],
        seen,
      ),
    });
    const events: ModelEvent[] = [];
    const response = await provider.respond(request, { onEvent: (e) => events.push(e) });

    expect(events.map((e) => e.delta).join("")).toBe("Hi there");
    expect(response.text).toBe("Hi there");
    expect(response.stop).toBe("tool-calls");
    expect(response.toolCalls).toEqual([{ callId: "call_1", name: "getDesign", arguments: "{}" }]);
    expect(response.items.map((i) => i.type)).toEqual(["opaque", "message", "tool-call"]);
    expect(response.usage).toEqual({ inputTokens: 12, outputTokens: 5, cachedInputTokens: 2 });

    const body = seen[0] as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "test-model",
      instructions: "Be brief.",
      store: false,
      stream: true,
      include: ["reasoning.encrypted_content"],
      tools: [
        {
          type: "function",
          name: "getDesign",
          strict: true,
          parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
        },
      ],
    });
    expect(body.input).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "Hello" },
          { type: "input_image", image_url: "data:image/png;base64,iVBORw0KGgo=", detail: "auto" },
        ],
      },
    ]);
  });

  it("maps tool calls, results, assistant text, and only its own opaque items", () => {
    expect(
      toOpenAIInput(
        [
          { type: "message", role: "assistant", content: [{ type: "text", text: "Done." }] },
          { type: "tool-call", callId: "c1", name: "getDesign", arguments: "{}" },
          { type: "tool-result", callId: "c1", output: '{"ok":true}' },
          { type: "opaque", provider: "openai", data: { type: "reasoning", id: "rs_1" } },
          { type: "opaque", provider: "other", data: { anything: true } },
        ],
        request.tools,
      ),
    ).toEqual([
      { role: "assistant", content: "Done." },
      { type: "function_call", call_id: "c1", name: "getDesign", arguments: "{}" },
      { type: "function_call_output", call_id: "c1", output: '{"ok":true}' },
      { type: "reasoning", id: "rs_1" },
    ]);
  });

  it("classifies API errors so callers can stop on auth and quota failures", () => {
    const err = (status: number, code?: string) =>
      toProviderError(
        APIError.generate(status, { error: { message: "nope", code } }, "nope", new Headers()),
      );
    expect(err(401).kind).toBe("auth");
    expect(err(401).blocksProvider).toBe(true);
    expect(err(429, "insufficient_quota").kind).toBe("quota");
    expect(err(429).kind).toBe("rate-limit");
    expect(err(429).blocksProvider).toBe(false);
    expect(err(500).kind).toBe("unavailable");
    expect(err(400).kind).toBe("bad-request");
  });

  it("reports a rejected key from the HTTP layer as an auth error", async () => {
    const provider = createOpenAIProvider({
      apiKey: "sk-bad",
      maxRetries: 0,
      fetch: async () =>
        new Response(JSON.stringify({ error: { message: "Incorrect API key" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    });
    await expect(provider.respond(request)).rejects.toMatchObject({ kind: "auth" });
  });

  it("refuses unaudited schemas before transport and malformed wire calls before dispatch", async () => {
    let fetched = false;
    const provider = createOpenAIProvider({
      apiKey: "sk-test",
      fetch: async () => {
        fetched = true;
        throw new Error("Must not fetch");
      },
    });
    await expect(
      provider.respond({
        ...request,
        tools: [
          {
            name: "bad",
            description: "",
            parameters: { type: "object", properties: {}, additionalProperties: false, $ref: "#" },
          },
        ],
      }),
    ).rejects.toMatchObject({ kind: "unsupported", message: expect.stringContaining("bad") });
    expect(fetched).toBe(false);
    for (const [name, argumentsJson] of [
      ["getDesign", '{"extra":true}'],
      ["getDesign", "{broken"],
      ["unknown", "{}"],
    ]) {
      const malformed = createOpenAIProvider({
        apiKey: "sk-test",
        fetch: sseFetch([
          {
            type: "response.completed",
            response: {
              ...completed,
              output: [{ type: "function_call", call_id: "c", name, arguments: argumentsJson }],
            },
          },
        ]),
      });
      await expect(malformed.respond(request)).rejects.toMatchObject({ kind: "bad-request" });
    }
  });
});
