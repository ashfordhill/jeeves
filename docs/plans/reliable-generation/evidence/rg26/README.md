# RG26 documentation verification

Documentation-only unit on accepted RG25 `3bfce24e1a0bac1bebd3b3d7f77f77c18c7a61db`.
The [owner handback](../../owner-handback.md) is the deliverable; RG26 completion awaits coordinator
acceptance in the one local commit with the assigned subject. The approved WD-after-RG26 queue
is preserved, unread and unexecuted here. No new implementation queue is proposed.

## Focused checks

- [Unit status map](unit-status.json): all 25 accepted hashes resolve on main with exact RG
  subjects; RG17 separately records the owner commit that absorbed source and its completion
  commit. RG26 uses its unique commit subject because an in-commit self hash is unavailable.
- [Documentation checks](checks.json): changed/new local links and fragments resolve; any
  inherited broken links are recorded separately, not counted as new failures. The append-only
  handoff retains the entire previous byte prefix. All own paths are documentation or focused
  text/JSON receipts. The initial link pass ran before `checks.json` and `preservation.txt`
  existed and reported those two missing targets; both were materialized before the final pass.
- Current guide claims were compared with actual public API emission, updater guards, private
  scaffold checker, product-SQL/runtime retention validation and accepted RG14/23/24/25 evidence.
  Specific corrections include current API8 acknowledgements, versioned product SQL, scoped
  authenticated Service targets, settings imports, continuous readiness and native evidence
  replacing future-checkpoint placeholders. Legacy overrides preserve bytes only; checker hashes
  and API migration still refuse them. Private legacy helpers are not a second hook runtime.
- Existing review limits/failures remain explicit: process-affine remote authority, refused secret
  checkpoints, finite cache/retention assumptions, unknown remote/refresh outcomes, guarded manual
  live legacy namespace conversion, stopped compatible updates and fixture-composition-only LOC.
  The original overly generous drain evaluation remains untouched, with corrected current evidence
  in the handback. No QRWTY diagram/rebuild/deployment was performed.
- Read-only [preservation](preservation.txt) and the focused receipt compare the 6348 pre-existing
  protected paths (root files, owner feedback/archive, field apps/exports, old evidence and frozen
  v1), exact original 28-path owner patch after archive mapping, accepted SQL/dependency assets,
  and 42 original container full-ID/name/state triples, 9 networks, 23 volumes and 43 images.

D11 explicitly permits focused link/status/evidence/preservation verification for RG26. No full
`pnpm check`, browser/E2E, build, native matrix or app/Docker stack was run solely for this prose.
The latest accepted code validation remains RG25's 145-file/1354-test check, 87/87 browser run,
web build, 54 focused tests and actual 75-file checker/TypeScript7.0.2. Existing lint information/
warnings, chunk advisory and earlier native failures remain in their original evidence; this
unit does not create a new code/runtime pass claim. No executable code, generated artifact,
dependency, root file, original app, old evidence, owner studio, live/paid call, push or deployment
changed here.


## Same-unit formatting correction — 2026-11-18

A downstream full check caught Biome formatting missed by RG26's initial focused checks:
three short assertion arrays in `checks.json` must be single-line. The targeted two-file
check reproduced that error, then `pnpm exec biome format --write` using the repository's actual
`tooling/biome.config.json` corrected only this formatting. Targeted Biome check passes for
`checks.json` and `unit-status.json`; parsed values in both are exactly unchanged, and the status
map is byte-for-byte unchanged. The original RG26 commit is amended with this correction and the
append-only handoff. Pending WD01 and owner paths retain their exact bytes/modes. No full check,
app/test stack, implementation change or WD work ran during this correction.
