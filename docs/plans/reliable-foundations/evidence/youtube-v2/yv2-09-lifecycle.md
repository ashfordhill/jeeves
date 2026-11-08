# YV2-09 fixed asset lifecycle evidence

The generic dependency emits the fixed asset repository, upload hooks, schema and lifecycle
worker factory. [Actual APIs and boundaries](../../youtube-v2/interfaces.md#yv2-09--fixed-asset-lifecycle-and-committed-publication-hooks).
It uses YV2-06 transactions/outbox/receipts and YV2-07's locked, detached upload hooks without
changing upload/transport core. Pending/job intent and ready/publication intent/receipt are
committed together. There is no new product workflow, title/channel policy, search/count
requirement or installed source-bound application. Publication remains optional.

## Focused offline invariants

Five cases execute the **actual emitted modules** with PGlite, without Docker/network:

- Upload completion commits pending and exactly one job intent; a job-constructor error or
  invalid completion response rolls both back. Stored completion replay remains stable after
  ready and creates no further intent. Successful matching completion is accepted from pending.
- A failing transaction-bound publication constructor rolls back ready, intent and receipt,
  even when the caller catches the error. A valid success commits one ready source record and
  one logical publication intent. Repeated delivery with regenerated occurredAt returns the
  receipt; a changed effect-relevant result conflicts instead of silently deduplicating.
- Stale and unknown jobs, failed terminal results, and success after the fixed queue/processing
  deadline never publish. A processing/deadline failure callback also poisons rollback when
  caught. Uppercase domain UUIDs normalize before stable identities; generic text remains
  case-sensitive. The non-video PDF/report result has a job-bound key and 1–1000 page limit;
  an out-of-bounds result is refused before receipt/effect.
- Queue deadline remains 10 minutes and first start establishes a 30-minute processing deadline
  using DB time. Repeated start does not extend it. Apply rejects late success without waiting
  for a sweep. Abort, expiry, initiation failure and fingerprint failure synchronize lifecycle
  through the existing upload terminal hook; a caught terminal hook failure rolls both back.
  A 51-job overdue fixture sweeps 50, then 1, then 0, with no publication.
- The worker runs a startup sweep before consuming, handles a deliberately different document
  wire envelope, uses existing NonRetryable behavior for malformed messages, and closes
  idempotently. The assembler emits generic dependencies and exact same-authority table grants,
  with no media SQL login, implicit public view or installed feature claim.

The document wire uses message/at/attachment/job/attempt/signal/payload/reason; the generic core
uses eventId/occurredAt/assetId/jobId/attemptId/kind/result/code. The original wire object is
retained through worker validation and receipt parsing, so a narrow product mapping need not
accept its own normalized output. Receipt identity omits only transport time, retaining every
validated field used by the effect. No second durability implementation or network/SQL atomicity
claim is introduced. Existing outbox relay remains at least once.

`assetReadySelect` defines a committed-ready **source** contract with metadata/result/version/
readyAt and identity. It is private until an application contributes a public projection and
reader grant. The publication constructor sees ready in its caller transaction, but no state or
publication intent is durable if that transaction rolls back. The callback's name does not imply
publication-before-commit or automatic public exposure of application metadata.

## Fresh standalone output

Two final deterministic **47-file** exports were written to
`/tmp/jeeves-yv2-09/final-export` and `final-export-copy`; exact path/hash lists match.
The final output passes its **own frozen install and untouched generated build**. A separate
typed PDF/document adapter then compiles against the emitted lifecycle, upload hooks and actual
AMQP worker/publisher interfaces, both with and without publication. No YouTube contracts,
search/count module or media-worker SQL credential is needed. It is bounded module reuse proof,
not a full second application or the final YV2-20 composition.

The disposable compiled persistence contributor uses attachments_private assets/transfers/
receipts/intents, exact upload/lifecycle logins and explicit grants through YV2-04. Multipart's
existing selected object/CORS contribution is reused once. It registers no application template
or fake service: report remains applicationComplete:false with required application bindings.
YV2-15/16 must bind real metadata/result/event codecs, principal/HTTP adapters, public fields,
service construction, consumers, relays and scheduled/drained cleanup. YV2-10 owns only the next
fixed media engine unit; no later unit was implemented here.

Frozen v1 still emits **108 identical paths/hashes**, manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
No local-v1 assets, v1 app/input/runtime/fixture, provider/dependency pin/lock or root README
changed, and no field v2 app was created.

## Resources and regression checks

This unit creates no provider stack, runtime secret, media fixture, external port, volume or
container. Scratch source/build/dependencies stay under `/tmp/jeeves-yv2-09`, outside the commit.
All fourteen retained `jeeves-youtube-v1` services are healthy; no owner resources or ports
were changed. Owner `.jeeves-feedback` dirt and the e2e-docker mode change remain untouched.
No global cleanup, branch, worktree, stash or push was used.

Logs under `/tmp/jeeves-yv2-09/`: `focused-final.log`, `check-final.log`, `e2e.log`,
`web-build.log`, `export-final.log`, `install-final.log`, `build-final.log`,
`build-adapter-final.log`, `export-summary.json`, `owner-services.log`.

Final `pnpm check` passed lint/types and **438 tests / 61 files (32.71s)**; only the existing
Biome style info remains. Native `pnpm test:e2e` passed **36 tests (1.6m)**, including TinyURL
lane rendering and mouse/history/generation behavior. `pnpm --filter @jeeves/web build` passed
**1.30s** with the existing chunk-size advisory. No normal studio UI changed. Root checks ran
separately from E2E; no assertion, fixture, timeout or pin was weakened. Final focused cases and
standalone/typed builds also pass. An initial terminal-expiry test fixture was still initiating,
so beginComplete correctly refused it; activating that fixture before DB expiry exercises the
intended expired-completion path without changing runtime policy.
