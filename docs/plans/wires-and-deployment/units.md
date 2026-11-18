# Wires and deployment: lines as wire bundles, then what an export says about running it

**Status:** planned 2026-11-17 from owner feedback and a signed-off preview. Not started. All
fourteen units can run, in order, once the reliable-generation plan's last unit (RG26) has
landed. Part A (WD01–WD08) gives exact edits. Part B (WD09–WD14) is written as that plan's units
are: goal, work and acceptance.
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-17 — Overlapping lines are hard to trace](../../HUMAN_FEEDBACK.md)
· [owner sketch](../../human-feedback/2026-11-17-line-ports-sketch.png)
· [preview, third version](https://claude.ai/artifact/JFzs3rhb5xSMCEhzWTYwas)

A coordinator gives each unit to a fresh agent, in order. That agent does only its own unit on
`main` in the primary checkout, appends a handoff entry, commits it and stops. Nobody starts a unit
until the owner says so.

**Written from reading, not from running.** The planner read the files in the code map at commit
`ecef0c2` and ran nothing. The code blocks below were not compiled. Fix a type or lint error
without changing what the code does, and say so in the handoff. If a step's "find" text has moved
or changed shape, make the same change where the code now is and say so. Stop only when the
design itself cannot work: ELK throws on or ignores what a step relies on, an existing board test
would need an edit, or one of a unit's own stop conditions is met. Do not improvise another
design.

**When a unit stops.** The plan is meant to run unattended, so a stopped unit leaves the checkout
clean for the next one:

1. Save the unfinished work as `docs/plans/wires-and-deployment/stopped/WDnn.patch`
   (`git diff` of the files this unit touched, plus any new files).
2. Put back only the files this unit changed and remove only the files it created. Never reset
   the checkout or touch another unit's files.
3. Append a handoff entry headed `WDnn stopped`, with the reason and what was tried, and commit
   the patch and the entry as `WDnn: stopped, <reason in a few words>`.

What still runs after a stop:

- WD01 to WD04 build on each other. If WD01, WD02 or WD03 stops, skip WD04, WD06 and WD07; WD05
  still runs. If WD04 or WD05 stops, skip WD06 and WD07. WD08 reviews whatever ran.
- Part B does not need Part A. WD09 to WD13 run whatever happened before them, and none needs
  another to finish, except that WD10, WD11 and WD13 leave their contract line out if WD09
  stopped. WD14 always runs.

## What the owner asked for

| # | Request | Units |
| --- | --- | --- |
| R1 | Lines that share a route run side by side with a gap, like a transit map, so each can be traced. At a tile the outer lines curve in towards the centre, like a bundle of wires. | WD01–WD04, WD06 |
| R2 | One line style for all. Colour tells lines apart: a colour per tile, a shade per line, and enough of both that a large diagram never runs out. | WD04–WD06 |
| R3 | A module's lines still start at a dot on the module's box, and fan out from it. | WD01, WD04, WD06 |
| R4 | Async lines are quieter: beads, not long dashes. Arrowheads are small and soft. | WD04, WD06 |
| R5 | Hovering a line picks it out. (Planner's addition, accepted with the preview: colour stops naming a line past about twelve tiles.) | WD07 |
| R6 | What Jeeves can do for a production deployment without doing the deployment: say what must run and how, check the front door, survive a connection pooler, and ship a failure drill. | WD09–WD13 |

## Decisions

The owner made the first twelve on the preview. The rest are the planner's; the owner may change
any of them before WD01 starts. After that, a unit changes one only when the owner says so.

| Topic | Decision |
| --- | --- |
| A · Entering a tile | Each line ends at its own arrowhead. Lines approach in lanes 22px apart (16px at a module's or header's port) and curve in so the arrowheads sit three quarters as far apart. |
| B, K · Line end | An arrowhead: the **soft triangle**, 7px long and 6.8px tall, outlined, pointing straight at the tile. |
| C · Colour | A line takes the colour of the tile it leaves. |
| D · Body | Outlined: a 3.5px colour stroke over a 6.4px ink stroke (`#071c28` in both themes). Lines that cross simply cross: no gap, no bridge. Lines only ever join at a dot. |
| E · Gap | Lines side by side are 11px apart. |
| G · Shades | Every line from a tile has its own shade of the tile's colour. |
| H · Leaving a module | One dot on the module's box. Its lines fan out from the tile's frame at that height, 10px apart. |
| I · Async | Beads: `stroke-dasharray: 0.01 12` with round caps, same widths as a solid line. |
| L · Shade order | Alternate light and deep: of a tile's `k` lines, top to bottom as they leave it, line `i` takes step `i / 2` when `i` is even and `ceil(k / 2) + (i - 1) / 2` when odd. |
| M · Lines that come back | Loop round and enter on the left, as today. Routing rules for them do not change; they only get lanes. |
| N · Colour rule | Twelve hues round the OKLCH wheel, skipping the 50° round sky blue. Colour slot `i` has hue `(265 + (123 + (((i * 5) % 12) + offset(floor(i / 12))) * 310 / 12) % 310) % 360`, where `offset` is 0, ½, ¼, ¾, ⅛ … for rounds 0, 1, 2, 3, 4 …. A tile keeps its slot for life; a new sending tile takes the lowest free slot. The user and action tiles are slate (hue 245, chroma 0.035) and take no slot. |
| Shade | Shade `t` in 0–1 of a hue: lightness `0.82 − 0.34t` in light, `0.90 − 0.30t` in dark; hue drifts `(t − 0.5) × 16°`; chroma `0.17 × (0.62 + 0.38k)` with `k = 1 − min(1, abs(L − 0.66) / 0.34)`, reduced by 4% steps until the colour is inside sRGB. A tile's line `i` of `k` uses `t = (step + 0.5) / k`. A dot uses `t = 0.5`. |
| Where slots are kept | In the project's browser preferences (`useStudioPreferences`), beside the canvas view. Not in the design, its history, the blueprint or chat. A browser without them assigns slots again in node order. **This differs from what the planner told the owner ("stored with the diagram")**: the design schema is strict and feeds the generator, and a colour is a view. |
| Selected | A selected line, and the lines of the selected tile, keep their colour and take the selection blue as their outline. The selected line's outline is 2px wider. |
| How lanes are made | The layout runs twice. The first pass is today's layout, unchanged. `laneShifts` reads it and gives each line a place at each of its ports. The second pass gives every line its own ELK port there and turns ELK's edge merging off, so ELK itself keeps lines 11px apart, orders them and sizes the gaps. Layouts without `lanes` are byte-identical to today's. |
| Board stays generic | `@jeeves/board` gets `lanes`, `LineSpec.wire` and `TileSpec.dot`. It knows nothing about hues, slots or Jeeves. A board without them draws exactly what it draws today. |
| Both views | Simple and Detailed both draw wires. |
| Export | A diagram export keeps light colours whatever the studio's theme, as tiles do. |

## Fixed constraints

- View only. No change to the design schema, blueprint, chat tools, generation, settings allowlist
  or template support.
- `jeeves/packages/board` imports no Jeeves code.
- Every existing test in `packages/board` keeps passing **unchanged**. New behaviour is behind
  `lanes`, `wire` and `dot`; new tests cover it. If an existing board test needs an edit, stop and
  report.
- Every action works by mouse alone.
- Selecting, hovering, switching view and Fit add no history step and change no saved design.
- Never edit the root `README.md`, `AGENTS.md`, `.docs/` or `.jeeves-feedback/`.
- Add no dependency.

## Code map (commit `ecef0c2`)

**Board layout** (`jeeves/packages/board/src/layout/`)

- `engine.ts`: `lay(key, input, previous)` picks `layoutBands` or the flat graph and aligns.
- `elkGraph.ts`: `LayoutLine`, `LayoutInput`, `ROOT_OPTIONS` (`mergeEdges: "true"`,
  `edgeEdgeBetweenLayers: 32`), `elkTile` (one west and one east port at mid-height plus named
  ports), `lineSourcePortId`, `lineTargetPortId`, `portOffset`, `buildElkGraph`, `graphKey`.
- `bands.ts`: `layoutBand` (one ELK pass per band; long lines get a track per column through
  `spread`), `layoutBands` (stacks the bands, then one ELK routing pass with `ROUTE_OPTIONS`, then
  `alignLayout`, `meetAtPorts`, `routeReturns`, `separateBranches`).
- `align.ts`: `alignLayout`; a route's first run takes `sy`, its last run `ty`.
- `returns.ts`: `bestU`, `judge`, `routeReturns`, `widenAt`: a line that comes back is a U on
  32px slots and rows.
- `junctions.ts` (`meetAtPorts`, `bandClashes`) and `branches.ts` (`separateBranches`) act only
  on runs that lie on exactly the same line. With lanes there are none, so both return their
  input.
- `metrics.ts`: `GRID` 32, `TILE_GAP` 64, `BRANCH_GAP` 32.
- `elkLayout.ts`: `toBoardLayout` rounds every point to whole pixels.

**Board React** (`jeeves/packages/board/src/react/`)

- `Board.tsx`: `TileSpec`, `LineSpec`, `BoardProps`; `layoutInput(tiles, lines)`; `lineEdges`
  (draw order, `linked`, `bridges`); the `Tile` node component inside `.board-tile-host`.
- `BoardLine.tsx`: one edge. `BaseEdge` carries `board-line` / `is-dashed`; `.board-line-arrow`
  carries the inline stroke that e2e reads (`var(--board-select)` when selected or linked).
- `lineGeometry.ts`: `nearestLines` (clicks pick the nearest route), `crossingBridges`.
- `board.css`: `--board-line`, `--board-select`, `--board-paper`.

**Web canvas** (`jeeves/apps/web/src/`)

- `canvas/LaneCanvas.tsx`: builds `TileSpec[]` and `LineSpec[]` for both views and renders
  `<Board>` and `<LineLegend />`.
- `canvas/detailedView.ts`: containers 256 wide; header port at y 32; row `i`'s port at
  `48 + 32i + 16`.
- `canvas/tiles/ContainerTile.tsx` and `canvas/canvas.css`: a row's port mark
  (`.lane-container-row[data-ports~="out"]::after`) and dot (`.lane-container-row-dot`).
- `canvas/Workspace.tsx` line 120: `useStudioPreferences(projectId)`; line 488: `<LaneCanvas>`.
- `studio/preferences.ts`: `Preferences`, `readPreferences`.
- `canvas/laneLayout.test.ts`: lays out the three studies with real ELK.
- `canvas/capturePng.tsx`: an export waits for one `.react-flow__edge-path` per line and one
  `.board-line-arrow` per directed line.
- e2e helpers that read lines: `e2e/studio.ts` (`.react-flow__edge-path.is-dashed`),
  `canvas.spec.ts`, `relationship-tracing.spec.ts`, `detailed-view.spec.ts`
  (`.board-line-arrow`'s inline `stroke`).

## Checks for every unit

`pnpm check`, `pnpm test:e2e` (or `pnpm test:e2e:docker`), `pnpm --filter @jeeves/web build`, and
for WD06 and WD07 a browser check of the running app: it loads, the TinyURL study renders, and the
changed behaviour works by mouse. Never touch ports 4300 and 4310 if the owner's studio is using
them; e2e uses 4301 and 4311.

---

# Part A — the canvas

## WD01 — Board: where each line sits at its ports

**Goal:** a pure function that reads a finished layout and says how far above or below its port
each end of each line sits. Nothing calls it yet.

**1. `layout/metrics.ts`**: append:

```ts
/** Lines that run side by side in a gap or a row are this far apart (`lanes.ts`). */
export const LANE_GAP = 11;
/** Lanes leaving one port are this far apart. */
export const FAN_PITCH = 10;
/** Lanes entering a tile's default port, and a named port. */
export const ENTRY_PITCH = 22;
export const ENTRY_PITCH_NAMED = 16;
/** A lane keeps this far from its tile's top and bottom. */
export const LANE_EDGE = 6;
/** Room ELK keeps between a column and the first upright run beside it: the fan and the gather. */
export const LANE_APPROACH = 48;
```

**2. `layout/elkGraph.ts`**: in `LayoutLine` add, after `targetPort?: string;`:

```ts
  /** Its own place at each port, px below the port's height (`lanes.ts`). Set by the engine. */
  lane?: { source: number; target: number };
```

Replace `export type LayoutInput = { tiles: LayoutTile[]; lines: LayoutLine[] };` with:

```ts
/** `lanes`: every line gets its own lane at each port and in each gap (`lanes.ts`). */
export type LayoutInput = { tiles: LayoutTile[]; lines: LayoutLine[]; lanes?: true };
```

In `graphKey`, the function returns `JSON.stringify([A, B])`. Make it
`JSON.stringify(input.lanes ? [A, B, "lanes"] : [A, B])` with `A` and `B` unchanged.

**3. New file `layout/lanes.ts`:**

```ts
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
import {
  type LayoutInput,
  lineSourcePortId,
  lineTargetPortId,
  portOffset,
} from "./elkGraph.ts";
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
```

**4. `layout/index.ts`**: add `export * from "./lanes.ts";` after the `junctions.ts` line.

**Tests:** new `layout/lanes.test.ts`. Build each `BoardLayout` by hand (positions and routes; no
ELK). Tiles are 128×128 unless said.

1. One line between two tiles: shifts are `{ source: 0, target: 0 }`.
2. Three lines from one tile's default port whose routes turn up, run level and turn down, given
   in the order down, up, level: source shifts are −10 (up), 0 (level), 10 (down).
3. Two lines into one default port, one arriving from above and one from below: target shifts −11
   and 11. The same into a named port (`targetPort` set, the tile has that port at y 64): −8 and 8.
4. A 256×192 tile with named out ports at y 64 (two lines) and y 96 (five lines): every lane y
   (port y plus shift) is a whole number, lanes of one port are 10 apart, and no two of the seven
   are closer than 10.
5. Seven lines into one default port of a 128-high tile: every lane y is between 0 and 128.
6. `graphKey` of one input with and without `lanes: true` differs, and without it equals
   `JSON.stringify([[["a", 128, 128, null]], []])` for a single tile `a`.

**Done when:** the checks pass and no existing test file changed.

**Commit:** `WD01: board lane shifts`

## WD02 — Board: every line on its own lane, through ELK

**Goal:** an input with `lanes: true` is laid out twice and comes back with every forward line on
its own lane: its ends at `port + shift`, 11px from its neighbours in a gap, no shared run.

**1. `layout/elkGraph.ts`**

Import `LANE_APPROACH` and `LANE_GAP` from `./metrics.ts`. After `NODE_OPTIONS` add:

```ts
/** With lanes, ELK never merges lines and keeps them `LANE_GAP` apart. */
export const LANE_OPTIONS: Record<string, string> = {
  "elk.layered.mergeEdges": "false",
  "elk.layered.spacing.edgeNodeBetweenLayers": String(LANE_APPROACH),
  "elk.layered.spacing.edgeEdgeBetweenLayers": String(LANE_GAP),
  "elk.spacing.edgeEdge": String(LANE_GAP),
};
/** The same for the banded routing pass, which keeps its zero vertical spacing. */
export const LANE_ROUTE_OPTIONS: Record<string, string> = {
  "elk.layered.mergeEdges": "false",
  "elk.layered.spacing.edgeNodeBetweenLayers": String(LANE_APPROACH),
  "elk.layered.spacing.edgeEdgeBetweenLayers": String(LANE_GAP),
};
```

After `lineTargetPortId` add:

```ts
/** Whether the lines carry lanes (`lanes.ts`): then each has its own ELK port at each end. */
export function usesLanes(input: LayoutInput): boolean {
  return input.lines.some((l) => l.lane !== undefined);
}

/** The ELK port a line leaves from: its own when it has a lane, else `lineSourcePortId`. */
export function laneSourceId(line: LayoutLine): string {
  const port = lineSourcePortId(line);
  return line.lane ? `${port}~${line.id}` : port;
}

/** The ELK port a line enters: its own when it has a lane, else `lineTargetPortId`. */
export function laneTargetId(line: LayoutLine): string {
  const port = lineTargetPortId(line);
  return line.lane ? `${port}~${line.id}` : port;
}
```

After `elkTile` add:

```ts
/** One ELK child in a layout with lanes: one fixed port per end of each of `lines` at this tile. */
export function elkLaneTile(t: LayoutTile, lines: readonly LayoutLine[]): ElkNode {
  const port = (id: string, x: number, y: number, options: Record<string, string>) => ({
    id,
    x,
    y,
    width: 0,
    height: 0,
    layoutOptions: { ...options },
  });
  return {
    id: t.id,
    width: t.w,
    height: t.h,
    layoutOptions: { ...NODE_OPTIONS },
    ports: [
      ...lines
        .filter((l) => l.target === t.id)
        .map((l) =>
          port(laneTargetId(l), 0, portOffset(t, l.targetPort) + (l.lane?.target ?? 0), PORT_OPTIONS_IN),
        ),
      ...lines
        .filter((l) => l.source === t.id)
        .map((l) =>
          port(laneSourceId(l), t.w, portOffset(t, l.sourcePort) + (l.lane?.source ?? 0), PORT_OPTIONS_OUT),
        ),
    ],
  };
}
```

In `buildElkGraph`:

- before `const children`, add `const lanes = usesLanes(input);`
- `tiles.map((t) => elkTile(t))` → `tiles.map((t) => (lanes ? elkLaneTile(t, lines) : elkTile(t)))`
- `sources: [lineSourcePortId(line)],` → `sources: [laneSourceId(line)],`
- `targets: [lineTargetPortId(line)],` → `targets: [laneTargetId(line)],`
- `layoutOptions: { ...ROOT_OPTIONS, ...STABILITY_OPTIONS },` →
  `layoutOptions: { ...ROOT_OPTIONS, ...STABILITY_OPTIONS, ...(lanes ? LANE_OPTIONS : {}) },`

**2. `layout/align.ts`**: replace

```ts
    const sy = portY(line.source, line.sourcePort);
    const ty = portY(line.target, line.targetPort);
```

with

```ts
    const sy = portY(line.source, line.sourcePort) + (line.lane?.source ?? 0);
    const ty = portY(line.target, line.targetPort) + (line.lane?.target ?? 0);
```

Nothing else in `align.ts` changes: tiles still line up by their ports, not by lanes.

**3. `layout/bands.ts`**

Import `elkLaneTile`, `LANE_OPTIONS`, `LANE_ROUTE_OPTIONS`, `laneSourceId`, `laneTargetId` and
`usesLanes` from `./elkGraph.ts`, and `LANE_GAP` from `./metrics.ts`.

- `spread`: change the signature to
  `function spread(wants: number[], lo: number, hi: number, gap = TRACK_CLEARANCE): number[]` and
  replace the two `TRACK_CLEARANCE` inside its body with `gap`.
- In `layoutBand`, after `const ids = new Set(own.map((t) => t.id));` add
  `const lanes = usesLanes(input);`. Then:
  - `...tiles.map((t) => ({ ...elkTile(t), x: col(t.id) * COLUMN_HINT })),` →
    `...tiles.map((t) => ({ ...(lanes ? elkLaneTile(t, lines) : elkTile(t)), x: col(t.id) * COLUMN_HINT })),`
  - `sources: [lineSourcePortId(l)],` → `sources: [laneSourceId(l)],`
  - `targets: [ids.has(l.target) ? lineTargetPortId(l) : inPortId(stub(l))],` →
    `targets: [ids.has(l.target) ? laneTargetId(l) : inPortId(stub(l))],`
  - `layoutOptions: { ...BAND_OPTIONS }` → `layoutOptions: { ...BAND_OPTIONS, ...(lanes ? LANE_OPTIONS : {}) }`
  - in `from`, append `+ (l.lane?.source ?? 0)` to the returned sum; in `into`, append
    `+ (l.lane?.target ?? 0)`.
  - `const ys = spread(wants, lo, hi);` → `const ys = spread(wants, lo, hi, lanes ? LANE_GAP : TRACK_CLEARANCE);`
- In `layoutBands`, after `checkPorts(input);` add `const lanes = usesLanes(input);`. Then:
  - `...elkTile(t, ins.all(t.id), outs.all(t.id)),` →
    `...(lanes ? elkLaneTile(t, forward.lines) : elkTile(t, ins.all(t.id), outs.all(t.id))),`
  - `sources: [outs.id(l)],` → `sources: [lanes ? laneSourceId(l) : outs.id(l)],`
  - `targets: [ins.id(l)],` → `targets: [lanes ? laneTargetId(l) : ins.id(l)],`
  - in the `startPoint`, `y: portY(l.source, l.sourcePort),` →
    `y: portY(l.source, l.sourcePort) + (l.lane?.source ?? 0),`
  - in the `endPoint`, `y: portY(l.target, l.targetPort)` →
    `y: portY(l.target, l.targetPort) + (l.lane?.target ?? 0)`
  - `layoutOptions: { ...ROUTE_OPTIONS },` →
    `layoutOptions: { ...ROUTE_OPTIONS, ...(lanes ? LANE_ROUTE_OPTIONS : {}) },`

**4. `layout/engine.ts`**: import `laneShifts` from `./lanes.ts`. Rename the existing `lay` to
`layOnce` (body unchanged) and add:

```ts
  /** With `lanes`: today's layout first, then again with each line on the lane it earned there. */
  function lay(key: string, input: LayoutInput, previous?: PositionMap): Promise<BoardLayout> {
    if (!input.lanes) return layOnce(key, input, previous);
    const plain: LayoutInput = { tiles: input.tiles, lines: input.lines };
    return layOnce(key, plain, previous).then((base) => {
      const shifts = laneShifts(plain, base);
      const laned: LayoutInput = {
        tiles: input.tiles,
        lines: input.lines.map((l) => ({ ...l, lane: shifts.get(l.id) ?? { source: 0, target: 0 } })),
      };
      return layOnce(key, laned, base.positions);
    });
  }
```

Add to the comment at the top of `engine.ts`:
`// - An input with `lanes` is laid out twice: without them, then with each line on its own lane.`

**Tests**

In `layout/layout.test.ts` add `describe("lanes", …)`, using the same engine and real-ELK helper
the `bands` tests use. Write one helper, `sharedRuns(layout)`: the number of pairs of segments
from two different lines that have the same direction, lie less than 8px apart and overlap by more
than 1px.

1. Flat: tiles `a`, `b`, `c` (128×128), lines `a→b` and `a→c`, `lanes: true`. Both routes exist,
   `sharedRuns` is 0, and the two routes start 10px apart in y.
2. Banded: the first fixture of `describe("named ports in bands")`, with `lanes: true`.
   `sharedRuns` is 0; every route starts at its source tile's right edge and ends at its target
   tile's left edge; each end's distance from its port's height is a whole number no larger than
   half its tile's height; no route passes through a tile that is not its source or target.
3. Three lines from three tiles into one tile's default port: their last points are 22px apart.
4. The same input without `lanes` deep-equals what a second engine gives for it: lanes leak
   nothing.

In `apps/web/src/canvas/laneLayout.test.ts` add one test per study (`studio-tinyurl`,
`studio-marketplace`, `studio-youtube`): `laneLayoutInput(...)` with `lanes: true` lays out, every
line that does not come back has a route, and no two such lines share a run (same helper,
copied). Lines that come back are WD03's.

**Handoff must report** for each study: layout time for the two passes, the board's width with
and without lanes, and the count of crossings (use `bandClashes(...).crossings`).

**Stop and report if:** ELK throws on a lane input; a study still has shared runs between forward
lines; or a lane layout takes more than 3 seconds.

**Commit:** `WD02: board lanes through ELK`

## WD03 — Board: lines that come back, in lanes

**Goal:** with lanes, a U starts and ends on its own lane and keeps clear of other lines, and
several U's between the same tiles run 11px apart.

All edits are in `layout/returns.ts`. Import `LANE_APPROACH` and `LANE_GAP` from `./metrics.ts`.
Add `const LANE_CLEAR = 8;` with the comment `/** With lanes, runs closer than this count as shared. */`.

In `bestU`:

- `const ys = s.y + portOffset(size.get(line.source), line.sourcePort);` → append
  `+ (line.lane?.source ?? 0)`.
- `const yt = t.y + portOffset(size.get(line.target), line.targetPort);` → append
  `+ (line.lane?.target ?? 0)`.
- Replace the two slot loops with:

```ts
  // Slots for the upright runs: on the grid, or with lanes `LANE_GAP` apart past the approach.
  const [first, step, most] = line.lane ? [LANE_APPROACH, LANE_GAP, 10] : [GRID, GRID, 6];
  const outs: number[] = [];
  for (let x = right + first; x <= after - first && outs.length < most; x += step) outs.push(x);
  const ins: number[] = [];
  for (let x = left - first; x >= before + first && ins.length < most; x -= step) ins.push(x);
```

- In the rows loop, add `const rowStep = line.lane ? LANE_GAP : GRID;` before
  `for (const [from, to] of free) {` and replace
  `for (let y = Math.ceil(a / GRID) * GRID; y <= b; y += GRID) {` with
  `for (let y = Math.ceil(a / rowStep) * rowStep; y <= b; y += rowStep) {`. The `2 * GRID` limits
  stay.
- `const cost = length(route) + extra + (yc % GRID === 0 ? 0 : GRID / 4);` →
  `const cost = length(route) + extra + (line.lane || yc % GRID === 0 ? 0 : GRID / 4);`

In `judge`, replace `if (axis(m) !== axis(o)) continue;` with:

```ts
          if (line.lane ? Math.abs(axis(m) - axis(o)) >= LANE_CLEAR : axis(m) !== axis(o)) continue;
```

Nothing else changes: the rules about what a U may share, widening and the fallback stay.

**Tests** in `describe("lanes", …)`:

5. Tiles `a`, `b1`, `b2`, `c`, `s`, all 128×128 in band 0; lines `a→b1`, `a→b2`, `b1→c`, `a→s`,
   `c→s`; `lanes: true`. First assert the premise with `comesBack` and `endColumns`: `s` sits in
   `c`'s column, so `c→s` comes back (if it does not, stop and report). Then: its route has six
   points, starts at `c`'s right edge and ends at `s`'s left edge, and `sharedRuns` is 0 for the
   whole layout.
6. The same, but `c` is 256×192 with named out ports `r1` (y 64) and `r2` (y 96), and two lines
   `c→s`, one from each: both come back, their level runs are 11px or 22px apart, and
   `sharedRuns` is 0.
7. In `laneLayout.test.ts`, extend WD02's study tests: every line has a route and `sharedRuns` is
   0 for all lines.

**Commit:** `WD03: board returns in lanes`

## WD04 — Board: draw a wire

**Goal:** a line with `wire` is drawn as an outlined, coloured wire with a fan, rounded corners, a
gather and a soft arrowhead; a tile with `dot` shows a dot on its right edge; `lanes` on the board
asks the engine for lanes. A board without them is unchanged.

**1. New file `react/wirePath.ts`:**

```ts
// A wire's drawn shape, from its route and its two ports. The route starts and ends on the line's
// own lane (`lanes.ts`); the wire leaves its port and fans out to that lane, rounds each corner,
// and gathers in to an arrowhead that sits closer to its neighbours than the lanes do.
import type { Point } from "../layout/metrics.ts";

export const WIRE_WIDTH = 3.5;
export const WIRE_EDGE_WIDTH = 6.4;
/** The pointer band of a wire: narrower than a line's, because lanes are 11px apart. */
export const WIRE_HIT_WIDTH = 12;
/** An async wire: beads. */
export const WIRE_BEADS = "0.01 12";
/** Widths of the arrowhead's two strokes. */
export const WIRE_HEAD_EDGE = 5.1;
export const WIRE_HEAD_FILL = 2.2;

const FAN = 36;
const GATHER = 28;
const STUB = 18;
const RADIUS = 9;
/** Arrowheads at one port sit this much closer together than their lanes. */
const HEAD_RATIO = 0.75;
/** The soft triangle, measured back from the line's end. `body` is where the wire's stroke stops. */
const HEAD = { tip: 3.6, base: 10.6, half: 3.4, body: 9 };

const n = (v: number) => Math.round(v * 10) / 10;
const at = (p: Point) => `${n(p.x)} ${n(p.y)}`;

export type WireArt = { body: string; head?: string };

/**
 * `route` is the line's lane route; `port` and `entry` are the ports it leaves and enters. The
 * fan and the gather are drawn only on a level first or last run (a route in motion has neither).
 */
export function wireArt(
  route: readonly Point[],
  port: Point,
  entry: Point,
  directed: boolean,
): WireArt {
  const [first, second] = [route[0], route[1]];
  const [before, last] = [route[route.length - 2], route[route.length - 1]];
  if (!first || !second || !before || !last) return { body: "" };
  const out = second.y === first.y && second.x > first.x;
  const fan = out ? Math.min(FAN, (second.x - first.x) / 2) : 0;
  const into = before.y === last.y && before.x < last.x;
  const reach = into ? Math.min(GATHER + STUB, (last.x - before.x) / 2) : 0;
  const stub = Math.min(STUB, reach);
  const headY = reach > stub ? entry.y + (last.y - entry.y) * HEAD_RATIO : last.y;
  const points: Point[] = [
    { x: first.x + fan, y: first.y },
    ...route.slice(1, -1),
    { x: last.x - reach, y: last.y },
  ];

  const start = points[0] as Point;
  let d = `M ${at(out ? port : first)}`;
  if (out) {
    d +=
      Math.abs(port.y - start.y) < 0.5
        ? ` L ${at(start)}`
        : ` C ${n(port.x + fan * 0.55)} ${n(port.y)} ${n(port.x + fan * 0.45)} ${n(start.y)} ${at(start)}`;
  }
  for (let i = 1; i < points.length; i++) {
    const [p, q, r] = [points[i - 1] as Point, points[i] as Point, points[i + 1]];
    if (!r) {
      d += ` L ${at(q)}`;
      break;
    }
    const [l1, l2] = [Math.hypot(q.x - p.x, q.y - p.y), Math.hypot(r.x - q.x, r.y - q.y)];
    const radius = Math.min(RADIUS, l1 / 2, l2 / 2);
    if (radius < 0.5) {
      d += ` L ${at(q)}`;
      continue;
    }
    const a = { x: q.x - ((q.x - p.x) / l1) * radius, y: q.y - ((q.y - p.y) / l1) * radius };
    const b = { x: q.x + ((r.x - q.x) / l2) * radius, y: q.y + ((r.y - q.y) / l2) * radius };
    d += ` L ${at(a)} Q ${at(q)} ${at(b)}`;
  }
  const gather = points[points.length - 1] as Point;
  const level = { x: last.x - stub, y: headY };
  if (reach > stub && Math.abs(headY - gather.y) >= 0.5) {
    const mid = (gather.x + level.x) / 2;
    d += ` C ${n(mid)} ${n(gather.y)} ${n(mid)} ${n(headY)} ${at(level)}`;
  } else if (reach > 0) d += ` L ${at(level)}`;

  // The arrowhead points along the last run: level after a gather, else as the route arrives.
  const length = Math.hypot(last.x - before.x, last.y - before.y);
  const dir = into ? { x: 1, y: 0 } : { x: (last.x - before.x) / length, y: (last.y - before.y) / length };
  const end = { x: last.x, y: into ? headY : last.y };
  const room = into ? stub : length;
  if (!directed || !(room >= HEAD.base)) return { body: `${d} L ${at(end)}` };
  const back = (by: number, side = 0) => ({
    x: end.x - dir.x * by - dir.y * side,
    y: end.y - dir.y * by + dir.x * side,
  });
  return {
    body: `${d} L ${at(back(HEAD.body))}`,
    head: `M ${at(back(HEAD.tip))} L ${at(back(HEAD.base, HEAD.half))} L ${at(back(HEAD.base, -HEAD.half))} Z`,
  };
}
```

**2. `react/Board.tsx`**

- Add and export `export type WireTone = { light: string; dark: string };`.
- `TileSpec`: add `/** A dot on its right edge at mid-height, where its wires leave. */ dot?: WireTone;`
- `LineSpec`: add

```ts
  /**
   * Draw it as a wire in this colour. Called with its rank among the lines that leave the same
   * tile, top to bottom as they leave it, and how many there are.
   */
  wire?: (rank: number, of: number) => WireTone;
```

- `BoardProps`: add `/** Give every line its own lane (`lanes.ts`). */ lanes?: boolean;`
- `layoutInput`: add a third parameter `lanes = false` and add `...(lanes && { lanes: true as const }),`
  to the returned object. Pass the board's `lanes` prop at **every** call of `layoutInput` in the
  file (the live board and `snapshot`).
- `TileData`: add `dot?: WireTone;`. Where node data is built with
  `...(t.ports?.length ? { ports: t.ports } : {}),` (twice), add `...(t.dot ? { dot: t.dot } : {}),`
  after it.
- In the `Tile` node component, after the closing `</div>` of `.board-tile` and before
  `{data.chrome}`, add:

```tsx
      {data.dot ? (
        <span
          className="board-tile-dot"
          style={{ "--wire-light": data.dot.light, "--wire-dark": data.dot.dark } as CSSProperties}
        />
      ) : null}
```

- In `lineEdges`, before `return ordered.map(`, add:

```ts
  // A wire's rank among the lines leaving its tile, top to bottom where their routes start.
  const leaving = new Map<string, LineSpec[]>();
  for (const l of lines) leaving.set(l.source, [...(leaving.get(l.source) ?? []), l]);
  const rankOf = new Map<string, { rank: number; of: number }>();
  for (const group of leaving.values()) {
    const sorted = [...group].sort(
      (a, b) => (routes[a.id]?.[0]?.y ?? 0) - (routes[b.id]?.[0]?.y ?? 0) || lines.indexOf(a) - lines.indexOf(b),
    );
    for (const [rank, l] of sorted.entries()) rankOf.set(l.id, { rank, of: sorted.length });
  }
```

  (`const { routes } = layout;` must come before it.) In the edge's `data`, add
  `...(l.wire ? { wire: l.wire(rankOf.get(l.id)?.rank ?? 0, rankOf.get(l.id)?.of ?? 1) } : {}),`
  and change `bridges: crossingBridges(` … `),` so a wire gets none:
  `bridges: l.wire ? [] : crossingBridges(` … `),`.

**3. `react/BoardLine.tsx`**

- `BoardLineData`: add `wire?: { light: string; dark: string };`.
- Import `type CSSProperties` from `react` and
  `WIRE_BEADS, WIRE_EDGE_WIDTH, WIRE_HEAD_EDGE, WIRE_HEAD_FILL, WIRE_HIT_WIDTH, WIRE_WIDTH, wireArt`
  from `./wirePath.ts`.
- Lift the chip JSX (the `{data?.chip ? ( <EdgeLabelRenderer> … ) : null}` block) into a
  `const chipNode = …;` above the `return`, and use `{chipNode}` in the existing return.
- Immediately before the existing `return (`, add:

```tsx
  if (data?.wire) {
    const art = wireArt(
      points,
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
      Boolean(data.directed),
    );
    const edge = selected || data.linked ? "var(--board-select)" : "var(--board-wire-ink)";
    const beads = dashed ? WIRE_BEADS : undefined;
    const round = { strokeLinecap: "round", strokeLinejoin: "round" } as const;
    return (
      <>
        <g
          className="board-wire"
          style={{ "--wire-light": data.wire.light, "--wire-dark": data.wire.dark } as CSSProperties}
        >
          <path
            className="board-wire-edge"
            d={art.body}
            fill="none"
            pointerEvents="none"
            style={{
              stroke: edge,
              strokeWidth: selected ? WIRE_EDGE_WIDTH + 2 : WIRE_EDGE_WIDTH,
              strokeDasharray: beads,
              ...round,
            }}
          />
          <path
            className="board-wire-fill"
            d={art.body}
            fill="none"
            pointerEvents="none"
            style={{ strokeWidth: WIRE_WIDTH, strokeDasharray: beads, ...round }}
          />
          {art.head ? (
            <>
              <path
                className="board-line-arrow"
                d={art.head}
                pointerEvents="none"
                style={{ stroke: edge, fill: edge, strokeWidth: WIRE_HEAD_EDGE, strokeLinejoin: "round" }}
              />
              <path
                className="board-wire-head"
                d={art.head}
                pointerEvents="none"
                style={{ strokeWidth: WIRE_HEAD_FILL, strokeLinejoin: "round" }}
              />
            </>
          ) : null}
        </g>
        <BaseEdge
          id={id}
          path={art.body}
          className={dashed ? "board-line is-dashed" : "board-line"}
          interactionWidth={WIRE_HIT_WIDTH}
          style={{ stroke: "transparent", strokeWidth: WIRE_EDGE_WIDTH }}
        />
        {chipNode}
      </>
    );
  }
```

**4. `react/board.css`**: beside `--board-line` add `--board-wire-ink: #071c28;`. Append:

```css
/* Wires (`BoardLine`): the colour comes from the line, light or dark; the caller's theme picks. */
.board-wire,
.board-tile-dot {
  --wire: var(--wire-light);
}
.board-wire-fill {
  stroke: var(--wire);
}
.board-wire-head {
  stroke: var(--wire);
  fill: var(--wire);
}
.board-tile-dot {
  position: absolute;
  top: 50%;
  right: -6px;
  width: 11px;
  height: 11px;
  margin-top: -5.5px;
  box-sizing: border-box;
  border: 1.7px solid var(--board-wire-ink);
  border-radius: 50%;
  background: var(--wire);
  pointer-events: none;
}
```

**Tests**

New `react/wirePath.test.ts`:

1. A straight level route with port and entry level with it: `body` has no `C` and no `Q`, and
   `head` is set when `directed`.
2. Port 10px above the route's first point: `body` starts `M <port>` and its first command is `C`
   ending 36px right of the port on the route's level.
3. A four-point route: `body` has exactly two `Q`.
4. Entry 22px above the route's last point: the head's tip y is `entry.y + 22 × 0.75`.
5. `directed` false: no `head`, and `body` ends at the route's last x.
6. A route whose last run is upright: `head` is set and points down (its tip has the largest y).

In `react/board.test.tsx`, a new `describe("wires", …)`:

7. A line with `wire` renders one `.react-flow__edge-path`, one `.board-wire-fill`, one
   `.board-line-arrow` when directed, and no `.board-line-crossing`.
8. Selecting it gives its `.board-line-arrow` the inline stroke `var(--board-select)`; unselected
   it is `var(--board-wire-ink)`.
9. An async wire's `.react-flow__edge-path` has class `is-dashed` and its `.board-wire-fill` the
   dash array `0.01 12`.
10. Three wires from one tile: `wire` is called with ranks 0, 1 and 2 and `of` 3.
11. A tile with `dot` renders `.board-tile-dot`; one without does not.

**Commit:** `WD04: board wires`

## WD05 — Web: the colour rule and a tile's saved colour

**Goal:** pure colour functions and a per-project record of which colour slot each tile holds.
Nothing is drawn with them yet.

**1. New file `apps/web/src/canvas/wireColours.ts`:**

```ts
// The wires' colours. A tile that sends lines holds a colour slot for life; the slot gives a hue,
// and each of the tile's lines takes its own shade of it. The user and the actions are slate.
// Twelve hues sit evenly round the OKLCH wheel without the 50 degrees round sky blue, which the
// studio keeps for service tiles and selection. Slot 12 starts a second round halfway between
// the first twelve hues, slot 24 a third a quarter step off, and so on: it never runs out.
import type { WireTone } from "@jeeves/board";

const STEP = 310 / 12;
const SLATE = { hue: 245, chroma: 0.035 };
const CHROMA = 0.17;

/** 0, 1/2, 1/4, 3/4, 1/8 ...: how far each later round sits from the first. */
function roundOffset(round: number): number {
  let [fraction, offset] = [0.5, 0];
  for (let n = round; n > 0; n >>= 1, fraction /= 2) if (n & 1) offset += fraction;
  return offset;
}

/** The hue of colour slot `slot` (0, 1, 2 ...). */
export function wireHue(slot: number): number {
  const place = ((slot * 5) % 12) + roundOffset(Math.floor(slot / 12));
  return (265 + ((123 + place * STEP) % 310)) % 360;
}

function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const angle = (h * Math.PI) / 180;
  const [a, b] = [c * Math.cos(angle), c * Math.sin(angle)];
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

function shade(hue: number, chroma: number, t: number, dark: boolean, drift: boolean): string {
  const l = dark ? 0.9 - 0.3 * t : 0.82 - 0.34 * t;
  const h = drift ? hue + (t - 0.5) * 16 : hue;
  let c = chroma * (0.62 + 0.38 * (1 - Math.min(1, Math.abs(l - 0.66) / 0.34)));
  let rgb = oklchToRgb(l, c, h);
  for (let i = 0; i < 80 && !rgb.every((v) => v >= -0.0005 && v <= 1.0005); i++) {
    c *= 0.96;
    rgb = oklchToRgb(l, c, h);
  }
  const hex = (v: number) => {
    const linear = Math.min(1, Math.max(0, v));
    const srgb = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${rgb.map(hex).join("")}`;
}

/** Shade `t` (0 lightest, 1 deepest) of the tile in `slot`; slate when it has none. */
export function wireTone(slot: number | undefined, t: number): WireTone {
  const [hue, chroma, drift] =
    slot === undefined ? [SLATE.hue, SLATE.chroma, false] : [wireHue(slot), CHROMA, true];
  return { light: shade(hue, chroma, t, false, drift), dark: shade(hue, chroma, t, true, drift) };
}

/** The shade step of the `rank`-th of `of` lines: light and deep by turns down the tile. */
export function wireStep(rank: number, of: number): number {
  return rank % 2 === 0 ? rank / 2 : Math.ceil(of / 2) + (rank - 1) / 2;
}

/**
 * Every sending tile's slot: `saved` ones kept while their tile exists, then each of `senders`
 * without one takes the lowest free slot, in order. A removed tile's slot becomes free.
 */
export function assignWireSlots(
  saved: Readonly<Record<string, number>>,
  senders: readonly string[],
  tiles: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const taken = new Set<number>();
  for (const [tile, slot] of Object.entries(saved)) {
    if (!tiles.has(tile) || !Number.isInteger(slot) || slot < 0 || taken.has(slot)) continue;
    out[tile] = slot;
    taken.add(slot);
  }
  for (const tile of senders) {
    if (out[tile] !== undefined) continue;
    let slot = 0;
    while (taken.has(slot)) slot++;
    out[tile] = slot;
    taken.add(slot);
  }
  return out;
}
```

**2. `apps/web/src/studio/preferences.ts`**

- `Preferences`: add `/** Colour slot per tile that sends lines (`wireColours.ts`). */ wires: Record<string, number>;`
- `defaults`: add `wires: {},`
- Add above `readPreferences`:

```ts
const slots = (value: unknown): Record<string, number> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] as number) >= 0,
        ),
      )
    : {};
```

- In `readPreferences`'s returned object add `wires: slots(saved.wires),`
- Change the hook's doc comment to "The rails' open state and widths, the canvas view and the
  tiles' wire colours, per project in this browser. …".

**Tests**

New `canvas/wireColours.test.ts`:

1. `wireHue(0)` is 28 (to one decimal); `wireHue(1)` is 157.2; `wireHue(12)` is `wireHue(0)`
   plus 12.9, to one decimal; slots 0–11 give twelve hues no two closer than 25.8°; none of slots
   0–35 gives a hue between 215 and 265.
2. `wireTone(0, 0.5)` returns two seven-character hex strings that differ, and
   `wireTone(undefined, 0.5).light` has red, green and blue channels within 40 of each other.
3. For `of` 1 to 14, `wireStep(rank, of)` over ranks `0 … of − 1` is a permutation of
   `0 … of − 1`.
4. `assignWireSlots({}, ["a", "b"], new Set(["a", "b"]))` is `{ a: 0, b: 1 }`; with
   `{ a: 3 }` saved, `a` stays 3 and `b` takes 0; a saved tile missing from `tiles` is dropped and
   its slot reused; a saved tile that is in `tiles` but not in `senders` keeps its slot.

In the existing preferences test file (create `studio/preferences.test.ts` if there is none):
`readPreferences` returns `wires: {}` for nothing saved, keeps `{ a: 2 }`, and drops `{ a: -1 }`,
`{ a: 1.5 }` and `{ a: "x" }`.

**Commit:** `WD05: wire colour rule and saved slots`

## WD06 — Web: the lane canvas draws wires

**Goal:** both views of the studio draw every line as a wire in its tile's colour.

**1. `canvas/Workspace.tsx`**: import `assignWireSlots` from `./wireColours.ts` and `LANE_ACTOR`
from `@jeeves/spec` if it is not imported. Where `graph` and `preferences` are both in scope, add:

```ts
  // Each sending tile's colour slot, kept for life in this browser's preferences.
  const wireSlots = useMemo(() => {
    const tiles = new Set(graph.nodes.map((node) => node.id));
    const senders = graph.nodes
      .filter((node) => node.id !== LANE_ACTOR && !node.action)
      .filter((node) => graph.edges.some((edge) => edge.source === node.id))
      .map((node) => node.id);
    return assignWireSlots(preferences.wires, senders, tiles);
  }, [graph, preferences.wires]);
  useEffect(() => {
    if (JSON.stringify(wireSlots) === JSON.stringify(preferences.wires)) return;
    setPreferences((current) => ({ ...current, wires: wireSlots }));
  }, [wireSlots, preferences.wires, setPreferences]);
```

Pass `wires={wireSlots}` to `<LaneCanvas>`.

**2. `canvas/LaneCanvas.tsx`**

- Add the prop `/** Colour slot per sending tile (`assignWireSlots`). */ wires: Readonly<Record<string, number>>;`
- Import `wireStep` and `wireTone` from `./wireColours.ts`.
- Inside the first `useMemo`, after `const name = …`, add:

```ts
    // A tile's colour slot; the user and the actions have none and are slate.
    const laneNodes = new Set(
      graph.nodes.filter((node) => node.id === LANE_ACTOR || node.action).map((node) => node.id),
    );
    const slot = (tile: string) => (laneNodes.has(tile) ? undefined : (wires[tile] ?? 0));
    const sends = new Set(graph.edges.map((edge) => edge.source));
    const wire = (tile: string) => (rank: number, of: number) =>
      wireTone(slot(tile), (wireStep(rank, of) + 0.5) / of);
    const dot = (tile: string) => (sends.has(tile) ? { dot: wireTone(slot(tile), 0.5) } : {});
```

  Add `...dot(node.id),` to each of the three `TileSpec` objects (actor, action, tile), and
  `wire: wire(edge.source),` to each `LineSpec`. Return `wire` and `slot` from the memo with
  `tiles`, `lines`, `warnings` and `kindLabel`, and add `wires` to its dependency list.
- In the `detailed` memo: a container must not carry the Simple view's dot, so replace
  `return { ...tile, w: box.w, …` with a copy without it:
  `const { dot: _dot, ...plain } = tile; return { ...plain, w: box.w, …` (the rest unchanged), and
  pass `wire={wireTone(slot(tile.id), 0.5)}` to `<ContainerTile>`. In `detailedLines`, add
  `wire: wire(line.source),`. Add `wire` and `slot` to the memo's dependency list.
- On `<Board>`, add the prop `lanes`.

**3. `canvas/tiles/ContainerTile.tsx`**: add the optional prop
`/** Its wires' colour (`wireTone` at 0.5), for its rows' port marks and dots. */ wire?: WireTone;`
(import the type from `@jeeves/board`). On the root `<div className="lane-container"`, merge it
into `style`:

```tsx
      style={
        {
          ...(gutter ? { "--row-inset-left": `${gutter}px` } : {}),
          ...(wire ? { "--wire-light": wire.light, "--wire-dark": wire.dark } : {}),
        } as CSSProperties
      }
```

**4. `canvas/canvas.css`**

- After the `:root[data-theme="dark"] :is(.board, .board-overlay) { … }` rule add:

```css
/* Wires take their dark shade in the dark theme. A diagram export stays light. */
.lane-container {
  --wire: var(--wire-light);
}
:root[data-theme="dark"] .board:not(.board-snapshot) :is(.board-wire, .board-tile-dot, .lane-container) {
  --wire: var(--wire-dark);
}
```

- Immediately **before** the comment `/* A port mark is blue while a line at that port is:` add:

```css
/* A row's out mark carries its tile's wire colour from the dot to the frame. */
.lane-container-row[data-ports~="out"]::after {
  background: var(--wire, var(--board-line));
}
```

- In `.lane-container-row-dot[data-connected]`, change `background: var(--board-line);` to
  `background: var(--wire, var(--board-line));`.

**5. `canvas/LineLegend.tsx`**: replace the two `<path>` elements with:

```tsx
        <path d="M 2 7 H 18" strokeDasharray="0.01 5" strokeLinecap="round" strokeWidth="3" />
        <path d="M 27 7 L 21 3.6 V 10.4 Z" fill="currentColor" strokeLinejoin="round" />
```

and change the file's comment to say the sample is beads. Update `LineLegend.test.tsx` to match.

**6. e2e**

- Run the suite. Selectors that count `.board-line-arrow`, read its inline stroke, or count
  `.react-flow__edge-path.is-dashed` must pass **unchanged**: WD04 kept them. If one fails, the
  fix belongs in the board or the canvas, not in the spec; stop and report if that is not
  possible.
- Add to `e2e/canvas.spec.ts`: on TinyURL, every `.react-flow__edge` contains a `.board-wire-fill`;
  two lines that leave different tiles have different computed `stroke` on it; reloading the page
  keeps each line's stroke.
- Add to `e2e/detailed-view.spec.ts`: a connected row's `.lane-container-row-dot` has a computed
  background that is not the board's line colour (read `--board-line` from `.board` and compare).

**7. Docs:** in `docs/studio.md`, replace what it says about line style with: lines are wires;
colour by sending tile, shade per line; beads are async; the dot and fan; lanes 11px apart; colour
slots live in browser preferences. In `docs/design-playbook.md` add one lesson: "A stem that
several lines share cannot be traced. Give each line its own lane and arrowhead, and let colour
say which tile it left." In `docs/HUMAN_FEEDBACK.md`, add a **Resolution update** line to the
2026-11-17 entry naming this commit.

**Browser check:** TinyURL and one larger study in both views and both themes: wires are coloured
by sending tile, async ones are beads, each line ends at its own arrowhead, selecting a tile turns
its wires' outlines blue, a click on a wire selects that wire, and Export diagram gives a PNG with
light colours. Save one screenshot per view under
`docs/plans/wires-and-deployment/evidence/` and link them in the handoff.

**Commit:** `WD06: the canvas draws wires`

## WD07 — Hover picks a wire out

**Goal:** with the pointer on a wire, every other wire fades.

In `packages/board/src/react/board.css` append:

```css
/* Hovering a wire picks it out: the rest fade. */
.board-wire {
  transition: opacity 120ms;
}
.board .react-flow__edges:has(.react-flow__edge:hover) .react-flow__edge:not(:hover) .board-wire {
  opacity: 0.13;
}
@media (prefers-reduced-motion: reduce) {
  .board-wire {
    transition: none;
  }
}
```

If React Flow's markup differs from `.react-flow__edges` containing one `.react-flow__edge` per
line, change only those two class names to the real ones and say so in the handoff.

**Tests:** in `e2e/canvas.spec.ts`: hover the middle of one TinyURL wire (use the bounding box of
its `.board-wire-fill`); that wire's `.board-wire` has computed opacity 1 and another's 0.13;
move the pointer to empty paper and both are 1. The blueprint is unchanged before and after.

**Docs:** one sentence in `docs/studio.md`.

**Commit:** `WD07: hover picks a wire out`

## WD08 — Review of Part A

Read every WD01–WD07 handoff entry and the combined diff since this plan's commit. Findings
first, then fixes.

1. A ledger of every rough edge a handoff passed on, and what became of each.
2. Check against the decisions table, row by row, in the browser on TinyURL, Marketplace and
   YouTube, both views, both themes. Note each mismatch.
3. Check the constraints: no existing board test changed; the design schema, blueprint and chat
   tools are untouched; a board without `lanes`, `wire` and `dot` renders as before (the board's
   own tests are the proof); no dependency added.
4. Look for: two wires closer than 8px that are not at a shared dot; a wire through a tile; an
   arrowhead that does not touch its tile; a dot whose colour differs from its tile's wires; dark
   colours in an export; layout time above 3 seconds on YouTube.
5. Fix a defect only with a test that fails first. Record anything larger as a follow-up in
   `docs/plans/wires-and-deployment/review.md`. No renames, refactors or doc rewording.

**Commit:** `WD08: review of the wire canvas`

---

# Part B — what an export says about running it

These five units change the generator. They are written the way the reliable-generation units
are: a goal, the work, what must hold, and where to start reading. They run after that plan's
last unit, on the generator as it then stands. Its shared documents still apply
(`docs/plans/reliable-generation/README.md`, `contract.md` and `execution.md`): the boundaries,
D2, D4, D6, D7, D10 and D11, and the rule that generated source is changed through templates and
regenerated, never patched by hand. New fixture sources go under
`field-projects/generator-system/fixtures/wd-*`.

Entry points, read on 2026-11-17 at `ecef0c2`. Read them again; do not trust line numbers.

- Processes and exposure: `jeeves-generator/src/v2/tile-processes.ts` (a public HTTP process gets
  `edge: /api/<tile>/`) and `src/v2/http-wiring.ts`.
- HTTP runtime: `templates/local-v2/assets/src/runtime/http.ts.template` (`/livez`, `/readyz`,
  `/healthz`).
- Postgres runtime: `postgres.ts.template` (`max: options.poolSize`, and `statement_timeout` as a
  connection option), `idempotency.ts.template` (`sweepExpired` holds a session advisory lock),
  `transaction.ts.template`.
- Workload identity: `workload.ts.template` (`JEEVES_WORKLOAD_ISSUER`, `JEEVES_WORKLOAD_TOKEN_URL`,
  `JEEVES_WORKLOAD_JWKS_URL` and a client secret).
- Emitted scripts: `templates/local-v2/assets/scripts/` (`local.mjs`, `setup.mjs`, `status.mjs`,
  `migrate.mjs` and others).
- The exposure setting: `jeeves/packages/spec/src/studio-definitions.ts` (`settings.exposure`).

Outside every unit here: provisioning, Terraform or Kubernetes output, sizing, provider names,
alert rules and backups. The contract names what a deployment must provide; it does not provide it.

When a decision below cannot be met exactly as written, take the nearest behaviour that still
meets the unit's Acceptance, record the difference in the handoff, and continue. Stop only when
Acceptance itself cannot be met without a new architectural choice.

## WD09 — The deployment contract

**Goal:** every export says, in one file for tools and one page for people, what has to run and
what each thing needs.

**Work**

- Emit two generated (scaffold) files in every export, `deploy/contract.json` and
  `deploy/README.md`, built from the normalized design and the template descriptors: the same
  data that already names processes, exposure, stores, bindings and environment values. A hook or
  stub cannot add to them.
- `contract.json` is `{ "version": 1, "processes": [], "stores": [], "identity": {} }`, every
  array sorted by `id`, so one design always gives the same bytes.
  - A process: `id`, `name`, `kind` (`service` or `worker`), `exposure` (`public` or `internal`),
    `port` (HTTP only), `health` (`{ "live": "/livez", "ready": "/readyz" }` for HTTP),
    `alwaysOn` (true when it hosts a scheduled task, a consumer or durable work), `env` (the names
    of the environment values it reads, sorted, never a value), `uses` (`[{ "store", "access" }]`)
    and `calls` (ids of the processes it calls).
  - A store: `id`, `name`, `kind`, `role` (`rebuildable` for a cache and for a search index fed
    from another store, else `original`) and `whenLost` (one sentence from a fixed table keyed by
    kind and role).
  - `identity`: the environment names the workload-identity runtime reads; left out when the
    design has no service-to-service call.
- `README.md`: one heading per process and per store with the same facts as a list and a link to
  its source folder, then a Mermaid `flowchart LR` with one node per process and store, one arrow
  per use and call (dashed when asynchronous), and a `click` line per node that links to its
  heading.

**Acceptance:** for one `wd-*` fixture, `contract.json` deep-equals an expectation written by
hand from that fixture's design, not produced by the emitter. A test scans the emitted runtime:
every `process.env` name it reads is in that process's `env`, and every name in `env` is read.
Every node an arrow uses is declared and every `click` targets a heading that exists. `update:v2`
treats both files as generated.

**Emitted surface and checks:** the two files, their manifest entries, and a "Deployment
contract" section in `jeeves-generator/README.md`. Standard checks.

**Not included:** provider files, replica counts, secrets' values, a view in the studio.

**Commit:** `WD09: emit a deployment contract with every export`

## WD10 — The front door's stamp

**Goal:** a public service can refuse a request that did not come through the front door.

**Work**

- A setting `frontDoor` on tiles that have `exposure`, with values `required` and `none`, shown
  only while exposure is public. A newly made public service starts as `required`. A saved design
  without the field reads as `none`, so no existing diagram or export changes (D4). Schema,
  form, validation, catalog, blueprint, generation and chat change together.
- For a `required` process, every HTTP request except `/livez`, `/readyz`, `/healthz` and the
  workload-authenticated `/internal/` routes must carry
  `x-edge-stamp: v1.<unix seconds>.<hex>`, where `<hex>` is HMAC-SHA256 over
  `<seconds>.<METHOD>.<path without query>`. It passes when the time is within 60 seconds of now
  and the MAC matches under `JEEVES_EDGE_STAMP_KEY` or `JEEVES_EDGE_STAMP_KEY_PREVIOUS`, compared
  in constant time. Anything else gets 403 with the standard error body and one log line holding
  a reason code only. The check runs before routing, body parsing, rate limiting and sessions.
- A `required` process without a key never becomes ready and says why at start.
- The generated local edge adds the stamp to what it forwards to `required` services, with a key
  the local setup generates.
- The contract (WD09) gains, on such a process,
  `"frontDoor": { "header", "keyEnv", "previousKeyEnv", "maxAgeSeconds" }`. If WD09 did not land,
  leave this line out and say so.

**Acceptance:** no header, an old or future time, a wrong MAC, and a right MAC for another method
or path each get 403. A stamp under the current or the previous key passes. Health paths answer
without one. Through the local edge a request succeeds; sent straight to the service's port it is
refused. A `none` service behaves as before. Mouse and chat can both set it. An old saved design
loads, and its export is byte-identical for that service.

**Emitted surface and checks:** the runtime check, its settings and startup validation, the edge's
stamping, docs (`docs/studio-settings.md`, `jeeves/CATALOG.md`, the generator README). Standard
checks and mouse/chat parity.

**Not included:** Cloudflare or Google configuration, mutual TLS, address allowlists.

**Commit:** `WD10: public services can require the front door's stamp`

## WD11 — A database client that survives a pooler

**Goal:** generated code works behind a transaction-mode connection pooler and takes its pool size
from outside.

**Work**

- Nothing the emitted runtime does may depend on a database session lasting beyond one
  transaction. `sweepExpired`'s session advisory lock becomes `pg_try_advisory_xact_lock` inside
  the transaction that deletes. Any other session lock, `LISTEN`, named prepared statement,
  temporary table or session-level `SET` gets the same treatment.
- `statement_timeout` stops being a connection option. Every transaction the runtime opens starts
  with `SET LOCAL statement_timeout`, and a single statement outside a transaction goes through
  the same helper. The client-side `query_timeout` stays.
- Pool size comes from `JEEVES_DB_POOL_MAX`, read once at start: a whole number from 1 to 100,
  defaulting to today's value. An invalid value stops the process at start with a clear message.
  The contract (WD09) lists the name.
- No diagram setting: this is always on.

**Acceptance:** a test scans the emitted runtime and finds none of `pg_advisory_lock(`,
`pg_try_advisory_lock(`, `pg_advisory_unlock(`, `LISTEN ` or a `statement_timeout` connection
option. Two sweepers racing delete each expired row once. The existing mechanism tests pass. In
the integration harness, with a pinned PgBouncer in transaction mode between the processes and
Postgres and two copies running, the RG23 suite's database cases pass. If the harness cannot add
that container, write "pooler run: not run" and the reason in
`docs/plans/wires-and-deployment/evidence/wd11.md` and keep everything else.

**Emitted surface and checks:** the Postgres, transaction and idempotency runtime, startup
validation, the generator README. Standard checks plus the targeted integration run.

**Not included:** providing a pooler, read replicas, per-query pool tuning.

**Commit:** `WD11: generated database access survives a transaction pooler`

## WD12 — A failure drill and one check command in every export

**Goal:** whoever receives an export can prove it survives a failure with one command.

**Work**

- Emit `scripts/drill.mjs`, in the style of the other emitted scripts, and a package script
  `drill`. It brings up the local stack with two copies of every service and worker, then runs
  scenarios taken from the design:
  - for each database, cache and broker: stop it; each process that uses it turns `/readyz` false
    while `/livez` stays true; start it; `/readyz` returns within a stated bound and one ordinary
    request succeeds;
  - for each consumer: deliver one message twice; one effect is recorded.
  It prints one line per scenario (`ok` or `FAILED`, and its name), exits 1 at the first failure
  and always tears the stack down.
- It uses only what an operator has: the health paths, the contract and the generated receipt or
  progress surfaces. Add no test-control route to production code.
- Emit package scripts `check` (lint, types, tests, build) and `check:all` (`check`, then
  `drill`), and one workflow, `.github/workflows/check.yml`, that runs `check` on push and
  `check:all` when started by hand.
- Where RG23's harness already has a helper the drill needs, emit a copy with the export. An
  export never imports from the Jeeves repository.

**Acceptance:** the drill passes on both `rg-*` fixtures. A fixture variant whose hook keeps
`/readyz` true while its database is down makes the drill fail and name that scenario. A design
without a broker emits no broker scenario. After a run, pass or fail, no container is left.

**Emitted surface and checks:** the two scripts, the package scripts, the workflow, the generator
README. Standard checks plus one drill run per fixture.

**Not included:** load tests, faults other than stop and start, anything that needs a cloud
account or a secret.

**Commit:** `WD12: every export ships a failure drill and a check command`

## WD13 — A workload secret that can change without a restart

**Goal:** a rotated workload secret takes effect without restarting the service.

**Work**

- Read the workload-identity runtime first. If it already reads its secret again whenever it asks
  for a new token, change no code: write one line saying so in the handoff and commit only that.
- Otherwise add `JEEVES_WORKLOAD_SECRET_FILE`, a path. When it is set, the file is read each time
  a new token is requested, so a changed secret is used at the next refresh. The existing way of
  giving the secret keeps working. The contract (WD09) lists the new name.
- Do not add provider metadata-server tokens. Say in the contract's identity section that the
  issuer is whatever answers the token and key endpoints.

**Acceptance:** with a fake issuer, changing the file between two token requests makes the second
use the new secret. An unreadable file fails that request the way an issuer error does and does
not stop the process. The existing form is unchanged.

**Emitted surface and checks:** the workload runtime and its settings, the generator README.
Standard checks.

**Not included:** provider-specific identity, key generation, a secrets manager.

**Commit:** `WD13: a workload secret can be rotated from a file`

## WD14 — Final review

As WD08, for WD09–WD13 and for the plan as a whole. Read every handoff entry and the combined
diff since this plan's commit, and anything under `docs/plans/wires-and-deployment/stopped/`.

1. The ledger of rough edges and stopped units, and what became of each.
2. Each unit's Acceptance, checked against a fresh export of one fixture: open
   `deploy/contract.json` and `deploy/README.md` and compare them with the design by hand.
3. Whether Part A's follow-ups in `review.md` were dealt with.
4. Fix a defect only with a test that fails first. Record anything larger in `review.md`. Grow
   no feature.
5. End `review.md` with a short list for the owner: what ran, what stopped and why, and what
   needs a decision.

**Commit:** `WD14: final review of wires and deployment`

## Not in this plan

- Showing in the diagram what hand-written code reaches outside it, and a check that fails the
  build when it does. The owner wants this as a separate plan (2026-11-17).
- A Deployment view in the studio.
- A line that comes back entering a tile's right side (the owner chose today's loop).
