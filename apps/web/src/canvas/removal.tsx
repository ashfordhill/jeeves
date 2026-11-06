// Removal on the lane canvas, as in automation-illustrator: the selected tile's red X removes it and
// links its predecessors to its successors wherever the lane rules allow (`removeTile`). When that
// would cut tiles off, a panel at the bottom centre of the canvas lists them (marked on the board)
// with **Remove N tiles** and **Cancel**. A selected action's X removes it with its entries
// (`removeAction`), unless that cuts tiles off; the user has no X, and neither has its line to an
// action. A selected line's X removes that link (`removeLink`). Each removal is one batch and one
// undo step; a refusal goes to the studio notice in plain words. Afterwards the removed tile's
// first predecessor is selected (a removed line leaves nothing selected).
import { type BoardProps, nextTileAfterRemoval } from "@jeeves/board";
import {
  buildStudioCommand,
  type DesignDocument,
  LANE_ACTOR,
  type LaneGraph,
  laneActionOf,
  laneGraph,
  laneRemoveActionRefusal,
  planRemoveTile,
  studioDefinitions,
} from "@jeeves/spec";
import { IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useProject } from "../project/store.ts";
import { commitAction } from "../studio/actions.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";

type Removal = Pick<BoardProps, "removable" | "onRemoveTile" | "onRemoveLine" | "hud">;
type Pending = { tile: string; strands: string[] };

export function useLaneRemoval({
  projectId,
  design,
  graph,
  tile,
  onRemoved,
}: {
  projectId: string;
  design: DesignDocument;
  graph: LaneGraph;
  /** The selected tile, if any (none in hand mode). */
  tile: string | undefined;
  /** A removal was saved; `next` is the tile to select, if any. */
  onRemoved: (next: string | undefined) => void;
}): Removal & { remove: (tile: string) => void } {
  const [pending, setPending] = useState<Pending>();
  // A confirmation belongs to its tile: selecting anything else, or Hand, drops it.
  const open = pending && pending.tile === tile ? pending : undefined;
  useEffect(() => {
    if (pending && pending.tile !== tile) setPending(undefined);
  }, [pending, tile]);
  // Escape cancels it (optional; Cancel does the same).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPending(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const commit = (id: string, strands: string[]) => {
    setPending(undefined);
    const predecessors = graph.edges.filter((edge) => edge.target === id).map((e) => e.source);
    const successors = graph.edges.filter((edge) => edge.source === id).map((e) => e.target);
    void commitAction(
      projectId,
      (latest) =>
        buildStudioCommand(latest, {
          type: "removeTile",
          tile: id,
          ...(strands.length > 0 && { alsoRemove: strands }),
        }).ops,
    ).then((ok) => {
      const latest = useProject.getState().loaded?.design;
      if (!ok || !latest) return;
      onRemoved(nextTileAfterRemoval(laneGraph(latest), predecessors, successors) ?? undefined);
    });
  };

  const remove = (id: string) => {
    if (id === LANE_ACTOR) return;
    const lane = laneActionOf(id);
    if (lane) {
      const refusal = laneRemoveActionRefusal(design, lane);
      if (refusal) {
        useProject.getState().setNotice({ tone: "error", message: refusal });
        return;
      }
      void commitAction(
        projectId,
        (latest) => buildStudioCommand(latest, { type: "removeAction", lane }).ops,
      ).then((ok) => {
        if (ok) onRemoved(LANE_ACTOR);
      });
      return;
    }
    const planned = planRemoveTile(design, id);
    if (!planned.ok) {
      useProject.getState().setNotice({ tone: "error", message: planned.message });
      return;
    }
    if (planned.value.strands.length) setPending({ tile: id, strands: planned.value.strands });
    else commit(id, []);
  };

  return {
    remove,
    removable: (id) => id !== LANE_ACTOR,
    onRemoveTile: remove,
    onRemoveLine: (line) => {
      void commitAction(
        projectId,
        (latest) => buildStudioCommand(latest, { type: "removeLink", link: line }).ops,
      ).then((ok) => {
        if (ok) onRemoved(undefined);
      });
    },
    ...(open && {
      hud: {
        tile: open.tile,
        marked: [open.tile, ...open.strands],
        content: (
          <RemoveConfirm
            design={design}
            graph={graph}
            pending={open}
            onConfirm={() => commit(open.tile, open.strands)}
            onCancel={() => setPending(undefined)}
          />
        ),
      },
    }),
  };
}

/** The tiles a removal takes with it (icon and name), with Remove N tiles and Cancel. */
function RemoveConfirm({
  design,
  graph,
  pending,
  onConfirm,
  onCancel,
}: {
  design: DesignDocument;
  graph: LaneGraph;
  pending: Pending;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Enter confirms, as in automation-illustrator; no scroll, so the board's camera stays put.
    confirm.current?.focus({ preventScroll: true });
  }, []);
  const name = (id: string) => design.elements.find((element) => element.id === id)?.name ?? id;
  const visual = (id: string) => {
    const kind = graph.nodes.find((node) => node.id === id)?.kind;
    return kind ? studioDefinitions[kind].visual : undefined;
  };
  const count = pending.strands.length + 1;
  return (
    <div className="lane-remove" role="dialog" aria-label={`Remove ${name(pending.tile)}`}>
      <p className="lane-remove-title">Removing {name(pending.tile)} also removes</p>
      <ul className="lane-remove-list">
        {pending.strands.map((id) => (
          <li key={id} data-family={visual(id)?.color ?? "generic"}>
            <StudioIcon name={visual(id)?.icon} size={18} />
            {name(id)}
          </li>
        ))}
      </ul>
      <div className="lane-remove-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" ref={confirm} className="lane-remove-confirm" onClick={onConfirm}>
          <IconTrash size={16} aria-hidden />
          Remove {count} tiles
        </button>
      </div>
    </div>
  );
}
