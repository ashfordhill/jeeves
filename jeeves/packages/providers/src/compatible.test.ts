import { describe, expect, it } from "vitest";
import { createCompatibleProvider, toCompatibleMessages } from "./compatible.ts";
import { ProviderError } from "./errors.ts";
import type { ModelEvent, ModelItem, ModelRequest } from "./types.ts";

// Made-up host and key: no test reaches the network.
const BASE_URL = "https://llm.example.invalid/v1";
const KEY = "sk-test-not-a-real-key-0000";

type Seen = { url: string; headers: Headers; body: Record<string, unknown> };

/** A fetch that answers each request with the next reply (the last one repeats). */
function replay(replies: (() => Response)[], seen: Seen[] = []): typeof fetch {
  let next = 0;
  return async (input, init) => {
    seen.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    const reply = replies[Math.min(next++, replies.length - 1)];
    if (!reply) throw new Error("no reply");
    return reply();
  };
}

/** A streamed Chat Completions answer: one `data:` event per chunk, then `[DONE]`. */
const stream = (chunks: Record<string, unknown>[]) => () =>
  new Response(
    `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`,
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );

const refusal =
  (status: number, error: Record<string, unknown>, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });

// Chat-completion chunks in the shape OpenAI-compatible hosts stream them.
const chunk = (delta: Record<string, unknown>, finish: string | null = null) => ({
  id: "chatcmpl-test",
  object: "chat.completion.chunk",
  created: 1_762_992_000,
  model: "test-model",
  choices: [{ index: 0, delta, finish_reason: finish }],
});
const usageChunk = (usage: Record<string, unknown>) => ({
  id: "chatcmpl-test",
  object: "chat.completion.chunk",
  created: 1_762_992_000,
  model: "test-model",
  choices: [],
  usage,
});

const getDesign = {
  name: "getDesign",
  description: "Read the design.",
  parameters: {
    type: "object",
    properties: { scope: { type: "string" } },
    required: ["scope"],
    additionalProperties: false,
  },
};

const hello: ModelItem = {
  type: "message",
  role: "user",
  content: [{ type: "text", text: "Hello" }],
};
const request = (items: ModelItem[] = [hello]): ModelRequest => ({
  model: "test-model",
  instructions: "Be brief.",
  tools: [getDesign],
  items,
});

const provider = (fetch: typeof globalThis.fetch) =>
  createCompatibleProvider({ name: "Example host", baseURL: BASE_URL, apiKey: KEY, fetch });

describe("custom endpoint adapter", () => {
  it("answers a text reply and sends the instructions, the tools and the key", async () => {
    const seen: Seen[] = [];
    const response = await provider(
      replay(
        [
          stream([
            chunk({ role: "assistant", content: "Hello there." }),
            chunk({}, "stop"),
            usageChunk({ prompt_tokens: 40, completion_tokens: 3, total_tokens: 43 }),
          ]),
        ],
        seen,
      ),
    ).respond(request());

    expect(response).toEqual({
      items: [
        { type: "message", role: "assistant", content: [{ type: "text", text: "Hello there." }] },
      ],
      text: "Hello there.",
      toolCalls: [],
      usage: { inputTokens: 40, outputTokens: 3 },
      stop: "end",
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe(`${BASE_URL}/chat/completions`);
    expect(seen[0]?.headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(seen[0]?.body).toMatchObject({
      model: "test-model",
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hello" },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "getDesign",
            description: "Read the design.",
            parameters: getDesign.parameters,
          },
        },
      ],
    });
  });

  it("streams a reply through onEvent and stops at the output limit", async () => {
    const events: ModelEvent[] = [];
    const response = await provider(
      replay([
        stream([
          chunk({ role: "assistant", content: "One, " }),
          chunk({ content: "two, " }),
          chunk({ content: "three" }),
          chunk({}, "length"),
        ]),
      ]),
    ).respond(request(), { onEvent: (event) => events.push(event) });

    expect(events).toEqual([
      { type: "text-delta", delta: "One, " },
      { type: "text-delta", delta: "two, " },
      { type: "text-delta", delta: "three" },
    ]);
    expect(response.text).toBe("One, two, three");
    expect(response.items).toEqual([
      { type: "message", role: "assistant", content: [{ type: "text", text: "One, two, three" }] },
    ]);
    // No usage chunk: the host didn't report usage.
    expect(response.usage).toBeNull();
    expect(response.stop).toBe("max-tokens");
  });

  it("returns a tool call unrun, then sends it and its result back in the next round", async () => {
    const seen: Seen[] = [];
    const fetch = replay(
      [
        stream([
          chunk({ role: "assistant", content: "Let me look." }),
          chunk({
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "getDesign", arguments: "" },
              },
            ],
          }),
          chunk({ tool_calls: [{ index: 0, function: { arguments: '{"scope":' } }] }),
          chunk({ tool_calls: [{ index: 0, function: { arguments: '"all"}' } }] }),
          chunk({}, "tool_calls"),
        ]),
        stream([chunk({ role: "assistant", content: "It has two tiles." }), chunk({}, "stop")]),
      ],
      seen,
    );
    const custom = provider(fetch);

    const first = await custom.respond(request());
    expect(first.toolCalls).toEqual([
      { callId: "call_1", name: "getDesign", arguments: '{"scope":"all"}' },
    ]);
    expect(first.items).toEqual([
      { type: "message", role: "assistant", content: [{ type: "text", text: "Let me look." }] },
      { type: "tool-call", callId: "call_1", name: "getDesign", arguments: '{"scope":"all"}' },
    ]);
    expect(first.stop).toBe("tool-calls");

    const second = await custom.respond(
      request([
        hello,
        ...first.items,
        { type: "tool-result", callId: "call_1", output: '{"tiles":2}' },
        // Another provider's state never goes to the host.
        { type: "opaque", provider: "openai", data: { type: "reasoning", id: "rs_1" } },
      ]),
    );
    expect(second.text).toBe("It has two tiles.");
    expect(second.stop).toBe("end");
    expect(seen[1]?.body.messages).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: "Let me look.",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "getDesign", arguments: '{"scope":"all"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: '{"tiles":2}' },
    ]);
  });

  it("reports input, output and cached input tokens", async () => {
    const response = await provider(
      replay([
        stream([
          chunk({ role: "assistant", content: "Done." }),
          chunk({}, "stop"),
          usageChunk({
            prompt_tokens: 1200,
            completion_tokens: 15,
            total_tokens: 1215,
            prompt_tokens_details: { cached_tokens: 1024 },
          }),
        ]),
      ]),
    ).respond(request());
    expect(response.usage).toEqual({
      inputTokens: 1200,
      outputTokens: 15,
      cachedInputTokens: 1024,
    });
  });

  it("turns a 401 into an auth error that blocks the provider and never quotes the key", async () => {
    const seen: Seen[] = [];
    const error = await provider(
      replay(
        [
          refusal(401, {
            message: `Incorrect API key provided: ${KEY}.`,
            type: "invalid_request_error",
            code: "invalid_api_key",
          }),
        ],
        seen,
      ),
    )
      .respond(request())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "custom", kind: "auth", blocksProvider: true });
    expect((error as Error).message).toMatch(/^Example host rejected the API key: /);
    expect((error as Error).message).not.toContain(KEY);
    // Not retried.
    expect(seen).toHaveLength(1);
  });

  it("turns a 429 into a rate limit after the retries, or quota when the account is out", async () => {
    const seen: Seen[] = [];
    const limited = await provider(
      replay(
        [
          refusal(
            429,
            { message: "Rate limit reached.", type: "requests", code: "rate_limit_exceeded" },
            { "retry-after-ms": "0" },
          ),
        ],
        seen,
      ),
    )
      .respond(request())
      .catch((e: unknown) => e);
    expect(limited).toMatchObject({
      provider: "custom",
      kind: "rate-limit",
      blocksProvider: false,
    });
    expect((limited as Error).message).toBe("Example host rate limit: Rate limit reached.");
    // The first try and the SDK's two retries.
    expect(seen).toHaveLength(3);

    const out = await provider(
      replay([
        refusal(
          429,
          {
            message: "You exceeded your current quota.",
            type: "insufficient_quota",
            code: "insufficient_quota",
          },
          { "retry-after-ms": "0" },
        ),
      ]),
    )
      .respond(request())
      .catch((e: unknown) => e);
    expect(out).toMatchObject({ kind: "quota", blocksProvider: true });
  });

  it("refuses an image instead of dropping it", async () => {
    const seen: Seen[] = [];
    const error = await provider(replay([stream([])], seen))
      .respond(
        request([
          {
            type: "message",
            role: "user",
            content: [{ type: "image", mediaType: "image/png", data: "iVBORw0KGgo=" }],
          },
        ]),
      )
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "unsupported" });
    expect(seen).toHaveLength(0);
  });
});

describe("custom endpoint messages", () => {
  it("joins the model's text and calls, and gives each result its own tool message", () => {
    expect(
      toCompatibleMessages([
        hello,
        { type: "message", role: "assistant", content: [{ type: "text", text: "Two calls." }] },
        { type: "tool-call", callId: "a", name: "getDesign", arguments: '{"scope":"all"}' },
        { type: "tool-call", callId: "b", name: "getDesign", arguments: "not json" },
        { type: "opaque", provider: "custom", data: {} },
        { type: "tool-result", callId: "a", output: "first" },
        { type: "tool-result", callId: "b", output: "second" },
      ]),
    ).toEqual([
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Two calls." },
          { type: "tool-call", toolCallId: "a", toolName: "getDesign", input: { scope: "all" } },
          {
            type: "tool-call",
            toolCallId: "b",
            toolName: "getDesign",
            input: { arguments: "not json" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "a",
            toolName: "getDesign",
            output: { type: "text", value: "first" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "b",
            toolName: "getDesign",
            output: { type: "text", value: "second" },
          },
        ],
      },
    ]);
  });
});
