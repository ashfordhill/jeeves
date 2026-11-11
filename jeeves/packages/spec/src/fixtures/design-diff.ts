/**
 * A structural diff of any two designs by tile, link and module name, so IDs never matter
 * (generalised in V3-10 from MA09's v2 diff). It compares the system, actions and entries, tile
 * kinds and settings, links (endpoints, kind, interaction, protocol, security, channel use), module
 * kinds per tile and module links, the resolved generation (templates, bindings, inputs and
 * resources) and ownership (owners compared by their members). Every difference is a row; a list
 * of intended differences, each with its reason, covers the expected ones, and any other row is
 * unexpected.
 *
 * A module is keyed by its name when no other module has it, else by `Tile / Name`; a tile by its
 * name, with its ID when two tiles share one. A caller can compare the candidate's tiles and
 * modules under other names (a scorer's matching), and both sides' modules under renames.
 */
import type { DesignDocument } from "../design.ts";
import { designGeneration, type GenerationSelection } from "../generation.ts";
import { type NormalizedGenerationSelection, resolveGeneration } from "../generation-resolver.ts";
import type { GenerationInstalledSupport } from "../generation-support.ts";
import { designOwnership } from "../ownership.ts";

export type DesignDiffRow = { area: string; key: string; reference?: unknown; candidate?: unknown };
export type IntendedDifference = {
  area: string;
  /** The rows' keys it covers: exact, or every key the pattern matches. */
  key: string | RegExp;
  /** It covers only rows with a value on this side alone (a value the other side lacks). */
  only?: "reference" | "candidate";
  reason: string;
};
/** Names to compare tiles and modules under, by ID. */
export type DesignNames = {
  tiles?: Readonly<Record<string, string>>;
  modules?: Readonly<Record<string, string>>;
};
export type DesignDiffOptions = {
  /** The executing registry's support, for the resolved generation. */
  installed?: GenerationInstalledSupport;
  /** Module names compared under another name on both sides: name → name compared. */
  moduleRenames?: Readonly<Record<string, string>>;
  /** The names to compare the candidate's tiles and modules under, by ID. */
  candidateNames?: DesignNames;
};
/** Everything the diff compares, by area and then by key. */
export type DesignFacts = Map<string, Map<string, unknown>>;

const put = (facts: DesignFacts, area: string, key: string, value: unknown) => {
  const rows = facts.get(area) ?? new Map<string, unknown>();
  rows.set(key, value);
  facts.set(area, rows);
};
const defined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

/** Everything the diff compares, keyed by names. */
export function designFacts(
  design: DesignDocument,
  options: {
    installed?: GenerationInstalledSupport;
    moduleRenames?: Readonly<Record<string, string>>;
    names?: DesignNames;
  } = {},
): DesignFacts {
  const out: DesignFacts = new Map();
  const studio = design.architecture?.studio;
  const shownTile = (id: string) =>
    options.names?.tiles?.[id] ?? design.elements.find((item) => item.id === id)?.name ?? id;
  const tileCounts = new Map<string, number>();
  for (const element of design.elements)
    tileCounts.set(shownTile(element.id), (tileCounts.get(shownTile(element.id)) ?? 0) + 1);
  const tileName = (id: string) => {
    const name = shownTile(id);
    return (tileCounts.get(name) ?? 0) > 1 ? `${name} [${id}]` : name;
  };
  const linkOf = (id: string) => design.connections.find((item) => item.id === id);
  const linkName = (id: string) => {
    const link = linkOf(id);
    return link ? `${tileName(link.from.element)} → ${tileName(link.to.element)}` : id;
  };
  const shownModule = (id: string) => {
    const name =
      options.names?.modules?.[id] ??
      studio?.components?.find((item) => item.id === id)?.name ??
      id;
    return options.moduleRenames?.[name] ?? name;
  };
  const moduleCounts = new Map<string, number>();
  for (const module of studio?.components ?? [])
    moduleCounts.set(shownModule(module.id), (moduleCounts.get(shownModule(module.id)) ?? 0) + 1);
  const moduleName = (id: string) => {
    const name = shownModule(id);
    if ((moduleCounts.get(name) ?? 0) < 2) return name;
    const host = studio?.components?.find((item) => item.id === id)?.host;
    return host ? `${tileName(host)} / ${name}` : name;
  };

  put(out, "system", "name", design.architecture?.system?.name);
  put(out, "system", "description", design.architecture?.system?.description || undefined);
  for (const action of studio?.actions ?? []) put(out, "action", action.lane, action.name);
  for (const entry of studio?.entries ?? []) put(out, "entry", tileName(entry.element), entry.lane);
  for (const element of design.elements) {
    const name = tileName(element.id);
    const settings = studio?.elements.find((item) => item.element === element.id)?.settings;
    const { kind, ...rest } = (settings ?? {}) as Record<string, unknown>;
    put(out, "tile", name, kind);
    put(out, "tile description", name, element.description || undefined);
    for (const [key, value] of Object.entries(rest))
      put(out, "tile setting", `${name}.${key}`, value);
  }
  for (const link of design.connections) {
    const settings = studio?.connections.find((item) => item.connection === link.id)?.settings;
    put(out, "link", linkName(link.id), {
      kind: link.kind,
      interaction: link.planned.interaction,
      protocol: link.planned.protocol,
      security: link.planned.security,
      ...settings,
    });
    put(out, "link label", linkName(link.id), link.planned.label);
  }
  for (const module of studio?.components ?? []) {
    const name = moduleName(module.id);
    const key = `${tileName(module.host)} / ${shownModule(module.id)}`;
    const { kind, ...rest } = module.settings as Record<string, unknown>;
    put(out, "module kind", key, kind);
    if (shownModule(module.id) !== module.name) put(out, "module name", key, module.name);
    put(out, "module description", key, module.description || undefined);
    for (const [setting, value] of Object.entries(rest))
      put(out, "module setting", `${name}.${setting}`, value);
  }
  for (const link of studio?.componentConnections ?? [])
    put(
      out,
      "module link",
      `${moduleName(link.from)} → ${link.to.kind === "element" ? tileName(link.to.id) : moduleName(link.to.id)}`,
      link.to.kind === "element" && link.to.via ? linkName(link.to.via) : "in-process",
    );

  // Ownership, with each owner named by the tiles that hold its roles.
  const ownership = designOwnership(design);
  const members = (owner: string | undefined) =>
    owner === undefined
      ? undefined
      : ownership.roles
          .filter((role) => role.owner === owner)
          .map((role) => tileName(role.element))
          .sort()
          .join(" + ") || owner;
  for (const owner of ownership.owners) put(out, "owner", members(owner.id) ?? "", owner.name);
  for (const role of ownership.roles)
    put(out, "role", tileName(role.element), { kind: role.kind, owner: members(role.owner) });
  for (const resource of ownership.resources)
    put(out, "resource", tileName(resource.element), {
      kind: resource.kind,
      authority: members(resource.authority),
      ...(resource.kind === "projection" && { source: tileName(resource.source) }),
    });
  for (const grant of ownership.grants)
    put(out, "grant", `${tileName(grant.role)} → ${tileName(grant.resource)}`, {
      access: grant.access,
      ...(grant.boundary && { boundary: grant.boundary }),
    });
  for (const dependency of ownership.dependencies)
    put(out, "dependency", linkName(dependency.connection), dependency.access);

  // The resolved generation: each selection keyed by its template and tile (a stub by its module).
  const { model } = resolveGeneration(design, options.installed);
  put(out, "generation", "runtime", model?.runtime.id);
  put(out, "generation", "preset", model?.preset?.id);
  put(out, "generation", "processes", designGeneration(design)?.processes || undefined);
  const selectionKey = (item: NormalizedGenerationSelection | GenerationSelection) =>
    item.binding.kind === "module-stub" && item.target.kind === "component"
      ? `module-stub: ${moduleName(item.target.component)}`
      : `${item.template.id} in ${tileName(item.target.kind === "element" ? item.target.element : item.target.host)}`;
  const selections = model?.selections ?? [];
  const byId = (id: string) => selections.find((item) => item.id === id);
  // Binding fields that name another selection.
  const references = new Set(["upload", "lifecycle", "reader", "query"]);
  const named = (value: unknown, field?: string): unknown => {
    const target = typeof value === "string" && field && references.has(field) && byId(value);
    if (target) return selectionKey(target);
    if (typeof value !== "object" || value === null) return value;
    const record = value as Record<string, unknown>;
    if (typeof record.connection === "string" && typeof record.resource === "string")
      return { connection: linkName(record.connection), resource: tileName(record.resource) };
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [
        key,
        key === "element"
          ? tileName(String(item))
          : key === "guard"
            ? moduleName(String(item))
            : named(item, key),
      ]),
    );
  };
  for (const selection of selections) {
    const key = selectionKey(selection);
    put(out, "selection", key, {
      template: selection.template,
      host: tileName(selection.host),
      binding: named(selection.binding),
      ...(selection.identity && {
        identity: {
          element: tileName(selection.identity.element),
          guard: moduleName(selection.identity.guard),
          provider: selection.identity.provider,
          credential: selection.identity.credential,
        },
      }),
      policies: selection.policies,
    });
    for (const [input, value] of Object.entries(selection.inputs))
      put(out, "selection input", `${key}.${input}`, value);
    for (const resource of selection.resources)
      put(
        out,
        "selection resource",
        `${key}.${resource.field}`,
        defined({
          element: tileName(resource.element),
          connection: linkName(resource.connection),
          authority: members(resource.authority),
          access: resource.access,
          declaredAccess: resource.declaredAccess,
          boundary: resource.boundary,
          channel: resource.channel,
        }),
      );
  }
  return out;
}

/** Every difference between two sets of facts, by area and key. */
export function factsDiff(reference: DesignFacts, candidate: DesignFacts): DesignDiffRow[] {
  const rows: DesignDiffRow[] = [];
  for (const area of new Set([...reference.keys(), ...candidate.keys()])) {
    const a = reference.get(area) ?? new Map();
    const b = candidate.get(area) ?? new Map();
    for (const key of [...new Set([...a.keys(), ...b.keys()])].sort())
      if (JSON.stringify(a.get(key)) !== JSON.stringify(b.get(key)))
        rows.push(
          defined({
            area,
            key,
            reference: a.get(key),
            candidate: b.get(key),
          }) as unknown as DesignDiffRow,
        );
  }
  return rows;
}

/** Every difference between a reference design and a candidate, by area and name. */
export function designDiff(
  reference: DesignDocument,
  candidate: DesignDocument,
  options: DesignDiffOptions = {},
): DesignDiffRow[] {
  const shared = { installed: options.installed, moduleRenames: options.moduleRenames };
  return factsDiff(
    designFacts(reference, shared),
    designFacts(candidate, { ...shared, names: options.candidateNames }),
  );
}

const covers = (rule: IntendedDifference, row: DesignDiffRow) =>
  rule.area === row.area &&
  (typeof rule.key === "string" ? rule.key === row.key : rule.key.test(row.key)) &&
  (rule.only === undefined ||
    (rule.only === "reference"
      ? row.candidate === undefined && row.reference !== undefined
      : row.reference === undefined && row.candidate !== undefined));

/**
 * The diff sorted against the intended differences: `unexpected` rows no rule covers (each one a
 * failure), and `unused` rules no row needed (the candidate no longer differs there).
 */
export function designDiffReport(
  rows: readonly DesignDiffRow[],
  intended: readonly IntendedDifference[],
) {
  return {
    unexpected: rows.filter((row) => !intended.some((rule) => covers(rule, row))),
    unused: intended.filter((rule) => !rows.some((row) => covers(rule, row))),
    intended: intended.map((rule) => ({ rule, rows: rows.filter((row) => covers(rule, row)) })),
  };
}
