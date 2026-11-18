# RG25 recoverable progress

Review starts at accepted RG24 `ed996447993d09f7e8736ebe01074d1691d7c3d1`, following
RG23 `99396d1b63b89b9ec2bc1ebaab3f8f5af6418b17`. Contract/amendment, RG14/23/24 evidence,
current authoring/public API/runtime/SQL/update source and retained actual RG24 emitted snapshots
have been inspected. No architectural blocker found so far. RG25 only; no delegation/later brief.

All 83 link and 72 catalog generated scaffolds match their retained manifests. Inspected core
runtime bytes match current templates. Original roots/current owner README, original owner patch,
42 container triples, accepted SQL/dependencies and frozen v1 pass the read-only RG21 audit.

One bounded finding: the actual API8 export's SQL migration guidance still supplies
`--ack-extension-api=7` twice; the actual updater requires target8. Correction will derive the
commands from the emitted target version and add an emitted-guide regression. No runtime change.

Remaining: demonstrate regression, correct guidance, inspect exact pin/emitted deltas, run D11
check/browser/build and actual export checker/TypeScript7.0.2, finish focused evidence/preservation
audit, write review/recommendation, append completion handoff and make one explicit-path commit.
No native fault rerun is justified for this guidance-only change. No push/deployment.

Completion: stale commands are corrected, focused54/54 and actual exported checker/TS7.0.2 pass;
pnpm check145files/1354tests, browser87/87 and web build pass. Both actual snapshot regenerations
retain every runtime/README byte; changes are guide plus provenance. Selected native evidence,
original roots/owner patch/42 container triples/9 networks/23 volumes/43 images and two old e2e
project identities are verified. No native fault rerun or runtime correction was needed.
Final recommendation and limits: [review](review.md). One explicit-path local commit follows.
