# Production foundations: response to the review

**Date:** 2026-11-12. **Findings:** [review-findings.md](review-findings.md). **Plan:**
[units.md](units.md), revised the same day at `076d715`.

Every finding was addressed; none needed an owner decision, and D1–D8 are unchanged. The
revision was checked by running, not only reading: PF03, PF04 and PF05's code and test changes
were applied to a scratch copy of the repository, and the unit tests, the e2e suite, the web
build, Biome, the type checks and `pnpm eval:chat` were run on it. PF06's pin updater was run and
reproduced `processes-off.json` byte for byte. PF11's preservation check was run on v3 against
itself. PF12's harness preparation was run on the archive, and `pf.mjs`'s token-free steps
against a stub server. Nothing was run against Docker.

| # | Unit | Decision | Where in `units.md` |
| --- | --- | --- | --- |
| 1 | PF09 | Applied: an application's file never becomes generated (refused as `ownership changed`), a generated file with no previous record is `edited` even with equal bytes, and an override wins over equal hashes in both tables | PF09, the first rule and rows G1–G6, R1–R5; tests |
| 2 | PF09–PF10 | Applied: overrides in neither manifest are hashed (U1 `orphan`, U2 refused); pending shadows are an input, kept until the file equals the new bytes or the application deletes the shadow; no wholesale deletion of `.jeeves/generated/` | PF09 `pendingShadows`, rows E3, U1–U2, "Also"; PF10 steps 4 and 7, tests 9–10 |
| 3 | PF10 | Applied: both manifests' records and the override paths are validated, every target and parent is `lstat`-checked, and file/directory changes are refused, all before any write and also with `--check`; the "never touches" sentence names `.jeeves/manifest.json` and `.jeeves/generated/` | PF10 steps 2–5, last paragraph of 1; tests 7–8 |
| 4 | PF07 | Applied: an explicit state contract (generations, one timer, `closed`, change-only reports, guarded `onState`, late connect after close) and stalled-call tracking in the reader; tests for each race | PF07 steps 1–2, tests 1–8 |
| 5 | PF08 | Applied: `encode` covers the hooks, serialization and the size bound and returns `{ id, body }`; a skipped report is logged through a guarded `onSkippedReport`; the deadline sentence is the reviewer's, qualified on the sweep | PF08 step 1, wiring, test 1, docs |
| 6 | PF08 | Applied: single flight kept, `Promise<void>` types updated, `AggregateError` for item plus provider failures, product-attachment callers report failures | PF08 step 2, tests 2–3 |
| 7 | PF06 | Applied: separate guarded `onRelayError`; reporting for cache read and fill, multipart start and abort, `scope.fail` and drains; allowlist extended; `durability.test.ts:216` and `http-wiring.test.ts:387,392` named | PF06 steps 4, 6–9, tests 5–8, "Update these existing assertions" |
| 8 | PF03 | Applied, with two more e2e tests the review missed: no line-style repair is promised for direct-worker links, redraw commands only where they apply, the read-only "Source & diagnostics" fallback texts replaced, `planRemoveTile` checked through `strands` and an applied `removeTile`, and five e2e changes named | PF03 "What must be true afterwards", tests 3–5, both test tables |
| 9 | PF05 | Applied: the summary is tested through `Workspace.run`; the operation-selection test keeps its checks and asserts absence; the removed-name grep is recursive over production files only; the forced-review test switches to `getDesign` | PF05 step 2 and Done when |
| 10 | PF05 | Applied: `getDesign`, `validateDesign`, explicit and final reviews and the turn context are projected onto design findings plus `notSpecified`; saved-profile obligations are left out; owner selection is kept and stated; prompt and review texts named; the eval-replay sentence moved to PF03 (verified: live reports stop replaying at PF03, the scripted report at PF05) | PF05 Goal, step 1, docs; PF03 docs |
| 11 | PF12–PF13 | Applied: `mkdir` before extraction, a new `env.sh`, helpers sourcing their own `env.sh`, one fresh `runs/` for both script families, and a step script (`pf.mjs`) for A1–A6, B1–B4 and F1–F3 | PF12 Setup and tables, PF13 table |
| 12 | PF12–PF13 | Applied: the three sign-in routes named, counts polled every 250 ms for 10 s, search polled, explicit scale commands after `pnpm start`, logs read `--since` a boundary, throughput requests time out after 10 s and use `LOCAL_HTTP_PORT`; cache checks use `docker exec` (no TTY), as V3-17's `snapshot.sh` did | PF12 A1–A6, B1–B4; PF13 F1–F2, T1, `reads.mjs` |
| 13 | PF12–PF13 | Applied: one run; PF12 leaves its two-copy stack, PF13 reuses it and cleans up; F3 kills the transcoder seen running `ffmpeg`, and the stopped-before-delivery case is a separate F3b, never F3 | Phase E Docker rules, PF12 end, PF13 Setup and F3 |
| 14 | PF11 | Applied: byte comparison of every extension file and every app file absent from v3's manifest (a script), and override edits re-applied as checked patches | PF11 steps 6–7 |
| 15 | PF14 | Applied: the final `--check` must show nothing to create, replace or remove; an emitted-code fix needs v4 regenerated and retested, else the evidence is said to cover the earlier templates | PF14 steps 2 and 4 |
| 16 | PF04 | Applied differently: the two reference docs are not moved, so no link into or out of them breaks (moving them would also break links in `handoff.md` and an older plan, which may not be edited); each gets a "Retired" note. The removal and entry-move confirmations and the owner selection are stated exceptions in the Goal | PF04 Goal, step 5 |
| 17 | PF03, PF02 | Applied: `notification` leaves the action row; the three mode changes are named; the server's link-table preamble changes; "otherwise unused" replaced in both places | PF03 steps 2, 7, server code, CATALOG bullets; PF02 |
| 18 | Rules, PF06–PF08 | Applied: rule 7 saves the old pins, lists every changed path with a script before accepting new pins, and names assertion updates; rule 5 has the scratch-app exception; rule 6 has the Docker fallback | Rules 5, 6, 7 |

## Mismatches the review didn't list

- **PF03 breaks more tests than the plan said.** Fourteen unit tests in five files (one by the
  fallback-text change), including
  `jeeves-generator/src/v2/tile-processes.test.ts` (a service linked straight to Notifications)
  and the server's link-table test; and five e2e tests, two of them missed by the review
  (`spawn.spec.ts`: a service's fan greys Worker, and the every-kind test adds a Worker after
  Uploads). The plan's `grep -rln "async" …` matched 24 test files (every async function), and
  its `kind: "worker"` search missed the generator and Notifications. All are now named.
- **PF03's line-style and user-reaches-store fallbacks** tell the user to fix the line in
  Source & diagnostics, which is read-only; two tests pin those texts.
- **PF04 breaks two spec tests the plan didn't name**, in files it may not edit:
  `studio-rekey.test.ts` (the completeness walk loses the foundation's operation references) and
  `studio-warnings.test.ts` (a comparison with the foundation's ID no longer type-checks).
  `create-example.test.ts` was listed but needs no change.
- **PF04 leaves dead and false things:** `design-scope.css` and `ownership.css` (imported only by
  the deleted forms), `selectOperation` in `e2e/source.ts`, `Workspace.tsx`'s operation selection
  and its "Selected operation for chat" status, the Source & diagnostics paragraph in
  `docs/studio.md`'s Diagram PNG export, and CATALOG's sentence about what that dialog holds.
- **PF05 deletions leave unused imports**, which fail the type check; the three mixed mouse/chat
  route tests would have lost their mouse coverage if deleted whole. `docs/studio-settings.md`
  and `jeeves/PLAN.md` also named `configureDesignScope`.
- **PF05's Goal contradicted itself:** it kept `declaredAccess` and the `notSpecified` note while
  saying chat's context names no ownership declarations.
- **PF06's docs bullet** said "the five things" and listed four.
- **PF04:** `jeeves/CATALOG.md` already says "three studies" (the plan said to change it to that).
- **PF08:** `multipart.test.ts` (lines 222–225) also calls `sweep()`.

## Remaining risk

PF07 (the reconnecting client and its races) and PF09–PF10 (the updater) are new logic with no
trial run: the plan gives their contracts and tests, not code. PF12–PF13 depend on a live stack
that nothing in this revision started.
