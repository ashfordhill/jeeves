// Lanes: each line has its own place at both of its ports, so lines that leave or enter one port
// run side by side instead of as one stem. `laneShifts` reads a layout made without lanes and says
// how far below its port's height each end of each line sits. The engine then lays the board out
// again with those shifts (`LayoutLine.lane`), every line on its own ELK port (`elkGraph.ts`).
//
// At a port, lines are ordered by where they turn: a line that turns up takes a higher lane than
// one that runs level, which takes a higher lane than one that turns down. Ties go to the other
// end's height, then input order. Lanes at neighbouring ports of one tile are pushed apart, and a
// tile's lanes stay between its top and bottom.
//
// Jeeves addition.
import { type LayoutInput, lineSourcePortId, lineTargetPortId, portOffset } from "./elkGraph.ts";
import type { BoardLayout } from "./elkLayout.ts";
import { ENTRY_PITCH, ENTRY_PITCH_NAMED, FAN_PITCH, LANE_EDGE, type Point } from "./metrics.ts";

/** How far below its port's height each end of a line sits (negative: above). */
export type LaneShift = { source: number; target: number };

type End = { line: string; index: number; turn: number; far: number };
type Group = { ends: End[]; port: number; centre: number; pitch: number };

/**
 * Where `route` first leaves the level of its start (`end` "source"), or last comes to the level
 * of its finish ("target"), relative to that level: negative is above. 0 for a level route.
 */
function turn(route: readonly Point[], end: "source" | "target"): number {
  const points = end === "source" ? route : [...route].reverse();
  const level = points[0]?.y ?? 0;
  return (points.find((p) => p.y !== level)?.y ?? level) - level;
}

export function laneShifts(input: LayoutInput, layout: BoardLayout): Map<string, LaneShift> {
  const tiles = new Map(input.tiles.map((t) => [t.id, t]));
  const out = new Map<string, LaneShift>(input.lines.map((l) => [l.id, { source: 0, target: 0 }]));
  for (const end of ["source", "target"] as const) {
    const byTile = new Map<string, Map<string, Group>>();
    for (const [index, line] of input.lines.entries()) {
      const route = layout.routes[line.id];
      const tile = tiles.get(line[end]);
      if (!route || route.length < 2 || !tile) continue;
      const named = end === "source" ? line.sourcePort : line.targetPort;
      const id = end === "source" ? lineSourcePortId(line) : lineTargetPortId(line);
      const groups = byTile.get(tile.id) ?? new Map<string, Group>();
      const port = portOffset(tile, named);
      const group = groups.get(id) ?? {
        ends: [],
        port,
        centre: port,
        pitch: end === "source" ? FAN_PITCH : named === undefined ? ENTRY_PITCH : ENTRY_PITCH_NAMED,
      };
      const other = end === "source" ? route[route.length - 1] : route[0];
      group.ends.push({ line: line.id, index, turn: turn(route, end), far: other?.y ?? 0 });
      groups.set(id, group);
      byTile.set(tile.id, groups);
    }
    const apart = end === "source" ? FAN_PITCH : ENTRY_PITCH_NAMED;
    for (const [tileId, groups] of byTile) {
      const height = tiles.get(tileId)?.h ?? 0;
      const stack = [...groups.values()].sort((a, b) => a.port - b.port);
      const half = (g: Group) => ((g.ends.length - 1) / 2) * g.pitch;
      // Neighbouring ports' lanes keep `apart` between them: each pair moves apart equally.
      for (let round = 0; round < 20; round++) {
        for (let i = 0; i + 1 < stack.length; i++) {
          const [a, b] = [stack[i] as Group, stack[i + 1] as Group];
          const need = a.centre + half(a) + apart - (b.centre - half(b));
          if (need > 0) [a.centre, b.centre] = [a.centre - need / 2, b.centre + need / 2];
        }
      }
      // The stack stays on the tile's side: down from the top first, then up from the bottom.
      const [first, last] = [stack[0] as Group, stack[stack.length - 1] as Group];
      let move = Math.max(0, LANE_EDGE - (first.centre - half(first)));
      move = Math.min(move, height - LANE_EDGE - (last.centre + half(last)));
      for (const group of stack) {
        group.ends.sort((a, b) => a.turn - b.turn || a.far - b.far || a.index - b.index);
        for (const [i, e] of group.ends.entries()) {
          const y = group.centre + move + (i - (group.ends.length - 1) / 2) * group.pitch;
          const lane = out.get(e.line);
          if (lane) lane[end] = Math.round(Math.max(0, Math.min(height, y)) - group.port);
        }
      }
    }
  }
  return out;
}
