/** What a generated hook or a stub throws until it is written. */
export class NotImplemented extends Error {
  constructor(what: string) {
    super(`Not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}
/** A NotImplemented, or any error whose message starts with "Not implemented" (a stub's own). */
export function isNotImplemented(error: unknown): error is Error {
  return (
    error instanceof NotImplemented ||
    (error instanceof Error && error.message.startsWith("Not implemented"))
  );
}
/** What was not implemented: the error's message without its "Not implemented:" prefix. */
export function notImplementedWhat(error: Error): string {
  return error.message.replace(/^Not implemented:?\s*/, "");
}

/** A template's one `started` line, logged once its startup has passed and just before the ready
 * marker: what that startup checked or started. */
export function logStarted(
  tile: string,
  entry: {
    module: string;
    template: string;
    wiring: "mounted" | "placeholder";
    checks: readonly string[];
  },
) {
  console.log(JSON.stringify({ level: "info", event: "started", tile, ...entry }));
}

/** One JSON line on stdout, at most once a second per key; the next line carries how many were
 * suppressed. The log never throws. */
export function createProcessLog(tile: string, level: "warn" | "error", event: string) {
  const seen = new Map<string, { at: number; suppressed: number }>();
  return (key: string, entry: Record<string, unknown>) => {
    const now = Date.now();
    const prior = seen.get(key);
    if (prior && now - prior.at < 1000) {
      prior.suppressed += 1;
      return;
    }
    if (seen.size >= 1024) seen.clear();
    seen.set(key, { at: now, suppressed: 0 });
    console.log(
      JSON.stringify({
        level,
        event,
        tile,
        ...entry,
        ...(prior?.suppressed ? { suppressed: prior.suppressed } : {}),
      }),
    );
  };
}

export type NotImplementedLog = (entry: {
  module: string;
  what: string;
  action: string;
  route?: string;
  queue?: string;
  messageId?: string;
}) => void;
/** One line per module and hook per second (tile process contract, section 5). */
export function createNotImplementedLog(tile: string): NotImplementedLog {
  const log = createProcessLog(tile, "warn", "not-implemented");
  return (entry) => log(`${entry.module}\u0000${entry.what}`, entry);
}

/** An error in one line, for a log: its name and message, at most 300 characters. */
export function describeError(error: unknown): string {
  return (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300);
}
export type FailureLog = (what: string, error: unknown, extra?: Record<string, unknown>) => void;
/** One JSON line for a failure the process survives, at most once a second per `what`. */
export function createFailureLog(tile: string): FailureLog {
  const log = createProcessLog(tile, "error", "failure");
  return (what, error, extra = {}) => log(what, { what, error: describeError(error), ...extra });
}
