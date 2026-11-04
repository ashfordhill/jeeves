# UX13 — Finite studio assistant and existing usage

Complete on primary `main` from `4b3cf1f1b617c7ce11d78bb4df5938de86f386d6`.
Only the opt-in studio sends the new studio editing profile. Default rollout and example
reconstruction remain later assignments; P73a/P73b and backend/runtime work stay paused.

The profile advertises six tools: finite definition listing/detail, a bounded design summary,
shared studio commands, validation and focused questions. Dispatch rejects every other legacy
tool even if a model calls it anyway. Raw operations, architecture/backend replacement, routes,
schemas, business policies, custom modules and library/study expansions cannot bypass the profile.
The existing legacy tools remain usable outside it. Definitions/provider selections convey design
intent and explicit C4b obligations; they select no runtime templates and supply no implementation.

The shared strict command schema and builder serve manual edits and chat. Accepted commands use
the existing semantic validation and real operation transport; all accepted commands in a turn
commit as one history edit. Studio messages carry the revision after inspector/layout flushing.
A concurrent revision stops the turn without replaying its complete studio value over the manual
edit. A narrow system-text operation preserves old architecture declarations, including their exact
prose, instead of reparsing them through full architecture replacement. Legacy objects retain only
canonical name/purpose editing without migration or rewriting their backend configuration.

Usage shows only complete, returned token totals. Cached counts are identified as a subset of
input tokens; USD cost appears only when the provider actually reports it for every response.
Missing, partial or failed-response counters are omitted. There is no inferred price, context
percentage, subscription estimate or new billing/observability surface.

## Recorded inspection

[Main browser observations](browser-observations.json) contain 32 records at 1440×900 and 1280×800.
A temporary scripted provider exercises the real ChatService, HTTP, database and browser store:
initial four-element graph, provider change, one shared C3 queue, package membership/ownership,
pending manual input before chat, rejected business/schema/raw-tool calls, atomic rejection,
stale revision and complete/unknown/partial/error usage. Every accepted turn maps to exactly one
real chat history row. Mouse Undo/Redo/reload restores the entire initial graph.

Two held-response cases prove conflict behavior. A real inspector save makes prepared chat fail
without an operation or replay. A pending inspector draft receives an actual HTTP 409 after chat
changes that same field; its stale value cannot overwrite the accepted chat value. The UI shows
the existing Changed elsewhere feedback. [Transport observations](transport-observations.json)
record finite tool exposure, saved revisions and tool outcomes; scripted replies/costs are labeled
simulation, not conversation-quality or live-provider acceptance.

[Supplementary observations](supplementary-browser.json) contain six records. Exact-owned rich
legacy fixtures deliberately retain raw historical factory prose, including trailing newlines.
Only their exact owned revision rows were seeded directly for this observation; original records
and factory sources were never patched.
Real studio chat changes only an API name. Mouse system-goal editing uses the narrow operation;
Undo/Redo/reload preserve every other declaration exactly. The old default editor remains default
and read-only at both sizes. No original project was used for a mutation.

[Tool contract checks](tool-contract.json) inspect production functions directly: all 14 definitions,
strict [tool schemas](tool-schemas.json), every unavailable legacy/prototype tool rejected, raw
backend/config omitted from context, rich declaration preservation, legacy compatibility outside
the profile and seven invalid business/provider/definition batches. These are one-off inspections,
not a newly maintained test suite. Representative screenshots were visually inspected; screenshot
existence alone is not treated as functional proof.

All final browser guards were installed before page creation. Main inspection has 36 real HTTP
writes and exactly two console errors for deliberate inspector 409s. Supplementary inspection has
eight real writes and no warnings/errors. Both have zero page errors, external requests or blocked/
unowned writes. Successful writes came from actual API responses; only model transport was scripted.
[Attempt notes](inspection-attempts.json) record corrected driver assumptions and the preservation
fix. The unchanged default editor's collapsed chat handle was occluded by its outline in one optional
probe; studio chat works by mouse and no legacy UI redesign was attempted.

## Checks, preservation and limits

Node 24.21.0 / pnpm 12.16.1, with the Node bin path prepended. [Check results](checks/results.json)
record lint, full typecheck and the web production build, plus direct tool/browser and whitespace
checks. Existing lint warnings/infos and the large-chunk build advisory are retained.

[Project preservation](project-preservation.json) and [file preservation](preservation.json) cover
the original 13-project set and its exact semantic/layout hashes/revisions, previous handoff bytes,
feedback originals/copies, seven public fixtures, frozen benchmarks, old factories and unrelated
tracked files. Every attempted disposable is deleted and verified 404.

One existing exhaustive operation-case map received only the typing/deferred marker needed for
the new narrow operation. Its unit case is explicitly pending. Unit/E2E/template suites, snapshots
and `pnpm check` remain deferred by the owner. Live model conversation quality, real-provider
pricing, generated application behavior and C4b implementation were not evaluated or claimed.
No runtime/catalog availability or reusable conceptual boundary changed. UX13 stops here.
