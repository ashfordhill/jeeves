# P58 — Repository baseline and verification policy

[Package specification](../../plans/backend-benchmarks/phase-1-foundation.md#p58) ·
[Shared contract](../../plans/backend-benchmarks/contract.md) ·
[Assignment queue](../../plans/backend-benchmarks/execution-units.md)

Recorded 1 November 2026 (America/Chicago; raw logs use UTC on 2 November). P58 records existing
behavior and the checks required before backend implementation. It adds no model, compiler,
template, runtime, command registration or measured benchmark coverage. **Next unstarted unit:
P59.** The full-check policy constraint below remains open for implementation assignments.

## Starting checkout and observed checks

| Input | Observed value |
| --- | --- |
| Checkout / branch | `/home/ash/github/jeeves`, `main`; no additional branch, worktree or agent |
| Inspected HEAD | `0c96aae3b3e5b226cad7ac8284ef5ecb36b310f4` (`PLAN58`) |
| Initial tracked, staged and untracked status | Clean, including before/after the authoring baseline |
| Node / pnpm | `v24.21.0` / `12.16.1` |
| Dependency lock SHA-256 | `cd84479f6cfb8bce47ded8a78b9d453a2c1c4daf766b28f090108f4ec0ec1252` |
| Dependencies | Existing installation; no install, version changes or upgrades |

The existing `runWork` function in [scripts/lib/work.ts](../../../scripts/lib/work.ts) ran this
explicit, temporary plan, named `p58-authoring-baseline`; it was not added to the profile registry:

```text
pnpm lint
pnpm typecheck
pnpm --filter @jeeves/web build
```

| Check | Actual result |
| --- | --- |
| Lint | Exit 0; `Checked 802 files in 377ms. No fixes applied.` Existing 2025 warnings / 75 infos; zero errors |
| Types | Exit 0 across all workspaces and `scripts/tsconfig.json` |
| Production web build | Exit 0; Vite 8.2.2, 7446 modules; existing chunk-size advisory |
| Frozen archives | All six `artifacts/` archive hashes match their manifests; all ten recipe artifact hashes match, too |
| Direct browser inspection | Mattermost contract sidebar and legacy resource generation selection, as detailed below |
| Full `pnpm check`, `pnpm test`, `pnpm work run check`, `unit all` | **Not run:** includes deferred UI assertions; no full-green claim |
| Focused semantic/runtime unit selectors below | **Not run:** inventoried for later assignments, not a P58 test campaign |
| Template conformance, application acceptance, Playwright suites | **Not run:** no Docker test fixtures, generation, provider calls or E2E suite execution |
| New backend foundation / benchmark profiles | **Unavailable:** documentation reservations only |

Raw baseline evidence is local and ignored, under the existing runner's `.jeeves-work/runs/`:
`2026-11-02T02-59-25-201Z-p58-authoring-baseline-ba368ebd.{json,log}`. The JSON records exact
argv/cwd, timestamps, each exit code, and identical before/after source fingerprints
(`sourceChanged: false`); the full run took 9.4 seconds. Local inventory and browser observations
are under `.jeeves-work/p58/`. These paths are evidence locations, not committed portable bundles.
No environment variables, credentials or private Settings contents were printed or copied.
An old runner result does not verify subsequent source/dependency/environment changes.

Available root scripts, read from [package.json](../../../package.json): `db:up`, `db:down`,
`dev`, `lint`, `format`, `typecheck`, `test`, `test:e2e`, `test:e2e:docker`, `test:templates`,
`qrwty:bootstrap`, `check`, `work`, `references`. `pnpm work list` currently lists 23 profiles:
`check`, `typecheck`, `unit`, `templates`, `browser`, `browser-preview`, `browser-docker`,
`browser-stream`, `browser-stream-chromium`, `qr-studio-recipe`, `template-upgrade`,
`generated-http-pool-browser`, `generated-http-pool`, `local-http-pool`, `local-execution`,
`session-isolation`, `resource-starter`, `generated-workspace`, `resource-workspace`,
`generated-events`, `durable-events`, `qrwty-product`, `qrwty-upgrade`. Availability is not a
P58 execution result. Commands that mutate storage or generate applications were not invoked.

## Direct browser observations

Inspected the built production assets in Chromium using a temporary loopback Vite preview and
the existing API handlers. The normal development API/web processes were unavailable at inspection
time. The inspection API used a PostgreSQL connection with `default_transaction_read_only=on`,
rejected non-GET/HEAD requests, and skipped the normal startup migrations, recovery and persistent
job runner. It used throwaway empty Settings, without loading private provider configuration.
Inspection processes were stopped afterward. No new project, application output or database
record was created; no live output directory was used.

| Existing project | Mouse inspection and observation |
| --- | --- |
| Mattermost · backend design review, `9928f0b6-c54c-4081-b8d4-5bdff0b5875c`, revision 1 | C3 server → Post service → expand CreatePost → Inspect contract. The internal command sidebar shows authorization, the limited Store.Post.Save transaction boundary, success/rejection/unknown outcomes and reconciliation. The selected referenced definition has Partial coverage and a protected operation shape. Behavior/outcomes expand, Cancel closes without saving, and reload retains the sidebar/contract navigation. |
| Fieldwork demo, `477e4122-f898-4678-a6b6-1787a105d655`, revision 2 | Existing Inventory owner-resource design → Editor actions → Generate code. Output-folder and baseline controls load; the fixed acceptance selector offers the existing packs. Selecting `qrwty` displays its named acceptance identities, then selecting None clears the draft. The drawer closes without invoking Generate project or persisting configuration. This demonstrates selection only, not suitability of the QR pack for Inventory or successful generation. |

Both workflows were inspected in light desktop (1440×1000) and dark narrow (390×844) views.
The completed inspection passed in 4.1 seconds with zero page errors, zero mutation requests,
unchanged response fingerprints and document widths of 1440/390px. The browser record includes
before/after response hashes for
the project list and both projects' design, layout and generation overview. Screenshots remain
under `.jeeves-work/p58/`; no screenshot clutter is committed. Save/undo/redo/conflict behavior
was not exercised because this package changes no authoring behavior and preserves saved state.

Runner evidence: `.jeeves-work/runs/2026-11-02T03-10-18-337Z-p58-browser-inspection-839ac0d8.{json,log}`
and `.jeeves-work/p58/browser.json`. Two earlier runner attempts (`03-08-00…0015f6a0` and
`03-09-13…5acce12b`) failed on the temporary driver's loading/selector assumptions; those failed
records remain. The first also flagged documentation changes during its run. The completed run
has `sourceChanged: false`; no repository test was changed to obtain it.

**Observed UI limitation:** at 390px the legacy Generate drawer's existing output log overlaps
form content (see local `legacy-narrow-dark-generation.png`). The acceptance selector can still
be changed, but this is not a clean narrow-layout pass. The current narrow rules in
[generate.css](../../../apps/web/src/generate/generate.css) govern `.generate-body`,
`.generate-side` and `.generate-log`. Record this for a separately assigned UI fix; P58 does not
repair it. This is a direct visual observation, distinct from the unrun suite risks below.

The Mattermost design currently has 30 error-level NEEDS_TEMPLATE findings: 13 components,
7 containers and 10 planned relationships. Its nine contracts remain partial. This is honest
design intent, not failed runtime execution. A future implementation matcher must account for
all three availability barriers without changing global `blocksGenerate` or deleting intent.
The existing qrwty design (`7dd44cfd-7fbc-4d5a-be79-41c8f58a8993`, revision 17) still uses the
legacy REST template and has no error-level findings. Neither observation proves runtime acceptance.

## Runtime and fixture compatibility boundary

The [built-in registry](../../../packages/registry/src/builtin.ts) and
[generator modules](../../../packages/generator/src/modules.ts) currently expose the same 14
exact template versions:

| Template | Versions |
| --- | --- |
| http-service | 0.1.0, 0.2.0, 0.3.0, 0.4.0 |
| rest-api-server | 0.1.0, 0.2.0 |
| web-app | 0.1.0, 0.2.0 |
| postgres, rest-api-client, durable-events, local-execution, local-http-pool, resource-workspace | 0.1.0 each |

These are template versions, not interchangeable runtime versions. In particular,
[rest-api-server/template.ts](../../../templates/rest-api-server/template.ts) maps template
0.1.0 to frozen `@jeeves/rest-server` **0.2.0**, and template 0.2.0 to runtime **0.3.0**.
The latter derives origin-specific session-cookie identity. Never replace the old archive or
silently upgrade a saved design; preserve the explicit [session transition](../../../templates/rest-api-server/session-transition.md).

All six frozen manifest/archive pairs under `artifacts/` are experimental:

| Runtime | Version | Archive SHA-256 |
| --- | --- | --- |
| @jeeves/rest-server | 0.2.0 | `33c6fcc3890335dfa39d659a029244ead363c17e65777079470c23c15f5381c6` |
| @jeeves/rest-server | 0.3.0 | `a1dace57d6381a93e07201fa5d64ea887488216a6399298b14ef82b111869fc6` |
| @jeeves/durable-events | 0.1.0 | `b0658fce9fbb692e317c54ded4c9b4fff3d4eb3c66b5d4b550947f67f60776fd` |
| @jeeves/http-pool | 0.1.0 | `f04ce4ade417f95aff87b89d73b02b096e731e411b7f1c2beac0234d6e17eaa5` |
| @jeeves/product-ui | 0.3.0 | `389791a7a18bf33bbd66fc0b62e8c52c9abedf22acd7ebd86c53f823d696a615` |
| @jeeves/resource-workspace | 0.1.0 | `dbe8b4579b75dfac42cb95a459ec4581436e06dfeb95c7fbd6fa09ec5b48488f` |

The other legacy source-packed runtimes remain `@jeeves/service-runtime`, `@jeeves/postgres-runtime`,
`@jeeves/web-runtime` and `@jeeves/rest-client` **0.1.0**. They do not acquire a frozen-artifact
guarantee from this report. The immutable [QR Studio recipe 0.1.0](../../../recipes/qr-studio/0.1.0/manifest.json)
also carries ten hash-pinned artifact copies: those five legacy runtimes (including REST 0.2.0),
frontend/service copies of artwork 0.1.0 and analytics 0.1.0, and product-ui 0.3.0. Preserve recipe
bytes and the separate explicit REST adoption path. Hash equality is not a fresh consumer test.

Preserve these concrete legacy fixtures and their existing expectations:

| Fixtures under `fixtures/designs/` | Compatibility responsibility / test selector |
| --- | --- |
| `link-shortener.json`, its layout; `incomplete.json`, `invalid.json` | Registry readiness versus structural errors: `packages/registry/src/fixtures.test.ts`; ordinary planning, ownership and generated files: `packages/generator/src/{plan,generate}.test.ts` |
| `resources.json` | Owner/internal resources, storage identities, contracts, migrations and extension ownership: `packages/spec/src/resources.test.ts`, `packages/generator/src/resources.test.ts` |
| `qrwty.json`, `qrwty-studio.json`, `qrwty-analytics.json`, `qrwty-architecture.json` | Legacy QR contracts/acceptance, exact recipe pins and architecture-only preservation: generator `qrwty.test.ts`, `recipes.test.ts`, `architecture.test.ts`, `session-isolation.test.ts` |
| `resource-workspace.json`, `generated-workspace.json` | Compiled and generated Inventory UI, descriptor/owned paths: generator `workspace.test.ts`, `starters.test.ts` |
| `event-orders.json`, `local-execution.json` | Durable attachment and finite local policies: generator `delivery.test.ts`, `local-execution.test.ts`, `http-pools.test.ts` |
| `fieldops-architecture.json`, `pattern-composition.json`, `relationship-policies.json`, `architecture-{review,scenarios,deployments}.json` | Saved planning intent and composition without runtime claims: corresponding spec tests plus generator `architecture.test.ts` |

These selectors are inventories, **not P58 passes**. The architecture-generation file specifically
asserts that metadata/contracts/policies/scenarios/review/deployment annotations remain in
`jeeves/design.json` while executable files, artifacts and ownership remain unchanged. Retain
that legacy contract when adding the opt-in backend compiler. The runtime resources/session tests
use injected storage; real PostgreSQL invariants require conformance, not a mock pass.

## Verification profiles and exact existing selectors

Profiles are check requirements, not new CLI aliases. The shared contract also defines D for
documentation/data: scoped links/anchors, applicable parsing/identity/arithmetic checks and
`git diff --check`; lint when repository-supported files change. P58 uses D plus A's baseline.

| Profile | Required commands and observations |
| --- | --- |
| A — authoring/UI | `pnpm lint`, `pnpm typecheck`, `pnpm --filter @jeeves/web build`; direct changed mouse workflows, reload/undo/conflict as applicable; light desktop and dark 390px view. Deferred UI suites stay deferred. |
| S — semantic/compiler | Lint/types plus exact offline semantic, old-design and deterministic-output selectors for the changed boundary. Production UI changes add A. The standing full-check conflict must be resolved as described below. |
| R — runtime | S plus real dependency conformance in disposable fixtures, generated consumer acceptance, exact archive and ownership checks. Never use a protected live output/database. |
| P — composition/proof | Relevant R checks plus the assigned foundation/benchmark/recovery/load/upgrade campaign; preserve raw failures and input fingerprints. Do not rerun unrelated campaigns. |

The runner accepts existing file paths, validates suffixes, and uses `--passWithNoTests=false`
for unit/template selectors. Do not substitute `unit all`, a directory glob or a reserved name
for a meaningful nonempty boundary. The following commands are exact **existing, unrun** selectors;
select the relevant group rather than running this entire inventory for every package.

Schema, stable references and evidence (S; no browser or external services):

```bash
pnpm work run unit packages/spec/src/schemas.test.ts packages/spec/src/apply.test.ts packages/spec/src/commands.test.ts packages/spec/src/validate.test.ts
pnpm work run unit packages/spec/src/architecture-contracts.test.ts packages/spec/src/architecture-bindings.test.ts packages/spec/src/planned-capabilities.test.ts packages/spec/src/resources.test.ts packages/spec/src/evidence.test.ts
pnpm work run unit packages/spec/src/architecture-library.test.ts packages/spec/src/architecture-patterns.test.ts packages/spec/src/architecture-targets.test.ts packages/spec/src/architecture-handoff.test.ts
```

Compiler, legacy generation, protected ownership and acceptance identity (S; temporary files and
Git are allowed, no Compose or real application generation):

```bash
pnpm work run unit packages/registry/src/registry.test.ts packages/registry/src/fixtures.test.ts packages/generator/src/architecture.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts
pnpm work run unit packages/generator/src/resources.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/behavior.test.ts packages/generator/src/recipes.test.ts packages/generator/src/session-isolation.test.ts
pnpm work run unit packages/template-kit/src/context.test.ts packages/template-kit/src/compose.test.ts packages/template-kit/src/test-pack.test.ts packages/orchestrator/src/seed.test.ts packages/orchestrator/src/agent.test.ts
```

Runtime logic using fake storage/injected requests (offline portion of R; these do **not** verify
a real database, separately running worker, provider protocol or generated consumer):

```bash
pnpm work run unit templates/rest-api-server/runtime/src/resources.test.ts templates/rest-api-server/runtime/src/sessions.test.ts templates/rest-api-server/runtime/src/plugin.test.ts templates/rest-api-server/runtime/src/verification.test.ts
pnpm work run unit templates/postgres/runtime/src/config.test.ts templates/postgres/runtime/src/dependency.test.ts templates/postgres/runtime/src/resource-migrate.test.ts packages/durable-events/src/delivery.test.ts
```

`templates/http-service/runtime/src/service.test.ts` and
`templates/rest-api-client/runtime/src/client.test.ts` are additional local runtime selectors;
the former opens loopback sockets. Do not describe it as zero-network verification. Server
route tests use in-process PGlite through `apps/server/src/test-support.ts`, not the dev Postgres;
select exact route files only when the assigned package changes them. No paid model is needed.

Existing real dependency and legacy consumer boundaries (R/P, **not run in P58**):

```bash
pnpm work run templates templates/postgres/conformance/postgres.conformance.ts templates/rest-api-server/conformance/rest-api-server.conformance.ts packages/generator/conformance/resources.conformance.ts
pnpm work run templates packages/generator/conformance/harness.conformance.ts packages/generator/conformance/baseline.conformance.ts packages/generator/conformance/verification.conformance.ts
pnpm work run templates packages/durable-events/conformance/durable-events.conformance.ts
pnpm work run session-isolation
pnpm work run generated-events
pnpm work run generated-workspace
pnpm work run generated-http-pool
pnpm work run template-upgrade
```

The last profiles also contain browser consumer checks: their presence is not permission to run
deferred editor E2E suites. Assign them only when their specific runtime/consumer boundary is in
scope and the execution policy is settled. Each fixture must own its output, database/volume,
ports and cleanup. Existing acceptance files under `fixtures/acceptance/` and the QR recipe remain
protected; no new benchmark application fixture or passing benchmark observation exists yet.

## Deferred assertions and the full-check entry constraint

The general [AGENTS](../../../AGENTS.md) / [PLAN §15](../../../PLAN.md#how-to-work-a-section)
rule requires full `pnpm check` for non-UI implementation. Its root script runs lint, types and
**all** Vitest projects; [vitest.config.ts](../../../vitest.config.ts) includes the web workspace
and UI runtime tests. Therefore `pnpm work run check` and `pnpm work run unit all` also reach the
deferred assertions. A focused backend pass is not a full-check pass.

The user's C2/C3 UI unit/E2E maintenance and execution deferral remains in force. This package
does not override it, alter `pnpm check`, exclude projects globally or repair assertions. **No
repository suite failures were observed in P58 because those suites were not executed.** Historical
handoff totals do not establish current green status. These concrete static risks remain unverified:

| Deferred location / expectation identity | Inventory and unverified risk |
| --- | --- |
| `apps/web/src/App.test.tsx` → `App shell > starts on Draw with the board toolbar and switches views by click` | Asserts tab `Draw`, toolbar `Drawing tools`, button `Project: Test design`; the inspected shell displays Design and the architecture studio. Suspected selector drift, not an observed test failure. |
| `apps/web/src/runs/RunsView.test.tsx` | Runs plan/edit/remove/cancel/settings/attempt UI assertions and two store-helper tests share one file. Do not select the whole file as backend-only verification. Current pass/fail unknown. |
| Other web unit files | `shell/views.test.ts`, `architecture/layout.test.ts`, `api-reference/extension-draft.test.ts`, `generate/store.test.ts`, `chat/store.test.ts`; `draw/{connect,container-notation,findings,flow,store}.test.ts`, `draw/edges/label-position.test.ts`, `draw/inspector/{configFields,resourceDraft}.test.ts`. Fifteen web files total including App/Runs; pure helpers still belong to the deferred web inventory unless an assignment explicitly scopes them. |
| Shared product/rendering units | `packages/product-ui/src/{ProductShell,CountChart,ConfigurationEditor}.test.tsx`, `templates/web-app/runtime/src/app.test.tsx`. Rendering, mouse controls and shell expectations; not backend semantics. |
| `apps/web/e2e/shell.spec.ts` → `loads the shell, reports a healthy server, and switches views` | Also expects Draw / Drawing tools; suspected drift, unrun. |
| `apps/web/e2e/helpers.ts` → `openNewProject` | Shared helper expects Drawing tools. Specs using it may stop before reaching their feature; unverified. |
| `apps/web/e2e/generate.spec.ts` → `generates the fixture into a folder, then stops on a hand-edited generated file` | Expects `Project: E2E generate` and top-level Generate; current route is Editor actions → Generate code. Unverified selector drift. |
| Remaining `apps/web/e2e/*.spec.ts` | All 41 spec files remain deferred, including contracts/bindings/library/targets/scenarios/handoff and resource-generation journeys. This report neither rewrites them nor labels them passing/failing. |

**Implementation-entry constraint:** before executing a non-UI implementation gate (starting
with P59, and certainly before the first R package P74a), resolve whether the user permits the
unchanged full check despite the UI execution deferral, or explicitly authorizes a scoped backend
gate while UI work remains deferred. Until then, full `pnpm check` is **not run / policy unresolved**.
If an allowed full run actually fails on legacy UI assertions, retain file and test-title IDs,
separate that blocker from new semantic results, and seek the narrow maintenance/scope decision.
Never convert the failure or omitted gate into a pass. P58 itself is complete under its explicit
D/A scope; resolving a future runtime gate is not a reason to change the user's UI instructions.

## Reserved future commands and remaining gaps

These exact names are **reserved in documentation only**, absent from `profiles` and root scripts.
Do not run them yet or add success-returning stubs:

| Future command | Registration boundary / required nonempty meaning |
| --- | --- |
| `pnpm work run backend-foundation` | P79: two freshly generated independent discussion/help-desk flows, real dependencies, access/atomicity/version/replay observations, fail-closed hook and regeneration/ownership proof |
| `pnpm work run benchmark` | Application foundation proofs P92/P98/P101: explicit named application/version selection, frozen ledger/fixture identities, all mandatory supplied-path observations and truthful remaining-work accounting |
| `pnpm work run benchmark-recovery` | P106a–c: named application fault scenarios, exact injection point and authoritative state observations; combined gate only after all children |
| `pnpm work run benchmark-load` | P107a–b: deterministic seeds and driver, measured environment/cardinality/rate/latency/error/resource results; smoke is not full workload evidence |
| `pnpm work run benchmark-upgrade` | P108a–b: seeded regeneration, immutable/additive migration and runtime/queue/calendar compatibility; protected hook preservation and tamper rejection |

When registering, require nonempty selectors and fail on missing/unknown applications, absent
fixtures, zero matched tests or interrupted runs. Use existing runner JSON/log locations. Bind
evidence to the actual design, ledger/contract, runtime/archive, generated source, dependency lock,
test pack, seed, database/image, command and environment inputs. Runner Git fingerprints alone
do not provide that complete environment identity. Keep raw observations and not-run/skipped
states separate from foundation/completed-application verdicts.

The [shared gap map](../../plans/backend-benchmarks/contract.md#1-inspected-baseline-and-gaps)
still applies: no machine-readable benchmark ledgers, pinned three-product reference packs,
independent backend contracts/fixtures, authoritative backend declarations, opt-in compiler,
backend host/worker, capability matcher or benchmark evaluator has been delivered by P58.
UX5's prose behavior and partial nested contract shapes remain design intent. Existing recorded
evidence is revision/output scoped; it cannot confer template points on future backend cases.
The planned 66/100 target is not measured current coverage.
