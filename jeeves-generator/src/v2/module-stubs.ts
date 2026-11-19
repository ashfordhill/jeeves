import {
  generationCapabilities,
  generationLocalIdentity,
  generationRetentionSettings,
  generationTemplates,
  type NormalizedGeneration,
  type NormalizedGenerationSelection,
  type NormalizedStubModule,
  type StudioComponentTargetKind,
  stubLinkUse,
  studioComponentDefinitions,
  studioComponentTargetKind,
  studioDefinitions,
} from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter, V2Gap, V2TemplateFile } from "./registry.ts";
import { receiptPolicy } from "./retention.ts";
import { isStripeWebhook } from "./stripe-webhook.ts";

type Slot = NormalizedStubModule["slots"][number];
type Connection = Slot["connections"][number];
type Path = readonly (string | number)[];

const dependenciesPath = "src/modules/dependencies.ts";
/** What a stub declares it reads, and how its process reads it (QL05, owner decision D6). */
const settingsPath = "src/runtime/settings.ts";
const pointer = (path: Path) => `/${path.map((part) => pointerPart(String(part))).join("/")}`;

/** A stub module's two files: its scaffold and its extension (module authoring contract, §6). */
export function moduleStubPaths(host: string, module: string) {
  const directory = `src/modules/${generationLocalIdentity(host).local}`;
  const name = generationLocalIdentity(module).local;
  return { slots: `${directory}/${name}.slots.ts`, module: `${directory}/${name}.ts` };
}
/** A mounted template's product hooks, with Runnable processes on (tile process contract, §3). */
export function moduleHooksPath(host: string, lead: string) {
  return `src/modules/${generationLocalIdentity(host).local}/${generationLocalIdentity(lead).local}.hooks.ts`;
}
/**
 * With Runnable processes on, a mounted template's application-bindings gap is custom work in its
 * leads' hooks files; otherwise the gap is unchanged (tile process contract, section 3).
 */
export function mountedHooksGap(
  model: NormalizedGeneration,
  selections: readonly NormalizedGenerationSelection[],
  gap: V2Gap,
  answers = "its route answers 501",
): V2Gap {
  const files = selections.map((s) =>
    s.target.kind === "component" ? moduleHooksPath(s.host, s.target.component) : undefined,
  );
  if (!model.processes || !files.length || files.some((file) => !file)) return gap;
  return {
    ...gap,
    status: "custom",
    required: true,
    description: `Write the product hooks in ${files.join(", ")}; until then each throws "Not implemented" and ${answers}.`,
  };
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
          ref: generationTemplates["webhook-receiver"].ref,
          consumers: [
            {
              input: "binding",
              consumer: "webhook-receiver",
              outputPaths: [dependenciesPath],
            },
            ...generationCapabilities["webhook-receiver"].settings.map((rule) => ({
              input: rule.input,
              consumer: rule.consumer,
              outputPaths: [dependenciesPath],
            })),
          ],
        },
        {
          ref: generationTemplates["scheduled-task"].ref,
          consumers: [
            { input: "binding", consumer: "scheduled-task", outputPaths: [dependenciesPath] },
            ...generationCapabilities["scheduled-task"].settings.map((rule) => ({
              input: rule.input,
              consumer: rule.consumer,
              outputPaths: [dependenciesPath],
            })),
            ...generationRetentionSettings["scheduled-task"].map(({ input, consumer }) => ({
              input,
              consumer,
              outputPaths: [dependenciesPath],
            })),
          ],
        },
        {
          ref: generationTemplates["module-stub"].ref,
          consumers: [
            { input: "binding", consumer: "module-stub", outputPaths: [dependenciesPath] },
            ...generationRetentionSettings["event-consumer"].map(({ input, consumer }) => ({
              input,
              consumer,
              outputPaths: [dependenciesPath],
            })),
          ],
        },
      ],
    },
    render: ({ model, settings, asset }) => {
      const selections = model.selections.filter((s) =>
        ["module-stub", "scheduled-task", "webhook-receiver"].includes(s.binding.kind),
      );
      if (!selections.length && !model.selections.some((s) => s.binding.kind === "browser-session"))
        return { files: [] };
      const receipts = selections.flatMap((selection) => {
        const policy = receiptPolicy(selection);
        return policy ? [[selection.id, policy] as const] : [];
      });
      const retentionSources = settings
        .filter((setting) => setting.canClear && setting.origin === "source")
        .flatMap((setting) => setting.sourcePaths.map(pointer));
      const files: V2TemplateFile[] = [
        {
          path: dependenciesPath,
          content:
            new TextDecoder().decode(
              asset(
                "jeeves-generator/templates/local-v2/assets/src/modules/dependencies.ts.template",
              ),
            ) +
            (selections.some((s) => s.binding.kind === "webhook-receiver")
              ? `\n/** Compiled authenticated receiver limits. */\nexport const webhookReceivers = ${JSON.stringify(Object.fromEntries(selections.filter((s) => s.binding.kind === "webhook-receiver").map((s) => [s.id, { ...(isStripeWebhook(s) && { signatureFormat: "stripe" }), bodyLimitBytes: Number(s.inputs["webhook.bodyLimitBytes"]), replayWindowSeconds: Number(s.inputs["webhook.replayWindowSeconds"]) }])))} as const;\n`
              : "") +
            (selections.some((s) => s.binding.kind === "scheduled-task")
              ? `\n/** Compiled intervals; protected work retry and fence policy stays private. */\nexport const scheduledTasks = ${JSON.stringify(Object.fromEntries(selections.filter((s) => s.binding.kind === "scheduled-task").map((s) => [s.id, { intervalSeconds: s.inputs["task.intervalSeconds"], keepDailyTotalsMonths: s.inputs["task.keepDailyTotalsMonths"] }])))} as const;\n`
              : "") +
            (receipts.length
              ? `\n/** Compiled replay windows and receipt lifetimes for checked event consumers. */\nexport const receiptConsumers = ${JSON.stringify(Object.fromEntries(receipts))} as const;\n`
              : ""),
          ownership: "generated-scaffold",
          sourcePaths: [...selections.map((s) => pointer(s.sourcePath)), ...retentionSources],
        },
        {
          path: settingsPath,
          content: asset(
            "jeeves-generator/templates/local-v2/assets/src/runtime/settings.ts.template",
          ),
          ownership: "generated-scaffold",
          sourcePaths: selections.map((s) => pointer(s.sourcePath)),
        },
      ];
      files.push({
        path: "src/runtime/keys.ts",
        content: asset("jeeves-generator/templates/local-v2/assets/src/runtime/keys.ts.template"),
        ownership: "generated-scaffold",
        sourcePaths: selections.map((s) => pointer(s.sourcePath)),
      });
      const gaps: V2Gap[] = [];
      // With Runnable processes on, a route stub takes the request its tile's process routes to it
      // and a loop stub each message its loops consume (`src/modules/entry.ts`, written by the
      // processes owner). Library stubs, and every stub with the option off, keep their files.
      const roles = new Map(
        (model.processes ?? []).flatMap((process) =>
          process.stubs.flatMap((stub) =>
            stub.role === "library" ? [] : [[stub.module, stub.role] as const],
          ),
        ),
      );
      for (const selection of selections) {
        const module = selection.module;
        if (module) {
          files.push(
            ...stubFiles(
              selection,
              module,
              roles.get(module.component),
              model.processes?.find((process) => process.tile === selection.host)?.serviceCalls ??
                [],
            ),
          );
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
const linkUse = (slot: Slot, connection: Connection) => stubLinkUse(slot.use, connection.target);

/** The minimal interface in `dependencies.ts` for a link of this use to this kind of target. */
function dependencyType(slot: Slot, connection: Connection): string {
  const target = connection.target;
  if (target.kind === "component")
    return slot.callables
      ? target.module === "cache-reader"
        ? "CacheReaderCapability"
        : target.module === "rate-limiter"
          ? "RateLimiterCapability"
          : "FavoritesCapability"
      : "ModuleCall";
  const use = linkUse(slot, connection);
  switch (studioComponentTargetKind(target.tile)) {
    case "application":
      return "ServiceTarget";
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

/** A stub's entry point: its module ID in camelCase, never a reserved word. */
export function moduleEntryName(module: string) {
  const entry = camel(generationLocalIdentity(module).local);
  return reserved.has(entry) ? `${entry}Module` : entry;
}

/**
 * Each connected slot's property in a stub's `Dependencies`, in slot order: named after the tile
 * or module it uses (then its slot, then a number), typed by the link's use; never `settings`,
 * the module's own settings (QL05). A loop stub's consumed queue is its input, not a dependency
 * (tile process contract, section 4).
 */
export function stubProperties(module: NormalizedStubModule, loop: boolean) {
  const used = new Set<string>(["settings"]);
  return module.slots
    .filter((slot) => slot.id !== "workload")
    .flatMap((slot) =>
      slot.connections.map((connection) => {
        const target = connection.target;
        const id = target.kind === "component" ? target.component : target.element;
        let property = camel(id);
        if (used.has(property)) property = `${property}${camel(`-${slot.id}`)}`;
        for (let n = 2; used.has(property); n += 1) property = `${camel(id)}${n}`;
        used.add(property);
        return {
          slot,
          connection,
          property,
          type: dependencyType(slot, connection),
          use: linkUse(slot, connection),
          input: loop && target.kind === "element" && target.channel === "consume",
        };
      }),
    );
}

function stubFiles(
  selection: NormalizedGenerationSelection,
  module: NormalizedStubModule,
  role: "route" | "loop" | "scheduled-task" | "webhook-receiver" | undefined,
  serviceCalls: readonly {
    module: string;
    target: string;
    operations: readonly string[];
  }[],
) {
  const scheduled = selection.binding.kind === "scheduled-task";
  const calendar = selection.inputs["task.keepDailyTotalsMonths"] !== undefined;
  const checked = receiptPolicy(selection) !== undefined;
  const webhook = selection.binding.kind === "webhook-receiver";
  const route = role === "route";
  const loop = role === "loop";
  const paths = moduleStubPaths(selection.host, module.component);
  const file = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  const kind = kindName(module.kind);
  const name = line(module.name);
  /** "View count reader, a Data access", or just "Data access" when it has its kind's name. */
  const named = name === kind ? name : `${name}, ${article(kind)}`;
  const description = module.description ?? studioComponentDefinitions[module.kind].description;
  const selectionPath = pointer(selection.sourcePath);
  const modulePath = pointer(module.sourcePath);
  const properties = stubProperties(module, loop);
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
    for (const { connection, property, type, use, input } of properties.filter(
      (item) => item.slot === slot,
    )) {
      const target = connection.target;
      const what =
        target.kind === "component"
          ? `${target.name} (${kindName(target.module)} in this tile)`
          : `${target.name} (${studioDefinitions[target.tile].name}) through ${target.connection}`;
      if (!input) types.add(type);
      members.push(
        `  // ${slot.id}: ${what}, ${words(use)}`,
        input
          ? `  // ${property}: its loop delivers each message to the entry point.`
          : `  ${property}: ${type}${
              type === "ServiceTarget" &&
              target.kind === "element" &&
              serviceCalls.some(
                (call) => call.module === module.component && call.target === target.element,
              )
                ? `<${
                    serviceCalls
                      .find(
                        (call) =>
                          call.module === module.component && call.target === target.element,
                      )
                      ?.operations.map((id) => JSON.stringify(id))
                      .join(" | ") || "never"
                  }>`
                : ""
            };`,
      );
      descriptors.push(
        `  ${JSON.stringify(
          target.kind === "component"
            ? {
                slot: slot.id,
                property,
                module: target.component,
                kind: target.module,
                link: connection.link,
                ...(slot.callables && {
                  operations: slot.callables.map((contract) => ({
                    target: `${target.component}.${contract.id}@${contract.version}`,
                    contract,
                  })),
                }),
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
    'import type { SettingsOf } from "../../extension-api/index.ts";',
    ...(imports.length
      ? [`import type { ${imports.join(", ")} } from "../../extension-api/index.ts";`]
      : []),
    "",
    "/** What the module uses: one property per connected slot, and its own settings. */",
    `export type Dependencies = {`,
    ...members,
    `  // settings: the values ${file(paths.module)}'s \`settings\` export declares.`,
    `  settings: SettingsOf<typeof import(${JSON.stringify(`./${file(paths.module)}`)})>;`,
    "};",
    "",
    "/** Each connected slot: the tile or module it uses, through which link, and how. */",
    descriptors.length
      ? `export const slots = [\n${descriptors.join("\n")}\n] as const;`
      : "export const slots = [] as const;",
    "",
  ].join("\n");
  const entry = moduleEntryName(module.component);
  const extension = webhook
    ? [
        "// @jeeves-extension: operation",
        `// ${named}: scoped durable webhook processing.`,
        'import { defineWebhookWork, declareSettings } from "../../extension-api/index.ts";',
        `import type { Dependencies } from "./${file(paths.slots)}";`,
        "export const settings = declareSettings({});",
        "export const durableWork = defineWebhookWork<Dependencies>({",
        `  database: ${JSON.stringify(properties.find((p) => p.slot.id === "state")?.property)},`,
        `  id: ${JSON.stringify(module.component)}, version: 1, integration: null,`,
        "  async complete(event, commands, caller, remote) {",
        '    throw new Error("Not implemented: process authenticated webhook event");',
        "  },",
        "});",
        "",
      ].join("\n")
    : scheduled
      ? [
          `// ${named} in ${line(module.hostName)}: durable scheduled reconciliation.`,
          'import { defineDurableWork, declareSettings } from "../../extension-api/index.ts";',
          `import type { Dependencies } from "./${file(paths.slots)}";`,
          "export const settings = declareSettings({});",
          calendar
            ? "type Tick = { tick: string; intervalSeconds: number; cutoffDay?: string; keepDailyTotalsMonths?: number };"
            : "type Tick = { tick: string; intervalSeconds: number };",
          "/** Keep id/version stable while work is unfinished. Interval is compiled separately. */",
          "export const durableWork = defineDurableWork<Tick, Dependencies>({",
          `  database: ${JSON.stringify(properties.find((p) => p.slot.id === "state")?.property)},`,
          `  id: ${JSON.stringify(module.component)}, version: 1,`,
          "  retentionSeconds: 604800, maxAttempts: 4, integration: null,",
          "  validate(input) {",
          "    const tick = input as Tick;",
          '    if (!tick || typeof tick.tick !== "string" || !/^[0-9]+$/.test(tick.tick) || !Number.isInteger(tick.intervalSeconds) || tick.intervalSeconds < 1 || tick.intervalSeconds > 604800) throw new Error("Invalid tick");',
          ...(calendar
            ? [
                '    if (tick.cutoffDay !== undefined && (!/^\\d{4}-\\d{2}-\\d{2}$/.test(tick.cutoffDay) || !Number.isInteger(tick.keepDailyTotalsMonths))) throw new Error("Invalid calendar cutoff");',
                "    return { tick: tick.tick, intervalSeconds: tick.intervalSeconds, ...(tick.cutoffDay !== undefined && { cutoffDay: tick.cutoffDay, keepDailyTotalsMonths: tick.keepDailyTotalsMonths }) };",
              ]
            : ["    return { tick: tick.tick, intervalSeconds: tick.intervalSeconds };"]),
          "  },",
          "/** Reconcile current product state with registered commands. This transaction may run again; no network, SQL, lease or timer handles. */",
          "  async complete(tick, commands, caller, remote) {",
          `    throw new Error(${JSON.stringify(`Not implemented: ${module.name}`)});`,
          "  },",
          "});",
          "",
        ].join("\n")
      : checked
        ? [
            "// @jeeves-extension: operation",
            `// ${named}: record each event ID and its product effect atomically.`,
            'import { declareSettings, defineReceiptConsumer } from "../../extension-api/index.ts";',
            'import type { ModuleMessage } from "../../extension-api/index.ts";',
            `import type { Dependencies } from "./${file(paths.slots)}";`,
            "export const settings = declareSettings({});",
            "export const receiptConsumer = defineReceiptConsumer<Dependencies>({",
            `  database: ${JSON.stringify(properties.find((p) => p.slot.id === "state")?.property)},`,
            "  map(input, messageId, policy) {",
            '    throw new Error("Not implemented: validate and map the event");',
            "  },",
            "  async complete(event, commands) {",
            '    throw new Error("Not implemented: record the event with registered commands");',
            "  },",
            "});",
            `export async function ${entry}(dependencies: Dependencies, message: ModuleMessage): Promise<void> {`,
            '  throw new Error("Not implemented: record the event using the receipt declaration");',
            "}",
            "",
          ].join("\n")
        : [
            `// ${named} in ${line(module.hostName)}: ${line(description)}`,
            "// Write the module here. Export never overwrites your edits: export afresh and carry them over.",
            ...(route
              ? [
                  'import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";',
                ]
              : []),
            ...(loop ? ['import type { ModuleMessage } from "../../extension-api/index.ts";'] : []),
            `import type { Dependencies } from "./${file(paths.slots)}";`,
            'import { declareSettings } from "../../extension-api/index.ts";',
            "",
            "/** The settings this module reads: text(), integer(), url(), signingKeys(purpose) or sealingKeys(purpose);",
            " * optional(kind) for an optional one. Signing/sealing handles keep private ring files internal;",
            " * bind every value to trusted scope and context. Protected credentials stay generated. */",
            "export const settings = declareSettings({});",
            "",
            ...(route
              ? [
                  `/** Answers any method on /modules/${generationLocalIdentity(module.component).local} and every path below it. */`,
                  `export async function ${entry}(dependencies: Dependencies, request: ModuleRequest): Promise<ModuleResponse> {`,
                ]
              : loop
                ? [
                    '/** Handles each message from the queues it consumes. "Not implemented" sends the message to its queue\'s .failed; any other error is retried. */',
                    `export async function ${entry}(dependencies: Dependencies, message: ModuleMessage): Promise<void> {`,
                  ]
                : [`export async function ${entry}(dependencies: Dependencies): Promise<void> {`]),
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
    ...(webhook
      ? [
          {
            path: paths.module.replace(/\.ts$/, ".mapping.hooks.ts"),
            content: [
              "// @jeeves-extension: policy",
              'import type { WebhookEvent } from "../../extension-api/index.ts";',
              "/** Pure mapping of authenticated bounded JSON. Validate product payload and stable id/type. */",
              "export function mapEvent(input: unknown): WebhookEvent {",
              '  throw new Error("Not implemented: map authenticated webhook event");',
              "}",
              "",
            ].join("\n"),
            ownership: "generated-extension" as const,
            sourcePaths: [selectionPath, modulePath],
          },
        ]
      : []),
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
