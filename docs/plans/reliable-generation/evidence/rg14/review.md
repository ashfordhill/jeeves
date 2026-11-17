# RG14 independent foundation review

Review starts at accepted RG13 `925e917e879033196d5f41a3cf1155dfe3afc5f2`, on main in the primary
checkout. The reviewer did not implement RG01–13. The approved contract, D1–D12, short handoffs
and E10 establish the oracle. The existing generated-system runner records HEAD, dirty scope,
tool versions and every effective input hash in each attempt's `identity.json` and `source.json`.
No later unit, root file, new provider, public API or normal setting is added.

## Independent source review

- Public extension API v8 exposes scoped handles and immutable DTO/context types. The generated
  extension checker walks actual imports, including shared contracts, verifies scaffold hashes,
  and denies private runtime/driver/cross-service imports and policy effect APIs. Runtime pure
  and local-mutation scopes also deny captured handles. This is the cooperative-author boundary
  in D10, not a hostile JavaScript sandbox.
- Product declarations are validated before clients start. Registered reads reserve a native
  READ ONLY transaction with product `pr_*` credentials. Private framework `r_*`, restricted
  namespace `pm_*` DDL roles and setup owners remain distinct. Public product handles cannot
  access protected replay/ledger state or assume setup/DDL roles. Both runtime login classes
  receive the compiled per-host product maximum; private framework handles retain their own
  framework grants. Named-view readers have no base-table grants. Same logical API/worker owner
  does not merge their credentials or precise grants. SQL and migrations are application inputs.
- Generated service targets fix destination, operation set and audience; attach a private
  workload token; independently forward a verified user only to a declared recipient; and clamp
  the remaining duration at the receiver. Internal stub paths have no anonymous `/modules`
  aliases. Workload/JWKS caches and issuance requests are bounded per process.
- Local operations recover committed account/key/canonical-input replay before new-work checks,
  use a real same-database transaction/advisory key lock, keep the restricted product role active
  throughout the callback and issued-command drain, then seal replay and commit with the product
  mutation. Uncertain COMMIT remains unknown and recovers by durable replay. Cleanup is bounded
  and independent of HTTP traffic. Application code has no transaction/replay/key capability.
- Private Valkey scripts own rolling store-time admission and exact uint64 version fences.
  Reader coalescing is only an optimization; shared comparisons provide the retained-key fence.
  Source/cache validity is absolute and rechecked for each waiter. Optional cache failure falls
  back within bounds and recovers. Admission requires retained acknowledged state, compatible
  clocks, and its separate no-eviction/AOF/fsync-always resource. Public cache keys reserve
  `jeeves:` even when the physical client is shared.
- Lifecycle tracks actual promises and has a final 10-second termination bound even when a hook
  never settles. Cancellation does not establish rollback or absence of an external effect.
  Necessary missing dependencies affect readiness after initialization as well as at startup.

Reviewed entry points: generator `src/v2/{extension-api,client-wiring,http-wiring,tile-processes,
local}.ts`, normalized resolver, and emitted `check-extensions`, `products`, `migrate`, `operation`,
`transaction`, `local-operation`, `workload`, `rate-limiter`, `valkey`, `positive-cache`,
`module-clients`, `service-resources`, `process`, `postgres`, `objects`, `search` and `amqp` source.
Expectations name actual effects and native privileges rather than relying on implementer tests.

## Corrections

1. An HTTP cache reader on an internal host emitted an alternate route without an installed
   workload-authenticated template adapter. Generation now refuses the composition with an
   explicit reason. The fixture uses the in-process reader behind an authenticated route stub.
   Public eligible-record HTTP remains supported; no new cross-process template adapter exists.
   `foundation-review.test.ts` checks shared mouse/chat supported-command results and saved-input
   export; `cache-reader.spec.ts` selects the unsupported option by mouse and asserts Preview422,
   `UNSUPPORTED_SOURCE` and the finding. Unsupported intent remains saveable. No authoring command
   schema or tool description changed, so the conditional D11.5 offline chat-eval trigger does not
   apply; no live/paid eval ran.
2. Actual lost-COMMIT traffic exposed a delayed secondary `pg.Client` error after its query had
   rejected. The factory now observes errors once per physical connection, including checked-out
   and discarded states. Query rejection, unknown/discard semantics and idle-pool handling are
   retained. Tests use the pinned actual pg classes with no network to prove secondary-error
   observation, next-operation recovery and one listener across repeated checkouts.
3. Required admission storage could be known down while initialized readiness remained200,
   contrary to shared contract §4. Private process availability now drives HTTP and worker
   readiness with AND semantics across required resources. Optional reader caches are excluded;
   shared Valkey clients can become required regardless of construction order. Fixed5s safe
   reads detect idle/silent failure and recovery; physical/stream callbacks detect known loss
   sooner. At most one actual probe per resource runs, even beyond the caller timeout. Probes
   run under the process context, are tracked/cancelled during drain and cannot reopen readiness.
   Valkey queue saturation preserves healthy state and does not reconnect the client.

   PostgreSQL uses `SELECT 1`, with its configured acquisition bound (default 2s) plus a fixed 2s
   query bound: default detection budget is approximately 5+2+2=9s. Required Valkey uses PING and
   its existing150ms command bound (approximately 5.15s). Pub/Sub metadata, object-provider health
   and search reads have a 2s caller bound (approximately7s); an SDK that ignores cancellation
   continues to own its actual slot and is covered by final process termination. AMQP retains
   its configured heartbeat/reconnect behavior and reports transport state to the same lifecycle.
   These are fixed safe health reads, never business-query retries or new user controls.

   The already-installed Garage v2.4.1 has a private Compose-network 3903 listener with no host
   publication or admin credential. Its unauthenticated health route reports operational quorum;
   management requests still require a bearer. This follows pinned upstream
   [router_v1.rs](https://raw.githubusercontent.com/deuxfleurs-org/garage/v2.4.1/src/api/admin/router_v1.rs),
   [special.rs](https://raw.githubusercontent.com/deuxfleurs-org/garage/v2.4.1/src/api/admin/special.rs)
   and [api_server.rs](https://raw.githubusercontent.com/deuxfleurs-org/garage/v2.4.1/src/api/admin/api_server.rs).
   The generated setup test executes actual setup and checks private listener configuration,
   retained provider pin and existing S3-only host port. Startup bucket/grant checks remain;
   probes issue no multipart mutations and grant no S3 reads. Availability assumes retained
   startup-validated resources/grants, without continually checking every administrator change.

## Finite native scenario and actual outcomes

The fixture contains two independent service kinds, two actual API copies and two actual gateway
copies, a same-owner worker with distinct credentials, native PostgreSQL, two incompatible cache
resources kept separate, and disposable pinned Keycloak. Handwritten hooks/SQL are application
inputs and pass the same extension boundary checker. The existing suite map, Application helpers,
20-minute suite bound, observations, sanitization and exact project-label finally cleanup are reused.
No runner, framework, all-suite matrix or timeout relaxation was added.

The frozen final run `native-8/` passes all ten sections: 147.29 seconds in the scenario and
148.420 seconds including exact teardown. Its effective source SHA256 is
`e4dce7b32b09831c2a883a24dd544ea4a110d7a9392f87d29444aca3c0ea5400` across 464 files.
`preservation-final.json` independently confirms current source matches it. The only source change
from native7 is the synchronous pending-command harness correction, after the full D11 pass.
See [named expected/actual receipts](native-8/1-rg-foundations/named-assertions.json),
[source identity](native-8/identity.json) and [exact cleanup](native-8/cleanup.json).

| Named assertion | Expected native outcome | Native8 actual |
| --- | --- | --- |
| Authentication | Generated calls require independent user and audience-bound workload identities; wrong caller and aliases refuse | Both copies pass; missing workload/user 401, wrong caller 403, user-as-workload 401; aliases absent |
| Precise roles | API SELECT/INSERT, worker SELECT/UPDATE, gateway named-view SELECT only; no protected state/DDL/setup; registered reads READ ONLY | Exact login grants pass; excess access 42501, READ ONLY 25006; callback current_user checked; no setup secret |
| Concurrent migrations | Compete on unapplied 0002; one marker/ledger entry; rerun skips and changed checksum refuses | Both migrators succeed; one `applied-once` marker and exact checksum; idempotence/checksum refusal pass |
| Replay/admission | One mutation per key, at most two shared admissions; replay spends nothing | One 201 + eleven 409 contenders; one further 201 + five 429; replay 201 from both copies; two product rows/admission members |
| Old fill/validity | Observe stored v2 before releasing old snapshot; old completion cannot replace/deliver v1; hits cannot renew validity | Old snapshot returns v2; exact uint64 maximum retained; fill/hit expiry equal; expired record 404 |
| Pending/unknown cache | 32 actual outstanding commands; 33rd refuses without reconnect; unknown never retries and survives SQL rollback | 32 fulfilled; CACHE_SATURATED; same connection PONG/state; unknown/count 0; RATE_LIMIT_UNKNOWN 503/unknown; no product/replay rows |
| Lost COMMIT | Drop actual reply, keep unknown, recover one sealed mutation on other copy | Exactly one reply dropped; COMMIT_RESPONSE_LOST unknown; other copy 201; one row, sealed metadata true |
| Deadline | Received 100ms clamp distinguishable from 1s SQL fallback; dispatched generated POST remains unknown/no retry | Receiver 503 DEADLINE in 103ms; generated POST unknown in 102ms with protected outcome/no-store headers; no retry |
| Store recovery | Required loss unready/live; optional fallback stays ready; retain active AOF window; recover without process restart | Required ready503/live200; optional ready200/fallback; active window 45.175s before/37.619s retained, count2/429; worker marker restores without traffic; IDs unchanged |
| Hung shutdown | Enter hook, identify recipient, SIGTERM admission/readiness stop, self-exit1 at final bound | Entered marker/recipient observed; drain listener closes; self-exit1 with deadline/admission logs in 10,476ms |


Native store probes record booleans/counts/checksum metadata, never raw replay ciphertext or keys.
Test credentials, rings and bearers are private/sanitized. Encoded emitted test-module URLs
in regression failure stacks are omitted; failure names, messages and outcomes remain.
Terminal trailing whitespace and blank EOF lines are normalized in text logs. The receipt string
in results is a literal fixture sentinel, not a real credential or customer secret.

## Attempt chronology and regression evidence

Every attempt retains original results, source identity and cleanup receipts. Failed, interrupted
and unreached cases are not counted as passes.

- Native1 (110.15s): authentication and product roles passed; an extra incorrect assumption that
  private `r_*` must deny its own product SELECT stopped the case. `grantProductSql` deliberately
  grants the compiled host maximum to both runtime classes. Corrected only that extra oracle;
  public `pr_*` protected-state/precise-grant/no-admin assertions retained. No grant was changed.
- Native2 (107.31s): first four sections passed. Old source SELECT reached its existing1s SQL
  bound while additional Docker observation processes launched. v2 was observed stored but the
  still-blocked precondition failed. Observer/update/release now reuse the existing SqlSession;
  explicit v2-committed assertion and all outcomes/timeouts remain.
- Native3 (39.848s): interrupted during startup to restore the accidentally omitted explicit
  v2-committed assertion. No scenario proof; exact SIGINT cleanup completed.
- Native4 (112.99s): first six sections passed, then actual COMMIT-reply loss exposed the delayed
  secondary pg.Client error described above. Later sections were unproved.
- Native5 (136.99s): first eight sections passed, including lost-COMMIT recovery and103/101ms
  deadline paths. Store case reached PG shutdown; a fresh helper could not mint its workload
  token because disposable Keycloak shares that DB. Existing long-running gateway credentials
  isolate PG failure. Required-cache-down live200/ready200 was captured and corrected, not
  accepted as a weaker startup-only readiness guarantee.
- Native6 (148.50s scenario;149.618s suite): first nine sections passed. Its fresh shutdown helper
  still needed new issuance after the shared DB interruption and never entered the hook. The
  final helper uses the actual long-running gateway's cached credential, finds the receiving API
  by its entered marker, and retains every original deadline/exit/readiness assertion.
- Native7 (115.507s scenario;116.773s suite): first five sections passed. The pending32
  probe's artificial `CLIENT PAUSE 60 ALL` can exceed the fixed 150ms operation bound through
  server scheduling. A following PING correctly refused CACHE_UNAVAILABLE; no later section was
  reached. The corrected harness dispatches all 32 calls synchronously before the 33rd, so their
  actual promises occupy the slots without a server timer. It retains32 fulfilled,33rd saturation,
  same-client PONG/state and the separate 400ms unknown-mutation fault. No production timeout or
  result assertion changed. Scenario lint and generator typecheck pass; final D11 production
  checks above remain applicable. Native8 reruns the finite scenario with a fresh frozen source.
- Native8 (147.29s scenario;148.420s suite): all ten named sections pass, including actual
  entered-hook shutdown. Both live/readiness endpoints were closed after SIGTERM (neither
  responded200); the actual receiving container exited1 on its own deadline in 10,476ms, within
  the unchanged 12,500ms observation bound. Task containers/networks/volumes/images are empty and
  its temporary directory is removed. All 42 baseline ID/name/states match the full inventory.

Earlier full checks and failures remain in their original evidence files: initial133files/1211
pass; a later unchanged Board immediate-drag class flake resolved with unchanged15/15 focused
pass; browser79/81 resolved by correcting the new Preview expectation to422 and an unchanged
Favorites rerun (three targeted cases pass). After the PG observer change: full134files/1212
pass, browser81/81, build pass. After initial readiness changes: one existing cache test compared
separate TTL start times at an exact1ms source-expiry boundary. Its shared fixed source expiry
now clearly dominates the TTL; full result/auth/copy assertions remain. Full134files/1218pass,
browser81/81 and build pass followed. The later adapter audit requires final regressions below.

Focused final adapter evidence includes actual emitted helpers, resource-AND recovery,
actual-promise serialization past caller timeout, expired-request-context independence,
optional/shared-client order, no late probe/readiness reopening, AMQP publisher/consumer state,
Pub/Sub metadata/stream recovery, and safe Garage/search recovery without object mutations.
Actual extension checks and pinned generated TypeScript pass for no-DB Pub/Sub(86files), all
stub adapters(96) and installed features(125). SDK/broker behavior in those focused tests is
controlled, not native provider proof. The finite native fixture covers PG/Valkey/Keycloak.
Processes-off pins retain80/87/60files; `pin-review.json` lists every changed payload, all explained
by private runtime readiness, physical PG error observation and Garage setup. Frozen v1 is untouched.

Final code regression: `pnpm check` passes 135 files / 1,223 tests (116.35s), all Biome/type checks
pass; web build passes (1.36s, existing chunk-size advisory). The preceding full adapter check
had only three identity-loader failures from its lifecycle stand-in missing the new private
helper export; adding that no-op stand-in export gives 17/17 focused, then the full pass above.

Full browser passes 81/81 (6.0min), including TinyURL, the new mouse refusal and both complete
mouse rebuilds. Native8 passes all 10 named sections. The harness-only pending-precondition
correction subsequently passed scenario lint and generator typecheck; no production change
followed the complete D11 checks. No unrelated Board change or timing relaxation was made.

## Limits and preservation

Native cases cover one finite fixture and named failures, not an exhaustive matrix, throughput
benchmark, hostile-code sandbox, cloud deployment or production issuer. The COMMIT proxy drops
real PostgreSQL protocol traffic; it is harness fault injection. Native PostgreSQL outage uses
prewarmed generated workload/user credentials and does not establish fresh Keycloak issuance
recovery after its shared database interruption. Startup native observations are after actual
initialization; pre-ready/draining marker behavior is also covered by focused lifecycle tests.
Other provider readiness adapters have focused behavior/generated-compile evidence, not a new
native provider matrix. Target HTTP services and cached issuer availability are not invented as
recursive startup dependencies. Readiness detects transient required-provider availability within
the documented observation budgets, not every administrator resource/grant/schema change.

Reader version fences last only while keys are retained. There is no durable watermark,
immediate invalidation, global linearizable read, stale-serving contract, new session/webhook or
durable-work capability here. Prior offline/PGlite proofs are not relabelled native.

All 42 baseline container IDs/names/states have been preserved after every completed attempt,
including running `jeeves-postgres-1` on 54329. Unique task projects/loopback ports and exact-label
finally cleanup remove only task resources. Root hashes and the exact 34,001-byte owner binary
patch match the baseline; historical evidence, frozen outputs and owner untracked files remain.
`docker-before.json` and `docker-after-final.json` contain full inventories, including stopped
containers: 42 containers / 9 networks / 23 volumes / 43 images before and after. `preservation-final.json`
records exact owner/root/source preservation and empty task cleanup. No push or deployment ran.
RG14 is complete for coordinator acceptance; no later unit was read or executed.
