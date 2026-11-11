// View count reader, a Data access in Watch API: Reads a video's view count.
// Write the module here. Export never overwrites your edits: export afresh and carry them over.
import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./watch-api-view-count-reader.slots.ts";

/** Answers any method on /modules/watch-api-view-count-reader and every path below it. */
export async function watchApiViewCountReader(dependencies: Dependencies, request: ModuleRequest): Promise<ModuleResponse> {
  throw new Error("Not implemented: View count reader");
}
