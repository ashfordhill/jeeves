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
  const databases = design.connections.filter(
    (link) =>
      link.from.element === tile &&
      studio?.elements.some(
        (item) => item.element === link.to.element && item.settings.kind === "database",
      ),
  );
  if (
    design.schemaVersion !== 3 ||
    idsPinned(design) ||
    !hasModuleSelections(design) ||
    (kind !== "worker" && !databases.length)
  )
    return null;
  return (
    <section aria-label="Database ownership and access">
      {kind === "worker" ? (
        <div className="studio-form-field">
          <label htmlFor={`shared-owner-${tile}`}>Share logical owner with API</label>
          <select
            id={`shared-owner-${tile}`}
            value={ownership.roles.find((role) => role.element === tile)?.sharedWith ?? ""}
            onChange={(event) => {
              if (event.currentTarget.value)
                void apply({
                  type: "shareOwner",
                  worker: tile,
                  api: event.currentTarget.value,
                });
            }}
          >
            <option value="" disabled>
              Independent owner
            </option>
            {studio?.elements
              .filter((item) => sharedOwnerApiKinds.some((kind) => kind === item.settings.kind))
              .map((item) => (
                <option key={item.element} value={item.element}>
                  {name(item.element)}
                </option>
              ))}
          </select>
        </div>
      ) : null}
      {databases.map((link) => (
        <RelationAccess
          key={`${link.to.element}-${design.revision}`}
          database={link.to.element}
          name={name(link.to.element)}
          product={
            ownership.grants.find(
              (grant) => grant.role === tile && grant.resource === link.to.element,
            )?.product
          }
          save={(product) =>
            apply({
              type: "setDatabaseAccess",
              role: tile,
              database: link.to.element,
              product,
            })
          }
        />
      ))}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function RelationAccess({
  database,
  name,
  product,
  save,
}: {
  database: string;
  name: string;
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
      <legend>{name} product access</legend>
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
      <label htmlFor={`product-table-${database}`}>Product table</label>
      <input
        id={`product-table-${database}`}
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
      <label htmlFor={`product-view-${database}`}>Published view</label>
      <input
        id={`product-view-${database}`}
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
      <p>
        Exact table operations and named views only. Product access excludes template implementation
        tables.
      </p>
    </fieldset>
  );
}
