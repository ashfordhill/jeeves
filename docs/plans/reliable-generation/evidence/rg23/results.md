# RG23 cross-domain native evidence

Complete for coordinator review. Accepted input is RG22
c3192e0; owner docs-only parent95d60ac is preserved. No later unit is included.

Two ordinary source/handwritten fixtures are added: rg-link-flow (account-scoped creation,
versioned destination reads, browser navigation) and rg-catalog-flow (HMAC catalog ingestion,
ticketed generated-operation replication and queue projection). API8 DTO validation, policies
and registered parameterized SQL supply product mappings. No generated private runtime is copied
or patched. Actual exports pass their installed boundary checker and TypeScript7.0.2.

## Independently expected finite matrix

| Contract observation | Independently expected outcome | Evidence/status |
| --- | --- | --- |
| Native concurrent browser refresh | Two browser copies share one PostgreSQL generation and one actual Keycloak rotation | [native6 sessions](native-6/1-rg-link-flow/session-assertions.json): both404, one rotation/generation1 |
| Temporary / unknown / definitive issuer outcome | Temporary retains local identity and permits later recovery; unknown never resends the spent grant and retains local identity; definitive revokes and erases tokens | native6: temporary503/zero rotations, unknown503/one rotation/no extra dispatch, definitive401/token erasure; local identity200/200/401 |
| CSRF, user and workload caller authority | Missing CSRF403; independent user/workload checks and caller allowlists refuse | native6: CSRF403; missing user/workload401, wrong caller403, user-as-workload401; link counts:2 Items API/2 Gateway/2 Browser/2 ownership-worker; catalog:2 Caller API/2 Projector (one Callee) |
| Replay/admission/cache composition | One create and shared finite admissions; committed sealed replay precedes unavailable admission; v2 cannot regress, absolute validity cannot extend | [native6 foundations](native-6/1-rg-link-flow/named-assertions.json): two product mutations/admissions total; sealed replay201 while new work503; both reads returnv2, exact validity retained |
| HMAC acceptance and recovery | No upstream202 while actual INSERT or actual COMMIT is gated; committed inbox survives Service death; duplicate202/content conflict409; terminal failure visible; non-idempotent effect1 | [native5 catalog1](native-5/2-rg-catalog-flow/named-assertions.json): actual INSERT/COMMIT gated, no upstream202, committed acceptance then kill/replacement, effect1 |
| Paused remote holder | Another actual API copy reclaims after store-time lease expiry, reuses selected ticket/stable identity; local and remote non-idempotent effects1 | native5 catalog2: fence1→2 with same work ID, one preparation/two execute calls with stable identity, local1/remote1 |
| Fresh-context stale completion | Old opaque emitted-store claim receives WORK_LEASE_LOST under a fresh valid context after another copy completes; effect counter remains1 | native5 catalog3: winner COMPLETED, old WORK_LEASE_LOST, same identity, fresh context/effect1 |
| Queue commit-before-ACK/redelivery/date identity | Actual receipt/product commit precedes withheld AMQP ACK; kill that consumer; another copy ACKs redelivery; changed event date does not repeat effect | [native7 receipts](native-7/1-rg-catalog-flow/named-assertions.json): one unacknowledged after commit, actual kill/redelivery/date change, effect1; native6 also passes this group |
| Retention/idle cleanup/heartbeat | Immutable database deadline survives until boundary; independent bounded cleanup deletes after it without traffic; stopped/crashed stale heartbeat differs from live idle | native7: no early deletion at actual DB deadline, idle deletion afterward, two stale45s rows/one live idle, product retained1; exact equality boundary also covered by focused tests |
| Database/cache/broker faults and shutdown | Required readiness drops while liveness survives; optional cache fallback stays available; unknown is explicit; same copies recover; fixed10s final shutdown | native6 PG/cache recovery passes; native7 broker pause/drop/same-copy recovery passes. Lost mutation COMMIT unknown/replay1; hung process exits1 in10,424ms |
| Actual role boundaries | Distinct API/Worker logins and precise tables/views; no foreign/private/DDL/setup authority | native6 exact native logins: excess/foreign/private/DDL/setup42501, READ ONLY25006; same-owner API/worker credentials remain distinct |

Expected outcomes are fixed contract assertions, not answers emitted by the generator. Product
SQL increments effects on conflict so uniqueness cannot conceal a repeated business effect.
The fresh-context probe uses the emitted store, actual compiled webhook hook, registered SQL and
real runtime/product logins; it exposes no product claim/lease/completion controls. Its purpose is
to isolate fencing from the real paused background execution's separate30s deadline protection.

Actual distinct container IDs are retained in [link API/gateway](native-6/1-rg-link-flow/independent-copies.json),
[link browser/ownership-worker](native-6/1-rg-link-flow/browser-worker-copies.json) and
[catalog API/projector](native-7/1-rg-catalog-flow/independent-copies.json). Native role tests inspect
one actual login per compiled role; native queue redelivery uses both independent projector copies.

## Runs and narrow harness corrections

- Native1: wrong private browser secret-variable prefix; startup refused. Exact teardown saved.
- Native2: real trusted-HTTPS PKCE callback passed; the test cookie jar resent a cleared guest
  cookie and the strict session guard correctly refused. Fixed cookie deletion semantics only.
- Native3: browser concurrent/temporary/unknown branches passed. Definitive401 correctly revoked
  and erased credentials while retaining an irrelevant historical uncertain marker. Corrected
  the extra private-marker expectation. Catalog attachment validation exposed its actual template
  status/mapping filename; finite reported generated-extension paths now pass the existing strict
  ownership check. Generated-scaffold/private-runtime protection remains.
- Native4: sessions and original early foundation groups passed; the old-fill SQL hit its unchanged
  bound. Catalog acceptance/Service kill ran; the new upsert correctly refused missing UPDATE.
  Only the new fixture's exact SQL declarations/product grants were corrected.
- Native5: original cache race and unknown-store cases pass. The old first-COMMIT proxy could hit
  newer background ticket cleanup before the mutation, so its target now arms on the same
  connection's actual idempotency INSERT. All original75 expect statements,10 sections, deadlines
  and old-blocked/v2-committed preconditions are retained (oracle-preservation.json).
  Catalog groups1–3 pass. Its queue hold raced redelivery; releasing the already-discarded ACK
  gate before killing the first consumer prevents withholding the replacement's ACK.
- Native6: all10 original foundation groups and session branches pass. Queue commit/redelivery/
  date identity passes. The extra persisted stopped-enum expectation was incorrect: accepted RG18
  specifies heartbeat staleness after45s. No runtime change was needed.
- Native7: targeted queue preparation/retention/broker all pass (181.093s including teardown).
  Earlier successful groups are explicitly not rerun. [Selected cases](native-7/1-rg-catalog-flow/selected-cases.json)
  identifies retained native5 recovery receipts; native6 supplies complete link receipts.
  [Reuse comparison](catalog-proof-reuse.json) proves all18 catalog input files and94 emitted
  payload paths/hashes identical across native5/6/7. Final link source/receipts are unchanged.

Effective source SHA256: native5 `e223b248d2ffacfbd4e2c465835fc562c87829c3abb65168b10caf806adf947b`,
native6 `776aebafe61ba86de5b0f1dedc813f2c4d790f28a947797cfaf228f62f6620da`,
native7 `346a5fad046331d124e43cd57a015fe6fd32190f8c74eaea810fae0afffe1439`.
The source difference is task harness targeting/observation, not generated catalog behavior.

The task proxy can withhold a real PostgreSQL COMMIT before dispatch, a generated remote response
and AMQP Basic.Ack. It wraps native PostgreSQL/RabbitMQ and the actual generated recovery target;
it establishes no production adapter support for arbitrary remote providers. Browser setup uses
native Keycloak behind task-owned HTTPS/CA, exact compiled client/callback/audience and the pinned
maintained OIDC libraries. Cookies/CSRF pass by private filesystem handoff, never native stdout.
Transient workload-probe credentials remain mode0600 inside owned containers, validate issuer,
audience/caller/expiry, and are still verified by actual callees. Default RG14 probes are unchanged.

## Verification and limits

[Final pnpm check](check-final.txt) passes lint/types and145 files/1353 tests (113.22s).
[Browser regression](e2e-final.txt) passes87/87 (6.3m), including TinyURL on the lane canvas,
mouse connections/refusals and both full mouse rebuilds. [Web build](build-final.txt) passes with
its existing chunk-size advisory. [Focused mechanisms](mechanism-tests.txt) pass166/166.
Both actual fixture exports pass checker/API8 and TypeScript7.0.2 in native build logs. This
unit changes no authoring commands/descriptions or product UI, so no additional chat eval applies.

The first broad check stopped only at formatting of this unit's native JSON evidence. The first
complete check passed1353/1353; after the result guard below, the final complete check also passes.
No test assertion or production timeout was relaxed. Earlier failures remain in their own runs. Terminal trailing whitespace and blank EOF lines
are normalized in this unit's text logs; assertion text/outcomes are retained.

The runner's optional test-name filter now rejects an all-skipped result. [Actual no-match proof](result-guard-proof.json)
records0 executed/2 skipped, expected failure, no stack created and exact cleanup; the recorded
positive native7 JSON has1 executed/1 skipped. No native mechanism rerun was needed for this
result-only guard. [Final source comparison](final-source-comparison.json) shows it is the sole
source change after native7; final effective source is
`9dc4ff3545b14c32e68c599bb87a4e75bf4d08b9559933b6100718b1c66db9bc`.

[Attachment/path review](attachment-path-review.json) preserves strict generated-extension ownership
for actual webhook operation/mapping paths. [Emitted-surface review](emitted-surface-review.json)
confirms no emitter/template/API/dependency/framework-migration changes and no pin updates required.
The cooperative checked API is not a hostile-code sandbox, and checker/TS success is not a claim
that arbitrary handwritten hooks are complete.

[Final preservation](preservation-final.txt) retains all six original non-README root hashes,
current owner README, original28-path binary patch under its archive mapping, accepted050–055,
receipt/counter SQL builders, dependency pins and frozenv1. [Full Docker inventory](docker-after-final.json)
and [comparison](preservation-inventory.json) match all42 original container ID/name/states,
9 networks,23 volumes and43 images. [All seven native cleanups](cleanup-audit.json) remove exact
owned resources/temporary directories; no-match cleanup has no stacks. Both old e2e projects
are unchanged and unit-created projects remaining0. [Safe artifact scan](safe-artifacts.json)
finds no raw JWT/private key/private-runtime material in retained artifacts; test TLS/secrets stayed
outside exports/evidence and were removed with task temporaries.

No owner studio, root file, historical evidence/export, later unit, live model/provider, cloud,
push or deployment was changed. Owner docs-only parent95d60ac and its future queue are preserved.
One explicit-path local RG23 commit follows; coordinator acceptance remains separate.

Evidence covers these finite failures and mappings, not load, an exhaustive provider matrix,
hostile JavaScript isolation or future applications. Generic POST retry is still unsupported.
Unknown rotation may require sign-in. Retention is finite, queue dedupe is not forever, and
remote recovery remains limited to the installed workload-only generated operation/ticket contract.
