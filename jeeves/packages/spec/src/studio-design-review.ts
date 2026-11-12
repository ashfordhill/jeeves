/**
 * The design review chat runs after every change (V3-09, D6): what a reader of the canvas would
 * still have to fix or check, each finding naming its tile or module and a concrete fix, as
 * commands where one is possible. Pure and read-only. The checks:
 *
 * - **module-status:** a lead that is a Stub because its template still needs something, a
 *   Refused module (with the kept value that blocks it), a module no selection declares yet;
 * - **unconnected-slot:** a module's needed slot with no connection;
 * - **generation:** the resolver's findings, as Generate project would show them;
 * - the playbook's smells: **store-without-writer**, **unrelated-store** (a worker writing stores
 *   for more than one concern), **user-reaches-store**, **long-line** (a line to a far store);
 * - **line-style:** a line whose style contradicts its channel (a dashed line the link table
 *   doesn't allow, or a solid one where it must be dashed); a dashed line between applications,
 *   which the table allows, is accepted;
 * - **warning:** the design warnings, with what to do.
 *
 * Commands are checked against the design before they are offered; a fix that would be refused
 * is given in words only.
 */
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import type { Finding } from "./findings.ts";
import { designGeneration, generationHost } from "./generation.ts";
import { resolveGeneration } from "./generation-resolver.ts";
import {
  type GenerationInstalledSupport,
  generationProcessSettings,
} from "./generation-support.ts";
import { guardSignIn, hasModuleSelections } from "./module-generation.ts";
import { type ModuleStatus, moduleStatusDetails } from "./module-status.ts";
import { designOwnership } from "./ownership.ts";
import {
  type StudioComponent,
  type StudioComponentTargetKind,
  studioComponentDefinitions,
} from "./studio-components.ts";
import { newLinkId, newTileIdentity } from "./studio-lane-commands.ts";
import { LANE_ACTOR, laneActionOf, laneGraph } from "./studio-lanes.ts";
import {
  studioKindNoun,
  studioLinkRole,
  studioLinkRule,
  studioStoreAccess,
} from "./studio-links.ts";
import type { StudioKind, StudioSettings } from "./studio-model.ts";
import { moduleLinkSlot, moduleSlots, newModuleIdentity } from "./studio-modules.ts";
import {
  buildStudioCommand,
  moduleConnectOptions,
  type StudioCommand,
} from "./studio-operations.ts";
import { studioWarnings } from "./studio-warnings.ts";
import { buildSupportedAuthoringCommand } from "./supported-authoring.ts";

export const designReviewChecks = [
  "module-status",
  "unconnected-slot",
  "generation",
  "store-without-writer",
  "unrelated-store",
  "user-reaches-store",
  "long-line",
  "line-style",
  "warning",
] as const;
export type DesignReviewCheck = (typeof designReviewChecks)[number];

/** One thing left in a design: what is wrong or worth checking, where, and how to fix it. */
export type DesignReviewFinding = {
  check: DesignReviewCheck;
  /** `fix`: unfinished or wrong, fix it or say why it stays; `check`: advice to confirm. */
  severity: "fix" | "check";
  tile?: string;
  module?: string;
  link?: string;
  /** Names the tile or module, in the canvas's words. */
  message: string;
  /** A concrete fix, in words. */
  fix: string;
  /** The fix as commands (checked against the design), where one is possible. */
  commands?: StudioCommand[];
};
export type DesignReview = {
  /** Every module's status, with why when it isn't a template. */
  modules: ModuleStatus[];
  findings: DesignReviewFinding[];
};

const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: readonly string[], last = "and") =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
const storeKinds: readonly StudioKind[] = ["database", "search", "cache", "object-store"];
/** A module slot's target kind as the kind a new tile for it would be. */
const newTileKind: Partial<Record<StudioComponentTargetKind, StudioKind>> = {
  database: "database",
  cache: "cache",
  search: "search",
  "object-store": "object-store",
  identity: "identity",
  "external-api": "external-api",
  cdn: "cdn",
  application: "service",
};
const targetNoun = (kind: StudioComponentTargetKind) =>
  kind === "application" ? "a service" : studioKindNoun(kind as StudioKind);
/** How far a line may run, in columns, before it reads as part of the flows it passes. */
const LONG_LINE_COLUMNS = 3;

/**
 * The design's review. `installed` (the executing registry's support) adds the resolver's
 * generation findings and checks setting fixes as the inspector would; without it they are left
 * out.
 */
export function designReview(
  design: DesignDocument,
  installed?: GenerationInstalledSupport,
): DesignReview {
  const studio = design.architecture?.studio;
  const details = moduleStatusDetails(design);
  const modules = details.map((item) => item.status);
  if (!studio) return { modules, findings: [] };
  const graph = laneGraph(design);
  const kinds = new Map(studio.elements.map((item) => [item.element, item.settings.kind]));
  const names = new Map(design.elements.map((item) => [item.id, item.name]));
  const name = (id: string) => names.get(id) ?? id;
  const components = new Map((studio.components ?? []).map((item) => [item.id, item]));
  const moduleLevel = hasModuleSelections(design);
  const ownership = designOwnership(design);
  const findings: DesignReviewFinding[] = [];
  const add = (finding: DesignReviewFinding) => findings.push(finding);
  /** The commands, if each one builds and applies after the ones before it. */
  const workable = (commands: StudioCommand[]): StudioCommand[] | undefined => {
    let current = design;
    try {
      for (const command of commands) {
        const batch = installed
          ? buildSupportedAuthoringCommand(current, command, installed)
          : buildStudioCommand(current, command);
        const result = applyOperations(current, batch.ops);
        if (!result.ok) return undefined;
        current = result.design;
      }
      return commands.length ? commands : undefined;
    } catch {
      return undefined;
    }
  };
  const withCommands = (finding: DesignReviewFinding, commands: StudioCommand[]) => {
    const checked = workable(commands);
    return checked ? { ...finding, commands: checked } : finding;
  };
  /** Whether a module's link in a slot of this use writes its store. */
  const writes = (use: string, via: string) => {
    if (use === "write") return true;
    if (use !== "read-write" && use !== "uses") return false;
    const declared = ownership.dependencies.find((item) => item.connection === via);
    if (declared) return declared.access !== "read";
    return studioStoreAccess(design, via) === "write";
  };
  /** Each module link to a tile, with its slot's use. */
  const moduleLinks = (studio.components ?? []).flatMap((module) =>
    moduleSlots(design, module.id).flatMap((state) =>
      state.links.flatMap((link) => {
        if (!("tile" in link.target)) return [];
        const row = studio.componentConnections?.find((item) => item.id === link.id);
        const via = row?.to.kind === "element" ? row.to.via : undefined;
        return via
          ? [{ id: link.id, module, tile: link.target.tile, use: state.slot.use, via }]
          : [];
      }),
    ),
  );

  // Modules: what each still needs, and slots left unconnected.
  if (moduleLevel) {
    const unconnected = new Set<string>();
    for (const module of studio.components ?? []) {
      for (const state of moduleSlots(design, module.id)) {
        if (state.slot.need !== "needed" || state.links.length) continue;
        unconnected.add(module.id);
        add(unconnectedSlot(module, state.slot.id));
      }
    }
    for (const { status, blocking } of details) {
      const module = components.get(status.module);
      if (!module) continue;
      const where = `${status.name} in ${name(status.host)}`;
      if (status.status === "refused")
        add({
          check: "module-status",
          severity: "fix",
          tile: status.host,
          module: status.module,
          message: `${where} can't generate its template: ${status.reason ?? "a saved value blocks it."}`,
          fix:
            blocking.length > 1
              ? "Change or clear the saved values it names, or remove the module with removeModule."
              : "Change or clear the saved value it names, or remove the module with removeModule.",
        });
      else if (
        status.status === "stub" &&
        status.reason?.startsWith("Needs ") &&
        !unconnected.has(status.module)
      )
        add(leadNeeds(module, status));
      else if (status.status === "custom" && status.reason?.startsWith("Not declared"))
        add({
          check: "module-status",
          severity: "check",
          tile: status.host,
          module: status.module,
          message: `${where} isn't declared for generation yet.`,
          fix: "Any module command (addModule, connectModule, disconnectModule, removeModule) declares it.",
        });
    }
  }

  // Generation: the resolver's findings, except those a Refused module already names.
  if (installed) {
    const named = new Set(details.flatMap((item) => item.blocking).map((item) => key(item)));
    const resolved = resolveGeneration(design, installed);
    for (const item of resolved.findings) {
      if (named.has(key(item))) continue;
      const path = item.target.path ?? [];
      const selection =
        path[0] === "generation" && path[1] === "selections" && typeof path[2] === "number"
          ? designGeneration(design)?.selections[path[2]]
          : undefined;
      const module =
        path[0] === "architecture" && path[2] === "components" && typeof path[3] === "number"
          ? studio.components?.[path[3]]
          : selection?.target.kind === "component"
            ? components.get(selection.target.component)
            : undefined;
      const tile =
        item.target.element ??
        module?.host ??
        (selection && generationHost(selection)) ??
        (path[0] === "architecture" && path[2] === "elements" && typeof path[3] === "number"
          ? studio.elements[path[3]]?.element
          : undefined);
      const finding: DesignReviewFinding = {
        check: "generation",
        severity: "fix",
        ...(tile && { tile }),
        ...(module && { module: module.id }),
        message: `${module ? `${module.name} in ${name(module.host)}` : tile ? name(tile) : "Generation"}: ${item.message}`,
        fix: "Change the saved value it names, or remove what it refers to; Generate project shows the same finding.",
      };
      // A process's own setting with a bad saved value (an older design): its control stays
      // shown, and clearing it runs the process's initial value (V3-18).
      const control = resolved.settings.find(
        (decision) =>
          decision.normalControl &&
          decision.process &&
          JSON.stringify(decision.sourcePaths[0]) === JSON.stringify(path),
      );
      const setting = control?.input.replace(/^process\./, "");
      const rule = Object.values(generationProcessSettings)
        .flat()
        .find((entry) => entry.setting === setting);
      const binding = studio.elements.find((entry) => entry.element === control?.process);
      if (!binding || !setting || !rule) {
        add(finding);
        continue;
      }
      const settings = { ...binding.settings } as Record<string, unknown>;
      delete settings[setting];
      add(
        withCommands(
          {
            ...finding,
            fix: `Clear it, and the process runs ${rule.initial}; or set it from ${rule.supported.integer.min} to ${rule.supported.integer.max}.`,
          },
          [{ type: "edit", element: binding.element, settings: settings as StudioSettings }],
        ),
      );
    }
  }

  // A store with no writer: the design warning, and a store only modules that read reach.
  const warned = new Set<string>();
  for (const warning of studioWarnings(design)) {
    if (warning.rule !== "store-without-writer") {
      add({
        check: "warning",
        severity: "fix",
        tile: laneActionOf(warning.node) ? undefined : warning.node,
        message: warning.message,
        fix:
          upper(warning.message.slice(warning.message.indexOf(":") + 1).trim()) || warning.message,
      });
      continue;
    }
    warned.add(warning.node);
    const into = design.connections.filter((item) => item.to.element === warning.node);
    const owner = studio.elements.find((item) => item.element === warning.node)?.owner;
    const [only] = into;
    const finding: DesignReviewFinding = {
      check: "store-without-writer",
      severity: "fix",
      tile: warning.node,
      message: warning.message,
      fix: writerHint(kinds.get(warning.node) ?? "database", name(warning.node)),
    };
    add(
      !owner && into.length === 1 && only
        ? withCommands(
            {
              ...finding,
              fix: `Make ${name(only.from.element)}, its only user, its owner and writer.`,
            },
            [
              {
                type: "edit",
                element: warning.node,
                owner: { kind: "element", id: only.from.element },
              },
            ],
          )
        : finding,
    );
  }
  if (moduleLevel)
    for (const [tile, kind] of kinds) {
      if (!storeKinds.includes(kind) || kind === "cache" || warned.has(tile)) continue;
      const links = moduleLinks.filter((item) => item.tile === tile);
      if (!links.length || links.some((item) => writes(item.use, item.via))) continue;
      const readers = [...new Set(links.map((item) => item.module.name))];
      add({
        check: "store-without-writer",
        severity: "fix",
        tile,
        message: `${name(tile)} has no writer: ${list(readers)} only read${readers.length === 1 ? "s" : ""} it.`,
        fix: writerHint(kind, name(tile)),
      });
    }

  // A worker writing stores for more than one concern.
  for (const [tile, kind] of kinds) {
    if (kind !== "worker") continue;
    const own = moduleLinks.filter((item) => item.module.host === tile);
    const written: { store: string; links: string[] }[] = [];
    const note = (store: string, link?: string) => {
      const row = written.find((item) => item.store === store);
      if (row) {
        if (link) row.links.push(link);
      } else written.push({ store, links: link ? [link] : [] });
    };
    if (own.length) {
      for (const item of own)
        if (storeKinds.includes(kinds.get(item.tile) ?? "browser") && writes(item.use, item.via))
          note(item.tile, item.id);
    } else
      for (const connection of design.connections)
        if (
          connection.from.element === tile &&
          storeKinds.includes(kinds.get(connection.to.element) ?? "browser") &&
          studioStoreAccess(design, connection.id) === "write"
        )
          note(connection.to.element);
    const [first, ...others] = written;
    if (!first || !others.length) continue;
    const extra = others.map((item) => name(item.store));
    const finding: DesignReviewFinding = {
      check: "unrelated-store",
      severity: "check",
      tile,
      message: `${name(tile)} writes ${list([name(first.store), ...extra])}: a worker that writes stores for more than one concern is hard to read and to generate.`,
      fix: `Keep ${name(tile)} writing ${name(first.store)}, its own output; publish a completion event on a topic and let a worker after it write ${list(extra)}.`,
    };
    const disconnect = others.flatMap((item) =>
      item.links.map((link): StudioCommand => ({ type: "disconnectModule", link })),
    );
    add(disconnect.length ? withCommands(finding, disconnect) : finding);
  }

  // The user (or an action) reaching a store. The lanes refuse new links while this line is
  // there, so the fix removes it, which works when another tile already reaches the store.
  for (const edge of graph.edges) {
    const kind = kinds.get(edge.target);
    const lane = laneActionOf(edge.source);
    if (!kind || !storeKinds.includes(kind) || (edge.source !== LANE_ACTOR && !lane)) continue;
    const users = design.connections
      .filter((item) => item.to.element === edge.target && kinds.has(item.from.element))
      .map((item) => item.from.element);
    const finding: DesignReviewFinding = {
      check: "user-reaches-store",
      severity: "fix",
      tile: edge.target,
      link: edge.id,
      message: `The user reaches ${name(edge.target)} directly: a service checks every request before a store.`,
      fix: users.length
        ? `Remove the action's line to ${name(edge.target)}: ${list(users.map(name))} already reach${users.length > 1 ? "" : "es"} it.`
        : `Put a service between them (the action → a service → ${name(edge.target)}). The lanes refuse new links while this line is there, so fix it in Source & diagnostics.`,
    };
    add(
      users.length && lane
        ? withCommands(finding, [{ type: "removeLink", link: edge.id }])
        : finding,
    );
  }

  // A long line to a far store: its users at the lanes' start, its last user deep in a pipeline.
  const column = columns(graph);
  for (const [tile, kind] of kinds) {
    if (!storeKinds.includes(kind)) continue;
    const users = [
      ...new Set(graph.edges.filter((edge) => edge.target === tile).map((edge) => edge.source)),
    ].filter((source) => kinds.has(source));
    const deepest = users.reduce<string | undefined>(
      (best, user) =>
        best === undefined || (column.get(user) ?? 0) > (column.get(best) ?? 0) ? user : best,
      undefined,
    );
    if (!deepest) continue;
    const far = users.filter(
      (user) => (column.get(deepest) ?? 0) - (column.get(user) ?? 0) >= LONG_LINE_COLUMNS,
    );
    if (!far.length) continue;
    add({
      check: "long-line",
      severity: "check",
      tile,
      message: `${list(far.map(name))}'s line${far.length > 1 ? "s" : ""} to ${name(tile)} cross${far.length > 1 ? "" : "es"} the board: ${name(deepest)}, at the end of a longer pipeline, uses it too.`,
      fix: `The layout keeps ${name(tile)} beside its last user, so ${far.length > 1 ? "these lines stay" : "this line stays"} long. Check that ${list(far.map(name))} belong${far.length > 1 ? "" : "s"} in ${far.length > 1 ? "their lanes" : "its lane"} and read${far.length > 1 ? "" : "s"} ${name(tile)} directly; never add a tile just to shorten a line.`,
    });
  }

  // Line styles that contradict their channel.
  for (const connection of design.connections) {
    const source = kinds.get(connection.from.element);
    const target = kinds.get(connection.to.element);
    if (!source || !target) continue;
    const rule = studioLinkRule(source, target);
    if (!rule) continue;
    const dashed = connection.planned.interaction === "Asynchronous";
    const mode = dashed ? "async" : "sync";
    if (rule.modes.includes(mode)) continue;
    const [from, to] = [name(connection.from.element), name(connection.to.element)];
    const message = dashed
      ? `The line from ${from} to ${to} is dashed (async), but a link to ${studioKindNoun(target)} is a direct call: the caller waits.`
      : `The line from ${from} to ${to} is solid, but ${studioLinkRole(target) === "queue" ? "publishing to a queue" : `a link from ${studioKindNoun(source)}`} is asynchronous: nobody waits.`;
    const style = rule.defaultMode === "async" ? "dashed" : "solid";
    const finding: DesignReviewFinding = {
      check: "line-style",
      severity: "fix",
      tile: connection.from.element,
      link: connection.id,
      message,
      fix: `Remove the line and draw it again; the link table makes it ${style}.`,
    };
    // Module links that traced the old line are connected again through the new one.
    const traced = (studio.componentConnections ?? []).flatMap((link): StudioCommand[] => {
      if (link.to.kind !== "element" || link.to.via !== connection.id) return [];
      const slot = moduleLinkSlot(design, link);
      return slot
        ? [
            {
              type: "connectModule",
              module: link.from,
              slot: slot.id,
              target: { tile: link.to.id },
            },
          ]
        : [];
    });
    const redrawn = withCommands(finding, [
      { type: "removeLink", link: connection.id },
      {
        type: "linkTiles",
        from: { tile: connection.from.element },
        to: connection.to.element,
        linkId: newLinkId(design, { tile: connection.from.element }, connection.to.element, [
          connection.id,
        ]),
      },
      ...traced,
    ]);
    // Removing a line the store hangs off would cut it off; the lanes refuse a new one first.
    add(
      redrawn.commands
        ? redrawn
        : {
            ...finding,
            fix: `Make it ${style}: removing it would cut ${to} off, and the lanes refuse new links while it is there, so fix its interaction in Source & diagnostics.`,
          },
    );
  }

  findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "fix" ? -1 : 1));
  return { modules, findings };

  function unconnectedSlot(module: StudioComponent, slot: string): DesignReviewFinding {
    const definition = studioComponentDefinitions[module.settings.kind];
    const shape = definition.slots.find((item) => item.id === slot);
    const where = `${module.name} in ${name(module.host)}`;
    const wants = shape?.module
      ? `${studioComponentDefinitions[shape.module].name} in its tile`
      : list((shape?.targets ?? []).map(targetNoun), "or");
    const base: DesignReviewFinding = {
      check: "unconnected-slot",
      severity: "fix",
      tile: module.host,
      module: module.id,
      message: `${where} has nothing in its ${slot} slot: it needs ${shape?.module ? "a " : ""}${wants}.`,
      fix: "",
    };
    const linked = (tile: string) =>
      design.connections.some(
        (item) =>
          (item.from.element === module.host && item.to.element === tile) ||
          (item.to.element === module.host && item.from.element === tile),
      );
    const options = moduleConnectOptions(design, module.id)
      .flatMap((option) => ("command" in option && option.command.slot === slot ? [option] : []))
      .sort((a, b) => {
        const score = (target: { tile: string } | { module: string }) =>
          "module" in target ? 0 : linked(target.tile) ? 1 : 2;
        return score(a.target) - score(b.target);
      });
    const label = (target: { tile: string } | { module: string }) =>
      "tile" in target ? name(target.tile) : (components.get(target.module)?.name ?? target.module);
    const [first, ...rest] = options;
    if (first)
      return {
        ...base,
        fix: `Connect it to ${label(first.target)}${
          rest.length
            ? ` (or ${list(
                rest.slice(0, 3).map((item) => label(item.target)),
                "or",
              )})`
            : ""
        }.`,
        commands: [first.command],
      };
    if (shape?.module) {
      const part = newModuleIdentity(design, module.host, shape.module);
      return withCommands({ ...base, fix: `Add ${wants} and connect it as its ${slot}.` }, [
        { type: "addModule", host: module.host, kind: shape.module, ...part },
        { type: "connectModule", module: module.id, slot: shape.id, target: { module: part.id } },
      ]);
    }
    const kind = shape?.targets.map((item) => newTileKind[item]).find(Boolean);
    if (!kind || !shape || shape.use === "consume")
      return {
        ...base,
        fix:
          shape?.use === "consume"
            ? `Link a queue to ${name(module.host)}, then connect it.`
            : `Add ${wants} and connect it.`,
      };
    const created = newTileIdentity(design, kind);
    return withCommands(
      { ...base, fix: `Add ${studioKindNoun(kind)} after ${name(module.host)} and connect it.` },
      [
        {
          type: "addTile",
          from: { tile: module.host },
          side: "after",
          tile: { ...created, kind },
          linkId: newLinkId(design, { tile: module.host }, created.id),
        },
        { type: "connectModule", module: module.id, slot: shape.id, target: { tile: created.id } },
      ],
    );
  }

  function leadNeeds(module: StudioComponent, status: ModuleStatus): DesignReviewFinding {
    const reason = status.reason ?? "";
    const base: DesignReviewFinding = {
      check: "module-status",
      severity: "fix",
      tile: status.host,
      module: status.module,
      message: `${status.name} in ${name(status.host)} is a Stub: ${reason}`,
      fix: `Add what it needs: ${reason.replace(/^Needs /, "").replace(/\.$/, "")}.`,
    };
    if (!reason.includes("Auth guard set to Required")) return base;
    const guards = (studio?.components ?? []).filter(
      (item) => item.host === module.host && item.settings.kind === "auth-guard",
    );
    const [guard] = guards;
    if (guards.length === 1 && guard) {
      const connected = moduleSlots(design, guard.id).some(
        (state) => state.slot.id === "identity" && state.links.length,
      );
      if (connected && guardSignIn(guard) === "optional")
        return withCommands(
          {
            ...base,
            fix: `Set ${guard.name}'s Sign-in to Required (an Optional guard lets anonymous callers in).`,
          },
          [
            {
              type: "editComponent",
              component: guard.id,
              settings: { ...guard.settings, signIn: "required" } as StudioComponent["settings"],
            },
          ],
        );
      return { ...base, fix: `Connect ${guard.name} to an Identity tile and keep it Required.` };
    }
    const identities = [...kinds].filter(([, kind]) => kind === "identity").map(([id]) => id);
    const [identity] = identities;
    const hint = `applyPattern {"id": "sign-in", "tile": "${name(module.host)}", "signIn": "required"}`;
    if (identities.length !== 1 || !identity)
      return { ...base, fix: `Add a Required Auth guard in ${name(module.host)}: ${hint}.` };
    const created = newModuleIdentity(design, module.host, "auth-guard", "Sign-in check");
    return withCommands(
      {
        ...base,
        fix: `Add an Auth guard in ${name(module.host)} connected to ${name(identity)}; it is Required.`,
      },
      [
        { type: "addModule", host: module.host, kind: "auth-guard", ...created },
        {
          type: "connectModule",
          module: created.id,
          slot: "identity",
          target: { tile: identity },
        },
      ],
    );
  }
}

const key = (item: Finding) =>
  JSON.stringify({ code: item.code, message: item.message, target: item.target });

/** What writes a store of this kind, in a sentence. */
function writerHint(kind: StudioKind, store: string): string {
  switch (kind) {
    case "search":
      return `Add an Index writer in a worker fed by events that writes ${store} (applyPattern search).`;
    case "object-store":
      return `Give ${store} its writer: Multipart uploads in an upload service, or a Video packager in a worker.`;
    default:
      return `Give ${store} one writer: a Data access or Lifecycle writer in the tile that owns it, or a template that writes it (applyPattern upload-pipeline or owned-store).`;
  }
}

/** Each node's column: its longest path from the user, as the layered canvas places it. */
function columns(graph: ReturnType<typeof laneGraph>): Map<string, number> {
  const column = new Map<string, number>([[LANE_ACTOR, 0]]);
  for (let pass = 0; pass < graph.nodes.length; pass += 1) {
    let changed = false;
    for (const edge of graph.edges) {
      const from = column.get(edge.source);
      if (from === undefined) continue;
      if ((column.get(edge.target) ?? -1) < from + 1) {
        column.set(edge.target, from + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return column;
}
