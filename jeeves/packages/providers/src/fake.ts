/**
 * Scripted fake provider: replays canned responses so chat tests never need
 * an API key. Text is streamed word by word, like a real provider.
 */
import { z } from "zod";
import { assertSupported, ProviderError, type ProviderErrorKind } from "./errors.ts";
import type {
  ModelItem,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  RespondOptions,
  Usage,
} from "./types.ts";

export const FAKE = "fake";

/** Messages that the caller (not the person) adds to a conversation start with this. */
export const CALLER_NOTE_PREFIX = "[Jeeves]";

const scriptStepSchema = z.strictObject({
  text: z.string().optional(),
  /** `arguments` is sent as JSON; a string is sent as-is (to script malformed arguments). */
  toolCalls: z.array(z.strictObject({ name: z.string(), arguments: z.unknown() })).optional(),
  usage: z
    .strictObject({ inputTokens: z.number(), outputTokens: z.number() })
    .nullable()
    .optional(),
  /** Throw a `ProviderError` of this kind instead of answering. */
  error: z
    .enum(["auth", "quota", "rate-limit", "unavailable", "bad-request", "unsupported", "other"])
    .optional(),
});
export type ScriptStep = z.infer<typeof scriptStepSchema>;

/** Picks the step for a request; `call` counts calls to this provider, from 0. */
export type Script = readonly ScriptStep[] | ((request: ModelRequest, call: number) => ScriptStep);

export type FakeProvider = ModelProvider & {
  /** Every request received, in order (copies, so later mutation by the caller doesn't show). */
  readonly requests: ModelRequest[];
};

export function createFakeProvider(script: Script): FakeProvider {
  const requests: ModelRequest[] = [];
  return {
    id: FAKE,
    capabilities: { tools: true, imageInput: true, streaming: true, usage: true },
    requests,
    async respond(request: ModelRequest, opts: RespondOptions = {}): Promise<ModelResponse> {
      assertSupported(this, request);
      const call = requests.length;
      requests.push(structuredClone(request));
      const step = typeof script === "function" ? script(request, call) : script[call];
      if (!step) {
        throw new ProviderError(FAKE, "other", `The fake script has no response for call ${call}.`);
      }
      if (opts.signal?.aborted)
        throw new ProviderError(FAKE, "other", "The request was cancelled.");
      if (step.error)
        throw new ProviderError(FAKE, step.error as ProviderErrorKind, "Scripted failure.");
      return respondWith(step, call, opts);
    },
  };
}

function respondWith(step: ScriptStep, call: number, opts: RespondOptions): ModelResponse {
  const items: ModelItem[] = [];
  const text = step.text ?? "";
  if (text) {
    for (const delta of text.match(/\S+\s*|\s+/g) ?? [])
      opts.onEvent?.({ type: "text-delta", delta });
    items.push({ type: "message", role: "assistant", content: [{ type: "text", text }] });
  }
  const toolCalls = (step.toolCalls ?? []).map((toolCall, index) => ({
    callId: `fake-${call}-${index}`,
    name: toolCall.name,
    arguments:
      typeof toolCall.arguments === "string"
        ? toolCall.arguments
        : JSON.stringify(toolCall.arguments ?? {}),
  }));
  for (const toolCall of toolCalls) items.push({ type: "tool-call", ...toolCall });
  const usage: Usage | null =
    step.usage === undefined ? { inputTokens: 100, outputTokens: 20 } : step.usage;
  return { items, text, toolCalls, usage, stop: toolCalls.length > 0 ? "tool-calls" : "end" };
}

const byMessageSchema = z.strictObject({
  turns: z.array(
    z.strictObject({
      /** Case-insensitive substring of the person's message that selects this turn. */
      match: z.string().min(1),
      steps: z.array(scriptStepSchema).min(1),
    }),
  ),
});
export type ScriptByMessage = z.infer<typeof byMessageSchema>;

/**
 * A stateless script keyed by the person's latest message: the matching turn's steps are replayed
 * in order, one per model round since that message. Used by e2e tests, where many projects share
 * one server process. Caller notes (`CALLER_NOTE_PREFIX`) don't start a new turn.
 */
export function scriptByMessage(input: unknown): Script {
  const { turns } = byMessageSchema.parse(input);
  return (request) => {
    const start = request.items.findLastIndex(
      (item) => item.type === "message" && item.role === "user" && !isCallerNote(item),
    );
    const message = start >= 0 ? messageText(request.items[start] as ModelItem) : "";
    const turn = turns.find((t) => message.toLowerCase().includes(t.match.toLowerCase()));
    if (!turn) return { text: `The fake script has no turn matching "${message.slice(0, 80)}".` };
    const round = countRounds(request.items.slice(start + 1));
    return turn.steps[round] ?? turn.steps.at(-1) ?? { text: "" };
  };
}

function messageText(item: ModelItem): string {
  if (item.type !== "message") return "";
  return item.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

function isCallerNote(item: ModelItem): boolean {
  return messageText(item).startsWith(CALLER_NOTE_PREFIX);
}

/** Model rounds in a stretch of conversation: runs of model output between inputs. */
function countRounds(items: readonly ModelItem[]): number {
  let rounds = 0;
  let inOutput = false;
  for (const item of items) {
    const output =
      item.type === "tool-call" ||
      item.type === "opaque" ||
      (item.type === "message" && item.role === "assistant");
    if (output && !inOutput) rounds++;
    inOutput = output;
  }
  return rounds;
}
