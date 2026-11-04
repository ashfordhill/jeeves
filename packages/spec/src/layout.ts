import { z } from "zod";
import { type DesignDocument, designIds } from "./design.ts";
import { idSchema } from "./ids.ts";

const pointSchema = z.strictObject({ x: z.number(), y: z.number() });
const cameraSchema = z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() });
const viewIdentity = z.string().min(1).max(300);

/** Projection identities (container:…, responsibility:…) refer to the same semantic objects. */
export const architectureLayoutViewSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  members: z.array(viewIdentity).max(200).optional(),
  includeDependencies: z.boolean().optional(),
  positions: z.record(viewIdentity, pointSchema).default({}),
  viewport: cameraSchema.optional(),
  down: z.boolean().optional(),
});
export type ArchitectureLayoutView = z.output<typeof architectureLayoutViewSchema>;

export const layoutItemSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  collapsed: z.boolean().optional(),
  /** Frame annotation this item sits in. */
  parent: idSchema.optional(),
  /** Waypoints for connections and plain arrows; free arrow ends are the first and last. */
  points: z.array(pointSchema).optional(),
});
export type LayoutItem = z.infer<typeof layoutItemSchema>;

/**
 * Positions and sizes, keyed by design ID. Stored separately from the design so moving things
 * never changes the semantic revision or what Generate produces.
 */
export const layoutSchema = z.strictObject({
  schemaVersion: z.literal(1),
  items: z.record(idSchema, layoutItemSchema).default({}),
  viewport: cameraSchema.optional(),
  /** Optional so old board layout documents round-trip without migration or new defaults. */
  architecture: z.record(viewIdentity, architectureLayoutViewSchema).optional(),
});
export type LayoutDocument = z.output<typeof layoutSchema>;

export function emptyLayout(): LayoutDocument {
  return { schemaVersion: 1, items: {} };
}

/** Drops layout entries (and frame parents) for IDs the design no longer has. */
export function pruneLayout(layout: LayoutDocument, design: DesignDocument): LayoutDocument {
  const ids = new Set(Array.from(designIds(design), (entry) => entry.id));
  const items: LayoutDocument["items"] = {};
  for (const [id, item] of Object.entries(layout.items)) {
    if (!ids.has(id)) continue;
    if (item.parent !== undefined && !ids.has(item.parent)) {
      const { parent: _parent, ...rest } = item;
      items[id] = rest;
    } else {
      items[id] = item;
    }
  }
  return pruneArchitectureLayout({ ...layout, items }, design);
}

/** Architecture pruning must not discard a board placement awaiting its semantic operation. */
export function pruneArchitectureLayout(
  layout: LayoutDocument,
  design: DesignDocument,
): LayoutDocument {
  if (!layout.architecture) return layout;
  const alive = (key: string): boolean => {
    // Studio identities are canonical references, not another graph. Preserve old view keys below.
    if (key.startsWith("studio:")) {
      const [, kind, id] = key.split(":");
      if (kind === "system") return !!design.architecture;
      if (kind === "package")
        return !!design.architecture?.studio?.packages.some((item) => item.id === id);
      if (kind === "element" || kind === "service" || kind === "resource")
        return design.elements.some((item) => item.id === id);
      if (kind === "context")
        return id === "system" || !!design.architecture?.nodes.some((item) => item.id === id);
      if (kind === "connection") return design.connections.some((item) => item.id === id);
      return false;
    }
    if (key.startsWith("deployment:")) {
      const [, environment, id, replica] = key.split(":");
      const env = design.architecture?.deployments?.find((e) => e.id === environment);
      return (
        !!env &&
        (replica
          ? env.instances.some(
              (i) => i.id === id && Number(replica) >= 1 && Number(replica) <= i.replicas,
            )
          : [...env.nodes, ...env.externals].some((i) => i.id === id))
      );
    }
    const [kind, owner, attachment, memberKind, member] = key.split(":");
    if (kind === "context")
      return owner === "system" || !!design.architecture?.nodes.some((node) => node.id === owner);
    if (kind === "responsibility")
      return !!design.architecture?.components?.some((component) => component.id === owner);
    const element = design.elements.find((element) => element.id === owner);
    if (!element) return false;
    if (kind === "container") return true;
    if (kind !== "component") return false;
    if (["workspace", "workspace-extension"].includes(attachment ?? "")) return true;
    const capability = element.attachments.find((item) => item.id === attachment);
    if (!capability) return false;
    if (!member || !memberKind) return true;
    const config = capability.config;
    const model = config.model as
      | { resources?: { id: string }[]; extensions?: { id: string }[] }
      | undefined;
    const members =
      memberKind === "resource"
        ? model?.resources
        : memberKind === "extension"
          ? model?.extensions
          : memberKind === "event"
            ? (config.events as { id: string }[] | undefined)
            : undefined;
    return Array.isArray(members) && members.some((item) => item.id === member);
  };
  const architecture = Object.fromEntries(
    Object.entries(layout.architecture).flatMap(([key, view]) => {
      if (
        key.startsWith("studio:service:") &&
        !design.elements.some((item) => item.id === key.slice(15))
      )
        return [];
      if (
        key.startsWith("studio:package:") &&
        !design.architecture?.studio?.packages.some((item) => item.id === key.slice(15))
      )
        return [];
      if (
        key.startsWith("deployment:") &&
        !design.architecture?.deployments?.some((e) => e.id === key.slice(11))
      )
        return [];
      if (
        key.startsWith("components:") &&
        !design.elements.some((item) => item.id === key.slice(11))
      )
        return [];
      return [
        [
          key,
          {
            ...view,
            ...(view.members && { members: view.members.filter(alive) }),
            positions: Object.fromEntries(
              Object.entries(view.positions).filter(([id]) => alive(id)),
            ),
          },
        ],
      ];
    }),
  );
  return { ...layout, architecture };
}
