# Source and example coverage baseline

All nine shipped `architectureExamples` entries and five additional references are accounted for
below. Registry order and emitted content hashes/counts are in `shipped-example-baselines.json`.
Exact repository raw bytes, factory helpers, briefs, feedback and every frozen benchmark file are
pinned in `source-hashes.json`; no old factory/ledger is reconstructed or edited in UX01.
These are design/source inventories, not application acceptance or new Library registrations.

| Coverage row / later unit | Current identity and authority | Baseline / required preserved boundary |
| --- | --- | --- |
| E01 / UX14a | `mattermost-reference`; `packages/spec/src/mattermost-example.ts`; `docs/examples/mattermost.md` | Shipped public-source reference. Browser, messaging/API, background, SQL/file store and external paths. AWS/Kubernetes declarations preserved; no runtime recipe and no feature-per-service rewrite. |
| E02 / UX14a | `enterprise-web`; `packages/spec/src/enterprise-web-example.ts`; `docs/reference/enterprise-architecture.md` | Shipped example. Browser/app, ownership/shared data, identity and actual worker boundaries; tenant/access rules stay exact source/C4b. |
| E03 / UX14a | `video-platform`; `packages/spec/src/video-platform-example.ts`; `docs/examples/streamly.md` | Shipped Streamly study. Playback/platform, processing, storage/cache/CDN/search/channel. Business/media guarantees are not technical switches. |
| E04 / UX14b | `qrwty-target`; `packages/spec/src/architecture-proofs.ts` and proof helpers; `docs/examples/qrwty-target.md` | Shipped planned target, separate from live QRWTY. Browser, Redirect, Billing, data/cache, analytics. Source currently decomposes billing internals; new C2 will be one Billing without deleting contracts. |
| E05 / UX14b | `link-platform`; `packages/spec/src/architecture-examples.ts` | Shipped smaller Links & QR study. Description/factory is authority, not a missing GOAL.md. Preserve fast redirect/cache fallback/async analytics without importing all QRWTY requirements. |
| E06 / UX14b | `community`; `packages/spec/src/architecture-examples.ts` | Shipped Community & discussion. Browser/API, content, search/notifications/background. Moderation/permission behavior remains custom source intent. |
| E07 / UX14b | `social`; `packages/spec/src/architecture-examples.ts` | Shipped Social & content. Browser/API, media/processing/feed/search/cache. Ranking/graph/content rules remain C4b. |
| E08 / UX14c | `discourse-core`; `packages/spec/src/discourse-core-example.ts` and helpers; `docs/examples/discourse-core.md`; `benchmarks/discourse-core/v1/*` | Shipped rich backend design, not an implemented application. Preserve every D obligation and expected observation. The compact rich legacy fixture materializes this unchanged source. |
| E09 / UX14c | `vendure-core`; `packages/spec/src/vendure-core-complete.ts` and helpers; `docs/examples/vendure-core.md`; `benchmarks/vendure-core/v1/*` | Shipped complete *design*. Preserve commerce/money/stock/order/provider-recovery obligations. No runtime score improvement from a tidier graph. |
| E10 / UX14c | Zammad additional reference; `docs/build-plan-backend-benchmarks.md`; `docs/reference/backend-benchmarks.md`; `benchmarks/zammad-core/v1/*`; `packages/spec/src/zammad-core-{contracts,data,access}.ts` | **Not shipped/registered as a complete example. P73a checkpoint incomplete, P73b paused.** Only draft helper modules and bounded policy-schema/editor work exist. Small future `studio-…` foundation must retain that distinction. |
| E11 / UX14d | Original QRWTY goal; `docs/examples/qrwty.md`; existing recipe/template sources; documented sibling `../qrwty/README.md` | Additional reference, separate from shipped target. Keep supported legacy generation compatibility and working project read-only. No live adoption/repair. Sibling source is a later source-reconstruction read, not copied or changed here. |
| E12 / UX14d | Dropshipping; `docs/examples/storefront.md`; final decisions’ qualified `../dropshipping/.docs/{GOAL,BUILD_PLAN}.md`/handoff references | Additional documented single Worker/browser-admin/D1/R2/hosted payments foundation. Guest checkout, no customer accounts. Workflows is not a queue; fulfillment/vendor/compliance remains C4b. Sibling files untouched; UX14d must pin actual external-goal bytes when reconstructing. |
| E13 / UX14d | Inventory labeling; `docs/examples/inventory-labeling.md`; `docs/examples/inventory-architecture.md` | Additional bounded reference. Application/data and external device/printer boundaries. Hardware/fields/actions/offline unknowns remain unknown, no invented driver/runtime coverage. |
| E14 / UX14d | Grocery review; `docs/examples/grocery-review.md` | Additional partial concept. Client/capture, API/media/data and external recognition. Device/vendor access/accuracy not decided; no full-product claim. |

P73a's 2026-11-03 checkpoint handoff explicitly states: no complete Zammad factory/registration,
no complete design trace/browser/combined acceptance, no runtime generation and backend batch
paused. The three benchmark applications remain absent/not run with zero observed implementation
points; UX01 starts no implementation, provider task, generation or benchmark suite.

The fresh example goal manifests and requirement-by-requirement C4b maps are UX14 work, not
baseline evidence. Source paths in this inventory are documentation references, never runtime file
read instructions. The exact source-feedback manifest still has 21 matching original/copy pairs.
