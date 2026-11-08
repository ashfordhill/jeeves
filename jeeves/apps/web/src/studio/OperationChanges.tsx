import { type DesignDocument, type OperationChange, operationChangeSummary } from "@jeeves/spec";

export function OperationChanges({
  design,
  changes,
}: {
  design: DesignDocument;
  changes: OperationChange[];
}) {
  return (
    <ul className="ownership-changes">
      {changes.map((row) => (
        <li key={`${row.field}/${row.id}`}>
          <strong>{operationChangeSummary(design, row)}</strong>
          <details>
            <summary>
              {row.change} · operations · {row.id}
            </summary>
            <pre>{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}
