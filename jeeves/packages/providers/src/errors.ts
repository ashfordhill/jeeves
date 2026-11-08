import type { ModelCapabilities, ModelProvider, ModelRequest } from "./types.ts";

/**
 * - `auth`: missing or rejected credentials
 * - `quota`: the account is out of credit; retrying won't help
 * - `rate-limit`: too many requests right now
 * - `unavailable`: network failure or a provider-side error
 * - `bad-request`: the provider refused the request as malformed
 * - `unsupported`: the request needs a capability the provider doesn't declare
 */
export type ProviderErrorKind =
  | "auth"
  | "quota"
  | "rate-limit"
  | "unavailable"
  | "bad-request"
  | "unsupported"
  | "other";

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: ProviderErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderError";
  }

  /** Whether the caller should stop sending requests to this provider until the user acts. */
  get blocksProvider(): boolean {
    return this.kind === "auth" || this.kind === "quota";
  }
}

/** Reports a capability the request needs but the provider lacks, instead of dropping it. */
export function assertSupported(provider: ModelProvider, request: ModelRequest): void {
  const missing: (keyof ModelCapabilities)[] = [];
  if (request.tools.length > 0 && !provider.capabilities.tools) missing.push("tools");
  const hasImage = request.items.some(
    (item) => item.type === "message" && item.content.some((part) => part.type === "image"),
  );
  if (hasImage && !provider.capabilities.imageInput) missing.push("imageInput");
  if (missing.length > 0) {
    throw new ProviderError(
      provider.id,
      "unsupported",
      `The ${provider.id} provider doesn't support ${missing.join(" or ")}.`,
    );
  }
}
