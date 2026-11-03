/** Exact entity/field lookup shared by data and query validation. */
import { type ContractField, contractKey, resolveContractValue } from "./architecture-contracts.ts";
import type { BackendEntity, BackendReference } from "./backend-model.ts";
import type { DesignDocument } from "./design.ts";

export function backendEntity(design: DesignDocument, ref: BackendReference) {
  return design.architecture?.backend?.entities.find((e) => contractKey(e) === contractKey(ref));
}
/** Resolve only the existing exact contract. Field IDs stay local even through type expansion. */
export function backendEntityFields(
  design: DesignDocument,
  entity: BackendEntity,
): ContractField[] {
  const contract = design.architecture?.contracts?.find(
    (c) => contractKey(c) === contractKey(entity.contract),
  );
  if (!contract?.shape) return [];
  return contract.shape.payload.flatMap((f) => {
    const result = resolveContractValue(f, contract.shape?.types ?? []);
    return result.value
      ? [
          {
            ...result.value,
            id: f.id,
            name: f.name,
            required: f.required,
            description: f.description,
          },
        ]
      : [];
  });
}
