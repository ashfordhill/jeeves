# QRWTY v2 combined generator review

This is the generator input for the separate field build. The accepted generator is Jeeves
`cbb8f5ed72d5e37f323a27b12f863761611f8a5c`. The reviewed parent is project
`8994962f-abc4-4903-a609-616d9c8b7409` at revision 4 in `b80d4933`. Its raw committed JSON hashes to
`c16481b7e95198e7894faaa5b2f61724bcdb5ffd931579f4ee346785c7500e43`. The live parent opened at
revision 6 and matched the reviewed content apart from revision. The coordinator seeded separate
project `f742d1a4-d195-4418-b30f-a0cc15851ecf` at revision 1. Mouse authoring saved revision **10**.
The accepted Studio ZIP download completed at 22:23:27 UTC on November 19, 2026.
[Studio copy](http://127.0.0.1:4300/?project=f742d1a4-d195-4418-b30f-a0cc15851ecf) ·
[Reviewed source](../../../../field-projects/qrwty/proposed-design.json) ·
[Starting export and settings](../baseline/README.md) · [Download provenance](download-facts.json.gz)

## Saved differences

The full saved object matched the reviewed JSON with the entries below applied. The two project
IDs are Studio metadata outside the design JSON. All diagram structure, ownership, wires, selections
and other fields matched, including Browser Optional sign-in, enabled guest context and offline
refresh, Link Optional and Account and Billing Required. The Browser idle and absolute limits still
read 86,400 and 604,800 seconds. The webhook signature window stayed 300 seconds and the retention
timer stayed at 60 seconds.

| Stable ID | Saved path | Reviewed r4 → derived r10 | Reason |
| --- | --- | --- | --- |
| Design document | `revision` | 4 → 10 | The copy started at r1 and Studio saved nine edits. |
| `identity` | Studio element `settings.provider` | `oidc` → `auth0` | Select the designated provider for user and workload verification. |
| `identity` | Element `description` | “Issues the tokens that identify users and services. This diagram uses Keycloak. QRWTY uses Auth0 in staging.” → “Auth0 issues the tokens that identify users and services.” | Reflect the saved provider. |
| `verified-payment-event` | Module `settings.signatureFormat` | absent → `stripe` | Verify native Stripe snapshot events at the inbox. |
| `verified-payment-event` | Module `settings.bodyLimitBytes` | `"65536"` → `"262144"` | Accept the selected 256 KiB raw-body limit. |
| `verified-payment-event` | Module `description` | “Saves a payment notice before replying. Today QRWTY's edge must check Stripe's signature and sign the message for Jeeves.” → “Verifies Stripe's signature and saves the payment notice before replying.” | The receiver itself authenticates and saves the notice. |
| `analytics-worker-click-aggregator` | Module `settings.replayDays` | absent → 31 | Permit the requested bounded replay horizon. |
| `analytics-worker-click-aggregator` | Module `settings.receiptDays` | absent → 35 | Retain counted IDs longer than the replay horizon. |
| `analytics-retention` | Module `settings.keepDailyTotalsMonths` | absent → 13 | Pass the product cleanup commands the selected UTC calendar cutoff. |
| `analytics-retention` | Module `description` | “Deletes click IDs older than 35 days and daily totals older than 13 months. Runs even when no new clicks arrive.” → “Deletes expired daily totals and breakdowns even when no new clicks arrive. The click consumer expires counted IDs separately.” | Name the task that owns each deletion. |

The settings were set through the Studio inspector, using Simple for Identity and Detailed for the
module rows. Reload and mouse selection showed the saved values and retained Browser controls.
Blueprint v3 at revision 10 carries the edited settings and the retained sign-in fields. Its
`generationFindings` include the ordinary `NEEDS_TEMPLATE` declarations for installed-host
resolution. The actual installed preview and CLI had zero findings. [Simple](view-simple.png) ·
[Detailed](view-detailed.png) · [Identity](mouse-simple-identity.png) · [Stripe](mouse-detailed-stripe.png) ·
[Click receipts](mouse-detailed-receipt.png) · [Calendar cleanup](mouse-detailed-calendar.png) ·
[Blueprint v3](blueprint-v3.json.gz)

## Field build inputs

These SHA-256 values cover the original bytes inside each gzip file. Decompress files with
`gzip -dc` before editing, opening or checking them. The source is editable schema-3 JSON.
The ZIP is the browser download from Studio.

| Artifact | SHA-256 |
| --- | --- |
| [Canonical source](design.json.gz) | `2f4b134a8c61b296c5f48be90ec95472c86373cfc7151fefbcf3901d89663d1c` |
| [Studio ZIP](studio.zip.gz) | `2335d52c44d27b42690cf05ee0a419c75f100e52e776fd7c403f102d1ff6f243` |
| [Manifest](manifest.json.gz) | `b9046750d4272f6697e9feb073436632b6e4b4766e5fe396bca9ec0e4a898fe7` |
| [Deployment contract](deploy-contract.json.gz) | `03b5b076582b2edd29658abd6a9443676897254435810e0cb4005ddb9d84f56e` |
| [Blueprint v3](blueprint-v3.json.gz) | `c37684a7557f691e7f4e8b5933a22101b3cdf472607941c712e44c6ae2039ed8` |
| [Generation report](report.json.gz) | `514225ffe22cc6d5abd7d4708b4f90a58286ec4cf9bedf3c65fb58fc2f0a16ed` |

The Studio preview and direct download returned the canonical source hash and r10. The independent
comparison checked the ZIP CRC, unique paths, matching trees and byte equality for every one of
153 files. All 152 manifest payload hashes and byte lengths matched, and the ZIP's embedded input
was byte-identical to the saved canonical source. The seven application processes reported zero
findings and 24 required gaps. The generated report describes a semantically complete plan
with `applicationComplete: false`, `strictReadiness: not-assessed` and `runtimeVerification: none`.
A frozen offline install downloaded zero dependencies. The unchanged scaffold passed its API v8
extension check and TypeScript build. Public `update:v2 --check` reported 152 unchanged files,
zero creates or replacements and empty removal and override lists. [Per-file SHA-256](per-file-sha256.json.gz) ·
[Raw checksums](SHA256SUMS) · [Independent comparator](compare-exports.py)

The first native combined attempt on `0a88c3a15e9559e9f343abd6336bf11ef6a46b0d` exposed a
Pub/Sub crash on the first periodic probe at 22:03:57.560 UTC. The SDK dereferenced a null retry
policy when given `retry: null` together with `maxRetries: 0`. The repair supplies the two-second
deadline and the null retry policy to publisher, quarantine publisher and metadata probes. The
accepted export changes three files from the initial Studio ZIP, namely the generated
`src/runtime/module-clients.ts`, report and manifest. The canonical source, blueprint and
deployment contract retain their hashes. [First worker crash](../pubsub-repair/original-worker-crash.log) ·
[Repair evidence](../pubsub-repair/README.md) · [Export hash changes](repair-export-diff.json.gz)

The existing dev API still served its startup registry after the template-only change. A repeat
download there at 22:22:24 UTC returned the pre-repair ZIP. The accepted mouse session used a
fresh Studio and API on separate loopback ports against the same persistent saved design. The
final ZIP response matched the repaired manifest. Both temporary listeners were closed and the
owner's processes and projects stayed in place.

```sh
# Use Node 24.21.0 and pnpm 12.16.1 from the Jeeves checkout.
evidence="$PWD/docs/plans/qrwty-v2-generator/evidence/combined"
scratch=$(mktemp -d)
gzip -dc "$evidence/design.json.gz" > "$scratch/design.json"
gzip -dc "$evidence/studio.zip.gz" > "$scratch/studio.zip"

pnpm --filter @jeeves/generator export:v2 "$scratch/design.json" "$scratch/cli"
python3 "$evidence/compare-exports.py" "$scratch/studio.zip" "$scratch/cli" "$scratch/design.json"
(cd "$scratch/cli" && pnpm install --frozen-lockfile --offline && pnpm build)
pnpm --filter @jeeves/generator update:v2 "$scratch/design.json" "$scratch/cli" --check
```

### Application work in the untouched export

Each identifier below is a required report entry. An implementation and its extension boundary can
produce two entries for the same module. Complete product migrations, registered scoped commands
and checked hooks against the declared owners and grants. The field build plan assigns product
requirements and acceptance separately. [Full report](report.json.gz) ·
[Field build and evaluation](../../../../field-projects/qrwty/v2-build-plan.md) ·
[Template gap register](../../../../template-gaps.md)

| Required gap IDs | Work the field application or deployment owns |
| --- | --- |
| `restricted-session-api-api-forwarding`, `module-session-api-api-forwarding` | Implement Browser routes and response, cookie and field mapping. Forward caller and user through declared targets. Make CSV export check ownership and consume quota through an explicit retry-safe mutation before formatting the returned data. |
| `restricted-link-api-link-operations`, `module-link-api-link-operations` | Implement guest creation, claim, safe retry, ownership checks, versioned editing, disables and deletion with Link-owned SQL. Bind a trusted pseudonymous client address for guest admission. |
| `restricted-link-api-abuse-and-moderation`, `module-link-api-abuse-and-moderation` | Implement moderation and audited operator authorization, report processing, and the Web Risk adapter. |
| `restricted-account-api-my-links`, `module-account-api-my-links` | Implement owner-scoped listing and account lifecycle. Supply a product adapter for Auth0 account deletion and recovery. |
| `restricted-account-api-link-analytics`, `module-account-api-link-analytics` | Implement ownership and plan checks, report and export queries, freshness and quota policy, and the declared reporting views. |
| `restricted-billing-api-customer-billing`, `module-billing-api-customer-billing` | Implement plans, checkout and portal adapters, customer mapping and retry identity. Use the Billing role for subscription changes. |
| `restricted-billing-api-entitlements`, `module-billing-api-entitlements` | Implement paid quota, entitlement, cancellation, grace and downgrade policy with owned SQL. |
| `module-billing-reconciliation` | Implement recurring bounded reconciliation, outbound Stripe lookup, and repair of unknown or failed effects. |
| `module-verified-payment-event` | Add the pure authenticated snapshot mapper and scoped completion. Implement event handling and deduplication consistent with the reviewed split between inbox INSERT and Billing subscription writes. |
| `restricted-redirect-service-resolve-and-redirect`, `module-redirect-service-resolve-and-redirect` | Implement exact redirect policy, the accepted publish requirement, stable click IDs, post-acceptance recheck and HEAD behavior. |
| `restricted-route-reader`, `positive-cache-application-bindings` | Register the named authoritative read on the published route view. Supply the scoped loader, cache key/codec, eligibility and invalidation behavior. |
| `restricted-analytics-worker-click-aggregator`, `module-analytics-worker-click-aggregator` | Implement checked product event mapping, verified replay age, daily totals and breakdown commands. Supply broker/archive retention and replay, invalid-event and freshness behavior. |
| `module-analytics-retention` | Implement and register the UTC cutoff SQL for totals and breakdowns. Keep exact-cutoff rows and prove idle cleanup in the field data shape. |
| `browser-issuer-browser-session` | Register the Auth0 browser and machine applications and audiences, configure rotating refresh and exact HTTPS callback/logout returns, and mount private secrets and the shared session ring. The deployment contract lists provider bindings, stamped ingress and relevant stores. |

The deployment contract specifies Stripe's exact public POST, private endpoint secret and 35-day
finite completion record. Its analytics process records 2,678,400 replay seconds, 3,024,000 receipt
seconds, required broker/archive coverage and a 13-month UTC policy at a 60-second cadence. The
field team still needs the production Pub/Sub archive, a trustworthy address source, outbound
provider adapters and the application SQL and routes. [Deployment contract](deploy-contract.json.gz) ·
[Owner requirements](../../../../field-projects/qrwty/implementation-notes.md)

## Native composition and legacy coverage

The native specimen is one separate runnable public CLI export. It combines the pinned
Auth0, Stripe and click-retention fixture designs, with the click channel switched to the
same Google Cloud Pub/Sub provider as the reviewed QRWTY source. It uses real PostgreSQL 17.11,
the generated pinned Pub/Sub emulator, a private TLS issuer with signed synthetic JWTs and
rotation, and Stripe SDK signatures with a disposable endpoint secret. The harness checks that the
generated scaffold stays byte-identical while the installed extension paths receive the existing
application-owned route hooks and SQL. The two database test clocks are deliberately different.
Auth0/Stripe use the running clock for credential and signature checks. Only the isolated analytics
database uses a controlled UTC clock, with Pacific/Kiritimati as its SQL session time zone.

The Auth0 fixture's Billing read returns a synthetic plan. The Stripe fixture writes its own
test subscription table under its payment owner. The reviewed QRWTY export instead gives its
separate inbox role ingress privileges and leaves subscription writes with Billing API. The
Pub/Sub probe publishes the test month's synthetic clicks straight to the isolated emulator.
It exercises the generated worker and durable retention boundary. The reviewed field route, Stripe
policy, archive and analytics schema remain application work. The fixture's Stripe verification
window is 60 seconds and its Browser session has shorter idle and absolute limits so it can reuse
the installed individual regression inputs. It uses the field's 256 KiB body limit and 31/35/13
retention values.

The accepted native composition ran at the repaired pin from 22:23:43 to 22:26:46 UTC with
128 emitted files and zero findings. The app passed its generated extension and TypeScript checks
before first-run. Nineteen fixture attachments filled product-owned paths, including twelve
generated-extension files checked by manifest and seven registered SQL files. The native
scaffold hash check passed and cleanup removed all run resources and private files.
[Native manifest](native-manifest.json.gz) · [Scaffold hash check](native-final-hashes.json.gz) ·
[Native observations](native-observations.json.gz) · [Cleanup](native-cleanup.json.gz) ·
[Reproduction](repro/README.md)

| Check | Observed in the combined export |
| --- | --- |
| Browser → Account → Billing | A synthetic Alice session returned the Billing fixture plan. Supplying both credentials returned 200. A user alone and a machine alone each returned 401, and a valid machine with no caller grant returned 403. After forced access expiry, two browser copies shared one refresh and one rotation. The database stored generation `1` with uncertainty false. The restarted copy read that session without refreshing again. |
| Signed Stripe notice and retries | The stamped edge returned 202. A PostgreSQL read immediately saw the raw-body digest. The same signed event returned 202 on two named copies across a restart. Fresh signed content for the same ID returned 409. One product event and active subscription state committed. |
| Stripe retention | Retention and the completion timestamp delta both read 3,024,000 seconds. Aging the completed fixture row to the cutoff let an idle sweep delete it. Another signed event reached failed after four attempts and retained its row without expiry. The subscription effect remained one. |
| Pub/Sub repair across repeated probes | The initial Click processor stayed healthy with the same start and zero restarts for a 27-second observation, spanning at least five five-second probe intervals. This happened before the clock test intentionally restarted it. |
| Two-copy counted replay | The emulator accepted the same stable business ID with fresh broker IDs. The first and second consumers reported distinct persisted worker IDs. Replay on day 31 left the daily and breakdown totals at `1` each. A fresh event at 2,678,400 seconds was accepted. One second beyond it reached quarantine with `MALFORMED_MESSAGE` and no receipt. |
| Click receipt and calendar boundaries | The original receipt remained at its exact 3,024,000-second deadline and expired one microsecond later. The later receipt and each counted total survived. With no event arriving, the timer used `2025-11-30` at the clipped month end and then `2025-12-01` at the UTC year boundary. It removed the earlier totals and breakdowns and preserved their exact-cutoff rows. |

The regression for dropped acknowledgements is the earlier native RabbitMQ case, which held an
actual acknowledgement and killed its sender. This combined fixture exercised deliberate Pub/Sub
republish. The earlier individual units also cover Auth0 outage, uncertain refresh and logout,
Stripe body limits and store recovery, and independent retention-setting changes.
[Auth0 cases](../auth0/README.md) · [Stripe cases](../stripe/README.md) · [Retention cases](../retention/README.md)

The selected native Keycloak session and generic webhook cases passed on the initial generator
pin. They exercised independent processes, Keycloak shared-session rotation and generic HMAC
delivery, a seven-day completion window and additive Stripe migration. The initial Activity
B01 retest stopped in the application extension checker before Docker because its pre-existing
product hooks imported private files. The fallback uses the identical Activity design, moves
the publisher and counter hook type imports to their public API v8 exports and observes
receipt and total rows directly in PostgreSQL. The unused read route stays an untouched stub.
Its first assertion expected the aggregate key in `scope_key`, where the actual emitted counter
records `event-counter-v2`. The corrected witness passed from 22:28:44 to 22:29:40 UTC. It confirmed
two broker publications with 202, no pending deliveries, and one aggregate count and one receipt
with a 604,800-second retention period.
The reviewed old-source CLI export verified Keycloak, Jeeves signature format, no Stripe SDK
and unconfigured consumer/calendar behavior. The unchanged Event counter export compiled
604,800 seconds each for its replay limit and retained completion. Prior unit coverage of
legacy seconds declarations and unconfigured scheduling is in the 1,446-test repository check.
[Initial regression commands](initial-legacy-gates.log) · [Keycloak session assertions](legacy-keycloak-session-assertions.json.gz) ·
[Generic webhook observations](legacy-webhook-observations.json.gz) · [Initial Activity preflight](legacy-counter-first-build.log) ·
[First counter witness](legacy-counter-first-result.json.gz) · [Passing counter witness](legacy-counter-observations.json.gz) ·
[Repaired old-source CLI exports](legacy-default-exports.log)

## Repository checks and earlier attempts

All reviewer gates used Node 24.21.0 and pnpm 12.16.1. The repaired generator passed
`pnpm check` with 1,446 tests in 155 files and `pnpm --filter @jeeves/web build` with the
existing lint and chunk-size diagnostics. The serial full `pnpm test:e2e` passed all 91 Chromium
tests from 22:29:40 to 22:36:18 UTC after native stack cleanup. TinyURL rendered on the lane canvas,
and both YouTube mouse builds passed. The review started at 21:52:55 UTC. The first pass
downloaded r10 at 21:55:34 and passed the CLI, repository and web build checks. The initial
native combined run started at 22:02:53 and hit the installed SDK error. The app stack was
cleared, and the separate cleanup helper removed its private fixture files after its temporary
directory prefix was corrected. The reviewer resumed on the repair pin at 22:22:01 UTC.
[Check log](pnpm-check.log.gz) · [Web build](web-build.log.gz) · [Chromium](e2e.log.gz) ·
[Initial cleanup](initial-combined-cleanup.json.gz) · [Repair evidence](../pubsub-repair/README.md)

The first repaired comparison after the build was pointed at the installed CLI directory and
detected its dependency and compiler output files. The repeat used a fresh CLI export from the
exact same canonical bytes and passed all path, archive and content assertions.
[Earlier mouse attempt](studio-stale-registry.log) ·
[Accepted mouse session](studio-mouse.log) · [Offline CLI build and no-op update](cli-install-build-update.log)

## Named provider evidence still due

| Unit | Review disposition | Provider or product evidence |
| --- | --- | --- |
| 1. Auth0 | **Awaiting named evidence** | Local TLS protocol and independent caller verification pass. Finish the designated tenant and rotating-refresh check below. |
| 2. Stripe | **Awaiting named evidence** | Local Stripe SDK signatures, exact ingress and completion behavior pass. Finish designated test-mode delivery and resend below. |
| 3. Retention | **Passed** | Studio selections, prior RabbitMQ lost-ACK and independent-setting cases, and the combined Pub/Sub replay and UTC cleanup pass. The production topic/archive restore is a deployment check. |

- **Auth0 tenant.** Access needed is a designated Auth0 test tenant, two test users, the
  confidential web application and the eligible machine applications. Register the exact HTTPS
  issuer, callback and logout return, a separate user API and per-recipient workload audiences.
  Enable S256, RS256, offline access and refresh rotation. Drive Universal Login and the callback
  through Browser → Account → Billing and exercise guest Link, Bob's isolation and independent
  wrong-audience and undeclared-caller denial. Share a session over two Browser copies at token
  expiry and observe one rotating refresh and one PostgreSQL generation advance. Restart a copy,
  perform CSRF-checked logout and OIDC redirect/return, and confirm that both copies refuse the
  retired session. Preserve redacted statuses, fixture request counts and exact environment
  binding names. [Configuration and detailed acceptance](../auth0/README.md#real-auth0-tenant-pending)
- **Stripe test mode.** Access needed is a designated test-mode account that can create and
  resend a snapshot event and an approved reachable HTTPS test front door. Register the signed
  snapshot POST at `/api/payment-inbox/modules/verified-payment-event` and mount the destination
  secret through `JEEVES_SECRET_JEEVES_WEBHOOK_VERIFIED_PAYMENT_EVENT_STRIPE_SECRET_FILE`.
  Deliver a synthetic `customer.subscription.updated`, restart a receiver copy and resend the
  same event through the provider's delivery history. Match Stripe's successful statuses and
  signed ID to a committed inbox row and one subscription effect. Preserve redacted delivery
  statuses, SQL counts and binding names. [Detailed acceptance](../stripe/README.md#designated-stripe-test-mode-pending)

The coordinator supplied no designated tenant credentials, test-mode destination or approved
HTTPS endpoint in this session. The field build receives the reviewed local source and deployment
contract with these two external results pending. [Usage ledger](../usage-ledger.md)
