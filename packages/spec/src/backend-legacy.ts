/** Derived legacy compiler input. The saved resource descriptor remains the sole authority. */
import { contractKey } from "./architecture-contracts.ts";
import type { BackendReference } from "./backend-model.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { type Resource, resourceConfigSchema } from "./resources.ts";

type DeepReadonly<T> = T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } : T;
export type LegacyBackendResource = DeepReadonly<{
  kind: "legacy-resource";
  source: { kind: "resource"; element: string; attachment: string; resource: string };
  template: { id: string; version: string };
  storeConnection?: string;
  store?: string;
  /** Includes the existing fields/belongsTo/access/operations, without translating their types. */
  descriptor: Resource;
  contracts: BackendReference[];
  /** A separate namespace keeps implicit columns distinct from authored stable field IDs. */
  systemFields: ("id" | "ownerId" | "createdAt")[];
  access: "legacy-owner" | "legacy-internal";
}>;

function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Deterministic, detached and deeply frozen. Never writes architecture.backend or source contracts. */
export function readLegacyBackendResources(design: DesignDocument): {
  resources: readonly LegacyBackendResource[];
  findings: Finding[];
} {
  const resources: LegacyBackendResource[] = [];
  const findings: Finding[] = [];
  for (const element of design.elements)
    for (const attachment of element.attachments) {
      if (attachment.template.id !== "rest-api-server" || attachment.config.model === undefined)
        continue;
      const parsed = resourceConfigSchema.safeParse(attachment.config.model);
      const path = ["elements", element.id, "attachments", attachment.id, "config", "model"];
      if (!parsed.success) {
        findings.push(
          finding(
            "CONFIG_INVALID",
            "Cannot adapt an invalid authoritative legacy resource model.",
            { path },
          ),
        );
        continue;
      }
      const model = parsed.data;
      const connection = design.connections.find(
        (c) =>
          c.id === model.storeConnection &&
          c.kind === "uses-database" &&
          c.from.element === element.id,
      );
      const store =
        connection &&
        design.elements.find(
          (e) => e.id === connection.to.element && e.template?.id === "postgres",
        );
      if (!store)
        findings.push(
          finding(
            "CONFIG_REQUIRED",
            "Select the legacy model's existing Postgres storeConnection before compilation.",
            { path: [...path, "storeConnection"] },
          ),
        );
      for (const resource of model.resources) {
        const contracts = (design.architecture?.contracts ?? [])
          .filter(
            (c) =>
              c.kind === "data" &&
              c.source?.kind === "resource" &&
              c.source.element === element.id &&
              c.source.attachment === attachment.id &&
              c.source.resource === resource.id,
          )
          .map(({ id, version }) => ({ id, version }))
          .sort((a, b) =>
            contractKey(a) < contractKey(b) ? -1 : contractKey(a) > contractKey(b) ? 1 : 0,
          );
        resources.push(
          freeze({
            kind: "legacy-resource" as const,
            source: {
              kind: "resource" as const,
              element: element.id,
              attachment: attachment.id,
              resource: resource.id,
            },
            template: { ...attachment.template },
            ...(model.storeConnection ? { storeConnection: model.storeConnection } : {}),
            ...(store ? { store: store.id } : {}),
            descriptor: resource,
            contracts,
            systemFields: resource.access === "owner" ? ["id", "ownerId", "createdAt"] : ["id"],
            access:
              resource.access === "owner"
                ? ("legacy-owner" as const)
                : ("legacy-internal" as const),
          }),
        );
      }
    }
  resources.sort((a, b) => {
    const key = (r: LegacyBackendResource) =>
      JSON.stringify([r.source.element, r.source.attachment, r.source.resource]);
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
  return { resources: Object.freeze(resources), findings };
}
