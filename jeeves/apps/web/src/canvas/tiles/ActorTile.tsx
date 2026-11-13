// The actor tile's face: the user who starts both lanes, drawn with automation-illustrator's human
// figure in dark ink on lilac with a name plate below (ActorColumn's proportions). The board draws
// the frame around it.
import { HumanFigure } from "./HumanFigure.tsx";

export const ACTOR_SIZE = { w: 128, h: 160 } as const;
export const ACTOR_NAME = "User";

export function ActorTile() {
  return (
    <div className="lane-actor">
      <div className="lane-actor-figure">
        <HumanFigure size={52} color="var(--user-ink)" />
      </div>
      <span className="lane-actor-name">{ACTOR_NAME}</span>
    </div>
  );
}
