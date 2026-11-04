# UX15 — Combined review and default studio rollout

**Complete.** Primary `main`, starting at `6169c595e96beaaee6aea06d307c1eb31058ce9a`.
UX01–UX15's 25 assignments now have separate evidence and local commits. The finite studio is the
default, the temporary route switch is deleted, and ordinary project URLs expose Design / Generate /
Settings. New project offers the fourteen fresh studies; fresh installations start with the
source-mapped Mattermost study. Existing projects keep their source data and template eligibility.
P73a/P73b and the backend batch remain incomplete/paused.

## Combined acceptance

| Gate | Recorded evidence and result |
| --- | --- |
| All predecessors | [Unit audit](unit-acceptance.json) identifies the 24 exact commits, evidence and required-check records. This directory closes UX15. |
| Configuration allowlist | [Field audit](field-acceptance.json) accounts for 81 descriptor rows across 14 definitions, all visibility conditions, nine relationship fields and canonical context/package fields. It links the actual validation/save/reload/export observations in UX02/03/07 and membership actions in UX08. |
| Broad source coverage | [Example audit](example-acceptance.json) independently checks all E01–E14, 946 requirements, source hashes, valid graph references, exact prior portable seeds and lossless round-trips. E13/E14 retain limited coverage; Zammad's detailed checkpoint stays incomplete. |
| Action inventory | [Action audit](action-acceptance.json) accounts for all 85 UX01 action families. Removed controls have no normal navigation destination; preserved declarations remain in source/Generate. |
| End-to-end owned design | [Default session](default-session-observations.json), at both desktop sizes: actual finite creation, providers, connection, shared C3 queue/two consumers, grouping, conditional Host cleanup, configuration, move/Tidy, chronological Undo/Redo, acknowledged reload, review and real portable downloads. |
| Dense movement | [Default dense record](default-dense-observations.json): 24 cards, mixed protocols, fan-out, cycle/opposite directions; every sampled path stays mounted, nonempty/full opacity, unrelated geometry and labels stay exact. Zero worker requests during movement; one settle and layout save per drop. Semantic hash/revision and reload positions remain exact. |
| Retained lifecycle/recipe | [Retained-action record](default-retained-observations.json): local draft/publish/clone/delete/retire lifecycle through isolated production Library routes; actual-server QR recipe edits persist/reload; legacy source remains without studio metadata. |
| Rollout/error/legacy | [Rollout record](rollout-observations.json): exactly one fresh seed; 14-study chooser; a genuine server 422 leaves no partial seed, deletes its owned project and retries successfully. Existing projects open read-only through the studio and unified Generate. Supported legacy generation reaches existing `INVALID_OUTPUT_DIR`, with no generation launched. |
| Historical compatibility | [Legacy audit](legacy-acceptance.json): all nine original factory design/layout outputs still match UX01 hashes. Existing supported fixture eligibility is unchanged. |
| Source and live preservation | [File preservation](preservation.json), [project preservation](project-preservation.json), owned-project cleanup records and prior handoff prefix checks. Original feedback, frozen benchmarks, source factories/checkpoints and all earlier evidence remain exact. The 13-project set is preserved; concurrent live edits are disclosed below. |
| Required verification | [Check outcomes](checks/results.json): lint, full typecheck and web production build pass. Scoped formatting, documentation links and staged whitespace including new logs pass. |

Pre-rollout [session](pre-rollout-session-observations.json),
[dense](pre-rollout-dense-observations.json) and
[retained-action](pre-rollout-retained-observations.json) checks passed before removing the switch.
The final default captures follow the integration fixes below. Screenshots and continuous dense
recordings in `screenshots/` were visually inspected; they accompany requests, state/hash comparisons,
DOM/worker samples, reloads and actual exports rather than standing alone as proof.

## Integration changes

- The default route renders StudioWorkspace and unified Generate directly. `studio/route.ts` and
  its conditional branches are removed; old `#/runs` bookmarks retain their Generate destination.
- Fresh defaults and the chooser use separate studio factories, preserving original factories.
  Failed initialization deletes only its newly created project. An early opening-generation guard
  prevents a superseded development remount from creating another initial example.
- Library Presets now reaches saved-library lifecycle and existing bounded QR product configuration.
  Studio library management omits arbitrary legacy component option/insertion editors; compatible
  published compositions still insert through the finite Presets preview.
- Capability color tokens moved unchanged from the legacy editor CSS to the shared theme. Fresh
  default pages assert solid borders and filled cards before any legacy dialog is visited.
- README, CATALOG, modeling/studio/agent guidance, UX/backend roadmaps, example guide and visual index
  distinguish implemented UX from future runtime work. Historical reviews/source evidence stay intact.

## What actually ran and what remains

Temporary Chromium drivers inspected **1440×900 and 1280×800** by mouse, with guards installed before
page creation. Only exact owned disposable projects could mutate. Final session records contain
81 HTTP responses, including two deliberately injected 503 failures; explicit Retry uses real
successful server saves. Rollout contains two genuine 422 refusals produced by invalid owned seed
operations. These are the expected console resource errors; there are zero page errors, external
requests or blocked/unowned writes in final passes. Dense records have four real layout saves
across two sizes. All owned projects are deleted and verified 404; the original project set is exact.

Live preservation has an explicit concurrency qualification. The initial and final snapshots do
**not** all match: at the recorded 15:15:55 UTC audit, twelve original semantic documents remain
exact; one existing Mattermost project advanced from revision 1 to 2, removing only context
relationship `member-system`. A read-only database history query records source `canvas` at
15:14:12 UTC, without client identity. Ten original layouts remain exact; three have newer layout
hashes/timestamps. All other original metadata and the project set match. The guarded worker
sessions made zero unowned mutation requests, and every direct mutation helper requires an owned
ID. The coordinator also confirms no browser/API requests. These writes are **unattributed**;
latest live values are retained and never reset. [Live investigation](live-project-investigation.json),
[semantic difference](concurrent-semantic-changes.json) and [snapshot comparison](project-preservation.json)
record the evidence, rather than claiming thirteen unchanged live hashes. Source/factory preservation
and controlled disposable compatibility/generation gates pass independently of those live edits.

The retained-library transport explicitly redirects browser requests to **production Fastify route
handlers via `inject` and a temporary file-backed Library**: 40 production-handler requests across
two sizes, with actual lifecycle validation/storage. It never publishes into or changes the global
Library. This is an isolated integration check, not a live-server or application-runtime result.
Fresh-install inspection simulates only an empty GET project listing; all project creation, semantic
and layout saves, refusal and deletion responses are real. No model/provider or generated app runs.
See [inspection notes](inspection-attempts.json) for driver corrections and these exact limits.

All studio designs remain **design-only**. Direct server requests return `STUDIO_DESIGN_ONLY` before
jobs/output; no studio runtime resolver, new provider adapter, generated application acceptance or
benchmark implementation points are claimed. Existing historical runtime evidence stays tied to its
original project/revision/environment. The field/source audit establishes design coverage only.

Large all-cycle graphs can require pan/zoom and detail scopes; fitting every card can make text
small. Crowded labels may be omitted while lines remain selectable, and temporary incident paths
can cross geometry during movement. Existing manual overlaps are preserved. Local layout history
resets on reload; browser termination cannot guarantee unacknowledged edits. Live model conversation
quality and provider pricing behavior remain unevaluated. No completion gate is hidden by these limits.

Node 24.21.0 / pnpm 12.16.1 were used with the Node bin path prepended. Lint retains the existing
2,797 warnings / 88 infos; the build retains its large-chunk advisory. No dependency or fixture typing
adaptation was needed. Unit/E2E/template suites, snapshots, broad test maintenance and `pnpm check`
remain explicitly owner-deferred; none ran.

A later separately authorized C4a/C4b task must choose runtime/language priorities and generator
placement; pin inputs; verify reproducible builds and real black-box behavior; define extension and
regeneration preservation; measure bespoke code/repair-prompt effort and integration/failure behavior.
Dropshipping vendor access and inventory/grocery unknowns remain unresolved. This milestone starts
none of that work and does not resume the paused backend batch. Stop after UX15.
