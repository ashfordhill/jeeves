# GS05: real identity and durable favorites

Recorded 2026-11-13 above `6b80f04`. Local evidence only; hosted CI remains pending
publication. No template, generated scaffold, dependency pin, historical field application or
studio UI changed. Manual CI offers `identity`; core remains the PR gate.


| Verification | Result | Full artifacts / logs |
| --- | --- | --- |
| Identity B07 | 1/1; 102.216 s Vitest, 121.212 s including cleanup | `/tmp/gs05-identity-confirmed`; `/tmp/gs05-identity-confirmed-command.log` |
| Core B01–B04 | 4/4; 232.83 s Vitest, 283.045 s including cleanup | `/tmp/gs05-core-final`; `/tmp/gs05-core-final-command.log` |
| Repository checks | Lint/typechecks; 823 tests / 106 files | `/tmp/gs05-check-final.log` |
| Browser E2E | 73/73, 4.7 min | `/tmp/gs05-e2e-final.log` |
| Web build / workflow | Passed; actionlint syntax/context validation | `/tmp/gs05-web-build-final.log`; `/tmp/gs05-workflow-validation.log` |
| Privacy | Three offline tests and real scoped recovery probe passed | `/tmp/gs05-privacy-unit-final.log`; `/tmp/gs05-privacy-final` |

`verification.json` records log hashes. Final Identity/core effective source is identical;
`source-boundary.json` distinguishes the two harness corrections and a public-name alias in
previously sanitized metadata. All three original Identity reports/manifests are byte-identical.
`cleanup-audit.json` independently rechecks exact Docker labels and absence of temporary files:
each Identity run removed five containers, one network and one volume; core removed twenty-seven
containers, four networks and eight volumes. Current Identity has fourteen parseable JSON
artifacts and unchanged scaffolds. Standard phases ran serially; no retry or skip was added.

The saved Identity graph reuses `favoritesStackDesign` and Sign-in's Optional guard command:
Account API has Required sign-in, Favorites and its catalog dependencies; Viewer API has
Optional sign-in against the same real Keycloak realm. `authoring-proof.json` compares the
saved graph with the maintained command source. Its three owned attachments are one eligibility
hook, one catalog stub body and product SQL for a tiny catalog/published view. Original reports
and manifests stay unchanged and retain both required custom gaps. Every run exports anew using
the default registry, checks installed selections, performs a frozen standalone install/build
in OS temporary storage and runs the pinned generated edge/processes/providers.

B07 creates two disposable users through the local Keycloak admin API, then follows the actual
authorization-code PKCE S256 browser flow using maintained typed source adapted from the
archived v3-17 harness. Edge requests use signed account tokens, never an injected principal.
Missing/malformed/signature-tampered tokens fail Required routes; Optional accepts anonymous
and refuses invalid tokens. Signed subjects match independent admin-created user IDs.

Repeated PUT returns the exact same favorite and creation timestamp, with one independently
observed SQL row. GET/list return that favorite; B's list/check cannot see it, and B's DELETE
returns the documented 204 while A's row stays intact. Missing and unpublished items return
404 NOT_ELIGIBLE. Ordinary `pnpm stop` / `pnpm start` retains history bytes, secret hashes,
provider volume identity, both Keycloak user IDs/passwords and the favorite's creation time.
Fresh sign-ins and a new favorite succeed after restart; repeated DELETE is 204, GET becomes
404 NOT_FAVORITE and lists/SQL reflect removal. No generated auth/favorites mechanism is
implemented by the owned fixture.

## Retained failures and evidence correction

`first-observer-failure/` preserves the first real run: guard and isolation checks succeeded,
then the observer expected `code` where the established HTTP error contract uses `error` for
NOT_ELIGIBLE. The observer property was corrected; the application invariant stayed the same.

`capture-failure/` preserves the next run, which reached and passed all application assertions,
including saved `restart-preservation.json`, then failed evidence capture. The prior sanitizer
registered the generated realm's public strings `true`/`false` and replaced JSON boolean literals,
so `Application.capture` could not parse its sanitized observations. That also prevented capture
in the first run behind its original assertion failure. No failure was hidden or treated as a
pass; malformed original reporter JSON is retained compressed, without trying to repair it.
Both failed runs exited 1 and removed their exact scoped resources and private runtime.

The harness now preserves JSON types/escaping while redacting string keys/values. Truncated
reporter JSON falls back to scrubbed text, so an interrupted reporter cannot block cleanup.
Generated public realm-definition metadata is not treated as credential substrings; actual JSON
credential members, original secret-file bytes and transient identity credentials remain covered.
Offline regression tests exercise a string password literally `true`, opaque JSON credentials,
safe booleans/numbers/null/public realm names, truncated JSON, and malformed/symlink private
redaction inputs. This was a harness defect, not a template gap; no generated output was patched.

## Privacy and cleanup

The mode-0600 private `<application>.redactions.json` sibling lives under the existing mode-0700
OS temporary run directory. Passwords, PKCE verifiers/state/codes, OAuth tokens and session
inputs are persisted before use. OAuth forms, URLs, headers and response bodies are not retained
as observations; edge records omit auth headers. The private file remains available through
per-stack capture, global JSON/JUnit/failure sanitization and interrupted-run recovery, and is
removed only with the outer temporary directory after the scrub succeeds.

`privacy-probe/` proves value-based redaction using six independently generated high-entropy,
non-JWT credentials across request records and simulated log/JSON/JUnit failure reporters. It
also writes a late interrupted reporter, makes the private input unreadable and checks EACCES
fails closed, removes a stale scrub marker and preserves runtime. Permission repair then allows
recovery to scrub that reporter before deleting all private inputs. Only hashes and sanitized
observations remain. This verifies actual secret values, not variable-name or JWT-pattern grep.

Completed stacks still remain until global reporter sanitization/cleanup; Identity has only one
stack. GS06 must review the expanded sequential-stack resource lifecycle while preserving these
private redaction inputs. Recovery still refuses artifact symlinks and foreign project scopes.
The suite proves the selected local-provider behavior, not other identity providers, cloud
hosting, arbitrary scale or every failure timing. No studio browser behavior changed.
