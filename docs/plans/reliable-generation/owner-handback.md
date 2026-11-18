# Reliable generation: owner handback

RG01–RG25 are accepted, ending at `3bfce24e1a0bac1bebd3b3d7f77f77c18c7a61db`.
RG25's [independent review](evidence/rg25/review.md) found no unresolved release blocker within
the approved finite contract. RG26 is complete for coordinator acceptance in the commit titled
`RG26: retire stale plan queues and document the generated foundation`; acceptance is pending at
write time. Resolve its self reference with:

```sh
git log -1 --format=%H --fixed-strings --grep='RG26: retire stale plan queues and document the generated foundation'
```

The owner already approved [Wires and deployment](../wires-and-deployment/units.md) as the next
plan **after RG26 acceptance and commit** (`95d60ac4b34a70336b246d30949e5f8ce006fb3c`). The
coordinator starts WD01 then. It is not abandoned, an RG extension or a request for another
approval. RG26 did not read WD unit briefs or execute WD work/checks. Other unfinished older
queues are [inactive or superseded](../README.md); this handback adds no implementation queue.

## What the current foundation generates

The saved diagram plus installed versioned TypeScript templates remain the source of generated
files. Studio mouse/chat, preview/download and CLI use the existing normalized resolver and
registry; unsupported new combinations refuse before mutation/output. Saved incomplete/legacy
intent stays readable and repairable. Generated code and required product completion are separate.
The [generator guide](../../../jeeves-generator/README.md) and emitted `.jeeves/extensions.md`
describe the current API8 application-writing boundary.

| Shipped surface | Generated responsibility | Application responsibility and boundary |
| --- | --- | --- |
| Independent processes and lifecycle | One lifecycle/resource registry per process, credential-aware sharing, configuration before clients, cancellation/deadlines, classified HTTP errors, body limits, safe logs, required-dependency readiness and a final 10-second stop bound. | Run/stop the processes and supply deployment configuration. Cancellation/termination never proves rollback. Optional cache fallback is distinct from a required-store outage. |
| Narrow API8 extensions and callable modules | Copied/frozen DTOs, pure policies, scoped operation handles, stable module/process/owner identities and checked imports/scaffold hashes. Favorites, Rate limiter and Cache reader have actual callable bindings. | Write product DTOs, policies, hook/stub bodies and shared pure definitions in `src/contracts/`. Checks protect cooperative authors, not hostile Node code. Unwritten hooks still throw/refuse. |
| Logical ownership and product SQL | Independent API/Worker roles may explicitly share one owner with distinct exact grants. Registered parameterized queries run READ ONLY; local commands use product roles. Namespace-only versioned migrations and protected checksum history separate DDL/setup authority from runtime credentials. | Name tables/views/operations, supply product SQL and reviewed migration/baseline work. No arbitrary SQL, protected-state access, cross-owner writes or inferred schema conversion. |
| Keys and service identity | Purpose-bound signing/sealing handles; private rings, account replay sealing and workload credentials. Route-stub GET/POST roots authenticate audience and compiled caller allowlists even on private networks. | Supply/rotate secret files and register the exact issuer clients/audiences. User identity remains independent. Installed-template cross-process adapters and arbitrary external recovery targets remain gaps. |
| Local replay, admission and cache | Account-scoped canonical replay commits with product mutation and precedes new-work admission. Shared atomic fail-closed rate limiting; immutable/versioned cache readers preserve absolute validity and version fences. | Choose trusted keys, policy, SQL/codec and final validity checks. Separate admission's durable no-eviction store from reader LRU cache. Replay/retention and cache fences are finite. |
| Durable work and interval tasks | Persisted intent, database-time leases, monotonic fences, bounded retries, stale completion rollback and coalesced scheduled ticks in Service or Worker. One unfinished scheduled intent spans copies. | Supply scoped product completion and declared mappings. Running process time is required; no cloud scheduler, cron language or general saga engine. Failed/unknown scheduled work halts new ticks. |
| Generated remote work recovery | Explicit workload-only callee opt-in, separate replay scope, stable remote work identity and callee-owned opaque expiring tickets. Selected ticket commits before execute and remains unchanged across holders/fences. | Recovery is process-affine: copies of the same compiled workload/process identity qualify; a same-owner Worker is not interchangeable. Required-user guards stay required. No saved user bearer, impersonation, delegation or new provider. Expiry never authorizes replacement/reexecution; unknown remains unknown for reconciliation. Declared secret remote-result checkpoints refuse before execution. |
| Webhooks and consumer receipts | Generic bounded raw-body HMAC verification before mapping, durable inbox before 202, receipt/product commit before transport ACK, date-independent identity, bounded idle cleanup and distinct heartbeat/progress/unknown backlog. | Map event DTOs and registered SQL. Respect the total delivery horizon and declared receipt retention (up to 30 days). Event counter, scheduled ticks and webhook completed work use fixed seven-day retention; general durable work declares 60–604800 seconds. Generic HMAC is not Stripe or arbitrary provider signatures; no forever dedupe or automatic Pub/Sub quarantine requeue. |
| Browser sessions and forwarding | Maintained OIDC code+PKCE/state/nonce, secure cookies, sealed tokens, CSRF/revocation and coordinated refresh with committed attempt markers. Private user credentials forward only to declared matching-Identity guarded operations with independent workload auth. | Supply trusted HTTPS and exact selected Keycloak client registration. Unknown rotation may require sign-in. Only generated pre-product user-verifier401 on GET permits one generation-aware refresh/retry; no generic proxy or automatic POST replay. |

Private historical `databaseClient`, `scopedTransaction`, `idempotentCall` and cache helper code
remains inside runtime implementation files. API8 slots/wiring use guarded product interfaces;
the checker refuses private imports. Those helpers are not an exposed second hook runtime.
Frozen `local-v1` and old exports are preserved with their own historical contracts.

## Fixed gaps, open gaps and deliberate limits

The [current gaps register](../../template-gaps.md) distinguishes fixes from unavailable work.
RG closes the previous lifecycle/configuration parity, callable composition, precise SQL/grants,
replay ordering/atomicity, shared admission, durable scheduling/recovery, authenticated generic
inbox, finite receipts/progress, session refresh/forwarding and authoring/export parity gaps.
RG14 also corrected borrowed-client error handling and continuous required-dependency readiness.
RG25 corrected two emitted SQL migration acknowledgements to target API8; the exported README
still links to `.jeeves/extensions.md` and its bytes were unchanged.

Remaining gaps include the earlier media hook/response/outbox policies, address trust at the
edge, managed token credentials, cloud endpoints/names, provider-specific signatures/SDKs,
arbitrary external recovery and unwritten application policy. Secret-bearing remote result
checkpointing is refused. No general user-delegated background operation, erasure saga, Stripe
pack, cloud provisioning, deployment, sizing, UI builder or hostile-code sandbox was shipped.
These are limits/owner choices, not newly scheduled work.

Cache version fences survive only while their key survives; compatible clocks and configured
store durability/retention are assumptions. Shared admission has no per-copy allowance when its
store is unavailable. Replay/receipt retention must cover the promised retry/delivery horizon.
Idempotency headers, leases, generic HMAC and passing types do not establish arbitrary provider
exactly-once behavior. An uncertain commit/publish/remote result is not silently treated as failed.

## Evidence and its limits

- [RG14 foundation review](evidence/rg14/review.md): finite native8 two-copy foundation cases,
  including exact SQL authority, replay/admission/cache and real dependency/shutdown faults.
- [RG23 results](evidence/rg23/results.md): native6 foundation/session cases; native5's three
  passing catalog acceptance/remote/fence groups; native7 receipt/retention/heartbeat/broker cases.
  Native5's failed receipt group and earlier failed/unreached runs remain explicit. No all-skipped
  run counts as proof. These are two small domain mappings, not two completed products.
- [RG24 migration](evidence/rg24/migration.md) and [maintenance](evidence/rg24/maintenance.md):
  four per-case witnesses, stopped compatible updates, full export repeat hashes and four exact
  backend-only LOC recounts. Their high retained-template shares describe small-fixture backend
  composition, not labor savings, a full application's60% result or a new full QRWTY A/B benchmark.
  SQL/JSON declarations, manual migration and 974 checkpoint-infrastructure LOC are separate costs.
- [RG25 independent final review](evidence/rg25/review.md): actual retained 83/72 scaffold hashes,
  35/29 runtime-file comparisons, 94 catalog payload identities and source/effect/authority traces.
  Its bounded guide correction passed 54 focused tests, actual 75-file checker/TypeScript7.0.2,
  `pnpm check` (145 files/1354 tests), browser 87/87 including TinyURL/both mouse rebuilds, and web
  build. Existing lint information/warnings and the build chunk advisory remain recorded.
  Native behavior was unaffected; no new native matrix was claimed or required.
- RG26: documentation-only D11 link/status/source/preservation checks in [its receipt](evidence/rg26/README.md).
  No full tests/build/browser/native/app stack was run solely for prose, and no earlier failure
  was erased or relabelled passing.

The original [Codex evaluation](../../../.docs/readme/v0/qrwty/evaluations/codex-2026-11-16.md)
overstated A's bounded drain: its pending-handler wait and process cleanup had no overall
termination bound. That evaluation stays intact. Current generated lifecycle supplies the final
10-second stop deadline, with [RG14](evidence/rg14/review.md) and [RG23](evidence/rg23/results.md)
observations. This does not retroactively repair QRWTY. No QRWTY re-diagram, rebuild or deployment
was performed. No exhaustive cross-product matrix, mixed-version rollout or production issuer/
cloud/provider certification is implied by these local observations.

RG24's measured backend composition (nonblank source LOC, unchanged source-loc-v2 method):

| Scratch mapping | Untouched baseline | Retained template / final backend | Post-template |
| --- | ---: | ---: | ---: |
| Repaired in-place API1 hook | 2257 | 2252 / 2256 | 4 |
| Cold adopted catalog | 5794 | 5772 / 5797 | 25 |
| Link/account | 7572 | 7509 / 7641 | 132 |
| Catalog/event | 6495 | 6474 / 6572 | 98 |

Each report has a reviewed backend/UI scope and exact recount inputs. SQL, product declarations,
manual migration and test infrastructure are excluded and inventoried separately. Full authored
TypeScript attachments are also counted separately: the line-matching numerator can retain
stub-shaped lines, so “post-template” alone is not a measure of engineering effort.

## Migration and maintenance cost

1. Preserve the current export, application SQL/data and hook bytes. Inspect the old manifest:
   absent extension metadata means API1. Read the **target export's** `.jeeves/extensions.md`;
   current acknowledgements use `--ack-extension-api=8`.
2. Manually migrate old unrestricted hooks to public API8, shared DTOs, scoped operations and
   registered product SQL. Install target exact dependencies when necessary. An acknowledgement
   never bypasses staged TypeScript/checker, generated-override, identity or SQL guards.
3. For old re-runnable SQL, inventory actual namespaces/data, prepare reviewed versioned baseline
   files and the external-reviewed receipt. The updater does not execute SQL or infer conversion.
   RG24's genuine archived API1 unchanged-namespace example succeeds in place **only after manual
   readonly-input repair** and acknowledgement. Legacy live m_*→p_* conversion remains guarded/
   manual: the catalog witness proves **cold adoption only**, not automatic live migration.
4. Coordinate a stopped application with stable IDs: diagram edit, `pnpm stop`, public
   `update:v2 --check`, public update, `pnpm build`, then `pnpm start`. RG24 proves preserved hook
   bytes, product rows/xmin, session absolute/idle promises, runtime/volume identities and pending
   work ID/selected ticket for compatible API8 updates. Actual admission2→3 and body65536→1024
   changes work. Two identical repeat updates preserve complete export hashes including shadows.
5. Identity/namespace/handler or incompatible remote-process changes still require drain,
   reconciliation and reviewed application/data migration; do not change IDs to evade unknown
   outcomes or mint a fresh ticket. Production issuer/client/audience setup, secrets, stopped-copy
   coordination and product validation remain operator/author work. Rolling mixed versions are
   outside the proof.

The owner can rely on the installed finite mechanisms and proceed with the approved WD queue.
Choosing an application migration, additional provider support or another currently deferred
capability remains an owner decision. Neither adopting RG in QRWTY nor any product rebuild is
automatically authorized by this handback.

## Unit status and revisions

All RG01–25 rows are accepted. RG26's row records the current completion/acceptance boundary.
Full hashes and Git-subject checks are retained in [the status map](evidence/rg26/unit-status.json).

| Unit | Accepted result | Commit |
| --- | --- | --- |
| [RG01](units/rg01.md) | Versioned capability contract and migration guard | `895d3260fb16` |
| [RG02](units/rg02.md) | Shared lifecycle and checked extensions | `ac2113b2ec74` |
| [RG03](units/rg03.md) | Budgets, cancellation, unknown outcomes | `d3b0e3f58402` |
| [RG04](units/rg04.md) | HTTP errors, limits, health, safe logging | `ac251e7a8754` |
| [RG05](units/rg05.md) | Callable bindings and stable identities | `7e0b02a5a204` |
| [RG06](units/rg06.md) | Logical ownership and precise grants | `0a059385ad92` |
| [RG07](units/rg07.md) | Versioned product migrations and scoped SQL | `102da20db4c6` |
| [RG08](units/rg08.md) | Purpose-bound keys, signing and sealing | `cbac7d80f9a6` |
| [RG09](units/rg09.md) | Authenticated workload calls and allowlists | `1bc45e0077b1` |
| [RG10](units/rg10.md) | Atomic local mutation/replay ordering | `897ccf45393a` |
| [RG11](units/rg11.md) | Atomic cache primitives and saturation semantics | `a97c776ca000` |
| [RG12](units/rg12.md) | Callable distributed admission | `f11ba8a9233e` |
| [RG13](units/rg13.md) | Callable cache freshness/version contracts | `925e917e8790` |
| [RG14](units/rg14.md) | Independent native foundation checkpoint | `b8191719e669` |
| [RG15](units/rg15.md) | Durable fenced work and approved workload recovery | `307197863d4b` |
| [RG16](units/rg16.md) | Service/Worker interval tasks | `f75304e1c430` |
| [RG17](units/rg17.md) | Authenticated generic webhook inbox | completion `9818976eb45e`; source absorbed in owner `c8e41d0dd66b` |
| [RG18](units/rg18.md) | Finite receipts, cleanup and progress | `ba89ff12822a` |
| [RG19](units/rg19.md) | Browser OIDC/cookie/CSRF authority | `21fb6cac3e28` |
| [RG20](units/rg20.md) | Coordinated refresh and failure states | `ecef0c2bae8a` |
| [RG21](units/rg21.md) | Private session-aware service forwarding | `326e3491fb38` |
| [RG22](units/rg22.md) | Composition and authoring/export parity | `c3192e03f056` |
| [RG23](units/rg23.md) | Cross-domain native failure/recovery checkpoint | `99396d1b63b8` |
| [RG24](units/rg24.md) | Regeneration, migration and backend composition proof | `ed996447993d` |
| [RG25](units/rg25.md) | Independent final review and guidance correction | `3bfce24e1a0b` |
| [RG26](units/rg26.md) | Documentation complete; coordinator acceptance pending | unique subject / resolving command above |

RG17 provenance is intentional: the external owner archive/index commit absorbed source and
earlier evidence while staging overlapped; the following RG17 commit records completion/final
evidence. The [append-only provenance entry](../../handoff.md#2026-11-17--rg17-completion-provenance-and-screenshot-preservation)
explains it. No history repair or invented single-source commit is claimed.
