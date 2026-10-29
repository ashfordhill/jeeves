export type RestClientErrorCode = "TIMEOUT" | "NETWORK";

/**
 * A call that got no HTTP response. Responses with an error status are not thrown: they come back
 * as `{ error, response }`, typed from the contract, as openapi-fetch returns them.
 */
export class RestClientError extends Error {
  readonly code: RestClientErrorCode;
  /** The target element ID the client calls. */
  readonly client: string;
  readonly method: string;
  readonly url: string;
  /** How many attempts were made, retries included. */
  readonly attempts: number;

  constructor(
    code: RestClientErrorCode,
    message: string,
    details: { client: string; method: string; url: string; attempts: number; cause?: unknown },
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = "RestClientError";
    this.code = code;
    this.client = details.client;
    this.method = details.method;
    this.url = details.url;
    this.attempts = details.attempts;
  }
}

/** No response arrived within the client's `timeoutMs` (per attempt). */
export class RestClientTimeoutError extends RestClientError {
  constructor(details: ConstructorParameters<typeof RestClientError>[2] & { timeoutMs: number }) {
    super(
      "TIMEOUT",
      `${details.method} ${details.url} (${details.client}) got no response within ${details.timeoutMs} ms`,
      details,
    );
    this.name = "RestClientTimeoutError";
  }
}

/** The request failed before a response: refused connection, DNS failure, reset, and so on. */
export class RestClientNetworkError extends RestClientError {
  constructor(details: ConstructorParameters<typeof RestClientError>[2]) {
    super(
      "NETWORK",
      `${details.method} ${details.url} (${details.client}) failed: ${messageOf(details.cause)}`,
      details,
    );
    this.name = "RestClientNetworkError";
  }
}

export function isRestClientError(error: unknown): error is RestClientError {
  return error instanceof RestClientError;
}

function messageOf(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // undici reports "fetch failed" and puts the reason (ECONNREFUSED, ...) in `cause`.
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
  return `${error.message}${cause}`;
}
