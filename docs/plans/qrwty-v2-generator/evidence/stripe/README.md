# Stripe webhook generator evidence

Unit 2 started from Jeeves `ae0b8ff70d221ca3becc3e470012197e05f2d4de` at 20:39 UTC on 2026-11-19. This work belongs to template development. The exact prompt hash is in the [usage ledger](../usage-ledger.md). Model variant, token counters and cost were unavailable.

## Generated receiver

The Webhook receiver's **Signature format** offers Jeeves and Stripe. An absent field reads as Jeeves in Studio, chat and generation. The raw **Body limit** includes 256 KiB and **Signature window** keeps the existing 30–300 seconds. Stripe uses the pinned 23.1.0 Node SDK and a private file bound to a stable receiver module ID. The SDK sees the authenticated payload bytes as received. A separate clock check enforces the configured past and future bounds. Validation checks UTF-8 and rejects a leading BOM before the SDK's UTF-8 conversion so verification preserves the original bytes.

The pure application mapper receives authenticated snapshot data and keeps its shape and output within the checked extension boundary. A Stripe mapper must preserve the signed event ID and type. Protected work stores the original content's SHA-256 with the mapped event. One database commit precedes the acceptance response. Repeat acceptance, duplicate conflict and processing reuse the existing fenced durable work path. A storage failure returns 503 with a retry hint for the same verified event. Completed Stripe IDs expire after 35 days. Failed records remain for repair. Earlier migration 052 remains unchanged and Stripe state gets an additive 056 constraint migration. Ordinary durable work stays within its previous retention bounds.

The public edge delivers the exact POST without customer sign-in. A Required-user Auth guard still refuses composition in the same Service. Existing Jeeves receivers use their private ring and seven-day completed retention. The installed Stripe verifier does not require a Stripe API key. An existing deployment that switches formats must drain outstanding work and reconcile retained identities. Its application-owned package manifests must incorporate the generated SDK pin.

## Reproduction

Use Node 24.21.0 and pnpm 12.16.1 from the Jeeves checkout. The native suite exports its fixtures with the public CLI, checks actual emitted API v8 source, starts isolated Compose services with PostgreSQL and uses test-owned signing credentials.

```sh
pnpm test:generated --suite=qr-stripe --artifacts=/absolute/empty/stripe
pnpm check
pnpm test:e2e
pnpm --filter @jeeves/web build
```

The [fixture](../../../../../field-projects/generator-system/fixtures/qr-stripe/design.ts) models a stamped public Payment inbox with PostgreSQL Billing state. Its product hook records subscription events and updates one customer's current state by event time. The hook and registered SQL are owned fixture code. A separate export with the format field absent checks legacy delivery. The small Events API study exercises the controls in Studio and chat.

## Reviewed input and export

The unit's scratch CLI input changed only the reviewed revision-4 receiver's format to Stripe and body limit to 262144. The original project and the separate coordinator working copy stayed outside the fixture work. The CLI produced 154 files with zero findings and 24 required application or integration gaps. `pnpm install --offline --frozen-lockfile` and `pnpm build` passed in the export. `update:v2 --check` showed 153 unchanged files and no changes to apply.

| Raw artifact | SHA-256 |
| --- | --- |
| Scratch source JSON | `0f622ca78cf24518648aaa6b136d05c81e6ee94abbcbdf50b813d1e118c81edb` |
| [Manifest](stripe-only-manifest.json.gz) | `2262de1eabfb9a7c011ce195129bfad925d063f403efb05aa820819f2cb0ab73` |
| [Deployment contract](stripe-only-deploy-contract.json.gz) | `c188f4a12a677539c3d2fe8644f5ab09f800b7a9ff072c136c66dd9d14372e3e` |

## Observed behavior

- In the native Stripe export, the public edge returned 404 on GET and on a different POST path. Missing, invalid, altered, old and too-far-future signatures returned 400 and left no inbox row. A BOM-prefixed copy with the original signature was refused, as was an application mapper that attempted to replace the signed event ID.
- The test relay discarded the first 202 while the inbox contained an independently observed `accepted` record with the expected raw-body SHA-256. The retry crossed a receiver restart. Both receiver copies returned 202 for the same ID, and the checked work committed one effect. A fresh signature over different bytes with that ID returned 409 `WORK_IDENTITY_CONFLICT`. A signed older subscription event completed while the fixture's newer active state stayed in force.
- A signed 262144-byte event with a large JSON field returned 202 and completed with one effect. An event one byte larger returned 413. Stopping the fixture's PostgreSQL produced 503 with `Retry-After: 1` and no accepted row. Starting PostgreSQL and redelivering recovered one effect.
- The completed row's stored policy and database-time delta were both 3024000 seconds. Aging a completion to the 35-day boundary let the idle sweep remove it. The row within the boundary and the failed row survived. The failed hook reached four attempts, retained its row and committed zero effects. [Stripe observations](native-stripe-observations.json.gz) · [Cleanup](native-stripe-cleanup.json.gz)
- The older source exported without the Stripe runtime or SDK. It refused a Stripe signature, accepted and deduplicated its Jeeves-signed body, and retained the seven-day policy. The generated migrator then applied 056 to that database with 052 already recorded. Reapplying was a no-op, the 052 checksum and retained completed row matched, and the database refused a 35-day ordinary work row even when its ID was `webhook-v1`. The offline runtime check also refused expanded retention through the public durable-work API. [Legacy observations](native-legacy-observations.json.gz) · [Cleanup](native-legacy-cleanup.json.gz)
- `pnpm check` passed lint, types and all 1,444 tests in 155 files. The web build passed with its existing chunk-size advisory. The full browser run passed 91/91 in 5.7 minutes after native cleanup. The browser opened TinyURL, set Stripe and the limits by mouse in the small Events API study, checked the blueprint and the Required-user host refusal, and downloaded the ZIP. A focused mouse rerun passed 1/1 after the final database-only namespace refinement. [Stripe settings in Studio](mouse-stripe.png)

## Earlier attempts

The first offline Stripe CLI export exposed separate pnpm configuration and application lock documents. The generator now adds the SDK to the application document. The first two native setups stopped in the extension checker. The fixture's SQL now uses the compiled owner schema and separate registered statements inside one work transaction. The next native attempt found that migration 052 still capped protected rows at seven days. The repair uses append-only migration 056. In the following run, the Stripe endpoint correctly returned 409 and the test read the wrong error field. The retest used the established `error` response field. The ordinary exported HTTP template hash changed to support the wider request limit and the matching front-door pin was refreshed. [Initial and intermediate native outcomes](earlier-attempts.json.gz)

## Designated Stripe test mode pending

Access needed is a designated Stripe test account with permission to create a snapshot webhook destination and resend its synthetic event, plus an approved reachable HTTPS test front door. Register POST `/api/payment-inbox/modules/verified-payment-event` for the reviewed QRWTY public edge, or use the exact Stripe path listed by the deployed export. Subscribe to a synthetic subscription event such as `customer.subscription.updated`. Mount the signing secret for that destination using `JEEVES_SECRET_JEEVES_WEBHOOK_VERIFIED_PAYMENT_EVENT_STRIPE_SECRET_FILE`. Keep credentials in private deployment bindings.

Send the selected test event and resend the same delivery from its test history. Deliver through the stamped edge with no customer session. Match the authenticated event ID to its committed inbox row and one fixture subscription effect, with successful 2xx deliveries recorded by Stripe. Restart a receiver copy before the resend and inspect both copies' shared state. Save redacted ID, delivery statuses, configuration names and SQL counts. Local signatures provide fixture evidence. The actual Stripe delivery and resend still need that access. [Stripe event destinations and verification](https://docs.stripe.com/webhooks?lang=node) · [Stripe retries](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors)
