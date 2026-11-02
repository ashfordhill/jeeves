# Phase 1 — Baseline, scope and independent expectations

Prerequisites: [shared contract](contract.md), [benchmark specification](benchmarks.md), latest
handoff. Execute P58–P61 sequentially. These packages must not implement an application runtime.
Paths under `benchmarks/` and new backend modules below are proposed additions, not existing files.

## P58

**Outcome:** the next agents know the real starting state, which checks apply, and which results
remain unknown. **Depends on:** PLAN58 documentation. **Profile:** D; A checks for baseline only.

**Read:** root package scripts, `scripts/lib/work.ts`, Vitest configs, `docs/developer-workflow.md`,
UX5 handoff, `packages/generator/src/architecture.test.ts`, `packages/spec/src/evidence.ts`.

**Work in order:**

1. Capture HEAD, clean/dirty status, Node/pnpm versions, existing frozen runtime versions and
   available commands. Do not print secrets or copy private settings into the report.
2. Run lint/types/production build. Inspect the existing Mattermost contract sidebar and a legacy
   resource project's generation selection without generating into a live output directory.
3. Inventory deferred UI assertions and identify the exact offline semantic/runtime test selectors
   needed by this roadmap. Do not repair/rewrite deferred UI tests. Document how the standing full
   `pnpm check` requirement interacts with that deferral before a runtime package is assigned.
   If its execution is not permitted, label it not run; do not infer a green baseline.
4. Create `docs/evidence/p58/README.md` with baseline, gaps and command profiles A/S/R/P. Existing
   suite failures must have file/expectation IDs when actually observed; suspected failures are
   labeled unverified. Use the existing work runner's evidence locations.
5. Specify the new profile command names: `backend-foundation`, `benchmark`, `benchmark-recovery`,
   `benchmark-load`, `benchmark-upgrade`. Reserve them in documentation, but do not register a
   command that silently runs nothing. Later packages register each with a nonempty selector.

**Done when:** a future agent can distinguish the current code's known passes, untested areas,
and required checks without reading all historic handoffs. The report identifies the current
legacy runtime and architecture-generation fixtures to preserve. No new capability is labeled
implemented; no output/database/runtime has changed. Scoped links and diff checks pass.

**Not here:** broad test repair, dependency upgrades, application generation, provider use, changes
to `blocksGenerate`, or new template metadata. If the validation-policy conflict remains unresolved,
record it as an explicit runtime-entry constraint, not a reason to alter the user's UI instructions.

## P59

**Outcome:** versioned, machine-readable behavior ledgers and a scoring function that cannot hide
missing behavior. **Depends on:** P58. **Profile:** S, with no production UI changes.

**Read:** `packages/spec/src/evidence.ts`, `packages/generator/src/acceptance.ts`, the three tables
in benchmarks.md. **Create:** `packages/spec/src/benchmark.ts` and focused tests;
`benchmarks/{discourse-core,vendure-core,zammad-core}/v1/manifest.json` and `requirements.json`.

**Work in order:**

1. Define a strict manifest: profile/version, scope statement, source-map reference, ordered
   capability rows with immutable IDs, weight, target origin, required observation IDs, critical
   flag, dependencies, excluded scope, fixture version and workload profile. Keep results separate.
2. Transcribe all 60 rows exactly, weights totaling 100 per application. Expand the named critical
   observations into stable IDs. Require each row to declare success, rejection/access and relevant
   failure observations; explicit not-applicable needs a reason and never creates extra points.
3. Define evidence input with exact design/lock/contract/fixture fingerprints and observation
   outcomes. Calculate designed coverage, verified shared/domain-template coverage, recipe or
   upstream-integration coverage, custom completion and missing/failed coverage separately.
4. Score a row only when all mandatory observations pass for matching inputs and origin. A hook
   that returns unavailable, an unrun test, an old pass, or a synthetic 'implemented' declaration
   cannot earn points. A critical failure vetoes the foundation verdict.
5. Add a deterministic text/JSON summary function for later UI and CLI reuse. Freeze v1 ledgers
   with canonical hashes. Changing a requirement/weight creates a new version and a diff.

**Done when:** tests prove 66 target points for rows 01–12, zero actual points without evidence,
zero for partial/skipped/stale cases, no cross-application evidence reuse, no duplicate observation
identities, no unknown-case pass, and critical-failure veto at an otherwise high score. A custom
verified row increases completion but not template percentage. Arbitrary product recipes and
integrated upstream engines do not become generic template points.

**Not here:** creating fake pass records, generating tests from implementation descriptors, UI,
running load tests, or deciding which templates are implemented.

## P60

**Outcome:** compact source-backed reference packs and an explicit adaptation map for all three
applications. **Depends on:** P59. **Profile:** D; use offline cache verification after fetching.

**Read:** `docs/reference/{enterprise-architecture.md,architecture-sources.json}`,
`scripts/lib/references.ts`, `scripts/references.ts`; official references in benchmarks.md.

**Work in order:**

1. Select a stable released reference revision for each upstream project. Resolve its full commit
   SHA, date and license paths. Record whether selected paths belong to open-source core or a
   separately licensed feature. Do not use an unpinned default branch as a permanent reference.
2. Add only useful excerpts to the existing cache manifest: identity/access boundary; principal
   create/update flow; async effect; failure/retry path. For Discourse include category authorization
   and post/revision/moderation paths; Vendure order/stock/payment transitions; Zammad ticket access,
   internal-article visibility and SLA/deadline calculation. Include licenses in the cache.
3. Inspect those paths. Produce `docs/reference/backend-benchmarks.md`: source URL/path/revision,
   inspected responsibility, actual guarantee, limitation, and our deliberate adaptation.
   Record the REST-versus-GraphQL difference and reduced first-response SLA policy explicitly.
4. Map every ledger row to a primary reference or a labeled Jeeves-specific decision. H rows still
   need meaningful contracts even if an upstream enterprise feature is unavailable for inspection.
5. Fetch/verify selected files with the existing reference tool. Preserve earlier pins; do not
   replace the 2026-10-30 reference catalog wholesale or execute upstream applications.

**Done when:** an offline agent can locate the inspected excerpts and their hashes; a reviewer can
tell source facts from proposed behavior. Missing source details are identified with the exact
decision still needed before P61/P71–P73. No copied upstream implementation enters a runtime.

**Not here:** exhaustive upstream audits, whole-repository mirroring, dependency installation,
license conclusions beyond the inspected material, or changing benchmark behavior merely to match
a convenient implementation. A necessary scope correction must be a visible manifest revision.

## P61

**Outcome:** independent protocol contracts and concrete expected observations for each benchmark,
available before generating application code. **Depends on:** P59–P60. **Profile:** S.

**Read:** the shared protocol rules, all 60 rows, P60 adaptation map,
`packages/generator/src/acceptance.ts`, current fixed-acceptance fixtures under `fixtures/`.

**Work in order:**

1. Add `contracts.openapi.yaml`, typed fixture data and scenario specifications under each v1
   benchmark directory. Define backend routes for G rows and hook-facing operations for H rows.
   Separate admin/customer access. Use the agreed REST adaptation and shared error contract.
2. Make the five end-to-end scenarios per application executable descriptions: initial rows,
   authenticated actor, ordered requests/worker actions, injected failure, expected HTTP result,
   authoritative state and forbidden observations. Stable IDs tie them to the ledger.
3. Specify independent expected values: one topic/post after replay; one successful last-item
   reservation; exact money totals; version-conflict winner count; exact calendar UTC deadlines;
   private data absent from every relevant output. Do not import the runtime's evaluator to
   compute expected outcomes or copy expected SQL from its generator.
4. Define an adapter boundary so later tests can exercise a generated app through HTTP plus
   controlled fixture/provider endpoints. Privileged inspection of database invariants belongs
   to test support, not a public application endpoint. Hook cases may initially be unexecutable,
   but must have complete inputs/expected outcomes and remain not run, never skipped-as-pass.
5. Extend acceptance identity handling to admit these future named backend behaviors without
   weakening existing extension/event ownership checks. Reject duplicate/missing cases and
   unregistered behaviors. New runner behavior is introduced in P74/P79, not faked here.

**Done when:** every row resolves to contract operations and nonempty observations; fixtures parse,
all routes/operation IDs are unique, expected totals/deadlines can be independently inspected,
and no fixture requires live credentials. Contract-only tests validate fixture payloads and
negative payloads. A deliberately absent application reports not run/blocked, never passed.

**Not here:** application logic, generating expectation files from the runtime under test,
production authentication bypasses, or full upstream endpoint compatibility.
