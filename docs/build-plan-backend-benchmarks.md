# Backend benchmark roadmap: Discourse, Vendure and Zammad

Planning package **PLAN58**, 1 November 2026. Inspected Jeeves at `3ae6aff` on `main`, including
the UX5 Mattermost work. **Planning, [P58's baseline](evidence/p58/README.md) and
[P59's frozen ledgers/evaluator](../benchmarks/README.md) and
[P60a's Discourse reference pack](reference/backend-benchmarks.md#discourse-core-p60a) and
[P60b's Vendure reference pack](reference/backend-benchmarks.md#vendure-core-p60b) and
[P60c's Zammad pack and combined review](reference/backend-benchmarks.md#combined-p60-reference-review)
and [P61a's shared protocol](../benchmarks/protocol/v1/README.md), [P61b's independent Discourse fixtures](../benchmarks/discourse-core/v1/README.md),
[P61c's independent Vendure fixtures](../benchmarks/vendure-core/v1/README.md)
and [P61d's independent Zammad fixtures and combined contract gate](../benchmarks/zammad-core/v1/README.md)
are complete, including parent P61. [P62a local contract types](contract-types.md) are complete;
parent P62 remains partial and P62b–P110 remain unstarted.**
These foundations add no application runtime capability. This document specifies future
execution; execute only the requested work unit. It does not authorize starting runtime packages,
generating applications, publishing, or deploying them merely because they are planned.

The objective is a Jeeves design that captures the backend decisions needed to generate a useful,
tested TypeScript foundation, with narrow remaining tasks another agent can finish. The three
benchmarks are a discussion service inspired by **Discourse**, a commerce service inspired by
**Vendure**, and an enterprise help desk inspired by **Zammad**. They exercise different domain
rules over shared infrastructure. Application page layout and visual UI composition are excluded.

These are substantial, explicitly bounded core implementations. They are not complete upstream
clones, API-compatible replacements, or claims to reproduce those products' operating scale.
Each benchmark has a frozen 100-point backend behavior ledger. The planned first twelve cases
provide a **66-point candidate template path**; the other 34 points remain fully specified
application hooks. This is a target, not measured coverage or a claim that 34% of engineering
effort remains. Actual coverage can be lower and must be reported honestly.

## Start here

Read [AGENTS](../AGENTS.md), [PLAN §15](../PLAN.md#15-build-sections), the latest
[handoff](handoff.md), and the following shared specification before implementing any package:

1. [Shared contract, current gaps and agent execution rules](plans/backend-benchmarks/contract.md).
2. [Frozen benchmark scopes, case ledgers and concrete scenarios](plans/backend-benchmarks/benchmarks.md).
3. [Exact assignment queue and mandatory small work units](plans/backend-benchmarks/execution-units.md).
4. Only the phase file containing the assigned unit, plus its listed code pointers. Use the
   [worked command trace](plans/backend-benchmarks/worked-trace.md) when implementing contracts,
   behavior, compilation or runtime integration.

Continue sequentially in the primary checkout on `main`, one requested work unit per session and
local commit. The 53 delivery packages are partitioned into **79 small agent assignments**;
split parents are milestones, not single-session tasks. Start with **P58** when execution is
requested without a more specific package and no baseline has been recorded. P58/P59/P60 are complete;
P61a–P61d's shared protocol and independent D/V/Z contracts/fixtures are complete, including
parent P61's combined 60-row / 195-observation / 24-hook / 15-scenario gate. All three applications
remain absent/not run. [P62a](contract-types.md) adds local type semantics only;
the next unstarted unit is **P62b**. For the authorized
P59–P61d and P62a–P73b batches, the user explicitly permits lint/types and focused offline backend semantic/compatibility tests instead of full `pnpm check`;
UI unit/E2E execution and maintenance remain deferred. See P59's append-only handoff entry.
Dependencies are completion requirements, not permission to run multiple agents or packages.
Do not restart P46–P57, UX5, QRWTY adoption, or historical S14 work.

The roadmap adds a future implementation phase after the completed C2/C3 roadmap. It preserves
the distinction between architecture intent, template availability, and observed verification.
Earlier roadmap prohibitions on new runtimes describe those earlier packages; they do not forbid
the specifically requested future runtime packages below. They still forbid incidental runtime
expansion during a design-only package.

## Delivery map

P58 is **complete** with [baseline evidence](evidence/p58/README.md); P59 is **complete** with
[frozen ledgers and pure accounting](../benchmarks/README.md). P60 is **complete**: its
[Discourse child P60a](reference/backend-benchmarks.md#discourse-core-p60a),
[Vendure child P60b](reference/backend-benchmarks.md#vendure-core-p60b), and
[Zammad child P60c](reference/backend-benchmarks.md#zammad-core-p60c), including the
[60-row combined reference review](reference/backend-benchmarks.md#combined-p60-reference-review),
are complete. [P61 independent contracts/fixtures](../benchmarks/README.md) are also **complete**.
P62 is **partial**: [P62a](contract-types.md) is complete; P62b and P63–P110 remain **planned**.
Every package has a bounded outcome, ordered work, negative cases,
checks, and explicit exclusions in its phase file. Follow the exact child order in the
[assignment queue](plans/backend-benchmarks/execution-units.md), not the whole parent at once.

| Package | Outcome | Phase |
| --- | --- | --- |
| P58 | Establish the repository baseline and exact verification profiles | [1](plans/backend-benchmarks/phase-1-foundation.md#p58) |
| P59 | Machine-readable behavior ledger and truthful coverage calculation | [1](plans/backend-benchmarks/phase-1-foundation.md#p59) |
| P60 | Pin upstream references and record source/adaptation boundaries | [1](plans/backend-benchmarks/phase-1-foundation.md#p60) |
| P61 | Independent API fixtures and acceptance identities for all three cores | [1](plans/backend-benchmarks/phase-1-foundation.md#p61) |
| P62 | Reusable contract types, maps, tagged unions and transport bindings | [2](plans/backend-benchmarks/phase-2-design.md#p62) |
| P63 | Authoritative entities, relations, aggregates and query definitions | [2](plans/backend-benchmarks/phase-2-design.md#p63) |
| P64 | Finite authorization policies and trusted execution context | [2](plans/backend-benchmarks/phase-2-design.md#p64) |
| P65 | Structured commands, lifecycle transitions and invariants | [2](plans/backend-benchmarks/phase-2-design.md#p65) |
| P66 | Exact effects, hooks, recovery and typed capability settings | [2](plans/backend-benchmarks/phase-2-design.md#p66) |
| P67 | Mouse authoring for data, queries and access policies | [2](plans/backend-benchmarks/phase-2-design.md#p67) |
| P68 | Mouse authoring for behavior, effects, hooks and capability settings | [2](plans/backend-benchmarks/phase-2-design.md#p68) |
| P69 | Exact template capability matching and implementation status | [2](plans/backend-benchmarks/phase-2-design.md#p69) |
| P70 | Pure backend compilation plan with source-to-output traceability | [2](plans/backend-benchmarks/phase-2-design.md#p70) |
| P71 | Complete the Discourse-core design and review its journeys | [2](plans/backend-benchmarks/phase-2-design.md#p71) |
| P72 | Complete the Vendure-core design and review its journeys | [2](plans/backend-benchmarks/phase-2-design.md#p72) |
| P73 | Complete the Zammad-core design and review its journeys | [2](plans/backend-benchmarks/phase-2-design.md#p73) |
| P74 | Generate a backend host, contract adapters and safe hook skeletons | [3](plans/backend-benchmarks/phase-3-runtime.md#p74) |
| P75 | Compile persistence, bounded queries and immutable migrations | [3](plans/backend-benchmarks/phase-3-runtime.md#p75) |
| P76 | Enforce access in reads, writes and background contexts | [3](plans/backend-benchmarks/phase-3-runtime.md#p76) |
| P77 | Execute local transactions and lifecycle commands | [3](plans/backend-benchmarks/phase-3-runtime.md#p77) |
| P78 | Durable command idempotency and atomic event intent | [3](plans/backend-benchmarks/phase-3-runtime.md#p78) |
| P79 | Prove the first generated vertical flow in two independent applications | [3](plans/backend-benchmarks/phase-3-runtime.md#p79) |
| P80 | Separate worker host and durable scheduled jobs | [3](plans/backend-benchmarks/phase-3-runtime.md#p80) |
| P81 | Private file lifecycle and object-store adapter | [3](plans/backend-benchmarks/phase-3-runtime.md#p81) |
| P82 | Notification eligibility, preferences and durable inbox | [3](plans/backend-benchmarks/phase-3-runtime.md#p82) |
| P83 | Bounded external delivery and authenticated callback adapters | [3](plans/backend-benchmarks/phase-3-runtime.md#p83) |
| P84 | Scoped search and rebuildable projections | [3](plans/backend-benchmarks/phase-3-runtime.md#p84) |
| P85 | Audit records, tombstones and bounded cleanup | [3](plans/backend-benchmarks/phase-3-runtime.md#p85) |
| P86 | Revision history, review queues and finite condition/action rules | [3](plans/backend-benchmarks/phase-3-runtime.md#p86) |
| P87 | Business calendars and deterministic deadline calculation | [3](plans/backend-benchmarks/phase-3-runtime.md#p87) |
| P88 | Durable deadline scheduling and escalation effects | [3](plans/backend-benchmarks/phase-3-runtime.md#p88) |
| P89 | Freeze reusable runtime artifacts and their supported option matrix | [3](plans/backend-benchmarks/phase-3-runtime.md#p89) |
| P90 | Assemble generated discussion identity/content behavior | [4](plans/backend-benchmarks/phase-4-applications.md#p90) |
| P91 | Assemble discussion moderation, files and notifications | [4](plans/backend-benchmarks/phase-4-applications.md#p91) |
| P92 | Verify Discourse-core foundation and produce its remaining-work bundle | [4](plans/backend-benchmarks/phase-4-applications.md#p92) |
| P93 | Reusable money, catalog and cart capabilities | [4](plans/backend-benchmarks/phase-4-applications.md#p93) |
| P94 | Inventory reservations, expiration and concurrency | [4](plans/backend-benchmarks/phase-4-applications.md#p94) |
| P95 | Order snapshots and checkout orchestration | [4](plans/backend-benchmarks/phase-4-applications.md#p95) |
| P96 | Payment attempts, callbacks and reconciliation | [4](plans/backend-benchmarks/phase-4-applications.md#p96) |
| P97 | Fulfillment quantities and order lifecycle integration | [4](plans/backend-benchmarks/phase-4-applications.md#p97) |
| P98 | Assemble and verify Vendure-core foundation | [4](plans/backend-benchmarks/phase-4-applications.md#p98) |
| P99 | Assemble help-desk access, articles and routing | [4](plans/backend-benchmarks/phase-4-applications.md#p99) |
| P100 | Assemble help-desk SLA clocks and escalation | [4](plans/backend-benchmarks/phase-4-applications.md#p100) |
| P101 | Verify Zammad-core foundation and its remaining-work bundle | [4](plans/backend-benchmarks/phase-4-applications.md#p101) |
| P102 | Publish editable compositions and prove cross-application reuse | [4](plans/backend-benchmarks/phase-4-applications.md#p102) |
| P103 | Thin-client contract consumer and generation evidence UI | [5](plans/backend-benchmarks/phase-5-proof.md#p103) |
| P104 | Compile bounded finishing tasks from hook contracts | [5](plans/backend-benchmarks/phase-5-proof.md#p104) |
| P105 | Exercise external-agent handoff and ownership protection | [5](plans/backend-benchmarks/phase-5-proof.md#p105) |
| P106 | Cross-application failure and recovery campaign | [5](plans/backend-benchmarks/phase-5-proof.md#p106) |
| P107 | Measured load profiles and two-instance operation | [5](plans/backend-benchmarks/phase-5-proof.md#p107) |
| P108 | Regeneration, migration and runtime upgrade rehearsal | [5](plans/backend-benchmarks/phase-5-proof.md#p108) |
| P109 | Reproduce all three results from a clean environment | [5](plans/backend-benchmarks/phase-5-proof.md#p109) |
| P110 | Final capability accounting and operator/agent documentation | [5](plans/backend-benchmarks/phase-5-proof.md#p110) |

## Milestones and stop conditions

| Milestone | Required evidence | If it fails |
| --- | --- | --- |
| After P61: measurable scope | Three versioned ledgers, fixed external expectations, pinned source maps | Resolve missing requirements before adding runtime capabilities |
| After P73: implementable design | All 60 cases trace to data, contracts, decisions and either templates or typed hooks | Repair only the missing design packages; do not let a coding agent invent the semantics |
| After P79: early executable proof | Fresh generation, real database, two applications, access + transaction + retry failures | Fix the compiler/runtime boundary before expanding the library |
| After P92/P98/P101: individual foundations | At least 60/100 verified template points per application; all foundation critical cases pass | Report the exact deficit and add a bounded missing capability package; keep the denominator |
| After P102: reusable library | Same immutable components/configuration mechanism reused across applications | Refactor only proven duplication; application-name switches do not establish reuse |
| After P105: finishable handoff | A fresh consumer can implement a bounded hook without modifying protected code | Repair the extension seam and brief before describing the foundation as agent-ready |
| After P110: roadmap objective | All foundations repeatably pass, measured load limits recorded, handoffs complete | Leave the failed milestone incomplete; do not relabel pending work as stretch |

Checks run at the package that changes the relevant behavior. Later milestones add composition,
recovery, scale or reproducibility evidence; they are not instructions to rerun every earlier
campaign after every documentation change. Keep evidence scoped to actual versions and inputs.

## Stretch work

[Stretch packages X1–X8](plans/backend-benchmarks/stretch.md) cover GraphQL compatibility,
Medusa-style compensation, Mastodon-style feeds and federation, GitLab deployment studies,
external search/cache backends, and an ERPNext-style workflow study. None can replace an unfinished
core case or lower the three applications' denominator. Start a stretch package only when it is
requested and its prerequisites are met.

## What completion does and does not establish

Successful completion establishes three usable backend foundations, a repeatable generation and
verification path, and explicit implementation seams for finishing them. It does not establish
full Discourse/Vendure/Zammad parity, guaranteed security, unlimited scale, production provider
approval, or unattended cloud operations. Those claims require their own scope and evidence.

The library should become easier to trust because its promises are small, explicit and exercised.
The important output is the behavior supported by the generated system and the clarity of the
remaining work, not the number of boxes or lines of generated code.
