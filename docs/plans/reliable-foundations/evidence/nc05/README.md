# NC05 evidence

Final frozen source passes `pnpm check` (344 tests / 42 files, Biome and every typecheck),
`pnpm test:e2e` (29 native Chromium tests, 47.7s), and web production build (existing chunk advisory).
The first full check's only failure was PGlite startup plus the new chat/report integration test
exceeding the default 5-second timeout at 7.38s under full-suite parallel startup. That one
integration test now uses the existing operation-route-test bound of 15s. No assertions were
removed. `check.log.gz` retains that first failure; `check-final.log.gz` is the passing frozen run.

`results.json` records both 1440×900 and 1280×800 mouse runs, zero console/page errors and all
scratch project deletions (204). The fourteen PNGs show default legacy/incomplete report,
canonical edge target, narrow valid/complete/unavailable/none report, settled expanded operation
selection, required custom blocker, unknown profile blocker and explicit unsupported extra owner.
Operation, role, relationship and owner selections reach actual POST input and the new persisted
chat turn; each scripted turn executes `readReadiness`. Full export is unchanged by report,
selection, focus and Fit; custom/unknown/extra-owner changes remain explicit and one Undo/reload
restores the prior declarations/report. Product never receives a positive artifact resolver.

The first walkthrough helper checked chat history after seeing the prior completed turn, before
the new turn had appeared. The actual POST selection was already correct; the failure was in the
history assertion. The helper now waits for the new turn count and its done status.
`walkthrough.log.gz` / `results-history-race.json` retain the failed attempt; final evidence is
`walkthrough-second.log.gz` / `results.json`. This was not hidden as a product bug or a passing run.

The narrow isolated fixture declares legacy writer fields independently of its explicit logical
access. Those are fixture inputs, not a product migration or inferred permission. Current topology
warnings still use only legacy writer/access and can warn “no owner/writer” despite explicit
source authority/write grants when those legacy fields are absent. NC06 should resolve that
warning presentation using declared access with legacy fallback, rather than copying fixture
legacy fields merely to silence warnings. Separate read/publish ports, return arrows, YouTube
semantics, fitted-overview readability and owner usability acceptance remain open.

`audit.json` measures actual strict provider schemas. New `readReadiness` is 0 properties /
0 enum values / depth 1, 462 bytes; the giant command union remains 427 / 538 / 9. Same default
schema2 TinyURL instructions/context/strict-tools increase by 493 / 383 / 463 UTF-8 bytes from
committed NC04 `audit-before.json`. These are bytes, not tokens, cost, latency or quality claims.
The full suite includes the fetch-forbidden deterministic synthetic replay of all twelve case/arm
pairs through real loops. `replay-drift.json` shows old RF06's first request now hashes differently
before recorded responses can replay. Old as-run records remain untouched; Mini/live acceptance
and historical effort overhead remain open. No paid or live model call was made.

`raw-evidence.json` identifies losslessly compressed original logs and helper scripts with byte
counts and SHA256. The original raw files remain in `/tmp/jeeves-nc05-browser/`. Snapshot equality,
artifact mismatch and positive trusted fixtures check declarations and trust wiring only; they
are not generated software or runtime HTTP/adapter/concurrency evidence.

Scratch API 4312 / web 4302 used an isolated settings directory, scripted model and `jeeves_e2e`.
Owned projects were deleted; that database retains only its default TinyURL. Only owned listeners
and scratch settings were removed. `listeners-final.txt` retains owner 4300/4310 listeners;
`owner-projects-final.json` remains TinyURL revision 53, YouTube 1 and Marketplace 1.
