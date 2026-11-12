/** The Anthropic adapter against a mocked Messages API transport: no key, no network. */
import { describe, expect, it } from "vitest";
import {
  ANTHROPIC,
  createAnthropicProvider,
  fromAnthropicMessage,
  toAnthropicMessages,
} from "./anthropic.ts";
import { ProviderError } from "./errors.ts";
import type { ModelItem, ModelRequest } from "./types.ts";

type Block =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

/** A streamed Messages API response, as server-sent events. */
function sse(blocks: Block[], stop = "end_turn") {
  const events: [string, unknown][] = [
    [
      "message_start",
      {
        type: "message_start",
        message: {
          id: "msg_1",
          type: "message",
          role: "assistant",
          model: "claude-haiku-5-5",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 1,
            cache_read_input_tokens: 900,
            cache_creation_input_tokens: 90,
          },
        },
      },
    ],
  ];
  for (const [index, block] of blocks.entries()) {
    const start =
      block.type === "text"
        ? { type: "text", text: "" }
        : block.type === "thinking"
          ? { type: "thinking", thinking: "", signature: "" }
          : { type: "tool_use", id: block.id, name: block.name, input: {} };
    events.push([
      "content_block_start",
      { type: "content_block_start", index, content_block: start },
    ]);
    const delta =
      block.type === "text"
        ? { type: "text_delta", text: block.text }
        : block.type === "thinking"
          ? { type: "thinking_delta", thinking: block.thinking }
          : { type: "input_json_delta", partial_json: JSON.stringify(block.input) };
    events.push(["content_block_delta", { type: "content_block_delta", index, delta }]);
    if (block.type === "thinking")
      events.push([
        "content_block_delta",
        {
          type: "content_block_delta",
          index,
          delta: { type: "signature_delta", signature: block.signature },
        },
      ]);
    events.push(["content_block_stop", { type: "content_block_stop", index }]);
  }
  events.push(
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: stop, stop_sequence: null },
        usage: { output_tokens: 42 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  );
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

function transport(responses: { status?: number; body: string }[]) {
  const requests: { headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const next = responses[requests.length - 1] ?? { body: sse([]) };
    return new Response(next.body, {
      status: next.status ?? 200,
      headers: {
        "content-type": next.status ? "application/json" : "text/event-stream",
        "request-id": "req_test",
      },
    });
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

const tool = {
  name: "applyStudioCommands",
  description: "Apply commands.",
  parameters: {
    type: "object",
    properties: { commands: { type: "array", items: { type: "object" } } },
    required: ["commands"],
    additionalProperties: false,
  },
};
const request = (items: ModelItem[] = []): ModelRequest => ({
  model: "claude-haiku-5-5",
  instructions: "You design.",
  items: [
    { type: "message", role: "user", content: [{ type: "text", text: "Build it." }] },
    ...items,
  ],
  tools: [tool],
});

describe("the Anthropic provider (V3-19)", () => {
  it("streams text, returns tool calls and keeps thinking as opaque items, with cache-aware usage", async () => {
    const { fetch, requests } = transport([
      {
        body: sse(
          [
            { type: "thinking", thinking: "", signature: "sig-1" },
            { type: "text", text: "Adding it." },
            {
              type: "tool_use",
              id: "toolu_1",
              name: "applyStudioCommands",
              input: { commands: [] },
            },
          ],
          "tool_use",
        ),
      },
    ]);
    const provider = createAnthropicProvider({ apiKey: "test-key-not-real", fetch, maxRetries: 0 });
    const deltas: string[] = [];
    const response = await provider.respond(request(), {
      onEvent: (event) => deltas.push(event.delta),
    });
    expect(deltas.join("")).toBe("Adding it.");
    expect(response).toMatchObject({
      text: "Adding it.",
      stop: "tool-calls",
      toolCalls: [{ callId: "toolu_1", name: "applyStudioCommands", arguments: '{"commands":[]}' }],
      usage: {
        inputTokens: 1000,
        cachedInputTokens: 900,
        cacheWriteInputTokens: 90,
        outputTokens: 42,
      },
    });
    expect(response.items.map((item) => item.type)).toEqual(["opaque", "message", "tool-call"]);
    expect(response.items[0]).toEqual({
      type: "opaque",
      provider: ANTHROPIC,
      data: { type: "thinking", thinking: "", signature: "sig-1" },
    });
    // The request: the key in its own header only, adaptive thinking at medium effort, caching,
    // the system prompt and the canonical tool schema as it is.
    const [sent] = requests;
    expect(sent?.headers.get("x-api-key") ?? sent?.headers.get("authorization")).toContain(
      "test-key-not-real",
    );
    expect(sent?.body).toMatchObject({
      model: "claude-haiku-5-5",
      system: "You design.",
      stream: true,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      tools: [{ name: "applyStudioCommands", input_schema: tool.parameters }],
      messages: [{ role: "user", content: [{ type: "text", text: "Build it." }] }],
    });
  });

  it("sends thinking, tool calls and results back in place, one turn per side", () => {
    const items: ModelItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "[Jeeves] context" }] },
      { type: "message", role: "user", content: [{ type: "text", text: "Build it." }] },
      {
        type: "opaque",
        provider: ANTHROPIC,
        data: { type: "thinking", thinking: "", signature: "s" },
      },
      { type: "opaque", provider: "openai", data: { type: "reasoning" } },
      { type: "message", role: "assistant", content: [{ type: "text", text: "Adding it." }] },
      {
        type: "tool-call",
        callId: "toolu_1",
        name: "applyStudioCommands",
        arguments: '{"commands":[]}',
      },
      { type: "tool-result", callId: "toolu_1", output: '{"ok":true}' },
      { type: "tool-call", callId: "jeeves-review-1", name: "reviewDesign", arguments: "{}" },
      { type: "tool-result", callId: "jeeves-review-1", output: '{"left":[]}' },
      {
        type: "message",
        role: "user",
        content: [{ type: "text", text: "[Jeeves] Fresh review." }],
      },
    ];
    expect(toAnthropicMessages(items)).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "[Jeeves] context" },
          { type: "text", text: "Build it." },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "", signature: "s" },
          { type: "text", text: "Adding it." },
          { type: "tool_use", id: "toolu_1", name: "applyStudioCommands", input: { commands: [] } },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: '{"ok":true}' }],
      },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "jeeves-review-1", name: "reviewDesign", input: {} }],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "jeeves-review-1", content: '{"left":[]}' },
          { type: "text", text: "[Jeeves] Fresh review." },
        ],
      },
    ]);
  });

  it("marks a tool call cut off by the output limit, so the tools refuse it rather than run part of it", () => {
    const response = fromAnthropicMessage({
      id: "msg",
      type: "message",
      role: "assistant",
      model: "claude-haiku-5-5",
      content: [
        { type: "tool_use", id: "toolu_1", name: "reviewDesign", input: {}, caller: null } as never,
        {
          type: "tool_use",
          id: "toolu_2",
          name: "applyStudioCommands",
          input: { commands: [{}] },
          caller: null,
        } as never,
      ],
      stop_reason: "max_tokens",
      usage: { input_tokens: 5, output_tokens: 16000 },
    } as never);
    expect(response.toolCalls.map((call) => call.arguments)).toEqual(["{}", '{"truncated":true}']);
  });

  it("maps refused keys, an empty balance, rate limits and bad requests to provider errors", async () => {
    const error = (status: number, type: string, message: string) => ({
      status,
      body: JSON.stringify({ type: "error", error: { type, message } }),
    });
    const { fetch } = transport([
      error(401, "authentication_error", "invalid x-api-key"),
      error(
        400,
        "invalid_request_error",
        "Your credit balance is too low to access the Anthropic API.",
      ),
      error(429, "rate_limit_error", "Too many requests"),
      error(400, "invalid_request_error", "messages.1: bad block"),
    ]);
    const provider = createAnthropicProvider({ apiKey: "test-key-not-real", fetch, maxRetries: 0 });
    const kinds: string[] = [];
    for (let index = 0; index < 4; index++) {
      const caught = await provider.respond(request()).catch((cause: unknown) => cause);
      expect(caught).toBeInstanceOf(ProviderError);
      kinds.push((caught as ProviderError).kind);
    }
    expect(kinds).toEqual(["auth", "quota", "rate-limit", "bad-request"]);
  });
});
