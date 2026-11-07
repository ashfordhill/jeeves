import {
  type DesignDocument,
  declaredAccessLabels,
  designOwnership,
  studioApplicationKinds,
} from "@jeeves/spec";

export function OwnershipSummary({
  design,
  element,
  connection,
  ownerId,
  expanded,
  onConfigure,
  onExpand,
  onCollapse,
  onRole,
}: {
  design: DesignDocument;
  element?: string;
  connection?: string;
  ownerId?: string;
  expanded: readonly string[];
  onConfigure: () => void;
  onExpand: (owner: string) => void;
  onCollapse: (owner: string) => void;
  onRole: (element: string) => void;
}) {
  const model = designOwnership(design);
  const role = model.roles.find((x) => x.element === element);
  const resource = model.resources.find((x) => x.element === element);
  const owner = model.owners.find((x) => x.id === (ownerId ?? role?.owner));
  const authority = model.owners.find((x) => x.id === resource?.authority);
  const dependency = model.dependencies.find((x) => x.connection === connection);
  const name = (id: string) => design.elements.find((x) => x.id === id)?.name ?? id;
  const link = design.connections.find((x) => x.id === connection);
  const grant =
    link &&
    model.grants.find((x) => x.role === link.from.element && x.resource === link.to.element);
  const kind = (id: string | undefined) =>
    design.architecture?.studio?.elements.find((x) => x.element === id)?.settings.kind;
  const isStore = (id: string | undefined) =>
    ["database", "cache", "object-store", "search"].includes(kind(id) ?? "");
  const storeLink =
    link &&
    (studioApplicationKinds as readonly string[]).includes(kind(link.from.element) ?? "") &&
    isStore(link.to.element);
  if (
    !owner &&
    !resource &&
    (!storeLink || design.schemaVersion === 2) &&
    (design.schemaVersion === 2 ||
      !(
        (studioApplicationKinds as readonly string[]).includes(kind(element) ?? "") ||
        isStore(element)
      ))
  )
    return (
      <section className="ownership-summary" aria-label="Ownership configuration">
        <button type="button" onClick={onConfigure}>
          Ownership & access
        </button>
      </section>
    );
  return (
    <section className="ownership-summary" aria-label="Declared ownership and access">
      {owner ? (
        <>
          <strong>{owner.name} · one logical owner</strong>
          <p>
            {role
              ? `${role.kind.toUpperCase()} role · ${name(role.element)}${role.deployable ? ` · deployable ${role.deployable}` : " · deployable unspecified"}`
              : "API and worker roles retain their original tile identities."}
          </p>
          <div className="ownership-role-list">
            {model.roles
              .filter((x) => x.owner === owner.id)
              .map((x) => (
                <button key={x.element} type="button" onClick={() => onRole(x.element)}>
                  {name(x.element)}
                </button>
              ))}
          </div>
          <button
            type="button"
            onClick={() =>
              expanded.includes(owner.id) ? onCollapse(owner.id) : onExpand(owner.id)
            }
          >
            {expanded.includes(owner.id) ? `Collapse ${owner.name}` : `Expand ${owner.name} roles`}
          </button>
        </>
      ) : resource ? (
        <>
          <strong>Explicit authority: {authority?.name ?? resource.authority}</strong>
          <p>
            {resource.kind === "source"
              ? "Source of truth"
              : `Projection of ${name(resource.source)} · population/freshness unspecified`}
          </p>
          {model.grants
            .filter((x) => x.resource === resource.element)
            .map((x) => (
              <p key={x.role}>
                {name(x.role)} · {declaredAccessLabels[x.access]}
                {x.boundary ? " · published read contract intent; details unresolved" : ""}
              </p>
            ))}
        </>
      ) : storeLink ? (
        <>
          <strong>
            Declared dependency:{" "}
            {dependency ? declaredAccessLabels[dependency.access] : "Unspecified"}
          </strong>
          <p>
            Role grant: {grant ? declaredAccessLabels[grant.access] : "Unspecified"}
            {grant?.boundary ? " · published read contract; details unresolved" : ""}. Legacy
            inferred access is separate.
          </p>
        </>
      ) : (
        <p>
          Logical owner, role and access declarations are {role ? "declared" : "unspecified"}. Names
          and packages grant nothing.
        </p>
      )}
      <button type="button" onClick={onConfigure}>
        Ownership & access
      </button>
      {owner || resource || dependency ? (
        <p className="studio-field-help">
          Design intent only. Inspect operation declarations separately; runtime authorization is
          unavailable.
        </p>
      ) : null}
    </section>
  );
}
