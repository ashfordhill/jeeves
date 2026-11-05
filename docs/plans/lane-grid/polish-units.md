# Lane grid polish units

**Status:** PL01 complete (2026-11-05); PL02 next. Each unit's record is in the
[handoff](../../handoff.md).

Follow-ups to the completed [lane-grid plan](../../build-plan-lane-grid.md), proposed 2026-11-05
from the LG13 acceptance findings and the owner's answers. There are two sequential units,
PL01 → PL02. A fresh agent runs one at a time on primary `main`. The
[rules for every unit](execution-units.md#rules-for-every-unit) apply. Commit as `PLnn: <summary>`.

## PL01 — Canvas polish

LG13 found the canvas usable but rough in five places (studio guide, Limits). Fix them without
changing the layout options or the data model.

**Read:** the LG07, LG09, LG10 and LG13 handoff entries; `packages/board/src/react/Board.tsx`,
`camera.ts`, `TileChrome.tsx`, `fan.ts`, `BoardLine.tsx`; `apps/web/src/canvas/Workspace.tsx`,
`creation.tsx`, `removal.tsx`, `canvas.css`. In automation-illustrator, read
`src/app/components/RemovePickerHud.tsx` and its `.remove-picker-hud` rule in
`src/app/styles/tokens.css`. It is a bottom-centre HUD.

**Do:**

1. **Camera follows the canvas.** The board remembers whether the current camera came from a fit
   (first layout or the Fit button) or from the user (pan or zoom). When the board's size changes,
   for example when a rail or the inspector opens or closes, it refits if the camera came from a
   fit. A user-set camera is left alone. After a spawn, if the new tile lands outside the view, pan
   just enough to bring it in, without zooming.
2. **A merge keeps the source selected.** Dropping on an existing tile links it and leaves the
   source tile selected, so the next fork or merge needs no click back. A spawn still selects the
   new tile and focuses its Name, as in automation-illustrator.
3. **Selection shows who reaches what.** Draw the selected line last (on top) in the selection
   colour. When a tile is selected, its incoming and outgoing lines use the selection colour at the
   normal width, so a tile's own lines stand out from the shared bus. Place a selected line's X on
   a stretch of that line that no other line shares, if it has one.
4. **The fan stays inside the canvas.** Clamp the fan's items to the board's on-screen rect, with
   a 16px margin, so they never cover the rails or the header. If clamping puts an item on top of
   a tile that accepts a drop, nudge it off that tile.
5. **The removal panel becomes a HUD.** Move the "Remove N tiles" panel from under the tile to a
   bottom-centre HUD over the canvas, as automation-illustrator's `.remove-picker-hud` does. The
   ringed tiles and the Cancel/Escape/paper-click behaviour stay.

Not in scope: the fan's default kinds. Gateway and a plain service are the right defaults for most
designs; TinyURL's CDN and Redirect service are exceptions you change in the kind row. Also not in
scope: layout or ELK option changes, and tab sizes at low zoom.

**Tests:** one board unit test for the fit/user camera rule if it is pure; otherwise none. In E2E,
extend `spawn.spec.ts` so that after a merge the source tile is still selected.
**Browser:** the LG13 walkthrough again (TinyURL from Blank, both window sizes, rails open and
closed). Record whether each of the five items is fixed, and the new drag and click count.
**Docs:** remove the fixed items from the studio guide's Limits and describe the new behaviour.
**Commit:** `PL01: canvas polish (camera follows the canvas, merge keeps the source, link highlight, fan and removal HUD placement)`

## PL02 — One entry tile for both lanes

Owner, 2026-11-05: when one API handles both reads and writes and is where the user's actions
first land, draw a single line from the user to that tile, and let the lanes branch from it.

**Read:** the LG04, LG05, LG09 and LG12 handoff entries; `packages/spec/src/studio-model.ts`
(entries), `studio-lanes.ts`, `studio-links.ts`, `studio-lane-commands.ts`, `studio-blueprint.ts`;
`apps/web/src/canvas/LaneCanvas.tsx`, `creation.tsx`, the entry inspector in `Workspace.tsx`;
`apps/server/src/chat/tools.ts`.

**Do:**

1. **Model.** An entry's `lane` may be `"both"`: one link from the user, counting toward both
   lanes' caps. An element still has at most one entry.
2. **Lane order.** Download-only entries come first, then both-lane entries, then upload-only, so
   a shared entry sits between the lanes. Breadth-first order follows the same sequence.
3. **Canvas.** A both-lane entry line's chip shows the download and upload icons side by side. Size
   the chip for ELK accordingly.
4. **Mouse.**
   - Dragging the user's other lane `+` onto a tile that already starts one lane turns that entry
     into `both`, as one undo step. The refusal "a tile can start only one lane" goes away.
   - The entry inspector gets three icon buttons (download, upload, both) that set the entry's
     lane. A choice that would break a cap is disabled, with the reason in its title.
5. **Commands.**
   - `linkTiles` from a lane onto the other lane's entry tile upgrades it to `both`.
   - A new `setEntryLane { entry, lane }` command changes an entry's lane.
   - `removeLink` on a both-lane entry removes the whole entry, refused if anything would be
     stranded.
   - Chat gets `setEntryLane`, and `getDesign` and the instructions describe shared entries.
6. **Blueprint.** A both-lane entry is listed once per lane (two rows), so the blueprint's shape is
   unchanged.
7. **Not in scope.** Tagging links after the shared tile as read or write. They are ordinary
   forks; whether they need lane tags is a later owner decision.

**Tests (about 4):** upgrade by `linkTiles`; `setEntryLane` and the caps; lane order with a shared
entry; two blueprint rows. In E2E, drag the user's upload `+` onto CDN: one entry line with both
icons, and Undo restores two lanes.
**Docs:** the studio guide (entries, Limits: remove the open question), CATALOG, the blueprint doc,
PLAN, and `fixtures/chat/README.md` if the fixture changes.
**Commit:** `PL02: one entry tile can start both lanes`
