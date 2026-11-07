# RF06 independent assessment

2026-11-07. **AGENT review, not human review. Owner review is pending.** The RF06 implementation
agent (Sol xhigh) read the final public text, graph/settings, canonical command/tool results and
rubric signals. The coordinator independently read all twelve public replies, the video and
publication graph/tool evidence and current checkout repairs, and inspected browser images.
Neither assessment came from the proposing Codex model. There is no numeric model-graded score.

The intended economical model, `gpt-5.4-mini-2026-03-17`, produced **no responses**: twelve first
requests returned no credits. Those rows are not evaluated, and give no strict API acceptance
or design-quality evidence. The separately authorized fallback requested `gpt-6.1-sol` through
the existing Codex adapter at medium effort. That alias is not a pinned Mini snapshot, and the
actual resolved backend snapshot is unreported. Do not generalize these results to Mini.

## Same semantic rubric for both arms

| Case | Baseline assessment | Current assessment | Limits and alternatives |
| --- | --- | --- | --- |
| `video-build` | Acceptable topology intent and honest unresolved obligations. Uploads owns original bytes/jobs; a Videos API owns durable status; the processor reads originals and writes separate outputs. | Acceptable topology intent and honest unresolved obligations. One Video owner has state, originals and processing dispatch; worker outputs are separate. | Eight versus six elements is not a quality test. Baseline's status-owner API is a plausible alternative; it does not prove ordering. Both explicitly leave pending/failed state, attempt correlation and duplicate-safe retries unimplemented. Current leaves the same-owner result gap visible. |
| `video-publication-repair` | Distinct Video-owner publication feed replaces raw-processing indexing. Resource IDs and worker original read survive; export identity/settings/purpose are unchanged. Unresolved pending/failed, duplicate-job, same-owner result and publication visibility receive semantic credit. | Distinct Video-owner publication feed replaces processing bypass; initiating Video ownership and exact protected resources survive. Lifecycle and publication contracts remain not specified. | Baseline moves originals/jobs to a new Uploads owner and makes Video downstream of results, with no upload→Video state dependency. That trades initiation/lifecycle clarity for a drawable path and resembles the ownership split cautioned against in the playbook. The prompt froze export details, not original ownership; `preserve-originals` overconstrains this prompt. This flag is **not a confirmed destructive change**. Do not call the baseline complete, or demand a fake callback tile from current. |
| `checkout-build` | Orders/Catalog/Payments and private owned stores are coherent narrow participants. Explicit pending, concurrency-safe reservation/expiry, timeout reconciliation, duplicate/delayed notification and compensation obligations receive credit. | Same supported participant intent with explicit finite-stock and recovery scope. Outcome returning to Orders is expressly unrepresentable. | One item/quantity one/currency is a stated narrow assumption. Baseline's extra status API is reasonable. Neither topology establishes pending-before-payment, stock safety, webhook handling or compensations as implemented. |
| `checkout-late-notification-edit` | Changes only system goal; stock ledger and other protected identities/settings/topology survive. Duplicate/unordered delivery, expiry, late recovery and reconciliation are explicitly unresolved. | Changes only goal and adds turn-local review metadata; protected stock, Catalog and payment data/topology survive. Same-owner outcome remains explicit. | A goal edit or a review-only alternative is reasonable. Neither supplies a late-success state transition, deduplication contract or actual recovery implementation. |
| `tinyurl-response-cache-repair` | Redirect response caching disabled; lookup cache, publisher/channel/worker/store/Stats reader and custom creator survive. Loss, retry duplicates and L1/Redis/replica freshness prose receives semantic credit. | Same one-setting repair; precise publisher-coverage, loss/duplicates, invalidation/lag/read-after-create obligations. | Browser/edge enforcement and analytics accuracy remain runtime obligations. Current selected the broad background-job pattern for click duplication; its unconditional support obligations add pending/processing/same-owner lifecycle noise despite a no-upload assumption. This is a scope-precision limitation. |
| `tinyurl-unsupported-edit` | Explicit refusal, no tool calls, entire design intact. Route/schema editing, exactly-once accounting and deployment/verification remain unsupported. | Entire design intact; three custom unsupported obligations are turn-local, with no design revision. | Both explicitly reject implementation/deployment/verification claims. A module or additional tile would not implement the requested capability. |

All twelve fallback turns finished without questions, timeouts or provider errors. Both arms
receive semantic credit for **emitting unresolved requirements**, never implementation credit for
those requirements. No confirmed critical destructive change, falsely implemented unsupported
capability or critical domain invariant claim was found in this sample. This is bounded evidence
about design proposals and honest limitations, not permission to release a runtime foundation.

## Adjudicating the automatic signals

Raw checks stay intact in [codex-live.json](codex-live.json). Current's deterministic checks and
prose signals matched. Baseline's five missing-term signals are not five semantic failures:

- Publication repair explicitly says pending/failed status, duplicate-job handling and same-owner
  completion remain unresolved, without repeating the fixture's exact `attempt`/`retries` words.
- Checkout build says “concurrency-safe reservations and expiry” within a finite-stock/Catalog
  context. The paragraph's omission of the literal word `stock` does not erase that requirement.
- TinyURL says every redirect must invoke publishing, post-response event loss and retry
  duplicates, and L1/Redis freshness/replica lag. These are the requested analytics/cache gaps
  even without the exact words `analytics` and `cache` in that paragraph.

The remaining owner-preservation flag is adjudicated in the case table above. All prose/claim
matches remain review aids: a distant disclaimer could coexist with an affirmative claim, and
a missed synonym could be correct. Absence of a phrase match proves neither safety nor error.
Unambiguous resource deletion, loss of a protected owner edit, an unsafe represented bypass or
an affirmative unsupported implementation claim would block release claims. Negative fixtures
demonstrate those detectors rather than manufacturing live failures.

## Refusals, repairs and observed effort

| Arm | Model responses | Refused tool calls | Mutation response batches after review | Total case latency | Input / cached / output tokens |
| --- | --- | --- | --- | --- | --- |
| RF00 ablation | 14 | 3 | 0 | 255.4 s | 372,310 / 34,432 / 8,199 |
| Current | 29 | 4 | 3 | 298.9 s | 909,034 / 96,000 / 9,352 |

Baseline repaired three overlong system goals (video build, checkout build and late-notification
edit). Current checkout build first refused an overlong goal and a scope target absent after
that atomic refusal, reviewed empty state, then used two mutation response batches (apply, then
scope). The late-notification edit repaired one overlong goal after review, using one mutation
batch. TinyURL repaired a scope target that incorrectly named a publisher module as an element,
before its first accepted scope review. The report retains every refusal and failed result.

`repairBatches` counts attempted command/scope response batches after any received review,
including no-op/refused attempts, rather than claiming the exact production budget consumed.
The current arm's observed input total was 2.44× and response count 2.07× baseline. Latencies are
end-to-end per-case wall times, including local work, not isolated inference times. Case order
was baseline then current for each task; cache warming and stochastic variation are uncontrolled.
The prompts explicitly ask for honest obligations and narrow assumptions; they test the named concerns, not spontaneous requirement discovery. There is one sample per case and no statistical improvement claim. The richer current review
made obligations discoverable but also added scope noise and more input. Both arms' honest prose
earns credit; extra obligations or fewer elements do not establish better architecture.

Codex SDK 0.162.1 and CLI 0.165.0 reported these tokens, including CLI prompt overhead. Monetary
cost/billing is unknown. There was no enforced output-token cap on this adapter; the largest
observed response was 1,495 output tokens. Each arm had the same enforced 16-response and
180-second limits. No fixture/prompt/harness/rubric change, result-based rerun or tuning occurred
between the twelve fallback cases. The as-run hashes of `cases.ts` and `score.ts` match the
committed files. Later changes clarify the baseline comment in `harness.ts` and correct runner
portability, reporting, access classification and offline replay, without changing proposals.

## Mouse readability assessment

Evidence: `/tmp/jeeves-rf06-browser-fQmy3H/` contains the walkthrough, three results JSON files
and 32 screenshots. Eight disposable designs were checked at **1440×900 and 1280×800**:
default TinyURL; current video build; both publication repairs; both checkout builds; both
TinyURL cache repairs. Mouse Fit, tile selection, relationship focus, Fit focus and Show all
worked, with exact blueprint/design preservation. No browser page/console warnings or errors.
All eight projects were deleted (204); the E2E DB retained only its default TinyURL. Owner
4300/4310 and `jeeves` projects/settings were untouched.

The implementation agent inspected default TinyURL, current video/checkout, both publication
and TinyURL repair screenshots. The coordinator inspected small fitted checkout/current and
publication/baseline views. The long baseline publication chain fitted to **0.22 zoom** at the
smaller viewport with both side panels: names were impractical to read. Focus raised it to
0.77 and exposed precise endpoint lists. Current publication remained smaller than comfortable
in overview (0.38), with Processor focus at 0.81. Checkout's simple owner fork is traceable in
focus; overview text still shrinks with both panels open. TinyURL's request and async arrows
remain distinct in focus. These are observations, not a measured newcomer usability study.
Owner/human readability and architectural-alternative review remain pending.

## Release-claim boundaries

- **Blocked:** Mini design-quality and live strict API schema acceptance, due no credits. The
  fallback cannot waive this. Access failures are not quality failures or successful outputs.
- **Unresolved:** owner/human review; scope completeness/precision; same-owner lifecycle,
  ownership/access, publication visibility, stock/payment/analytics contracts and earlier
  overview/readability limitations.
- **No runtime claim:** templates, generated code, deployment and runtime verification remain
  absent. RF07 must review these findings before proposing later contract work. No generator
  or semantic-contract implementation belongs to RF06.
