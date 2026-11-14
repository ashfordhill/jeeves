// Q03 probe body (application-owned file). Answers by path; never prints a secret.
import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./front-probe.slots.ts";

const inOpenTx =
  "SELECT pg_backend_pid() AS pid, (xact_start <> query_start) AS in_open_tx FROM pg_stat_activity WHERE pid = pg_backend_pid()";
const ms = (start: number) => Math.round(performance.now() - start);
const why = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

export async function frontProbe(d: Dependencies, request: ModuleRequest): Promise<ModuleResponse> {
  const start = performance.now();
  switch (request.path) {
    case "/redirect":
      return {
        status: 302,
        headers: {
          Location: "https://dest.example/a?b=1&c=%20d#frag",
          "Cache-Control": "public, max-age=60",
          "QRWTY-Click-Event": "00000000-0000-4000-8000-000000000001",
        },
      };
    case "/method":
      return { status: 405, headers: { Allow: "GET, HEAD" }, body: { error: "method_not_allowed" } };
    case "/raw": {
      const body = request.body;
      return {
        body: {
          method: request.method,
          requestKeys: Object.keys(request).sort(),
          bodyType: body === null ? "null" : typeof body,
          isBytes: body instanceof Uint8Array,
          reserialized: typeof body === "string" ? body : body === undefined ? null : JSON.stringify(body),
          contentType: request.headers["content-type"] ?? null,
          contentLength: request.headers["content-length"] ?? null,
          host: request.headers.host ?? null,
          xForwardedFor: request.headers["x-forwarded-for"] ?? null,
          xRealIp: request.headers["x-real-ip"] ?? null,
        },
      };
    }
    case "/tx": {
      // A naive transaction through the stub interface: BEGIN on one call, then other calls.
      const steps: unknown[] = [];
      await d.store.execute("BEGIN");
      steps.push({ step: "execute BEGIN" });
      const parallel = await Promise.all([1, 2, 3].map(() => d.store.query(inOpenTx)));
      steps.push({ step: "3 parallel queries after BEGIN", rows: parallel.map((rows) => rows[0]) });
      const leaked = await d.store.query(
        "SELECT pid, state FROM pg_stat_activity WHERE usename = current_user AND pid <> pg_backend_pid() AND state = 'idle in transaction'",
      );
      steps.push({ step: "own sessions idle in transaction", rows: leaked });
      // Clean up: ROLLBACK on every pooled connection (a warning where none is open).
      await Promise.all(Array.from({ length: 10 }, () => d.store.execute("ROLLBACK")));
      const after = await d.store.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = current_user AND state = 'idle in transaction'",
      );
      steps.push({ step: "after 10 parallel ROLLBACKs", rows: after });
      return { body: { steps } };
    }
    case "/fn": {
      const id = `fn-${Date.now()}`;
      const result: Record<string, unknown> = {};
      try {
        await d.store.execute("SELECT m_front_probe.two_rows($1, $2, true)", [`${id}-a`, `${id}-b`]);
        result.failing = "committed (unexpected)";
      } catch (error) {
        result.failing = why(error);
      }
      result.afterFailing = (await d.store.query("SELECT count(*)::int AS n FROM m_front_probe.items WHERE id LIKE $1", [`${id}-%`]))[0];
      result.succeeding = (await d.store.execute("SELECT m_front_probe.two_rows($1, $2, false)", [`${id}-c`, `${id}-d`])).rowCount;
      result.afterSucceeding = (await d.store.query("SELECT count(*)::int AS n FROM m_front_probe.items WHERE id LIKE $1", [`${id}-%`]))[0];
      return { body: result };
    }
    case "/publish": {
      const messageId = String(request.query.id ?? `m-${Date.now()}`);
      try {
        await d.events.publish(new TextEncoder().encode(JSON.stringify({ messageId })), { messageId });
        return { status: 202, body: { messageId, ms: ms(start) } };
      } catch (error) {
        return { status: 503, headers: { "Retry-After": "1" }, body: { error: why(error), ms: ms(start) } };
      }
    }
    case "/cache": {
      const raced = request.query.race !== undefined;
      const read = d.hot.get("probe-key");
      if (!raced) return { body: { value: (await read) ?? null, ms: ms(start) } };
      const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 100));
      const value = await Promise.race([read.catch((error: unknown) => `error ${why(error)}`), timeout]);
      return { body: { value: value ?? null, ms: ms(start) } };
    }
    case "/cache-set":
      await d.hot.set("probe-key", "v1", 30);
      return { body: { ms: ms(start) } };
    case "/provider":
      return { body: { status: (await d.provider.request("/v1/x")).status } };
    case "/identity":
      return { body: { status: (await d.identity.request("/realms/identity")).status } };
    case "/env":
      return {
        body: {
          names: Object.keys(process.env)
            .filter((name) => /^(OIDC|PG|SECRET|PROBE|PUBSUB|NODE|PORT|K_|DATABASE|REDIS)/.test(name))
            .sort(),
          probeOverride: process.env.PROBE_OVERRIDE ?? null,
          uid: process.getuid?.() ?? null,
        },
      };
    case "/caller":
      return { body: request.caller.signedIn ? { signedIn: true, subject: request.caller.principal.subject } : { signedIn: false } };
    default:
      return { status: 404, body: { error: "probe_path" } };
  }
}
