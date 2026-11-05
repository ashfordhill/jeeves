/**
 * Codex as a `ModelProvider`, so the design chat can run on Codex's own login (a
 * ChatGPT plan) instead of an API key. Codex runs its own agent loop and has no way to call
 * Jeeves's tools, so each `respond` is one fresh Codex session that answers in structured output:
 * a message plus the tool calls it wants made. The caller runs the tools and calls `respond` again
 * with the results, exactly as with the OpenAI adapter.
 *
 * The session runs read-only in an empty scratch folder with the network and web search off, so
 * Codex has nothing to read or change. Replies arrive whole: structured output isn't streamed.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Codex, type ThreadOptions, type UserInput } from "@openai/codex-sdk";
import { type CodexLike, codexError } from "./codex.ts";
import { assertSupported, ProviderError } from "./errors.ts";
import type {
  ModelItem,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  RespondOptions,
  ToolCall,
  Usage,
} from "./types.ts";

export const CODEX_MODEL = "codex";

export type CodexModelOptions = {
  /** A `codex` binary to use instead of the one bundled with the SDK (`JEEVES_CODEX_PATH`). */
  codexPath?: string;
  /** Replaces the SDK (tests). */
  codex?: CodexLike;
};

/**
 * The structured output Codex must produce. `arguments` is a JSON string because strict output
 * schemas can't describe "any object"; each tool's own schema is in the prompt instead.
 */
export const codexAnswerSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Text for the person. Empty when you only call tools.",
    },
    toolCalls: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          arguments: { type: "string", description: "The arguments object, as JSON." },
        },
        required: ["name", "arguments"],
        additionalProperties: false,
      },
    },
  },
  required: ["message", "toolCalls"],
  additionalProperties: false,
} as const;

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

export function createCodexModelProvider(options: CodexModelOptions = {}): ModelProvider {
  const codex: CodexLike =
    options.codex ??
    new Codex(options.codexPath ? { codexPathOverride: options.codexPath } : undefined);
  let calls = 0;
  return {
    id: CODEX_MODEL,
    capabilities: { tools: true, imageInput: true, streaming: false, usage: true },
    async respond(request: ModelRequest, opts: RespondOptions = {}): Promise<ModelResponse> {
      assertSupported(this, request);
      const call = calls++;
      const scratch = mkdtempSync(join(tmpdir(), "jeeves-codex-model-"));
      try {
        const threadOptions: ThreadOptions = {
          workingDirectory: scratch,
          sandboxMode: "read-only",
          approvalPolicy: "never",
          networkAccessEnabled: false,
          webSearchMode: "disabled",
          skipGitRepoCheck: true,
          modelReasoningEffort: "medium",
          ...(request.model ? { model: request.model } : {}),
        };
        const thread = codex.startThread(threadOptions);
        const input = codexInput(request, scratch);
        let answer = "";
        let usage: Usage | null = null;
        try {
          const { events } = await thread.runStreamed(input, {
            outputSchema: codexAnswerSchema,
            ...(opts.signal ? { signal: opts.signal } : {}),
          });
          for await (const event of events) {
            if (event.type === "turn.failed") throw codexError(event.error.message);
            if (event.type === "error") throw codexError(event.message);
            if (event.type === "turn.completed") {
              usage = {
                inputTokens: event.usage.input_tokens,
                outputTokens: event.usage.output_tokens,
                cachedInputTokens: event.usage.cached_input_tokens,
              };
            }
            if (event.type === "item.completed" && event.item.type === "agent_message") {
              answer = event.item.text;
            }
          }
        } catch (error) {
          if (error instanceof ProviderError) throw error;
          if (opts.signal?.aborted) {
            throw new ProviderError(CODEX_MODEL, "other", "The request was cancelled.", {
              cause: error,
            });
          }
          throw codexError(error instanceof Error ? error.message : String(error), error);
        }
        const response = parseAnswer(answer, call, usage);
        if (response.text) opts.onEvent?.({ type: "text-delta", delta: response.text });
        return response;
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  };
}

/** The whole request as one prompt, with images written to the scratch folder. */
export function codexInput(request: ModelRequest, scratch: string): UserInput[] {
  const images: UserInput[] = [];
  const transcript: string[] = [];
  for (const item of request.items) {
    switch (item.type) {
      case "message": {
        const parts = item.content.map((part) => {
          if (part.type === "text") return part.text;
          const path = join(scratch, `image-${images.length + 1}.${EXTENSIONS[part.mediaType]}`);
          writeFileSync(path, Buffer.from(part.data, "base64"));
          images.push({ type: "local_image", path });
          return `[Attached image ${images.length}]`;
        });
        transcript.push(`## ${item.role === "user" ? "User" : "You"}\n\n${parts.join("\n\n")}`);
        break;
      }
      case "tool-call":
        transcript.push(
          `## You called a tool\n\nCall ${item.callId}: \`${item.name}\` with arguments ${item.arguments}`,
        );
        break;
      case "tool-result":
        transcript.push(`## Tool result for call ${item.callId}\n\n${item.output}`);
        break;
      case "opaque":
        break;
    }
  }
  const tools = request.tools
    .map(
      (tool) =>
        `### ${tool.name}\n\n${tool.description}\n\nArguments (JSON Schema):\n\n${JSON.stringify(tool.parameters)}`,
    )
    .join("\n\n");
  const prompt = [
    "You are answering as a model inside an application called Jeeves. Don't run shell commands or read files: everything you need is below, and the application runs your tool calls for you.",
    "Reply with the JSON the output schema asks for. To call tools, list them in `toolCalls`, with each call's `arguments` as a JSON string matching that tool's schema; you'll get the results in the next request. When you're done, or need the person, leave `toolCalls` empty and write your reply in `message`.",
    `# Instructions\n\n${request.instructions}`,
    tools ? `# Tools\n\n${tools}` : "# Tools\n\nNone: answer with a message only.",
    `# Conversation so far\n\n${transcript.join("\n\n")}`,
  ].join("\n\n");
  return [{ type: "text", text: prompt }, ...images];
}

function parseAnswer(answer: string, call: number, usage: Usage | null): ModelResponse {
  let parsed: { message?: unknown; toolCalls?: unknown };
  try {
    parsed = JSON.parse(answer);
  } catch {
    // Without structured output (an older Codex), take the whole answer as the message.
    parsed = { message: answer, toolCalls: [] };
  }
  const text = typeof parsed.message === "string" ? parsed.message.trim() : "";
  const toolCalls: ToolCall[] = (Array.isArray(parsed.toolCalls) ? parsed.toolCalls : [])
    .filter(
      (c): c is { name: string; arguments: unknown } =>
        typeof c === "object" && c !== null && typeof (c as { name?: unknown }).name === "string",
    )
    .map((c, index) => ({
      callId: `codex-${call}-${index}`,
      name: c.name,
      arguments: typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments ?? {}),
    }));
  const items: ModelItem[] = [];
  if (text) items.push({ type: "message", role: "assistant", content: [{ type: "text", text }] });
  for (const c of toolCalls) items.push({ type: "tool-call", ...c });
  return { items, text, toolCalls, usage, stop: toolCalls.length > 0 ? "tool-calls" : "end" };
}
