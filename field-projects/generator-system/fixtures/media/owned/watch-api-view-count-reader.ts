// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import { HttpError } from "../../runtime/http.ts";
import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import { videoUuid } from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";
import type { Dependencies } from "./watch-api-view-count-reader.slots.ts";

const TOTALS = "view_counter_receipt_and_increment_public.totals";

export async function watchApiViewCountReader(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const path = /^\/([^/]+)$/.exec(request.path);
  if (!path) throw new HttpError(404, "NOT_FOUND", "Route not found.");
  if (request.method !== "GET" && request.method !== "HEAD")
    return {
      status: 405,
      headers: { allow: "GET, HEAD" },
      body: { error: "METHOD_NOT_ALLOWED", message: "Read a view count with GET." },
    };
  const id = videoUuid.safeParse(path[1]);
  if (!id.success) throw new HttpError(400, "VIDEO_ID", "Invalid video identity.");
  const rows = await dependencies.viewCounts.query<{ total: string }>(
    `SELECT total::text AS total FROM ${TOTALS} WHERE aggregate_key = $1`,
    [id.data],
  );
  const views = rows[0]?.total ?? "0";
  if (!/^(0|[1-9][0-9]*)$/.test(views)) throw new Error("Invalid view total");
  return { body: { views } };
}
