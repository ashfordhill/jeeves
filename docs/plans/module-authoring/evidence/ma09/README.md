# MA09: YouTube v2 rebuilt from scratch by mouse

Per the [module authoring plan](../../units.md#ma09--rebuild-youtube-v2-from-scratch-acceptance)
and the approved [contract](../../contract.md) (§3, question 2's Upload API → Identity and
question 3's loader arrow).

**Result: v2 can be rebuilt by mouse.** Every tile, link, module and module connection, and the
useful values, were made from a blank project with clicks, drags and typing alone. The structural
diff finds only the contract's intended differences. Preview selects v2's seven installed
templates, has no findings, and the two stubs cover the rest. One fan defect blocked a step and
was fixed (below).

- **Spec:** [`v2-rebuild.spec.ts`](../../../../../jeeves/apps/web/e2e/v2-rebuild.spec.ts), with its
  steps and helpers in [`v2-rebuild.ts`](../../../../../jeeves/apps/web/e2e/v2-rebuild.ts). It
  builds in `jeeves_e2e` and deletes the project; `JEEVES_V2_REBUILD_KEEP=<name>` keeps it.
- **Diff helper:** [`fixtures/v2-diff.ts`](../../../../../jeeves/packages/spec/src/fixtures/v2-diff.ts),
  with [its tests](../../../../../jeeves/packages/spec/src/fixtures/v2-diff.test.ts).
- **Kept project:** **YouTube v2 rebuild (MA09)**, ID `9dcb10a3-bb0b-4a5b-b055-b7610ddc1e1a`,
  revision 142, in the owner's `jeeves` database ([open](http://127.0.0.1:4300/?project=9dcb10a3-bb0b-4a5b-b055-b7610ddc1e1a)).
  It was built by the same spec, run by my own API (4340) and Vite (4330) on that database.

## Mouse steps and time

262 gestures, built in 96 s by the scripted mouse for the kept project; the whole test, with the
diff and Preview, takes about 1.5 min (the same in scratch and `jeeves_e2e` runs). Generate
project and Preview add 2 clicks.

| Gesture | Count | What |
| --- | ---: | --- |
| Drags | 74 | 2 action picks from the user's `+`, 19 tile picks from link fans, 7 Connect drags between tiles, 22 module picks from `+` fans, 24 drags from row dots (23 to tiles, 1 loader row to row) |
| Typed fields | 74 | project name, system name, 2 action names, 19 tile names, 22 module names, 22 descriptions, 7 values |
| Clicks | 114 | selecting the source tile before each pull, Description and value fields, module cards, and the toolbar (Fit, Connect, Select, Detailed, Overview) |

The result: 22 tiles (user, 2 actions, 19), 28 lines in the Overview (v2's 27 plus Upload API →
Identity) and 31 in Detailed; 22 rows, the 21 that can connect all filled, and one loader arrow.

## Structural diff

163 rows, **0 unexpected**, and every intended rule is used. Compared by tile, link and module
name: system, actions, entries, tile kinds and settings, links (endpoints, kind, interaction,
protocol, security, channel use), module kinds per tile, module links (with the link they go
through), resolved selections (template ref, tile, binding by names, identity, policies), their
inputs and resources, and ownership (owners by their members).

| Rows | Area | Intended because |
| ---: | --- | --- |
| 19 + 1 | tile and system description | The plan rewrites module text only; new tiles have none. |
| 21 | link label | A new link takes its pair's default label. |
| 4 | module name | Owner decision 7: Video details cache, Video details reader, Video publication publisher and consumer. |
| 21 | module description | The plan's table (View count reader's is unchanged). |
| 8 | module kind | Contract §3's kind changes (each lead, the packager and thumbnailer). |
| 1 + 1 | link, module link | Question 2: Upload API → Identity and Creator check → Identity. |
| 1 | module link | §4: the loader, Video details cache → Video details reader. |
| 20 | tile setting | Replicas, read replicas, eviction and topology: fixed values left to the descriptor. |
| 3 | tile setting | Local video edge's provider, origin and image resizing: no template reads them. |
| 16 | module setting | View count reader's pool and timeout (a stub shows none); mirror and fixed values; the Lifecycle writer has no read routing. |
| 3 + 11 + 2 | selection, input, resource | The `youtube-*` product templates are not offered. |
| 2 | selection | The two stubs: View count reader and View publisher. |
| 21 | selection input | v2's declared fixed values, left to the descriptor (MA08's equivalence test). |
| 1 | generation | No preset. |
| 5 | owner | Owner IDs and names are derived; members match. |
| 1 + 1 | grant, dependency | Watch API's read of View counts, which only `youtube-watch` needed. |

Everything else is equal by name: all 19 tile kinds, all 20 of v2's links with their direction
and interaction, the 5 entries, all 22 module kinds, the 22 v2 module links, the 7 templates'
bindings and their other inputs (v2's 7 useful values included), resource access and boundaries,
roles and resource authority.

## Preview

Generate project → Preview scaffold, by mouse: "Ready: 77 files · 3215 KiB ZIP · 9 selected
template entries", status `experimental-partial`, **no findings** (so no `CONFIG_REQUIRED`).
Templates: `positive-cache-read`, `event-counter`, `search-query`, `owned-multipart`,
`video-hls`, `asset-lifecycle` and `search-projection`, the same refs as v2's seven; plus two
`module-stub` entries. The Modules list shows 22 rows: 20 Template, and View count reader ("Video
details cache doesn't use it.") and View publisher ("Needs Multipart uploads in its tile.") as Stub.

## Awkward or impossible by mouse, worst first

Nothing was impossible once the fan defect was fixed.

1. **Connection dots are tiny where both ends are visible.** A connect drag doesn't pan the
   canvas, so both ends must be on screen, which means about the fit. There, v2's Detailed is at
   0.21 with both rails open: a dot is 2.5px across (its hit area about 6px). With both rails
   closed it is 0.37: 4.5px (about 10px). All 24 module connections are such drags; the farthest
   (Upload API and Video lifecycle worker rows to Metadata database) cross most of the canvas.
2. **Fixed: a greyed kind's tip blocked the kind below it.** The tip hangs under its item and took
   the pointer, so moving straight down from Queue or topic onto CDN in an action's fan kept the
   queue hovered and the release picked nothing. That made the Local video edge unaddable by the
   natural path. The tip now lets the pointer through (`board.css`), tested in `spawn.spec.ts`.
3. **Generated names follow the creation kind, not the name typed.** IDs are fixed when a tile
   or module is added, so the rebuild's are `microservice`, `microservice-2`, `uploads`,
   `worker-service-3`, `microservice-data-access-2`. They reach the output: the stubs are
   `src/modules/microservice/microservice-data-access-2.ts`, and local identities use them, where
   v2's read `watch` and `completion-handler`. Not a mouse step, but a v3 built by mouse inherits it.
4. **Typing is most of the work:** 74 typed fields of 262 gestures. Each module needs its Name,
   then a click into Description.
5. **Order matters, unannounced.** A tile's Options appear only once a template derives its
   initial values, so v2's values could only be typed after the modules were connected. Module
   connections need Detailed + Connect; tile links work in either view.
6. **A misleading stub reason:** View publisher reads "Needs Multipart uploads in its tile." (MA08
   flagged it for MA10).

## Screenshots (kept project, 1440×900)

- [Overview](overview-1440.png), rails closed, at the fit (0.43).
- [Detailed](detailed-1440.png), rails closed, at the fit (0.37).
- [Transcoder at 100%](transcoder-100-1440.png) in Detailed: its five rows, filled dots, Upload
  API's four rows beside it.
- [Generate project](generate-modules-1440.png) after Preview: the Modules list.

## The owner's other projects

Read through the owner's API (4310) before and after; revision and `updatedAt` unchanged:

| Project | Revision |
| --- | ---: |
| YouTube · field v2 · local Docker (`2c7c8b08…`, the frozen v2 project) | 4 |
| TinyURL · studio study | 55 |
| untitled | 4 |
| YouTube · field v1 · local Docker | 6 |
| YouTube · studio study | 2 |
| Marketplace · studio study | 1 |

The frozen v2 project was at revision 4 before this unit (its README records revision 2). The
spec's project-menu helper first opens the most recently updated project that isn't an E2E one,
which in the owner's database was this one: it was viewed, read-only, for a moment and not
changed.
