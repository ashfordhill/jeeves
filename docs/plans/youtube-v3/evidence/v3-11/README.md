# V3-11: YouTube v3 designed by mouse

Per the [YouTube v3 plan](../../units.md#v3-11--design-v3-by-mouse) and the
[contract](../../contract.md) §5.

**Result: v3 was fully designed by mouse.** From a blank project: the system name, Watch and
Publish, 21 tiles from link fans, 10 Connect drags, 26 modules from a `+` (23 in their tile's
container in Detailed, Account API's 3 from the inspector's `+`) with the contract's names and
descriptions, 30 module connections by dot drags in Detailed + Connect (Favorites' items and the
loader row to row), the 8 values, then Runnable processes ticked in Generate project. Nothing
needed the API or chat. No step was impossible, no UI defect blocked one, and no fix was made.

- **Spec:** [`e2e/v3-build.spec.ts`](../../../../../jeeves/apps/web/e2e/v3-build.spec.ts), its
  rows in [`e2e/v3-build.ts`](../../../../../jeeves/apps/web/e2e/v3-build.ts) (V3-10's
  `V3_TILES`, `V3_MODULES`, `V3_CONNECTIONS` and `V3_VALUES`, in the fan's and menu's names) and
  the mouse steps shared with the v2 rebuild in
  [`e2e/v2-rebuild.ts`](../../../../../jeeves/apps/web/e2e/v2-rebuild.ts) (`buildTiles`,
  `addModules`, `connectModules`, `setValues`). It builds in `jeeves_e2e` and deletes the project;
  `JEEVES_V3_BUILD_KEEP=<name>` keeps it.
- **Kept project:** **YouTube v3**, ID `e56a3800-d0d6-43df-b6d0-01019c4bae8b`, revision 171, in
  the owner's `jeeves` database ([open](http://127.0.0.1:4300/?project=e56a3800-d0d6-43df-b6d0-01019c4bae8b)).
  Built by the same spec, run through my own API (4452) and Vite (4442) on that database, then
  stopped. The [snapshot](../../../../../field-projects/youtube/v3/notes/README.md) is its design,
  blueprint and both PNG exports.

## Mouse steps and time

**340 gestures**, built in **145 s** by the scripted mouse for the kept project (142 s in the
scratch run, the same 340); the whole test, with Preview and the checks, takes 2.2 min.

| Gesture | Count | What |
| --- | ---: | --- |
| Clicks | 216 | The project menu (4); the user and its `+` for each action (2 + 6); each tile's source and its fan (63); Fit, Connect and Pointer around each tile link (30); Detailed, each module's `+` and kind and its Description field (79); Account API's header and Back twice (3); Fit, Connect, Pointer and Simple around the module connections (4); each value's tile, module card and field (18), Sign-in's select and option (2); the User at the end (1); Generate project, Runnable processes, Preview scaffold and Close (4) |
| Drags | 40 | 10 Connect drags between tiles, 28 dot drags onto tiles, 2 row-to-row drags (the loader, Favorites' items) |
| Typed fields | 84 | Project name, system name, 2 action names, 21 tile names, 26 module names, 26 descriptions, 7 values |

The saved result: 21 tiles, 26 modules (Sign-in Optional on Viewer check, Required on Account
check and Creator check), 30 module links and `generation.processes: true`. Simple draws 24 tiles
(the 21 with the user and its two actions) and **33 lines, 8 dashed**; Detailed 37 lines, with
Watch API's loader arrow and Account API's items arrow.

## Diff and score

- **`v3DiffReport(v3Diff(saved, installed))`: 0 rows**, so 0 unexpected and 0 unused. The mouse
  build equals V3-10's reference by name in every area the diff compares (system, actions,
  entries, tiles and their settings, links, modules, module links, selections, inputs, resources,
  ownership and `generation.processes`). `v3IntendedDifferences` stays empty.
- **`scoreBuild(v3ModuleDesign(installed), saved, installed, V3_VALUES)`: 100**: tiles, links,
  modules, module links and templates each 100.

## Preview

Generate project, by mouse: the Modules list shows 26 (24 Template; View count reader "Video
details cache doesn't use it." and View publisher "Your own logic, with no template." as Stub).
Preview scaffold: **"Ready: 112 files · 5031 KiB ZIP · 13 selected template entries."**, HTTP
200, status `experimental-partial` (9 required gaps: 7 template binding files and the two stubs),
**no findings**, **Processes · 8 · runnable**.

| Selections | Tile |
| --- | --- |
| `verified-identity` ×3 (Sign-in) | Watch API, Account API, Upload API |
| `positive-cache-read`, 2 `module-stub` (View count reader, View publisher) | Watch API |
| `favorites` | Account API |
| `owned-multipart` | Upload API |
| `video-hls` | Transcoder |
| `asset-lifecycle` | Video lifecycle |
| `event-counter` | View counter |
| `search-projection` | Search indexer |
| `search-query` | Search API |

The edge serves `/api/account-api/`, `/api/search-api/`, `/api/upload-api/` and `/api/watch-api/`,
and Video delivery serves `/cdn/video-delivery/` from Transcoded videos. Four HTTP processes and
four workers (loops on `upload-jobs`, `processing-events--video-lifecycle`,
`view-events--view-counter`, `publication-events--search-indexer`). An `export:v2` of the
snapshot's `design.json` in scratch gave the same 112 files, 0 findings, and exactly contract §5's
four product SQL files (Upload state writer and Lifecycle writer on Metadata, Count writer on View
counts, Favorite videos on Favorites).

## Awkward or impossible by mouse, worst first

Nothing was impossible.

1. **The targets a module needs are tiny where both ends are in view.** v3's Detailed fit is 0.20
   at 1440×900 with chat and inspector open (the zoom floor at 1280×800), 0.31 with both rails
   closed (0.27). There a row's dot is drawn 2.4px (3.7px), its grab area 16px wide but only as
   tall as the 32px row pitch allows, about 6px (10px); the container `+` is 5.6px (8.6px). All 26
   `+` clicks and 30 module connections aim at these. The script hits them exactly; a person
   zooms in and relies on the drag's edge pan. This is MA09's first finding, now on a larger design.
2. **Typing is a third of the work:** 84 typed fields, plus 26 clicks into Description. Every new
   tile and module is named after its kind and must be typed over.
3. **Order matters, unannounced.** A guard's Sign-in select and the Options fields appear only
   once the module's connections derive its template, so all 8 values come after all 30
   connections; Runnable processes is in the Generate project dialog, not on the design.
4. **Tile links cost a mode switch each.** The fan's tabs hide in Connect mode, so a link between
   tile adds is Fit, Connect, drag, Pointer: 40 gestures for 10 links. A person would batch the
   links after the tiles; the contract's order interleaves them.
5. **The inspector's `+` costs a Back per module** (the module page replaces the tile page), and
   selecting a container in Detailed needs its header, since its middle is a module row.
6. **Seen, not blocking:** Preview logs a React console error, "Encountered two children with the
   same key", keyed `["architecture","studio","elements",11,"settings","language"]`. The resolver
   records Sign-in's local Keycloak substitution once per guard (`localAdapterTreatments`, 3
   identical rows in `report.json`), and `V2GenerationDetails.tsx` keys "Local adapter limits" by
   source path. V3-12's export would carry the three rows.
7. **Seen, not blocking:** at 100% the selected container's X sits on its top edge over the end
   of its name ("Watch API" in the screenshot below).

For the script only: Sign-in is a native select whose list is drawn outside the page, so the spec
picks Optional with Playwright's `selectOption` (counted as the person's two clicks).

## Screenshots (kept project, 1440×900)

- [Detailed](detailed-1440.png), rails closed, at the fit (0.31).
- [Simple](simple-1440.png), rails closed, at the fit (0.38): 21 tiles, 33 lines, 8 dashed.
- [Watch API at 100%](watch-api-100-1440.png) in Detailed, Viewer check open: Template ·
  Sign-in, Optional.
- [Generate project](generate-preview-1440.png) after Preview: Runnable processes ticked, Ready,
  Processes · 8 · runnable.

## The owner's other projects

Read through the owner's API (4310) before and after; revision and `updatedAt` unchanged. The
spec's project-menu helper first opens the most recently updated project that isn't an E2E one
(Marketplace) and only views it.

| Project | Revision |
| --- | ---: |
| Marketplace · studio study | 3 |
| YouTube · field v2 · local Docker | 8 |
| YouTube v2 rebuild (MA09) | 142 |
| TinyURL · studio study | 55 |
| untitled | 4 |
| YouTube · field v1 · local Docker | 6 |
| YouTube · studio study | 2 |
