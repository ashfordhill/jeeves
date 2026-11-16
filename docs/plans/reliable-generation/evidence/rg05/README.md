# RG05 — checked callable bindings and stable identities

**Verified; awaiting coordinator acceptance.** Baseline: accepted RG04
`ac251e7a8754ea8ecddada6c17a70299ad2a238d`. Extension API is now **v5**. This unit installs
only the existing Favorites callable adapter; rate limiting/cache semantics, SQL handles and
new authenticated cross-process transports remain unavailable for their assigned units.

## Implemented boundary

- A Custom module's optional **call** slot connects by mouse or chat to a complete Favorites
  module in its own tile. The existing serializable slot model carries exact named/versioned
  input/output/effect requirements. Normal authoring and resolution independently compare them
  against installed adapters and name any mismatch. Incomplete callees and other module kinds
  refuse. Existing unsupported template-part links keep their explicit gaps.
- Generated `.slots.ts` exposes a typed `FavoritesCapability`, declared operation contracts and
  stable `<module>.favorites.<operation>@1` targets. `client-wiring.ts` binds that handle lazily
  to the process's one constructed Favorites core, before readiness. The four operations require
  no handwritten URL or private implementation import. The existing Favorites selection alone
  mounts its HTTP routes; adding the call link changes no route address or route count.
- HTTP and direct calls share `invokeFavorites`: live context, authenticated subject, strict
  bounded input, effect authority and output validation. Direct callers cannot supply a subject;
  the generated runtime carries it from the tile's verified caller. Read authority cannot widen
  to mutation. Expired context refuses before dispatch. Existing core account isolation and
  eligibility checks remain in force; cancellation does not prove rollback.
- The finite Zod `favoritesDtoContracts` in emitted `src/runtime/favorites.ts` is the single DTO
  shape source. Its keys match the RG01 installed input/output names. Public inputs/results use
  `z.input`/`z.output`; runtime uses those same strict schemas. Output parsing rejects extra fields,
  copies values, and freezes every nested DTO. Only the five required Favorites data forms exist;
  there is no schema language in diagrams or distributed registry.
- `src/contracts/` is the one application-owned shared DTO/pure-definition directory. The checker
  follows it independently and transitively, refuses effects and process-private imports, and
  permits public contract imports across processes. Same-service helpers stay in their module
  directory. v5 migration moves older shared `src/helpers/` definitions into `src/contracts/`.
- Every display rename now preserves source/owner/process/module/selection IDs, targets, durable
  namespaces and handwritten paths, including newly created diagrams. Explicit raw rekey refuses
  with a migration requirement. Import/reference utilities remain readable. History restores
  stored snapshots, including historical IDs; it does not replay the newly refused operation.
- The actual export updater checks verified prior normalized identity records even at the same
  API version. Removed/replaced existing process, selection, resource and caller namespaces
  refuse with relevant identities/hook paths. Additions are allowed. Export to a fresh directory
  and migrate application/data explicitly; `--ack-extension-api` cannot bypass this refusal.
  Label-only updates retain handwritten hook bytes. No general data migration engine was added.

v4-to-v5 updates require explicit `--ack-extension-api=5` and staged checker/TypeScript validation.
Hooks, old exports and frozen v1 are never rewritten. The generated extension guide names the
new handle, directory and identity contracts. Studio/settings/blueprint/catalog guidance and
mouse/chat/Undo expectations now describe label-stable IDs.

## Checks actually run

All commands used Node **24.21.0**.

| Check | Result |
| --- | --- |
| Final `pnpm check` | Exit 0: Biome, all workspace types, **123 files / 1,107 tests passed**. `/tmp/jeeves-rg05-check-verified.log`. |
| Focused binding, real Favorites core, migration and authoring | Final binding/core/migration **20 passed**; parity/migration **25 passed**; stable draft **9 passed**; historical update **46 passed**. Included again in final full run. `/tmp/jeeves-rg05-binding-final.log`, `/tmp/jeeves-rg05-final-focused.log`, `/tmp/jeeves-rg05-store.log`, `/tmp/jeeves-rg05-update-targeted.log`. |
| Fresh scratch generation | Callable **66**, sign-in **80**, search **81**, Favorites **64**, video **116**, stubs **86** files: each emitted checker and pinned TS **7.0.2** passes offline. Callable handwritten body and shared contract are installed in scratch. Negative compilation rejects numeric `itemId`, array mutation and result-field assignment. [Compiler evidence](emitted-compile.txt), [file records](fixtures.json). |
| Processes-off pins | **79→79, 85→85, 59→59**; no added/removed files. Changed extension guide/version metadata, checker, public API header and operation effect boundary; stub slots also describe the new unconnected call slot. [Reviewed paths](pins.json). Frozen v1 untouched. |
| `pnpm --filter @jeeves/web build` | Exit 0, existing chunk-size warning. `/tmp/jeeves-rg05-build-final.log`. |
| Full `pnpm test:e2e` | **73 passed / 2 failed (6.3 min)**: new callable assertion/setup and historical pool Undo focus. TinyURL, preview/download, stable-ID mouse case and both long YouTube mouse rebuilds passed. `/tmp/jeeves-rg05-e2e.log`. |
| Targeted browser completion | Historical Undo passed unchanged (**1**, 15.1 s). Callable final **1 passed (8.8 s)**: wrong-target reason/unchanged revision, row-to-row connection/gutter arrow, exact blueprint link, Runnable processes enabled and persisted by mouse, exactly four existing Favorites routes. `/tmp/jeeves-rg05-e2e-targeted.log`, `/tmp/jeeves-rg05-e2e-callable-verified.log`. |
| `pnpm eval:chat` | Exit 0, network disabled. Existing scripted/replay suites pass with unchanged scores: good **100/100/100/review 100**; patterns **86.3/98.2/98.2**; bad **1.7/18.5/18.5/review 5**. All twelve RF06 arms deterministic. [Exact offline output](offline-evals.txt). No model-quality or paid/live claim. |

The first required regression reached 1,102 passes and four obsolete API/automatic-rekey
expectations; they were updated to the deliberate new contract and targeted cases passed.
An earlier strict typecheck caught an unknown test error value; it was narrowed explicitly.
Initial emitted compilation caught four implicit input annotations; the template was corrected.
A later successful full check was repeated only after the meaningful shared-directory tightening.

The new browser test first looked for generator capability records in the read-only blueprint;
it now checks the exact component link there and keeps the route-count proof in preview. Study
seeding intentionally omits generation, so the test enables Runnable processes through its normal
checkbox and checks persisted source. The controlled checkbox saves asynchronously: using the
established mouse `click` plus eventual checked/source assertions avoids Playwright `check`'s
immediate-state race. No timeout, refusal, type guarantee or assertion was weakened.

## Preservation and limits

Root hashes match `/tmp/jeeves-rg-resume-root-files.json`; the owner binary diff matches
`/tmp/jeeves-rg-owner-diff.patch`, including feedback/Zone.Identifier and the three protected mode
changes. Unit `git diff --check` passes. Scratch exports were removed in `finally`; pinned
installed dependencies were symlinked read-only, with no install or historical export change.
Before/after running Docker inventory is only `c0fbbc2996fe jeeves-postgres-1`, PostgreSQL at
`127.0.0.1:54329`. No task Docker resource, owner studio port, push or deployment was used.

This is an isolated generated caller/core/adapter proof, not a generated-system checkpoint or
provider/two-copy certification. New cross-process callable transport remains unavailable until
mandatory service identity exists. Shared/import checks target cooperative mistakes, not hostile
JavaScript. Explicit identity/data migration is intentionally outside the updater's supported path.
