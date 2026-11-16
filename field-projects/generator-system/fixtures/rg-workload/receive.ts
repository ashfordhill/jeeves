import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./receive.slots.ts";
export const allowedCallers = ["caller"];
export let observations = 0;
export let lastRequest: Readonly<{ path: string; rawPath: string }> | undefined;
export async function receive(
  _dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  observations++;
  lastRequest = Object.freeze({ path: request.path, rawPath: request.rawPath });
  const shape =
    request.body && typeof request.body === "object" && "response" in request.body
      ? request.body.response
      : undefined;
  if (shape === "string")
    return {
      body: "primitive",
      headers: {
        "Content-Length": "1",
        "Content-Encoding": "gzip",
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=3600",
        "X-Product": "not-internal",
      },
    };
  if (shape === "null") return { body: null };
  if (shape === "empty") return {};
  if (shape === "no-content")
    return {
      status: 204,
      headers: {
        "Content-Length": "4",
        "Content-Encoding": "gzip",
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        "X-Product": "not-internal",
      },
    };
  if (shape === "oversized") return { body: "x".repeat(65537) };
  return {
    body: { ok: true, user: request.caller.signedIn ? request.caller.principal.subject : null },
  };
}
