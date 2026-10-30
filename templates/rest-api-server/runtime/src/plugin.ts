import { timingSafeEqual } from "node:crypto";
import type { RegisteredOperation, ServicePlugin } from "@jeeves/service-runtime";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type Contract, loadContract } from "./contract.ts";
import { createValidators, type Problem } from "./validation.ts";

export interface RestServerOptions {
  /** Absolute path of the OpenAPI 3.1 file (`contracts/<service>.openapi.yaml`). */
  contract: string;
  beforeOperation?: (
    request: FastifyRequest,
    reply: FastifyReply,
    operationId: string,
  ) => Promise<boolean>;
  /** Where the API's paths are served, e.g. `/api`. */
  basePath: string;
  /**
   * `bearer` requires `Authorization: Bearer <REST_BEARER_TOKEN>` on every operation. A
   * placeholder until an auth template exists: one shared token, set by the compose file.
   */
  auth?: "none" | "bearer";
  /**
   * What happens when a handler's response doesn't match the contract: `error` (default) logs
   * it and answers 500 `RESPONSE_INVALID`; `warn` logs it and sends the response anyway.
   */
  responseValidation?: "error" | "warn";
}

/** The JSON body of every error the API layer itself sends. */
export interface ApiError {
  error: string;
  message: string;
  details?: Problem[];
}

export interface OperationStatus {
  operationId: string;
  method: string;
  path: string;
  implemented: boolean;
  feature?: string;
}

/** Where the plugin reports each operation and whether a feature handles it. */
export const OPERATIONS_REPORT_PATH = "/_jeeves/operations";

/**
 * Serves a contract-first REST API: every operation in the contract becomes a route under
 * `basePath`, requests are validated before the handler runs, and responses after.
 */
export function restServer(options: RestServerOptions): ServicePlugin {
  const auth = options.auth ?? "none";
  const basePath = options.basePath.replace(/\/+$/, "");
  let token = "";
  return {
    name: "rest-server",
    servesOperations: true,
    configure(env) {
      if (auth !== "bearer") return [];
      token = env.REST_BEARER_TOKEN ?? "";
      return token ? [] : ["REST_BEARER_TOKEN is required when the API uses bearer auth"];
    },
    async register(app, ctx) {
      const contract = loadContract(options.contract);
      const known = new Set(contract.operations.map((o) => o.operationId));
      const unknown = [...ctx.operations].filter(([id]) => !known.has(id));
      if (unknown.length > 0) {
        const [id, { feature }] = unknown[0] as [string, RegisteredOperation];
        throw new Error(
          `Feature "${feature}" handles operation "${id}", which isn't in ${options.contract}. Add it to the contract first.`,
        );
      }
      const report: OperationStatus[] = contract.operations.map((o) => {
        const registered = ctx.operations.get(o.operationId);
        return {
          operationId: o.operationId,
          method: o.method.toUpperCase(),
          path: `${basePath}${o.path}`,
          implemented: registered !== undefined,
          ...(registered && { feature: registered.feature }),
        };
      });
      const missing = report.filter((o) => !o.implemented).map((o) => o.operationId);
      if (missing.length > 0) {
        ctx.log.warn(`operations with no handler yet (they answer 501): ${missing.join(", ")}`);
      }

      const served = servedDocument(contract, basePath);
      app.get("/openapi.json", async () => served);
      app.get(OPERATIONS_REPORT_PATH, async () => ({ basePath, operations: report }));
      await app.register(
        async (api) => registerApi(api, contract, ctx.operations, { ...options, auth, token }),
        { prefix: basePath },
      );
    },
  };
}

function registerApi(
  api: FastifyInstance,
  contract: Contract,
  operations: ReadonlyMap<string, RegisteredOperation>,
  options: RestServerOptions & { auth: string; token: string },
) {
  const validators = createValidators(contract);
  const responseMode = options.responseValidation ?? "error";

  api.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, "operation failed");
      return send(reply, 500, { error: "INTERNAL", message: "Something went wrong" });
    }
    return send(reply, status, {
      error: status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : "REQUEST_INVALID",
      message: error.message,
    });
  });
  api.setNotFoundHandler((request, reply) =>
    send(reply, 404, {
      error: "NOT_FOUND",
      message: `No operation at ${request.method} ${request.url}`,
    }),
  );

  for (const operation of contract.operations) {
    const validator = validators.get(operation.operationId);
    const registered = operations.get(operation.operationId);
    api.route({
      method: operation.method.toUpperCase() as "GET",
      url: operation.routePath,
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (
          options.beforeOperation &&
          !(await options.beforeOperation(request, reply, operation.operationId))
        )
          return;
        if (options.auth === "bearer" && !bearerMatches(request, options.token)) {
          reply.header("www-authenticate", "Bearer");
          return send(reply, 401, {
            error: "UNAUTHORIZED",
            message: "A valid bearer token is required",
          });
        }
        const parts = {
          params: { ...(request.params as Record<string, unknown>) },
          query: { ...(request.query as Record<string, unknown>) },
          headers: { ...request.headers },
          body: request.body,
        };
        const problems = validator?.request(parts) ?? [];
        if (problems.length > 0) {
          return send(reply, 400, {
            error: "REQUEST_INVALID",
            message: "The request doesn't match the API contract",
            details: problems,
          });
        }
        if (!registered) {
          return send(reply, 501, {
            error: "NOT_IMPLEMENTED",
            message: `Operation ${operation.operationId} has no handler yet`,
          });
        }
        const result = await registered.handler({
          operationId: operation.operationId,
          ...parts,
          request,
          log: request.log,
        });
        const invalid = validator?.response(result.status, result.body) ?? [];
        if (invalid.length > 0) {
          request.log.error(
            { operationId: operation.operationId, status: result.status, problems: invalid },
            "response doesn't match the API contract",
          );
          if (responseMode === "error") {
            return send(reply, 500, {
              error: "RESPONSE_INVALID",
              message: `The ${operation.operationId} handler's response doesn't match the API contract`,
              details: invalid,
            });
          }
        }
        reply.code(result.status);
        if (result.headers) reply.headers(result.headers);
        return reply.send(result.body);
      },
    });
  }
}

function send(reply: FastifyReply, status: number, body: ApiError) {
  return reply.code(status).type("application/json").send(body);
}

function bearerMatches(request: FastifyRequest, token: string): boolean {
  const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? "");
  if (!match?.[1] || !token) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The contract as served: `servers` says where the API actually is. */
function servedDocument(contract: Contract, basePath: string) {
  return { ...contract.document, servers: [{ url: basePath || "/" }] };
}
