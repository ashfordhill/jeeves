/**
 * Each module's generation status, for the inspector, chat and Generate (module authoring
 * contract, sections 5 and 6). Pure and read-only: it reads the saved selections and never derives
 * or writes one.
 * - **Template:** the lead of a selected template, or a part its binding traces.
 * - **Stub:** a module whose own selection is the module stub, with what its template still needs.
 * - **Custom:** no selection covers it (a design without module-level selections, or a module no
 *   module command has declared yet).
 * - **Refused:** its template is selected but a kept value it may not overwrite blocks generation,
 *   with the resolver's reason.
 */
import type { DesignDocument } from "./design.ts";
import type { Finding } from "./findings.ts";
import {
  designGeneration,
  type GenerationBinding,
  type GenerationSelection,
  generationHost,
  generationReferences,
} from "./generation.ts";
import { resolveGeneration } from "./generation-resolver.ts";
import { covers, planModules } from "./module-generation.ts";
import {
  type StudioComponent,
  type StudioComponentKind,
  type StudioModuleSlotId,
  studioComponentDefinitions,
} from "./studio-components.ts";
import { moduleSlots } from "./studio-modules.ts";

export const moduleStatusKinds = ["template", "stub", "custom", "refused"] as const;
export type ModuleStatusKind = (typeof moduleStatusKinds)[number];
export const moduleStatusLabels: Record<ModuleStatusKind, string> = {
  template: "Template",
  stub: "Stub",
  custom: "Custom",
  refused: "Refused",
};
export type ModuleStatus = {
  module: string;
  /** The module's name. */
  name: string;
  host: string;
  kind: StudioComponentKind;
  status: ModuleStatusKind;
  /** The template it leads or is part of (Template, Refused). */
  template?: GenerationBinding["kind"];
  /** The selection that covers it: its own, or its lead's. */
  selection?: string;
  /** Stub: what its template still needs; Refused: why; Custom: why nothing covers it. */
  reason?: string;
  /** Its slots with no connection, in catalog order. */
  unconnected: StudioModuleSlotId[];
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Path = (string | number)[];
const within = (path: Path | undefined, prefix: Path) =>
  !!path && prefix.every((part, index) => path[index] === part);

/** The source paths a selection's resolution reads: its row, host, stores, links and modules. */
function selectionScope(
  design: DesignDocument,
  selection: GenerationSelection,
  index: number,
  members: readonly string[],
): Path[] {
  const studio = design.architecture?.studio;
  const elements = [generationHost(selection)];
  const connections: string[] = [];
  for (const item of generationReferences(selection.binding).resources) {
    elements.push(item.dependency.resource);
    connections.push(item.dependency.connection);
  }
  if (
    selection.binding.kind === "owned-multipart" ||
    selection.binding.kind === "verified-identity"
  )
    elements.push(selection.binding.identity.element);
  return [
    ["generation", "selections", index],
    ...elements.map((id) => [
      "architecture",
      "studio",
      "elements",
      studio?.elements.findIndex((item) => item.element === id) ?? -1,
    ]),
    ...connections.flatMap((id) => [
      ["connections", design.connections.findIndex((item) => item.id === id)],
      [
        "architecture",
        "studio",
        "connections",
        studio?.connections.findIndex((item) => item.connection === id) ?? -1,
      ],
    ]),
    ...members.map((id) => [
      "architecture",
      "studio",
      "components",
      studio?.components?.findIndex((item) => item.id === id) ?? -1,
    ]),
  ];
}

/**
 * The kept value a blocking finding points at, in plain words ("The link from Redirect service to
 * URL cache uses Service identity", "Redirect service's language is go"), or `undefined` for a
 * finding on anything else.
 */
function keptValue(design: DesignDocument, path: Path | undefined): string | undefined {
  const name = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  const shown = (raw: unknown) =>
    typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
      ? String(raw)
      : undefined;
  const [area, a, b, c, d, e] = path ?? [];
  if (area === "connections" && typeof a === "number" && b === "planned" && typeof c === "string") {
    const connection = design.connections[a];
    const value = shown((connection?.planned as Record<string, unknown> | undefined)?.[c]);
    if (!connection || !value) return undefined;
    return `The link from ${name(connection.from.element)} to ${name(connection.to.element)} uses ${value}`;
  }
  if (area !== "architecture" || a !== "studio" || typeof c !== "number") return undefined;
  if (d !== "settings" || typeof e !== "string") return undefined;
  const studio = design.architecture?.studio;
  const holder =
    b === "elements"
      ? { name: name(studio?.elements[c]?.element ?? ""), settings: studio?.elements[c]?.settings }
      : b === "components"
        ? { name: studio?.components?.[c]?.name, settings: studio?.components?.[c]?.settings }
        : undefined;
  if (!holder?.name || !holder.settings) return undefined;
  const setting = e.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  const value = shown((holder.settings as Record<string, unknown>)[e]);
  const owner = holder.name.endsWith("s") ? `${holder.name}'` : `${holder.name}'s`;
  return `${owner} ${setting} ${value ? `is ${value}` : "is set"}`;
}

/** Every module's status, in the design's module order. */
export function moduleStatuses(design: DesignDocument): ModuleStatus[] {
  const studio = design.architecture?.studio;
  const modules = studio?.components ?? [];
  if (!modules.length) return [];
  const selections = designGeneration(design)?.selections ?? [];
  const own = new Map(
    selections.flatMap((item) =>
      item.target.kind === "component" ? [[item.target.component, item] as const] : [],
    ),
  );
  const moduleLevel = own.size > 0;
  const plan = planModules(design);
  const leads = new Map(plan.leads.map((item) => [item.lead.id, item]));
  const findings: readonly Finding[] = moduleLevel ? resolveGeneration(design).findings : [];
  const nameOf = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  const covering = (module: StudioComponent) =>
    selections.find((item) => item.target.kind === "component" && covers(design, item, module)) ??
    selections.find((item) => item.target.kind === "element" && covers(design, item, module));
  /** Why a module-level template selection is blocked, in plain words, if it is. */
  const blocked = (selection: GenerationSelection) => {
    const index = selections.indexOf(selection);
    const members = modules
      .filter((item) => covers(design, selection, item))
      .map((item) => item.id);
    const scope = selectionScope(design, selection, index, members);
    const template: Path = ["generation", "selections", index, "template"];
    const blocking = findings.filter((item) => {
      const path = item.target.path;
      if (!path || (path.length === template.length && within(path, template))) return false;
      return scope.some((prefix) => within(path, prefix));
    });
    const [first] = blocking;
    if (!first) return undefined;
    const kept = keptValue(design, first.target.path);
    if (!kept) return first.message;
    const more = blocking.length - 1;
    return `${kept}, which its template can't use${
      more ? `; ${more} other saved value${more > 1 ? "s" : ""} can't be used either` : ""
    }.`;
  };
  const stubReason = (module: StudioComponent): string => {
    const definition = studioComponentDefinitions[module.settings.kind];
    const generation = definition.generation;
    if (generation.kind === "stub")
      return module.settings.kind === "custom"
        ? "Your own logic, with no template."
        : `${definition.name} has no template.`;
    if (generation.kind === "lead") {
      const lead = leads.get(module.id);
      if (lead?.missing) return `Needs ${lead.missing}.`;
      return (
        plan.refusals.find((item) => item.includes(module.name)) ??
        "Its template isn't selected yet."
      );
    }
    const templates: readonly string[] = generation.templates;
    const beside = plan.leads.filter(
      (item) => item.lead.host === module.host && templates.includes(item.template),
    );
    const waiting = beside.find((item) => item.missing);
    if (waiting) return `Waits for ${waiting.lead.name}, which needs ${waiting.missing}.`;
    const [other] = beside;
    if (other) return `${sentence(other.lead.name)} doesn't use it.`;
    // A part with no lead beside it is a normal stub: say so, not what it could join.
    return `No template in ${nameOf(module.host)} uses it.`;
  };
  return modules.map((module) => {
    const base = {
      module: module.id,
      name: module.name,
      host: module.host,
      kind: module.settings.kind,
      unconnected: moduleSlots(design, module.id)
        .filter((item) => !item.links.length)
        .map((item) => item.slot.id),
    };
    const selection = own.get(module.id);
    if (selection?.binding.kind === "module-stub")
      return {
        ...base,
        status: "stub",
        selection: selection.id,
        reason: stubReason(module),
      } satisfies ModuleStatus;
    const covered = selection ?? covering(module);
    if (!covered)
      return {
        ...base,
        status: "custom",
        reason: moduleLevel
          ? "Not declared yet; the next module change declares it."
          : "No template covers it.",
      } satisfies ModuleStatus;
    const reason = covered.target.kind === "component" ? blocked(covered) : undefined;
    return {
      ...base,
      status: reason ? "refused" : "template",
      template: covered.binding.kind,
      selection: covered.id,
      ...(reason && { reason }),
    } satisfies ModuleStatus;
  });
}

/** One module's status, or `undefined` when there is no such module. */
export function moduleStatus(design: DesignDocument, module: string): ModuleStatus | undefined {
  return moduleStatuses(design).find((item) => item.module === module);
}
