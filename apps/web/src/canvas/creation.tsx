// Creation on the lane canvas: the selected tile's pull tabs and fans, from the lane rules. A tab
// is a side and a mode with something to offer (`laneTabs`): `+` adds or links with a request,
// `---` asynchronously; the user has one `+` per lane. Its fan offers the tile types the rules
// accept there (`laneChoices`), as icons. A picked type becomes a new tile (`addTile`, named after
// its type) and is selected; a drop on a tile links to it (`linkTiles`; a lane tab dropped on the
// other lane's entry tile makes that entry start both lanes) and leaves the tile you pulled from
// selected, ready for its next fork or merge. Each is one batch and one undo step; a
// refusal goes to the studio notice in plain words.
import type { BoardProps, FanItem, TabSpec } from "@jeeves/board";
import {
  buildStudioCommand,
  type DesignDocument,
  LANE_ACTOR,
  type LaneFrom,
  type LaneGraph,
  type LaneTab,
  laneChoices,
  laneLinkRefusal,
  laneTabs,
  newLinkId,
  newTileIdentity,
  type StudioEntryLane,
  type StudioLane,
  type StudioTileType,
  studioDefinitions,
  studioTileDefinitions,
} from "@jeeves/spec";
import { useMemo } from "react";
import { useProject } from "../project/store.ts";
import { commitAction } from "../studio/actions.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";
import { LaneIcon, laneNames } from "./LaneCanvas.tsx";

type Creation = Pick<BoardProps, "tabs" | "canDrop" | "onPick" | "onDrop" | "onDropRefused">;

const tabId = (tab: LaneTab) =>
  "lane" in tab.from ? `lane-${tab.from.lane}` : `${tab.side}-${tab.mode}`;

function tabLabel(tab: LaneTab): string {
  if ("lane" in tab.from) return laneNames[tab.from.lane];
  return `${tab.mode === "sync" ? "Request" : "Async"} ${tab.side}`;
}

/** The link a drop makes: out of the tile on its right, into it on its left. */
function dropLink(tab: LaneTab, target: string): { from: LaneFrom; to: string } {
  return tab.side === "before" && "tile" in tab.from
    ? { from: { tile: target }, to: tab.from.tile }
    : { from: tab.from, to: target };
}

/**
 * Where a new lane entry's tile takes its row: after the lane's last entry of its own, so the
 * entries stay download-only, both-lane, upload-only from top to bottom. A first download-only
 * entry goes above the first both-lane or upload entry; a first upload-only one below the rest.
 */
function laneOrder(graph: LaneGraph, lane: StudioLane): TabSpec["order"] {
  const entries = (of: StudioEntryLane) =>
    graph.edges.filter((edge) => edge.lane === of).map((edge) => edge.target);
  const own = entries(lane).at(-1);
  if (own) return { after: own };
  if (lane === "download") {
    const first = entries("both")[0] ?? entries("upload")[0];
    return first ? { before: first } : undefined;
  }
  const last = entries("both").at(-1) ?? entries("download").at(-1);
  return last ? { after: last } : undefined;
}

function fanItems(design: DesignDocument, tab: LaneTab): FanItem[] {
  return laneChoices(design, tab.from, tab.side, tab.mode).map((choice) => {
    const type = studioTileDefinitions[choice.type];
    return {
      id: choice.type,
      label: type.name,
      shape: type.shape,
      content: (
        <span className="lane-fan-icon" data-family={studioDefinitions[choice.kind].visual.color}>
          <StudioIcon name={type.icon} size={30} />
        </span>
      ),
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
    const tabs = new Map<string, LaneTab>();
    if (!tile || !graph.nodes.some((node) => node.id === tile)) return { tabs, specs: [] };
    const specs: TabSpec[] = laneTabs(design, tile).map((tab) => {
      const id = tabId(tab);
      tabs.set(id, tab);
      const label = tabLabel(tab);
      const lane = "lane" in tab.from ? tab.from.lane : undefined;
      return {
        id,
        side: tab.side,
        glyph: tab.mode === "sync" ? "plus" : "dash",
        label,
        title: `${label}: pull onto a type for a new tile, or onto a tile to link it`,
        items: fanItems(design, tab),
        ...(lane && { badge: <LaneIcon lane={lane} size={13} />, order: laneOrder(graph, lane) }),
      };
    });
    return { tabs, specs };
  }, [design, graph, tile]);

  return {
    tabs: lanes.specs,
    canDrop: (_tile, id, target) => {
      const tab = lanes.tabs.get(id);
      if (!tab) return false;
      const { from, to } = dropLink(tab, target);
      return !laneLinkRefusal(design, from, to, tab.mode);
    },
    onDropRefused: (_tile, id, target) => {
      const tab = lanes.tabs.get(id);
      if (!tab) return;
      const { from, to } = dropLink(tab, target);
      const message = laneLinkRefusal(design, from, to, tab.mode);
      if (message) useProject.getState().setNotice({ tone: "error", message });
    },
    onDrop: (_tile, id, target) => {
      const tab = lanes.tabs.get(id);
      if (!tab) return;
      const { from, to } = dropLink(tab, target);
      const linkId = newLinkId(design, from, to);
      // The source stays selected (unlike a pick), so its next fork or merge needs no click back.
      void commitAction(
        projectId,
        (latest) =>
          buildStudioCommand(latest, { type: "linkTiles", from, to, link: tab.mode, linkId }).ops,
      );
    },
    onPick: (_tile, id, item) => {
      const tab = lanes.tabs.get(id);
      const type = item as StudioTileType;
      const choice = tab
        ? laneChoices(design, tab.from, tab.side, tab.mode).find((c) => c.type === type)
        : undefined;
      if (!tab || !choice) return undefined;
      // The ID is chosen now, so the board can dock the tile as soon as it arrives.
      const created = newTileIdentity(design, type);
      const linkId =
        tab.side === "before" && "tile" in tab.from
          ? newLinkId(design, { tile: created.id }, tab.from.tile, [created.id])
          : newLinkId(design, tab.from, created.id, [created.id]);
      void commitAction(
        projectId,
        (latest) =>
          buildStudioCommand(latest, {
            type: "addTile",
            from: tab.from,
            side: tab.side,
            link: tab.mode,
            tile: { ...created, kind: choice.kind },
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

/** The actor is selected on an empty project, so its two lane tabs show. */
export const startsSelected = (graph: LaneGraph) =>
  graph.nodes.length === 1 ? { tile: LANE_ACTOR } : {};
