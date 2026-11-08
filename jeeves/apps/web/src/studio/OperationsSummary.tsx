import {
  type DesignDocument,
  designOperations,
  designOwnership,
  findingsForOperationBinding,
  isCreateOperation,
  isResolveOperation,
  operationContractFindings,
  operationDependencyIds,
  operationDisplayName,
} from "@jeeves/spec";

export function OperationsSummary({
  design,
  element,
  connection,
  ownerId,
  onConfigure,
  selectedBinding,
}: {
  design: DesignDocument;
  element?: string;
  connection?: string;
  ownerId?: string;
  onConfigure: (binding?: string) => void;
  selectedBinding?: string;
}) {
  const model = designOperations(design),
    ownership = designOwnership(design);
  const receivers = model.receivers.filter(
    (x) =>
      x.role === element ||
      (connection && operationDependencyIds(x).includes(connection)) ||
      (ownerId && ownership.roles.some((r) => r.element === x.role && r.owner === ownerId)) ||
      model.calls.some(
        (c) =>
          c.receiverBinding === x.id &&
          c.caller.kind === "connection" &&
          c.caller.connection === connection,
      ),
  );
  const findings = operationContractFindings(design);
  return (
    <section
      className="ownership-summary operation-summary"
      aria-label="Declared operation responsibilities"
    >
      {receivers.map((receiver) => (
        <details key={receiver.id} open>
          <summary>{operationDisplayName(receiver.implementation)}</summary>
          <p>
            {design.elements.find((x) => x.id === receiver.role)?.name ?? receiver.role} · same
            canonical role
          </p>
          <p>
            {isCreateOperation(receiver.implementation) && receiver.binding.kind === "create-link"
              ? `Authenticated · durable commit · ${receiver.binding.successRetentionHours === null ? "Replay retention unspecified" : "24h replay"}`
              : isResolveOperation(receiver.implementation)
                ? "Public · 307 · all-outcome no-store · primary + positive cache"
                : "Unknown behavior; exact reference retained"}{" "}
            · {model.calls.filter((x) => x.receiverBinding === receiver.id).length} caller bindings
          </p>
          <p className="studio-field-help">
            {findingsForOperationBinding(design, receiver.id, findings).length} unresolved
            declarations. Template / runtime evidence unavailable.
          </p>
          <button
            type="button"
            aria-pressed={selectedBinding === receiver.id}
            onClick={() => onConfigure(receiver.id)}
          >
            Details & bindings
          </button>
          {selectedBinding === receiver.id ? (
            <p className="studio-field-help">Selected operation for chat · {receiver.id}</p>
          ) : null}
        </details>
      ))}
      <button type="button" onClick={() => onConfigure()}>
        Operation contracts
      </button>
    </section>
  );
}
