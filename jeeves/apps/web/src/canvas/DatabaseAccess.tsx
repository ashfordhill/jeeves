import {
  buildStudioCommand,
  type DesignDocument,
  designOwnership,
  hasModuleSelections,
  idsPinned,
  type ProductAccess,
  sharedOwnerApiKinds,
} from "@jeeves/spec";
import { useState } from "react";
import { commitAction } from "../studio/actions.ts";

/** A normal process inspector choice; credentials and generated namespaces stay internal. */
export function DatabaseAccess({
  projectId,
  design,
  tile,
}: {
  projectId: string;
  design: DesignDocument;
  tile: string;
}) {
  const ownership = designOwnership(design);
  const studio = design.architecture?.studio;
  const kind = studio?.elements.find((item) => item.element === tile)?.settings.kind;
  const [error, setError] = useState("");
  const apply = async (command: Parameters<typeof buildStudioCommand>[1]) => {
    setError("");
    try {
      await commitAction(projectId, (current) => buildStudioCommand(current, command).ops);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  const name = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  if (
    design.schemaVersion !== 3 ||
    idsPinned(design) ||
    !hasModuleSelections(design) ||
    (kind !== "worker" && kind !== "database")
  )
    return null;
  const database = studio?.elements.find((item) => item.element === tile);
  const resource = ownership.resources.find((item) => item.element === tile);
  const ownerTile = database?.owner?.kind === "element" ? database.owner.id : undefined;
  const ownerOf = (id: string | undefined) =>
    ownership.roles.find((role) => role.element === id)?.owner;
  const readers = [
    ...new Set(
      design.connections
        .filter((link) => link.to.element === tile)
        .map((link) => link.from.element),
    ),
  ];
  return (
    <section aria-label="Database ownership and access">
      {kind === "worker" ? (
        <details className="studio-db-access">
          <summary>Database ownership</summary>
          <div className="studio-form-field">
            <label htmlFor={`shared-owner-${tile}`}>Who owns this worker’s data?</label>
            <select
              id={`shared-owner-${tile}`}
              value={ownership.roles.find((role) => role.element === tile)?.sharedWith ?? ""}
              onChange={(event) =>
                void apply({ type: "shareOwner", worker: tile, api: event.currentTarget.value })
              }
            >
              <option value="" disabled>
                This worker
              </option>
              {studio?.elements
                .filter((item) => sharedOwnerApiKinds.some((kind) => kind === item.settings.kind))
                .map((item) => (
                  <option key={item.element} value={item.element}>
                    Share with {name(item.element)}
                  </option>
                ))}
            </select>
            <small>
              Share with an API when both need to update the same data. Each keeps its own database
              permissions.
            </small>
          </div>
        </details>
      ) : (
        readers.map((role) => {
          const roleOwner = ownerOf(role);
          const ownTables = resource
            ? resource.kind === "source" && roleOwner === resource.authority
            : role === ownerTile || (!!roleOwner && roleOwner === ownerOf(ownerTile));
          return (
            <details key={role} className="studio-db-access">
              <summary>Access for {name(role)}</summary>
              <RelationAccess
                key={design.revision}
                fieldId={`${tile}-${role}`}
                ownTables={ownTables}
                product={
                  ownership.grants.find((grant) => grant.role === role && grant.resource === tile)
                    ?.product
                }
                save={(product) =>
                  apply({ type: "setDatabaseAccess", role, database: tile, product })
                }
              />
            </details>
          );
        })
      )}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function RelationAccess({
  fieldId,
  ownTables,
  product,
  save,
}: {
  fieldId: string;
  ownTables: boolean;
  product?: ProductAccess;
  save: (product: ProductAccess) => Promise<void>;
}) {
  const [table, setTable] = useState("");
  const [operations, setOperations] = useState<ProductAccess["tables"][number]["operations"]>([
    "SELECT",
  ]);
  const [view, setView] = useState("");
  return (
    <fieldset>
      <legend>Database permissions</legend>
      <p>
        {ownTables
          ? "Choose which existing tables and views this service can use."
          : "This service can read named views published by the database owner."}
      </p>
      <ul>
        {product?.tables.map((item) => (
          <li key={item.name}>
            {item.name}: {item.operations.join(", ")}
          </li>
        ))}
        {product?.views.map((name) => (
          <li key={name}>published.{name}: SELECT</li>
        ))}
      </ul>
      {ownTables ? (
        <>
          <label htmlFor={`product-table-${fieldId}`}>Table name</label>
          <input
            id={`product-table-${fieldId}`}
            value={table}
            onChange={(event) => setTable(event.currentTarget.value)}
            placeholder="items"
          />
          <div>
            {(["SELECT", "INSERT", "UPDATE", "DELETE"] as const).map((operation) => (
              <label key={operation}>
                <input
                  type="checkbox"
                  checked={operations.includes(operation)}
                  onChange={(event) =>
                    setOperations(
                      event.currentTarget.checked
                        ? [...operations, operation]
                        : operations.filter((item) => item !== operation),
                    )
                  }
                />
                {operation}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!table || !operations.length}
            onClick={() =>
              void save({
                tables: [
                  ...(product?.tables.filter((item) => item.name !== table) ?? []),
                  { name: table, operations },
                ],
                views: product?.views ?? [],
              })
            }
          >
            Save table access
          </button>
        </>
      ) : null}
      <label htmlFor={`product-view-${fieldId}`}>Published view</label>
      <input
        id={`product-view-${fieldId}`}
        value={view}
        onChange={(event) => setView(event.currentTarget.value)}
        placeholder="visible_items"
      />
      <button
        type="button"
        disabled={!view}
        onClick={() =>
          void save({
            tables: product?.tables ?? [],
            views: [...new Set([...(product?.views ?? []), view])],
          })
        }
      >
        Allow named view
      </button>
      {product ? (
        <button type="button" onClick={() => void save({ tables: [], views: [] })}>
          Clear product access
        </button>
      ) : null}
    </fieldset>
  );
}
