/**
 * OpenAI adapter on the Responses API. Stateless: every request sends the whole conversation with
 * `store: false`, and reasoning items come back encrypted so they can be replayed within a turn.
 */
import OpenAI, { APIConnectionError, APIError, APIUserAbortError } from "openai";
import type {
  FunctionTool,
  Response,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
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

export const OPENAI = "openai";

export type OpenAIProviderOptions = {
  apiKey: string;
  baseURL?: string;
  /** For tests: replaces the HTTP transport. */
  fetch?: typeof fetch;
  maxRetries?: number;
};

export function createOpenAIProvider(options: OpenAIProviderOptions): ModelProvider {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    fetch: options.fetch,
    maxRetries: options.maxRetries ?? 2,
  });
  return {
    id: OPENAI,
    capabilities: { tools: true, imageInput: true, streaming: true, usage: true },
    async respond(request: ModelRequest, opts: RespondOptions = {}): Promise<ModelResponse> {
      assertSupported(this, request);
      let final: Response | undefined;
      try {
        const stream = await client.responses.create(
          {
            model: request.model,
            instructions: request.instructions,
            input: toOpenAIInput(request.items),
            tools: request.tools.map(toOpenAITool),
            store: false,
            include: ["reasoning.encrypted_content"],
            max_output_tokens: request.maxOutputTokens,
            stream: true,
          },
          { signal: opts.signal },
        );
        for await (const event of stream) {
          switch (event.type) {
            case "response.output_text.delta":
              opts.onEvent?.({ type: "text-delta", delta: event.delta });
              break;
            case "response.completed":
            case "response.incomplete":
              final = event.response;
              break;
            case "response.failed":
              throw new ProviderError(
                OPENAI,
                "unavailable",
                `OpenAI failed the response: ${event.response.error?.message ?? "unknown error"}`,
              );
            case "error":
              throw new ProviderError(OPENAI, "other", `OpenAI stream error: ${event.message}`);
          }
        }
      } catch (error) {
        throw toProviderError(error);
      }
      if (!final) throw new ProviderError(OPENAI, "unavailable", "OpenAI ended the stream early.");
      return fromOpenAIResponse(final);
    },
  };
}

export function toOpenAITool(tool: ToolDefinition): FunctionTool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    // Strict mode needs every property required; our operation schemas have optional fields.
    strict: false,
  };
}

export function toOpenAIInput(items: readonly ModelItem[]): ResponseInputItem[] {
  const input: ResponseInputItem[] = [];
  for (const item of items) {
    switch (item.type) {
      case "message":
        if (item.role === "assistant") {
          const text = item.content.map((part) => (part.type === "text" ? part.text : "")).join("");
          input.push({ role: "assistant", content: text });
        } else {
          input.push({
            role: "user",
            content: item.content.map((part) =>
              part.type === "text"
                ? { type: "input_text" as const, text: part.text }
                : {
                    type: "input_image" as const,
                    image_url: `data:${part.mediaType};base64,${part.data}`,
                    detail: "auto" as const,
                  },
            ),
          });
        }
        break;
      case "tool-call":
        input.push({
          type: "function_call",
          call_id: item.callId,
          name: item.name,
          arguments: item.arguments,
        });
        break;
      case "tool-result":
        input.push({ type: "function_call_output", call_id: item.callId, output: item.output });
        break;
      case "opaque":
        if (item.provider === OPENAI) input.push(item.data as ResponseInputItem);
        break;
    }
  }
  return input;
}

export function fromOpenAIResponse(response: Response): ModelResponse {
  const items: ModelItem[] = [];
  const toolCalls: ToolCall[] = [];
  let text = "";
  for (const output of response.output as ResponseOutputItem[]) {
    if (output.type === "message") {
      const messageText = output.content
        .map((part) => (part.type === "output_text" ? part.text : part.refusal))
        .join("");
      text += messageText;
      items.push({
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: messageText }],
      });
    } else if (output.type === "function_call") {
      const call = { callId: output.call_id, name: output.name, arguments: output.arguments };
      toolCalls.push(call);
      items.push({ type: "tool-call", ...call });
    } else if (output.type === "reasoning") {
      items.push({ type: "opaque", provider: OPENAI, data: output });
    }
  }
  const usage = response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedInputTokens: response.usage.input_tokens_details?.cached_tokens,
      }
    : null;
  const stop =
    toolCalls.length > 0
      ? "tool-calls"
      : response.status === "incomplete" &&
          response.incomplete_details?.reason === "max_output_tokens"
        ? "max-tokens"
        : "end";
  return { items, text, toolCalls, usage, stop };
}

export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof APIUserAbortError) {
    return new ProviderError(OPENAI, "other", "The request was cancelled.", { cause: error });
  }
  if (error instanceof APIConnectionError) {
    return new ProviderError(OPENAI, "unavailable", `Couldn't reach OpenAI: ${error.message}`, {
      cause: error,
    });
  }
  if (error instanceof APIError) {
    const status = error.status ?? 0;
    const detail = error.message;
    if (status === 401 || status === 403) {
      return new ProviderError(OPENAI, "auth", `OpenAI rejected the API key: ${detail}`, {
        cause: error,
      });
    }
    if (status === 429) {
      return error.code === "insufficient_quota"
        ? new ProviderError(OPENAI, "quota", `OpenAI quota exhausted: ${detail}`, { cause: error })
        : new ProviderError(OPENAI, "rate-limit", `OpenAI rate limit: ${detail}`, { cause: error });
    }
    if (status >= 500) {
      return new ProviderError(OPENAI, "unavailable", `OpenAI error: ${detail}`, { cause: error });
    }
    if (status >= 400) {
      return new ProviderError(OPENAI, "bad-request", `OpenAI refused the request: ${detail}`, {
        cause: error,
      });
    }
  }
  return new ProviderError(
    OPENAI,
    "other",
    error instanceof Error ? error.message : String(error),
    { cause: error },
  );
}
