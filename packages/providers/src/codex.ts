/**
 * Shared pieces of the Codex SDK (`@openai/codex-sdk`) adapter: the part of the SDK the model
 * provider uses, so tests can replay recorded events, and the mapping of Codex failure text to
 * `ProviderError` kinds.
 *
 * Credentials are Codex's own: `codex login` (ChatGPT or an API key), or `CODEX_API_KEY`.
 */
import type { Input, ThreadEvent, ThreadOptions } from "@openai/codex-sdk";
import { ProviderError, type ProviderErrorKind } from "./errors.ts";

export const CODEX = "codex";

/** The part of the SDK's `Thread` the adapter uses, so tests can replay recorded events. */
export type CodexThreadLike = {
  readonly id: string | null;
  runStreamed(
    input: Input,
    options?: { signal?: AbortSignal; outputSchema?: unknown },
  ): Promise<{ events: AsyncGenerator<ThreadEvent> }>;
};

export type CodexLike = {
  startThread(options?: ThreadOptions): CodexThreadLike;
  resumeThread(id: string, options?: ThreadOptions): CodexThreadLike;
};

/** Maps a Codex failure message to a `ProviderError` kind (Codex reports errors as text). */
export function codexError(message: string, cause?: unknown): ProviderError {
  const text = message.toLowerCase();
  let kind: ProviderErrorKind = "other";
  if (/\b401\b|\b403\b|unauthori[sz]ed|not logged in|login|authenticat|api key/.test(text)) {
    kind = "auth";
  } else if (/quota|usage limit|insufficient|billing|credits/.test(text)) {
    kind = "quota";
  } else if (/rate limit|\b429\b|too many requests/.test(text)) {
    kind = "rate-limit";
  } else if (/enoent|spawn|unsupported platform/.test(text)) {
    kind = "unavailable";
  } else if (
    /\b(?:status|http)\s*5\d\d\b|stream disconnected|network|timed out|connection/.test(text)
  ) {
    kind = "unavailable";
  }
  return new ProviderError(CODEX, kind, `Codex: ${message.trim()}`, cause ? { cause } : undefined);
}
