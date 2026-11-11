import type { FastifyRequest } from "fastify";
import { HttpError, type HttpRoutes } from "./http.ts";
import type { VerifiedPrincipal } from "./identity.ts";
import { MultipartError, type OwnedMultipart } from "./multipart.ts";

export type MultipartOperation = "start" | "list" | "status" | "sign" | "complete" | "abort";
export type MultipartResults<M, R> = {
  [K in MultipartOperation]: Awaited<ReturnType<OwnedMultipart<M, R>[K]>>;
};
export type MultipartMount = {
  operation: MultipartOperation;
  method: "GET" | "POST";
  url: string;
  statusCode?: number;
};
function identity(request: FastifyRequest): string {
  const id = (request.params as { uploadId?: string }).uploadId;
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new MultipartError(400, "UPLOAD_ID");
  return id.toLowerCase();
}
/** Bind paths/status/body/error mapping at the product boundary. All principal resolution,
 * body validation, provider and SQL effects stay awaited inside the admitted HTTP handler. */
export function createMultipartHttpHandlers<M, R>(options: {
  multipart: OwnedMultipart<M, R>;
  principal(request: FastifyRequest): Promise<VerifiedPrincipal>;
  response?: {
    [K in MultipartOperation]?: (
      result: MultipartResults<M, R>[K],
      principal: VerifiedPrincipal,
    ) => unknown | Promise<unknown>;
  };
  error?: (error: MultipartError) => Error;
}) {
  const { multipart } = options;
  const handlers = Object.fromEntries(
    (["start", "list", "status", "sign", "complete", "abort"] as const).map((operation) => [
      operation,
      async (request: FastifyRequest) => {
        try {
          const p = await options.principal(request);
          let result: MultipartResults<M, R>[MultipartOperation];
          if (operation === "start") result = await multipart.start(p, request.body);
          else if (operation === "list") result = await multipart.list(p);
          else {
            const id = identity(request);
            if (operation === "sign") {
              const raw = (request.params as { partNumber?: string }).partNumber;
              if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw))
                throw new MultipartError(400, "PART_NUMBER");
              result = await multipart.sign(id, p, Number(raw));
            } else result = await multipart[operation](id, p);
          }
          // Keep each operation/result pair typed at the public response callback boundary.
          const transform = options.response?.[operation] as
            | ((value: typeof result, principal: VerifiedPrincipal) => unknown | Promise<unknown>)
            | undefined;
          return transform ? await transform(result, p) : result;
        } catch (error) {
          if (error instanceof MultipartError)
            throw (
              options.error?.(error) ??
              new HttpError(error.statusCode, error.code, "Upload operation refused.")
            );
          throw error;
        }
      },
    ]),
  ) as Record<MultipartOperation, (request: FastifyRequest) => Promise<unknown>>;
  return {
    handlers,
    mount(routes: HttpRoutes, mounts: readonly MultipartMount[]) {
      if (mounts.length !== 6 || new Set(mounts.map((m) => m.operation)).size !== 6)
        throw new Error("Explicitly mount each multipart operation once");
      for (const mount of mounts) {
        if (
          mount.method !== (["list", "status"].includes(mount.operation) ? "GET" : "POST") ||
          !mount.url.startsWith("/") ||
          (!["start", "list"].includes(mount.operation) && !mount.url.includes(":uploadId")) ||
          (mount.operation === "sign" && !mount.url.includes(":partNumber"))
        )
          throw new Error("Invalid multipart mount");
        routes.route({
          method: mount.method,
          url: mount.url,
          handler: async (request, reply) => {
            const result = await handlers[mount.operation](request);
            if (mount.statusCode) reply.code(mount.statusCode);
            return result;
          },
        });
      }
    },
  };
}
