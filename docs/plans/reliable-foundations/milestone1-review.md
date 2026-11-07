# Milestone 1 review: clearer diagrams, explicit limits

2026-11-07. RF07 independently reviewed the source changes from RF00 `4e2cd15` through RF06
`fab3d59`, the owner's latest saved designs, and the evaluation records. This is **AGENT review**;
owner acceptance is pending. Milestone 1 supplies better notation, tracing and chat safeguards.
It does not yet supply a complete application specification or a verified runtime foundation.

No production defect requiring a code change was confirmed. RF07 corrects stale current-behavior
prose in [PLAN](../../../PLAN.md), records the evidence below, and proposes bounded
[next contract units](next-contract-plan.md). No study, owner project, contract schema or generator
was implemented or replaced.

## Review ledger

“Fixed” applies to the stated bounded behavior. “Partial” means a useful improvement with a
remaining part of the owner's concern. “Open” needs more evidence or design work. “Blocked by
semantic model” means the current document cannot express the required guarantee; more tiles or
clean tests cannot close it.

| Owner concern / foundation seam | Status | Evidence and remaining work |
| --- | --- | --- |
| A worker's Originals read looks asynchronous | Fixed: notation | `laneGraph` now derives dashes only from that connection's interaction. Mouse `transcoder-read` is solid with caller → target arrow and **Reads originals**; jobs → Transcoder is dashed. No byte-flow claim. |
| Original videos appears unused | Fixed: dependency visibility in focus | The saved read exists and is traceable. Keep the durable source; a queue carries its reference. Overview visibility remains partial. |
| Ambiguous shared trunks / selecting the wrong overlapping line | Fixed for reviewed traces; overview partial | Focus lists canonical edge IDs, endpoints and verbs. Watch's shared stem opens a mouse chooser, and choosing metadata selects exactly `watch-metadata` at both sizes. Hidden counts and Show all preserve the complete graph. Crowded full views still require inspection. |
| Transcoder outputs, Watch metadata, Completion handler and Search indexer paths | Partial | Each named route can be isolated and fitted independently. The handler/indexer return paths still resemble frames in overview. Focus does not make the full overview immediately understandable. |
| TinyURL's saved custom changes | Fixed: preservation boundary | Latest rev53 copied without changing the owner's document. CDN, reputation API, settings, modules and custom **Counts requests** label survive. New preset versions do not upgrade saved copies. |
| TinyURL response-cache analytics coverage and Stats reader | Open / blocked by semantic model | Saved CDN caches redirect responses; hits bypass Redirect's click publisher. Analytics store has no reader. These are still unresolved in this saved design. Exact/loss/duplicate analytics and cache freshness need contracts; disabling a setting alone proves no runtime behavior. |
| YouTube pending/failed processing and publication ordering | Blocked by semantic model | Completion events still feeds metadata and search siblings. No durable pre-publication lifecycle, current-attempt guard, failure/reconciliation contract or committed publication feed is represented. Original bytes, job output and publication are distinct. |
| Marketplace general retail scope | Blocked by semantic model | Payments still reads Shop's Catalog schema, and Order recorder writes only paid orders. No pending order, concurrency-safe finite-stock reservation, unknown-payment outcome or late-notification reconciliation contract. A visible route is not a boundary decision. |
| API and result consumer belonging to one business owner | Blocked by semantic model | Package ownership is partial. Access is inferred from owner, and a result cannot return to the initiating semantic service under current lane rules. A fake completion owner does not repair this. |
| Chat receiving reviewed knowledge | Fixed: real tool path; quality partial | Four versioned patterns reach actual ChatService tool continuations. Scripted tests and retained live Codex transcripts show retrieval; they do not prove universal instruction following. Guidance, intent, template availability and verification remain distinct. |
| Review before save, atomicity, conflict, deletion, Undo | Fixed within represented scope | Working copy, invalid-batch refusal, fresh review continuation, stale-review invalidation, two repair batches within sixteen rounds, revision conflict and exact-commit/current-state separation have focused PGlite tests. Immediate questions and no-op/review-only turns retain their documented behavior. All required checks pass. |
| Discovering and persisting all application requirements | Open / blocked by semantic model | RF04 scope is explicitly turn-only and selected by the model/user. Empty scope certifies nothing. Broad job selection for click duplication emits irrelevant lifecycle obligations. Persistent typed requirements and applicable profile checks belong in the next milestone. |
| Omitted/null/default strict-tool semantics | Fixed: mocked transport / server seam | Actual transmitted strict schemas close objects and encode omission separately from explicit owner clearing. Nested command, history, synthetic review-call, defaults, refinement and lane-refusal tests pass. Codex inner argument JSON remains unconstrained until server validation. |
| Intended economical model and live strict API acceptance | Open: access blocked | Mini returned **no credits** before any response. Twelve failed first requests are retained. No Mini quality result or live strict acceptance was established; the fallback cannot waive this gate. |
| Better general design quality at acceptable cost | Open | Six Codex pairs give bounded proposal/obligation evidence. Both arms honestly disclose unsupported requirements. One sample per case, prompted narrow assumptions, unknown monetary cost and more current input/rounds prevent a general improvement claim. |
| Typed HTTP/events/state/failure contracts; template and exact runtime evidence | Blocked by semantic model / absent service | Blueprint v2 remains design intent. Generic Services/modules and clean findings do not define domain behavior, select a compatible implementation or prove one composition. No generator exists in Jeeves. |

## The actual saved diagrams

Read-only capture at **2026-11-07 16:51:33 UTC**, through owner API 4310. The exact saved designs
were copied into new blank projects using `addElement`, `connect` and `setArchitecture` on
isolated API 4312 / web 4302, with a scratch `JEEVES_HOME`, scripted provider and `jeeves_e2e`.
Copy equality covered the entire normalized design, including semantic IDs/settings/architecture;
only the new revision differed. Actor/action/entry drawing edges explain the larger canvas counts.

| Saved project | Saved revision / design | Canvas | Fit zoom at 1440×900 / 1280×800, rails closed |
| --- | --- | --- | --- |
| TinyURL `41bbd268-9244-47cc-be63-66c5e61d116c` | 53; 9 elements / 9 connections | 12 tiles / 13 lines | 0.70 / 0.63 |
| YouTube `0a12f132-b0f4-400d-9b94-51546911bb6b` | 1; 18 / 18 | 21 / 25 | 0.39 / 0.35 |
| Marketplace `81571ba1-c2da-4896-a79c-c31557f164ca` | 1; 17 / 14 | 20 / 23 | 0.37 / 0.32 |

Mouse acceptance at **both** viewports:

- YouTube: jobs → Transcoder; Transcoder → Originals and Transcoded videos; Watch → cache and
  metadata database; Completion handler → metadata; Search indexer → search. Each selection
  matched the saved edge ID, verb, interaction and target arrow. Handler and indexer writes were
  traceable independently. Watch's overlap chooser selected the requested metadata edge.
- TinyURL: reputation/custom creator path, CDN cache misses → Redirect, Redirect → Links DB,
  Analytics worker → Analytics store. The legacy CDN/custom topology stayed intact. There is
  still no Stats reader, and CDN-hit analytics remains an architectural concern.
- Marketplace: Shop → Catalog, Payments → Catalog and Payments DB, Order recorder → Orders DB.
  Focus makes the cross-boundary price read and paid-order projection visible; it does not make
  either a complete checkout contract.
- Fit, focus, Fit focus and Show all left **the entire design and entire blueprint identical**,
  including revision. On each copy, removal targeted exactly one selected return/read edge
  (`redirect-db`, `indexer-write`, `payments-prices`); one mouse Undo restored all semantics and
  blueprint fields, with the expected new history revision.
- A fresh default TinyURL rendered at both sizes (11 tiles / 12 lines). No page/console errors
  or warnings occurred in isolated acceptance. Four owned scratch projects were deleted (204).

Inspected screenshots show that the focused endpoint list is readable and the selected request
has an unambiguous target. They also show that even with both rails closed, full YouTube and
Marketplace names are small. Long U-shaped returns can still read as group borders. This is
**partial readability improvement**, not a closed owner concern or newcomer usability study.

Retained examples: [TinyURL overview](evidence/rf07/tinyurl-1280-fitted.png),
[YouTube overview](evidence/rf07/youtube-1280-fitted.png),
[Originals read](evidence/rf07/1280-transcoder-read.png),
[Watch metadata](evidence/rf07/1280-watch-metadata.png),
[Marketplace overview](evidence/rf07/marketplace-1280-fitted.png),
[Payments reads Catalog](evidence/rf07/1280-payments-prices.png).
[Browser record](evidence/rf07/browser.json) retains source revisions/hashes, exact traces,
viewports/zoom, all screenshot hashes and the temporary evidence path with walkthrough/results.
The coordinator independently inspected the small Originals/Catalog focus and YouTube overview.
These are agent observations, not owner approval.

A fresh read-only load of the owner's existing web 4300 initially reproduced RF00's blank page:
the stale Vite transform of `studio-links.ts` lacked `studioStoreAccessLabels`, although current
source exported it. The coordinator refreshed file/config mtimes without changing contents;
the normal API/Vite watchers reloaded. A second fresh context loaded YouTube's 21 tiles with no
page errors or write requests. All three owner design hashes/revisions were unchanged afterward.
No listener was killed, owner settings were not touched, and this cache issue was not treated
as a source-code defect. Isolated acceptance remains the evidence for the mouse traces above.

## Source and evaluation seams

The source review followed the RF00→RF06 diff through lane styles/arrows, route geometry,
branch separation, board selection/filtering, focus/removal, Workspace command staging,
ChatService continuation/commit and provider wire conversion. It also inspected the pattern
records, review obligations, strict tests, eval cases/score/harness and public raw Codex results.
No confirmed production regression justified a speculative rewrite. Existing focused tests were
rerun; no new implementation-mirroring tests were added for this documentation unit.

The important seam checks are stronger than final graph validity: pattern content appears in a
subsequent actual model request; review sees pending changes without persistence; an invalid
batch leaves prior staged work intact; edits invalidate review; concurrent edits cannot be
silently overwritten; deletion yields no saved state; post-commit mouse edits are not credited
to chat; one turn undoes once. Strict transport tests check the transmitted schema, decode
before Workspace, canonical history replay and owner omission versus explicit clear. Server
refinements and graph validation still reject semantically invalid canonical commands.

[RF06 independent notes](../../evals/rf06/reviewer-notes.md) correctly distinguish the as-run
records from their adjudication. RF07 independently checked the all-case public replies and
representative raw tool/graph sequences, including current TinyURL scope and checkout repairs:

- The comparison is RF00 **guidance/tools/no-review ablation** on current Workspace/transport
  versus current production ChatService, not a complete historical application comparison.
- Both arms receive credit for honest unresolved requirements. Five baseline lexical misses
  are not semantic failures. The protected-original-owner flag overconstrains the prompt;
  baseline's ownership move is a disclosed tradeoff, not confirmed deletion.
- No confirmed critical destructive/domain/support-claim failure was found in this small
  fallback sample. Neither arm implemented lifecycle, publication, stock, payment or analytics
  contracts merely by naming them.
- Current used 29 responses / 909,034 input tokens versus baseline 14 / 372,310; total case
  latency was 298.9 s versus 255.4 s. This is about 2.07× rounds and 2.44× input, with uncontrolled
  stochastic/cache effects. Costs are unknown; CLI-login usage is not Mini API billing.
- The fallback requested `gpt-6.1-sol` at medium through existing SDK 0.162.1 / CLI 0.165.0 and
  ChatGPT login. The actual backend snapshot is unreported; Codex did not enforce the requested
  output cap. The matched enforced limits were sixteen responses and 180 seconds per case.
- Current TinyURL selected the broad job pattern for click duplicates. Review unconditionally
  added that pattern's lifecycle obligations despite a no-job assumption. Scope precision needs
  improvement through deliberate applicable contracts; it is not evidence to change existing
  review meaning or old raw outputs silently.

RF07 replayed the synthetic suite twice, all twelve fallback outcomes and all twelve failed
Mini attempts offline identically, with fetch forbidden. **No new live model calls** were made.

## Verification and next decision

Node 24.21.0: `pnpm check` passed (239 unit tests); `pnpm test:e2e` passed (23, native Chromium);
`pnpm --filter @jeeves/web build` passed with the existing chunk-size advisory. Final document
lint/diff checks and listener/read-only cleanup are recorded in the RF07 handoff.

Milestone 1 implementation can be assessed now; intended-model acceptance and owner readability
review remain open. The next step is the [proposed contract plan](next-contract-plan.md): one
small TinyURL create/resolve foundation, logical ownership/access, exact capability references,
persistent unresolved requirements and honest compatibility reporting, then typed messaging and
same-owner journeys as deferred expansions. The default next milestone is NC01–NC06 plus NC14
review of that subset, followed by the separate TinyURL backend proof once its repository is
known. Other domains are not prerequisites for proving the first foundation. Each later study
gets its own unit. Backend location/conventions and actual template/runtime evidence are still
unknown; code generation remains a separate future milestone.
