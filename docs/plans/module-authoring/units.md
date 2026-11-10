# Module authoring: modules that generate code, built by mouse

**Status:** planned 2026-11-09 from owner feedback. MA01's [contract](contract.md) is drafted and
awaits the owner's approval; MA05–MA08 below follow it. MA02 is done.
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-09 — Modules generate code; build v2 from scratch](../../HUMAN_FEEDBACK.md)
· Follows the [UI overhaul](../ui-overhaul/units.md) and its [review](../ui-overhaul/review.md).

There are ten units, run in order: MA01 → MA10. A coordinator gives each unit to a fresh agent.
That agent does only its own unit on `main` in the primary checkout, commits it and stops.
**MA05 must not start until the owner has approved MA01's contract.**

## Goal

Anyone should be able to build the YouTube v2 diagram from scratch in the Jeeves UI, by mouse.
That means every tile kind, link, module and module link, and the result must generate the same
templates. Modules become the unit of generated code: an installed template where one exists,
otherwise a typed stub.

## Owner decisions (2026-11-09)

1. **Tiles and modules:** tiles are generic containers that accept any number of supported
   modules. Modules are tied to generated code.
2. **No insert-before:** drop "insert before" (the left `+`) from tiles.
3. **Connect mode** is a third canvas mode next to Hand, with the hotkey **C**. In it you drag
   from one box to another to connect them, and you remove connections there too. Tiles lose
   their attach (link) tab.
4. **Tile tabs:** a selected tile shows one **link icon** on the right. Its fan offers new tiles
   to add and link. A **`+`** on the left adds a module.
5. **Unconnected modules:** a module may stay unconnected and is then generated as a stub. A row
   must show whether that module kind can take a connection at all.
6. **YouTube v2 stays frozen.** Don't edit its inputs, app, diagrams or studio project
   `2c7c8b08…/r2`. A v3 may follow after this plan. Revisiting the Marketplace and TinyURL
   studies comes much later and is out of scope.
7. **Naming:** video-specific modules carry "Video" in their names. Generic ones (job consumer,
   processing result publisher, processing consumer) stay generic.
8. **Descriptions:** one short sentence of purpose, with no mechanics. Four kind descriptions
   change:

   | Kind | Before | After |
   | --- | --- | --- |
   | Cache reader | Serves reads from cache tiers before the source of truth. | Reads from a cache before the database. |
   | Data access | Reads and writes one database through a connection pool. | Reads and writes one database. |
   | External call | Calls another service or external system with resilience settings. | Calls another service or external API. |
   | Custom | Project-specific logic; generation later emits an interface and stub. | Your own logic, generated as a stub. |

9. **Row highlighting:** opening a module no longer lights up other rows (the in-process
   partner marks from UI08).

### Names and descriptions for the v2 rebuild (MA09)

This table applies the owner's naming rule to v2's modules. The frozen v2 keeps its own text.
MA01 may change *which* modules exist; any such change goes to the owner with the contract.

| Tile | Module | Description |
| --- | --- | --- |
| Watch API | Video details cache | Serves video details from the cache. |
| | Video details reader | Reads public video details. |
| | View count reader | Reads a video's view count. |
| | View publisher | Reports each video play as an event. |
| View counter | View consumer | Receives view events. |
| | Receipt and increment | Counts each view event once. |
| | Count writer | Stores view totals. |
| Search API | Video search | Searches published videos. |
| Upload API | Creator check | Allows only signed-in creators. |
| | Multipart uploads | Uploads large videos in resumable parts. |
| | Job outbox publisher | Queues a processing job once an upload completes. |
| | Upload state writer | Records each upload's progress. |
| Transcoder | Job consumer | Takes the next processing job. |
| | Segmenter and encoder | Encodes the video into streamable renditions. |
| | Packager | Stores the stream's segments and playlists. |
| | Thumbnailer | Creates the video's thumbnails. |
| | Processing result publisher | Announces whether processing succeeded. |
| Video lifecycle worker | Processing consumer | Receives processing results. |
| | Lifecycle writer | Updates each video's processing state. |
| | Video publication publisher | Announces videos that are ready to watch. |
| Search indexer | Video publication consumer | Receives newly published videos. |
| | Index writer | Adds published videos to the search index. |

## What is missing today (commit `17a6474`)

**Tile kinds the fan can't create**

| v2 uses | Can the fan create it? |
| --- | --- |
| Service, Database, Cache, Queue, Object storage | Yes |
| Worker ("Worker service", the CPU icon on the Transcoder) | Only automatically: a Service added after a queue becomes a Worker |
| Search index, CDN, Identity, Uploads | No |

The fan offers 7 types (`studio-tiles.ts`). Each type's first kind is the default.
`changeKind` exists in the spec but has no UI.

**Modules**

- Modules can't be added. `createComponent`, `connectComponent` and `disconnectComponent` exist
  (`studio-operations.ts`); only removing a module has a UI (the inspector).
- There are 10 module kinds (`studio-components.ts`). Each has `targets`, the tile kinds it may
  use. Redirect responder has none.
- A module link reaches a tile only `via` an existing link of its host.

**Code generation**

- Generation is **tile-level**. v2's 10 `generation.selections` all target tiles, and none of the
  22 modules generates any code.
- `generation.ts` allows a selection to target a component, and `generation-resolver.ts` checks
  the module's kind against `generationCapabilities[...].componentTargets`. No design uses that.
- There is no stub generation. The Custom kind's description promises one.

**Hidden declarations generation depends on**

- Generation requires explicit ownership declarations: the host's role, the store's authority,
  and grants with dependency access. They are checked in `generation-resolver.ts` around lines
  245 and 330–370.
- The normal UI no longer edits ownership. Only "Add a supported feature"
  (`buildGenerationPresetCommand`) writes it.

**Templates span several modules**

The 7 installed templates (`GET /generation-support`) each cover several modules in one tile:

| Template | Tile | Modules it covers |
| --- | --- | --- |
| `owned-multipart` | Upload API | 4 modules, plus an identity guard |
| `asset-lifecycle` | Video lifecycle worker | Consumer, writer, outbox |
| `video-hls` | Transcoder | Consumer, encoder, packager, thumbnailer, publisher |
| `positive-cache-read` | Watch API | |
| `event-counter` | View counter | |
| `search-projection` | Search indexer | |
| `search-query` | Search API | |

**Connections**

Tiles link by the attach tab (the link icon under the right `+`), or by chat. There is no
connect mode.

## Fixed constraints

- **Frozen work stays byte-identical:** YouTube v1/v2 inputs, apps, exports and diagram snapshots;
  the v1 frozen export; and the Overview layout and export. Existing designs, including ones with
  tile-level selections, stay readable and exportable unchanged.
- **Shared commands:** mouse, chat and generation use the same supported commands
  (`buildSupportedAuthoringCommand`). Any new authoring command gets its chat tool in the same
  unit.
- **Necessary controls only:** a normal control must affect an implemented template or stub and
  represent a necessary user decision. Internal identities, grants and policies are derived and
  stay in source and diagnostics. Add no Advanced form.
- `jeeves/packages/board` imports no Jeeves code. Interaction gestures added there stay generic.
- Every action works by mouse alone; hotkeys are extras.
- Less is more: add no explanatory paragraphs. When something goes away, delete its code, CSS
  and tests.

## Rules for every unit

- Read `AGENTS.md`, the latest `docs/handoff.md` entries, this plan, the HUMAN_FEEDBACK entry and,
  from MA05 onward, the approved contract `docs/plans/module-authoring/contract.md`. Do only your
  unit and stop at its end.
- **Before editing:**
  - Run `git status`. The owner may have uncommitted work: the root `README.md`, `.docs/`,
    `.jeeves-feedback/` and the mode of `e2e-docker.sh`. Leave all of it unstaged and untouched.
  - If a file you must change has uncommitted edits you did not make, stop and report.
- **Environment:**
  - Use Node 24 (`~/.nvm/versions/node/v24.21.0/bin` first in `PATH`).
  - Run `pnpm format` and Biome only from the repo root.
  - Never stop or restart the owner's dev servers on 4300/4310; use your own ports.
- **Checks:** `pnpm check`, `pnpm test:e2e` (or `:docker`), `pnpm --filter @jeeves/web build`, and a
  mouse check in the browser at 1440×900 and 1280×800. The TinyURL study must render and there
  must be no page errors.
  - If an e2e test fails, rerun it alone and report both results.
  - If timeouts appear under heavy machine load, say so instead of hiding them.
  - Delete your own projects. MA09 may keep its rebuilt project for the owner.
- **Docs:** keep these current:
  - `docs/studio.md`;
  - `docs/studio-settings.md` and `docs/studio-blueprint.md` where affected;
  - `jeeves/CATALOG.md` when tile or module kinds change;
  - `jeeves-generator/README.md` when generation changes.

  Add a dated lesson to `docs/design-playbook.md` when you learn something about design.
- **Evidence:** at most 4 screenshots per visible unit, under
  `docs/plans/module-authoring/evidence/<unit>/`.
- **Finish:** append a short handoff entry and make one local commit named `MAnn: <summary>`.
  Don't push.

---

## MA01 — Module and generation contract (docs only)

**Goal:** settle how modules generate code before anyone builds it. This unit changes no code.

**Write** `docs/plans/module-authoring/contract.md`, concise and in plain language, with tables. It
must answer these questions.

1. **Tile versus module responsibility.**
   - What does an application tile generate: the process, its HTTP or worker loop, config, and its
     compose service?
   - What does an infrastructure tile generate: the provisioned resource?
   - What does a module generate: the code inside its host?

   Check the answers against `jeeves-generator/src/v2/` (`local.ts`, `composition.ts`,
   `registry.ts` and the per-template files).
2. **The module kind catalog.** For each kind give:
   - id, name, one-line description (owner rule) and icon;
   - allowed host kinds;
   - **connection slots:** named uses of a tile, each with the target tile kinds it accepts, its
     direction (publish or consume, read or write) and whether it is required;
   - whether it can take connections at all;
   - user-facing settings (only those an emitter consumes);
   - its generation: **installed template** or **stub**;
   - whether it is generic or video-specific.

   Revise the existing 10 kinds and add the ones the installed templates need. Name video-specific
   kinds with "Video".
3. **Mapping the multi-module templates.** Decide how the 7 installed templates map onto modules.
   - **(a) Feature modules:** one template-backed module per template, whose slots equal its
     binding.
   - **(b) Responsibility modules:** generic consumer, publisher and data-access modules plus
     specific ones such as a video encoder. A template is selected when its tile holds those
     modules, linked as required.

   Recommend one, judged on these grounds:
   - reuse across projects ("generic mechanisms, narrow adapters");
   - the owner's "mix and match";
   - how much the generator must change;
   - whether the v2 rebuild can keep the module table above.

   Map every v2 module (22) and every v2 selection (10) under the recommendation. List the YouTube
   product templates (`youtube-*`) as not offered.
4. **Links between modules in one tile.** If the composition needs module→module links, how are
   they authored (a row→row drag in Connect mode?) and drawn (for example, short arrows in the
   container's gutter)? UI08's partner marks are being removed (MA02). Hidden in-process links
   must not decide what is generated unless they are visible.
5. **Derived declarations.** When a module is added or connected, which `generation` selection,
   binding and ownership (role, resource authority, grant and dependency access) does the command
   write, in one Undo step? Name the conflicts that refuse, and say what reads never invent.
   Explain how `buildGenerationPresetCommand` relates: is it kept, re-expressed as modules, or
   retired?
6. **The stub contract.** What file or files a stub emits, where in the host, its typed
   dependencies for connected slots, how unconnected slots appear, how the report lists it, and
   how custom edits are preserved on re-export (existing refusal rules).
7. **The tile fan list.** Which kinds the link fan offers. All kinds v2 uses must be included:
   Service, Worker, Uploads, Identity, CDN, Database, Search index, Cache, Queue, Object storage.
   Also decide on Gateway and External API, and confirm that the legacy kinds (Billing, Redirect,
   Notifications) and Browser are not offered.
8. **Compatibility.**
   - Existing tile-level selections keep resolving.
   - The frozen v1 and v2 exports stay byte-identical.
   - What happens to a design with both tile-level and module-level selections.
   - Blueprint and chat changes.

Also revise the MA05–MA08 sections of this plan if the contract changes their scope. Keep the
unit IDs.

**Check:** read the code paths named above, run the existing generation tests to confirm the
current behaviour you describe, and cite file:line. No checks beyond `pnpm check` are needed; it
is docs only.

**Commit:** `MA01: module and generation contract`.

**Owner checkpoint (required):** the coordinator sends the owner the contract's summary and
recommendation. MA02–MA04 may run meanwhile; MA05 waits for approval.

## MA02 — Quick fixes: row highlighting and kind descriptions

- **Row highlighting:** remove the in-process partner marks.
  - Opening a module marks only its own row and its own lines.
  - Remove `partners` from the projection and selection unless MA01's draft contract needs them;
    if it does, keep the data and drop only the marking.
- **Kind descriptions:** apply the four new kind descriptions from Owner decision 8 in
  `studio-components.ts`, and update snapshots and docs.
- **Tests:** update `detailed-view.spec.ts` and the selection unit tests.

**Commit:** `MA02: drop partner marks and tighten kind descriptions`.

## MA03 — Connect mode

**Goal:** linking and unlinking leave the tiles' tabs for a mode (Owner decision 3).

- **Toolbar:** Select (V), Hand (H), **Connect (C)**, with Connect next to Hand. It is a toggle
  with `aria-pressed`. Esc or V returns to Select.
- **Connecting:**
  - Press on a tile and drag: a provisional line follows the pointer.
  - Targets the lane rules allow are highlighted; refused ones fade, with the reason as a tooltip
    (`laneLinkRefusal` / `attachOptions`).
  - Release on an allowed tile to link the pair, using `linkTiles` and the pair's default mode.
    **The drag direction is the arrow direction**; a refused direction says why.
- **Removing:** hovering a line shows its red X at the midpoint. Clicking it removes the line
  through the existing removal confirmation and Undo.
- **Clicking:** a click without a drag still selects, so the inspector works.
- **Detailed view:** it works on containers at tile level. Module rows come in MA06.
- **Board:** add the gesture generically, as a `mode: "connect"` with `canConnect` / `onConnect`.
  Reuse the TileChrome drag and scrim code where sensible.
- **Remove the attach tab** from tiles and actions in `creation.tsx`. Keep chat's `linkTiles`.

**Tests**

- E2E: link two tiles by dragging; a refused target shows its reason; remove a line by its X and
  Undo; the C, V and Esc keys; Hand still pans.
- Assert that the design changes only on connect or remove.

**Docs:** `docs/studio.md` "Creating and connecting" and "Removing".

**Commit:** `MA03: connect mode`.

## MA04 — One link fan with every tile kind

**Goal:** you can create every tile kind v2 uses from the UI (Owner decision 4).

- **The link tab:** a selected tile shows one **link-icon** tab on the right. Its fan offers the
  MA01 tile-fan list as **kinds**, each with its own kind icon, so Worker shows the CPU icon.
  Group the kinds by tile type, in consistent slots.
  - Refused kinds are greyed, with the reason.
  - Picking one adds that tile after this one and links them. Extend `addTile` to take a kind,
    and give chat the same option.
- **Removals:** remove the left `+` and insert-before. The user tile keeps its action fan. An
  action tile gets the same link tab for new entry tiles.
- **Fan layout:** if 10–12 items crowd the fan, use a compact layout. Every item must stay
  reachable by mouse at both window sizes.
- **Leave space** on the left for MA06's module `+`; don't build it yet.

**Tests**

- E2E: create each fan kind once, by mouse, from the right tile.
- Check that each new tile has the right kind and icon, and that Undo works.

**Docs:** `docs/studio.md` (Creating and connecting) and `CATALOG.md` (what the fan offers).

**Commit:** `MA04: link fan with every tile kind`.

## MA05 — Module catalog and authoring commands (spec + chat)

**Requires the owner's approval of MA01.** Implement contract §2, §4 and §5 in
`jeeves/packages/spec`.

- **Catalog:**
  - the 18 kinds of contract §2 (8 new), with slots, hosts, descriptions, icons and generation
    (lead, part or stub);
  - the new icons in `StudioIcon`;
  - no modules on Identity, Gateway or Browser;
  - lead kinds as `componentTargets`.
  - Existing kinds keep their `thirdParty`, `requires` reasons and settings schemas, which v1's
    frozen blueprint check needs.
- **Catalog records:**
  - add `module-stub@0.1.0` and its capability (no role, resources or settings);
  - pin `youtube-core` to its current 10 template and 6 policy refs, so its sha256 stays
    `d4c66f03…`;
  - change no existing record.
- **Commands:**
  - `addModule(host, kind)`. On a schema-2 design it also upgrades to schema 3 and adds an empty
    `generation`.
  - `connectModule(module, slot, target)`. A tile target reuses the host link or adds the lane
    rules' link; the Cache reader's loader targets a Data access in its tile.
  - `disconnectModule` and `removeModule`.
  - `removeTile` and `removeLink` re-derive when module-level selections exist.
- **Derivation (contract §5):** selections, fixed values, initial values and ownership, as
  **one batch and one Undo step**. Every listed conflict refuses in plain words.
- **Status:** a pure function gives each module Template, Stub, Custom or Refused with its
  reason, for the inspector, chat and Generate.
- **Chat:** the four supported-authoring tools; `getDesign` shows module status.
- **Blueprint:** no new fields; module-level selections ride v3's `generation`. Existing designs
  parse unchanged.
- **Tests**
  - Focused unit tests for every derivation and refusal.
  - The contract's v2 tables (§3) derive exactly from a design built with the commands.
  - Old designs and the studies resolve exactly as before.
  - The v2 inputs stay unchanged and resolve the same.

**Commit:** `MA05: module catalog and authoring commands`.

## MA06 — Modules on tiles: add, connect, see

**Goal:** add a module by mouse, connect it, and see whether it can connect (Owner decisions 4
and 5).

- **Module `+`:** a `+` tab on the left of a Service, Worker or Uploads tile opens a fan of the
  module kinds the host allows (contract §2). Each item shows its icon, name, one-line
  description and **Template**, **Part of a template** or **Stub**. Picking one runs `addModule`.
  The new module opens in the inspector with its name focused. The module fan doubles as the
  owner's view of "what can be selected".
- **Module page:** a small status: the template's name, or Stub with what is missing, or Refused
  with the reason. Then only the settings contract §2 shows (Pool size and Statement timeout on
  a Data access in a template, and on a Lifecycle writer). Still no connection lists; the arrows
  show them.
- **Detailed view and Connect mode:**
  - Rows of kinds that take connections show a small **hollow dot** at their edge; a filled dot
    means a connected slot. Rows that can't connect (Redirect responder, Event counter) show no
    dot.
  - In Connect mode, drag from a row's dot to a tile to run `connectModule`. Valid targets
    highlight; refused ones fade with the reason.
  - The one in-process slot, the Cache reader's loader, is a row→row drag onto a Data access
    row. It is drawn as a short arrow in the container's left gutter (contract §4). No other
    in-process link is drawn.
- **Removing:** hovering a module line or gutter arrow in Connect mode shows its X, which runs
  `disconnectModule`. In Detailed view, this is separate from removing the tile link.
- **Overview:** the left `+` works there too; modules appear on the tile's inspector page.

**Tests**

- E2E: add a module of each fan kind to a Service and to a Worker.
- Connect a module by dragging; disconnect it; check the Undo steps.
- An unconnected module is allowed.
- Rows without slots show no dot.

**Commit:** `MA06: add and connect modules by mouse`.

## MA07 — Generated stubs and the per-module report (generator)

**Goal:** every module without an installed template generates a typed stub (Owner decision 5).

- **Stubs:** implement contract §6 in `jeeves-generator/src/v2`.
  - Each stub module gets `src/modules/<host>/<module>.slots.ts` (scaffold) and `<module>.ts`
    (extension). They share one `src/modules/dependencies.ts`.
  - A stub has a typed dependency for each connected slot, a comment for each unconnected one,
    and an entry point that throws "Not implemented".
  - Stub selections skip the role check and the host-setting audit.
  - Stubs provision nothing.
- **Reporting:**
  - `.jeeves/report.json` gains `modules` only when the design has a module-level selection.
  - The preview response and the Generate project dialog list every module of every design as
    Template, Stub, Custom or Refused, with its reason.
- **Preservation:** existing preservation and refusal of edited output also apply to stubs.
- **Gates:**
  - The v1 frozen export is byte-identical.
  - The v2 frozen export is identical as contract §8 defines it.
  - Generator tests pass.
  - A fresh design of only stub modules exports, installs and builds (`pnpm build` in the
    export).

**Commit:** `MA07: generated module stubs`.

## MA08 — Template-backed modules (generator)

**Goal:** module selections reach the 7 installed templates, as the contract maps them.

- **Resolving:** the resolver and assembler accept the module-level template selections of
  contract §3:
  - a lead module as the target;
  - the binding filled from its parts' links;
  - the Lifecycle writer as the SQL setting source for its state.

  They emit the same template code and bindings as the equivalent tile-level selections.
- **Tests:** an equivalence test shows that a module-authored design and its tile-level twin emit
  the same template payload, up to identities and paths. The twin is v2's seven installed
  selections; files outside `.jeeves/` and `diagnostics/` are compared after mapping IDs.
- **Retire the preset's normal entry points (if the owner agrees, contract question 5):**
  - the system page's "Add a supported feature", with its component, CSS and tests;
  - chat's `attachGenerationPreset`.
  - Keep `buildGenerationPresetCommand` for the product-attachment example and tests.
- **Frozen exports:** v1 byte-identical; v2 as contract §8 defines.

**Commit:** `MA08: template-backed modules`.

## MA09 — Rebuild YouTube v2 from scratch (acceptance)

**Goal:** prove Owner decision 6's aim. Build v2 in a blank project **by mouse only**:

- the user's Watch and Publish actions;
- every tile kind;
- every link with its direction and interaction, using the link fan and Connect mode;
- every module, with the names and descriptions in the table above or as the contract revised
  them;
- every module connection;
- the useful settings.

**Compare with the frozen v2**

- Write a structural diff by element and module name:
  - tile kinds, link endpoints and async/sync;
  - module kinds per host and module links;
  - the resolved templates and bindings.
- Intended differences (names, descriptions, contract changes) are listed explicitly; any other
  difference is a failure to report.
- **Generate project → Preview** resolves the same installed templates with no
  `CONFIG_REQUIRED`. Stubs cover the rest.

**Deliverables**

- An e2e spec that builds it by mouse in `jeeves_e2e` and deletes it.
- A kept project in the owner's database named **"YouTube v2 rebuild (MA09)"** for the owner to
  inspect, possibly the start of v3.
- A short evidence note with screenshots (Overview, Detailed and the Transcoder at 100%) and the
  diff.
- Do not edit `field-projects/youtube/v2/` or the frozen studio project.

**Commit:** `MA09: rebuild YouTube v2 by mouse`.

## MA10 — Independent review

A fresh agent checks the result against the owner's decisions and adds no features.

- **Check by mouse**, at both window sizes:
  - decisions 1–9;
  - the v2 rebuild;
  - that Connect mode, the link fan and the module `+` all work;
  - that the frozen exports and the Overview are unchanged;
  - that mouse and chat parity holds.
- **Leftovers:** search for dead code from the attach tab, the left `+` and partner marks.
- **Fixes:** fix small defects, with tests.
- **Write** `docs/plans/module-authoring/review.md`, with ranked follow-ups. Include the v3
  readiness, and the later Marketplace and TinyURL revisit.

**Commit:** `MA10: review module authoring`.

## Risks and stop conditions

- **The contract (MA01):** if neither mapping keeps the v2 rebuild and template reuse, say so
  plainly. Do not force a fit. The owner decides.
- **Frozen bytes (MA07/MA08):** if a change alters a frozen export, stop and report.
- **Undo (MA05):** a module command that can't derive its declarations in one Undo step must
  refuse rather than write a partial state.
- **Fan crowding (MA04/MA06):** if the fans get crowded, keep every item reachable by mouse before
  making them pretty. Report in the handoff what you judged.

## Not in this plan

These are listed in the [UI overhaul review](../ui-overhaul/review.md):

- the layout follow-ups: lines looping to an upstream store, two rows into one store crossing,
  and rows readable only from 0.6 zoom;
- the red X position on containers;
- YouTube v3;
- the later revisit of the Marketplace and TinyURL studies.

## Coordinator prompt

> You are a fresh agent in `/home/ash/github/jeeves`. Do unit **MAnn** of
> `docs/plans/module-authoring/units.md`, and only that unit. First read `AGENTS.md`, the latest
> `docs/handoff.md` entries, the plan's Owner decisions, Fixed constraints and Rules, the
> HUMAN_FEEDBACK entry, and (from MA05) `docs/plans/module-authoring/contract.md`. Follow the unit,
> run every check, append a handoff entry, make one local commit named as the unit says, and
> stop. If a stop condition applies, or a file you must change has someone else's uncommitted
> edits, report and stop without committing.
