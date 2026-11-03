import {
  type ArchitectureContract,
  contractKey,
  type DesignDocument,
  validateContractTransition,
} from "@jeeves/spec";

/** Probe the same transition guard used by atomic saves instead of duplicating consumer traversal. */
export function contractShapeProtected(base: DesignDocument, contract: ArchitectureContract) {
  const architecture = base.architecture;
  if (!architecture) return false;
  const original = architecture.contracts?.find((c) => contractKey(c) === contractKey(contract));
  if (!original) return false;
  return (
    validateContractTransition(base, {
      ...base,
      architecture: {
        ...architecture,
        contracts: architecture.contracts?.map((c) =>
          c === original
            ? { ...c, coverage: c.coverage === "Complete" ? "Partial" : "Complete" }
            : c,
        ),
      },
    }).length > 0
  );
}
