import assert from "node:assert/strict";
import { createServer } from "node:http";
import { observePageProblems } from "@jeeves/template-kit/browser";
import { chromium, firefox } from "@playwright/test";

const name = process.argv[2] ?? "firefox";
if (!["chromium", "firefox"].includes(name) || process.argv.length > 3)
  throw new Error("Select chromium or firefox only");
let release = () => {};
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname !== "/data") {
    response.setHeader("Content-Type", "text/html");
    response.end("<!doctype html><html lang='en'><title>Stream diagnostic</title></html>");
    return;
  }
  const mode = url.searchParams.get("mode");
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, private",
    ...(mode === "truncated" ? { "Content-Length": "12" } : {}),
  });
  response.write('{"ok":');
  // Release only after the page has consumed the first chunk and issued the next read.
  release = () => {
    if (mode === "abort") return;
    if (mode === "truncated") response.write("true}", () => response.socket?.end());
    else response.end("true}");
  };
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await (name === "firefox" ? firefox : chromium)
  .launch()
  .catch(async (error: unknown) => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  });
const deadline = setTimeout(() => {
  console.error("Stream diagnostic exceeded 30 seconds");
  process.exitCode = 1;
  void browser.close();
  server.closeAllConnections();
}, 30000);
const results = [];
try {
  for (const mode of ["stream", "stream", "stream", "truncated", "abort"] as const) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const problems = observePageProblems(page);
      await page.exposeFunction("releaseBody", () => release());
      await page.goto(origin);
      const terminal = new Promise<{ event: string; error?: string }>((resolve) => {
        page.on("requestfinished", (request) => {
          if (new URL(request.url()).pathname === "/data") resolve({ event: "finished" });
        });
        page.on("requestfailed", (request) => {
          if (new URL(request.url()).pathname === "/data")
            resolve({ event: "failed", error: request.failure()?.errorText });
        });
      });
      const body = await page.evaluate(async (mode) => {
        const controller = new AbortController();
        const response = await fetch(`/data?mode=${mode}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const reader = response.body!.getReader();
        let text = "";
        let pending = reader.read();
        let releasing: Promise<void> | undefined;
        try {
          for (;;) {
            const { value, done } = await pending;
            if (done) return { eof: true, ok: JSON.parse(text).ok === true };
            if (text.length + value.byteLength > 256) throw new Error("Response limit exceeded");
            text += new TextDecoder().decode(value);
            pending = reader.read();
            if (!releasing) {
              releasing = (globalThis as unknown as { releaseBody(): Promise<void> }).releaseBody();
              if (mode === "abort") controller.abort();
            }
          }
        } catch (error) {
          return { eof: false, error: (error as Error).name };
        } finally {
          reader.releaseLock();
          await releasing;
        }
      }, mode);
      const outcome = await terminal;
      let diagnostics: "clean" | "failed" = "clean";
      try {
        problems.assert("Stream diagnostic");
      } catch {
        diagnostics = "failed";
      }
      results.push({ mode, body, terminal: outcome, diagnostics });
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify({ engine: name, version: browser.version(), results }, null, 2));
  for (const result of results) {
    const positive = result.mode === "stream";
    assert.equal(result.body.eof, positive);
    if (positive) assert.equal(result.body.ok, true);
    assert.equal(result.terminal.event, positive ? "finished" : "failed");
    assert.equal(result.diagnostics, positive ? "clean" : "failed");
  }
  console.log("PASS three complete streams; truncation and explicit abort remain detectable");
} finally {
  clearTimeout(deadline);
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
