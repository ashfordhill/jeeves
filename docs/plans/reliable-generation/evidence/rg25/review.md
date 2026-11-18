# RG25 independent final review

Review input: accepted RG24 `ed996447993d09f7e8736ebe01074d1691d7c3d1`, following RG23
`99396d1b63b89b9ec2bc1ebaab3f8f5af6418b17`. This fresh reviewer implemented none of RG01–24.
The approved contract, D1–D12 and the RG15 owner amendment are the acceptance criteria.
No later unit brief or worker transcript was read; no other unit was executed and no delegation occurred.

Recommendation: **accept the implementation within the finite contract and carry the limits
below into RG26**. One bounded emitted-guidance defect is corrected. No unresolved release blocker
or architectural decision was found. Final regression checks pass as recorded below.
This is a release recommendation for the implemented generation contract, not deployment approval,
provider certification or proof that future application policy is correct.

## Source and actual artifacts inspected

The source trace covers the existing normalized resolver and supported-authoring commands,
installed registry/assembly, client and HTTP/process wiring, public API emission, extension checker,
product declarations/operations/mutation boundary, update staging and runtime mechanisms named
below. These remain extensions of the existing model, with JSON contracts and TypeScript output;
there is no second architecture model or central runtime service.

Actual emitted application text was read from RG24's retained link/account and catalog/event
`*-source-loc-inputs.json.gz` snapshots, including normalized designs, manifests, public API,
process wiring, slots, handwritten bodies, registered SQL, runtime and agent guidance. This is
inspection of the emitted artifacts, not inference from templates alone. The new
[emitted comparison](emitted-review.json) independently verifies all **83 link and 72 catalog
scaffolds** against their retained manifest hashes, regenerates each exact saved source, and
compares **35 link and 29 catalog runtime files** byte-for-byte. Core runtime files also match
their current templates. Application-owned body changes are expected and are not scaffold edits.

Representative call traces:

- Link creation: `items-api/create.slots.ts` exposes `ProductQueries` and callable admission;
  the handwritten `create.ts` declares `defineLocalOperation`. Generated binding supplies the
  product-only commands and private replay pool. `bindLocalOperation` derives account scope,
  validates immutable input, checks committed replay twice around a database advisory lock,
  then runs new-work admission. Product mutation, sealed replay and COMMIT share the database
  transaction. The product role stays active through every issued command, including unawaited
  command drain; hooks cannot commit or recover replay themselves.
- Catalog replication: `caller/send.ts` declares `defineDurableWork` and maps a shared catalog DTO
  to the compiled `ServiceTarget<"receive">`. `callee/receive.ts` explicitly opts into
  `defineWorkloadOperation` with its own `allowedCallers`. Generated `/internal/work/receive`
  invokes that opaque declaration; the ordinary stub answers405 and cannot manufacture protocol
  support. `catalog_sync` and `provider_apply` SQL increment an effect counter on conflict, so
  fixture uniqueness cannot conceal a second effect. The caller and callee databases do not
  pretend to share an atomic transaction.
- Catalog ingress/projection: private HMAC verification precedes JSON/pure event mapping;
  `defineWebhookWork` is opaque and cannot publicly accept unsigned work. The inbox persists
  before202. `apply-catalog.ts` uses `defineReceiptConsumer`; generated receipt/effect/progress
  commit precedes transport ACK. The product supplies DTO/SQL policy and receives no ACK controls.
- Browser navigation: generated `browser.ts` creates the independent session lifecycle and
  matching-Identity `sessionUser` target. `navigate.ts` sees immutable request facts and a scoped
  operation handle. Private request WeakMaps supply bearer availability; neither public context,
  dependencies nor persisted work contains user tokens.

## Guarantees challenged

| Area | Source/artifact conclusion | Independent historical behavior evidence |
| --- | --- | --- |
| Separate processes and precise authority | Each tile has its own process/lifecycle. Logical owner, process, module and display labels are distinct. Product `pr_*`, framework `r_*`, namespace DDL and setup credentials remain separate; registered reads use READ ONLY. Public handles select exact module operations and parameters. | RG14 native8 and RG23 native6 use real distinct API/Worker logins, named published views,42501 foreign/protected/DDL/setup denials and25006 mutation-in-read refusal. |
| Private-network and callable authentication | Resolver requires a matching installed workload Identity for real service links. Generated targets fix destination/audience/operations; internal routes always verify workload credentials and compiled caller allowlists independently of required user guards. Same-process template handles call the checked core, so auth/input/effect checks remain. | RG23 native6 and RG14 native8 missing user/workload401, wrong caller403, user-as-workload401 and absent anonymous aliases; `callable.test.ts` covers same-core callable refusals and immutable output. |
| Extension boundary | Public API8 exposes DTOs, scoped operations and opaque declarations. Checker traverses shared contracts and own-module helpers, hashes scaffolds and refuses private/runtime/driver/effect imports. Runtime policy/local-mutation scopes deny captured network/database handles; product role boundaries outlast callbacks. | RG23 focused166/166 and final broad tests; RG25 actual checker/TS run independently confirms valid API8 bodies compile and async shared policy/private runtime imports refuse. D10 remains cooperative misuse protection. |
| Replay and uncertainty | Account and workload scopes are separate. Local replay is recovered before admission; hash conflict is explicit. Transaction loss/timeout does not grant retry or imply rollback. Private sealed replay does not expose keys. | RG23 native6 proves one mutation, shared admissions, unavailable-admission replay, lost actual COMMIT reply with sealed replay and one effect; all original foundation expectations remain in the oracle. |
| Shared admission and cache | Single-key Valkey script owns admission. No per-copy fallback allowance. Mutable reader fills compare exact uint64 versions and preserve absolute validity; each waiter rechecks validity/eligibility. Admission and reader eviction requirements refuse sharing. | RG14 native8 and RG23 native6 prove contention, retained AOF/no-eviction admission, saturation without reconnect, unknown refusal, old-fill fencing, exact validity and optional-cache fallback/recovery. |
| Durable remote recovery | Store-time claim/renew/complete compare holder/fence and lease. Canonical remote input/configuration and stable identity survive holders. The callee owns opaque expiring tickets; the selected ticket commits before execute. Reclaim never replaces it. Replay precedes ticket validity checks, allowing retained committed recovery after ticket expiry; absent replay plus expired/missing selected ticket cannot mutate. | RG23 native5 actual paused holder/replacement uses one preparation, two executes, stable identity and local1/remote1; separate fresh-context emitted-store probe proves WORK_LEASE_LOST/effect1. RG15 focused tests specifically cover expired/cleaned tickets and lost checkpoint outcomes. |
| Background authority and scheduling | Workload-only opt-in cannot bypass a Required user guard. Compiled process identity is part of remote configuration; another role with the same owner cannot assume it. Scheduled ticks use database time, coalesce missed intervals, keep one unfinished intent and halt on failed/unknown work. | `durable-work.test.ts` and `scheduled-task.test.ts` inspect this boundary; RG23/RG24 native recovery uses actual same-Service authority. No interchangeable remote Worker or user delegation is claimed. |
| Webhooks, receipt retention and progress | Raw bounded bytes are authenticated before mapping/acceptance. Receipt ID is independent of aggregate date. Immutable store-time retention must cover delivery/retry/quarantine horizon; independent bounded cleanup preserves the equality boundary. Heartbeat, progress, unknown backlog and stale observation are distinct. | RG23 native5 gates actual INSERT/COMMIT before202 and survives Service death; native7 withholds real AMQP ACK, kills consumer, redelivers once, changes date, waits for actual retention/idle cleanup, observes stale45s versus live idle and broker recovery. Exact equality is in `receipt-lifecycle.test.ts`. |
| Sessions and forwarding | Pinned maintained OIDC/JOSE, PKCE/state/nonce, secure cookies, sealed credentials, CSRF and revocation remain private. Refresh commits an attempt marker before issuer dispatch and coordinates replicas with a row lock; unknown rotation is never blindly retried. Only pre-product user-verifier401 on GET permits one generation-aware refresh/retry. | RG23 native6 uses trusted task HTTPS/Keycloak: one rotation across two copies, temporary recovery, unknown/no extra grant, definitive revocation/token erasure and CSRF403. RG20/21 focused tests cover cancellation/lost COMMIT and no POST/product/workload401 retry. |
| Lifecycle/deadlines | Configuration checks precede clients; resource keys include credentials/access scope. Dependency calls track actual promises beyond timeout; receiver budgets use clamped durations. Required availability feeds readiness while optional cache failure permits fallback. Reverse cleanup has a final10s process termination bound. | RG14 native8 and RG23 native6/7 exercise native store/broker recovery, live200/ready503 and self-termination of an entered hung hook. Other provider adapters have focused tests, not broad native certification. |

Source anchors are under `jeeves-generator/templates/local-v2/assets/src/runtime/`:
`operation`, `process`, `transaction`, `product-operations`, `product-mutation`, `local-operation`,
`work-integration`, `durable-work`, `workload`, `rate-limiter`, `positive-cache`, `receipts`,
`receipt-consumer`, `webhook`, `browser-session` and `browser-refresh`; plus
`scripts/check-extensions.mjs`, `src/v2/{extension-api,client-wiring,http-wiring,assemble}.ts`,
`src/update.ts` and `jeeves/packages/spec/src/{generation-resolver,supported-authoring}.ts`.

## Reuse, migration and remaining duplication

Both mappings use the same emitted runtime and narrow hook mechanism. Account/admission/cache
policy is confined to link hooks/SQL; catalog DTO mapping, HMAC event policy, replication and
projection SQL are confined to catalog-owned files. Source inspection found no QRWTY quota,
entitlement, reputation, Stripe or product-route policy promoted to a runtime default. Neither
fixture implements every mechanism: together they demonstrate reuse across different domains;
they are not two complete products or an exhaustive cross-product matrix.

The saved model remains readable when incomplete. Normal mouse/chat commands share resolver
blockers, and preview/download/CLI apply the same installed export requirements before output.
Missing private/authenticated template adapters, arbitrary external recovery targets, raw token
verification/arbitrary HTTP handles and unfinished hooks remain refusals or required custom gaps.
Passing TypeScript/checker does not promote an unfilled hook to a working application.

`update.ts` stages the actual kept handwritten source against new interfaces/checker before writes,
preserves extensions, refuses generated overrides and identity/namespace changes, and treats absent
legacy API metadata as1. RG24's actual archived GS08 source at `d524845` retains its original
pre-versioned manifests/imports. Its tiny unchanged-namespace API1→8 example succeeds in place
only after manual readonly-input repair and acknowledgement; unchanged bodies survive repeats.
Its old catalog m_*→p_* namespace conversion still refuses with acknowledgement. That evidence is
**cold adoption only**, requiring reviewed external data migration for a real legacy database.

RG24's compatible stable-ID API8 stopped updates preserve rows/xmin, session absolute/idle promises,
runtime and volume identities, modified hook bytes and pending work ID/selected ticket. Actual
admission2→3 and body65536→1024 behavior changes, followed by two identical public update applications,
support the maintenance claim. They do not establish mixed-version rolling updates.

There is remaining private historical code: `module-clients.ts` retains raw `databaseClient`,
`scopedTransaction` and `idempotentCall`, and `positive-cache.ts` retains its legacy internal helper.
The inspected API8 slots/wiring use `ProductQueries`/`productDatabaseClient` and explicit reader
capabilities; the checker refuses importing those private legacy controls. These are not a second
compatibility runtime supplied to hooks. Frozen `templates/local-v1` stays separately preserved.
No unsupported old hook was wrapped and relabelled guarded. Removing private old helpers is not
needed to establish the reviewed boundary and is not expanded into new work here.

The four RG24 backend-only reports, scopes, exact recount receipts and separate SQL/manual-work
inventory were inspected. Their high template shares describe backend composition of small
fixtures, not labor saved, a full application's60% result or superiority to QRWTY B. Test/TLS/issuer/
proxy infrastructure and operational migration effort remain separate costs.

## Corrected finding and emitted change locality

The actual API8 `.jeeves/extensions.md` SQL migration paragraph twice instructed
`--ack-extension-api=7`, while the actual updater's refusal and staged migration require the
emitted target8. `assemble.ts` now interpolates `model.extensionApi.version` in those two commands.
No approved API, capability, normal control, migration, dependency or runtime behavior changes.

The new emitted-guide regression requires nonempty acknowledgement instructions and checks every
command against the emitted manifest's target. It first reproduced `{8,7}` versus `{8}` in the
[corrected pre-fix oracle](guidance-before-corrected-oracle.txt), then passed with existing actual
updater tests ([54/54 focused](guidance-after.txt)). The first test draft incorrectly expected
commands in README too; [that failed draft](guidance-before.txt) is retained. README only points
to the extension guide and is byte-for-byte unchanged. This corrects the reviewer's initial
overbroad README assumption; it does not weaken the command-version assertion.

The three80/87/60-file processes-off pins change only the guide hash and its manifest hash
([exact pin review](pin-review.json)); runtime, README and semantic report pins are unchanged.
Regenerating both checkpoint snapshots changes only guide content and report/manifest provenance;
the report with source inventory normalized is exactly equal, and every runtime byte is unchanged
([comparison](emitted-review.json)). The first audit expected no report change; inspection identified
the assembler source fingerprint, then verified exact semantic equality instead of ignoring it.
All historical evidence remains at its own revision. No generated file was manually patched.

## Checks run here versus retained historical evidence

RG25 runs: focused guidance/update54/54; actual emitted75-file API8 build/boundary checker and
TypeScript7.0.2 using the unchanged RG22 compile runner and offline frozen-lock install
([compile log](compile.txt)); emitted/scaffold/runtime hash comparisons and pin review; read-only
root/owner/container/accepted SQL/dependency/frozen-v1 preservation; final link/status checks.
The compile runner also proves old dynamic-string and additive typed operation calls compile,
then observes actual async shared-policy and private-runtime import refusals. It removes its
own scratch export. This is compile/boundary proof, not newly observed native behavior.

Standard checks after this bounded code correction: [pnpm check](check-final.txt) passes lint/types
and145 files/1354 tests (113.94s; existing lint warnings/infos remain); [browser](e2e-final.txt)
passes87/87 (5.0m), including TinyURL and both full mouse rebuilds; [web build](build-final.txt)
passes (1.50s, existing chunk-size advisory). Focused formatting passes for the changed source/pins
and own JSON evidence. Own text logs normalize trailing whitespace/blank EOF lines only.
No authoring command or tool description changes, so D11.5 adds no offline chat eval. There is
no runtime/user-flow change requiring a new manual scenario; the browser suite covers TinyURL,
mouse composition/refusals and the two complete mouse rebuilds.

The [read-only evidence audit](evidence-audit.json) records inspected receipt hashes, independently
compares the94 catalog payload identities across native5/6/7, and checks recorded preservation
values and zero-create/replace repeat receipts. It does not rerun native behavior.

Historical evidence was inspected beyond pass labels:

- [RG14 review](../rg14/review.md), native8 named actual assertions, failure chronology and cleanup.
- [RG23 results](../rg23/results.md), native6 foundation/session actual observations, native5's
  three passing catalog groups **and its failed receipt group**, native7 receipt/retention/broker
  actual observations, native oracles/proxy, source/emitted reuse receipt and final check/build/
  browser logs. Native5 is not an all-pass run. The fresh-context fence probe separately isolates
  fencing from an expired30s execution context. No all-skipped run is counted as proof.
- [RG24 migration](../rg24/migration.md), four passing per-case witnesses across native2/3/4,
  legacy provenance/refusals, actual preservation/determinism, checker/compiler logs and
  [maintenance](../rg24/maintenance.md)/recount evidence. Failed overall runs retain their failures.
  Final145-file/1353-test check and87-browser logs apply to accepted24; they are not RG25 reruns.

No native case is genuinely doubtful or affected by the two guide command changes. D11 therefore
does not justify repeating native store/process/broker faults or the full generated-system matrix.

## Limits and preservation

Retain these release limits: cooperative authors only; finite replay/receipt retention; retained
cache-key version fences and compatible clocks/durable admission store assumptions; generated
workload-only remote recovery only; secret-bearing remote result checkpoints refused; unknown
rotation may require sign-in; unknown remote work remains unknown for reconciliation. A shared
owner's Worker is not interchangeable remote authority. Guarded identities require drain,
reconciliation and explicit migration. Generic POST keys, leases alone and arbitrary provider
headers establish no exactly-once guarantee. Generic HMAC is not Stripe. Production issuer/client/
audience integration, stopped-update coordination, deployment, replica sizing, cloud adapters and
unwritten product logic remain real external obligations.

Original roots and owner README SHA256
`7cee84a454f220152e8c973b4c2062c603c82067f334ad628beeae0332c0aa40`, original owner patch/archive
mapping, accepted050–055/Counter100–101, dependency assets, field apps/exports and frozenv1 remain
preserved. [Before inventory](preservation-before.json), [after inventory](preservation-after.json),
[full preservation checks](preservation-final.txt), exact e2e inventory comparison
([before](projects-before.txt), [after](projects-after.txt)), [link checks](links.json) and
[safe artifact scan](safe-artifacts.json) pass. All42 original container ID/name/state triples,
9 networks,23 volumes and43 images match; the two old e2e project identities remain and own
projects/resources remaining0. Owner studio4300/4310, original databases, historical evidence, queued future work and
root files are untouched. No paid/live provider/model call, push or deployment occurred.
