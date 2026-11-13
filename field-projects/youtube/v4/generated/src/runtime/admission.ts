export interface HttpSettings {
  requestTimeoutMs: number;
  concurrencyLimit: number;
}

/** Only explicitly constructed errors may expose application messages to HTTP clients. */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    if (
      !Number.isInteger(statusCode) ||
      statusCode < 400 ||
      statusCode > 599 ||
      !/^[A-Z][A-Z0-9_]{0,79}$/.test(code)
    )
      throw new Error("Invalid public HTTP error");
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** The deadline bounds the response, not the underlying effect. The slot remains occupied
 * until the awaited task settles; shutdown must drain it before closing dependencies. */
export function createAdmission(settings: HttpSettings) {
  if (
    !Number.isSafeInteger(settings.requestTimeoutMs) ||
    settings.requestTimeoutMs < 1 ||
    settings.requestTimeoutMs > 300000 ||
    !Number.isSafeInteger(settings.concurrencyLimit) ||
    settings.concurrencyLimit < 1 ||
    settings.concurrencyLimit > 100000
  )
    throw new Error("Invalid HTTP limits");
  const pending = new Set<Promise<unknown>>();
  let accepting = false;
  return {
    open() {
      accepting = true;
    },
    stop() {
      accepting = false;
    },
    async drain() {
      await Promise.allSettled([...pending]);
    },
    async run<T>(handle: () => Promise<T> | T): Promise<T> {
      if (!accepting) throw new HttpError(503, "UNAVAILABLE", "Service unavailable.");
      if (pending.size >= settings.concurrencyLimit)
        throw new HttpError(503, "OVERLOADED", "Service is busy.");
      let timer: ReturnType<typeof setTimeout> | undefined;
      const work = Promise.resolve()
        .then(handle)
        .finally(() => pending.delete(work));
      pending.add(work);
      try {
        return await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new HttpError(
                    503,
                    "DEADLINE",
                    "Request deadline exceeded; check status before retrying.",
                  ),
                ),
              settings.requestTimeoutMs,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
