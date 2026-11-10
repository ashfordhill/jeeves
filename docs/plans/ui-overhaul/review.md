# UI overhaul: independent review (UI10)

Reviewed 2026-11-09 against the owner's three images
([module sketch](../../human-feedback/2026-11-08-module-detail-sketch.png),
[old inspector](../../human-feedback/2026-11-08-inspector-current.png),
[inspector sketch](../../human-feedback/2026-11-08-inspector-sketch.png)) and the
[plan](units.md). Commits `c03f45c` (UI01) to `73bd4a8` (UI09), then `UI10: review UI overhaul`.

How: my own API (port 4331, its own database) with Vite on 4321, and scripted Chromium using only
mouse clicks, drags and the wheel (keys only to type text). Windows 1440×900 and 1280×800. Designs:
TinyURL extended, Marketplace, YouTube, and a project seeded from
`field-projects/youtube/v2/inputs/design.json`. Afterwards I dropped the scratch database with every
project I made. The owner's `jeeves` database was not used.

## The owner's requests

| # | Request | Verdict | What I saw |
| --- | --- | --- | --- |
| R1 | Detailed view: modules in their tiles, each module's lines on its row | **Delivered**; layout differs from the sketch where a store is upstream | **Overview \| Detailed** in the toolbar. Containers and rows: TinyURL 4/9, Marketplace 7/16, YouTube 7/20, v2 7/22; lines 12, 25, 26, 30. v2's Video lifecycle worker has the sketch's three rows and four lines, each reaching its row. The Metadata database sits up and to the left, so both of its lines loop round the worker (follow-up 1). Rows read only from about 0.6 zoom (follow-up 2). Switching back gives the Overview's exact tiles and lines. |
| R2 | No tabs; one page: name and details, Description, Options, Modules | **Delivered** | No tablist on tile, module or system pages in any design or size. Order: header (icon, Name as the title, kind), Description, Options, Modules. Options checked on Asset upload API after attaching the supported feature: Request timeout and Concurrency limit. |
| R3 | Goal → Description, taller box | **Delivered** | "Description" for the system, tiles and modules; no "Goal" or "Purpose" in the inspector. It starts at 6 rows (137px), grew to 278px as I typed (the cap is half the rail, 354px), autosaved, and one Undo restored it. |
| R4 | Module cards at the bottom; click opens, Back returns | **Delivered** | Cards show the icon, name, kind and two lines of description. A card opens the module page with **Back to <tile>**, Name, kind, Description and Remove module. Back returns with Modules in view and the card focused. In Detailed a row opens the same page and marks the row, its own lines and its partners' rows. |
| R5 | No connections in words | **Delivered** | No Connections list or Unlink on tile, module or action pages; the line inspectors remain. |
| R6 | Remove Focus relationships | **Delivered** | No Focus relationships, Fit focus, Show all or Relationship focus in the app or the source. Selecting a tile turns its lines blue; clicking paper clears them. |

## Invariants

| Invariant | Result |
| --- | --- |
| Overview export of the YouTube study is unchanged | **Holds, checked independently.** HEAD's PNG hashes `472a4c8c…dc9f` (twice; again after this unit's fixes). I exported the same study from a `git archive` copy of `091488e`, run by its own Vite: **byte-identical PNG**. The capture details differ only by UI01's documented change, `view.relationships` losing "; focus omitted". |
| Layouts with no named ports are unchanged since before UI04 | **Holds.** A scratch dump with real ELK of five designs (TinyURL foundation, TinyURL extended, Marketplace, YouTube, v2) covered the banded layout, the relayout from shown positions, the flat layout, `graphKey` and `buildElkGraph`. It is byte-identical at `091488e` and HEAD (sha256 `41e22a70…`). `elkGraph.golden.json` passes. |
| Views, selection and modules never change the design | **Holds.** After every mouse sequence on 4 designs × 2 sizes (select, open a card, Back, paper, Detailed, open a row, Back, click a module line, back to Overview), the design JSON, revision and blueprint were identical. The e2e tests also assert this. |
| Mouse only | **Holds.** Every check above used the mouse and wheel; pull tabs, attach and drop, and the line X all work by mouse in Detailed. |

## Fixes made in this unit

1. **Choose relationship lists each relationship once.** In Detailed, two drawn lines of one
   relationship (Packager's and Thumbnailer's into Transcoded videos) appeared as two entries.
   Now a board line can have a generic `group`, and the Detailed view sets it to the relationship.
   Where only one relationship's lines meet, a click selects it directly. Where the CDN's line
   joins them, the chooser offers two entries. Tests: a board unit test (which fails without the
   fix) and a new e2e on YouTube. Detailed capture details now also carry `group` on each drawn
   line; the Overview is unaffected.
   [Before/after](evidence/ui10/1440-chooser-before-after.png)
2. **Port marks follow their line's colour, whatever selected it.** Before, they turned blue only
   when their own container or open module was selected. Selecting the Metadata database or a
   relationship left them dark beside blue lines. Now `drawnSelection` returns the `lit` ports, and
   rows mark them with `data-lit`; the old `data-open` rule is gone. Tests: `selection.test.ts`
   (v2 database, relationship, other end), `ContainerTile.test.tsx` and the new e2e.
   [Before/after](evidence/ui10/1440-v2-port-marks-before-after.png)
3. **The canvas toolbar stays on one row.** UI07's view switch made the toolbar wrap onto two rows
   at 1280×800 with the chat open (the default) and at 1440×900 with both rails open. The cause
   was that `left: 50%` limited it to half the canvas. It now has `width: max-content`. The e2e
   checks one row with both rails open. [Before/after](evidence/ui10/1280-toolbar-before-after.png)
4. **The `operations.spec.ts` flake was a test race.** After a tile removal, `ready` is true as
   soon as ELK lands, but the layout animates for 200ms. `upload-shorten` moved 92 board px in
   about 160ms after `ready`. `clickLine` read a point once and clicked it later. Adding 80ms
   between the read and the click (as under load), the old helper missed 6 of 6 tries. `clickLine`
   now waits until the route and camera stop moving; the same run hit 6 of 6. The spec then passed
   6 of 6 (`--repeat-each 3`) and in the full run.
5. Docs: `studio.md` (Detailed view: the chooser and port marks; the chooser limit removed; chat
   wording), `studio-settings.md` and `CATALOG.md` ("purpose"/"goal" → description, matching the
   inspector).

Investigated and kept:

- **Container tab peek 36px.** A real Attach pull and drop from the Transcoder at 100% worked
  (onto Metadata database: 26 → 27 lines, Undo 26). So did Add after → Cache. At 36px no tab
  overlaps a row; at the board's 18px each of the three tabs covered the ends of two rows. The tabs cover
  the start of the selected container's own lines, and only while it is selected.
- **Solid port marks on dashed lines.** A mark is a 10px stub. A dash period is 15px (8 on, 7 off),
  so the stub already reads as the line's last dash.
- **Hand-pan swallows a click.** This predates the plan and is not specific to Hand mode. Only a
  click within 50ms of releasing a pan is lost: in each mode, 5 of 5 at 0ms and 0 of 20 at
  50–1000ms. A click right after the pan is lost at `091488e` too. That is d3's guard against the click that ends a drag. No person clicks
  that fast; scripts should wait a frame after a pan.

## Follow-ups, most important first

| # | Issue | Suggested next step | Owner decision? |
| --- | --- | --- | --- |
| 1 | Lines to an upstream store loop round their container. v2's writer and outbox lines to the Metadata database are 1,280 and 1,312px, where the sketch has two short lines to the right. | Decide whether a store written by module rows may sit after the container in Detailed, or whether containers may take store lines on their left side. Either changes a layout rule; it can be limited to named ports so the Overview stays byte-identical. | **Yes**: a layout rule. |
| 2 | At the fit, row names are 3–5px; they read from about 0.6 zoom. | Accept zooming in to read rows, or ask for a way to zoom to one container (for example, from its header). That would be a new feature. | **Yes** |
| 3 | Two rows into one store cross each other (Transcoder's Packager and Thumbnailer into Transcoded videos; twice in v2). This is UI05's limit on two returns. | A widening rule in `returns.ts` that adds the second slot on the target side, limited to named ports, gated by the byte-identity dump. | **Yes**: a layout rule. |
| 4 | A selected container's red X sits on its header, over the middle of a long name ("Video lifecycle worker"). | Move a container's X to the header's right end or fully above the frame (app CSS, as the tab peek does). | Yes, small: where the X goes. |
| 5 | Generator v2 tests take 1.8–3.0s each alone (PGlite), so under load (about 14) a few passed the 5s default. | Set `testTimeout` (for example 15s) in `jeeves-generator/vitest.config.ts`. Outside this plan. | No |
| 6 | Dead code from before this plan: `OperationsForm.tsx` and `OwnershipForm.tsx` have had no importer since YV2-18, and the `.studio-inspector-tabs` CSS serves only them. Nine CSS classes from YV2-17/18 are unused (`lane-kind-*`, `lane-owner*`, `studio-component-meta`, …). | Delete them in a small cleanup unit, after confirming no plan reuses them. The UI overhaul's own removals left no dead code or CSS. | No |
| 7 | "Generate project" uses a larger font than the other toolbar buttons (this predates the plan). | Give it the toolbar's button font. | No |

## Evidence

- [1440-chooser-before-after.png](evidence/ui10/1440-chooser-before-after.png): Choose relationship
  where three drawn lines (two relationships) meet.
- [1440-v2-port-marks-before-after.png](evidence/ui10/1440-v2-port-marks-before-after.png): v2's
  Video lifecycle worker at 100% with the Metadata database selected.
- [1280-toolbar-before-after.png](evidence/ui10/1280-toolbar-before-after.png): the toolbar at
  1280×800 with the chat open.
- [1280-youtube-packager-open.png](evidence/ui10/1280-youtube-packager-open.png): Detailed, both
  rails open, Packager opened from its row. It shows R1, R2 and R4 together: the open row, its
  partners, its one blue line and the module page.
- Earlier units: [ui09](evidence/ui09/README.md), ui01–ui08 under [evidence](evidence/).
