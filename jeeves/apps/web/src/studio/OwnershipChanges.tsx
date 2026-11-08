import { type DesignDocument, type OwnershipChange, ownershipChangeSummary } from "@jeeves/spec";

/** Named permission/authority changes first; canonical IDs and raw declarations remain inspectable. */
export function OwnershipChanges({
  design,
  changes,
}: {
  design: DesignDocument;
  changes: OwnershipChange[];
}) {
  return (
    <ul className="ownership-changes">
      {changes.map((row) => (
        <li key={`${row.field}/${row.id}`}>
          <strong>{ownershipChangeSummary(design, row, changes)}</strong>
          <details>
            <summary>
              {row.change} · {row.field} · {row.id}
            </summary>
            <pre>{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}
