// Split shared vertical stems using free grid slots in their existing gaps. Tile positions,
// ports and horizontal tracks stay fixed; a move must reduce overlap without more crossings,
// cross-band clashes, short jogs or a line through a tile. Crowded gaps keep their routes.
// A line's ends are its own ports, named or default: its first and last points never move, and
// cross-band clashes allow only the window next to a port both lines use (`bandClashes`), so two
// lines at different named ports of one tile get no shared window.
import type { LayoutInput } from "./elkGraph.ts";
import type { BoardLayout } from "./elkLayout.ts";
import { bandClashes } from "./junctions.ts";
import { GRID, type Point } from "./metrics.ts";

function sharedVertical(routes: BoardLayout["routes"]): number {
  const all = Object.values(routes);
  let total = 0;
  for (const [i, a] of all.entries()) {
    for (const b of all.slice(i + 1)) {
      for (const [j, p] of a.slice(0, -1).entries()) {
        const q = a[j + 1] as Point;
        if (p.x !== q.x) continue;
        for (const [k, r] of b.slice(0, -1).entries()) {
          const s = b[k + 1] as Point;
          if (r.x !== s.x || r.x !== p.x) continue;
          total += Math.max(
            0,
            Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) -
              Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y)),
          );
        }
      }
    }
  }
  return total;
}

export function separateBranches(layout: BoardLayout, input: LayoutInput): BoardLayout {
  let best = layout;
  let shared = sharedVertical(best.routes);
  if (!shared) return best;
  const baseline = bandClashes(layout, input);
  for (let round = 0; round < input.lines.length && shared > 0; round++) {
    let improved = false;
    for (const line of input.lines) {
      // ELK reserved the chip on this route; leave that geometry intact.
      if (best.chips[line.id]) continue;
      const route = best.routes[line.id] ?? [];
      for (let i = 1; i < route.length - 2; i++) {
        const [before, a, b, after] = route.slice(i - 1, i + 3) as [Point, Point, Point, Point];
        if (a.x !== b.x || before.y !== a.y || after.y !== b.y) continue;
        for (const dx of [GRID, -GRID]) {
          const x = a.x + dx;
          // Stay inside the existing drawing and gap, including an outer return stem.
          if (x < layout.bounds.x + GRID || x > layout.bounds.x + layout.bounds.w - GRID) continue;
          if (
            input.tiles.some((tile) => {
              const at = best.positions[tile.id];
              return (
                at && ((a.x < at.x && x >= at.x) || (a.x > at.x + tile.w && x <= at.x + tile.w))
              );
            })
          )
            continue;
          // Keep the neighbouring horizontals facing the same way, at least a grid step long.
          if ((a.x - before.x) * (x - before.x) <= 0 || Math.abs(x - before.x) < GRID) continue;
          if ((after.x - b.x) * (after.x - x) <= 0 || Math.abs(after.x - x) < GRID) continue;
          const next = route.map((p, j) => (j === i || j === i + 1 ? { ...p, x } : p));
          const obstacles = input.tiles.flatMap((tile) => {
            const at = best.positions[tile.id];
            return at ? [{ ...at, w: tile.w, h: tile.h }] : [];
          });
          obstacles.push(...Object.values(best.chips));
          const throughTile = obstacles.some((box) => {
            return next.slice(0, -1).some((p, j) => {
              const q = next[j + 1] as Point;
              return (
                Math.min(p.x, q.x) < box.x + box.w &&
                Math.max(p.x, q.x) > box.x &&
                Math.min(p.y, q.y) < box.y + box.h &&
                Math.max(p.y, q.y) > box.y
              );
            });
          });
          if (throughTile) continue;
          const candidate = { ...best, routes: { ...best.routes, [line.id]: next } };
          const overlap = sharedVertical(candidate.routes);
          if (overlap >= shared) continue;
          const score = bandClashes(candidate, input);
          if (score.clashes > baseline.clashes || score.crossings > baseline.crossings) continue;
          best = candidate;
          shared = overlap;
          improved = true;
          break;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}
