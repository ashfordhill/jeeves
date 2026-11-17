# RG15: restart-safe remote authority decision

Status: option B approved by owner on 2026-11-17; implementation resumes in RG15.
Preceding accepted foundation: `b8191719e6698ac8735d89b2131527fec276699c` (RG14).

## Existing protocol gap

- `templates/local-v2/assets/src/runtime/local-operation.ts.template` (under
  `jeeves-generator/`), `bindLocalOperation`, derives replay scope from
  `currentOperation()?.caller.subject` and refuses absent subjects with `SIGN_IN_REQUIRED`.
  It stores scope kind `account`; callers cannot choose that scope.
- `.../runtime/operation.ts.template`, `verifiedBearers` / `verifiedBearer`, retains the verified
  user bearer in a request-context WeakMap, removed when that operation closes. It is neither a
  durable authorization grant nor available after restart.
- `.../runtime/workload.ts.template`, `serviceTarget`, independently acquires an audience-bound
  workload credential. With `forwardUser`, it forwards only the current verified user bearer.
  `workloadRoutes` authenticates the process but does not authenticate it as an account.
- `src/v2/http-wiring.ts`, `routeStub`, passes the existing user Authguard's `caller` to internal
  stub routes as well as the workload wrapper. Persisting a subject string, setting an operation
  caller locally, or fabricating a user token would not satisfy that receiver policy.

Consequently the present generated RG10 operation is not a restart-safe background mutation
target. An idempotency header or test transport cannot supply the missing production authority.

## Option A: leave external mutations unavailable

Implement local accept/claim/renew/complete/fail, fencing, bounded retry and retention. Refuse
every external mutation declaration with this explicit recovery/authority gap. This can prove
crash-before-local-completion, reclaim and stale-holder refusal. It cannot prove RG15's
crash-after-external-effect recovery, restart-safe generated remote dispatch, or the later
checkpoint's corresponding end-to-end case. It is partial RG15 and is not presented as complete.

## Narrow option B for owner approval

Add an explicit generated operation opt-in for **workload-principal** authorization and replay
scope. This is a deliberate additional capability, separate from account-authorized RG10 calls.
The receiver still enforces the compiled caller allowlist, audience and fresh private workload
credential. A Required user Authguard remains required; such a route cannot become a
workload-only background target. The supported initial target must be explicitly workload-only
and opt in to this new operation mode. No saved user bearer, account impersonation or delegated
user grant is introduced. The product receives only the necessary immutable workload fact.

The receiver's generated protocol, not the arbitrary stub entrypoint, must advertise and enforce
that opt-in before mutation. The caller's declared integration must bind to an actual generated
ServiceTarget and allowed operation; arbitrary providers/URLs/headers or structurally similar
test handles remain unsupported. Local completion remains fenced in its own database; the two
databases never claim an atomic commit.

The remote idempotency key is derived from stable work namespace, scope and work identity; it
never contains the holder, attempt or fence. The exact canonical remote input and selected
protocol/version are persisted before dispatch. Reclaims use those same values.

Finite replay safety needs an explicit recovery horizon. A contract handshake must establish the
callee's retained replay window before the first dispatch, and the durable caller must stop all
mutation dispatch before that window could expire. After the bound, an uncertain item remains
durably unknown for operator/application reconciliation; it must never reexecute just because
the callee's expired replay was cleaned. Completed local results can finish without another
remote dispatch. No exactly-once external-execution claim follows.

## Additional choices B requires

1. Approve the new workload-only operation authorization mode and its separate durable replay
   scope, with explicit callee opt-in and refusal on Required-user targets.
2. Choose the finite replay-horizon rule: either a conservative bound with an explicit clock-skew
   assumption, or a stronger generated recovery protocol that durably refuses execution after a
   callee-owned deadline even when its replay is absent/cleaned. The latter avoids relying on
   caller/callee clock comparison, but requires a persisted protocol ticket/deadline and a
   receiver check before execution. Unknown after the deadline remains unknown, not failed or
   permission to retry.
3. Keep ordinary authoring choices unchanged; the addition is an explicit extension-contract
   migration and private protocol, not a new scheduling/session/webhook/provider feature.

The owner replied "I see. Yes then" to the recommendation for explicit background workload
identity and callee-owned expiring recovery tickets. Option B is authorized with the constraints
above, including refusal on Required-user targets and after ticket expiry/replay cleanup. The
earlier alternatives and gap analysis remain here as the decision paper trail.
