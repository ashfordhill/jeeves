import { type DesignDocument, designOwnership, type ReadinessTarget } from "@jeeves/spec";

/** Exact saved declarations, available only in source diagnostics. */
export function OwnershipSummary({
  design,
  onTarget,
}: {
  design: DesignDocument;
  onTarget: (target: ReadinessTarget) => void;
}) {
  const model = designOwnership(design);
  return (
    <details className="ownership-summary">
      <summary>Ownership & access · {model.owners.length} owners</summary>
      {model.owners.map((owner) => (
        <p key={owner.id}>
          <button type="button" onClick={() => onTarget({ owner: owner.id })}>
            Select owner {owner.id}
          </button>{" "}
          {owner.name}
        </p>
      ))}
      <pre>{JSON.stringify(model, null, 2)}</pre>
    </details>
  );
}
