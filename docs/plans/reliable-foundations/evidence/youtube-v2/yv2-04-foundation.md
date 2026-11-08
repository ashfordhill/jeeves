# YV2-04 standalone local foundation evidence

2026-11-08. Generator/template work only; no field app, v2 input snapshot or custom product
completion. [Interfaces](../../youtube-v2/interfaces.md#yv2-04--standalone-local-foundation).
The assembly report remains semantic/application incomplete with runtime verification `none`.
These isolated provider observations do not certify an application or any selected feature.

## Standalone output and reproducibility

Final two exact exports: `/tmp/jeeves-yv2-04/final-export` and `final-export-copy`, 27 files each,
byte-identical path/hash lists. Both come from actual `loadLocalV2Registry`/`assembleV2` using a
read-only test source with all ten selections; nothing was copied into `field-projects/youtube/v2`.
Frozen standalone install reused all 109 packages, downloaded zero, with Node 24.21.0 /
pnpm 12.16.1. `pnpm build` passed, and all nine emitted `.mjs` scripts passed Node syntax checks.
The project envelope reuses captured exact v1 package/lock/provider pins, never runtime v1 reads.
Source TypeScript lives in `.ts.template` assets, outside generator dependency resolution.

Final registry SHA: `f607967ede014bc2d3da9f5b58fe7e610d97629fb90350556a1a634e47bcf795`.
Final manifest SHA: `848a86f08ca261a91cf499992605e52facec383830282d3dff1bbacb3b2c6675`.
These are executable/assets/output identities, distinct from the semantic runtime descriptor SHA.

The existing v1 assembler still emits 108 paths and its unchanged manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
The complete regenerated v1 path/hash list is `/tmp/jeeves-yv2-04/v1-path-hashes.json`.
No local-v1 assets, v1 app/inputs/runtime, root README or owner resources changed.

## Owned scratch runs

Project/ports/export were recorded before first start and checked free together. Every host
publication uses `127.0.0.1`. No owner/v1 reserved ports were used.

| Exact Compose project | Injected HTTP / identity / object ports | Export | Observed providers |
| --- | --- | --- | --- |
| `jeeves-yv2-04-smoke-20261108` | 45370 / 45371 / 45372 | `/tmp/jeeves-yv2-04/export` | PostgreSQL, Valkey |
| `jeeves-yv2-04-providers-20261108` | 45380 / 45381 / 45382 | `/tmp/jeeves-yv2-04/all-providers` | PostgreSQL, Valkey, RabbitMQ, Garage, Keycloak, OpenSearch |
| `jeeves-yv2-04-identity-20261108` | 45390 / 45391 / 45392 | `/tmp/jeeves-yv2-04/identity-access` | PostgreSQL, RabbitMQ, Garage, Keycloak; final separate vendor runtime login |

The small composition selects only the positive-cache reader. Its Compose contains exactly
`local-postgres`, `cache-metadata-cache`, `setup-migrate`; other providers and application workers
are absent. The full composition starts six actual pinned providers, all observed healthy. It
applies only foundation migrations for metadata/count/identity databases, configures Garage's
single-node layout and canonical selected buckets, and asserts selected durable broker resources.
It has no domain tables/handlers, demo users or product realm/bucket identities. Runtime features,
application hooks, topic subscribers and search mappings remain explicit unfinished responsibilities.

The two original exports passed `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build`, Docker app
build and `pnpm first-run`. Then `pnpm stop` followed by `pnpm start` passed. Full recorded state,
credential hash sets, exact project/port values and Docker volume identities were unchanged across
restart; storage bootstrap was not replayed. No secret values or signed URLs appear in this record.

Each run appended a harmless comment to an already applied `000-foundation.sql`. The next normal
start failed with:

> Applied migration infra/postgres/metadata-db/000-foundation.sql differs; add a new migration.
> No reset performed.

The existing migration record refused before executing changed SQL. No credentials or volumes
were reset. Private intermediate state and credentials stayed outside the checkout.

The final Identity-specific export refines the inherited v1 credential pattern: its setup-only
`io_identity` database/migration owner has a distinct password from the `ik_identity` vendor
runtime login. Keycloak gets schema CREATE only in its isolated database; ordinary app logins
never get CREATE. A SQL probe and normal restart check the actual role/ownership boundary; the
vendor cannot SELECT the foundation migration table.

Typed cross-module SQL login/view/grant composition and setup-only owner mounts have focused
offline coverage; the grant/view probe creates no production feature. Actual feature migrations,
relation authorization scenarios, storage key/CORS callbacks, contributed strict search mappings,
HTTP identity admission, work handlers and nginx app routing remain for their assigned later
units. Provider health alone proves none of those behaviors. The current direct HTTP slot permits
one service; **YV2-16** must compose three internal APIs with the pinned nginx/static/public-media
edge, without extra public API ports or editor controls.

## Scoped cleanup and regression checks

A final no-start preflight probe used `jeeves-yv2-04-ambiguous-20261108` with the recorded free
trio 45400/45401/45402 and one deliberately created owned **unlabeled** volume at its exact
`<project>_postgres-data` name. First-run refused before creating `.runtime`, credentials or
provider containers; the existing volume was retained until scoped exact-name removal. The
same guard checks the exact default-network namespace. No provider startup was repeated for
this preflight-only change. Source was frozen after this bounded probe.

All three projects ran `pnpm stop`, then exact-project `docker compose --profile '*' down --volumes
--remove-orphans`. Removed only their three networks, ten volumes, service/one-off containers and
three owned `-app` image tags; no global prune or owner project command ran. All three project-label
container/volume queries returned empty afterward. All three private `.runtime` directories were
removed after shutdown. Source exports, installed packages and sanitized logs remain under the
owned `/tmp/jeeves-yv2-04/` scratch directory. All fourteen v1 services remain healthy.

Focused offline generator coverage: deterministic output and unchanged v1; selected provider
omission; explicit cross-module contributors; setup-only owners; quoted/schema-qualified views
and grants; published-view boundary refusal; composed SQL-name limit refusal and changed canonical
binding output. Root `pnpm check`: **419 tests / 56 files, 38.61s**, plus lint/type checks.
Native **36 E2Es passed in 1.8m**; web build passed in **1.12s** (existing chunk-size advisory).
Existing browser E2Es retain TinyURL canvas loading and mouse actions; this unit changes no
normal studio UI. The final full check includes the namespace guard; unchanged native/browser
coverage completed immediately before that CLI-only guard.

Logs: `/tmp/jeeves-yv2-04/{check-final,e2e-final,web-build,install,build,first-run,restart,hash-refusal,cleanup,
all-install,all-build,all-first-run,all-restart,all-hash-refusal,all-cleanup,
identity-install,identity-build,identity-first-run,identity-restart,identity-cleanup,
final-install,final-build,namespace-refusal}.log`.
Sanitized resource/state comparison summaries are `resources.json`, `all-resources.json`, `identity-resources.json`,
`restart-summary.json`, `all-restart-summary.json`, `identity-restart-summary.json`,
`identity-access-summary.json`, `namespace-resources.json`, `namespace-summary.json`,
`cleanup-summary.json`, `final-summary.json` in that same directory.
