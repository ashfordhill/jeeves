# RG02 — recoverable implementation and verification

**Implementation verified; awaiting coordinator acceptance.** Required `pnpm check` now passes
121 files / 1,083 tests after the owner approved the exact RG01 fixture formatting exception.
Baseline: `895d3260fb16a21c0e73e4d68973a224ec233eae`. This updates the status in
[pause.md](pause.md), preserving that earlier handoff. No later unit ran.

## Reviewable implementation

- Extension API **2 (`checked-extensions`)** installs `src/extension-api/index.ts` and the
  application-owned `src/contracts/index.ts`. Product callbacks receive copied/frozen DTO objects;
  policy returns are synchronous. Generated bridges retain guard/transaction/credential/lifecycle
  authority and adapt asset/upload callbacks once. Request headers use a finite safe allowlist;
  raw bytes are copied and the live AbortSignal is preserved separately.
- Custom SQL/token/arbitrary HTTP target code has selection-specific required gaps. Cache loaders
  receive an unavailable `ProductQueries` handle and an accurately located gap. Registered SQL,
  authenticated transport and later-unit mechanisms are not claimed. Historical v1 exports
  require explicit acknowledgement and staged interface/boundary validation before migration.
- Each process owns configuration validation, memoized construction, readiness, cancellation and
  reverse construction-order cleanup. Compatible physical SQL/cache/object/search/publisher
  clients share only within that process. Complete configuration and credential identity determine
  physical scope; another login/configuration/process does not share its pool. Cleanup runs once.
- Shutdown stops admission, signals cancellation and drains within **10 seconds from first stop**,
  including unfinished startup. Late admission registration stops immediately. HTTP stop remains
  terminal before start, during initialization and while listen is pending. A hung hook logs
  `shutdown-deadline` and exits 1; this never proves rollback or absence of external effects.
- Exported `scripts/check-extensions.mjs` uses the installed TypeScript scanner, rejecting private
  runtime/driver/cross-service imports, forbidden policy effects (including imported helpers) and
  generated-file edits. Contracts/pure helpers remain allowed. It checks cooperative mistakes,
  not hostile JavaScript. New-export build runs it; Docker copies the complete export/checker/
  manifest before build and excludes dependencies, runtime state and `.env` files.

## Mechanism and regeneration evidence

The emitted-runtime lifecycle tests cover one-time construction, separate process state, partial
startup cleanup, repeated shutdown, cancellation, late admission and actual child termination at
a shortened final bound. Boundary fixtures distinguish allowed contracts/helpers from forbidden
imports/effects and manual generated edits, naming the file/API.

The actual emitted template `service-resources.ts` and stub `module-clients.ts` are tested together
on recording providers: matching configuration/login creates **one pool**; another pool size,
reader credential and process create three separate pools; all four close once. A failed second
initializer closes both opened pools; cancellation settles an emitted pending probe and closes
its pool. Existing emitted-process tests still fail invalid declared settings before construction/
probes. Actual HTTP adapter tests cover safe headers, copied nested DTOs, raw bytes and cancellation;
terminal stop is tested before start, during initialization and during pending listen.

Five real scratch exports pass the standalone boundary checker and pinned **TypeScript 7.0.2**
`--noEmit` compiler: sign-in **78 files**, search **79**, Favorites **62**, module-authored video
**114**, and stub stack **84**. Template-only fixtures catch public exports referencing uninstalled
entry files; that emitter defect was corrected. Available installed dependencies were symlinked
read-only; no install or historical app edit occurred. Scratch roots were removed in `finally`.
[Fixture records](fixtures.json), [actual output](emitted-compile.txt); session driver:
`/tmp/jeeves-rg02-compile.ts`.

Reviewed processes-off pins: **74→77, 80→83, 55→58**. Each adds exactly checker/public API/contracts.
Other substantive changes are restricted stubs, lifecycle/resources, build context/script and guide;
metadata records API v2/custom gaps. [Changed paths](pins.json). Frozen v1 and old exports
are unchanged; historical evidence changes only by the approved RG01 whitespace correction. Project-level generator guidance describes the new boundary; root files are untouched.

## Actual checks

All commands used Node **24.21.0**. The final required `pnpm check` passes.

| Check | Actual result / log in `/tmp/` |
| --- | --- |
| Final required `pnpm check` | Exit 0: Biome, every package typecheck, 121 test files / 1,083 tests. `jeeves-rg02-check-approved.log`. Existing informational lint message remains. |
| Earlier lint blocker | Protected RG01 `fixture.json` formatting stopped the earlier check before types/tests. `jeeves-rg02-check-final.log`, `jeeves-rg02-lint-blocked-final.log`. Resolved by the exact owner-approved whitespace-only exception below. |
| Final independent typecheck | Exit 0, every package. `jeeves-rg02-typecheck-completed.log`. |
| First broad units | 1,067 passed / 15 failed affected API/scaffold/fake expectations, diagnosed and corrected. `jeeves-rg02-unit-final.log`. |
| Affected targeted reruns | 91 passed / 2 exact expectation failures, then 80 passed after correction (overlapping cases). `jeeves-rg02-regression-focused.log`, `jeeves-rg02-regression-focused2.log`. Earlier wiring/lifecycle run: 121 passed, `jeeves-rg02-focused8.log`. |
| Final independent units | 1,082 passed / 1 unchanged board drag assertion failed, 121 files. `jeeves-rg02-unit-completed.log`. Exact failed case then passed, 14 skipped, without board edits: `jeeves-rg02-board-targeted.log`. It also passed in the preceding broad run. |
| Web build | Exit 0; existing chunk-size warning. `jeeves-rg02-web-build.log`. |
| Standard e2e | 73 passed / 1 stale required-gap count (9 rather than 10). `jeeves-rg02-e2e-final.log`. |
| Corrected mouse case | 1 passed (7.3 s): new loader gap/source path, collapse/reopen by mouse, ZIP tamper refusal and successful download. `jeeves-rg02-e2e-targeted.log`. The 73 successful cases were not repeated. |
| Fresh export checker/compiler | All five pass. `jeeves-rg02-emitted-compile-expanded.log`. |

Existing browser cases loaded the app/TinyURL lane canvas and exercised mouse authoring and
scripted chat. No authoring commands changed, paid eval or generated-system Docker checkpoint ran.
Root hashes and the owner's binary diff match initial snapshots. Docker before/after inventory is
identical: only `c0fbbc2996fe jeeves-postgres-1`, PostgreSQL 17 Alpine on `127.0.0.1:54329`.
Owner ports 4300/4310 and unrelated feedback/mode changes are preserved. No task resources remain.

## Approved exception and handback

On 2026-11-16 the owner approved the exact whitespace-only RG01 fixture correction previewed in
`/tmp/jeeves-rg01-fixture-format-preview.{json,diff}`. Before applying it, the original SHA-256
`17545fc9b9b78b742c454f750bd6a5972b9325b4235948e3cb4455106401f9d1`, parsed JSON equality
and identical non-whitespace bytes were verified. The resulting SHA-256 is
`d934c7ffa70c2d79205803431c6d9562d7e9d984c2d5b20a5371dca08dea90f8`.
The [dated owner amendment](../../README.md#owner-amendment--2026-11-16) records execution
authorization, superseded stale queues and the sole historical-evidence exception. Root files,
other protected paths and owner changes remain preserved. No assertion or lint rule was weakened.

The final required check passed after that correction. E2e/build/five-export proofs were not
repeated because this resume changed only approved formatting and documentation. The unit is
handed back in one explicit-path local commit with subject
`RG02: unify process lifecycle and restrict application extension APIs`; coordinator acceptance
is still required before any next unit. No push/deployment occurred and no task command remains
running.
