import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadContract } from "@jeeves/rest-server";
import type { TestPack, TestPackContext } from "@jeeves/template-kit";
import { apiEnvName, clientExportName, contractPath } from "@jeeves/template-kit";
import { withPage } from "@jeeves/template-kit/browser";
import { exampleRequest } from "@jeeves/template-rest-api-server/test-pack";
import { hostOf, targetOf } from "../generate.ts";

const run = promisify(execFile);

/** A GET request the target's contract documents, to call through the client. */
export interface SampleCall {
  operationId: string;
  /** The concrete path, relative to the API's base path, starting with `/`. */
  path: string;
  query: Record<string, string>;
}

/** What a call through the client produced, as the checks report it. */
type CallResult =
  | { status: number; data: unknown }
  | { name: string; code?: string; message: string };

/**
 * Checks for a rest-api-client attachment in a running project (PLAN §8 test pack). Calls go
 * through the generated client inside the calling element: a one-off script in a service's
 * container, or the page's own client in Chromium for a web-app.
 */
export const testPack: TestPack = {
  template: "rest-api-client",
  checks: [
    {
      id: "types",
      title: "the generated client type-checks against the target's contract",
      async run(ctx) {
        const dir = join(ctx.projectDir, ctx.subject.dir);
        if (!existsSync(join(dir, "node_modules"))) {
          throw new Error(`${ctx.subject.dir} has no node_modules; install dependencies first`);
        }
        try {
          // `pretypecheck` regenerates the client types from the contract first.
          await run("npm", ["run", "typecheck"], { cwd: dir, maxBuffer: 16 * 1024 * 1024 });
        } catch (error) {
          const failed = error as { stdout?: string; stderr?: string };
          throw new Error(
            `npm run typecheck failed in ${ctx.subject.dir}:\n${failed.stdout ?? ""}${failed.stderr ?? ""}`,
          );
        }
      },
    },
    {
      id: "call",
      title: "a call to the target API succeeds inside compose",
      async run(ctx) {
        const sample = sampleCall(ctx);
        if (!sample) {
          ctx.log("the target's contract has no GET operation with examples to call");
          return;
        }
        const result = await callThroughClient(ctx, sample, "call");
        if (!("status" in result) || result.status < 200 || result.status > 299) {
          throw new Error(
            `${sample.operationId} (GET ${sample.path}) through the client returned ${JSON.stringify(result)}`,
          );
        }
        ctx.log(`${sample.operationId} → ${result.status} ${JSON.stringify(result.data)}`);
      },
    },
    {
      id: "timeout",
      title: "a call that gets no answer fails with a typed timeout error",
      async run(ctx) {
        const sample = sampleCall(ctx) ?? { operationId: "none", path: "/", query: {} };
        const result = await callThroughClient(ctx, sample, "timeout");
        if (!("name" in result) || result.name !== "RestClientTimeoutError") {
          throw new Error(`Expected a RestClientTimeoutError, got ${JSON.stringify(result)}`);
        }
        if (result.code !== "TIMEOUT") throw new Error(`The error's code is ${result.code}`);
      },
    },
  ],
};

/** `GET /ping` when the contract has it, else the first GET whose examples make a request. */
export function sampleCallFor(contractFile: string): SampleCall | undefined {
  const contract = loadContract(contractFile);
  const gets = contract.operations.filter((o) => o.method === "get" && o.smoke !== false);
  gets.sort((a, b) => Number(b.operationId === "ping") - Number(a.operationId === "ping"));
  for (const operation of gets) {
    const request = exampleRequest(operation);
    if (!request || Object.keys(request.headers ?? {}).length > 0) continue;
    return {
      operationId: operation.operationId,
      path: `/${request.path}`,
      query: request.query ?? {},
    };
  }
  return undefined;
}

function sampleCall(ctx: TestPackContext): SampleCall | undefined {
  return sampleCallFor(join(ctx.projectDir, contractPath(targetOf(ctx.subject).target.id)));
}

function callThroughClient(
  ctx: TestPackContext,
  sample: SampleCall,
  mode: "call" | "timeout",
): Promise<CallResult> {
  return hostOf(ctx.subject) === "service"
    ? callInService(ctx, sample, mode)
    : callInBrowser(ctx, sample, mode);
}

const RESULT = "JEEVES_RESULT ";

/**
 * Runs a script in the service's container that imports the generated client. For `timeout`, the
 * client is pointed at a local server that accepts connections and never answers.
 */
async function callInService(
  ctx: TestPackContext,
  sample: SampleCall,
  mode: "call" | "timeout",
): Promise<CallResult> {
  const target = targetOf(ctx.subject).target.id;
  const script = `
    import { createServer } from "node:net";
    import { pathToFileURL } from "node:url";
    const module = await import(pathToFileURL(process.cwd() + "/src/clients/${target}.generated.ts").href);
    const client = module[${JSON.stringify(clientExportName(target))}];
    let server;
    if (${JSON.stringify(mode)} === "timeout") {
      server = createServer(() => {});
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      process.env[${JSON.stringify(apiEnvName(target, "URL"))}] = "http://127.0.0.1:" + server.address().port;
    }
    let result;
    try {
      const response = await client.GET(${JSON.stringify(sample.path)}, { params: { query: ${JSON.stringify(sample.query)} } });
      result = { status: response.response.status, data: response.data ?? response.error };
    } catch (error) {
      result = { name: error.name, code: error.code, message: error.message };
    }
    console.log(${JSON.stringify(RESULT)} + JSON.stringify(result));
    process.exit(0);
  `;
  const { exitCode, output } = await ctx
    .service(ctx.subject.element.id)
    .exec(["node", "--input-type=module", "--eval", script]);
  const line = output.split("\n").find((l) => l.startsWith(RESULT));
  if (exitCode !== 0 || !line) {
    throw new Error(`The client script failed (exit ${exitCode}):\n${output}`);
  }
  return JSON.parse(line.slice(RESULT.length)) as CallResult;
}

/**
 * Loads the web app and calls through its own client (`window.__JEEVES__.apis`). For `timeout`,
 * the browser holds the app's proxied API requests without answering.
 */
async function callInBrowser(
  ctx: TestPackContext,
  sample: SampleCall,
  mode: "call" | "timeout",
): Promise<CallResult> {
  const host = ctx.subject.element.id;
  const target = targetOf(ctx.subject).target.id;
  const port = Number(ctx.compose.services[host]?.environment?.PORT);
  const { host: address, port: published } = await ctx.service(host).endpoint(port);
  return withPage(async (page) => {
    if (mode === "timeout") await page.route(`**/_api/${target}/**`, () => {});
    await page.goto(`http://${address}:${published}/`);
    await page.waitForFunction(() => "__JEEVES__" in globalThis, undefined, { timeout: 15_000 });
    return page.evaluate(
      async ({ api, path, query }) => {
        type Api = {
          GET(
            path: string,
            init: unknown,
          ): Promise<{ data?: unknown; error?: unknown; response: Response }>;
        };
        const apis = (globalThis as unknown as { __JEEVES__: { apis: Record<string, Api> } })
          .__JEEVES__.apis;
        const client = apis[api];
        if (!client) return { name: "Error", message: `window.__JEEVES__.apis has no "${api}"` };
        try {
          const response = await client.GET(path, { params: { query } });
          return { status: response.response.status, data: response.data ?? response.error };
        } catch (error) {
          const e = error as { name: string; code?: string; message: string };
          return { name: e.name, code: e.code, message: e.message } as CallResult;
        }
      },
      { api: target, path: sample.path, query: sample.query },
    );
  });
}
