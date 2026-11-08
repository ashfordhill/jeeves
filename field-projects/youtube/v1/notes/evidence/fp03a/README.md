# FP03a: actual local templates and independent build

Unit base **e68627afa718e9c6e9aad63d44f6fcb73e338e5d** (FP02); primary main, sole writer,
no subdelegation/branch/worktree/stash/push. Frozen v1 inputs, snapshots and history are unchanged.
This is generator/template investment, not custom application implementation or field completion.

Generator **0.1.0-experimental.2** + 19 actual local template families **0.1.0-experimental.1**.
Each template source hash fingerprints the actual registry source and exact sorted embedded assets,
including locks. `localV1Templates` is explicit; empty-default diagnostics still work. One shared
project owns Compose/build/setup; selected families own shells, clients, resources and seven
failing generated extensions. No source labels/prose select application algorithms.

## Actual output and deterministic source

Two new exports, `/tmp/jeeves-fp03a/final3` and `/tmp/jeeves-fp03a/repeated3`, compared byte for
byte before installing dependencies/runtime setup. **108 files**, 851,637 hashed payload bytes
plus the manifest. [Summary](output-summary.json) records identities, all 19 template hashes,
strict readiness, seven generated extensions and setting counts: **20 emitted, 169 configuration-only,
28 custom, 25 frozen unsupported, zero untreated**. `emitted` client options have concrete code;
configuration values receive no enforcement or runtime credit. Original spec/strict readiness
remains ineligible/none/none. G01–G08 remain custom; S01–S08 remain unrun.

[Exact compressed output manifest](output-manifest.json.gz) is a provenance record, not the FP04
application baseline. Its external SHA256 is
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`;
report SHA256 is `ca25dbb8bda1a74d165fb273b066ec9d06e6c53b18d34aab9bdb50a0b5155a01`.
The source-linked real diagram PNG is included at its frozen hash. Every payload file still
matched its manifest after install/build/setup/probes. No field `app/` was created or committed.

## Independent build and bounded local runtime

Actual generated `package.json`, `pnpm-lock.yaml`, TypeScript sources and Dockerfile ran outside
the checkout, without workspace imports, absolute checkout paths or Jeeves services:

```
pnpm --filter @jeeves/generator export:new /tmp/jeeves-fp03a/final3
cd /tmp/jeeves-fp03a/final3
pnpm install --frozen-lockfile
pnpm build
node scripts/setup.mjs
COMPOSE_PROJECT_NAME=jeeves-fp03a docker compose config --quiet
COMPOSE_PROJECT_NAME=jeeves-fp03a docker compose build --progress=plain
COMPOSE_PROJECT_NAME=jeeves-fp03a docker compose up -d --wait --wait-timeout 180 postgres cache broker objects search-index identity
COMPOSE_PROJECT_NAME=jeeves-fp03a node scripts/bootstrap.mjs
COMPOSE_PROJECT_NAME=jeeves-fp03a docker compose run --rm broker-init
COMPOSE_PROJECT_NAME=jeeves-fp03a docker compose run --rm search-init
COMPOSE_PROJECT_NAME=jeeves-fp03a docker compose up -d --wait --wait-timeout 60 watch search upload transcoder view-counter completion-handler search-indexer edge
```

[Install](final3-install.log.gz), [TypeScript build](final3-build.log.gz),
[Docker build](final3-compose-build.log.gz), [infrastructure](final3-infrastructure.log.gz),
[storage](final3-bootstrap.log.gz), [broker](final3-broker-init.log.gz),
[empty index](final3-search-init.log.gz), [shells](final3-shells.log.gz).
[Actual versions and 14 healthy containers](runtime-result.json) match Node 24.21.0,
PostgreSQL 17.11, Valkey 8.1.10, RabbitMQ 4.4.0, OpenSearch 3.9.0, Keycloak 26.8.1,
Garage 2.4.1, nginx 1.28.3 and FFmpeg 5.1.9. Only browser ports4400–4402 were published,
all on127.0.0.1. No sysctl or other project was changed.

FFmpeg's deferred OS closure is now fixed to Debian and Debian-security snapshots
**20261024T000000Z**, with signed apt metadata (HTTP; selected slim base has no CA package).
The exact `7:5.1.9-0+deb12u1` deb matches frozen SHA256
`2ba8ead87657c123ce6de2de5ecdbc1fb4ead9a4b317b85b8ec41e16c890fe01`.
All **288 resolved OS package versions** are embedded in the real template's
`infra/ffmpeg-os.lock`; Docker compares its installed closure and exact version at build time.
[Initial fixed-snapshot build](ffmpeg-build.log.gz), [first output image build](compose-build.log.gz),
[separate toolchain-stage build](final2-compose-build.log.gz). Final3 reused the unchanged checked
OS stage. Future TS changes keep that stage cached. No bit-identical image/cross-platform claim.
Frozen image/npm/native pins were not replaced or edited.

[Probe harness](provider-probe.mjs), [result](provider-result.json), [log](provider-probe.log)
exercise transport/helper integration only:

- HTTP root200 (readable nginx mount), unfinished business route501.
- Real browser cross-origin signed part PUT200 using unchanged public signing Host, readable ETag,
  actual ListParts/complete, byte comparison from transcoder's private-original reader, anonymous
  original403, transcoded text via Garage website/nginx 200 and range206. Only 30 test bytes and
  one final part; no application upload lifecycle, real video, resume or encoding claim.
- PostgreSQL owner creates/inserts a scratch table; default reader SELECT succeeds and INSERT
  is denied. Table dropped. Upload/transcoder receive no metadata/counts credentials.
- Authenticated Valkey basic SET/GET/DELETE; cache-aside/TTL/single-flight policy remains custom.
- Four durable queues exist; confirmed dummy upload-job delivery triggers explicit unimplemented
  failure and terminates in the failed queue after initial failure +3 retries. Receipt drained;
  no application effect, deduplication, outbox, publication ordering or batching claim.
- OpenSearch 3.9.0 has an empty `videos` index with1 shard/0 replicas; no schema/query/public data.
- Actual Keycloak mouse sign-in with PKCE S256 and browser CORS token exchange; generated JWT
  helper validates signature, required expiry/subject, public issuer/API audience/creator role
  via internal JWKS. No integrated application sign-in UI or authenticated upload routes yet.

Credentials are created only at setup under private0700 `.runtime`; scoped files readable by
container UIDs are protected by that private host directory. Runtime applications receive only
their mounted credentials. Garage upload key gets owner only during CORS setup, revoked in
`finally`; ordinary runtime grants remain read/write on originals, reader for transcoder.
No credential/token/signed capability appears in evidence. Templates/evidence were checked
against every scratch secret before those runtime directories were removed.

## Failures, regressions and boundaries

First scratch compilation caught excess PG config properties; templates now pass only actual
pool/statement-timeout options. Node strip-only CLI rejected existing parameter properties;
CLI now uses the already-frozen tsx version. The first apt HTTPS attempt failed because the
base lacked system CAs; signed apt snapshot metadata over HTTP succeeded, with no TLS-verification
bypass. An early May snapshot still contained5.1.8, so the October snapshot was selected before
freezing the closure; frozen FFmpeg version was never substituted. Early export-directory0700
permissions gave nginx root403; non-secret subdirectories are now0755 under a private root.
Cache health used unsupported `VALKEYCLI_AUTH`; actual `REDISCLI_AUTH` returns PONG and final
fresh startup is healthy. Keycloak/Postgres UID access was corrected before fresh startup.

Two full check attempts hit the existing5s PGlite project-restart test timeout while build or
cleanup activity overlapped. [Build-overlap failure](check-contended-timeout.log.gz),
[shutdown-overlap failure](check-shutdown-timeout.log.gz), [isolated unmodified12-test pass](project-test-isolated.log.gz)
and final idle full pass are retained; overlap is observed, not a proved root cause. No timeout,
application test or test expectation was weakened. Final required results: [pnpm check](check.log.gz) **395 tests/49 files**, lint/all typechecks;
[34 native E2Es](e2e.log.gz) **1.2m**, source steady; [web build](web-build.log.gz) **passed**
(existing chunk advisory). [Final TinyURL mouse result](browser-result.json),
[screenshot](studio-tinyurl.png), [script](browser.mjs):12 tiles/13 lines, Fit/legend work,
zero errors; all four saved design/history responses and owner listing unchanged.
E2E DB [before](e2e-projects-before.txt)/[after](e2e-projects-after.txt) listings are equal.

The exact independent `field-projects/youtube/v1/app` path is now outside root Biome/workspaces,
so FP04 can preserve untouched output and frozen `.jeeves` input bytes. This deliberately changes
FP01's initial no-app-exclusion decision, not its historical entry. Future field handoffs must run
that project's own frozen-lockfile install/TypeScript build plus applicable business checks.
Existing studio/generator lint/types/tests remain required. No formatter dependency was added.

All owned `jeeves-fp03a` containers,6 volumes,network,3 named scratch images and runtime secrets
were removed. Shared pinned image downloads/build cache remain Docker-managed; no global prune.
Other projects `jeeves`, `jeeves-fieldwork-demo`, `qrwty`, `qrwty-5174` and owner 4300/4310 remain.
`.jeeves-feedback/` and immutable inputs/images/history are preserved. No paid/live model call.
FP03b must package trusted generator source/assets + frozen inputs/005 PNG for Docker, then
provide mouse download; FP04 commits actual untouched output before FP05 custom planning.

Adapter reference checks informed the bounded choices: [RabbitMQ 4.4 per-consumer prefetch](https://www.rabbitmq.com/docs/consumer-prefetch),
[AWS checksum configuration](https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html)
(`WHEN_REQUIRED` for this adapter), and [Garage manual single-node/key/bucket setup](https://garagehq.deuxfleurs.fr/documentation/quick-start/).
These current docs supplement actual pinned-version probes; they are not version-specific proof.
