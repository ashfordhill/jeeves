import { type DesignDocument, designSchema } from "../design.ts";
import type { OperationInput } from "../operations.ts";

/** Complete study seed for a new empty project. Submit once: one revision and one Undo. */
export function studioStudySeedOperations(input: DesignDocument): OperationInput[] {
  const design = designSchema.parse(input);
  return [
    ...(design.schemaVersion === 3 ? [{ op: "upgradeDesign" as const, scope: design.scope }] : []),
    ...design.elements.map((element) => ({ op: "addElement" as const, element })),
    ...design.connections.map((connection) => ({ op: "connect" as const, connection })),
    ...(design.architecture
      ? [{ op: "setArchitecture" as const, architecture: design.architecture }]
      : []),
    ...(design.schemaVersion === 3 && design.ownership
      ? [{ op: "setOwnership" as const, ownership: design.ownership }]
      : []),
    ...(design.schemaVersion === 3 && design.operations
      ? [{ op: "setOperations" as const, operations: design.operations }]
      : []),
  ];
}
