// Creation on the lane canvas: the selected tile's pull tabs, from the lane rules. A tile or an
// action has one link tab on its right, when at least one kind fits after it (`linkFanOptions`).
// Its grid fan always shows the eleven kinds a new tile can be, a row per group (application,
// data, messaging, edge) in the same slots, each with its kind's icon and name; the ones the rules
// refuse there are greyed with the reason in their tip. A picked kind becomes a new tile named
// after it (`addTile`), linked after the tile (an action's entry), and is selected. Nothing is
// inserted before a tile. The user has one `+`, whose fan offers its two actions
// (`laneActionOptions`: Consume and Produce, one greyed when the design already has it); a picked
// one becomes a new action tile (`addAction`) and is selected. A new tile's link takes the pair's
// default mode.
//
// A tile that holds modules (`moduleKinds`: a Service, Worker or Uploads, and the older coded
// application kinds) has a `+` on its left. Its grid fan offers the module kinds the tile allows,
// a row per generation (Template, Part of a template, Stub), each with its icon, name and that
// word, and its one-line description in the tip. A picked kind becomes a new module named after
// it (`addModule`), which opens in the inspector; the tile stays where it is. Each create is one
// batch and one undo step. Linking existing tiles is connect mode's (`connect.ts`).
import type { BoardProps, CreateTab, FanItem, TabSpec } from "@jeeves/board";
import {
  buildStudioCommand,
  type DesignDocument,
  LANE_ACTOR,
  type LaneActionOption,
  type LaneFrom,
  type LaneGraph,
  type LinkFanOption,
  laneActionNode,
  laneActionOf,
  laneActionOptions,
  linkFanOptions,
  moduleKinds,
  newLinkId,
  newModuleIdentity,
  newTileIdentity,
  type StudioComponentKind,
  type StudioKind,
  type StudioLane,
  studioComponentDefinitions,
  studioComponentVisuals,
  studioDefinitions,
} from "@jeeves/spec";
import { useMemo } from "react";
import { commitAction } from "../studio/actions.ts";
import {
  moduleGeneration,
  moduleGenerationLabels,
  moduleGenerationOrder,
} from "../studio/module-status.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { LaneIcon } from "./LaneIcon.tsx";
import { tileShape } from "./tiles/Tile.tsx";

type Creation = Pick<BoardProps, "tabs" | "onPick">;

/** What a tab does: add a linked tile after `from`, one of the user's actions, or a module. */
type Tab =
  | { kind: "link"; from: LaneFrom; options: readonly LinkFanOption[] }
  | { kind: "action"; options: readonly LaneActionOption[] }
  | { kind: "module"; host: string; kinds: readonly StudioComponentKind[] };

/** A module fan's longest row, so the widest host (a Worker's 16 kinds) fits beside the rails. */
const MODULE_COLUMNS = 5;

/**
 * Where a new lane entry's tile takes its row: after the lane's last entry, so download stays
 * above upload; a first download entry goes above the first upload entry.
 */
function laneOrder(graph: LaneGraph, lane: StudioLane): CreateTab["order"] {
  const entries = (of: StudioLane) =>
    graph.edges.filter((edge) => edge.lane === of).map((edge) => edge.target);
  const own = entries(lane).at(-1);
  if (own) return { after: own };
  if (lane === "download") {
    const first = entries("upload")[0];
    return first ? { before: first } : undefined;
  }
  const last = entries("download").at(-1);
  return last ? { after: last } : undefined;
}

/** Where a new action takes its row: Consume above Produce. */
function actionOrder(graph: LaneGraph): CreateTab["order"] {
  const has = (lane: StudioLane) => graph.nodes.some((node) => node.action === lane);
  if (has("download")) return { after: laneActionNode("download") };
  if (has("upload")) return { before: laneActionNode("upload") };
  return undefined;
}

/** The link fan's eleven kinds, by group; one the rules refuse here is disabled with the reason. */
function kindItems(options: readonly LinkFanOption[]): FanItem[] {
  return options.map(({ kind, group, refusal }) => {
    const { name, visual } = studioDefinitions[kind];
    return {
      id: kind,
      label: name,
      group,
      shape: tileShape(kind),
      content: (
        <span className="lane-fan-icon" data-family={visual.color}>
          <StudioIcon name={visual.icon} size={30} />
        </span>
      ),
      ...(refusal && { disabled: refusal }),
    };
  });
}

/**
 * The module kinds a tile of kind `host` allows, a row per what each can generate there
 * (Template, Part of a template, Stub) in catalog order, each captioned with that word and
 * described in its tip.
 */
export function moduleItems(kinds: readonly StudioComponentKind[], host: StudioKind): FanItem[] {
  const rank = (kind: StudioComponentKind) =>
    moduleGenerationOrder.indexOf(moduleGeneration(kind, host));
  return [...kinds]
    .sort((a, b) => rank(a) - rank(b))
    .map((kind) => {
      const { name, description } = studioComponentDefinitions[kind];
      const generation = moduleGeneration(kind, host);
      const visual = studioComponentVisuals[kind];
      return {
        id: kind,
        label: name,
        group: generation,
        detail: moduleGenerationLabels[generation],
        description,
        shape: "rect",
        content: (
          <span className="lane-fan-icon" data-family={visual.color}>
            <StudioIcon name={visual.icon} size={30} />
          </span>
        ),
      };
    });
}

/** The user's two actions, Consume then Produce; one the design already has is disabled. */
function actionItems(options: readonly LaneActionOption[]): FanItem[] {
  return options.map((option) => ({
    id: option.lane,
    label: option.name,
    shape: "rect",
    content: (
      <span className="lane-fan-icon lane-fan-action" data-lane={option.lane}>
        <LaneIcon lane={option.lane} size={30} />
      </span>
    ),
    ...(option.refusal && { disabled: option.refusal }),
  }));
}

export function useLaneCreation({
  projectId,
  projectName,
  design,
  graph,
  tile,
  onCreated,
  onModuleCreated,
}: {
  projectId: string;
  projectName: string;
  design: DesignDocument;
  graph: LaneGraph;
  /** The selected tile (an action, or `LANE_ACTOR`), if any. */
  tile: string | undefined;
  /** A new tile or action was saved. */
  onCreated: (id: string) => void;
  /** A new module was saved in `host`. */
  onModuleCreated: (host: string, module: string) => void;
}): Creation {
  const lanes = useMemo(() => {
    const tabs = new Map<string, Tab>();
    const specs: TabSpec[] = [];
    if (!tile || !graph.nodes.some((node) => node.id === tile)) return { tabs, specs };
    /** The link tab on the right, when at least one kind fits after `from`. */
    const addLink = (from: LaneFrom, extra: Pick<CreateTab, "order"> = {}) => {
      const options = linkFanOptions(design, from);
      if (options.every((option) => option.refusal)) return;
      tabs.set("add-linked", { kind: "link", from, options });
      specs.push({
        id: "add-linked",
        kind: "create",
        side: "after",
        glyph: "link",
        layout: "grid",
        label: "Add linked tile",
        title: "Add linked tile: pull onto a kind for a new tile after this one",
        items: kindItems(options),
        ...extra,
      });
    };
    const lane = laneActionOf(tile);
    if (tile === LANE_ACTOR) {
      const options = laneActionOptions(design);
      if (options.some((option) => !option.refusal)) {
        tabs.set("add-action", { kind: "action", options });
        specs.push({
          id: "add-action",
          kind: "create",
          side: "after",
          label: "Add action",
          title: "Add action: pull onto Consume or Produce for what the user does",
          items: actionItems(options),
          order: actionOrder(graph),
        });
      }
    } else if (lane) addLink({ lane }, { order: laneOrder(graph, lane) });
    else {
      addLink({ tile });
      const kinds = moduleKinds(design, tile);
      const host = graph.nodes.find((node) => node.id === tile)?.kind;
      if (kinds.length && host) {
        tabs.set("add-module", { kind: "module", host: tile, kinds });
        specs.push({
          id: "add-module",
          kind: "create",
          side: "before",
          glyph: "plus",
          layout: "grid",
          columns: MODULE_COLUMNS,
          label: "Add module",
          title: "Add module: pull onto a kind for a new module in this tile",
          items: moduleItems(kinds, host),
        });
      }
    }
    return { tabs, specs };
  }, [design, graph, tile]);

  const system = (latest: DesignDocument) =>
    !latest.architecture && { system: { name: projectName } };

  return {
    tabs: lanes.specs,
    onPick: (_tile, id, item) => {
      const tab = lanes.tabs.get(id);
      if (tab?.kind === "module") {
        const kind = tab.kinds.find((each) => each === item);
        if (!kind) return undefined;
        const { host } = tab;
        // Named and given its ID on the latest design; the tile stays, so nothing docks.
        let created: string | undefined;
        void commitAction(projectId, (latest) => {
          const fresh = newModuleIdentity(latest, host, kind);
          created = fresh.id;
          return buildStudioCommand(latest, { type: "addModule", host, kind, ...fresh }).ops;
        }).then((ok) => {
          if (ok && created) onModuleCreated(host, created);
        });
        return undefined;
      }
      if (tab?.kind === "action") {
        const option = tab.options.find((each) => each.lane === item);
        if (!option || option.refusal) return undefined;
        const { lane } = option;
        void commitAction(
          projectId,
          (latest) =>
            buildStudioCommand(latest, { type: "addAction", lane, ...system(latest) }).ops,
        ).then((ok) => {
          if (ok) onCreated(laneActionNode(lane));
        });
        return laneActionNode(lane);
      }
      const option =
        tab?.kind === "link" ? tab.options.find((each) => each.kind === item) : undefined;
      if (tab?.kind !== "link" || !option || option.refusal) return undefined;
      const { from } = tab;
      const { kind } = option;
      // The ID is chosen now, so the board can dock the tile as soon as it arrives.
      const created = newTileIdentity(design, kind);
      const linkId = newLinkId(design, from, created.id, [created.id]);
      void commitAction(
        projectId,
        (latest) =>
          buildStudioCommand(latest, {
            type: "addTile",
            from,
            side: "after",
            tile: { ...created, kind },
            linkId,
            ...system(latest),
          }).ops,
      ).then((ok) => {
        if (ok) onCreated(created.id);
      });
      return created.id;
    },
  };
}

/** The actor is selected on an empty project, so its `+` shows. */
export const startsSelected = (graph: LaneGraph) =>
  graph.nodes.length === 1 ? { tile: LANE_ACTOR } : {};
