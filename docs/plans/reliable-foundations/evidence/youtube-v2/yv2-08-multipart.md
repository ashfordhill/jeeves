# YV2-08 signed multipart evidence

The selected dependency now emits the working generic multipart engine, actual S3 adapter and
explicit HTTP handler factory. [Actual APIs, hookup gaps and limits](../../youtube-v2/interfaces.md#yv2-08--owned-signed-multipart-transport-and-http-mounts).
It reuses YV2-07's repository and YV2-06's branded caller transactions/hooks. It contributes only
selected object read/write access and PUT CORS through the existing foundation; temporary CORS
owner access is revoked. It installs no application service, lifecycle or complete source-bound
multipart template. Principal/content/metadata/namespace/completion/service bindings remain an
explicit required report gap until the later adapters/recipe exist.

## Focused offline and standalone checks

Three focused cases exercise the exact emitted core with the real offline PGlite repository:

- Ownership precedes every provider effect; foreign status/sign/complete/abort refuse and list is
  empty. Status retains the full resume fingerprint and provider inventory without disclosing
  owner, object key or provider ID. Signing enforces the exact part count and 900-second policy.
- Exact numbered/count/sized/ETagged inventory is required. Incomplete upload never invokes
  provider complete. A provider-success/response-loss simulation leaves durable completing state;
  status reconciles consumed inventory through Head, then commits one application intent and
  stable replay response. Wrong Head fingerprint is terminal; aborted/expired uploads refuse.
- Inventory paging/entry limits, single-flight sweep, retained orphan cursor and trusted namespace/
  age filtering are checked. The actual assembler emits three generic modules plus selected
  storage access, while application and installed-template claims remain unfinished.

The surrounding upload-state/assembly/foundation focused run passed **15 tests / 4 files**.
No Docker, external PostgreSQL or network is required by these unit tests. No new timeout or
assertion relaxation was introduced.

Two final fresh deterministic **44-file** exports use the actual assembler/registry and a
scratch-only document persistence contributor. Both path/hash lists match. Own frozen install
and untouched generated build pass; a separate typed PDF/document metadata/job/HTTP adapter
also compiles against the final emitted modules with no YouTube contract import. It is bounded
reuse proof, not a new product. Final exports are `/tmp/jeeves-yv2-08/verified-export` and
`verified-export-copy`; probe composition and logs remain outside the checkout.

Frozen v1 still emits all **108 identical paths/hashes**, manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
No v1 app/input/runtime/fixture, local-v1 asset, exact dependency/provider pin/lock or root README
changed. No `field-projects/youtube/v2/app` was created.

## Real isolated HTTP / PostgreSQL / Garage smoke

Recorded before startup in `/tmp/jeeves-yv2-08/resources.json`:

| Resource | Exact allocation |
| --- | --- |
| Compose project | `jeeves-yv2-08-multipart` |
| Export/private runtime | `/tmp/jeeves-yv2-08/final-export` / its `.runtime` |
| Loopback HTTP / identity / S3 | **45250 / 45251 / 45252**, checked free together |
| Providers | Pinned PostgreSQL, RabbitMQ, Garage and Keycloak; only selected upload dependencies |
| SQL access | Exact generated upload login via its scratch Docker-network address; no extra published SQL port |

Own first-run built the standalone image, initialized the four healthy providers, applied the
actual contributed transfer/document/outbox migration and grants, and configured only the
selected private originals bucket/key and signed-PUT CORS. There is no fake business service.
The document probe starts the real YV2-05 HTTP factory on loopback using YV2-08's explicit
`/documents` mounts and a cryptographically verified test principal provider. It observes:

- Principal verification is awaited **inside admission**: a held principal occupies the one
  admitted slot and a parallel request receives OVERLOADED before business work.
- Start returns server identities. Five foreign-owner actions (status, sign, complete, abort,
  list) respectively refuse or return no records, with no provider operation selected by the
  foreign caller.
- Two real signed PUTs transfer **5,242,997 bytes** (5 MiB + 117 bytes), with exactly 900-second
  URLs and successful origin-bound PUT CORS preflight. First-part status exposes actual ETag/
  size and original fingerprint; premature completion returns INCOMPLETE_PARTS. The second
  part resumes through the same durable upload.
- The probe deliberately throws after actual provider CompleteMultipartUpload succeeds.
  HTTP returns a safe unavailable response; status recovers the durable completing phase via
  missing consumed inventory + real Head verification. Repeated completion returns identical
  stored response, with exactly **one new logical SQL outbox intent** relative to the baseline.
- GetObject bytes equal the input byte-for-byte; independently computed downloaded SHA256
  equals the expected input SHA. Head's stored asset/upload identity, declared SHA/size metadata
  and ContentLength also match. **Engine Head validation itself does not hash object bytes**;
  that processing responsibility remains YV2-11's runner.
- Another upload stores a real part, resumes its inventory, aborts and subsequently refuses
  completion with 410. Real ListMultipartUploads then contains no remaining scratch sessions.
  The runtime SQL login cannot CREATE in the application schema; the runtime S3 key cannot
  change CORS after bootstrap owner revocation.

`probe-summary.json` records these sanitized outcomes; `probe.log` contains one safe success
line. No secret, bearer token or signed URL was printed or retained. Initial harness attempts
sent a JSON header on a bodyless POST, and assumed runtime GetBucketCors permission; both were
corrected in the scratch probe, without transport changes. The exact earlier scratch upload
sessions were aborted, and intent assertions compare baseline deltas rather than resetting data.
CORS behavior was observed with a real signed PUT preflight; runtime owner mutation refusal
was checked separately.

Provider/SQL effects remain non-atomic. Unknown initiation may leave a provider orphan until
bounded 24-hour namespace cleanup; failed SQL completion retains completing state. Already
completed original objects are not deleted by multipart abort. No distributed transaction,
provider ACL publication, new media validation or full YouTube app claim follows from this smoke.

## Cleanup and regression evidence

The exact scratch project ran `pnpm stop`, then all-profile Compose `down --volumes
--remove-orphans`. Only its four provider containers, three volumes, one network and single
`jeeves-yv2-08-multipart-app` image tag were removed; its private `.runtime` was removed after
shutdown. Project-label container/volume/network queries and the exact image query are empty,
all three ports are free, and all **14 owner v1 services remain healthy**. No global cleanup ran.
See `cleanup.log` / `cleanup-summary.json` in the scratch directory.

Final `pnpm check` passed lint/types and **433 tests / 60 files (45.87s)**. An initial root run
while four scratch providers were live put the new first PGlite fixture just over the existing
5-second test budget. After scoped provider shutdown, the isolated full run passes with the
same tests/assertions/timeouts and fixture setup. Native `pnpm test:e2e` passed **36 tests (2.2m)**;
`pnpm --filter @jeeves/web build` passed **1.58s** with the existing chunk-size advisory.
No normal studio UI changed; browser coverage retains TinyURL lane rendering, mouse/history
actions and generation.

Logs under `/tmp/jeeves-yv2-08/`: `focused-final.log`, `check-final.log`, `e2e.log`,
`web-build.log`, `export-verified.log`, `install-verified.log`, `build-verified.log`,
`build-adapter-verified.log`, `first-run.log`, `probe.log`, `cleanup.log`.
