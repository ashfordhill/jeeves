# RG15 durable work and fenced completion

Owner-approved RG15 implementation on accepted RG14
`b8191719e6698ac8735d89b2131527fec276699c`; unaccepted until coordinator review. The earlier
partial-stop handoff/logs remain as history. The workload-authority decision was approved on
2026-11-17; see [the decision record](authority-decision.md) and plan README amendment.

## Implemented contract

`defineDurableWork` adds scoped accept/status to extension API8. The private engine owns
accept/claim/renew/complete/fail, exact advancing bigint fences, database-time leases, finite
backoff/attempts and completed-only bounded retention. Canonical validated input, mapped input
and configuration are durable before acknowledgement. Retained equal identities dedupe; changed
input or incompatible configuration conflicts. A new acceptance UUID distinguishes legitimate
key reuse after completed retention. Namespace uses stable database/logical-owner/work identity;
display renames do not rename state. No product SQL/client, lease/fence, commit or ACK handle is
exposed. Local-only compatible roles can share logical-owner work with distinct credentials;
cross-database atomic completion is refused.

The shared private `product-mutation` helper retains RG10's restricted role through the callback
and every issued command's actual settlement, including caught/unawaited failures. Final
holder/fence/unexpired-lease comparison and product effects commit together. Expiry or poisoned
commands roll back both. Actual SQL/transport promises retain the bounded work slot beyond the
caller deadline; another tick cannot accumulate hung callbacks. Existing process cancellation,
drain and final termination bounds apply. Failure logs use fixed events plus definition ID,
generated correlation ID and an opaque work hash. They exclude raw keys, inputs, subjects,
tickets, results, credentials and original exception values. Storage loss remains distinct from
product poison and unknown outcomes.

## Installed remote protocol and explicit limits

The only initial remote adapter is the actual generated authenticated `ServiceTarget`, registered
privately by the installed workload runtime. Structural lookalikes and arbitrary URLs/providers
or header claims cannot bind. A callee explicitly exports an opaque `defineWorkloadOperation`
descriptor as `localOperation`; it advertises no public call/route. Unsupported direct module
invocation gives a guarded refusal. Account `defineLocalOperation` retains its existing public
call/route, account scope and sealed secret replay.

Generated `/internal/work/<declared-module>` POST/root-only framing owns prepare/execute,
independently of the arbitrary product stub handler. Process/report output includes that route
and its explicit opt-in requirement; an unwritten stub is not reported as runnable. The callee
checks audience, compiled caller allowlist and fresh private workload credentials independently
of end-user identity. Required-user guards cannot become background targets. Product code sees
only immutable `{processId}` facts; no saved user bearer, impersonation, session/provider or
credential-delegation framework is introduced.

Prepare supplies framework-owned protocol/version/secret evidence and a callee-owned expiring
opaque ticket. Canonical mapped input and the selected ticket/protocol/version commit before
any execute dispatch. An unknown ticket COMMIT causes no speculative dispatch. Reclaim reads
durable state first: it may prepare again only if no ticket was durably selected and no execute
could have been sent. Once selected, a ticket is never replaced, even after expiry/cleanup.
The remote key contains no holder/attempt/fence. Credential acquisition is followed by the final
lease recheck immediately before the actual fetch. Remote execution stays outside local SQL.

The callee checks ownership/input/version/expiry in its mutation transaction, then checks again
after awaited admission immediately before mutation. Retained committed replay can recover after
ticket expiry. Missing/expired tickets without retained replay cannot execute, including after
both tables' cleanup. Cleanup is bounded and requires no permanent per-identity marker or
caller/callee clock comparison. Execute replies carry JSON envelopes so operation204/205 null
results survive HTTP no-content framing. A persisted known result completes locally without
another dispatch. Exhausted unresolved dispatches remain unknown, including when a later
attempt crashes or fails; timeout is not proof of no effect.

Two initial integration limitations are explicit:

- Declared-secret workload results are refused before effect dispatch with durable terminal
  `WORK_SECRET_CHECKPOINT_UNSUPPORTED`. This integration has no sealed work-result checkpoint;
  it never persists such a remote response plaintext. Account secret replay remains supported.
- Remote recovery works across copies of the same compiled process/workload identity. The
  generated binding supplies affinity; application declarations cannot select another principal.
  Another logical-owner role skips incompatible claims and colliding acceptance reports
  `WORK_CONFIGURATION_CONFLICT`, preserving the original row/ticket. No credential merging or
  impersonation occurs. Local-only work remains shareable. Identity/handler/version changes
  need explicit draining or reviewed application migration, preserving old intent and hook bodies.

There is no exactly-once external-execution claim, cross-database atomic commit, arbitrary
provider adapter, scheduler, webhook or operator reconciliation UI in this unit. Private policy:
30s leases; drain10 sequential claims; claim at most25; 250ms doubling backoff capped30s;
1–20 attempts; completed retention60s–7days; completed sweep100; ticket cleanup1000 alongside
60s replay cleanup. Accepted/unfinished/failed/unknown work is never deleted by completion cleanup.

## Evidence and verification

Plain-text receipts trim trailing whitespace; command results and assertions are preserved.

| Final check | Actual result |
| --- | --- |
| [pnpm check](check-final.txt) | Lint and all workspace types pass; **136 files / 1240 tests pass**,103.99s. One existing informational Biome suggestion remains unchanged. |
| [Focused mechanism/RG10/protocol](focused-final.txt) | **3 files / 51 tests pass**,22.88s. |
| [Deterministic final expiry tests](expiry-final.txt) | After the test-only timing correction, **15/15 pass**,27.44s; generator types and focused lint also pass. Product SQL and actual unawaited command drain are confirmed before the trusted expiry fault. |
| [Actual scratch exports](compile-final.txt), [runner](compile.ts) | **67 local / 78 remote files**; actual extension checker and pinned **TypeScript7.0.2** pass for both. Emitted file lists and dependency pins are recorded. Scratch root removed in `finally`. |
| [Native pnpm test:e2e](e2e-final.txt) | **81/81 pass**,6.5min, including TinyURL load/lane rendering, both full mouse rebuilds, scripted chat, generation/download/refusal and workload/ownership mouse actions. No Docker fallback. |
| [Affected final browser checks](e2e-affected-final.txt) | After the finite write-only composition correction, **6/6 pass**,21.8s: generation/export/refusal, logical ownership and workload mouse flows. New services use4301/4311 and `jeeves_e2e`; test-owned projects are deleted. |
| [Final web build](build-final.txt) | Pass,1.04s; existing large-chunk advisory only. |
| [Existing offline chat eval](offline-chat-final.txt) | Three scripted design arms and six synthetic cases in two arms replay deterministically; network forbidden, no model-quality claim or paid/live call. No command schema/tool-description change. |
| [Reviewed pins](pins-review.txt) | Unchanged80/87/60file counts, no new/removed paths;13 justified digest updates across applicable private runtime/guide/manifest paths. No dependency version change. |
| [Preservation](preservation-final.json) | Seven root hashes, exact34001-byte owner diff/modes, frozen v1 and all42 container ID/name/states preserved; no task Docker resources created. |

The new backend-only source fixture is
`field-projects/generator-system/fixtures/rg-durable-work/`. Its generated files are emitted to
scratch, never edited or stored as an export. [The runner](compile.ts) checks local and remote
exports using actual extension-boundary tooling and pinned TypeScript7.0.2, then removes only
its scratch root. Local export has67files; remote78. New mechanism paths are per-database052 SQL,
`src/runtime/durable-work.ts`, `product-mutation.ts` and `work-integration.ts`; existing process,
module-client, operation/replay, workload, extension API and report output changes are intentional.
No dependency/pin version changes are needed.

Focused assertions cover canonical identity/conflicts/account scope; crash-before-dispatch;
exact fences above2^53; renewal and stale-holder refusal; expiry after product effects and actual
unawaited command drain; product-role/retained/captured-handle/poison enforcement; finite retries,
terminal failures and completed-only cleanup; acceptance/completion/ticket COMMIT ambiguity;
shutdown recovery; storage versus poison and safe actual logger output; authentic generated
prepare/execute routing; Required-user/audience/caller refusal; opaque descriptor and structural
adapter refusal; absent mapped-input refusal before SQL; stable identities/tickets across
reclaims; both committed and rolled-back ticket-COMMIT loss; prepare/execute response loss;
post-admission ticket expiry; retained replay after ticket expiry; ticket/replay cleanup refusal;
known-result local recovery; key reuse after completed retention; secret refusal; protocol version
refusal; loss during credential acquisition; cross-role takeover refusal;204/205 response-loss
recovery; and actual hung fetch retaining its slot after caller timeout.

PGlite serializes connections. These are deterministic SQL/role/protocol/failure-point checks,
with the generated Fastify transport/receiver code and an RSA verification test harness, not a
native simultaneous-replica/process-kill or live-issuer claim. The earlier RG14 checkpoint remains
separate; real durable-work process kill is deferred to the later assigned checkpoint.

## Failures diagnosed and corrected

- Original partial checks:25 focused passes, scratch66, existing wiring127pass/5fail. Preserved
  [partial focused](focused.txt), [wiring](wiring-partial.txt), [compile](compile.txt),
  [initial compile](compile-initial.txt), [types](typecheck.txt), [lint](lint.txt) are historical.
- Recovery added protocol/secret refusals to the existing HTTP classification allowlist; before
  that, a correct receiver refusal became503/unknown. An expired caller context previously tried
  another bookkeeping SQL action; it now logs unknown and leaves reclaimable durable state.
- Scratch remote compilation exposed a DTO property named `process` colliding with the existing
  global-process checker; the new property is `processId`, without weakening that checker.
  The unwritten callee handler now has its truthful module request/response signature.
- Report tests initially assumed pretty JSON/flat process arrays, and the expanded remote oracle
  initially omitted the two204/205 effects from its final row count. Assertions now parse the
  actual report shape and count all ten distinct expected local effects. The admission-expiry
  fault now changes the deadline after confirmed admission entry, avoiding a70ms scheduling race.
  The two local expiry cases likewise use a trusted post-product/drain SQL fault and a gated actual
  command, preserving role/rollback/drain assertions without time-window assumptions.
- First broad `pnpm check`:1233pass/7fail. Three were reviewed off-pin payload digests; two were
  exact new grant lists; one test's extracted preparation harness lacked the new private
  declaration-validator parameter; one real write-only composition check needed its finite
  replay-table exception extended to exactly `work_records`/`work_tickets`. Product and published
  read grants remain restricted. All fixes preserve permission/preconnection assertions.
- The first offline-eval command mistakenly used `--report` (read/replay) for a nonexistent output;
  corrected to `--record` for new scratch evidence. Both scripted and synthetic offline arms run
  with network forbidden; no paid/live model or issuer call occurs.

Reviewed processes-off pins retain80/87/60files with no added/removed paths. Only the generated
extension guide, manifest and private admission/operation/transaction bytes change as applicable;
normalized source/report semantics and all dependency versions stay unchanged. Frozen v1,
historical exports/evidence, all root files and unrelated owner changes remain preserved. No
native generated-system suite/matrix, owner studio port/database, push or deployment is used.

During verification, the owner added the independent feedback-only commit
`043b83351320bb8845d40f5a6b10e395167eaaa5` (HUMAN_FEEDBACK and a sketch image). It is preserved
as RG15's immediate parent; the accepted generation foundation remains RG14. The preservation
receipt records this actual precommit HEAD rather than claiming HEAD never changed.
