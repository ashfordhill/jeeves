/**
 * Anthropic adapter on the Messages API (V3-19), through the official SDK. Stateless: every
 * request sends the whole conversation. Thinking is adaptive at a fixed effort; its blocks come
 * back as opaque items and are sent back unchanged, in place, within a turn, as the API requires.
 * The tools' canonical JSON Schemas are sent as they are: unlike OpenAI's strict mode, nothing
 * constrains the arguments, so the chat tools check every call themselves.
 *
 * The key comes from `ANTHROPIC_API_KEY` in the caller's environment and is never stored.
 */
import Anthropic, {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Message,
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import { assertSupported, ProviderError } from "./errors.ts";
import type {
  ModelItem,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  RespondOptions,
  ToolCall,
  ToolDefinition,
} from "./types.ts";

export const ANTHROPIC = "anthropic";
export type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";

export type AnthropicProviderOptions = {
  apiKey: string;
  baseURL?: string;
  /** For tests: replaces the HTTP transport. */
  fetch?: typeof fetch;
  maxRetries?: number;
  /** How much the model thinks (adaptive thinking). Default `medium`, Codex's level. */
  effort?: AnthropicEffort;
  /** `max_tokens` when the request sets none; thinking counts toward it. */
  defaultMaxTokens?: number;
};

export const ANTHROPIC_DEFAULT_EFFORT: AnthropicEffort = "medium";
const DEFAULT_MAX_TOKENS = 32_000;

export function createAnthropicProvider(options: AnthropicProviderOptions): ModelProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    // Only the key given here: never ANTHROPIC_AUTH_TOKEN, a profile or a config file.
    authToken: null,
    ...(options.baseURL && { baseURL: options.baseURL }),
    ...(options.fetch && { fetch: options.fetch }),
    maxRetries: options.maxRetries ?? 2,
  });
  const effort = options.effort ?? ANTHROPIC_DEFAULT_EFFORT;
  return {
    id: ANTHROPIC,
    capabilities: { tools: true, imageInput: true, streaming: true, usage: true },
    async respond(request: ModelRequest, opts: RespondOptions = {}): Promise<ModelResponse> {
      assertSupported(this, request);
      let message: Message;
      try {
        const stream = client.messages.stream(
          {
            model: request.model,
            max_tokens: request.maxOutputTokens ?? options.defaultMaxTokens ?? DEFAULT_MAX_TOKENS,
            system: request.instructions,
            messages: toAnthropicMessages(request.items),
            tools: request.tools.map(toAnthropicTool),
            thinking: { type: "adaptive" },
            output_config: { effort },
            // The instructions, tools and conversation so far are cached for the next round.
            cache_control: { type: "ephemeral" },
          },
          { ...(opts.signal && { signal: opts.signal }) },
        );
        for await (const event of stream)
          if (event.type === "content_block_delta" && event.delta.type === "text_delta")
            opts.onEvent?.({ type: "text-delta", delta: event.delta.text });
        message = await stream.finalMessage();
      } catch (error) {
        throw toAnthropicError(error);
      }
      return fromAnthropicMessage(message);
    },
  };
}

export function toAnthropicTool(tool: ToolDefinition): Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Tool["input_schema"],
  };
}

/** Canonical arguments as a tool_use input, which must be an object. */
function toolInput(argumentsJson: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(argumentsJson);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { arguments: value };
  } catch {
    return { arguments: argumentsJson };
  }
}

/**
 * The conversation as Messages API turns: the person's messages and tool results are user turns,
 * the model's text, thinking and tool calls assistant turns; consecutive items of one side make
 * one turn, in order. Another provider's opaque items are dropped.
 */
export function toAnthropicMessages(items: readonly ModelItem[]): MessageParam[] {
  const messages: MessageParam[] = [];
  const push = (role: "user" | "assistant", block: ContentBlockParam) => {
    const last = messages.at(-1);
    if (last?.role === role && Array.isArray(last.content)) last.content.push(block);
    else messages.push({ role, content: [block] });
  };
  for (const item of items) {
    switch (item.type) {
      case "message":
        for (const part of item.content) {
          if (part.type === "text") {
            if (part.text) push(item.role, { type: "text", text: part.text });
          } else if (item.role === "user") {
            push("user", {
              type: "image",
              source: { type: "base64", media_type: part.mediaType, data: part.data },
            });
          }
        }
        break;
      case "tool-call":
        push("assistant", {
          type: "tool_use",
          id: item.callId,
          name: item.name,
          input: toolInput(item.arguments),
        });
        break;
      case "tool-result":
        push("user", { type: "tool_result", tool_use_id: item.callId, content: item.output });
        break;
      case "opaque":
        if (item.provider === ANTHROPIC) push("assistant", item.data as ContentBlockParam);
        break;
    }
  }
  return messages;
}

/**
 * A response as ModelItems, in order. A tool call cut off by the output limit can't be trusted
 * (its input may be only part of what the model meant), so it is marked `truncated` for the tools
 * to refuse rather than run.
 */
export function fromAnthropicMessage(message: Message): ModelResponse {
  const items: ModelItem[] = [];
  const toolCalls: ToolCall[] = [];
  let text = "";
  const lastToolUse = message.content.findLastIndex((block) => block.type === "tool_use");
  for (const [index, block] of message.content.entries()) {
    if (block.type === "text") {
      text += block.text;
      if (block.text)
        items.push({
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: block.text }],
        });
    } else if (block.type === "tool_use") {
      const cut = message.stop_reason === "max_tokens" && index === lastToolUse;
      const call = {
        callId: block.id,
        name: block.name,
        arguments: JSON.stringify(cut ? { truncated: true } : block.input),
      };
      toolCalls.push(call);
      items.push({ type: "tool-call", ...call });
    } else if (block.type === "thinking") {
      items.push({
        type: "opaque",
        provider: ANTHROPIC,
        data: { type: "thinking", thinking: block.thinking, signature: block.signature },
      });
    } else if (block.type === "redacted_thinking") {
      items.push({
        type: "opaque",
        provider: ANTHROPIC,
        data: { type: "redacted_thinking", data: block.data },
      });
    }
  }
  const cacheRead = message.usage.cache_read_input_tokens ?? 0;
  const cacheWrite = message.usage.cache_creation_input_tokens ?? 0;
  return {
    items,
    text,
    toolCalls,
    usage: {
      // As OpenAI counts it: every input token, the cached ones included.
      inputTokens: message.usage.input_tokens + cacheRead + cacheWrite,
      outputTokens: message.usage.output_tokens,
      cachedInputTokens: cacheRead,
      cacheWriteInputTokens: cacheWrite,
    },
    stop:
      toolCalls.length > 0
        ? "tool-calls"
        : message.stop_reason === "max_tokens"
          ? "max-tokens"
          : "end",
  };
}

export function toAnthropicError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const fail = (kind: ConstructorParameters<typeof ProviderError>[1], message: string) =>
    new ProviderError(ANTHROPIC, kind, message, { cause: error });
  if (error instanceof APIUserAbortError) return fail("other", "The request was cancelled.");
  if (error instanceof APIConnectionError)
    return fail("unavailable", `Couldn't reach Anthropic: ${error.message}`);
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError)
    return fail("auth", `Anthropic rejected the API key: ${error.message}`);
  if (error instanceof RateLimitError)
    return fail("rate-limit", `Anthropic rate limit: ${error.message}`);
  if (error instanceof BadRequestError)
    return /credit balance|billing|purchase credits/i.test(error.message)
      ? fail("quota", `Anthropic quota exhausted: ${error.message}`)
      : fail("bad-request", `Anthropic refused the request: ${error.message}`);
  if (error instanceof APIError) {
    const status = error.status ?? 0;
    if (status >= 500) return fail("unavailable", `Anthropic error: ${error.message}`);
    if (status >= 400)
      return fail("bad-request", `Anthropic refused the request: ${error.message}`);
  }
  return fail("other", error instanceof Error ? error.message : String(error));
}
