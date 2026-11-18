import type { Dependencies } from "./worker-access.slots.ts";
/** Worker is independently runnable; its only product write is the registered UPDATE. */
export async function workerAccess(dependencies: Dependencies, input: { id: string }) {
  return dependencies.itemsDb.call("mark_item", [input.id]);
}
