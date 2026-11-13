// View publisher, a Custom in Watch API: Reports each play of a ready video as an event, with the viewer when signed in.
// Write the module here. Export never overwrites your edits: export afresh and carry them over.
import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./watch-api-view-publisher.slots.ts";

/** Answers any method on /modules/watch-api-view-publisher and every path below it. */
export async function watchApiViewPublisher(dependencies: Dependencies, request: ModuleRequest): Promise<ModuleResponse> {
  throw new Error("Not implemented: View publisher");
}
