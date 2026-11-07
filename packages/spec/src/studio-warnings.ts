/**
 * Design warnings: designs that look wrong but are allowed. A design is built step by step, so a
 * queue with no consumer yet or a new action with no entries must be accepted while it is being
 * built. Warnings are `DESIGN_WARNING` findings (category `warning`): `applyOperations`, the lane
 * commands and their "Fix the lanes first." gate never look at them, and they never refuse an
 * edit. The canvas, the blueprint and chat report them from here.
 */
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { laneActionNode, laneGraph } from "./studio-lanes.ts";
import { studioLinkRole, studioStoreAccess } from "./studio-links.ts";
import { studioActions } from "./studio-model.ts";

export const studioWarningRules = [
  "store-without-writer",
  "output-unread",
  "queue-without-publisher",
  "queue-without-consumer",
  "action-without-entries",
  "uploads-without-storage",
  "worker-without-output",
] as const;
export type StudioWarningRule = (typeof studioWarningRules)[number];

/** Each warning in a few words, for the chat instructions and the docs. */
export const studioWarningSummaries: Record<StudioWarningRule, string> = {
  "store-without-writer": "a store with no writer (no owner, or its owner doesn't link to it)",
  "output-unread": "a store only its worker owner links to (output nobody reads)",
  "queue-without-publisher": "a queue nobody publishes to",
  "queue-without-consumer": "a queue nobody consumes",
  "action-without-entries": "an action with no entries",
  "uploads-without-storage": "an Uploads tile with no storage relationship",
  "worker-without-output": "a worker with no outgoing relationship",
};

/** The chat instructions' sentence on warnings, generated from the list above. */
export const studioWarningSentence = `Warnings are designs that look wrong but are allowed while a design is being built: ${studioWarningRules.map((rule) => studioWarningSummaries[rule]).join("; ")}. They never block a command; before you finish, resolve the warnings your edits caused, or say why one stays.`;

/**
 * A warning about one tile or action. `node` is its lane-graph key (an element ID, or an action's
 * `laneActionNode`), so the canvas can mark it; `message` names the tiles and says what to do.
 */
export type StudioWarning = { rule: StudioWarningRule; node: string; message: string };

/**
 * The design's warnings, in lane-graph order:
 * - a store (database, search index, cache, storage) with no writer: it has no owner, or no link
 *   into it comes from its owner (`studioStoreAccess`);
 * - a store whose only links come from its owner, when that owner is a worker: the worker's
 *   output nobody reads (a cache used only by its owner is normal);
 * - a queue with no publisher (no link into it) or no consumer (no link out of it);
 * - an action with no entries.
 */
export function studioWarnings(design: DesignDocument): StudioWarning[] {
  const studio = design.architecture?.studio;
  if (!studio) return [];
  const graph = laneGraph(design);
  const bindings = new Map(studio.elements.map((item) => [item.element, item]));
  const names = new Map(design.elements.map((item) => [item.id, item.name]));
  const name = (id: string) => names.get(id) ?? id;
  const out: StudioWarning[] = [];
  const warn = (rule: StudioWarningRule, node: string, message: string) =>
    out.push({ rule, node, message });

  for (const action of studioActions(studio)) {
    const node = laneActionNode(action.lane);
    if (!graph.edges.some((edge) => edge.source === node))
      warn(
        "action-without-entries",
        node,
        `${action.name} has no entries: nothing handles it yet. Add the service or API that handles it after it, or remove the action.`,
      );
  }

  for (const node of graph.nodes) {
    const binding = bindings.get(node.id);
    if (!binding) continue;
    const kind = binding.settings.kind;
    const store = name(node.id);
    if (kind === "queue") {
      if (!design.connections.some((item) => item.to.element === node.id))
        warn(
          "queue-without-publisher",
          node.id,
          `${store} has no publisher: nothing sends it messages. Link the service that publishes them to it.`,
        );
      if (!design.connections.some((item) => item.from.element === node.id))
        warn(
          "queue-without-consumer",
          node.id,
          `${store} has no consumer: nothing takes its messages. Add a worker after it.`,
        );
      continue;
    }
    const outgoing = design.connections.filter((item) => item.from.element === node.id);
    if (
      kind === "uploads" &&
      !outgoing.some((item) => bindings.get(item.to.element)?.settings.kind === "object-store")
    )
      warn(
        "uploads-without-storage",
        node.id,
        `${store} has no storage relationship: link the durable storage used for uploads. A transfer setting alone does not specify storage.`,
      );
    if (kind === "worker" && !outgoing.length)
      warn(
        "worker-without-output",
        node.id,
        `${store} has no outgoing relationship: no output, publication or downstream call is represented. Add the intended relationship or explain this scope; side effects cannot be inferred from its name or modules.`,
      );
    if (studioLinkRole(kind) !== "store") continue;
    const owner = binding.owner;
    const ownerName =
      owner?.kind === "package"
        ? (studio.packages.find((item) => item.id === owner.id)?.name ?? owner.id)
        : owner && name(owner.id);
    const into = design.connections.filter((item) => item.to.element === node.id);
    if (!into.some((item) => studioStoreAccess(design, item.id) === "write")) {
      warn(
        "store-without-writer",
        node.id,
        !owner
          ? `${store} has no writer: it has no owner. Choose its owner, the tile that writes it.`
          : owner.kind === "package"
            ? `${store} has no writer: no tile in its owner ${ownerName} links to it. Link one of them to it, or choose another owner.`
            : `${store} has no writer: its owner ${ownerName} doesn't link to it. Link ${ownerName} to it, or choose another owner.`,
      );
      continue;
    }
    // Every line into the store, entries included, comes from its worker owner.
    const writer = owner?.kind === "element" ? owner.id : undefined;
    const readers = graph.edges.filter((edge) => edge.target === node.id && edge.source !== writer);
    if (
      kind !== "cache" &&
      writer &&
      bindings.get(writer)?.settings.kind === "worker" &&
      !readers.length
    )
      warn(
        "output-unread",
        node.id,
        `Nothing reads ${store}: only its owner ${ownerName} links to it. Link the service or API that reads it.`,
      );
  }
  return out;
}

/** The warnings as `DESIGN_WARNING` findings, about the store, queue or action. */
export function studioWarningFindings(design: DesignDocument): Finding[] {
  const actions = design.architecture?.studio?.actions ?? [];
  return studioWarnings(design).map((item) => {
    const index = actions.findIndex((action) => laneActionNode(action.lane) === item.node);
    return finding(
      "DESIGN_WARNING",
      item.message,
      index < 0 ? { element: item.node } : { path: ["architecture", "studio", "actions", index] },
    );
  });
}
