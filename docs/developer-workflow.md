# Repeatable maintenance work

Use the existing checks through a compact runner. This is local automation with no model calls, credentials configuration or additional server. It does not regenerate or deploy an application.

```bash
pnpm work list
pnpm work run unit packages/spec/src/commands.test.ts
pnpm work run unit packages/product-ui/src/ProductShell.test.tsx
pnpm work run templates packages/qr-artwork/conformance/svg.conformance.ts
pnpm work run browser apps/web/e2e/editor-interactions.spec.ts
pnpm work run browser-preview apps/web/e2e/architecture-layout.spec.ts
pnpm work run qrwty-product /home/ash/github/qrwty
pnpm work run qrwty-upgrade /absolute/old-checkout /absolute/upgraded-checkout
pnpm work run durable-events
pnpm work run generated-events
pnpm work run resource-workspace
pnpm work run session-isolation
pnpm work run generated-workspace
pnpm work run resource-starter
pnpm work run local-execution
pnpm work run local-http-pool
pnpm work run generated-http-pool
pnpm work run generated-http-pool-browser
pnpm work run browser-stream
pnpm work run browser-stream-chromium
pnpm work run template-upgrade
pnpm work run check
pnpm work status
```

`unit`, `templates`, `browser` and `browser-preview` require existing file paths or the explicit selection `all`. Arbitrary command-line options and shell fragments are not accepted. Unit selectors support `.test.ts` and `.test.tsx`; template selectors use `.conformance.ts`; browser selectors use `.spec.ts`. A nonmatching selection fails instead of reporting an empty passing suite. `browser-preview` first builds production web assets and serves them on the same isolated test ports/API using Vite preview; it verifies worker/chunk URLs through the selected strict journeys. It does not deploy a site. `browser` starts the existing Jeeves test database; `browser-docker` invokes the existing full Docker browser runner. `durable-events` takes no arguments and runs the focused transactional-delivery conformance fixture, with a temporary Postgres volume and automatic teardown. `generated-events` proves the generated event attachment in a disposable Orders service; `resource-workspace` proves the compiled account/resource UI against a disposable Inventory API and Postgres, including strict browser diagnostics and accessibility. `generated-workspace` proves actual diagram generation, template packs, protected composition, additive extras and a generated visual-preset change using the same bounded Inventory journey. `resource-starter` runs that bounded journey against the versioned starter factory and consumes its generated private environment, then proves regeneration preserves credentials. `local-execution` proves generated local resource ceilings, exact Docker settings, process-failure restart and bounded request/shutdown behavior on one disposable service. `template-upgrade` extends the starter journey with a reviewed HTTP version upgrade, unchanged existing output/private setup and explicit local-policy selection. `local-http-pool` consumes the frozen compiled pool component around a fresh generated Inventory app; it proves shared sessions/resources, no ambiguous-write replay, readiness exclusion, instance recreation, proxy limits/draining and the strict resource browser journey. Its topology and control routes are disposable fixture instrumentation. `generated-http-pool` exercises the actual diagram-selected Trio, reviewed source eligibility, per-instance HTTP/execution packs and strict resource journey. `generated-http-pool-browser` is the narrower browser-only diagnostic and explicitly leaves template packs unselected. These profiles take no arguments and clean their own isolated output. Template and product checks can build disposable containers and need Docker. Run independent packages sequentially.

`session-isolation` runs two independently generated owner-resource applications in one pinned
Firefox context, with separate loopback origins and storage. It verifies two-way login/logout
isolation, ordinary authentication/CSRF/ownership, a service restart, and a separately generated
legacy-to-new runtime transition against the same disposable database. Frozen archives, builds,
regeneration and protected output are checked; teardown removes only its own Compose projects.
The transition proves storage/protocol compatibility, not adoption into a protected live checkout.
See the [REST session transition](../templates/rest-api-server/session-transition.md).

Each invocation prints its log and JSON result paths under ignored `.jeeves-work/runs/`. The JSON records exact argv/cwd, timestamps, duration, per-command exit codes, final status and before/after Git fingerprints. Fingerprints include HEAD, tracked diff, index/status and untracked file content; ignored environment files are excluded by Git. They are evidence identifiers, not a build cache. No checks are skipped based on an earlier result. Fingerprints do not establish equality of installed dependencies, external services or environment variables; investigate those when reusing evidence.

Full child output stays in the local log rather than consuming conversation context. Read the relevant failure region or final test totals. Logs may contain whatever a test prints; they are ignored and created with owner-only file permissions. The JSON does not record environment variables. A source change during a run is flagged, and an incomplete `running` record after a hard kill never becomes a pass. `status` shows the latest twelve runs; it does not assert that an old result applies to current files.

Ctrl-C/termination is forwarded to the child process group. The qrwty verifier runs directly under Node and propagates cancellation through its fixture commands, then tears down its isolated Compose projects before returning. Other runners retain their own cleanup behavior. A hard kill, machine crash or Docker daemon failure can still require fixture cleanup; inspect the logged unique Compose project/file and remove only that fixture. Never use a blanket prune or remove the live qrwty/Jeeves data volumes.

## Architecture reference cache

```bash
pnpm references list
pnpm references fetch medusa
pnpm references fetch all
pnpm references verify all
```

The [catalog](reference/architecture-sources.json) pins selected source/license files to full commits and SHA-256. `fetch` downloads missing files from those GitHub commits and verifies existing files; `verify` is strictly offline. Both reject mismatches. Cache files live under ignored `.jeeves-work/references/<id>/<commit>/`. This never installs dependencies or executes upstream code. Use `rg` and narrow reads on the cached paths. The [architecture review](reference/enterprise-architecture.md) records inspected seams, costs, candidate contracts and deferred evidence.

To update a reference, deliberately inspect a new revision and its licenses, update hashes and the review together, and commit that provenance change. Do not silently follow a moving branch. Review permission/compatibility before copying code into a component; repository visibility is not sufficient authorization to reuse every path.

## Verification during product expansion

The user has deferred a comprehensive certification-style test campaign. The current C2/C3 UI
instruction also defers UI unit/E2E execution and maintenance: use lint, types, a production build
and direct browser inspection for that work. The general full `pnpm work run check` requirement
remains for non-UI implementation; it includes deferred web assertions, so it cannot be silently
replaced with a subset. [P58's baseline and entry constraint](evidence/p58/README.md#deferred-assertions-and-the-full-check-entry-constraint)
records the unresolved execution-policy decision before backend implementation. Its
[profiles and selectors](evidence/p58/README.md#verification-profiles-and-exact-existing-selectors)
distinguish authoring, offline semantics, real runtime conformance and composition proofs.

Select relevant boundary checks when schemas, authentication, migrations, rendering or browser
behavior change. Re-run only after new changes, failures or unresolved concerns justify it.
Record exact results and remaining gaps; do not expand a combinatorial suite or claim a template
is bug-free. The future `backend-foundation`, `benchmark`, `benchmark-recovery`, `benchmark-load`
and `benchmark-upgrade` names are [documentation reservations](evidence/p58/README.md#reserved-future-commands-and-remaining-gaps),
not registered commands. Register each only when its nonempty checks exist.

## Reviewed qrwty snapshot adoption

`pnpm --filter @jeeves/server exec tsx ../../packages/generator/scripts/generate-qrwty.ts /absolute/generated/checkout studio` (or `analytics`) applies the named reviewed fixture and fixed acceptance pack through the generator, preserves existing vendor bytes and explicitly adopts the required REST runtime pin. It does not copy project feature/UI implementations, change a live editor, create a database or run Compose. Use a disposable checkout and review before local adoption; `generate-qrwty-studio.ts` remains the P17-compatible alias. This is controlled consumer adoption, not yet the automatic product-recipe system.

## Streamed response browser diagnostics

P32's pooled resource journey explicitly uses pinned Playwright 1.63.0 / Firefox 155.0. Install its browser once with `pnpm exec playwright install firefox` (Chromium remains the Jeeves editor/default engine). `pnpm work run browser-stream` runs three controlled split no-store streams and two negative controls against the same strict collector, without Docker or an application. Genuine truncation and cancellation must remain detectable.

`pnpm work run browser-stream-chromium` runs the same diagnostic in Chromium and currently **exits nonzero**: the page reaches EOF, but Chromium reports `net::ERR_ABORTED`. This is the independently reproduced [upstream defect](https://github.com/microsoft/playwright/issues/42742). Local observations also reproduce it in Chromium 156.0.8078.4 and 156.0.8078.12, so no dependency was upgraded. The newer upstream fix should be checked with this small probe before retrying an expensive consumer. No successful claim is made for the failing Chromium stream case; old resource consumer profiles using default Chromium can encounter it. No collector suppression, cache weakening, native unbounded body reader or Worker was added. The frozen resource client keeps its byte/time bounds and no-store policy.
