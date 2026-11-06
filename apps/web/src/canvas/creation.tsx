// Creation on the lane canvas: the selected tile's pull tabs, from the lane rules. A `+` (create)
// tab sits on each side that can add at least one tile type (`laneOptions`): the right adds after
// the tile, the left inserts before it. Its fan always shows all seven types in the same slots,
// with the ones the rules refuse there greyed and the reason in their tip. A picked type becomes a
// new tile (`addTile`, named after its type) and is selected. One attach tab (a link) sits on the
// right, below the `+`, whenever the tile can attach to another (`attachOptions`): a drop on a tile
// links the two in whichever direction the rules allow (`linkTiles`) and leaves the tile you
// pulled from selected, ready for its next fork or merge. The user has one `+`, whose fan offers
// its two actions (`laneActionOptions`: Consume and Produce, one greyed when the design already
// has it); a picked one becomes a new action tile (`addAction`) and is selected. An action has a
// right `+` (a new entry tile) and an attach tab (an existing tile becomes its entry), and no left
// `+`; nothing attaches onto the user. Creates and attaches take the pair's default mode. Each is
// one batch and one undo step; a refusal goes to the studio notice in plain words.
import type { BoardProps, CreateTab, FanItem, TabSpec } from "@jeeves/board";
import {
  type AttachOption,
  attachOptions,
  buildStudioCommand,
  type DesignDocument,
  LANE_ACTOR,
  type LaneActionOption,
  type LaneFrom,
  type LaneGraph,
  type LaneOption,
  type LaneSide,
  laneActionNode,
  laneActionOf,
  laneActionOptions,
  laneLinkRefusal,
  laneOptions,
  newLinkId,
  newTileIdentity,
  type StudioLane,
  studioDefinitions,
  studioTileDefinitions,
} from "@jeeves/spec";
import { useMemo } from "react";
import { useProject } from "../project/store.ts";
import { commitAction } from "../studio/actions.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { LaneIcon } from "./LaneIcon.tsx";

type Creation = Pick<BoardProps, "tabs" | "canDrop" | "onPick" | "onDrop" | "onDropRefused">;

/**
 * What a tab does: create from `from` on `side`, add one of the user's actions, or attach to the
 * tiles in `options`.
 */
type Tab =
  | { kind: "create"; from: LaneFrom; side: LaneSide; options: readonly LaneOption[] }
  | { kind: "action"; options: readonly LaneActionOption[] }
  | { kind: "attach"; from: LaneFrom; options: ReadonlyMap<string, AttachOption> };

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

/** All seven tile types, in order; a type the rules refuse here is disabled with the reason. */
function fanItems(options: readonly LaneOption[]): FanItem[] {
  return options.map((option) => {
    const type = studioTileDefinitions[option.type];
    const kind = "kind" in option ? option.kind : type.kinds[0];
    return {
      id: option.type,
      label: type.name,
      shape: type.shape,
      content: (
        <span className="lane-fan-icon" data-family={studioDefinitions[kind].visual.color}>
          <StudioIcon name={type.icon} size={30} />
        </span>
      ),
      ...("refusal" in option && { disabled: option.refusal }),
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
}: {
  projectId: string;
  projectName: string;
  design: DesignDocument;
  graph: LaneGraph;
  /** The selected tile (an action, or `LANE_ACTOR`), if any. */
  tile: string | undefined;
  /** A new tile or action was saved. */
  onCreated: (id: string) => void;
}): Creation {
  const lanes = useMemo(() => {
    const tabs = new Map<string, Tab>();
    const specs: TabSpec[] = [];
    if (!tile || !graph.nodes.some((node) => node.id === tile)) return { tabs, specs };
    const attach = attachOptions(design, tile);
    /** A `+` on this side, when it can add at least one tile type. */
    const addCreate = (
      id: string,
      from: LaneFrom,
      side: LaneSide,
      label: string,
      extra: Pick<CreateTab, "order"> = {},
    ) => {
      const options = laneOptions(design, from, side);
      if (!options.some((option) => "kind" in option)) return;
      tabs.set(id, { kind: "create", from, side, options });
      specs.push({
        id,
        kind: "create",
        side,
        label,
        title: `${label}: pull onto a type for a new tile`,
        items: fanItems(options),
        ...extra,
      });
    };
    /** The link tab, when at least one tile can be attached (from an action: as its entry). */
    const addAttach = (id: string, from: LaneFrom, label: string) => {
      if (!attach.some((option) => "link" in option)) return;
      tabs.set(id, {
        kind: "attach",
        from,
        options: new Map(attach.map((option) => [option.tile, option])),
      });
      specs.push({
        id,
        kind: "attach",
        side: "after",
        label,
        title: `${label}: pull onto a tile to ${"lane" in from ? "make it an entry" : "link the two"}`,
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
    } else if (lane) {
      addCreate("add-after", { lane }, "after", "Add after", { order: laneOrder(graph, lane) });
      addAttach("attach", { lane }, "Attach");
    } else {
      addCreate("add-before", { tile }, "before", "Add before");
      addCreate("add-after", { tile }, "after", "Add after");
      addAttach("attach", { tile }, "Attach");
    }
    return { tabs, specs };
  }, [design, graph, tile]);

  /** The attach option for a drop on `target`, if the tab attaches. */
  const attachOn = (id: string, target: string) => {
    const tab = lanes.tabs.get(id);
    return tab?.kind === "attach" ? { tab, option: tab.options.get(target) } : undefined;
  };
  const system = (latest: DesignDocument) =>
    !latest.architecture && { system: { name: projectName } };

  return {
    tabs: lanes.specs,
    canDrop: (_tile, id, target) => {
      const option = attachOn(id, target)?.option;
      return option !== undefined && "link" in option;
    },
    onDropRefused: (_tile, id, target) => {
      const found = attachOn(id, target);
      if (!found) return;
      // A tile that isn't an option (the user, an action) gets the link rules' own reason.
      const message =
        found.option && "refusal" in found.option
          ? found.option.refusal
          : laneLinkRefusal(design, found.tab.from, target);
      if (message) useProject.getState().setNotice({ tone: "error", message });
    },
    onDrop: (_tile, id, target) => {
      const option = attachOn(id, target)?.option;
      if (!option || !("link" in option)) return;
      const { from, to } = option.link;
      const linkId = newLinkId(design, from, to);
      // The source stays selected (unlike a pick), so its next fork or merge needs no click back.
      void commitAction(
        projectId,
        (latest) => buildStudioCommand(latest, { type: "linkTiles", from, to, linkId }).ops,
      );
    },
    onPick: (_tile, id, item) => {
      const tab = lanes.tabs.get(id);
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
        tab?.kind === "create" ? tab.options.find((each) => each.type === item) : undefined;
      if (tab?.kind !== "create" || !option || !("kind" in option)) return undefined;
      const { from, side } = tab;
      // The ID is chosen now, so the board can dock the tile as soon as it arrives.
      const created = newTileIdentity(design, option.type);
      const linkId =
        side === "before" && "tile" in from
          ? newLinkId(design, { tile: created.id }, from.tile, [created.id])
          : newLinkId(design, from, created.id, [created.id]);
      void commitAction(
        projectId,
        (latest) =>
          buildStudioCommand(latest, {
            type: "addTile",
            from,
            side,
            tile: { ...created, kind: option.kind },
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
