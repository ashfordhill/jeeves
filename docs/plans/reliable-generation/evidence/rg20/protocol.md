# Private refresh contract

Local identity keeps RG19's semantics: cookie/authority/key validity and store-time idle/absolute
expiry authenticate local product operations without consulting issuer token expiry. Even expired
or uncertain provider credentials do not become anonymous. The private generated
`createBrowserSession().refresh(request)` boundary is exercised directly by emitted-code tests.
It returns safe identity facts only; tokens stay sealed/private. No HTTP route, product dependency,
normal control, background user authority or service-forwarding consumer is added in RG20.

Append-only055 adds a generation, uncertainty bit and opaque attempt/deadline to protected054
sessions. Existing migrations/grants/namespace/authority and product SQL boundaries are preserved.
A transaction acquires that session's row lock, then reads store time and row state in a separate
statement. A fresh committed generation is reused. Otherwise it commits an uncertainty/attempt
marker **before** any token POST. A second transaction reacquires the same row lock, rechecks the
exact attempt, generation, authority, keys, expiry and freshness, and calls the issuer once.

Competing requests wait on that row or repeat only coordination reads every20ms until the winning
attempt commits. They never retry a dispatched issuer callback. The durable marker survives
rollback, lost completion, restart or death of the locked issuer transaction; its expiry does not
authorize another token POST. An abandoned or explicitly uncertain attempt requires a new login
to restore provider credentials. A cancelled browser known to have stopped before dispatch may
clear its own unused marker. No global/advisory lock, second simultaneous connection or new
coordination service is required. The network callback under this bounded per-session lock is
an approved private exception; ordinary product local transactions still cannot call the network.

Bounds are fixed internal policy:4500ms lock wait,5000ms statement/idle-in-transaction limits,
5500ms private client query timeout (ordinary pooled queries retain2500ms),
3000ms SDK/transport,256KiB response,6500ms entire attempt including completion,32 actual pending
attempts and32 actual pending SDK operations. The connection watchdog destroys a checked-out
connection at the total limit. Actual pending promises retain capacity after a caller returns;
a hung connect cannot admit unlimited new work and a connection arriving after expiry is discarded.
The existing process lifecycle retains its single10s shutdown budget. Process shutdown cancels
work; it never attests rollback or token non-rotation.

Browser cancellation while waiting prevents a new POST. After dispatch, recording received tokens
continues under an independent bounded internal context despite that browser cancellation, where
possible. Freshness comes from store time after the lock; the10s fresh margin exceeds the entire
internal budget. Refreshed expiry anchors to authoritative store time read before dispatch, so even UPDATE
transport delay cannot extend it. Supported refreshed expires_in is>20s and<=604800s; the minimum
exceeds the10s margin plus6500ms total budget. Too-short successful grants remain uncertain and
never cause another queued rotation. Sign-in expiry also anchors to pre-exchange store time. Current keys reseal all retained/replaced material. A final store-time expiry,
revocation, authority, attempt and generation fence precedes storage. Queued revocation executes
after the locked transaction and cannot be undone by a later result. Removed keys invalidate the
session. No production clock or insecure override exists.

| Result | Provider-token outcome | Session treatment |
| --- | --- | --- |
| New tokens and confirmed commit | Available, next generation | Reuse winner; keep private |
| Confirmed OAuth invalid_grant | Sign-in required401 | Revoke, erase sealed material |
| Known OAuth provider/config refusal (including429/5xx/invalid_client) | Definite availability failure | Preserve session; clear safely unused attempt |
| Network, malformed response, interrupted dispatched POST | SESSION_REFRESH_UNKNOWN | Retain uncertainty; no automatic POST retry; local identity can remain valid |
| Completion rollback/death after rotation | Unknown; new credential may be lost | Durable marker prevents reuse of possibly spent old token; new login may be required |
| Lost successful COMMIT response | Unknown to first caller | Next locked read reuses committed generation if present; otherwise uncertainty remains |
| Missing/unreadable refresh credential at a stale token boundary | Sign-in required401 | Revoke/erase; local identity alone never calls this boundary |

The pinned maintained SDK performs refresh token response and optional ID-token validation using
the exact selected issuer/client and RS256 signature checks. Any returned ID-token subject must
match the stored session subject and cannot be a workload identity. An absent ID token is valid;
an absent replacement refresh token retains the old credential. Unusable successful response
material remains uncertain rather than adopting unvalidated credentials. No hand-written OIDC
validation or live managed issuer is used. Actual two-process/Postgres proof remains the assigned
later checkpoint; PGlite and HTTPS SDK stand-ins here prove controlled protocol/ordering behavior.
