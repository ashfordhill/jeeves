import type { TestPack, TestPackContext } from "@jeeves/template-kit";
import { SHUTDOWN_TIMEOUT_MS, wiringOf } from "../generate.ts";

/**
 * Checks for one http-service element in a running project (PLAN §8 test pack). The readiness
 * check stops and restarts the service's database, and the last check restarts the service.
 */
export const testPack: TestPack = {
  template: "http-service",
  checks: [
    {
      id: "health",
      title: "the container starts and /health returns 200",
      async run(ctx) {
        const response = await get(ctx, "/health");
        if (response.status !== 200) throw new Error(`/health returned ${response.status}`);
      },
    },
    {
      id: "ready",
      title: "/ready returns 200 with dependencies up and 503 with one stopped",
      async run(ctx) {
        await waitForStatus(ctx, "/ready", 200, 30_000);
        const database = wiringOf(ctx.subject).database;
        if (!database) {
          ctx.log("no dependencies to stop; checked 200 only");
          return;
        }
        const db = ctx.service(database.id);
        await db.stop();
        try {
          const body = await waitForStatus(ctx, "/ready", 503, 30_000);
          const state = (body as { dependencies?: Record<string, { ok: boolean }> }).dependencies;
          if (state?.[database.id]?.ok !== false) {
            throw new Error(`/ready was 503 but didn't report ${database.id} as down`);
          }
        } finally {
          await db.start();
        }
        await waitForStatus(ctx, "/ready", 200, 60_000);
      },
    },
    {
      id: "config-validation",
      title: "a bad environment is rejected with a readable error",
      async run(ctx) {
        const result = await ctx
          .service(ctx.subject.element.id)
          .run({ env: { PORT: "not-a-port", LOG_LEVEL: "chatty" } });
        if (result.exitCode === 0) throw new Error("The service started with PORT=not-a-port");
        for (const expected of ["invalid environment", "PORT: must be", "LOG_LEVEL: must be"]) {
          if (!result.output.includes(expected)) {
            throw new Error(`Expected "${expected}" in the output:\n${result.output}`);
          }
        }
        if (/\n\s+at /.test(result.output)) {
          throw new Error(`The error includes a stack trace:\n${result.output}`);
        }
      },
    },
    {
      id: "graceful-shutdown",
      title: "SIGTERM shuts the service down cleanly within the timeout",
      async run(ctx) {
        const service = ctx.service(ctx.subject.element.id);
        const timeoutMs = Number(env(ctx).SHUTDOWN_TIMEOUT_MS ?? SHUTDOWN_TIMEOUT_MS);
        const started = Date.now();
        const { exitCode } = await service.stop({ graceSeconds: timeoutMs / 1000 + 5 });
        const elapsed = Date.now() - started;
        await service.start();
        if (exitCode !== 0) throw new Error(`The service exited with code ${exitCode}`);
        if (elapsed > timeoutMs) {
          throw new Error(`Shutdown took ${elapsed} ms; the limit is ${timeoutMs} ms`);
        }
        await waitForStatus(ctx, "/ready", 200, 60_000);
      },
    },
  ],
};

function env(ctx: TestPackContext): Record<string, string> {
  return ctx.compose.services[ctx.subject.element.id]?.environment ?? {};
}

/** The service's base URL on the host. Looked up each time: a restart can change the port. */
export async function serviceUrl(ctx: TestPackContext): Promise<string> {
  const port = Number(env(ctx).PORT ?? ctx.subject.config.port);
  const { host, port: published } = await ctx.service(ctx.subject.element.id).endpoint(port);
  return `http://${host}:${published}`;
}

async function get(ctx: TestPackContext, path: string) {
  return fetch(`${await serviceUrl(ctx)}${path}`, { signal: AbortSignal.timeout(10_000) });
}

async function waitForStatus(
  ctx: TestPackContext,
  path: string,
  status: number,
  timeoutMs: number,
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  let last = "no answer";
  while (Date.now() < deadline) {
    try {
      const response = await get(ctx, path);
      const body = await response.json().catch(() => undefined);
      if (response.status === status) return body;
      last = `${response.status} ${JSON.stringify(body)}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${path} didn't return ${status} within ${timeoutMs} ms (last: ${last})`);
}
