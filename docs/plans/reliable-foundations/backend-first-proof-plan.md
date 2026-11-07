# Separate backend: first TinyURL proof plan

Plan only, 2026-11-07, following the [NC14 review](nc14-review.md). The owner explicitly deferred
backend implementation. No new repository, runtime, generator, registry, adapter or paid model
run is created by this document. NC07–NC13 are not prerequisites and remain deferred.

The first proof is one small HTTP service: authenticated Create and public Resolve, PostgreSQL
as the authoritative source and one Redis-compatible positive record cache. One Links owner has
two API responsibilities and may use one deployable. No messaging adapter, analytics, event bus,
worker pipeline, custom slugs, destination editing, management, quotas or reputation enforcement
is required. A request for one of those features changes scope rather than silently extending
this profile. Tests passing this slice cannot certify a general service catalog.

## Inputs and kickoff dependencies

At future kickoff, locate the actual backend repository and read its AGENTS/conventions. Record
its package/runtime/build/dependency policy, test tools, output layout and deployment constraints.
Select and pin exact supported runtime/framework, PostgreSQL client/server, Redis-compatible
client/server and auth-verifier implementations, including image/package/lockfile content and
transitive dependencies. Repository choice, versions and concrete auth adapter are decisions for
that kickoff, not a questionnaire or recommendation to implement today. Infrastructure and
credentials come from that host's explicit settings; no secret belongs in a blueprint or receipt.

Consume an explicit blueprint v3 snapshot, recompute its complete canonical semantic subject and
hash independently and validate it against the supported exact profile. Default-v2 export is not
changed by this work. Preserve all unknown refs as unresolved; reject required custom/excluded,
unsupported settings/providers/modules and extra application behavior. Do not translate labels,
goals, names or module prose into handlers. An exact finite ID/version/hash selects a reviewed
implemented template and adapter combination; no closest match, latest substitution or LLM
interpretation is part of assembly.

The frozen profile definition is `tinyurl-create-resolve@1.0.0` with SHA256
`40130ff2ff51611631a540bb9289c3397de7d02ce162926ecfc279b03c441985` and exact records:

| Contract | SHA256 |
| --- | --- |
| `links-create@1.0.0` | `bac402c10fbee06292b333d35b698fa96c9f6baa88062a7e53b11bdfad18612f` |
| `links-resolve@1.0.0` | `d819c8a28719fbdde3dad24c480e8a8044d1f6fac012b59b104137b9eb36552a` |
| `links-positive-cache@1.0.0` | `968a31ff6b9a2c93d9ceb800e9fe047ce9388b3c151f8bc5300849173fa6872a` |

Read the entire schema and behavior of each record; a schema alone is weaker than its behavior.
Any required semantic change gets a new explicit version and reviewed compatibility decision.
The current studio's arbitrary positive fixture bytes are not an implementation to port.

## Sequential future units and acceptance

Each unit is scoped in the backend repository before execution, has meaningful deterministic
unit tests plus the relevant real-adapter tests, appends its handoff and ends with review. Use the
repository's conventions; these are deliverable boundaries, not instructions to start coding.

| Unit | Concrete deliverable | Acceptance needed before the next unit |
| --- | --- | --- |
| B01: freeze inputs and trust protocol | Recompute blueprint/profile/operation/schema/policy hashes; define supported exact settings/providers/deployable composition and template input allowlist. Document target repository, auth/runtime/adapters, deterministic output representation and external evidence authority. | Unknown/malformed refs, required extras and source/hash mismatch fail without substitutions. Same semantic subject with reordered sets yields the same identity. Project name/envelope/history/UI/origin cannot enter output unless added to a versioned semantic input contract. No runtime support is advertised yet. |
| B02: implement reviewed HTTP/auth/storage core | Hand-reviewed templates for strict Create/Resolve envelopes and exact response schemas; trusted verifier adapter; PostgreSQL migrations/repository/transaction layer. Authenticated principal is verified issuer+subject after authenticity/issuer/audience/time checks. | Real HTTP and PostgreSQL cases prove normalization, idempotency serialization/retention/durable atomicity, allocation/reconciliation and fresh primary visibility. Invalid/raw identity headers never become a principal. No cache is required to prove correctness of the primary path. |
| B03: implement bounded positive cache | Exact owned source projection in isolated trusted Redis-compatible storage, validated records, atomic absolute expiry, monotonic deadline propagation and per-instance shared primary admission. | Real Redis/PostgreSQL and fault cases prove expiry clamp, fallback, optional fill, no-store responses and actual in-flight work bounds. Timeouts do not release unresolved primary calls or leave unbounded cache work. Adapter cancellation/completion semantics are demonstrated rather than assumed. |
| B04: pin reviewed artifacts and assemble deterministically | A trusted host publishes content-addressed implemented templates/migrations, dependency closure/lockfiles, auth verifier and one exact compatible manifest. Deterministic assembler consumes only supported canonical subject and pinned artifacts, renders finite reviewed substitutions and emits complete output plus receipt. | Two clean builds with the same inputs produce identical normalized bytes and hashes. Changing any meaningful input/artifact invalidates prior output. Unsupported combinations fail before output; no model is used to invent or patch handlers. Files cannot escape the declared output root. Regeneration preserves custom-owned files, refuses edits to generated-owned files, and changes output/evidence identity after a design change. |
| B05: independently run exact-output verification | Reviewed self-contained executable suite bundle, disposable pinned real environment, independent runner and evidence publication against the expected receipt. | All twelve obligations pass with retained HTTP/DB/cache/concurrency/fault logs for that exact output. Host checks missing/malformed/hash/window/case failures. The runner/trust authority independently establishes tested output and policy; the output cannot self-certify. |
| B06: review and publish bounded support | Independent source/runtime review of templates, assembler, adapters, migrations, evidence and reproducibility. Register only this supported exact composition/artifact set after review. | Report valid declarations, implementation availability and exact tested-output evidence separately. Re-run after any material input/output/template/dependency/verifier/suite/environment change. Deployment and live operation require their own authorized environment review. Broader domains remain deferred. |

## Regeneration and custom-code boundary

Record a content manifest of generated-owned paths and their prior bytes. Reserve custom-owned
paths explicitly; do not overwrite or delete them. Regeneration refuses edited generated-owned
files with a concrete conflict report before changing output, rather than merging or silently
replacing human work. A new generated path that collides with a custom-owned path also refuses.
No custom runtime code or reserved extension slot silently inherits this narrow profile's
verification. Required unreviewed/custom behavior blocks supported assembly until a separately
versioned contract/template and suite are reviewed; merely preserving a file certifies nothing.

B04/B05 acceptance must exercise an initial deterministic build, a declared semantic design change,
regeneration and fresh verification of the new exact output. Old receipts/evidence must fail for
the changed output. Check unchanged custom files byte-for-byte, refusal of edited generated files,
refusal of custom-path collisions and atomic/no-partial output on a failed regeneration. Review
any future custom-code integration as its own supported input and include its exact bytes in the
identity before running and claiming evidence for it.

## Behavioral proof matrix

The twelve existing runtime case IDs are obligation groups, not executable-code fingerprints.
The executable suite must contain these scenarios and a reviewed mapping from each to exact
assertions; a green case label without the underlying assertions/logs is insufficient.

| Required case group | Real-adapter scenarios and observations |
| --- | --- |
| `create-auth-and-input` | Invalid signature, issuer, audience, expiry/not-before and raw identity headers; same subject across different issuers; closed request/header envelope, opaque case-sensitive ASCII key, WHATWG URL normalization without fetching, credential/scheme/length refusals, exact supported expiry syntax/range/precision and omitted/null normalization. Preserve ordinary transport/auth headers outside the normalized operation envelope. |
| `create-atomic-idempotency` | Concurrent same normalized payload/same scoped key produces one link and original201 body; changed payload conflicts only once prior outcome is observable. Different issuer/subject/operation/key scopes stay separate. Link plus successful fingerprint/status/body commit together before success. Forced rollback creates neither. Test actual database isolation and lock behavior. |
| `create-retention-replay` | Equal retained replay after link expiry still returns the original201 result. Changed retained payload conflicts. At commit+24h the key is eligible as new and expiry freshness is revalidated even if physical cleanup is late. Link rows outlive successful-key retention; neither key cleanup nor retry reuses an allocated code. |
| `create-collision-and-unknown-outcome` | Inject deterministic candidate collisions and verify five total allocations including the initial try, rollback before allocation-exhausted and no leaked success. Drop the connection before/during/after commit acknowledgment; reconcile the same key without guessing success or reallocating an unknown committed result. Preserve completed success during failures. |
| `create-total-deadline` | Slow verifier, lock wait, allocation attempts and commit all share one10s monotonic deadline, including duplicate waiting. No phase resets it; inability to determine commit by deadline returns dependency-failure/same-key. Measure actual database calls/cancellation and retained work. |
| `resolve-wire-outcomes` | Real raw HTTP requests: canonical 16-byte/22-char code with final A/Q/g/w; reject percent aliases, padding, extra path segments, nonempty query/body and malformed code.307 has Location and zero body bytes; explicit400/404/410/503 schemas. Every result, including overload and all errors, is no-store. Contract-owned closed headers do not forbid ordinary HTTP server headers. |
| `resolve-primary-visibility` | A returned durable Create201 followed by fresh-primary Resolve finds that exact immutable destination, or410 if already expired. Never read a stale replica or turn database outage/timeout/unknown result into404. Exercise actual connection pools and transactions. |
| `resolve-expiry-and-no-reuse` | Before/at/after expiry, process restart and cleanup; durable minimal code+expiry evidence retains410 indefinitely. Physical cleanup must not turn expired into unknown or free the unique namespace. Immutable destination/expiry and code cannot be reassigned. |
| `cache-validation-and-isolation` | Hit/miss/eviction/loss/outage, malformed/extra fields/wrong code/non-normalized URL/unsupported expiry, trusted namespace/credential isolation. Invalid cache records fall back once; a valid unexpired hit may serve during primary outage. No poisoned external cache trust, negative entries, local L1, stale-on-error or HTTP cache. |
| `cache-expiry-clamp-and-clocks` | At actual atomic write, absolute cache expiry is at most min(fill time+300s, record expiry); no upward rounding. Skip nonpositive life. Recheck expiry on hit and before response, including expiry crossed during fill. Test actual server precision, network delay, injected wall-clock shifts and monotonic timing; document supported skew assumptions and demonstrate enforcement in the pinned environment. |
| `cache-fallback-and-deadline` | Cache read/fill≤50ms, primary≤1000ms and all phases/validation/decision≤1200ms from acceptance. Slow/error/malformed cache falls back once within remaining time; primary failure503; fill skip/failure preserves timely authoritative success. No retries, queue, single-flight waiting, background retry or detached unbounded work. Exhausted total budget always503. |
| `primary-admission-and-cancellation` | Across several Resolve bindings in one instance, hold64 real primary calls blocked, reject the65th immediately after cache failure/miss and count the actual active calls. Request timeout keeps the slot until completion or confirmed cancellation. Repeat failures to prove no accumulating orphan queries; verify pool/driver cancellation and drain behavior. Cache operations also have bounded cancellation/completion/resource use. |

Use injected clock/RNG/fault controls for deterministic boundary cases and real PostgreSQL/Redis
for actual transaction, uniqueness, visibility, expiration and cancellation behavior. Mocks alone
cannot establish those properties. Retain failures as failures. Scope throughput observations to
the pinned environment; a concurrent-admission test does not prove production capacity or SLA.
The proof environment is separate from studio PGlite unit tests and owner databases/projects.

## Exact output and evidence protocol

1. Publish a strict `jeeves.template-manifest.v1` from a trusted host, with one complete canonical
   supported composition and exact template/dependency/verifier refs. Resolve and hash actual
   bytes, including transitive execution dependencies, before assembly. Reviewed immutable
   mapping is the only selector of implemented code. No product upload or model-supplied manifest
   becomes trusted through a matching self-reported hash.
2. Specify a deterministic output bundle: relative paths, file bytes/modes, canonical ordering,
   encoding and normalized archive metadata. Pin the complete generated tree/migrations/build
   configuration and applicable dependencies; exclude build-time clocks/random identifiers.
   Retain both source-bundle identity and the actual executable/image artifact identity. If a
   build cannot be deterministic, stop and explicitly version the identity/protocol rather than
   discard inconvenient differences. Do not omit executable bytes from the evidence chain.
3. Independently pin the expected `jeeves.generated-receipt.v1` and output ref outside model/design
   content. It binds composition/profile/manifest/templates/dependencies/verifiers, output and
   verification suite/environment/window. Where source bundle and built image are distinct,
   define and review a versioned receipt/output-bundle format that binds both before claiming
   runtime verification; the existing opaque fixture format is not that implementation.
4. Publish `jeeves.runtime-suite.v2` with every required case exactly once and an exact
   `executionBundle` ref. Resolve and hash the actual self-contained runner/test/fixture/config
   and dependency bytes. A trusted publisher independently reviews bundle completeness; forbid
   unpinned downloads or extra test inputs. Case IDs alone do not identify assertions/code.
   Descriptor-only v1 must fail closed, not be relabeled v2. Tests in NC14 only check this trust
   plumbing and do not execute those opaque fixture bytes.
5. A separate trusted runner receives the independently expected receipt, resolves pinned output
   and suite, starts the pinned environment image/configuration, runs the actual executable
   output against real adapters/faults, and retains logs plus pass/fail/skip for every case.
   Publish `jeeves.runtime-evidence.v1` binding that receipt and all exact identities, completion
   instant and results; authenticate publisher/provenance with a reviewed host mechanism. No
   output-provided “verified” flag or output-controlled expected hash can satisfy this boundary.
6. The host evaluates evidence against its independently pinned inclusive acceptance window,
   suite/environment and expected output; no ambient report clock or self-extended window.
   Missing/stale/future/hash-mismatched/duplicate/skipped/failed cases refuse. If durable logs,
   built-artifact bindings or publisher provenance need new machine fields, version/review the
   protocol before wiring product availability. Do not retrofit stronger meaning into v1 fixtures.

Completion of this plan would establish only this exact reviewed TinyURL implementation and its
tested output/environment. A future studio integration may then expose actual availability and
matching evidence through a trusted host resolver. Until that exists the product report remains
**valid / complete / unavailable / none**, generation ineligible, for the new foundation.
