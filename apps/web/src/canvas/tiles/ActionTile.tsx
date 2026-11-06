// An action tile's face: what the user does in a lane. Its lane icon sits in a round badge at the
// top and its name is one large word below, on the lane's pastel, so it reads as the start of a
// flow rather than as a service. The board draws the frame around it.
import type { StudioLane } from "@jeeves/spec";
import { LaneIcon } from "../LaneIcon.tsx";

export const ACTION_SIZE = { w: 128, h: 128 } as const;

export function ActionTile({ lane, name }: { lane: StudioLane; name: string }) {
  const size = name.length > 14 ? "long" : name.length > 9 ? "medium" : undefined;
  return (
    <div className="lane-action" data-lane={lane} data-size={size}>
      <span className="lane-action-icon">
        <LaneIcon lane={lane} size={22} />
      </span>
      <span className="lane-action-name">{name}</span>
    </div>
  );
}
