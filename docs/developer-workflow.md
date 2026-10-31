# Repeatable maintenance work

Use the existing checks through a compact runner. This is local automation with no model calls, credentials configuration or additional server. It does not regenerate or deploy an application.

```bash
pnpm work list
pnpm work run unit packages/spec/src/commands.test.ts
pnpm work run unit packages/product-ui/src/ProductShell.test.tsx
pnpm work run templates packages/qr-artwork/conformance/svg.conformance.ts
pnpm work run browser apps/web/e2e/editor-interactions.spec.ts
pnpm work run qrwty-product /home/ash/github/qrwty
pnpm work run qrwty-upgrade /absolute/old-checkout /absolute/upgraded-checkout
pnpm work run durable-events
pnpm work run generated-events
pnpm work run resource-workspace
pnpm work run generated-workspace
pnpm work run resource-starter
pnpm work run check
pnpm work status
```

`unit`, `templates` and `browser` require existing file paths or the explicit selection `all`. Arbitrary command-line options and shell fragments are not accepted. Unit selectors support `.test.ts` and `.test.tsx`; template selectors use `.conformance.ts`; browser selectors use `.spec.ts`. A nonmatching selection fails instead of reporting an empty passing suite. `browser` starts the existing Jeeves test database; `browser-docker` invokes the existing full Docker browser runner. `durable-events` takes no arguments and runs the focused transactional-delivery conformance fixture, with a temporary Postgres volume and automatic teardown. `generated-events` proves the generated event attachment in a disposable Orders service; `resource-workspace` proves the compiled account/resource UI against a disposable Inventory API and Postgres, including strict browser diagnostics and accessibility. `generated-workspace` proves actual diagram generation, template packs, protected composition, additive extras and a generated visual-preset change using the same bounded Inventory journey. `resource-starter` runs that bounded journey against the versioned starter factory and consumes its generated private environment, then proves regeneration preserves credentials. These profiles take no arguments and clean their own isolated output. Template and product checks can build disposable containers and need Docker. Run independent packages sequentially.

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

The user has deferred a comprehensive certification-style test campaign. Run focused checks while changing behavior and one required `pnpm work run check` before each package handoff. Select relevant boundary checks when schemas, authentication, migrations, rendering or browser behavior change. Re-run only after new changes, failures or unresolved concerns justify it. Record exact results and remaining gaps; do not spend implementation time expanding a combinatorial suite or claim a template is bug-free.

## Reviewed qrwty snapshot adoption

`pnpm --filter @jeeves/server exec tsx ../../packages/generator/scripts/generate-qrwty.ts /absolute/generated/checkout studio` (or `analytics`) applies the named reviewed fixture and fixed acceptance pack through the generator, preserves existing vendor bytes and explicitly adopts the required REST runtime pin. It does not copy project feature/UI implementations, change a live editor, create a database or run Compose. Use a disposable checkout and review before local adoption; `generate-qrwty-studio.ts` remains the P17-compatible alias. This is controlled consumer adoption, not yet the automatic product-recipe system.
