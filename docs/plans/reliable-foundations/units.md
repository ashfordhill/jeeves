# Reliable foundations: build plan

2026-11-06. **Status: in progress.** On 2026-11-07 the owner authorized implementation
(“goahead and kick it off”), using fresh sequential Sol xhigh agents. RF00 is the
[review](review.md) and feedback record. RF01 implements relationship clarity; later units and
milestones remain subject to their stated scope and dependency boundaries.

The intended result is a readable, editable architecture specification that a separate backend
can compile into a limited set of tested foundations. Start by making the existing diagram and
assistant more trustworthy. Then introduce the minimum contracts needed for one generated
application. Avoid another broad rewrite.

## Execution

Use a fresh **Sol xhigh** development agent for one assigned unit at a time, sequentially on
primary `main`. The owner requested this model/effort for later implementation. No agents were
launched during RF00. Do not parallelize mutations in this checkout, create worktrees or branches,
stash changes, push, or work ahead into the next unit.

Every agent reads AGENTS.md, the latest handoff entries, the review, the new feedback entry and
the playbook's 2026-11-06 review addendum. Preserve `.jeeves-feedback/` and owner projects.
Use new disposable study copies for acceptance; saved studies do not update automatically.

Per unit:

- State the behavior being changed and its bounded scope before coding.
- Keep rules in the spec and board rendering generic. Chat and mouse use the same operations.
- Every new setting ships with schema, defaults, inspector, validation, commands, blueprint
  projection and docs. Do not introduce fields in one unit and leave the UI to a later unit.
- Add tests for semantic invariants and integration risks, not assertions that mirror trivial
  implementation details.
- Run `pnpm check`, `pnpm test:e2e` (Docker alternative if needed) and
  `pnpm --filter @jeeves/web build`. For visible changes, use the app by mouse, check TinyURL
  and the affected studies, and inspect fitted and zoomed views at 1440×900 and 1280×800.
- Append a handoff with evidence and remaining concerns; append relevant feedback resolutions;
  make one local commit, `RFnn: <outcome>`, staging only that unit.

Each milestone ends in a review unit. That reviewer checks seams, migrations and real behavior,
not only whether individual unit reports say “passed.”

## Milestone 1: clear relationships and a better design assistant

These are the first dispatchable units. They do not change the domain ownership model, remove
lane limits or add code generation.

### RF01 — Make relationships mean what they draw

**Progress (2026-11-07): complete.** Per-relationship strokes, target arrowheads, a mouse-visible
legend and selected-line explanations implemented; all required checks pass. Mouse acceptance
covered the three studies at 1440×900 and 1280×800, fitted and zoomed, including return removal
and Undo. All three study blueprints match their pre-change JSON byte-for-byte. Evidence and
remaining overview/shared-run limits are in the RF01 handoff. Local commit:
**RF01: clarify relationship styles and direction**. RF02 has not started in this unit.

**Depends on:** RF00. **Areas:** `studio-lanes.ts`, canvas edge adapters, generic board line
rendering and relevant docs.

Draw request/response relationships solid regardless of whether the caller was reached through
a queue. Draw asynchronous relationships dashed. Add direction markers and a small mouse-visible
legend. Request arrows point from caller to target; queue arrows follow publisher/channel/consumer.
Use existing connection labels and access values to explain a selected line. Show ownership as
currently inferred, without claiming the model distinguishes read-only access by an owner.

**Acceptance:** Transcoder → Original videos is visibly a directed request labeled as a read;
Upload jobs → Transcoder remains asynchronous. The View counter's store write is a request.
Selected lines remain removable by mouse, including returns; markers do not obscure hit targets.
The semantic blueprint is unchanged for identical input.

**Out of scope:** relocating stores, changing access inference, or claiming annotations prove
runtime behavior.

### RF02 — Trace a path without deciphering shared trunks

**Progress (2026-11-07): complete.** Mouse relationship focus keeps a stable tile anchor,
incoming/outgoing endpoint and verb lists, exact route selection, hidden counts, Fit focus and
Show all. Overlap clicks offer an explicit chooser; proper crossings have visual gaps. A bounded
route pass separates two Watch API vertical stems without moving any tiles, widening gaps or
changing the three studies' route lengths/crossing counts. Required checks pass (182 unit tests,
21 E2E tests, production build); mouse acceptance covers all studies at both required sizes,
including focused return X removal/Undo and unchanged blueprints. Full-overview small names,
crowded shared stems and frame-like returns remain documented. Evidence: RF02 handoff. Local
commit: **RF02: focus and trace individual relationships**. RF03 was not started in this unit.

**Depends on:** RF01. **Areas:** canvas/board routes, selection, inspector connection list.

Add an explicit mouse-driven way to focus a selected tile's incoming/outgoing relationships and
inspect their endpoints and verbs. Display how many relationships are hidden or dimmed and offer
Show all. Separate ambiguous shared segments and distinguish crossings from actual junctions.
Start with the named failing paths; do not replace the layout engine.

**Acceptance:** a reviewer can identify, from the focused drawing and labels, who reads Originals,
who writes Transcoded videos, and how Watch obtains metadata. Completion handler and Search
indexer routes can be traced independently. No route passes through an unrelated tile; selecting
one route cannot target a different overlapping route. Focus changes no saved design or
blueprint. Record remaining ambiguity in the full overview instead of calling it solved.

Measure route length/crossings as diagnostics. Do not shorten paths by inventing services,
removing valid dependencies or weakening topology tests.

### RF03 — Give chat the reviewed design knowledge

**Progress (2026-11-07): complete.** Local typed catalog/record version 1.0.0 contains the four
reviewed patterns, explicit applicability, roles/relationships, variants, stable checklist and
obligation IDs, primary references and honest support gaps. Three topology examples pass the
real command builder; checkout returns a conceptual obligation sequence with no callback
workaround service. Bounded list/describe tools run through Workspace and ChatService, with
instructions to retrieve relevant records before builds/restructures and preserve applicability,
intent, support and verification distinctions. Required checks pass (191 unit tests, 22 E2E,
web build). Isolated mouse acceptance covered TinyURL and YouTube at both required sizes,
including both lifecycle-pattern activities and no blueprint/revision change. Detailed evidence
and remaining live-model/contract limits are in the RF03 handoff. Local commit:
**RF03: give chat reviewed design patterns**. RF04 was not started in this unit.

**Depends on:** RF00; execute after RF02. **Areas:** new finite pattern records in spec, chat
lookup tools, playbook and tool documentation.

Create a small versioned catalog from the review addendum: cache-aside lookup, durable background
job, publication-to-search, and pending-order/payment coordination. Each record has applicability,
roles, relationship requirements, variants, invariant/failure checklist, source references and
current model support. Supported examples use the existing command vocabulary; unsupported
callbacks/ownership features are clearly marked as gaps. Never imply a runtime template exists.

Expose bounded list/describe pattern tools and instruct chat to retrieve relevant records before
building or substantially restructuring a design. Keep defaults/link rules generated from the
existing catalog. This is a local catalog; no embeddings infrastructure or live web dependency.

**Acceptance:** a fake-model tool transcript proves the actual chat loop can receive a requested
pattern and its limitations. An unsupported lifecycle returns a precise obligation rather than
a misleading current-model workaround. Human review verifies the records against RF00.

### RF04 — Review proposed designs before committing a turn

**Progress (2026-11-07): complete.** Read-only `reviewDesign` previews the staged identity delta,
existing targeted findings, explicit turn-only assumptions and unsupported obligations.
`declareReviewScope` selects bounded pattern/checklist IDs and custom requirements; retrieval
selects nothing. Unsupported contracts remain **not specified**, with no prose-based inference.
Uploads without storage and workers without any outgoing relationship join existing saveable
warnings. A fresh review reaches the actual model tool loop before staged commands/scope finish;
later edits invalidate it. Two repair batches stay inside the original 16 rounds. Questions
still end immediately; pure conversational replies need no extra round. Final results separate
the exact chat commit from current saved-state review, including conflict/failure/deletion.
Required checks pass (203 unit tests, 23 E2E, production build); isolated mouse acceptance covers
TinyURL warnings/disclosure/one Undo and unchanged scoped YouTube reviews at both required sizes.
Evidence and limits: RF04 handoff. Local commit: **RF04: review staged designs before saving chat**.
RF05 was not started in this unit.

**Depends on:** RF03. **Areas:** spec diagnostics, chat Workspace/tool loop, warning inspector.

Reuse the existing working-copy/atomic-turn mechanism. Add a read-only preview/review operation
that reports the staged changes, findings by element/connection, assumptions and unsupported
obligations. Give the agent a bounded repair loop and make the final summary distinguish
implemented edits from unresolved design requirements.

Initially check only facts the model represents: missing upload storage, missing consumers,
worker outputs, declared scope obligations and obvious unconfigured requirements. Reuse current
warnings rather than duplicate them. Do not infer schemas or side effects from free-form labels.
Checks requiring contracts not yet present must report “not specified,” not “verified.”

**Acceptance:** a multi-command edit is previewed without persistence; a failed batch does not
partially apply; a concurrent mouse edit prevents stale commit; a successful turn undoes once.
The assistant can expose an unresolved obligation without adding fake “solution” tiles. Design
warnings remain saveable; structural errors still reject edits.

### RF05 — Constrain tool arguments without changing command semantics

**Progress (2026-11-07): complete.** OpenAI Responses now sends strict function schemas through
a provider-local audited codec; canonical tools/commands, the provider-neutral interface and
Codex behavior stay intact. Ordinary optional nulls decode to omission; already-nullable
optionals use a presence wrapper so `edit.owner` omission, clear and set remain distinct.
Closed-object validation precedes normalization; unsupported keywords/references and unproven
`oneOf` conversions refuse explicitly. All ten current tools compile, including RF04 scope;
continuations re-encode canonical calls to the same strict wire representation. Server Zod
refinements and graph rules remain authoritative. Required checks pass (225 unit tests, 23 E2E,
web build); isolated mouse acceptance at both required sizes runs the actual OpenAI adapter
against a loopback scripted Responses mock, proving rename/owner preservation, explicit clearing,
Undo and askUser default/choice behavior. No external API/model was called. Evidence and honest
provider/support limits are in the RF05 handoff and [tool-schema guide](../../chat-tool-schemas.md).
Local commit: **RF05: preserve command semantics with strict OpenAI tools**. RF06 was not started.

**Depends on:** RF04. **Areas:** provider tool serialization, tool schemas and focused tests.

Introduce an explicit wire-schema adapter or narrower typed tools compatible with OpenAI strict
function calling. Preserve optional/omitted semantics through a documented nullable normalization.
Audit nested unions, references and supported schema constructs; do not merely set strict true
on the existing Zod output. Preserve the provider-neutral interface and Codex path.

**Acceptance:** representative nested add/edit/module commands round-trip without changing
defaults or clearing omitted fields. Unsupported schema constructs fail clearly. Invalid tool
arguments never bypass server validation. Provider tests use mocked transport, require no API
key/network, and demonstrate the actual transmitted schema. Strict-mode support is reported
accurately for each provider.

### RF06 — Measure design quality on the intended chat model

**Progress (2026-11-07): tooling implemented; intended-model evidence blocked.** Six versioned
synthetic cases replay deterministically without network in isolated PGlite, with negative
rubric fixtures and opt-in live recording. Mini `gpt-5.4-mini-2026-03-17` returned no credits
before any model response; quality and live strict-schema acceptance remain unverified. The
separately authorized Codex `gpt-6.1-sol` / medium fallback completed six pairs under matched
round/time limits. Both arms receive honest unresolved-obligation credit from independent
AGENT review; no population improvement or runtime claim, and owner/human review remains pending.
See [reports and adjudication](../../evals/rf06/README.md) and [usage](../../chat-evals.md).
All required checks and isolated mouse checks pass; evidence is in the RF06 handoff. Local
commit: **RF06: add reproducible chat design evaluations**. RF07 was not started in this unit.

**Depends on:** RF03–RF05. **Areas:** versioned eval fixtures and an opt-in eval runner/report.

Create a compact reviewed suite covering the three study domains, modifications, repairs and
held-out variations. Include: retain durable originals; pending/failed video status; search
publication ordering; duplicate jobs; finite-stock checkout; duplicate payment notification;
TinyURL analytics with edge caching; an unsupported capability; and preserving unrelated edits.

Use deterministic assertions on final semantics and emitted obligations, with human assessment
of readability and reasonable alternatives. Do not grade against one exact node count or use
the proposing model as the sole judge. Separate these quality evaluations from scripted E2E.

**Acceptance:** offline replay is deterministic and network-free. An explicitly configured live
run records model, prompt/pattern versions, cases, critical failures, repair attempts, latency,
tokens/cost when available, and reviewer notes. Compare the current harness with the new one
under comparable budgets. Do not claim the economical model improved without running it.
Any destructive edit, unsupported capability falsely claimed as implemented, or critical domain
invariant violation is a release blocker. Report uncertainty for small sample sizes.

### RF07 — Milestone 1 review

**Progress (2026-11-07): reviewed; owner acceptance and intended-model evidence remain open.**
Independent RF00→RF06 source/seam review and mouse traces of exact saved copies (TinyURL rev53,
YouTube rev1, Marketplace rev1) confirm bounded notation, identity/focus, atomic review/Undo and
strict-codec behavior. Full overview and domain contracts remain unresolved. No production code
defect justified a rewrite; PLAN's stale current-behavior prose was corrected. Required checks
pass (239 unit tests, 23 E2E, web build), with all synthetic/Codex/access-failure replay offline.
The [review ledger](milestone1-review.md), retained saved-diagram images and
[next contract plan](next-contract-plan.md) separate fixed/partial/open/model-blocked concerns
and proposed defaults/decision gates. No Milestone 2 or generator implementation was started.

**Depends on:** RF01–RF06. Review the diff from RF00's commit through RF06.

Trace the owner's three problematic diagrams by mouse. Check that styles reflect interaction,
focus preserves identity, chat actually consumes pattern knowledge, preview/undo/conflicts work,
strict schemas preserve optional semantics, and quality reports distinguish offline plumbing from
live evidence. Fix confirmed defects only, with focused regression evidence.

Publish a ledger: fixed, partially improved, unresolved, and blocked by the current semantic
model. Append the findings to feedback and handoff. Do not close the architecture questions
merely because layout and tests pass.

**Exit:** the owner has concrete diagrams and eval results to assess. Use that evidence to make
the next milestone's contracts precise before handing them to implementation agents.

## Milestone 2: a specification that can describe one complete foundation

RF07 refines these work areas into the separate [next contract plan](next-contract-plan.md).
The owner authorized the bounded NC01–NC06/NC14 first phase and continuation across milestones;
NC01/NC02 implement their own scope/version and ownership/access slices. Remaining units are
planned until completed, with prerequisite decisions recorded in the next contract plan. This is no authorization for an unbounded
modeling-language rewrite or generator work.

The first six sequential vertical units cover a persistent narrow TinyURL scope/version boundary,
one logical Links owner with API roles and explicit access, create/resolve capability contracts,
compatibility/evidence separation and a new TinyURL preset, followed by independent review of
that subset. Then prove TinyURL in the separate backend once its repository/conventions are
known. Messaging/video/checkout expansions are deferred, not first-proof prerequisites. Later
units separately cover optional click analytics and
subscriptions, durable jobs, same-owner result journeys, committed publication, the YouTube
study, finite-stock checkout, the Marketplace study and independent review.

The proposed defaults include blueprint/design v3 with explicit v2 compatibility/refusal,
versioned finite refs, preserved unknowns and saved copies, no inference from labels, persistent
critical requirements and separate template/runtime evidence. Generic services stay design-only.
Every unit includes mouse/chat/blueprint/migration coverage, strict-schema headroom and request
overhead audits. Existing no-cycle, lane and owner rules remain in force until a reviewed unit
deliberately changes them. Backend repository/conventions remain unknown.

## Milestone 3: the separate generator, beginning with TinyURL

The backend project location and its own AGENTS.md/build conventions must be known before work
starts there. Suggested first profile: TypeScript containers, PostgreSQL and a Redis-compatible
cache for the accepted NC01–NC06 create/resolve scope. Messaging needs its own later accepted
profile extension and deliberately chosen adapter. This is a recommendation, not an installed
or verified stack. Do not expand to every provider/language allowed by Jeeves.

After the contract milestone, split these briefs into sequential, testable backend units:

| Order | Deliverable | Acceptance |
| --- | --- | --- |
| 1 | Snapshot reader and compatibility resolver | Read only the versioned blueprint and pinned contract/registry artifacts. Resolve explicit template IDs, versions and supported settings. Reject unknown requirements and missing artifacts. Output a readable resolution manifest before generating code. |
| 2 | Deterministic compiler and regeneration boundary | Same normalized input and pinned toolchain yield identical generated source/configuration. Manifest ties output to blueprint hash and template versions. No LLM in compilation. Typed custom extension directories survive regeneration; modified generated files cause a conflict, not overwrite. |
| 3 | Service/data foundation | Generate a runnable HTTP service, schema validation, auth hooks, migration path, health/readiness, structured logs and traces. Include a pinned local environment. Prove public contracts and persistence across restart. |
| 4 | TinyURL create/redirect slice | Authenticated create, public resolve, collision handling, principal-scoped idempotency, unknown/expired links and the accepted immutable-target/cache policy. Prove durable commit and immediate resolve with independent HTTP tests and the selected real database/cache adapters. Disable/mutable-target behavior requires a separate accepted contract extension. |
| 5 | Core failure and recovery proof | Exercise database/process restart, failure before/after durable commit, repeated create with the same or conflicting idempotency payload/principal, actual expiry/cache clamping, cache loss/outage fallback and authorization failures. Verify bounded behavior with real adapters; do not substitute mocked contract checks for runtime evidence. |
| 6 | Full core composition and change exercise | Generate, start, create and resolve a link, exercise expiry/cache behavior, change the design, regenerate and rerun. Preserve a sample typed custom extension. Test incompatible contracts, schema upgrade, source hashes/determinism and generated-file conflict detection. Analytics/Stats and queue redelivery are outside this core profile. |
| 7 | Review and evidence manifest | Independently review the compiler/runtime seam, unsupported combinations, upgrade safety and operational limits. Evidence identifies exact output, dependency/container versions, suite and environment. No blanket “enterprise-ready” badge. |

Only after that evidence exists should the registry list this exact TinyURL core profile as
verified. Optional click events/analytics/Stats require their accepted extension, messaging
adapter, outbox/inbox where promised, retry/dead-letter/event-ID and loss/duplicate contracts,
and independent transaction/ack-boundary/redelivery tests. No exactly-once transport promise.
Disable/mutable-target behavior likewise earns its own accepted contract and cache/visibility
tests. Then repeat with durable upload/transcode/publish, followed by finite-stock checkout.
Those exercise different composition risks and must earn their own evidence.

Backend integration tests can require real containers; that does not relax Jeeves' network-free,
PGlite-based unit-test rule. Provider integration tests and deployments remain separate from local
generation and must use their project's explicit configuration.

## Development-agent assignment template

~~~text
Assigned unit: RFnn only.
Model/effort: Sol xhigh.
Checkout: /home/ash/github/jeeves, primary main; no parallel writer.
Read: AGENTS.md, latest handoff, RF00 review, this unit, feedback and playbook addendum.
Dependency commits: <coordinator supplies completed units>.
Outcome: <copy the unit's observable behavior>.
Acceptance: <copy its checks and mouse walkthrough>.
Out of scope: <copy exclusions; no generator in Jeeves>.
Finish: required checks, appended handoff/feedback, one local commit, report unresolved issues.
Do not start the next unit.
~~~

A coordinator supplies the dependency state and checks the outcome before assigning the next
unit. Replan a unit if it uncovers a missing semantic decision; do not let the worker silently
invent the contract to keep coding.
