import type { ConsoleMessage, Page, Request, Response } from "@playwright/test";

/** Exact request identity, including origin and query. No patterns or status ranges. */
interface ExpectedRequest {
  scenario: string;
  method: string;
  url: string;
  resourceType: "fetch" | "xhr";
}

interface Expectation {
  request: ExpectedRequest;
  outcome: number | "net::ERR_ABORTED";
  ifRequested: boolean;
  active: boolean;
  started: number;
  matched: number;
}

interface Diagnostic {
  text: string;
  url: string;
  argumentCount: number;
}

export interface PageProblems {
  /** One response within this scenario; finish before moving to the next scenario. */
  expectHttp(
    request: ExpectedRequest & { status: number },
    options?: { ifRequested?: boolean },
  ): { finish(): void };
  /** Only an explicitly exercised abort is expected; other transport errors still fail. */
  expectCancellation(request: ExpectedRequest): { finish(): void };
  assert(where: string): void;
  stop(): void;
}

/**
 * Also copied verbatim into fixed acceptance support. Keep this file self-contained, with
 * type-only imports so generated suites can load it using Node's TypeScript stripping.
 */
export function observePageProblems(page: Page): PageProblems {
  const expectations: Expectation[] = [];
  const requests = new WeakMap<Request, Expectation>();
  const diagnostics: Diagnostic[] = [];
  const failures: string[] = [];
  const network: { url: string; outcome: number | string }[] = [];

  const describe = (e: Expectation) =>
    `${e.request.scenario}: ${e.request.method} ${e.request.url} → ${e.outcome}`;
  const missing = (e: Expectation) =>
    e.matched === 1 || (e.ifRequested && e.started === 0)
      ? []
      : [`Expected one ${describe(e)}; started ${e.started}, matched ${e.matched}`];
  const expect = (
    request: ExpectedRequest,
    outcome: Expectation["outcome"],
    ifRequested = false,
  ) => {
    const entry: Expectation = {
      request,
      outcome,
      ifRequested,
      active: true,
      started: 0,
      matched: 0,
    };
    expectations.push(entry);
    return {
      finish() {
        entry.active = false;
        const problems = missing(entry);
        if (problems.length) throw new Error(problems.join("\n"));
      },
    };
  };
  const onRequest = (request: Request) => {
    const entry = expectations.find(
      (e) =>
        e.active &&
        e.started === 0 &&
        e.request.method === request.method() &&
        e.request.url === request.url() &&
        e.request.resourceType === request.resourceType(),
    );
    if (entry) {
      entry.started++;
      requests.set(request, entry);
    }
  };
  const record = (request: Request, outcome: number | string) => {
    network.push({ url: request.url(), outcome });
    const entry = requests.get(request);
    if (entry && entry.outcome === outcome && entry.matched === 0) {
      entry.matched++;
    } else if (entry || typeof outcome === "string" || outcome >= 400) {
      failures.push(
        `${request.method()} ${request.url()} → ${outcome}${entry ? ` (expected ${describe(entry)})` : ""}`,
      );
    }
  };
  const onResponse = (response: Response) => record(response.request(), response.status());
  const onFailed = (request: Request) =>
    record(request, request.failure()?.errorText ?? "unknown transport failure");
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error")
      diagnostics.push({
        text: message.text(),
        url: message.location().url,
        argumentCount: message.args().length,
      });
  };
  const onError = (error: Error) => failures.push(`uncaught: ${error.message}`);
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);
  page.on("console", onConsole);
  page.on("pageerror", onError);

  return {
    expectHttp: (request, options) => expect(request, request.status, options?.ifRequested),
    expectCancellation: (request) => expect(request, "net::ERR_ABORTED"),
    assert(where) {
      // Chromium's native resource messages have no JS arguments. Application console.error
      // calls retain theirs, even if their text/URL exactly imitates a native diagnostic.
      // Reconcile only exact native messages backed by network evidence; unobserved resource
      // errors (including implicit favicon failures) remain failures, never text exclusions.
      const consoleErrors = diagnostics.filter((d) => {
        if (d.argumentCount !== 0) return true;
        const status =
          /^Failed to load resource: the server responded with a status of (\d+) \([^)]*\)$/.exec(
            d.text,
          )?.[1];
        return !network.some(
          (n) =>
            n.url === d.url &&
            (typeof n.outcome === "number"
              ? n.outcome >= 400 && Number(status) === n.outcome
              : d.text === `Failed to load resource: ${n.outcome}`),
        );
      });
      const all = [
        ...failures,
        ...expectations.flatMap(missing),
        ...consoleErrors.map((d) => `console.error: ${d.text} (${d.url})`),
      ];
      if (all.length) throw new Error(`${where} failed browser verification:\n${all.join("\n")}`);
    },
    stop() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onFailed);
      page.off("console", onConsole);
      page.off("pageerror", onError);
    },
  };
}

export function assertNoPageProblems(problems: PageProblems, where: string): void {
  problems.assert(where);
}
