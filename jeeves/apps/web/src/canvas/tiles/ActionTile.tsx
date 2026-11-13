// An action tile's face: what the user does in a lane. Its lane icon sits in a round light badge
// at the top and its name is one large dark word below, on yellow, so it reads as the start of a
// flow rather than as a service. The board draws the frame around it.
import type { StudioLane } from "@jeeves/spec";
import { LaneIcon } from "../LaneIcon.tsx";
import { WarningMark } from "../Warnings.tsx";

export const ACTION_SIZE = { w: 128, h: 128 } as const;

export function ActionTile({
  lane,
  name,
  warnings,
}: {
  lane: StudioLane;
  name: string;
  /** Its design warnings, shown as a mark in the corner. */
  warnings?: readonly string[];
}) {
  const size = name.length > 14 ? "long" : name.length > 9 ? "medium" : undefined;
  return (
    <div className="lane-action" data-lane={lane} data-size={size}>
      <span className="lane-action-icon">
        <LaneIcon lane={lane} size={22} />
      </span>
      <span className="lane-action-name">{name}</span>
      <WarningMark messages={warnings} />
    </div>
  );
}
