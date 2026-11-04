import { builtinRegistry } from "@jeeves/registry";
import {
  type ArchitectureLibraryEntry,
  applyOperations,
  architectureSchema,
  buildStudioCommand,
  type DesignDocument,
  instantiateStudioPackagePreset,
  type LibraryInsertInput,
  type OperationInput,
  previewArchitectureTemplate,
  type StudioCommand,
  type StudioCreationScope,
  type StudioKind,
  type StudioScopeProjection,
  studioApplicationKinds,
  studioDefinitions,
  studioNodeKeys,
  studioResourceKinds,
  studioScopes,
  studioServiceWorkerPreset,
  studioViews,
} from "@jeeves/spec";
import { useDraw } from "../draw/store.ts";
import { arrangeStudio, studioLanding } from "./layout.ts";

export type Point = { x: number; y: number };
export type BaseCreation = StudioKind | "person" | "external-system";
export type Creation =
  | { type: "base"; kind: BaseCreation }
  | { type: "package" }
  | { type: "composition"; entry: ArchitectureLibraryEntry; roles: LibraryInsertInput["roles"] }
  | { type: "group"; members: string[]; name: string };
/** C3 is whole-system: resources and queues created there are owned by the selected application. */
export function creationScope(scope: StudioScopeProjection): StudioCreationScope | undefined {
  return scope.level === "context" ? undefined : scope.level === "containers" ? "c2" : "c3-service";
}
export function baseTools(scope: StudioScopeProjection): BaseCreation[] {
  if (scope.level === "context") return ["person", "external-system"];
  if (scope.level === "containers")
    return ["service", "browser", "database", "cache", "external-api"];
  return ["database", "cache", "queue"];
}
export const creationLabel = (kind: BaseCreation) =>
  kind === "person"
    ? "Person"
    : kind === "external-system"
      ? "External system"
      : studioDefinitions[kind].creationName;
export const initialPosition = (index: number): Point => ({
  x: (index % 3) * 288,
  y: Math.floor(index / 3) * 168,
});

/** Nearest free 24-unit grid cell, conservatively reserving the largest 216×96 role. */
export function landing(point: Point, obstacles: Point[]): Point {
  const moving = "new";
  return studioLanding(
    {
      ...Object.fromEntries(
        obstacles.map((p, i) => [`obstacle:${i}`, { ...p, width: 216, height: 96 }]),
      ),
      [moving]: { ...point, width: 216, height: 96 },
    },
    { [moving]: point },
  )[moving] as Point;
}
const uniqueName = (base: string, names: Set<string>) => {
  let name = base;
  for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
  names.add(name);
  return name;
};
const id = () => `studio-${crypto.randomUUID()}`;

/** IDs are allocated once; the actual command is rebuilt inside the existing serialized queue. */
export async function createAt(
  projectId: string,
  scopeKey: string,
  creation: Creation,
  point: Point,
  /** C3 only: the application that owns a new resource or queue. */
  owner?: string,
): Promise<string | undefined> {
  const ids = {
    package: id(),
    service: id(),
    worker: id(),
    queue: id(),
    publish: id(),
    consume: id(),
  };
  let selected =
    creation.type === "base"
      ? creation.kind === "person" || creation.kind === "external-system"
        ? studioNodeKeys.context(ids.service)
        : studioNodeKeys.element(ids.service)
      : studioNodeKeys.package(ids.package);
  const ok = await useDraw.getState().createPlaced(projectId, (design: DesignDocument) => {
    const loaded = useDraw.getState().loaded;
    const views = studioViews(design, studioDefinitions, loaded?.project.name ?? "System");
    const scope = studioScopes(views).find((item) => item.key === scopeKey);
    if (!scope) throw new Error("This scope changed; reopen it to add an object.");
    const names = new Set([
      ...design.elements.map((item) => item.name),
      ...(design.architecture?.nodes ?? []).map((item) => item.name),
      ...(design.architecture?.studio?.packages ?? []).map((item) => item.name),
    ]);
    const system = { name: loaded?.project.name ?? "System", description: "" };
    let command: StudioCommand;
    let ops: OperationInput[];
    if (creation.type === "composition") {
      if (scope.level !== "containers") throw new Error("Insert saved compositions at C2.");
      const preview = previewArchitectureTemplate(
        design,
        creation.entry,
        {
          id: creation.entry.id,
          version: creation.entry.version,
          contentHash: creation.entry.contentHash,
          instanceId: `lib-${ids.service.slice(-12)}`,
          name: creation.entry.metadata.name.slice(0, 80),
          baseRevision: design.revision,
          roles: creation.roles,
        },
        builtinRegistry(),
      );
      if (!preview.ok)
        throw new Error(
          preview.errors[0] ?? preview.unfilled[0] ?? "Select the required dependencies.",
        );
      ops = preview.ops;
      const architecture = ops.find((op) => op.op === "setArchitecture");
      const pkg =
        architecture?.op === "setArchitecture"
          ? architecture.architecture?.studio?.packages.find(
              (pkg) => !design.architecture?.studio?.packages.some((old) => old.id === pkg.id),
            )
          : undefined;
      const element = ops.find((op) => op.op === "addElement");
      if (pkg) selected = studioNodeKeys.package(pkg.id);
      else if (element?.op === "addElement") selected = studioNodeKeys.element(element.element.id);
      else throw new Error("This composition adds no new visible object.");
    } else if (
      creation.type === "base" &&
      (creation.kind === "person" || creation.kind === "external-system")
    ) {
      if (scope.level !== "context") throw new Error("Place context objects at C1.");
      const architecture = structuredClone(
        design.architecture ?? architectureSchema.parse({ system }),
      );
      architecture.nodes.push({
        id: ids.service,
        kind: creation.kind,
        name: uniqueName(creationLabel(creation.kind), names),
        description: "",
      });
      ops = [{ op: "setArchitecture", architecture }];
    } else {
      if (creation.type === "base") {
        const kind = creation.kind as StudioKind;
        const definition = studioDefinitions[kind];
        const target = creationScope(scope);
        if (!target || !definition.creationScopes.includes(target))
          throw new Error("This building block cannot be created in this scope.");
        if (kind === "queue" && scope.level === "components" && !owner)
          throw new Error("Select the application that owns this queue first.");
        const created: Extract<StudioCommand, { type: "create" }> = {
          type: "create",
          system,
          elements: [
            {
              id: ids.service,
              name: uniqueName(definition.creationName, names),
              settings: structuredClone(definition.defaults),
              ...(studioResourceKinds.some((resource) => resource === kind) &&
                scope.level === "components" &&
                owner && { owner: { kind: "element" as const, id: owner } }),
            },
          ],
        };
        command = created;
      } else if (creation.type === "package") {
        if (scope.level !== "containers") throw new Error("Create packages at C2.");
        command = instantiateStudioPackagePreset(studioServiceWorkerPreset, ids, system);
        for (const element of command.elements) element.name = uniqueName(element.name, names);
        if (command.package) command.package.name = uniqueName(command.package.name, names);
      } else {
        if (scope.level !== "containers") throw new Error("Group applications at C2.");
        const eligible = scope.nodes.filter((node) =>
          studioApplicationKinds.some((kind) => kind === node.kind),
        );
        if (
          creation.members.length < 2 ||
          creation.members.some(
            (member) =>
              !eligible.some((node) =>
                node.refs.some((ref) => ref.kind === "element" && ref.id === member),
              ),
          )
        )
          throw new Error("Select at least two ungrouped applications.");
        command = {
          type: "group",
          package: {
            id: ids.package,
            name: creation.name.trim(),
            description: "",
            members: creation.members,
          },
        };
      }
      const architecture = design.architecture ?? architectureSchema.parse({ system });
      ops = [
        ...(!design.architecture && command.type === "group"
          ? [{ op: "setArchitecture" as const, architecture }]
          : []),
        ...buildStudioCommand(
          command.type === "group" ? { ...design, architecture } : design,
          command,
        ).ops,
      ];
    }
    const applied = applyOperations(design, ops, builtinRegistry(), {
      baseRevision: design.revision,
    });
    if (!applied.ok) throw new Error(applied.errors[0]?.message ?? "This creation is invalid.");
    const next = studioViews(applied.design, studioDefinitions, loaded?.project.name ?? "System");
    const nextScope = studioScopes(next).find((item) => item.key === scopeKey);
    const additions =
      nextScope?.nodes.filter((node) => !scope.nodes.some((old) => old.id === node.id)) ?? [];
    if (!additions.some((node) => node.id === selected)) {
      const first = additions[0];
      if (!first) throw new Error("This composition adds no visible object in this scope.");
      selected = first.id;
    }
    const placements: Record<string, Record<string, Point>> = {};
    for (const target of studioScopes(next)) {
      const previous = studioScopes(views).find((item) => item.key === target.key);
      const fresh = target.nodes.filter(
        (node) => !previous?.nodes.some((old) => old.id === node.id),
      );
      if (!fresh.length) continue;
      const saved = loaded?.layout.architecture?.[target.key]?.positions;
      const automatic = previous ? arrangeStudio(previous) : {};
      const positions = Object.fromEntries(
        (previous?.nodes ?? []).map((node, index) => [
          node.id,
          saved?.[node.id] ?? automatic[node.id] ?? initialPosition(index),
        ]),
      );
      fresh.sort((a, b) =>
        a.id === selected ? -1 : b.id === selected ? 1 : a.id.localeCompare(b.id),
      );
      for (const node of fresh)
        positions[node.id] = landing(
          target.key === scopeKey ? point : initialPosition(target.nodes.indexOf(node)),
          Object.values(positions),
        );
      placements[target.key] = positions;
    }
    return { ops, positions: placements };
  });
  return ok ? selected : undefined;
}
