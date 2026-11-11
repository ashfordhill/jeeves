// Connect mode on the lane canvas: a drag from one tile, action or the user to another links them
// with `linkTiles`, in the pair's default mode, from where the drag started to where it ended.
// The lane rules (`connectOptions`) decide which ends are allowed; a refused one fades, with its
// reason as the drag's tip and, on release, in the studio notice, and nothing changes. A refused
// direction is never reversed. From an action the new link is an entry; nothing links onto the
// user or an action. Each link is one batch and one undo step. Removing a line in this mode is its
// X (`removal.tsx`).
//
// In the Detailed view a drag may also start at a module row's dot (the board passes the module's
// ID): it ends on a tile, or for an in-process slot (the Cache reader's loader, Favorites' items)
// on a Data access row of the same tile, and runs that module's `connectModule`
// (`moduleConnectOptions` gives each end's command or the reason it is refused). A module link's X runs `disconnectModule`; the tiles' link stays. Each is
// one batch and one undo step, with its generation derived in the same step.
import type { ConnectRules } from "@jeeves/board";
import {
  buildStudioCommand,
  type ConnectOption,
  connectOptions,
  type DesignDocument,
  type ModuleConnectOption,
  moduleConnectOptions,
  newLinkId,
} from "@jeeves/spec";
import { useMemo } from "react";
import { useProject } from "../project/store.ts";
import { commitAction } from "../studio/actions.ts";

type End =
  | { kind: "tile"; option: ConnectOption }
  | { kind: "module"; option: ModuleConnectOption };

export function useLaneConnect({
  projectId,
  design,
}: {
  projectId: string;
  design: DesignDocument;
}): Required<ConnectRules> & { disconnectModule: (link: string) => void } {
  // Each source's ends, worked out once per design (a drag asks about every tile and row).
  const endOf = useMemo(() => {
    const modules = new Set((design.architecture?.studio?.components ?? []).map((item) => item.id));
    const bySource = new Map<string, Map<string, End>>();
    return (from: string, to: string): End | undefined => {
      let ends = bySource.get(from);
      if (!ends) {
        ends = modules.has(from)
          ? new Map(
              moduleConnectOptions(design, from).map((option) => [
                "tile" in option.target ? option.target.tile : option.target.module,
                { kind: "module", option },
              ]),
            )
          : new Map(
              connectOptions(design, from).map((option) => [option.tile, { kind: "tile", option }]),
            );
        bySource.set(from, ends);
      }
      return ends.get(to);
    };
  }, [design]);
  const refusal = (from: string, to: string) => {
    const option = endOf(from, to)?.option;
    return option && "refusal" in option ? option.refusal : undefined;
  };
  return {
    canConnect: (from, to) => {
      const end = endOf(from, to);
      return end?.kind === "module"
        ? "command" in end.option
        : end !== undefined && "link" in end.option;
    },
    connectRefusal: refusal,
    onConnectRefused: (from, to) => {
      const message = refusal(from, to);
      if (message) useProject.getState().setNotice({ tone: "error", message });
    },
    onConnect: (from, to) => {
      const end = endOf(from, to);
      if (end?.kind === "module") {
        if (!("command" in end.option)) return;
        const { command } = end.option;
        void commitAction(projectId, (latest) => buildStudioCommand(latest, command).ops);
        return;
      }
      if (!end || !("link" in end.option)) return;
      const { link } = end.option;
      void commitAction(
        projectId,
        (latest) =>
          buildStudioCommand(latest, {
            type: "linkTiles",
            from: link.from,
            to: link.to,
            linkId: newLinkId(latest, link.from, link.to),
          }).ops,
      );
    },
    disconnectModule: (link) =>
      void commitAction(
        projectId,
        (latest) => buildStudioCommand(latest, { type: "disconnectModule", link }).ops,
      ),
  };
}
