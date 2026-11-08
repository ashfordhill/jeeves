# YouTube local v1 — custom state foundation

This independent application started as the untouched generated baseline at commit
`02ac280da62616e9c7aad7f88457dcb72084cb25`. FP06a adds custom ownership, SQL, contracts and
transport integration. `.jeeves/` remains the immutable historical partial report/input, not a
certificate for this edited application. Current intent is recorded in
`config/implementation-source.json` and `config/ownership.json`.

**No S01–S08 scenario is complete yet.** Browser/upload/media/search/count business extensions
remain unfinished. Application services are behind the `application` Compose profile, and their
unfinished shells refuse startup before listening/consuming. Start only the implemented subset
specified by subsequent units. Do not regenerate over this directory.

Requirements: Linux amd64 Docker Compose, Node24.21.0 and pnpm12.16.1. All existing exact package,
image and FFmpeg pins remain. The application has its own install/compiler and no Jeeves runtime
or workspace dependency:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check:foundation
```

For a **new disposable foundation** with no preexisting runtime or volumes, choose a unique
Compose name and keep it with its runtime directory:

```sh
export COMPOSE_PROJECT_NAME=jeeves-youtube-v1
node scripts/setup.mjs
docker compose build migrate
docker compose up -d --wait postgres broker
docker compose run --rm migrate
docker compose run --rm broker-init
```

This prepares SQL and broker only. It does not bootstrap Garage, start Identity or expose a
working UI. Full first-run/resumable setup orchestration belongs to FP06b. Never associate new
secrets with old volumes. Setup refuses an existing `.runtime`; bootstrap remains single-use.
Preserve ambiguous partial state and inspect it rather than rotating secrets or deleting data.
For an existing generated runtime, deliberately add the three missing scoped login files, then
run migrations (existing values are preserved; mismatched existing-role passwords refuse):

```sh
node scripts/setup.mjs --add-runtime-roles
docker compose build migrate
docker compose up -d --wait postgres broker
docker compose run --rm migrate
docker compose run --rm broker-init
```

Normal SQL/broker stop/start preserves runtime secrets and named volumes:

```sh
docker compose stop postgres broker
docker compose up -d --wait postgres broker
docker compose run --rm migrate
docker compose run --rm broker-init
```

Do not rerun single-use setup/bootstrap on normal restart. `docker compose down` retains data;
`down -v` is only for disposable resources you own. Provider/browser ports for the later full
app stay loopback4400–4402; never stop another project to claim them.

Versioned, checksummed migrations run transactionally under a per-database advisory lock.
The repeatable runner revokes legacy blanket/default reader SELECT before private tables are
created, also on existing installations. Owners are migration/init-only. Runtime credentials:

| Process | SQL boundary |
| --- | --- |
| Upload | `metadata_upload`: videos/uploads/outbox SELECT/INSERT/UPDATE; no inbox/delete/DDL |
| Video lifecycle | `metadata_lifecycle`: same Video DML plus inbox SELECT/INSERT |
| Watch | `metadata_reader`: `video_public.ready_videos` only; `counts_reader`: `count_public.video_totals` only |
| Count worker | `counts_writer`: private receipt/totals SELECT/INSERT/UPDATE |
| Transcoder, Search, indexer | No SQL mounts or metadata grants |

`metadata_owner`/`counts_owner` never appear in application service mounts. Private upload/inbox/outbox rows,
creator subjects and original fingerprints are excluded from Watch's ready-only view. Trusted
Video roles share authority; these grants are not per-state row security. Originals are private
and job-scoped in application policy; Garage keys are bucket-scoped, not per-object creator ACLs.

`processing-events` feeds lifecycle only; committed `publication-events` feeds indexer only.
Broker setup explicitly removes old completion/indexer bindings. Both outbox destinations use
stable IDs and confirms before marking sent; crashes may duplicate. Read
[the concrete state/client handoff](../notes/fp06a-foundation.md) before implementing routes.

HTTP routes must be configured before explicit `start()`. Auth/JWKS and dependency operations
must run inside the awaited route handler, not async `preHandler` hooks, to share its deadline
and admission slot. Return/await all work. Response timeout does not cancel SQL/S3 work or release
its slot prematurely; callers reconcile late writes through stable status/retry semantics.
Consumers expose `closed` including fatal loss; services must stop relays/sweep timers, drain
work and close pools when it resolves, then exit. Merely setting `process.exitCode` is insufficient.

The remaining local limits from the plan still apply: no TLS/mTLS, HA, replicas, global CDN,
fraud-resistant counts, arbitrary codecs, production capacity or cloud parity claim. OpenSearch
security is disabled only on the isolated local network. Shared broker credentials do not provide
per-service AMQP ACLs. FFmpeg/CPU and browser codec availability alone prove no playback.
