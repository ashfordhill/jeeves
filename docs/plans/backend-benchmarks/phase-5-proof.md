# Phase 5 — Finishable handoffs and reproducible evidence

Prerequisites: [shared contract](contract.md), the three [ledgers](benchmarks.md) and P102 evidence.
These packages verify properties beyond the earlier isolated functionality: client usability,
task boundaries, recovery, load, upgrade and clean-environment reproducibility. They do not require
implementing all H features or turning the architecture studio into a page builder.

## P103

**Outcome:** a thin client can consume the contracts, and Jeeves reports foundation readiness clearly.
**Depends on:** P102. **Profile:** S + A; focused generated-client integration.

**Read/change:** existing REST client generator/runtime, API preview, Generate drawer,
`ArchitectureEvidence.tsx`, backend source maps and evidence schema.

1. Generate typed clients for supported backend contracts, including tagged results, exact money,
   error variants, cursors and authorized file downloads. No imports from application server internals.
2. Add a minimal client conformance consumer that logs in, issues a supported mutation, handles a
   conflict, reads a page and encounters an unavailable hook. Use a small browser/HTTP harness;
   it is not a cloned discussion/shop/help-desk UI.
3. Present design completeness, compatible implementation, generated files, verified foundation,
   unfinished hooks and complete-application acceptance separately. Show the frozen scope/denominator
   beside coverage and link a failure to its exact observation/operation.
4. Show current evidence inputs, stale/partial results and provider-fixture limits. The generation
   preview lists all unsupported/pending behavior before writing; never show 'ready' from diagram
   review alone. Keep mouse-only navigation and existing Save/Cancel/history behavior.

**Done when:** client code compiles from public contracts only and correctly handles success,
rejection and unavailable outcomes. Changing a relevant design/lock invalidates old evidence.
UI inspection at desktop/narrow widths shows clear partial status and no hidden required hooks.

**Not here:** frontend page layouts, application themes, broad UI test maintenance, new transports
or a single percentage that conflates design coverage with verified implementation.

## P104

**Outcome:** unresolved hooks become small deterministic finishing tasks with enforceable boundaries.
**Depends on:** P103. **Profile:** S; focused orchestration integration.

**Read/change:** `packages/orchestrator/src/{seed,brief,checks,execute,planner}.ts`, fixed acceptance
and lock ownership, architecture handoff. Preserve existing resource/event task behavior.

1. Derive tasks from exact unresolved hook obligations, not free-form component descriptions.
   A task addresses one named hook or tightly coupled hook pair with one observable outcome.
   Split large H rows into ordered tasks; their row earns no completion until every observation passes.
2. Include input/output/error examples, invariant pre/postconditions, allowed effects/repositories,
   timeout/cancellation, acceptance IDs, dependency versions and precise project-owned paths.
   Tasks do not edit migrations, public contracts, template runtimes, locks or fixed tests.
3. Topologically order hook dependencies. Reject an unresolved cycle with its identities; do not
   use the legacy element-order cycle breaker to invent a safe hook execution order.
4. Validate any planner refinement against the fixed obligations and paths. No planner is needed
   for ordinary deterministic hook tasks. Updated plans cannot silently broaden ownership or omit
   a required rejection/recovery case.
5. Extend exports with `remaining-work.json` and readable individual briefs. Include local setup,
   seed/test commands, generated source map and protected file list. No credentials or paid model
   configuration is required to read or use the bundle.

**Done when:** all 24 H rows map to bounded tasks with complete acceptance dependencies; supplied
G behavior seeds zero implementation tasks. A broad 'finish the commerce backend' task is rejected.
Attempted protected-file/test changes are detected independently of an agent's own report. Model
provider behavior is tested through deterministic scripted responses without real model calls.

**Not here:** parallel agents, autonomous cloud deployment, guessing an unspecified domain policy,
implementing the H features or relaxing the generated ownership contract.

## P105

**Outcome:** the exported project/brief supports finishing a small hook without redesigning the
foundation. **Depends on:** P104. **Profile:** P.

**Read/change:** exported hook briefs and existing orchestrator ownership checks; test/support
consumer projects only. Do not change foundation requirements to suit a finishing implementation.

1. Select one bounded hook from each app: D20 deterministic ranking, V13 one bounded promotion,
   and a small Z20 scoped report. Use the exact P61 expectations, not new easier acceptance.
   Define separate allowed source/test paths for each; scope one task at a time.
2. Exercise task export/import, dependency setup, implementation attempt, independent fixed
   acceptance, failed attempt/retry and ownership enforcement using the existing scripted provider
   harness. This proves mechanics, not the skill of a real model.
3. Produce a ready-to-run fresh-session prompt and output bundle for a separately assigned finishing
   agent. A real agent trial runs only when explicitly requested, sequentially; repository rules
   still forbid spawning extra agents/worktrees or spending on providers by implication.
4. If a real trial is requested, give it only the bundle/public documentation, record questions,
   attempted protected edits, test results, manual help and usage. Retain both successful and failed
   trials. If not run, mark real-agent effectiveness unverified rather than manufacturing a result.
5. Regenerate after a supported config change and rerun its acceptance. Project-owned implementation
   survives; completed H cases raise custom/application completion only, not template coverage.

**Done when:** mechanical handoff and three representative hook integrations pass without protected
source changes; exported prompts are self-contained; unresolved real-model effectiveness is explicit
if no trial was authorized. A seam that requires rewriting generated internals is repaired in its
own runtime/version and re-proved before claiming the handoff is ready.

**Not here:** a guarantee that every model can finish the remaining work, implementing all H areas,
paid comparisons, parallel sessions or covert edits to acceptance/coverage denominators.

## P106

**Outcome:** the three composed foundations survive the material failures their design promises.
**Depends on:** P105. **Profile:** P. Register `benchmark-recovery` with nonempty named selectors.

**Read/change:** benchmark failure scenarios, current conformance fixture lifecycle and runner;
new shared fault controller outside production application routes.

1. Make failure injection explicit and reproducible: drop response after commit, kill worker after
   effect commit/before acknowledgement, restart database, delay/fail object storage or provider,
   reorder callbacks, revoke access before materialization, and pause/resume scheduled processing.
2. Run the existing domain scenarios through complete generated apps with those failures. Assert
   both HTTP observations and authoritative invariants via privileged fixture-only inspection.
3. Verify no duplicate business mutation/inbox/escalation, no stock oversell or invalid totals,
   no private-data leak, correct unknown/reconcile state and bounded recovery/backlog behavior.
4. Record seed, exact injection point, run/instance identity, state before/after and elapsed recovery.
   Use deterministic barriers rather than flaky sleeps where possible. Fault controls must be
   absent from production contracts and generated production entrypoints.

**Done when:** all mandatory recovery observations pass for the current versions, or the milestone
stays incomplete with precise defects. Cleanup removes only the run's named containers/volumes.
An interruption records incomplete evidence; it cannot appear as a pass on the next start.

**Not here:** exhaustive chaos engineering, production database restarts, blanket Docker pruning,
host network/firewall changes or hiding a failed scenario behind an unrelated successful run.

## P107

**Outcome:** measured capacity/limits for stated local workloads and two API instances.
**Depends on:** P106. **Profile:** P. Register `benchmark-load` and preserve v1 workload targets.

**Read/change:** workload table in benchmarks.md, existing local execution/http-pool templates,
benchmark seeders and a pinned load tool or small reviewed open-loop driver.

1. Seed declared data cardinalities deterministically. Record actual CPU/RAM/disk/container limits,
   database/image versions, pool sizes, index versions, fixture seed and API/worker counts.
2. Run warm-up then the specified ten-minute profiles, first with one API and then two. Offered
   load is scheduled independently of response time; report offered and achieved rate, failures,
   p50/p95/p99 latency, queue lag/growth, DB connections, CPU/memory and bottleneck observations.
3. Run the separate hot-record contention cases and a separately labeled single-process restart
   under load. Shared sessions/idempotency/scope state must work across instances. Reuse the existing
   pool's policy against replaying ambiguous writes; do not silently retry a POST at the proxy.
4. Compare with the frozen target. A smaller machine may produce a separate measured profile;
   it does not change v1 targets or prove an unrun reference workload. No 'enterprise scalable'
   badge without a named workload, environment and observation window.

**Done when:** results are reproducible enough to identify achieved throughput, correctness and
limits. Critical invariants pass regardless of latency. Missed targets remain explicit and yield
specific follow-up work (query/index/queue/etc.), not speculative new infrastructure. Record failed
runs as well as final results and avoid repeating an unchanged full campaign unnecessarily.

**Not here:** multi-region failover, managed-cloud sizing, claiming upstream-equivalent capacity,
arbitrary stress until a machine dies or performance tuning that weakens authorization/consistency.

## P108

**Outcome:** supported design changes and version upgrades preserve project code and stored meaning.
**Depends on:** P107. **Profile:** P. Register `benchmark-upgrade`.

**Read/change:** generator lock/migration/adoption protections, template upgrade flow, current
three foundations and the representative P105 custom hook implementations.

1. For each app, generate baseline + seed data, implement the small sample hook, then apply a supported
   design change: rename a presentation label, add a nullable bounded field, or change a new-job
   policy default. Explain which changes require a new contract/lifecycle version.
2. Regenerate and verify deterministic protected files, unchanged project hook bytes, preserved
   storage IDs/data and immutable old migrations. Older queued events and deadlines retain their
   original schemas/policy versions and remain processable or explicitly blocked with a migration.
3. Rehearse one compatible runtime upgrade using new immutable artifacts. Test dependency drift,
   tampered archive, changed fixed acceptance, modified generated file and incompatible schema/drop
   as explicit no-write blockers. Never regenerate the golden expected files merely to hide drift.
4. Record rollback limits. Downgrading binaries after an incompatible data migration is not
   automatically safe; a supported rollback must name its schema/event compatibility.

**Done when:** all three seeded consumers preserve supported behavior and their custom code; unsafe
changes stop before partial output/data edits. The source design, generated lock and evidence remain
traceable. No live application or user database is involved in this rehearsal.

**Not here:** universal migration synthesis, automatic destructive cleanup, live adoption into
QRWTY or runtime contract changes disguised as a patch to an old artifact.

## P109

**Outcome:** another environment can reproduce all three foundations without development shortcuts.
**Depends on:** P108. **Profile:** P.

**Read/change:** packaging/fixture runner, exported design/lock/bundles and developer instructions.

1. Build a disposable environment from the primary checkout's declared toolchain and artifacts;
   do not create another Jeeves branch/worktree. Generate applications in isolated output directories.
2. Run each from its exported bundle with dependency lock, environment example, migrations and
   provider fixtures. Prove no imports of `/home/ash/github/jeeves`, untracked workspace artifacts,
   local developer credentials or implicit running dev services are required by the consumer.
3. Run all required foundation acceptance and compare semantic/protected output hashes with the
   reference. Network package installation may use pinned registries; tests themselves use local
   fixtures and require no paid models or live external accounts.
4. Verify evidence ingestion and interrupted-run handling. Review logs/exports for secrets and
   private fixture payload leakage. Clean up only the environment created by this package.

**Done when:** each foundation's score and critical checks reproduce from documented inputs; an
unavailable dependency yields a clear blocked result rather than fallback source imports. Differences
in platform-dependent observations are explained and never used to claim byte identity falsely.

**Not here:** public image/package publication, deployment, signing up for services or claiming a
browser screenshot proves clean-environment runtime correctness.

## P110

**Outcome:** honest final accounting, complete documentation and a precise next-work handoff.
**Depends on:** P109. **Profile:** D plus only checks justified by final corrections.

**Read/change:** roadmap status, CATALOG, runtime/template docs, three benchmark reports, agent
bundles and `docs/handoff.md`. Do not edit earlier evidence or handoff entries.

1. Produce a per-application matrix of all 20 rows: design completeness, implementation origin,
   exact template/runtime version, acceptance observations, current result and remaining hook.
   Require >=60 verified template points and every supported critical check for each foundation.
2. List which capabilities are reused across which applications with identical archive hashes;
   distinguish generic primitives from domain templates and project recipes. Count custom hook
   completions separately; record failed/untested configurations and actual capacity limits.
3. Publish operator instructions for local start/migration/backup assumptions, job/reconciliation
   states, private-data policies and known unsupported behavior. Publish the finishing-agent prompt,
   exact allowed paths, acceptance commands and remaining decisions for every H task.
4. Record real-agent trial status accurately. If only scripted mechanics were exercised in P105,
   the next optional experiment is a separately requested fresh-agent trial, not a fabricated proof
   of model capability. Do not label the entire upstream products complete.
5. Mark individual completed packages/milestones only from their evidence, append handoff and make
   the final scoped local commit. Identify one concrete next package or stretch experiment; stop.

**Done when:** the user can choose any of the three foundations, see exactly what works and what
remains, generate the same supported backend and hand a bounded task to another agent. Missing
thresholds, failing supplied behavior, failed critical tests or unreproducible inputs leave the
relevant milestone incomplete.

**Not here:** raising the score by reweighting cases, moving unfinished core work to stretch,
automatic public deployment or claims of bug-free software/unlimited scale.
