# Module authoring: independent review (MA10)

Reviewed 2026-11-10 against the [plan](units.md)'s owner decisions and the approved
[contract](contract.md). Commits `18cda98` (plan) to `63022ff` (MA09), on baseline `17a6474`, then
`MA10: review module authoring`.

How: my own API (port 4351, scratch database `jeeves_ma10`, now dropped) and Vite (4350), with
scripted Chromium using the mouse (keys only to type and to test the C, V and Escape shortcuts), at
1440×900 and 1280×800. The owner's kept rebuild was read by API and opened in the owner's app,
where only Overview | Detailed was clicked. Every owner project kept its revision and `updatedAt`.

## The owner's decisions

| # | Decision | Verdict | What I saw |
| --- | --- | --- | --- |
| 1 | Tiles hold any supported modules; modules generate code | **Delivered** | A Microservice took a Cache reader, Data access, Event publisher and Redirect responder. Generate project listed all four: two **Template · Cache read**, two **Stub** with the reason. Preview had no findings ("Ready: 40 files"). The kept rebuild has 22 modules: 20 Template, 2 Stub. |
| 2 | No insert-before | **Delivered** | On TinyURL extended, at both sizes, application tiles have only the module `+` (left) and the link tab (right). A queue has only the link tab, and a store has no tabs. Chat's `addTile` refuses `side: "before"`. |
| 3 | Connect mode (C), drag to link, remove there; no attach tab | **Delivered** | The toolbar reads Select, Hand, Connect. C, V, Escape and the button all switch modes, and tiles show no tabs in Connect mode. Dragging Shorten service onto Click events added exactly one async link, and Undo removed it. Analytics store onto Redirect service was refused, with the tip and the notice, and changed nothing. The hover X removed Redirect service → URL database, and Undo restored the design exactly. |
| 4 | Link icon on the right fans new tiles; `+` on the left adds a module | **Delivered** | The link fan has 11 kinds in 4 rows. The module fan has 12 kinds for a Service and 16 for a Worker. At both sizes every item was wholly on screen. |
| 5 | An unconnected module is a stub; a row shows whether it can connect | **Delivered** | A new module is a Stub, with its reason. A row has a hollow dot until it connects, then a filled one; Redirect responder and Event counter rows have no dot. A refused dot drag shows its reason and changes nothing. The loader is a drag from row to row, drawn as a gutter arrow; its X disconnects it, and Undo restores it ([1440](evidence/ma10/1440-detailed-loader-template.png)). |
| 6 | YouTube v2 stays frozen | **Delivered**, with a note | `field-projects/youtube/v2/` is unchanged since `17a6474`, and the frozen exports hold (below). The frozen studio project is at revision 4, with two extra tiles. They were added before the plan began, not by any MA unit (follow-up 8). |
| 7 | Video-specific modules are named "Video …" | **Delivered** | The Worker's fan names Video encoder, Video packager and Video thumbnailer. Event consumer and Event publisher stay generic. The rebuild uses the plan's names. |
| 8 | One-sentence descriptions; four reworded | **Delivered** | The fan tips read the four new texts exactly: Cache reader, Data access, External call and Custom. |
| 9 | Opening a module lights no other row | **Delivered** | Opening the Cache reader in Detailed marked one row (`open`). No partner mark exists in the DOM or the code. |

Module status reads correctly everywhere: "Template · Cache read", Stub with what is missing,
Custom on a study before any module command, and Refused on a study after one.

## The v2 rebuild

- **`v2-rebuild.spec.ts`** passed in the full E2E run (it builds v2 by mouse, diffs it and
  previews it).
- **Kept project** "YouTube v2 rebuild (MA09)", read only, revision 142:
  - **API reads:** the diff gives 163 rows, 0 unexpected and 0 unused. Its 9 selections are v2's
    seven templates and the two stubs; modules are 20 Template and 2 Stub.
  - **In the owner's app**, at 1440×900 and 1280×800: 22 tiles; 28 lines in the Overview and 31
    in Detailed; 22 rows, 21 dots, all filled, and one loader arrow. There were no page errors.
  - It matches the [MA09 evidence](evidence/ma09/README.md). View publisher's reason now reads "No
    template in Watch API uses it."
- At the fit with the chat open, a connection dot is 4.9px at 1440 and 4.2px at 1280 (follow-up 1).

## Invariants

| Invariant | Result |
| --- | --- |
| v1 frozen export | **Byte-identical** (`assemble.test.ts` manifest pin, in `pnpm check`). |
| v2 frozen export (contract §8) | **Holds.** A fresh `export:v2` gives 72 files, 70 of them byte-identical to `generic-export.tar.gz`. `report.json` is equal once every emitter's `sources`/`sourceSha256` and the added `local.module-stubs` emitter are set aside. `manifest.json` then differs only in that emitter, `registry.sha256`, and `report.json`'s hash and size. The source inventory gained 4 files and 13 changed. |
| YouTube Overview PNG, 1440×900 | **`472a4c8c…dc9f`**, unchanged. |
| View-only actions | **Hold.** On TinyURL extended at both sizes, none of these changed the design or blueprint: selecting tiles, opening and cancelling fans, mode keys, Detailed, opening a row, Back and Fit. The foundation study behaved the same. |
| Mouse and chat parity | **Holds after fix 3.** For `addModule`, `connectModule` (and its refusal), `disconnectModule` and `removeModule` on v2's module design, the mouse's batch (`buildStudioCommand`) equals chat's (`buildSupportedAuthoringCommand`) in a scratch script; `tools.test.ts` checks add and connect through chat's tool. Chat could also send two older commands the mouse never sends; fix 3 closes that gap. |

## Fixes in this unit

1. **Plain stub reasons.** A part with no lead beside it now reads "No template in <tile> uses
   it.". Before, it read "Needs Multipart uploads in its tile." or "Needs to be in a worker.", as
   if something were wrong. View publisher's reason is fixed too. Tests: the spec's "explains
   each stub" (now with an Event consumer in a Service), the server's preview test and the E2E.
2. **Plain Refused reason.** The status now names the kept value and where it is: "The link from
   Watch API to Metadata database uses Service identity, which its template can't use; 9 other
   saved values can't be used either." Before, it was the resolver's "Local preset supports Private
   network; declared Service identity remains unsupported and is preserved." The fix is small and
   touches only the status text. The resolver's findings, generation and chat's fields are
   unchanged. It covers links and tile and module settings; any other finding keeps the
   resolver's sentence ([1280](evidence/ma10/1280-study-refused.png)).
3. **Chat can no longer leave a stale template.** `removeComponent` and `disconnectComponent`
   never derive, and chat could still send them. Removing the Count writer that way kept the event
   counter's template selected. Normal authoring now refuses both once module-level selections
   exist, and the refusal names `removeModule` or `disconnectModule`. The mouse already sends only
   those two. The new test fails without the fix. Chat's instructions and `CATALOG.md` say the same.
4. **Dead code.** `laneLinkRefusal` was the attach tab's helper and has been unused since MA03.
   It is removed, and its refusal tests now run on `connectOptions`. `LinkGlyph`'s comment named
   the attach tab.
5. **Docs.** `studio.md`: chat's `addTile` no longer "inserts before a tile", and the module page's
   reason examples and the studies' Refused sentence are current. `CATALOG.md` and `PLAN.md`: the
   module commands are listed and `laneLinkRefusal` is gone.

**Leftovers search.** Nothing remains from the attach tab, the left `+` or insert-before
(`insertBefore`, `retargetIncoming`, `laneOptions`, `side: "before"`). Nothing remains from the
partner marks, `PresetAttachment`, `attachGenerationPreset` or `.studio-feature*` either. Three
things only look like leftovers: the chat test that checks `attachGenerationPreset` is unknown, the
board's generic before-side tabs (now the module `+`), and a provenance comment in `ConnectDrag`.
The unused CSS classes I found all predate the plan (UI10 follow-up 6).

## Issues reported by earlier units

| Issue | Finding | Outcome |
| --- | --- | --- |
| View publisher: "Needs Multipart uploads in its tile." | Stub reasons spoke of a part's missing lead as if the part were wrong | Fixed (1) |
| Studies flip to Refused with a technical sentence | The plainer reason is small; changing the state itself is a spec question | Reason fixed (2); state is follow-up 3 |
| Dots 2.5–4.5px at the fit; a connect drag doesn't pan | The hit area is already 28px at 100% (about 10px at the fit). Rows are 32px apart, so a larger one would cover the next row's dot. Auto-pan is board work | Follow-up 1 |
| IDs from the kind (`worker-service-3`) | Identity rules are unchanged, as asked | Follow-up 2 |
| A tile's settings appear only after its modules connect | Options show a field only when an installed template consumes it for that tile. Derivation writes the initial values only when a template is selected (contract §5). This follows AGENTS.md: a control must affect an implemented template | Follow-up 4 |
| MA04: in a narrow canvas the link fan can cover its own tile | Still so, and documented under Limits | Follow-up 6 |
| MA05: clean-up by key | A hand-made fact equal to one a module selection once derived is replaced | Follow-up 7 |
| MA05: `removeComponent`/`disconnectComponent` don't derive | The web never sends them, but chat could | Fixed (3) |
| Chat can add Gateway, Billing, Redirect, Notifications | Pending owner decision (a frozen chat eval scores a Billing tile) | Follow-up 5, unchanged |

## Follow-ups, most important first

| # | Issue | Suggested next step | Owner decision? |
| --- | --- | --- | --- |
| 1 | At the fit a connection dot is 2.5–4.9px, and a connect drag doesn't pan, so both ends must be on screen | In the board, auto-pan a connect drag near the canvas edge (generic). Then consider a minimum screen size for drag handles | No |
| 2 | IDs come from the kind at creation (`microservice-2`, `worker-service-3`) and name stubs and local identities | Decide whether a rename before export re-keys the ID (its links and selections too), or whether generated names come from tile names | **Yes** |
| 3 | Any module command on the TinyURL extended or YouTube study turns its Cache reader and Data access Refused. The kept values (Service identity links, replicas, Go, MySQL, a cluster cache, L1 settings) have no control | Decide it in the TinyURL/Marketplace revisit: rebuild by mouse, or offer one "use local defaults" step | **Yes** |
| 4 | Options appear only once a template derives, so values come after connections | The per-tile process plan settles it if every application tile gets a process, because its HTTP and worker settings then have a consumer. Otherwise, decide whether a lead's settings show before its parts connect | **Yes** |
| 5 | Chat can add Gateway, Billing, Redirect and Notifications tiles that the fan doesn't offer | If refused, add the refusal to `buildSupportedAuthoringCommand` and change the eval's Billing case | **Yes** (pending) |
| 6 | In a narrow canvas the link fan's panel covers its own tile | Put the grid above or below the tile when it can't sit beside it | No |
| 7 | Clean-up by key can replace a hand-made ownership fact | Record which facts derivation wrote | No |
| 8 | The frozen v2 studio project (`2c7c8b08…`) is at revision 4. Tiles API and Service, and an entry, were added 2026-11-09 21:05 CST, 33 minutes before the plan's first commit. Inputs and exports are unaffected | If unintended, the owner presses Undo twice in that project | **Yes** |
| 9 | UI10's follow-ups 1–7 remain (outside this plan) | As the [UI review](../ui-overhaul/review.md) suggests | As there |

## v3 readiness and the studies revisit

- **v3:** the kept rebuild equals v2 by name (0 unexpected) and previews v2's seven templates. Four
  things are left before it can start v3:
  - its IDs (follow-up 2);
  - empty system and tile descriptions;
  - Watch API's two stubs;
  - a process per tile (next plan).
- **TinyURL and Marketplace revisit:** their modules read Custom until a module command. After one,
  TinyURL's Cache reader and Data access read Refused (follow-up 3); all Marketplace modules
  become stubs. Rebuilding each by mouse, as v2 was, is the clearest test.

## Next: a runnable process per application tile

The owner wants this as its own plan, after this review (contract question 6). These findings
matter for it:

- **Today:** an application tile generates no process. Templates and stubs are libraries, and the
  `application-services` gap stays required. Stubs sit under `src/modules/<tile>/` and import no
  template library, so a stub-only export already builds (MA07): a good base for a process that
  wires them.
- **Names:** tile IDs from the creation kind (follow-up 2) would become process and compose
  service names (`app-microservice-2`). Settle renaming first.
- **Settings:** a process gives Request timeout, Concurrency limit and Worker concurrency a
  consumer on every application tile. That resolves follow-up 4, but it changes which Options
  show.
- **Provisioning:** a tile linked only to stubs isn't provisioned (contract §1, §6). Decide whether
  a stub's connected slots provision their tiles, for example View counts and View events for
  Watch API's two stubs.
- **Consumers:** an Event consumer in a Service is a stub. Decide whether a service's process runs
  consumer loops.
- **Kinds:** chat can still add Gateway, Billing, Redirect and Notifications (follow-up 5). Identity
  is provisioned only when an Auth guard binds it.
- **Studies:** their kept values (follow-up 3) would block their processes too.
- **Frozen v2:** contract §8 holds only while v2's tile-level selections generate no process.
  Either a process is opt-in, or the owner approves a new rule for the frozen export.

## Checks

The run was clean:

- `pnpm check`: 557 tests in 80 files; lint showed only the existing info.
- E2E: 61 passed (4.1m) on the first full run, `v2-rebuild.spec.ts` included (1.5m).
- The web build passed, with the existing chunk-size advisory.
- The mouse review passed 8/8 at both sizes, and the kept project 2/2. There were no page or console
  errors.

## Evidence

- [1440-detailed-loader-template.png](evidence/ma10/1440-detailed-loader-template.png): Detailed +
  Connect, zoomed in. It shows filled, hollow and missing dots, the loader arrow, and the Cache
  reader page reading "Template · Cache read".
- [1280-study-refused.png](evidence/ma10/1280-study-refused.png): the YouTube study's Details
  cache, Refused with the plain reason.
- [1280-generate-modules.png](evidence/ma10/1280-generate-modules.png): Generate project after
  Preview, listing two Template and two Stub modules, each with its reason.
- Earlier units: [ma02](evidence/ma02/), [ma03](evidence/ma03/), [ma04](evidence/ma04/),
  [ma06](evidence/ma06/), [ma07](evidence/ma07/), [ma08](evidence/ma08/) and
  [ma09](evidence/ma09/README.md).
