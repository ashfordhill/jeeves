# SG10 — Combined acceptance of the studio grid plan

Captured 2026-11-04 on primary `main` at `211ac91` (after SG09), with a temporary Vite dev server
on 4302 from this checkout proxying the running API on 4310. Node 24.21.0, Playwright 1.63.0,
Chromium. The plan is [build-plan-studio-grid.md](../../../build-plan-studio-grid.md); its units are
in [execution-units.md](../../../plans/studio-grid/execution-units.md).

**Verdict: the plan is complete.** Seven owner decisions are met. O8 is partly met: lines and
islands are done, but stacked labels and small C3 labels at Fit remain. Plan §4 is partly met for
the same reasons. No defect was found in the walkthrough, so SG10 changes no product code.

## Method

- `capture.mjs` runs at 1440×900 and 1280×800. Each size gets one disposable TinyURL project,
  created through **New project → Architecture study** with the chat collapsed. The script
  captures C1/C2/C3 at Fit, then runs the walkthrough below with the real mouse.
- Every request that is not GET/HEAD/OPTIONS and names an owner project is aborted. None was
  attempted (`blocked: []`). The four owner projects have the same `updatedAt` and revision after
  the run as before it, and the project count was restored.
- Both disposable projects were deleted (204). `capture-log.json` holds every observation, and
  `blueprint-after-walkthrough.json` is the blueprint GET result at 1440×900.
- `compare.mjs` builds the half-scale comparison sheets.

## Walkthrough (both sizes, identical outcomes)

| Step | Observation |
| --- | --- |
| Open, tabs, Fit | C1/C2/C3 tabs only, with no back button or breadcrumb. **No write** on open, tab switch or Fit (`writesOnOpenTabsFit: []`). |
| Selection by identity | Redirect service selected at C2 stays selected at C3 (as its frame) and back at C2. |
| Merged-line chooser | The C2 label `2 calls · HTTPS` (Shorten API → URL reputation API) opens "Connection members" with both members. Picking one opens its connection form. |
| Row reorder | Dragging Links database above Link cache in its column makes **one** `PUT …/layout`. Undo restores the rows and Redo reapplies them. After a reload the order persists, with `positions: {}` and `order` beginning `links-db, link-cache`. |
| Spawn via `+` | Pulling Shorten API's east handle shows the dashed preview. The picker lists 12 C2 kinds, and choosing Search index creates box + line (12→13 boxes, 11→12 lines) with the connection form open. Undo removes both in one step, and Redo restores them. |
| Drop-to-connect | Dropping Analytics worker's east handle on Search index opens **Connect** prefilled (Analytics worker · worker → Search index · search). Connect adds the line (13 lines). |
| Component autosave | At C3, Link writer → Options → Pool size 32 autosaves (design shows 32). Undo gives 20, and Redo gives 32 again. |
| Reload | 13 boxes / 13 lines at C2, Search index present, the reordered rows kept and Pool size 32. |
| Blueprint GET | `GET /api/projects/:id/blueprint` returns 200 with `no-store` and `blueprint: 1`. It lists 4 services (Shorten API 4, Redirect service 4, Analytics worker 3, Web app 0 components), 6 resources (including the new Search index), 1 external, 12 connections, 15 component links, Link writer `poolSize: 32` and `omitted: []`. It has no layout, position, viewport or history keys. |

No page errors were raised.

Screenshots (1440×900):

- [merged-line chooser](screenshots/1440x900-walk-merged-chooser.png)
- [reordered rows](screenshots/1440x900-walk-reordered.png)
- [spawned box](screenshots/1440x900-walk-spawned.png)
- [drop form](screenshots/1440x900-walk-drop-form.png)
- [component autosave](screenshots/1440x900-walk-component-autosaved.png)
- [C2 after reload](screenshots/1440x900-walk-reloaded-C2.png)

## Baseline vs final

Each sheet puts three columns side by side: the SG01 baseline for Mattermost, the SG01 baseline
for Streamly, and the final TinyURL. The rows are C1, C2 and C3, and every shot is at Fit. The
baseline C3 is a per-service scope (Mattermost server, Platform API). The final C3 is the whole
system. The baseline was captured with the chat open, as the studio opened then. The final is
captured with the chat collapsed.

- [compare-1440x900.png](screenshots/compare-1440x900.png)
- [compare-1280x800.png](screenshots/compare-1280x800.png)
- Final single shots: `screenshots/<size>-final-{C1,C2,C3}-fit.png`.
- Baseline: [SG01 screenshots](../SG01/README.md).

What changed visibly:

- The detour lanes and stacked parallel lines are gone.
- Truncated sentence labels became short `verb · protocol` labels.
- The collapsed package card became the open "Link platform" frame.
- C3 is components inside service frames instead of neighbouring containers.
- The placement toolbar and "Tidy and fit" are replaced by New island and Fit.

### Fit-zoom history (TinyURL, chat collapsed)

| Unit | 1440×900 C1 / C2 / C3 | 1280×800 C1 / C2 / C3 | Source |
| --- | --- | --- | --- |
| SG05 (old layering, chat open) | — / — / ≈0.30 | — | [SG05 handoff note](../SG05/README.md) |
| SG06 (ELK) | 1.00 / 0.763 / 0.453 | 1.00 / 0.675 / 0.401 | [SG06](../SG06/README.md) |
| SG07 (merged lines, short/stacked labels) | 1.00 / 0.853 / 0.544 | 1.00 / 0.755 / 0.481 | [SG07](../SG07/README.md) |
| **SG10 final** | **1.00 / 0.853 / 0.544** | **1.00 / 0.755 / 0.481** | `capture-log.json` |

SG08 and SG09 did not change the fit zoom. Streamly (owner project, read-only) went from C2
0.572 / C3 0.620 in SG06 to C2 0.624 / C3 0.608 in SG07.

## Owner decisions

| # | Decision | Verdict | Evidence |
| --- | --- | --- | --- |
| O1 | Equal C1/C2/C3 tabs, whole-system C3, no drill-down | **Met** | [SG05](../SG05/README.md); walkthrough (tabs only, no back or breadcrumb, selection carried) |
| O2 | Fully automatic layout, no saved positions | **Met** | [SG06](../SG06/README.md); no writes on open/tabs/Fit; saved `positions: {}`. The only stored input is the row-order hint the plan allows. |
| O3 | No free placement; create from a box's handle | **Met, with deviations** | [SG08](../SG08/README.md), [SG09](../SG09/README.md); spawn and drop in the walkthrough. Deviations: Library inserts and the Connection tool remain non-handle paths; people, the system and package frames have no handles at C2. |
| O4 | One merged line per pair and direction, with a count | **Met** | [SG07](../SG07/README.md); `2 calls · HTTPS` chooser in the walkthrough |
| O5 | Generic services incl. gateway; performance settings; third-party first | **Met** | [SG02](../SG02/README.md), [SG03](../SG03/README.md) (gateway), [SG09](../SG09/README.md) (every form); 12 C2 spawn kinds |
| O6 | TinyURL replaces all fourteen studies | **Met** | [SG04](../SG04/README.md); chooser offers TinyURL only |
| O7 | Read-only API for code generation; generator separate | **Met** | [SG03](../SG03/README.md), [studio blueprint](../../../studio-blueprint.md); blueprint GET in the walkthrough |
| O8 | Thicker lines, short labels with intent, islands allowed | **Partly met** | [SG07](../SG07/README.md), [SG08](../SG08/README.md). Met: 2px/3px non-scaling strokes, short labels, New island. Open: labels over 96px stack on two lines, and C3 labels at Fit are about 6px on screen. |
| O9 | V/H shortcuts | **Met** | commit `4927583`; re-checked in [SG08](../SG08/README.md) |

Open decisions D1 (adopt §3), D2 (keep the Resource workspace, QR Studio and Blank starters) and
D3 (queues C3-only) took their defaults.

## Plan sections

| Section | Verdict | Notes |
| --- | --- | --- |
| §3 Levels | **Met** | A C2 box is one deployable; a package is an open group frame; a C3 component is a finite-catalog module inside its service frame; custom carries a purpose. ([SG05](../SG05/README.md), [SG09](../SG09/README.md)) |
| §4 Canvas | **Partly met** | Met: ELK layered RIGHT, 32px grid, compound frames, packed islands, deterministic layout, row-order hints, handle creation with picker, drop-to-connect, New island, merged lines with count and chooser, 2px/3px strokes, tabs, selection by identity. Deviations: spacing 32/16 between layers (not 64/32, [SG06](../SG06/README.md)); two-line stacked labels; C3 Fit 0.544 (below the 0.55 SG06 aimed for) and small labels. The label threshold was lowered to 0.45, so labels do show at Fit. |
| §5 Components and performance | **Met** | All ten component kinds and every service/resource field have forms and autosave ([SG09](../SG09/README.md)). Template availability is unchanged (none); they are design intent. |
| §6 Blueprint API | **Met** | `blueprint: 1`, Zod + JSON Schema, pure function, server route ([SG03](../SG03/README.md)); live result in `blueprint-after-walkthrough.json`. |
| §7 TinyURL study | **Met** | C1 has 4 boxes and 3 lines. C2 has 9 deployables/resources, the URL reputation external, 2 people, the Link platform frame and **11 lines** (under 12). C3 has 11 components. The plan's "roughly 8 C2 boxes" counts deployables and resources only. ([SG04](../SG04/README.md)) |
| §8 Removals | **Met in product** | The fourteen studies; placement tools, Tidy, free drag, landing search and saved positions; drill, detail scopes, breadcrumb and back; the collapsed package card; router fallback lanes. All are gone ([SG04](../SG04/README.md)–[SG08](../SG08/README.md)). Tests that refer to them are not updated (deferred, see follow-ups). |

## Known limits and owner follow-ups

These are collected from the SG01–SG09 handoffs and this run. None blocks the plan's completion.

1. **C3 fit zoom.** C3 fits at 0.544 at 1440×900 (0.481 at 1280×800), against the 0.55 SG06
   aimed for. Labels at Fit are about 6–7px on screen. Possible levers:
   - narrower component cards (192 → 160, about +0.04)
   - a vertical wrap of the long chain
   - a 16px fit margin
   - screen-constant label text, which would conflict with deterministic layout
2. **Stacked labels.** Labels over about 96px use two lines (verb above, protocol below). This
   deviates from the plan's one-line `verb · protocol` form; the text is the same. Owner choice:
   accept, or restore one line at a width cost.
3. **TinyURL's only merged line is model duplication.** "Checks destinations" (the C2 connection)
   and "Checks destination reputation" (the C1 context relationship bound to the same container)
   merge into `2 calls · HTTPS`. Remove or relabel the C1 relationship in the study if the owner
   wants that line single.
4. **Components are not copied by reuse.** Library fragment copy (`architecture-library.ts`) and
   pattern insertion do not carry components or component links (SG02 gap).
5. **Handle coverage.** At C2, people, the C1 system and package frames have no `+` handles;
   dropping on a package gives a notice. At C3 a resource's handles often offer no new kind.
6. **No row hint for spawned boxes.** A spawned box takes ELK's position, and no `order` entry is
   written.
7. **Outdated E2E tests (deferred by the owner).** Tests that use Tidy and fit, free drag, saved
   positions, placement tool buttons with click-to-place, double-click drill or breadcrumb, trunk
   or branch path markers (`data-path-kind`) or React Flow arrow markers need updating. No unit
   ran `pnpm check` or the unit/E2E suites.
8. **Blueprint versioning.** Adding a kind or enum value is treated as additive within
   `blueprint: 1`, and a generator must reject what it does not understand. The owner should
   confirm this, or require a version bump for new kinds, before a generator exists.
9. **Owner Mattermost project.** It has a stray unconnected "Microservice" card at C2 and a
   disconnected "Team member" at C1 (owner data, left untouched since SG01). The owner's four
   projects are pre-studio documents, so their blueprints are nearly empty (`no-studio-binding`).
10. **Smaller items:**
    - Remove component has no confirmation (it is undoable).
    - Integer bound errors show the raw Zod text.
    - An external call's timeout and retry are edited on the traced connection, not in the
      component form.
    - A component added from an application starts unlinked.
    - Handles cover the first pixels of lines at the ports.
    - A queued C2 line reads `queued · Messaging`.
    - `studioPerformanceFields` remain outside `definition.fields`.
    - `docs/plans/studio-ux/example-coverage.md` still describes the historical fourteen-study plan.
11. **Dev server.** SG06 found that the owner's 4300 Vite instance served stale `packages/spec`
    code. Restart `pnpm dev` before use (the coordinator restarts it after SG10).

## Checks

All checks ran on Node 24.21.0.

- `pnpm lint`: exit 0 (2,797 warnings and 88 infos, unchanged).
- `pnpm typecheck`: exit 0.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk advisory).
- `pnpm check`, unit and E2E suites: not run (owner-deferred).
