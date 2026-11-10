// Connect mode on the lane canvas: a drag from one tile, action or the user to another links them
// with `linkTiles`, in the pair's default mode, from where the drag started to where it ended.
// The lane rules (`connectOptions`) decide which ends are allowed; a refused one fades, with its
// reason as the drag's tip and, on release, in the studio notice, and nothing changes. A refused
// direction is never reversed. From an action the new link is an entry; nothing links onto the
// user or an action. Each link is one batch and one undo step. Removing a line in this mode is its
// X (`removal.tsx`).
import type { ConnectRules } from "@jeeves/board";
import {
  buildStudioCommand,
  type ConnectOption,
  connectOptions,
  type DesignDocument,
  newLinkId,
} from "@jeeves/spec";
import { useMemo } from "react";
import { useProject } from "../project/store.ts";
import { commitAction } from "../studio/actions.ts";

export function useLaneConnect({
  projectId,
  design,
}: {
  projectId: string;
  design: DesignDocument;
}): Required<ConnectRules> {
  // Each source's ends, worked out once per design (a drag asks about every tile).
  const optionOf = useMemo(() => {
    const bySource = new Map<string, Map<string, ConnectOption>>();
    return (from: string, to: string): ConnectOption | undefined => {
      let ends = bySource.get(from);
      if (!ends) {
        ends = new Map(connectOptions(design, from).map((option) => [option.tile, option]));
        bySource.set(from, ends);
      }
      return ends.get(to);
    };
  }, [design]);
  const refusal = (from: string, to: string) => {
    const option = optionOf(from, to);
    return option && "refusal" in option ? option.refusal : undefined;
  };
  return {
    canConnect: (from, to) => {
      const option = optionOf(from, to);
      return option !== undefined && "link" in option;
    },
    connectRefusal: refusal,
    onConnectRefused: (from, to) => {
      const message = refusal(from, to);
      if (message) useProject.getState().setNotice({ tone: "error", message });
    },
    onConnect: (from, to) => {
      const option = optionOf(from, to);
      if (!option || !("link" in option)) return;
      const { link } = option;
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
  };
}
