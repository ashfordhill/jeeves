import createClient, { type Client } from "openapi-fetch";
import { RestClientNetworkError, RestClientTimeoutError } from "./errors.ts";

export const REQUEST_ID_HEADER = "x-request-id";

export interface RestClientOptions {
  /** The target element ID, used in errors. */
  name: string;
  /** The API's base URL (origin plus base path). A function is called on every request. */
  baseUrl: string | (() => string);
  /** Per attempt, until response headers arrive. Default 5000. */
  timeoutMs?: number;
  /**
   * Extra attempts for idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE) after a timeout, a
   * network error, or a 502/503/504. POST and PATCH are never retried. Default 0.
   */
  retries?: number;
  /** Headers added to every request, such as `Authorization`. */
  headers?: () => Record<string, string>;
  /**
   * The request ID to send as `x-request-id` when the caller didn't set one, for example the ID
   * of the request being handled. Without one, each call gets a new ID (shared by its retries).
   */
  requestId?: () => string | undefined;
  /** Defaults to `globalThis.fetch`. */
  fetch?: (request: Request) => Promise<Response>;
}

/** An openapi-fetch client for one API, with `name` and the resolved `baseUrl()`. */
export type RestClient<Paths extends {}> = Client<Paths> & {
  readonly name: string;
  baseUrl(): string;
};

const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);
const RETRY_STATUSES = new Set([502, 503, 504]);
const METHODS = ["GET", "PUT", "POST", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"] as const;

/**
 * A typed client for an API whose types were generated from its contract
 * (`jeeves-rest-client-types`). Calls return `{ data, error, response }` like openapi-fetch;
 * a call that gets no response throws `RestClientTimeoutError` or `RestClientNetworkError`.
 */
export function createRestClient<Paths extends {}>(options: RestClientOptions): RestClient<Paths> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const retries = options.retries ?? 0;
  const baseFetch = options.fetch ?? ((request: Request) => globalThis.fetch(request));
  const baseUrl =
    typeof options.baseUrl === "function" ? options.baseUrl : () => options.baseUrl as string;

  async function send(original: Request): Promise<Response> {
    const headers = new Headers(original.headers);
    for (const [name, value] of Object.entries(options.headers?.() ?? {})) {
      if (!headers.has(name)) headers.set(name, value);
    }
    if (!headers.has(REQUEST_ID_HEADER)) {
      headers.set(REQUEST_ID_HEADER, options.requestId?.() ?? newRequestId());
    }
    const request = new Request(original, { headers });
    const maxAttempts = IDEMPOTENT.has(request.method) ? retries + 1 : 1;
    const details = (attempts: number, cause?: unknown) => ({
      client: options.name,
      method: request.method,
      url: request.url,
      attempts,
      ...(cause !== undefined && { cause }),
    });

    for (let attempt = 1; ; attempt += 1) {
      const last = attempt >= maxAttempts;
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      const cancel = () => controller.abort(original.signal.reason);
      original.signal.addEventListener("abort", cancel, { once: true });
      try {
        const attemptRequest = last ? request : request.clone();
        const response = await baseFetch(
          new Request(attemptRequest, { signal: controller.signal }),
        );
        if (!last && RETRY_STATUSES.has(response.status)) {
          await response.body?.cancel();
        } else {
          return response;
        }
      } catch (error) {
        if (original.signal.aborted) throw error;
        if (last) {
          if (timedOut) throw new RestClientTimeoutError({ ...details(attempt), timeoutMs });
          throw new RestClientNetworkError(details(attempt, error));
        }
      } finally {
        clearTimeout(timer);
        original.signal.removeEventListener("abort", cancel);
      }
      await delay(Math.min(100 * 2 ** (attempt - 1), 2000));
    }
  }

  const inner = createClient<Paths>({ fetch: send });
  // The base URL is resolved per call, so it can come from the environment or runtime config.
  const withBase = (init: unknown) => ({ baseUrl: baseUrl(), ...(init as object | undefined) });
  type Call = (...args: unknown[]) => unknown;
  const methods = Object.fromEntries(
    METHODS.map((method) => [
      method,
      (url: unknown, init?: unknown) => (inner[method] as Call)(url, withBase(init)),
    ]),
  );
  return {
    ...methods,
    request: (method: unknown, url: unknown, init?: unknown) =>
      (inner.request as Call)(method, url, withBase(init)),
    use: inner.use,
    eject: inner.eject,
    name: options.name,
    baseUrl,
  } as unknown as RestClient<Paths>;
}

function newRequestId(): string {
  // randomUUID needs a secure context in browsers (https or localhost).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
