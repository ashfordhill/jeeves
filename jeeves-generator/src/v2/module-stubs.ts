import {
  generationLocalIdentity,
  generationTemplates,
  type NormalizedGenerationSelection,
  type NormalizedStubModule,
  type StudioComponentTargetKind,
  studioComponentDefinitions,
  studioComponentTargetKind,
  studioDefinitions,
} from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter, V2Gap, V2TemplateFile } from "./registry.ts";

type Slot = NormalizedStubModule["slots"][number];
type Connection = Slot["connections"][number];
type Path = readonly (string | number)[];

const dependenciesPath = "src/modules/dependencies.ts";
const pointer = (path: Path) => `/${path.map((part) => pointerPart(String(part))).join("/")}`;

/** A stub module's two files: its scaffold and its extension (module authoring contract, §6). */
export function moduleStubPaths(host: string, module: string) {
  const directory = `src/modules/${generationLocalIdentity(host).local}`;
  const name = generationLocalIdentity(module).local;
  return { slots: `${directory}/${name}.slots.ts`, module: `${directory}/${name}.ts` };
}

/**
 * Typed stubs for every module with no complete installed template: a scaffold with one typed
 * dependency per connected slot, and an extension whose entry point throws "Not implemented".
 * Stubs import no template library and provision nothing.
 */
export function createLocalModuleStubs(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.module-stubs",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Typed module stubs; every entry point is custom work and throws until written.",
    sourcePaths,
    provides: {
      templates: [
        {
          ref: generationTemplates["module-stub"].ref,
          consumers: [
            { input: "binding", consumer: "module-stub", outputPaths: [dependenciesPath] },
          ],
        },
      ],
    },
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "module-stub");
      if (!selections.length) return { files: [] };
      const files: V2TemplateFile[] = [
        {
          path: dependenciesPath,
          content: asset(
            "jeeves-generator/templates/local-v2/assets/src/modules/dependencies.ts.template",
          ),
          ownership: "generated-scaffold",
          sourcePaths: selections.map((s) => pointer(s.sourcePath)),
        },
      ];
      const gaps: V2Gap[] = [];
      for (const selection of selections) {
        const module = selection.module;
        if (module) {
          files.push(...stubFiles(selection, module));
          gaps.push(stubGap(selection, module));
        }
      }
      return { files, gaps };
    },
  };
}

const reserved = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(
    " ",
  ),
);
/** A canonical slug as a camelCase identifier: `view-counts` → `viewCounts`. */
const camel = (slug: string) =>
  slug.replace(/-([a-z0-9])/g, (_match, next: string) => next.toUpperCase());
/** One comment line: names are the user's own text. */
const line = (text: string) => text.replace(/[\p{Cc}\u2028\u2029]/gu, " ");
const article = (text: string) => (/^[AEIOU]/i.test(text) ? `an ${text}` : `a ${text}`);
const kindName = (kind: keyof typeof studioComponentDefinitions) =>
  studioComponentDefinitions[kind].name;
const targetNames: Record<StudioComponentTargetKind, string> = {
  application: "Application",
  identity: "Identity",
  database: "Database",
  cache: "Cache",
  queue: "Queue",
  search: "Search index",
  "object-store": "Object storage",
  cdn: "CDN",
  "external-api": "External API",
};
const useWords: Record<string, string> = {
  "read-write": "read & write",
  "in-process": "in-process",
};
const words = (use: string) => useWords[use] ?? use;
const list = (items: readonly string[]) =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;

/** How a link uses its target: the slot's use, narrowed by the link's own read or channel. */
function linkUse(slot: Slot, connection: Connection): string {
  const target = connection.target;
  if (target.kind === "component") return "in-process";
  const kind = studioComponentTargetKind(target.tile);
  if (kind === "queue")
    return slot.use === "publish" || slot.use === "consume"
      ? slot.use
      : (target.channel ?? "publish");
  const store =
    kind === "database" || kind === "cache" || kind === "search" || kind === "object-store";
  if (store && (slot.use === "read-write" || slot.use === "uses"))
    return target.access === "write" ? "read-write" : "read";
  if (slot.use === "uses") return "request";
  return slot.use;
}

/** The minimal interface in `dependencies.ts` for a link of this use to this kind of target. */
function dependencyType(slot: Slot, connection: Connection): string {
  const target = connection.target;
  if (target.kind === "component") return "ModuleCall";
  const use = linkUse(slot, connection);
  switch (studioComponentTargetKind(target.tile)) {
    case "database":
      return use === "read" ? "DatabaseReader" : "DatabaseReadWriter";
    case "object-store":
      return use === "read" ? "ObjectReader" : use === "write" ? "ObjectWriter" : "ObjectStore";
    case "search":
      return use === "read" ? "SearchReader" : use === "write" ? "SearchWriter" : "SearchIndex";
    case "cache":
      return "CacheClient";
    case "queue":
      return use === "consume" ? "QueueConsumer" : "QueuePublisher";
    case "identity":
    case "external-api":
      return use === "verify" ? "TokenVerifier" : "HttpTarget";
    default:
      return "HttpTarget";
  }
}

function stubFiles(selection: NormalizedGenerationSelection, module: NormalizedStubModule) {
  const paths = moduleStubPaths(selection.host, module.component);
  const file = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  const kind = kindName(module.kind);
  const name = line(module.name);
  /** "View count reader, a Data access", or just "Data access" when it has its kind's name. */
  const named = name === kind ? name : `${name}, ${article(kind)}`;
  const description = module.description ?? studioComponentDefinitions[module.kind].description;
  const selectionPath = pointer(selection.sourcePath);
  const modulePath = pointer(module.sourcePath);
  const used = new Set<string>();
  const types = new Set<string>();
  const members: string[] = [];
  const descriptors: string[] = [];
  for (const slot of module.slots) {
    if (!slot.connections.length) {
      const targets = slot.module
        ? `${kindName(slot.module)} in this tile`
        : slot.use === "uses"
          ? "any tile"
          : list(slot.targets.map((target) => targetNames[target]));
      const need = slot.need === "optional" ? ", optional" : "";
      members.push(`  // ${slot.id}: not connected (${targets}, ${words(slot.use)}${need})`);
      continue;
    }
    for (const connection of slot.connections) {
      const target = connection.target;
      const id = target.kind === "component" ? target.component : target.element;
      let property = camel(id);
      if (used.has(property)) property = `${property}${camel(`-${slot.id}`)}`;
      for (let n = 2; used.has(property); n += 1) property = `${camel(id)}${n}`;
      used.add(property);
      const type = dependencyType(slot, connection);
      types.add(type);
      const use = linkUse(slot, connection);
      const what =
        target.kind === "component"
          ? `${target.name} (${kindName(target.module)} in this tile)`
          : `${target.name} (${studioDefinitions[target.tile].name}) through ${target.connection}`;
      members.push(`  // ${slot.id}: ${what}, ${words(use)}`, `  ${property}: ${type};`);
      descriptors.push(
        `  ${JSON.stringify(
          target.kind === "component"
            ? {
                slot: slot.id,
                property,
                module: target.component,
                kind: target.module,
                link: connection.link,
              }
            : {
                slot: slot.id,
                property,
                tile: target.element,
                kind: target.tile,
                connection: target.connection,
                link: connection.link,
                use,
                ...(target.access && { access: target.access }),
              },
        )},`,
      );
    }
  }
  const imports = [...types].sort();
  const scaffold = [
    `// Generated scaffold: ${named} in ${line(module.hostName)}.`,
    `// Export rewrites this file; write the module in ${file(paths.module)}.`,
    ...(imports.length ? [`import type { ${imports.join(", ")} } from "../dependencies.ts";`] : []),
    "",
    "/** What the module uses: one property per connected slot. */",
    `export type Dependencies = {`,
    ...members,
    "};",
    "",
    "/** Each connected slot: the tile or module it uses, through which link, and how. */",
    descriptors.length
      ? `export const slots = [\n${descriptors.join("\n")}\n] as const;`
      : "export const slots = [] as const;",
    "",
  ].join("\n");
  const entry = camel(module.component);
  const extension = [
    `// ${named} in ${line(module.hostName)}: ${line(description)}`,
    "// Write the module here. Export never overwrites your edits: export afresh and carry them over.",
    `import type { Dependencies } from "./${file(paths.slots)}";`,
    "",
    `export async function ${reserved.has(entry) ? `${entry}Module` : entry}(dependencies: Dependencies): Promise<void> {`,
    `  throw new Error(${JSON.stringify(`Not implemented: ${module.name}`)});`,
    "}",
    "",
  ].join("\n");
  const linkPaths = module.slots.flatMap((slot) =>
    slot.connections.map((c) => pointer(c.sourcePath)),
  );
  return [
    {
      path: paths.slots,
      content: scaffold,
      ownership: "generated-scaffold" as const,
      sourcePaths: [selectionPath, modulePath, ...linkPaths],
    },
    {
      path: paths.module,
      content: extension,
      ownership: "generated-extension" as const,
      sourcePaths: [selectionPath, modulePath],
    },
  ];
}

function stubGap(selection: NormalizedGenerationSelection, module: NormalizedStubModule): V2Gap {
  return {
    id: `module-${module.component}`,
    status: "custom",
    required: true,
    description: `Write ${line(module.name)} in ${moduleStubPaths(selection.host, module.component).module}; its stub throws "Not implemented".`,
    sourcePaths: [pointer(selection.sourcePath), pointer(module.sourcePath)],
  };
}
