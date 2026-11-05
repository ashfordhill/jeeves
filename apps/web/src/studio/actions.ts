import {
  applyOperations,
  type DesignDocument,
  type OperationInput,
  type StudioKind,
} from "@jeeves/spec";
import { useProject } from "../project/store.ts";

export function endpointKind(design: DesignDocument, id: string): StudioKind | undefined {
  return design.architecture?.studio?.elements.find((item) => item.element === id)?.settings.kind;
}

/** Rebuilds the batch against the latest design inside the store's request chain, checked first. */
export function commitAction(
  projectId: string,
  rebuild: (design: DesignDocument) => OperationInput[],
) {
  return useProject.getState().commit(projectId, (design) => {
    const ops = rebuild(design);
    const result = applyOperations(design, ops, { baseRevision: design.revision });
    if (!result.ok) throw new Error(result.errors[0]?.message ?? "This action is invalid.");
    return ops;
  });
}
