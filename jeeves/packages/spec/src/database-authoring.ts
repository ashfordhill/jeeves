/** Normal authoring for existing logical ownership and finite product relation permissions. */
import type { DesignDocument } from "./design.ts";
import type { OperationInput } from "./operations.ts";
import {
  designOwnership,
  type Ownership,
  type ProductAccess,
  sharedOwnerApiKinds,
} from "./ownership.ts";
import { freshId, usedIds } from "./studio-ids.ts";
import { idsPinned } from "./studio-rekey.ts";

export type DatabaseAuthoringCommand =
  | { type: "shareOwner"; worker: string; api: string }
  | {
      type: "setDatabaseAccess";
      role: string;
      database: string;
      product: ProductAccess;
    };

export function databaseAuthoring(
  design: DesignDocument,
  command: DatabaseAuthoringCommand,
): OperationInput[] {
  if (design.schemaVersion !== 3)
    throw new Error("Add a module before declaring database ownership/access.");
  if (
    idsPinned(design) ||
    !design.generation?.selections.some((selection) => selection.target.kind === "component")
  )
    throw new Error(
      "Database ownership/access needs a design built from modules. Historical declarations remain readable.",
    );
  const ownership: Ownership = structuredClone(designOwnership(design));
  const studio = design.architecture?.studio;
  const kind = (id: string) => studio?.elements.find((item) => item.element === id)?.settings.kind;
  const name = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  const role = (id: string): Ownership["roles"][number] => {
    const existing = ownership.roles.find((item) => item.element === id);
    if (existing) return existing;
    if (
      ![
        "service",
        "worker",
        "uploads",
        "redirect",
        "gateway",
        "billing",
        "identity",
        "notification",
      ].includes(kind(id) ?? "")
    )
      throw new Error(`There is no application role ${id}.`);
    const owner = freshId(
      `${id}-owner`,
      (candidate) =>
        usedIds(design).has(candidate) || ownership.owners.some((item) => item.id === candidate),
    );
    ownership.owners.push({ id: owner, name: name(id) });
    const created = {
      element: id,
      owner,
      kind: kind(id) === "worker" ? ("worker" as const) : ("api" as const),
    };
    ownership.roles.push(created);
    return created;
  };
  if (command.type === "shareOwner") {
    if (
      kind(command.worker) !== "worker" ||
      !sharedOwnerApiKinds.some((api) => api === kind(command.api))
    )
      throw new Error("Choose the worker and the API that owns its data.");
    const api = role(command.api);
    const worker = role(command.worker);
    if (
      worker.owner !== api.owner &&
      (ownership.resources.some((item) => item.authority === worker.owner) ||
        ownership.grants.some(
          (item) =>
            item.role === worker.element &&
            item.access !== "read" &&
            ownership.resources.find((resource) => resource.element === item.resource)
              ?.authority !== api.owner,
        ))
    )
      throw new Error(
        `${name(command.worker)} already has data owned elsewhere. Choose an API only if both own the same data.`,
      );
    worker.owner = api.owner;
    worker.sharedWith = api.element;
    for (const resource of ownership.resources)
      if (
        resource.kind === "source" &&
        kind(resource.element) === "database" &&
        resource.authority === api.owner
      )
        resource.productNamespace = "owner";
  } else {
    if (kind(command.database) !== "database")
      throw new Error("Choose a database for product access.");
    const connection = design.connections.find(
      (item) => item.from.element === command.role && item.to.element === command.database,
    );
    if (!connection)
      throw new Error(
        "Connect the application's module to this database before declaring its product access.",
      );
    const runtime = role(command.role);
    let resource = ownership.resources.find((item) => item.element === command.database);
    if (!resource) {
      const binding = studio?.elements.find((item) => item.element === command.database);
      const ownerTile = binding?.owner?.kind === "element" ? binding.owner.id : undefined;
      if (!ownerTile) throw new Error("The database needs an unambiguous owning application tile.");
      resource = {
        element: command.database,
        kind: "source",
        authority: role(ownerTile).owner,
      };
      ownership.resources.push(resource);
    }
    const foreign = runtime.owner !== resource.authority;
    if (foreign && command.product.tables.length)
      throw new Error(
        "Only the database owner can grant access to tables. Other services can read named published views.",
      );
    if (command.product.tables.length) {
      if (resource.kind !== "source")
        throw new Error("Private product tables require a source database.");
      resource.productNamespace = "owner";
    }
    const reads =
      command.product.views.length > 0 ||
      command.product.tables.some((item) => item.operations.includes("SELECT"));
    const writes = command.product.tables.some((item) =>
      item.operations.some((operation) => operation !== "SELECT"),
    );
    const requested =
      reads && writes ? "read-write" : writes ? "write" : reads ? "read" : undefined;
    const previousAccess = ownership.grants.find(
      (grant) => grant.role === runtime.element && grant.resource === command.database,
    )?.access;
    // Product allowlists revoke independently of the coarse access required by template mechanisms.
    const access = !requested
      ? (previousAccess ?? "read")
      : previousAccess && previousAccess !== requested
        ? "read-write"
        : requested;
    ownership.grants = ownership.grants.filter(
      (item) => item.role !== runtime.element || item.resource !== command.database,
    );
    ownership.grants.push({
      role: runtime.element,
      resource: command.database,
      access,
      ...(foreign && { boundary: "published-read" as const }),
      product: command.product,
    });
    ownership.dependencies = ownership.dependencies.filter(
      (item) => item.connection !== connection.id,
    );
    ownership.dependencies.push({ connection: connection.id, access });
  }
  const referenced = new Set([
    ...ownership.roles.map((item) => item.owner),
    ...ownership.resources.map((item) => item.authority),
  ]);
  ownership.owners = ownership.owners.filter((item) => referenced.has(item.id));
  return [{ op: "setOwnership", ownership }];
}
