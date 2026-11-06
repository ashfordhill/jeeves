// Creation on the lane canvas: the selected tile's pull tabs, from the lane rules. A `+` (create)
// tab sits on each side that can add at least one tile type (`laneOptions`): the right adds after
// the tile, the left inserts before it. Its fan always shows all seven types in the same slots,
// with the ones the rules refuse there greyed and the reason in their tip. A picked type becomes a
// new tile (`addTile`, named after its type) and is selected. One attach tab (a link) sits on the
// right, below the `+`, whenever the tile can attach to another (`attachOptions`): a drop on a tile
// links the two in whichever direction the rules allow (`linkTiles`) and leaves the tile you
// pulled from selected, ready for its next fork or merge. The user has a `+` (a new entry tile)
// and an attach tab (an existing tile becomes an entry) per lane. Creates and attaches take the
// pair's default mode. Each is one batch and one undo step; a refusal goes to the studio notice in
// plain words.
import type { BoardProps, CreateTab, FanItem, TabSpec } from "@jeeves/board";
import {
  type AttachOption,
  attachOptions,
  buildStudioCommand,
  type DesignDocument,
  LANE_ACTOR,
  type LaneFrom,
  type LaneGraph,
  type LaneOption,
  type LaneSide,
  laneLinkRefusal,
  laneOptions,
  newLinkId,
  newTileIdentity,
  type StudioLane,
  studioDefinitions,
  studioLanes,
  studioTileDefinitions,
} from "@jeeves/spec";
import { useMemo } from "react";
import { useProject } from "../project/store.ts";
import { commitAction } from "../studio/actions.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { LaneIcon, laneNames } from "./LaneCanvas.tsx";

type Creation = Pick<BoardProps, "tabs" | "canDrop" | "onPick" | "onDrop" | "onDropRefused">;

/** What a tab does: create from `from` on `side`, or attach to the tiles in `options`. */
type Tab =
  | { kind: "create"; from: LaneFrom; side: LaneSide; options: readonly LaneOption[] }
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
  /** The selected tile (or `LANE_ACTOR`), if any. */
  tile: string | undefined;
  /** A new tile was saved. */
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
      extra: Pick<CreateTab, "title" | "badge" | "order"> = {},
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
    /** The link tab, when at least one tile can be attached (from the user: in `lane`). */
    const addAttach = (id: string, from: LaneFrom, label: string, lane?: StudioLane) => {
      const options = attach.filter((option) => option.lane === lane);
      if (!options.some((option) => "link" in option)) return;
      tabs.set(id, {
        kind: "attach",
        from,
        options: new Map(options.map((option) => [option.tile, option])),
      });
      specs.push({
        id,
        kind: "attach",
        side: "after",
        label,
        title: `${label}: pull onto a tile to ${lane ? "make it an entry" : "link the two"}`,
        ...(lane && { badge: <LaneIcon lane={lane} size={13} /> }),
      });
    };
    if (tile === LANE_ACTOR)
      for (const lane of studioLanes) {
        const name = `${laneNames[lane].toLowerCase()} lane`;
        addCreate(`add-${lane}`, { lane }, "after", `Add to ${name}`, {
          title: `Add to ${name}: pull onto a type for a new entry tile`,
          badge: <LaneIcon lane={lane} size={13} />,
          order: laneOrder(graph, lane),
        });
        addAttach(`attach-${lane}`, { lane }, `Attach to ${name}`, lane);
      }
    else {
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

  return {
    tabs: lanes.specs,
    canDrop: (_tile, id, target) => {
      const option = attachOn(id, target)?.option;
      return option !== undefined && "link" in option;
    },
    onDropRefused: (_tile, id, target) => {
      const found = attachOn(id, target);
      if (!found) return;
      // A tile that isn't an option (the user) gets the link rules' own reason.
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
            ...(!latest.architecture && { system: { name: projectName } }),
          }).ops,
      ).then((ok) => {
        if (ok) onCreated(created.id);
      });
      return created.id;
    },
  };
}

/** The actor is selected on an empty project, so its lane `+` tabs show. */
export const startsSelected = (graph: LaneGraph) =>
  graph.nodes.length === 1 ? { tile: LANE_ACTOR } : {};
