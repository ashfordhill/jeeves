// A tile's face: the kind's icon (40px) in its family colour, the name in up to two lines and its
// kind label ("Service", "Queue", `studioKindLabel`) in small grey type at the bottom. The board
// draws the frame (a rounded rectangle, or a pill for Database, Cache, Queue and Storage).
// Proportions follow automation-illustrator's StepTile task card: the icon is pinned near the top
// so a second name line grows downwards, and the label is pinned to the bottom below it.
// On the live canvas in Pointer mode (`BoardModuleAdding`), the selected tile, when it can take
// modules, shows a small blue `+` in its top-left corner, clear of the icon, the name, the kind
// label and the warning mark (top-right): it toggles its module menu (`ModuleAddButton`).
import {
  type StudioKind,
  studioDefinitions,
  studioTileDefinitions,
  tileTypeOf,
} from "@jeeves/spec";
import { useContext } from "react";
import { StudioIcon } from "../../studio/StudioIcon.tsx";
import { BoardModuleAdding, ModuleAddButton } from "../ModuleMenu.tsx";
import { WarningMark } from "../Warnings.tsx";

export const TILE_SIZE = { w: 128, h: 128 } as const;

export function tileShape(kind: StudioKind | undefined): "rect" | "pill" {
  const type = kind && tileTypeOf(kind);
  return type ? studioTileDefinitions[type].shape : "rect";
}

export function Tile({
  id,
  kind,
  name,
  label,
  warnings,
}: {
  /** The tile's ID, which its `+` adds modules to. */
  id?: string;
  kind?: StudioKind;
  name: string;
  /** Its kind label (`studioKindLabel`); none for a tile without studio settings. */
  label?: string;
  /** Its design warnings, shown as a mark in the corner. */
  warnings?: readonly string[];
}) {
  const visual = kind ? studioDefinitions[kind].visual : undefined;
  const adding = useContext(BoardModuleAdding);
  const groups = id !== undefined && adding?.selected === id ? adding.groups(id) : undefined;
  return (
    <div className="lane-tile" data-family={visual?.color ?? "generic"}>
      <span className="lane-tile-icon">
        <StudioIcon name={visual?.icon} size={40} />
      </span>
      <span className="lane-tile-name">{name}</span>
      {label ? <span className="lane-tile-kind">{label}</span> : null}
      <WarningMark messages={warnings} />
      {adding && groups?.length && id !== undefined ? (
        <ModuleAddButton
          tile={id}
          name={name}
          groups={groups}
          onAdd={adding.add}
          placement="board"
          className="lane-tile-add"
        />
      ) : null}
    </div>
  );
}
