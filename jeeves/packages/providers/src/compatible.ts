/**
 * A custom endpoint: any host that speaks OpenAI's Chat Completions API, through the AI SDK's
 * OpenAI-compatible provider. Stateless like the other adapters: every request sends the whole
 * conversation. Tools go out with their canonical JSON Schemas and no executor, so the SDK returns
 * the calls and never runs them; nothing constrains the arguments, so the chat tools check every
 * call themselves.
 *
 * Reasoning text a host streams is not kept, and every provider's opaque items are dropped: a host
 * that needs its reasoning sent back with tool results is a known limit.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  APICallError,
  type AssistantContent,
  type FinishReason,
  jsonSchema,
  type LanguageModelUsage,
  type ModelMessage,
  RetryError,
  streamText,
  type ToolSet,
  tool,
} from "ai";
import { assertSupported, ProviderError, type ProviderErrorKind } from "./errors.ts";
import type {
  ModelItem,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  RespondOptions,
  ToolCall,
  ToolDefinition,
  Usage,
} from "./types.ts";

export const CUSTOM = "custom";

export type CompatibleProviderOptions = {
  /** What the person calls the host, e.g. `DeepSeek`. Errors name it. */
  name: string;
  /** The API's base URL; requests go to `<baseURL>/chat/completions`. */
  baseURL: string;
  apiKey: string;
  /** For tests: replaces the HTTP transport. */
  fetch?: typeof fetch;
};

export function createCompatibleProvider(options: CompatibleProviderOptions): ModelProvider {
  const host = createOpenAICompatible({
    name: CUSTOM,
    baseURL: options.baseURL,
    apiKey: options.apiKey,
    // Asks the host to end the stream with the token counts.
    includeUsage: true,
    ...(options.fetch && { fetch: options.fetch }),
  });
  const fail = (kind: ProviderErrorKind, message: string, cause?: unknown) =>
    // A host's error text may quote the key it was sent; it never reaches the caller.
    new ProviderError(
      CUSTOM,
      kind,
      options.apiKey ? message.split(options.apiKey).join("…") : message,
      { cause },
    );
  return {
    id: CUSTOM,
    capabilities: { tools: true, imageInput: false, streaming: true, usage: true },
    async respond(request: ModelRequest, opts: RespondOptions = {}): Promise<ModelResponse> {
      assertSupported(this, request);
      const items: ModelItem[] = [];
      const toolCalls: ToolCall[] = [];
      let text = "";
      let pending = "";
      const flush = () => {
        if (pending)
          items.push({
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: pending }],
          });
        pending = "";
      };
      let finish: { reason: FinishReason; usage: LanguageModelUsage } | undefined;
      let failure: unknown;
      let aborted = false;
      try {
        const result = streamText({
          model: host.chatModel(request.model),
          instructions: request.instructions,
          messages: toCompatibleMessages(request.items),
          tools: toCompatibleTools(request.tools),
          ...(request.maxOutputTokens !== undefined && {
            maxOutputTokens: request.maxOutputTokens,
          }),
          ...(opts.signal && { abortSignal: opts.signal }),
          // Errors arrive as stream parts below; the SDK's default would print them.
          onError: () => {},
        });
        for await (const part of result.stream) {
          switch (part.type) {
            case "text-delta":
              if (!part.text) break;
              text += part.text;
              pending += part.text;
              opts.onEvent?.({ type: "text-delta", delta: part.text });
              break;
            case "tool-call": {
              flush();
              const call = {
                callId: part.toolCallId,
                name: part.toolName,
                // An unparseable call keeps the host's text, for the tool to refuse.
                arguments:
                  typeof part.input === "string" ? part.input : JSON.stringify(part.input ?? {}),
              };
              toolCalls.push(call);
              items.push({ type: "tool-call", ...call });
              break;
            }
            case "finish":
              finish = { reason: part.finishReason, usage: part.totalUsage };
              break;
            case "error":
              failure ??= part.error;
              break;
            case "abort":
              aborted = true;
              break;
          }
        }
      } catch (error) {
        failure ??= error;
      }
      if (aborted || opts.signal?.aborted)
        throw fail("other", "The request was cancelled.", failure);
      if (failure !== undefined) throw toCompatibleError(failure, options.name, fail);
      if (!finish) throw fail("unavailable", `${options.name} ended the stream early.`);
      flush();
      return {
        items,
        text,
        toolCalls,
        usage: fromCompatibleUsage(finish.usage),
        stop:
          toolCalls.length > 0 ? "tool-calls" : finish.reason === "length" ? "max-tokens" : "end",
      };
    },
  };
}

/** Each tool as the SDK takes it: its JSON Schema and no `execute`, so calls come back unrun. */
function toCompatibleTools(tools: readonly ToolDefinition[]): ToolSet {
  const set: ToolSet = {};
  for (const definition of tools) {
    set[definition.name] = tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.parameters),
    });
  }
  return set;
}

/** Canonical arguments as a tool call's input, which must be an object. */
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
 * The conversation as Chat Completions messages: each of the person's messages is a user message;
 * the model's consecutive text and tool calls are one assistant message; each tool result is a tool
 * message for its call. Opaque items, of any provider, are dropped.
 */
export function toCompatibleMessages(items: readonly ModelItem[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  const toolNames = new Map<string, string>();
  const assistant = (): Exclude<AssistantContent, string> => {
    const last = messages.at(-1);
    if (last?.role === "assistant" && Array.isArray(last.content)) return last.content;
    const content: Exclude<AssistantContent, string> = [];
    messages.push({ role: "assistant", content });
    return content;
  };
  for (const item of items) {
    switch (item.type) {
      case "message": {
        const parts = item.content.flatMap((part) =>
          part.type === "text" && part.text ? [{ type: "text" as const, text: part.text }] : [],
        );
        if (item.role === "user") messages.push({ role: "user", content: parts });
        else if (parts.length > 0) assistant().push(...parts);
        break;
      }
      case "tool-call":
        toolNames.set(item.callId, item.name);
        assistant().push({
          type: "tool-call",
          toolCallId: item.callId,
          toolName: item.name,
          input: toolInput(item.arguments),
        });
        break;
      case "tool-result":
        messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: item.callId,
              toolName: toolNames.get(item.callId) ?? "",
              output: { type: "text", value: item.output },
            },
          ],
        });
        break;
      case "opaque":
        break;
    }
  }
  return messages;
}

/** Input, output and cached input tokens, where the host reported them; else `null`. */
function fromCompatibleUsage(usage: LanguageModelUsage): Usage | null {
  if (usage.inputTokens === undefined || usage.outputTokens === undefined) return null;
  // The SDK counts an unreported cache as 0; only the host's own count is kept.
  const raw = usage.raw as { prompt_tokens_details?: { cached_tokens?: unknown } } | undefined;
  const cached =
    typeof raw?.prompt_tokens_details?.cached_tokens === "number"
      ? usage.inputTokenDetails.cacheReadTokens
      : undefined;
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    ...(cached !== undefined && { cachedInputTokens: cached }),
  };
}

function toCompatibleError(
  error: unknown,
  name: string,
  fail: (kind: ProviderErrorKind, message: string, cause?: unknown) => ProviderError,
): ProviderError {
  if (error instanceof ProviderError) return error;
  // After its retries the SDK wraps the last failure.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode;
    const detail = cause.message;
    if (status === undefined)
      return fail("unavailable", `Couldn't reach ${name}: ${detail}`, error);
    if (status === 401 || status === 403)
      return fail("auth", `${name} rejected the API key: ${detail}`, error);
    if (status === 429)
      return /insufficient_quota/.test(cause.responseBody ?? "")
        ? fail("quota", `${name} quota exhausted: ${detail}`, error)
        : fail("rate-limit", `${name} rate limit: ${detail}`, error);
    if (status >= 500) return fail("unavailable", `${name} error: ${detail}`, error);
    if (status >= 400) return fail("bad-request", `${name} refused the request: ${detail}`, error);
  }
  return fail("other", cause instanceof Error ? cause.message : String(cause), error);
}
