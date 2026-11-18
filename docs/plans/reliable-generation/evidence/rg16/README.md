# RG16 — durable scheduled tasks

Implemented on accepted RG15 `307197863d4b886521ea3f22e75b134536622717`, with intervening
owner feedback commit `c475ffc2116ae0cf9202187ba3912339f02dd54a` preserved. Pending coordinator
acceptance; no later unit or native generated-system suite was run.

## Implemented behavior

`scheduled-task` is an installed module/binding in Service and Worker. Its sole normal control
is `intervalSeconds`,1..604800 (default 60). Inspector, chat, blueprint, normalized setting,
generated dependency configuration and process report consume the same value. A timer-only Worker
hides unused delivery concurrency. Adding a Worker from a lane creates its Scheduled task and
enables Runnable processes; a queue-fed Worker keeps the consumer workflow. A Worker without a
task cannot become a lane entry. No synthetic Jobs link is required.

The task reuses API8 `defineDurableWork`, protected052 state, private engine, registered product
commands and common lifecycle. Its extension is a scoped completion scaffold; product logic/SQL
remain application-owned. Both host mounts await startup before readiness. Worker lifecycle
initialization now actually executes its existing work initializer as well. No timer, lease,
fence, transaction or ACK methods enter the public extension API.

A namespace admission transaction takes a PostgreSQL try-advisory lock, checks durable intent,
and selects `floor(extract(epoch from clock_timestamp())/interval)`. The key includes interval and
that database tick. Copies admit at most one unfinished tick; accepted/running/retry intent is
reclaimed before a fresh tick. Downtime/slow work coalesce to the current interval after the old
intent settles. Actual transaction/transport slots remain occupied after caller deadlines;
scheduling/sweeping cannot accumulate behind a hung callback. RG15 final exact fence, holder and
unexpired database-time lease comparison still commits with product commands.

Fixed seven-day completed retention covers every supported interval, preventing cleanup from
reaccepting the current tick with a new acceptance UUID. Interval edits preserve old accepted
input and the durable configuration digest. Handler/version/identity changes require stopping old
schedulers, draining/resolving old work and explicit retained-record migration or intentional new
stable identity. Incompatible retained definitions refuse startup. Mixed interval copies can
admit either configured cadence; stop old copies for one cadence.

Failed/unknown ticks halt admission and emit fixed `scheduled task halted failed` / `scheduled task
halted unknown` logs. Runtime configuration conflicts emit `scheduled task migration required`,
distinct from storage unavailable. No reset/delete UI or monitoring framework was added. Separate
Workers use explicit logical ownership, distinct credentials and exact product grants. Optional
remote integration retains RG15: real authenticated generated target, explicit workload-only callee
opt-in, Required-user refusal, same compiled process recovery identity, no saved bearer, and
pre-effect `WORK_SECRET_CHECKPOINT_UNSUPPORTED` for declared secret remote results.

## Verification

- [Final pnpm check](check-identities-final.txt): lint/types pass; **138 files / 1251 tests pass**, 81.60s.
  The [first run](check.txt) had seven stale catalog/menu/count assertions; updated expectations
  describe the installed module. No runtime assertion weakened.
- [Focused mechanism/protocol/chat](focused.txt): **4 files / 45 tests pass**. Scheduled cases cover
  DB ticks versus process clocks; competing dedupe; current-tick retention/acceptance UUID;
  downtime coalescing;100 intervals / 2 copies / one intent; expiry/reclaim/stale holder refusal;
  both interval-edit directions with unfinished work; hung actual callback slots; halted unknown
  logs/config migration refusal; remote-input persistence/process affinity; idle lifecycle and
  cancel/drain/recovery; authoring/grants/refusals.
- [Full browser run](e2e.txt):78/82 pass, including TinyURL and both long full mouse rebuilds.
  Failures: stale13→14 module count, newly enabled Worker expectation, one selection timing case,
  and a create-study interruption whose trace shows Vite hot reload during the resolver edit.
  After corrections/stable source, [affected 6/6](e2e-affected.txt) pass: both new mouse cases
  (lane-menu Worker creation; state reconnect/interval/edit/export), the four failed cases and
  relevant existing process-control case. **All 83 unique cases accounted**; no Board/timing
  assertion changed. Test projects use existing cleanup/finally paths. The initial create-study
  interruption occurred before its finally block; [exact UUID cleanup](e2e-cleanup.txt) removes
  that owned project from `jeeves_e2e` and confirms no RG16 projects remain.
  [Mouse screenshot](mouse-task-controls.png) shows both hosts, shared state and interval control.
- [Final web build](build-final.txt) passes; existing chunk-size advice remains.
- [Actual scratch generation](compile-style-final.txt), [runner](compile.ts):68 files; real extension
  checker and pinned TypeScript 7.0.2 pass for scaffold and filled completion bodies. Both process
  files await their mount, name distinct product/framework credentials and have no delivery loop.
  Emitted paths/pins are recorded; dependencies unchanged. This is compilation/boundary evidence,
  not a completed product or native worker-kill proof. Exact scratch directory removed in finally.
  Final review corrected selection/module ID conflation in the task initializer/interval lookup.
  Work identity remains module-based; the scratch export deliberately aliases a selection ID.
  [Affected identity/client wiring28/28](identity-focused-final.txt), [generator types](identity-typecheck-final.txt)
  and [scheduled/foreign-owner10/10](ownership-focused-final.txt) pass. The first aliased runner
  attempt failed on a docs-local package import; its [failure](compile-identities-attempt.txt)
  is retained, and the runner now uses the correct repository-relative import. Existing mouse/
  web-build results remain applicable: normal-selection behavior/UI/build inputs are unchanged.
  The final template edit only restores repository Biome formatting; [canonical formatting proof](format-proof.txt)
  matches the fully tested staged source, and the actual final-byte aliased scratch build passes.
- [Offline chat eval](offline-chat.txt): three scripted design arms and six synthetic cases in
  both arms replay deterministically with network forbidden; no model-quality claim. Focused
  Workspace exercises actual interval settings and rejects cron/retry controls.
- [Reviewed off pins](pins-review.txt):80 / 87 / 60 files unchanged; only extension guide and consequent
  manifest payload hashes change. Frozen v1 has no diff.

PGlite executes real SQL/roles/transactions through serialized controlled adapters. Database and
process clocks are controlled separately. This proves the named cases, not native independent
PostgreSQL lock scheduling or real process kill. The approved later checkpoint owns that finite
native proof. No exactly-once external effect, cron, arbitrary timer hook, workflow language,
cloud scheduler or deployment CPU guarantee is claimed.

## Preservation

[Receipt](preservation.txt): all 42 original container IDs/names/states match RG15; unrelated owner
diff is the same 34001 bytes; frozen v1 unchanged. Six non-README original root hashes match. The
owner concurrently replaced/continued editing root README; observed hashes differ and were
preserved, never staged/restored by RG16. Owner feedback/current main parent are preserved. No
owner studio 4300/4310, owner database, `.env`, live issuer, paid/live model, root write, push or
deployment was used.
