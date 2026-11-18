# WD13 — workload secret file rotation

The starting runtime read its workload secret once in `workloadSettings`. The optional private
`JEEVES_WORKLOAD_SECRET_FILE` now selects an absolute path: validate its initial contents before
clients open, then read it inside every bounded token refresh. The old per-client credential
form remains a startup snapshot. Endpoints and the selected path remain startup configuration.

The refresh still uses one pending promise per audience, the same two-second dependency budget,
one-second failure cooldown, verified token expiry and monotonic cache deadline. File reads use
that dependency's cancellation signal. Later file failures become safe `IDENTITY_UNAVAILABLE`
errors; valid cached tokens retain exactly their existing fallback bounds. No issuer, audience,
RS256, caller, user, background-work, recovery-ticket or process-affinity check changed.

## Focused proof

Existing offline workload tests load emitted code with fake fetch and crypto-backed signed
tokens. Six new cases use real task-owned temporary files, removed after each case:

- Rotation between actual token requests changes the second POST's credential. A valid cached
  token avoids a request; eight concurrent refresh waiters share one request.
- Missing, directory, empty and oversized files after startup fail without issuer dispatch or
  process exit/log output. A valid token survives early-refresh failure; expired/absent tokens
  fail closed, cooldown applies, and replacing the file restores successful acquisition.
- Invalid initial paths/contents refuse configuration before any fetch. The real existing
  per-client file reader still supplies its startup snapshot after that file is changed.

The first focused run had five failures: four new assertions expected only the code instead of
the existing `Operation definite-failure: IDENTITY_UNAVAILABLE` message; the fifth exposed the
generated README's separate process inventory missing the new optional name. Both were corrected.
The deployment and browser tests passed in that run (59 tests); the affected workload/process
rerun passed 67/67. See the two compressed focused logs. The final full suite passed all 1,430 tests.

The independent deployment expectation includes the new name only for workload processes and
identity. The actual configuration-reader audit now covers eight TLS/legacy-file/rotating-file
branches per process. Process report and generated README inventories retain exact assertions.

## Export and pins

The public `export:v2` CLI exported the existing WD deployment source before and after the change
to task scratch directories: 94 files, zero findings, 12 unchanged required product gaps. Of those
94 payloads, 87 are byte-identical. The seven changed paths are recorded in
[output-review.json](output-review.json): workload runtime, generated README inventory, deployment
contract/guide, extension guide and provenance. Only catalog/front/identity gain the optional env
name. No application completeness is claimed.

The actual exported `scripts/check-extensions.mjs` passed API8 boundaries. The exported source
compiled with TypeScript 7.0.2 using existing dependencies; no install or network issuer was used.
All three processes-off fixture counts remain 82/89/62. Only the extension-guide hash and its
manifest entry changed for each fixture: [six reviewed deltas](pin-delta.json). No broad pin refresh.

## Required gates and preservation

- `pnpm check`: 153 files, 1,430 tests, 114.49 seconds; existing informational lint diagnostics.
- Native `pnpm test:e2e`: 89/89, 5.1 minutes; TinyURL and both unchanged mouse rebuilds pass.
- `pnpm --filter @jeeves/web build`: passed, 771 ms; existing chunk warning.

The gates ran sequentially on the final code. Their compressed logs are alongside this record.
[Preservation](preservation.json) records 7,388 unrelated starting byte/mode/absence states,
matching before/after full Docker inventories (42 container triples / 9 networks / 23 volumes /
43 images), both original E2E rows and free test ports. No task resource remains. Owner web PID
1124326 remains; the API child automatically reloaded from PID 768143 to 907676 after authorized
shared source edits. Neither owner service was controlled. The existing read-only
[RG21 audit](rg21-preservation.txt) passed with process-local Git abbreviation only.

WD12 stays stopped and studio wires stay off. No provider-specific identity, secret manager,
new authority, dependency, protected file edit, later unit, live issuer, push or deployment.
