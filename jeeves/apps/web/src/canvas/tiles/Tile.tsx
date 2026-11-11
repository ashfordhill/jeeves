// A tile's face: the kind's icon (40px) in its family colour, the name in up to two lines and its
// kind label ("Service", "Queue", `studioKindLabel`) in small grey type at the bottom. The board
// draws the frame (a rounded rectangle, or a pill for Database, Cache, Queue and Storage).
// Proportions follow automation-illustrator's StepTile task card: the icon is pinned near the top
// so a second name line grows downwards, and the label is pinned to the bottom below it.
import {
  type StudioKind,
  studioDefinitions,
  studioTileDefinitions,
  tileTypeOf,
} from "@jeeves/spec";
import { StudioIcon } from "../../studio/StudioIcon.tsx";
import { WarningMark } from "../Warnings.tsx";

export const TILE_SIZE = { w: 128, h: 128 } as const;

export function tileShape(kind: StudioKind | undefined): "rect" | "pill" {
  const type = kind && tileTypeOf(kind);
  return type ? studioTileDefinitions[type].shape : "rect";
}

export function Tile({
  kind,
  name,
  label,
  warnings,
}: {
  kind?: StudioKind;
  name: string;
  /** Its kind label (`studioKindLabel`); none for a tile without studio settings. */
  label?: string;
  /** Its design warnings, shown as a mark in the corner. */
  warnings?: readonly string[];
}) {
  const visual = kind ? studioDefinitions[kind].visual : undefined;
  return (
    <div className="lane-tile" data-family={visual?.color ?? "generic"}>
      <span className="lane-tile-icon">
        <StudioIcon name={visual?.icon} size={40} />
      </span>
      <span className="lane-tile-name">{name}</span>
      {label ? <span className="lane-tile-kind">{label}</span> : null}
      <WarningMark messages={warnings} />
    </div>
  );
}
