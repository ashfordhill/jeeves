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

These are bounded work areas for the next plan, **not yet dispatchable coding units**. RF07
should split them into complete vertical changes after the decisions below are settled. Avoid
giving one agent a general-purpose modeling-language rewrite.

| Order | Work area | Required outcome and acceptance |
| --- | --- | --- |
| 1 | Service ownership and access | Build on existing package ownership. Distinguish a logical business service, its API/consumer roles and deployables. Declare read/write intent rather than infer every owner's use as write. Reject unauthorized cross-boundary writes; make shared read models deliberate. All controls work by mouse. |
| 2 | HTTP capabilities | Versioned capability/operation/schema references, caller/receiver compatibility, authorization and idempotency profiles. Start with create-link and resolve-link. A generic Service without a contract stays design-only. No arbitrary business-policy editor. |
| 3 | Messaging capabilities | Versioned job/event schemas, subscriptions, ordering scope, idempotency and failure policies. Distinguish competing workers from independent subscriptions; duplicate delivery must remain possible in the model. |
| 4 | Journeys and asynchronous return | Separate semantic relationships from lane presentation. Demonstrate a job/result lifecycle that revisits one owned service without creating another independent owner. Acyclic drawing is a projection, not a restriction on all runtime relationships. Warn about accidental recursion. Start with this concrete pattern; avoid unrestricted workflow machinery. |
| 5 | Generation readiness | A separate compatibility report over blueprint + capability/template manifest. Distinguish valid design, supported combination and externally verified artifact. Every required unknown, omitted part and custom obligation is surfaced. No runtime or generator implementation in Jeeves. |
| 6 | Reworked studies | Update one study per agent: TinyURL first, YouTube lifecycle second, Marketplace checkout third. Each has explicit included/excluded behaviors, ownership, failure scenarios and sourced decisions. Do not create more services to satisfy drawing constraints. |
| 7 | Review | Read/migrate old projects without silent behavioral claims; compare source, inspector, chat and export for the same contracts; walk all studies by mouse; review all new compatibility gates. |

Contract decisions to capture before this milestone starts:

- Keep the default canvas approachable. Choose whether API/worker roles are expanded inside an
  owned service or shown as grouped tiles; do not equate a handler with a separately owned system.
- Use a new blueprint version for changed meanings. Keep a deliberate compatibility path for
  v2 consumers; a lossy projection must fail or explicitly report unsupported content, never
  silently certify it. New fields load as unspecified in old documents.
- Keep existing projects intact. New preset versions do not authorize replacing owner copies.
- Prefer choosing reviewed capability contracts over building route/entity/policy programming
  editors in the studio. The typed contract, not display text, determines future compilation.
- Define a narrow initial workload and behavior scope. Read replicas, exact analytics, private
  media, finite inventory and other guarantees must be chosen, not inferred from “enterprise.”

These are proposals to discuss against RF00/RF07 evidence. Existing no-cycle, lane and owner rules
remain in force until their replacement is deliberately implemented.

## Milestone 3: the separate generator, beginning with TinyURL

The backend project location and its own AGENTS.md/build conventions must be known before work
starts there. Suggested first profile: TypeScript containers, PostgreSQL, a Redis-compatible
cache and one deliberately chosen messaging adapter. This is a recommendation, not an installed
or verified stack. Do not expand to every provider/language allowed by Jeeves.

After the contract milestone, split these briefs into sequential, testable backend units:

| Order | Deliverable | Acceptance |
| --- | --- | --- |
| 1 | Snapshot reader and compatibility resolver | Read only the versioned blueprint and pinned contract/registry artifacts. Resolve explicit template IDs, versions and supported settings. Reject unknown requirements and missing artifacts. Output a readable resolution manifest before generating code. |
| 2 | Deterministic compiler and regeneration boundary | Same normalized input and pinned toolchain yield identical generated source/configuration. Manifest ties output to blueprint hash and template versions. No LLM in compilation. Typed custom extension directories survive regeneration; modified generated files cause a conflict, not overwrite. |
| 3 | Service/data foundation | Generate a runnable HTTP service, schema validation, auth hooks, migration path, health/readiness, structured logs and traces. Include a pinned local environment. Prove public contracts and persistence across restart. |
| 4 | TinyURL create/redirect slice | Create, resolve, collision handling, idempotency, unknown/expired/disabled links and cache policy. Prove behavior with independent HTTP tests and the selected real database/cache adapters. Implement one declared consistency policy. |
| 5 | Reliable event path and analytics | Add outbox/inbox where the chosen guarantee needs them, retry/dead-letter handling, event IDs and documented analytics loss/duplicate behavior. Kill processes at transaction/ack boundaries and verify recovery. Do not promise exactly-once transport. |
| 6 | Full composition and change exercise | Generate, start, create a link, follow it, observe stats, change the design, regenerate and rerun. Preserve a sample custom extension. Test restart, cache loss, queue redelivery, incompatible contracts and schema upgrade. |
| 7 | Review and evidence manifest | Independently review the compiler/runtime seam, unsupported combinations, upgrade safety and operational limits. Evidence identifies exact output, dependency/container versions, suite and environment. No blanket “enterprise-ready” badge. |

Only after that evidence exists should the registry list this exact TinyURL profile as verified.
Then repeat with durable upload/transcode/publish, followed by finite-stock checkout. Those
exercise different composition risks and must earn their own evidence.

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
