/**
 * A structural diff of a YouTube v2 rebuild against the frozen v2 (module authoring plan, MA09),
 * by tile, link and module name, so IDs never matter. It compares the system, actions and entries,
 * tile kinds and settings, links (endpoints, kind, interaction, protocol, security, channel use),
 * module kinds per tile and module links, the resolved generation (templates, bindings, inputs and
 * resources) and ownership (owners compared by their members). Every difference is a row; the
 * contract's intended ones are listed below, each with its reason, and any other is unexpected.
 */
import type { DesignDocument } from "../design.ts";
import type { GenerationSelection } from "../generation.ts";
import { type NormalizedGenerationSelection, resolveGeneration } from "../generation-resolver.ts";
import type { GenerationInstalledSupport } from "../generation-support.ts";
import { designOwnership } from "../ownership.ts";

export type V2DiffRow = { area: string; key: string; frozen?: unknown; rebuilt?: unknown };
export type V2IntendedDifference = {
  area: string;
  /** The rows' keys it covers: exact, or every key the pattern matches. */
  key: string | RegExp;
  /** It covers only rows with a value on this side alone (a value the other side lacks). */
  only?: "frozen" | "rebuilt";
  reason: string;
};

/** The plan's names for v2's modules where they differ (Owner decision 7): frozen → rebuild. */
export const v2ModuleRenames: Readonly<Record<string, string>> = {
  "Details cache": "Video details cache",
  "Details reader": "Video details reader",
  "Publication outbox publisher": "Video publication publisher",
  "Publication consumer": "Video publication consumer",
};

const any = /.*/;
/** The contract's intended differences (module authoring contract, section 3, and question 2). */
export const v2IntendedDifferences: readonly V2IntendedDifference[] = [
  {
    area: "system",
    key: "description",
    only: "frozen",
    reason: "Descriptions: the rebuild types none for the system.",
  },
  {
    area: "tile description",
    key: any,
    only: "frozen",
    reason: "Descriptions: the plan rewrites module text only; new tiles have none.",
  },
  {
    area: "link label",
    key: any,
    reason: "Descriptions: a new link takes its pair's default label.",
  },
  { area: "module name", key: any, reason: "Names: the plan's naming rule (Owner decision 7)." },
  {
    area: "module description",
    key: any,
    reason: "Descriptions: the plan's table (Owner decision 8).",
  },
  {
    area: "module kind",
    key: /^(View counter \/ Receipt and increment|Search API \/ Video search|Upload API \/ Multipart uploads|Transcoder \/ (Segmenter and encoder|Packager|Thumbnailer)|Video lifecycle worker \/ Lifecycle writer|Search indexer \/ Index writer)$/,
    reason:
      "Contract section 3: the kind changes in bold (each template's lead, the packager and thumbnailer).",
  },
  {
    area: "link",
    key: "Upload API → Identity",
    only: "rebuilt",
    reason: "Contract question 2: the Creator check's connection is drawn.",
  },
  {
    area: "module link",
    key: "Creator check → Identity",
    only: "rebuilt",
    reason: "Contract question 2: the Creator check's connection is drawn.",
  },
  {
    area: "module link",
    key: "Video details cache → Video details reader",
    only: "rebuilt",
    reason: "Contract section 4: the Cache reader's loader, the one drawn in-process link.",
  },
  {
    area: "tile setting",
    key: /\.(minReplicas|maxReplicas|readReplicas|eviction|topology)$/,
    only: "frozen",
    reason: "Contract section 3: fixed values v2 declares and new tiles leave to the descriptor.",
  },
  {
    area: "tile setting",
    key: /^Local video edge\.(provider|origin|imageResizing)$/,
    reason: "Contract section 3: CDN settings no template reads.",
  },
  {
    area: "module setting",
    key: /^View count reader\.(poolSize|statementTimeoutMs)$/,
    only: "frozen",
    reason: "A stub shows no settings (contract section 2): View count reader is one.",
  },
  {
    area: "module setting",
    key: /\.(l2TtlSeconds|batchSize|lingerMs|concurrency|retryLimit)$/,
    only: "frozen",
    reason:
      "Contract section 3: module mirror and fixed values no form shows; the resolved inputs agree (the cache's TTL and the Worker's concurrency are the tiles').",
  },
  {
    area: "module setting",
    key: "Lifecycle writer.readRouting",
    only: "frozen",
    reason: "Contract section 3: a Lifecycle writer has no read routing.",
  },
  ...["selection", "selection input", "selection resource"].map(
    (area): V2IntendedDifference => ({
      area,
      key: /^youtube-(upload|watch|search) in /,
      only: "frozen",
      reason: "Contract section 3: the youtube-* product templates are not offered.",
    }),
  ),
  {
    area: "selection",
    key: /^module-stub: (View count reader|View publisher)$/,
    only: "rebuilt",
    reason: "Contract section 3: the two stubs youtube-watch's modules become.",
  },
  ...["selection", "selection input"].map(
    (area): V2IntendedDifference => ({
      area,
      key: /^verified-identity in Upload API($|\.)/,
      only: "rebuilt",
      reason:
        "v3 contract section 2 and question 4 (V3-06): the Creator check leads its own sign-in template.",
    }),
  ),
  {
    area: "module setting",
    key: "Creator check.signIn",
    only: "rebuilt",
    reason:
      "v3 contract section 2 (V3-06): the sign-in template writes its initial Sign-in, Required.",
  },
  {
    area: "selection input",
    key: /\.(host\.minReplicas|host\.maxReplicas|cache\.eviction|cache\.topology|source\.readReplicas|state\.readReplicas|state\.readRouting)$/,
    only: "frozen",
    reason:
      "Contract section 3: fixed values v2 declares, left to the descriptor (MA08's equivalence test).",
  },
  { area: "generation", key: "preset", only: "frozen", reason: "Contract section 3: no preset." },
  {
    area: "owner",
    key: any,
    reason: "Contract section 5: owner IDs and names are derived; members match.",
  },
  {
    area: "grant",
    key: "Watch API → View counts",
    only: "frozen",
    reason: "Contract section 3: the read grant only youtube-watch needed goes.",
  },
  {
    area: "dependency",
    key: "Watch API → View counts",
    only: "frozen",
    reason: "Contract section 3: the dependency only youtube-watch needed goes.",
  },
];

type Facts = Map<string, unknown>;
const put = (facts: Map<string, Facts>, area: string, key: string, value: unknown) => {
  const rows = facts.get(area) ?? new Map<string, unknown>();
  rows.set(key, value);
  facts.set(area, rows);
};
const defined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

/** Everything the diff compares, keyed by names. */
function facts(design: DesignDocument, installed?: GenerationInstalledSupport) {
  const out = new Map<string, Facts>();
  const studio = design.architecture?.studio;
  const tileName = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;
  const linkOf = (id: string) => design.connections.find((item) => item.id === id);
  const linkName = (id: string) => {
    const link = linkOf(id);
    return link ? `${tileName(link.from.element)} → ${tileName(link.to.element)}` : id;
  };
  const moduleName = (id: string) => {
    const name = studio?.components?.find((item) => item.id === id)?.name ?? id;
    return v2ModuleRenames[name] ?? name;
  };

  put(out, "system", "name", design.architecture?.system?.name);
  put(out, "system", "description", design.architecture?.system?.description || undefined);
  for (const action of studio?.actions ?? []) put(out, "action", action.lane, action.name);
  for (const entry of studio?.entries ?? []) put(out, "entry", tileName(entry.element), entry.lane);
  for (const element of design.elements) {
    const settings = studio?.elements.find((item) => item.element === element.id)?.settings;
    const { kind, ...rest } = (settings ?? {}) as Record<string, unknown>;
    put(out, "tile", element.name, kind);
    put(out, "tile description", element.name, element.description || undefined);
    for (const [key, value] of Object.entries(rest))
      put(out, "tile setting", `${element.name}.${key}`, value);
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
    const key = `${tileName(module.host)} / ${name}`;
    const { kind, ...rest } = module.settings as Record<string, unknown>;
    put(out, "module kind", key, kind);
    if (name !== module.name) put(out, "module name", key, module.name);
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
  const { model } = resolveGeneration(design, installed);
  put(out, "generation", "runtime", model?.runtime.id);
  put(out, "generation", "preset", model?.preset?.id);
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

/** Every difference between the frozen v2 and a rebuild, by area and name. */
export function v2Diff(
  frozen: DesignDocument,
  rebuilt: DesignDocument,
  installed?: GenerationInstalledSupport,
): V2DiffRow[] {
  const before = facts(frozen, installed);
  const after = facts(rebuilt, installed);
  const rows: V2DiffRow[] = [];
  for (const area of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(area) ?? new Map();
    const b = after.get(area) ?? new Map();
    for (const key of [...new Set([...a.keys(), ...b.keys()])].sort())
      if (JSON.stringify(a.get(key)) !== JSON.stringify(b.get(key)))
        rows.push(
          defined({ area, key, frozen: a.get(key), rebuilt: b.get(key) }) as unknown as V2DiffRow,
        );
  }
  return rows;
}

const covers = (rule: V2IntendedDifference, row: V2DiffRow) =>
  rule.area === row.area &&
  (typeof rule.key === "string" ? rule.key === row.key : rule.key.test(row.key)) &&
  (rule.only === undefined ||
    (rule.only === "frozen"
      ? row.rebuilt === undefined && row.frozen !== undefined
      : row.frozen === undefined && row.rebuilt !== undefined));

/**
 * The diff sorted against the intended differences: `unexpected` rows no rule covers (each one a
 * failure), and `unused` rules no row needed (the rebuild no longer differs there).
 */
export function v2DiffReport(
  rows: readonly V2DiffRow[],
  intended: readonly V2IntendedDifference[] = v2IntendedDifferences,
) {
  return {
    unexpected: rows.filter((row) => !intended.some((rule) => covers(rule, row))),
    unused: intended.filter((rule) => !rows.some((row) => covers(rule, row))),
    intended: intended.map((rule) => ({ rule, rows: rows.filter((row) => covers(rule, row)) })),
  };
}
