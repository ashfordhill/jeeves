import { join } from "node:path";
import {
  type Contract,
  createValidators,
  loadContract,
  OPERATIONS_REPORT_PATH,
  type Operation,
  type OperationStatus,
  type Parameter,
} from "@jeeves/rest-server";
import type { TestPack, TestPackContext } from "@jeeves/template-kit";
import { contractPath } from "../generate.ts";

/**
 * Checks for a rest-api-server attachment in a running project (PLAN §8 test pack). Everything is
 * driven by the project's contract file, so the checks follow the contract as agents extend it.
 */
export const testPack: TestPack = {
  template: "rest-api-server",
  checks: [
    {
      id: "openapi-served",
      title: "/openapi.json serves the contract",
      async run(ctx) {
        const contract = contractOf(ctx);
        const response = await call(ctx, "GET", "/openapi.json");
        if (response.status !== 200) throw new Error(`/openapi.json returned ${response.status}`);
        const served = response.body as { paths?: object; servers?: { url: string }[] };
        const expected = Object.keys(contract.document.paths ?? {}).sort();
        const actual = Object.keys(served.paths ?? {}).sort();
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(
            `Served paths ${actual.join(", ")}; the contract has ${expected.join(", ")}`,
          );
        }
        if (served.servers?.[0]?.url !== basePath(ctx)) {
          throw new Error(
            `Served servers[0].url ${served.servers?.[0]?.url}, not ${basePath(ctx)}`,
          );
        }
      },
    },
    {
      id: "handlers",
      title: "every operation in the contract has a handler",
      async run(ctx) {
        const contract = contractOf(ctx);
        const response = await call(ctx, "GET", OPERATIONS_REPORT_PATH);
        const report = (response.body as { operations?: OperationStatus[] }).operations ?? [];
        const served = new Set(report.map((o) => o.operationId));
        const stale = contract.operations.filter((o) => !served.has(o.operationId));
        if (stale.length > 0) {
          throw new Error(
            `The running service doesn't serve ${stale.map((o) => o.operationId).join(", ")}; rebuild its image`,
          );
        }
        const missing = report.filter((o) => !o.implemented);
        if (missing.length > 0) {
          throw new Error(
            `No handler for ${missing.map((o) => `${o.operationId} (${o.method} ${o.path})`).join(", ")}`,
          );
        }
      },
    },
    {
      id: "contract-smoke",
      title: "documented examples get schema-valid responses",
      async run(ctx) {
        const contract = contractOf(ctx);
        const validators = createValidators(contract);
        const failures: string[] = [];
        let ran = 0;
        for (const operation of contract.operations) {
          const eligible = operation.smoke ?? operation.method === "get";
          const request = eligible ? exampleRequest(operation) : undefined;
          if (!request) continue;
          ran += 1;
          const response = await call(ctx, operation.method.toUpperCase(), request.path, request);
          const problems = validators
            .get(operation.operationId)
            ?.response(response.status, response.body);
          if (problems && problems.length > 0) {
            failures.push(
              `${operation.operationId} → ${response.status}: ${problems.map((p) => `${p.path || "/"} ${p.message}`).join("; ")}`,
            );
          }
        }
        ctx.log(`ran ${ran} contract smoke request(s)`);
        if (failures.length > 0) throw new Error(failures.join("\n"));
      },
    },
    {
      id: "invalid-requests",
      title: "invalid requests get 400 with a structured error",
      async run(ctx) {
        const contract = contractOf(ctx);
        let ran = 0;
        for (const operation of contract.operations) {
          const request = invalidRequest(operation);
          if (!request) continue;
          ran += 1;
          const response = await call(ctx, operation.method.toUpperCase(), request.path, request);
          const body = response.body as { error?: string; details?: unknown[] };
          if (
            response.status !== 400 ||
            body.error !== "REQUEST_INVALID" ||
            !body.details?.length
          ) {
            throw new Error(
              `${operation.operationId} with ${request.what}: expected 400 REQUEST_INVALID with details, got ${response.status} ${JSON.stringify(body)}`,
            );
          }
        }
        if (ran === 0) ctx.log("no operation takes input that can be made invalid");
      },
    },
  ],
};

interface PlannedRequest {
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  what?: string;
}

function contractOf(ctx: TestPackContext): Contract {
  return loadContract(join(ctx.projectDir, contractPath(ctx.subject.element.id)));
}

function env(ctx: TestPackContext): Record<string, string> {
  return ctx.compose.services[ctx.subject.element.id]?.environment ?? {};
}

function basePath(ctx: TestPackContext): string {
  return String(ctx.subject.config.basePath).replace(/\/+$/, "") || "/";
}

/** Calls the service; API paths are relative to the base path, others (starting `/`) aren't. */
async function call(
  ctx: TestPackContext,
  method: string,
  path: string,
  request: Omit<PlannedRequest, "path"> = {},
): Promise<{ status: number; body: unknown }> {
  const port = Number(env(ctx).PORT ?? 8080);
  const { host, port: published } = await ctx.service(ctx.subject.element.id).endpoint(port);
  const absolute = path.startsWith("/") ? path : `${basePath(ctx).replace(/\/$/, "")}/${path}`;
  const url = new URL(`http://${host}:${published}${absolute}`);
  for (const [key, value] of Object.entries(request.query ?? {})) url.searchParams.set(key, value);
  const headers: Record<string, string> = { ...request.headers };
  const token = env(ctx).REST_BEARER_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  if (request.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    ...(request.body !== undefined && { body: JSON.stringify(request.body) }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body: unknown = text === "" ? undefined : text;
  try {
    body = text === "" ? undefined : JSON.parse(text);
  } catch {}
  return { status: response.status, body };
}

/** A request built from the contract's examples, or undefined when a required one is missing. */
export function exampleRequest(operation: Operation): PlannedRequest | undefined {
  let path = operation.path;
  const query: Record<string, string> = {};
  const headers: Record<string, string> = {};
  for (const p of operation.parameters) {
    if (p.example === undefined) {
      if (p.required) return undefined;
      continue;
    }
    const value = String(p.example);
    if (p.in === "path") path = path.replace(`{${p.name}}`, encodeURIComponent(value));
    else if (p.in === "query") query[p.name] = value;
    else if (p.in === "header") headers[p.name] = value;
  }
  const body = operation.requestBody;
  if (body?.required && body.example === undefined) return undefined;
  return {
    path: relative(path),
    query,
    headers,
    ...(body?.example !== undefined && { body: body.example }),
  };
}

/** A request that breaks one rule of the contract, or undefined when none can be broken. */
export function invalidRequest(operation: Operation): PlannedRequest | undefined {
  const base = exampleRequest({
    ...operation,
    // Bodies are replaced below when they're the broken part; otherwise use the example.
    requestBody: operation.requestBody && { ...operation.requestBody, required: false },
  });
  if (!base) return undefined;
  const body = operation.requestBody;
  if (body?.schema?.type === "object") {
    return { ...base, body: 42, what: "a body that isn't an object" };
  }
  for (const p of operation.parameters) {
    if (p.in !== "query" && p.in !== "header") continue;
    const bad = invalidValue(p);
    if (bad === undefined) continue;
    const what = `${p.in} ${p.name}=${JSON.stringify(bad)}`;
    return p.in === "query"
      ? { ...base, query: { ...base.query, [p.name]: bad }, what }
      : { ...base, headers: { ...base.headers, [p.name]: bad }, what };
  }
  const required = operation.parameters.find((p) => p.in === "query" && p.required);
  if (required) {
    const { [required.name]: _, ...rest } = base.query ?? {};
    return { ...base, query: rest, what: `no ${required.name}` };
  }
  return undefined;
}

function invalidValue({ schema }: Parameter): string | undefined {
  if (schema.type === "integer" || schema.type === "number") return "not-a-number";
  if (schema.type === "boolean") return "maybe";
  if (Array.isArray(schema.enum)) return "__not-an-option__";
  if (typeof schema.maxLength === "number") return "x".repeat(schema.maxLength + 1);
  return undefined;
}

/** Contract paths are relative to the base path: `/ping` → `ping`. */
function relative(path: string): string {
  return path.replace(/^\//, "");
}
