import {
  type DesignDocument,
  designOperations,
  findingsForOperationBinding,
  operationContractFindings,
  operationDisplayName,
  type ReadinessTarget,
} from "@jeeves/spec";

/** Read-only inspection does not offer unrelated declaration-only authoring actions. */
export function OperationsSummary({
  design,
  onTarget,
  selectedBinding,
}: {
  design: DesignDocument;
  onTarget: (target: ReadinessTarget) => void;
  selectedBinding?: string;
}) {
  const model = designOperations(design);
  const findings = operationContractFindings(design);
  return (
    <details className="ownership-summary operation-summary">
      <summary>Operation declarations · {model.receivers.length} receivers</summary>
      {model.receivers.map((receiver) => (
        <section key={receiver.id}>
          <h3>{operationDisplayName(receiver.implementation)}</h3>
          <p>
            {findingsForOperationBinding(design, receiver.id, findings).length} unresolved
            declarations
          </p>
          <button
            type="button"
            aria-pressed={selectedBinding === receiver.id}
            onClick={() => onTarget({ operation: receiver.id })}
          >
            Select operation {receiver.id}
          </button>
        </section>
      ))}
      <pre>{JSON.stringify(model, null, 2)}</pre>
    </details>
  );
}
