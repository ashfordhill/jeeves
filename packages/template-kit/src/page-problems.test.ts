import { EventEmitter } from "node:events";
import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { observePageProblems } from "./page-problems.ts";

const session = {
  scenario: "signed out",
  method: "GET",
  url: "http://127.0.0.1:4321/auth/session",
  resourceType: "fetch" as const,
  status: 401,
};
const native = "Failed to load resource: the server responded with a status of 401 (Unauthorized)";

function fixture() {
  const events = new EventEmitter();
  const problems = observePageProblems(events as unknown as Page);
  const request = (change: { method?: string; url?: string; resourceType?: string } = {}) => {
    const info = { ...session, ...change };
    const req = {
      method: () => info.method,
      url: () => info.url,
      resourceType: () => info.resourceType,
      failure: () => ({ errorText: "net::ERR_ABORTED" }),
    };
    events.emit("request", req);
    return {
      respond: (status: number) =>
        events.emit("response", { request: () => req, status: () => status }),
      fail: (error = "net::ERR_ABORTED") => {
        req.failure = () => ({ errorText: error });
        events.emit("requestfailed", req);
      },
    };
  };
  const consoleError = (text = native, argumentCount = 0, url = session.url) =>
    events.emit("console", {
      type: () => "error",
      text: () => text,
      args: () => Array(argumentCount).fill({}),
      location: () => ({ url }),
    });
  return { events, problems, request, consoleError, assert: () => problems.assert("fixture") };
}

describe("scoped browser verification", () => {
  it("accepts an exercised negative response and its native diagnostic in either event order", () => {
    const f = fixture();
    const scope = f.problems.expectHttp(session);
    f.consoleError();
    f.request().respond(401);
    scope.finish();
    expect(f.assert).not.toThrow();
  });

  it.each([
    ["method", { method: "POST" }],
    ["path", { url: `${session.url}/wrong` }],
    ["query", { url: `${session.url}?unexpected=true` }],
    ["origin", { url: session.url.replace("4321", "4322") }],
    ["resource type", { resourceType: "script" }],
  ])("does not hide a mismatched %s", (_, change) => {
    const f = fixture();
    f.problems.expectHttp(session);
    f.request(change).respond(401);
    expect(f.assert).toThrow("→ 401");
    expect(f.assert).toThrow("matched 0");
  });

  it.each([200, 400, 403, 404, 500])("rejects status %i when 401 was expected", (status) => {
    const f = fixture();
    f.problems.expectHttp(session);
    f.request().respond(status);
    expect(f.assert).toThrow(`→ ${status} (expected`);
  });

  it.each([401, 403, 404, 500])("rejects an unscoped %i", (status) => {
    const f = fixture();
    f.request().respond(status);
    expect(f.assert).toThrow(`GET ${session.url} → ${status}`);
  });

  it("requires expected negatives to be exercised, including optional probes once started", () => {
    const f = fixture();
    const scope = f.problems.expectHttp(session);
    expect(scope.finish).toThrow("started 0, matched 0");
    expect(f.assert).toThrow("started 0, matched 0");
    const scaffold = fixture();
    scaffold.problems.expectHttp(session, { ifRequested: true });
    expect(scaffold.assert).not.toThrow();
    scaffold.request();
    expect(scaffold.assert).toThrow("started 1, matched 0");
  });

  it("does not match earlier, repeated or later requests with an expectation", () => {
    const f = fixture();
    const earlier = f.request();
    const scope = f.problems.expectHttp(session);
    earlier.respond(401);
    f.request().respond(401);
    f.request().respond(401);
    scope.finish();
    f.request().respond(401);
    expect(f.assert).toThrow("→ 401");
  });

  it("keeps application errors even when they exactly imitate a correlated resource error", () => {
    const f = fixture();
    f.problems.expectHttp(session);
    f.request().respond(401);
    f.consoleError(native, 1);
    expect(f.assert).toThrow(`console.error: ${native}`);
  });

  it("keeps empty console.error, favicon text, uncorrelated diagnostics and uncaught errors", () => {
    const f = fixture();
    f.consoleError("", 0);
    f.consoleError("favicon is broken", 1);
    f.consoleError();
    f.events.emit("pageerror", new Error("render crashed"));
    expect(f.assert).toThrow("uncaught: render crashed");
    expect(f.assert).toThrow("favicon is broken");
    expect(f.assert).toThrow(native);
  });

  it("allows only a deliberate abort, and still rejects other transport failures", () => {
    const f = fixture();
    const scope = f.problems.expectCancellation(session);
    f.request().fail();
    scope.finish();
    expect(f.assert).not.toThrow();
    f.request().fail();
    expect(f.assert).toThrow("net::ERR_ABORTED");
    const broken = fixture();
    broken.problems.expectCancellation(session);
    broken.request().fail("net::ERR_CONNECTION_RESET");
    expect(broken.assert).toThrow("net::ERR_CONNECTION_RESET");
  });
});
