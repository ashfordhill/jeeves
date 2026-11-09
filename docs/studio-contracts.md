# Finite operation contracts

NC03/NC04 add declarative Create link and Resolve link contracts plus one positive-cache policy. There is no HTTP runtime, auth verifier, adapter,
generator, template manifest or runtime evidence. Existing studies and saved projects are never upgraded by reading them.

The immutable local records are [Create](../jeeves/packages/spec/src/operation-catalog.json),
[Resolve](../jeeves/packages/spec/src/resolve-operation-catalog.json) and
[Positive cache](../jeeves/packages/spec/src/cache-policy-catalog.json), each at `1.0.0`. The NC03 Create
record and all of its hashes remain unchanged. Records contain actual JSON Schemas and finite behavior.
Every exact reference is `{id, version, sha256}`: bounded exact SemVer (40 characters maximum,
no leading zeroes), lowercase SHA256, no ranges or latest fallback. Hashes cover recursively
key-sorted compact UTF-8 JSON; the operation hash covers the entire definition, including the
schemas and their individual hashes. Unit tests independently recompute them. Availability lives
outside this identity: a known verification requirement supplies no available verifier.

The separate `studio-tinyurl-foundation@1.0.0` preset selects these exact declarations and the
existing `tinyurl-create-resolve@1.0.0` profile. The extended study and saved designs stay unchanged.
Its null verifier keeps implementation unavailable; no fixture artifact is shipped as support.

## Bindings and editing

Optional schema-v3 `operations` holds at most 50 receiver bindings and 100 calls. Absence remains
unspecified; reads never add it. `setOperations` requires v3. Explicit source commands and chat `configureOperations` use `previewOperations` /
`buildOperationsCommand`. Legacy source needs an explicit upgrade; apply validates the latest
revision and saves in one Undo step. Normal authoring has no operation form; **Export diagram →
Source & diagnostics → Operation declarations** shows preserved exact refs read-only.

A receiver has its own stable `id`, canonical `role` element, exact `implementation` signature
and tagged `binding:{kind:"create-link",storeConnection,successRetentionHours,authVerifier}`.
Create requires an explicit API role, its own source database, and both an explicit read-write
request and read-write grant: retained-result lookup and unknown-outcome reconciliation read the
same source that atomically commits success. Existing write-only intent stays unchanged and
saveable with a targeted missing-read contract gap; read-only still cannot satisfy writes.
The actual bound source dependency must declare synchronous SQL/Native binding and an internal
service/private-network boundary. Known contradictory protocol/security/interaction intent
refuses; Unspecified protocol remains a targeted incomplete declaration, without an inferred
adapter. Unknown operation refs acquire no Create-specific dependency checks.
Same-owner reads remain reads; co-deployment grants nothing. The
retention declaration is `24` hours or `null` (unspecified). The advanced verifier disclosure edits/clears a bounded exact ID/version/hash reference or
null; no actual verifier manifest/registry exists, so either choice has a targeted unavailable /
unresolved finding. Runtime availability is distinct from the known auth contract.

A call has its own `id`, `receiverBinding`, canonical `receiverRole` and exact `expects`
signature. Its caller is either `{kind:"entry",entry,lane,element}` or
`{kind:"connection",connection,role}`. Those identities must match the actual graph, and the
receiver binding must name the same canonical role. Stable binding IDs are distinct from graph
IDs; several different operations can belong to one API and use one relationship. Duplicate
binding IDs, duplicate known method/path on one API, and duplicate caller + receiver binding
refuse. The signature pins operation/request/success/error references, auth, idempotency and
its total deadline (Create 10,000 ms; Resolve 1,200 ms). No implicit schema subtyping or compatible-version guess is made.

Known incompatible promises refuse atomically. Well-formed unknown exact refs remain saveable
and unresolved, including an unknown operation that reuses known schema records. It acquires no
Create link behavior; create-specific access, retention and verifier checks apply only to the
exact known operation. Canonical graph references are still checked. Malformed references,
missing explicit binding references and contradictory endpoints refuse.

Represented connection/receiver timeouts must agree with the fixed deadline. A known non-HTTP
protocol or asynchronous/channel use contradicts a known HTTP call. Unknown protocol labels, fixed
retries without same-key/total-deadline propagation, or service/public/network security without
a declared verified-user propagation path remain targeted gaps. Public reachability alone says
nothing about whether the user is authenticated. Historical incompatible timeouts require explicit source work before binding. Reading or
selecting the design never rewrites existing settings.

Diagnostics **Select operation <id>** selects exactly `operation:<binding-id>` for chat (maximum 73 characters,
including a 63-character ID), separately from the API/owner and other operations. Generic
configuration selects no operation. Rename preserves the binding; removed/malformed selections
refuse at the chat boundary and disappear from live selection. History retains the original ref.
Canonical process tiles retain their original service/edge identities and caller → target arrows.
Operation and role subtitles do not appear on normal tiles.

Role/owner/authority/grant/dependency removal or transfer previews exact affected operation
clears. Canonical role/resource/connection deletion and changed entry ID/lane/target clean the
old bindings atomically; entry lane moves preview exact caller clears before one save, and stale endpoints never silently rebind. Other contradictory moves
refuse. Unrelated persistent/custom requirements remain and one Undo restores the whole removal.

## Create link v1 behavior

- POST `/links`; operation-owned normalized header/body envelope, after HTTP header-name
  normalization and the trusted auth boundary. Closed `headers` contains only `Idempotency-Key`,
  not the entire raw HTTP/auth header set. No configurable routes or schemas.
- Verify authenticity, trusted issuer, intended audience and time validity before accepting a
  stable verified issuer + subject principal. Raw identity headers/unverified claims never count.
  Any authenticated principal may create; no extra claims, scopes or policies are implied.
- Parse an absolute WHATWG HTTP(S) URL without a base, require a host and no credentials, serialize
  it, then enforce 2048 UTF-8 bytes. No destination fetch/reputation/reachability claim. Optional
  expiry is RFC3339 with an explicit offset, UTC-millisecond normalization and supported years
  0001–9999; reject unrepresentable instants/excess fractional precision. Omitted/null expiry
  normalize to null. A **new** request requires a future expiry; no extra business ceiling.
- Key is 1–128 non-whitespace printable ASCII characters, opaque and case-sensitive, scoped to
  verified issuer + subject + exact operation ID/version. It is not an auth credential.
  Equality uses serialized destination + normalized expiry. Authentication and parsing precede
  lookup; retained identical success replays before new-request expiry freshness checks, even
  after its link expires. Changed payload conflicts once its prior fingerprint is known.
- Atomically commit link + successful fingerprint/status/body before 201. Keep that original
  result for 24 hours from commit independently of link expiry. At commit + 24 hours, the key
  becomes eligible as a new request, is revalidated and may create a new link; late physical
  cleanup does not extend the promise. Link/code identity outlives key retention.
- Serialize concurrent scoped-key attempts before allocation. Wait for an observable prior
  fingerprint/outcome within the one total 10-second deadline; unknown/in-flight outcomes at
  deadline return dependency failure and same-key retry. Proven rollback releases the claim.
  No hidden durable pending/lease machine or immediate uncommitted-fingerprint promise exists.
- Allocate 16 cryptographically random bytes as 22 unpadded base64url characters, enforce durable
  namespace uniqueness and allow **five total attempts including the first** within the same
  deadline. Five proven collisions roll back as allocation exhaustion. RNG/store/deadline failure
  or unknown commit outcome is dependency failure; reconcile the same key before another
  allocation. Never reuse a code for a different destination.
- Success schema: 201 plus original code, destination, expiry and createdAt. No origin/short URL
  is guessed. Error schema covers 400 invalid input, 401 unauthenticated, 409 idempotency
  conflict, 503 allocation exhaustion and 503 dependency failure, with explicit retry classes.
  Invalid/auth failures consume no key. These are contracts, not simulated runtime tests.

The [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) and
[WHATWG URL standard](https://url.spec.whatwg.org/) inform transport/normalization.
PostgreSQL's [uniqueness checks](https://www.postgresql.org/docs/current/index-unique-checks.html)
and [isolation explanation](https://www.postgresql.org/docs/current/transaction-iso.html) explain
why uncommitted outcomes require waiting. These sources do not choose a database adapter or
prescribe this application's retention/allocation policy; those are the reviewed finite choices.

V3 exports complete declarations, catalog identity and targeted findings. Default v2 refuses
each nonempty receiver/call row at its exact source path, even with empty scope/ownership.
Create/Resolve declarations replace their blanket unspecified findings only when exact caller /
receiver declarations exist; targeted gaps remain. The selected one-public-namespace profile
checks every known create/resolve source and logical owner for agreement. Missing bindings or
authorities remain incomplete; different declared sources/owners refuse atomically. Independent
namespaces in arbitrary designs do not become blanket structural errors. Unknown exact refs
remain unresolved and gain no known behavior. Templates and runtime verification stay `none`.

## Resolve link v1 and positive cache v1

Resolve uses fixed **GET `/links/{code}`**, public auth, no idempotency key and one total **1,200 ms**
deadline. It returns **307** with `Location`; the target and expiry are immutable. It accepts one
raw ASCII segment, exactly 22 unpadded base64url characters encoding 16 bytes: 21 alphabet
characters followed by `A`, `Q`, `g` or `w` (four unused low bits are zero). Percent escapes,
padding, extra segments and noncanonical aliases refuse. On the matched operation, nonempty
query/body input returns 400. The normalized closed request envelope contains only `path.code`;
ordinary HTTP headers are outside it. Create's broader frozen success schema stays unchanged;
its actual 16-byte allocation already produces these canonical codes.

Every response, including all errors, has **`Cache-Control: no-store`**. The normalized closed
response envelope describes only contract-owned headers, allowing ordinary transport headers
such as Date/Content-Length outside it. Success `body:null` means zero response bytes, not JSON
null. Error bodies are JSON; their transport Content-Type is outside this header envelope.

| Outcome | Status | Meaning |
| --- | --- | --- |
| Resolved | 307 | Unexpired immutable destination in Location; empty body |
| Invalid input | 400 | Fix request; no dependency lookup |
| Unknown | 404 | Confirmed fresh authoritative primary absence |
| Expired | 410 | Wall-clock expiry reached; never redirect |
| Dependency failure | 503 | Primary failure/timeout/unknown result or exhausted total deadline; never guessed 404 |
| Overloaded | 503 | No primary slot; immediate refusal without a queue or internal retry |

A receiver keeps its stable ID/role/signature with tagged
`binding:{kind:"resolve-link",storeConnection,cacheConnection,cachePolicy}`. Cache connection and
exact policy ref are nullable: null means unspecified, never an inferred no-cache policy. No NC03
record needs migration. One API/edge may expose both known operations; leave the optional generic
API timeout unspecified when their exact deadlines differ. An explicitly set API/caller timeout
must match each bound operation. No operation read rewrites those settings.

The source is the same logical owner's authoritative **source database**, with explicit read
request and role grant (read-write may cover read; write alone does not). Misses use a fresh
primary lookup, never a read replica or pre-create snapshot. A durable Create 201 is immediately
visible to Resolve, yielding 410 if expiry has already passed. Stable 410 requires indefinite
minimal durable code+expiry evidence (retained row or tombstone); physical cleanup never changes
410 to 404. Allocated codes are never reused, independently of key retention or link expiry.

The only known cache policy is `links-positive-cache@1.0.0`: the resolver reads **and fills** its
own cache projection of this exact source. Both its dependency and grant require read-write.
Only an exact compatible declaration refines NC02's blanket projection population/freshness/
failure warning for that cache. Other projections and published-read markers remain unresolved.
The closed positive-record schema contains canonical code, normalized immutable HTTP(S) destination
and nullable expiry. Validate the payload and requested code before use; malformed data falls back.
Schema validation does not authenticate poisoned values: a trusted, isolated namespace is required.

- Maximum positive lifetime **300 seconds**, clamped at the actual write to no later than the
  record's absolute expiry. Earlier eviction/shorter declared maxima are compatible. Value and
  expiry write atomically; never round upward, refresh past record expiry or cache nonpositive life.
- Cache read and optional fill each cap at **50 ms**; primary caps at **1,000 ms**. Start one
  monotonic **1,200 ms** deadline at acceptance, covering validation, both phases and the response
  decision. Every phase uses the smaller phase cap and remaining budget; never reset the deadline.
- At most **64 actual primary resolve calls**, shared across all bindings in one runtime instance.
  Admission is immediate, with no queue/retries. Keep the slot until actual completion or confirmed
  cancellation; timing out a request cannot leave an unbounded trail of orphaned queries.
- Cache miss, loss, outage, timeout or malformed payload falls back once to primary within that
  deadline. A valid unexpired positive hit may succeed without primary. Primary failure is 503.
  No negative cache, in-process L1, stale-on-error or single-flight wait exists in this policy.
- Fill may skip for insufficient budget or fail without replacing timely authoritative success.
  Recheck expiry after fill and immediately before redirect. An exhausted overall response deadline
  is 503; ordinary fill failure is not. Wall-clock UTC determines expiry (`expiresAt <= now`);
  monotonic time measures deadlines. Expired validated hits return 410 rather than redirecting.

Known contradictions in the receiver/caller timeout, retries, protocol/security/channel use,
cache TTL, primary routing, Redirect lookup shortcuts and attached CDN cache intent refuse atomically. Dependency timeout
comparisons use phase maxima; existing generic connection timeout/retry controls remain restricted
to HTTP(S)/gRPC, with no new SQL/Redis controls. Existing data-access statement timeouts may be
shorter than the primary maximum. Typed module applicability follows actual component links via
the bound source/cache edge and upstream component chain; unrelated same-host modules and prose
are not assigned operation behavior. Legacy TinyURL's explicit replica, L1/L2/negative cache,
single-flight and 302 settings are diagnosed without rewriting its study or saved copies.

Read-only operation diagnostics retain source/cache connections and exact policy references.
Chat `describeOperation` reads the same exact operation/policy registry and `configureOperations`
uses the finite schema/preview/command. Known records in wrong categories refuse; unknown refs
stay retained and unresolved. Diagnostic target buttons select each exact binding. Cache/source/
role/authority/grant removal or transfer previews exact affected bindings and cleans or refuses
atomically; entry moves never silently rebind. One Undo restores the whole accepted change.

These checks validate declarations. Real HTTP outcomes, immediate create-to-resolve visibility,
cache clamping and boundary-time expiry, synchronized wall-clock/skew, monotonic propagation,
cancellation, trusted cache isolation and absolute-expiry precision need future backend and real
adapter evidence. No runtime handlers or simulated lookup are supplied as verification.

[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines the status semantics;
[RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) explains no-store (including why default
404/410 heuristics are insufficient). [Redis SET](https://redis.io/docs/latest/commands/set/)
illustrates atomic value/expiration mechanisms; [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
explains committed-primary visibility. These sources do not choose the application's route,
retention, bounds, adapter, provider or runtime version.

## Exact snapshot report (NC05)

The read-only source diagnostics **Compatibility report**, blueprint v3 `readiness` and read-only chat
`readReadiness {}` use the same full snapshot report. Design validity, exact contract completeness,
implementation availability and exact generated-output evidence are independent. Generation
eligibility requires the first three, without requiring future output evidence. Legacy/unknown/
custom-unresolved or extended behavior cannot borrow support from the two known operations.
Concrete auth-verifier availability is an implementation gap, separate from the known auth
behavior contract. Product has no real manifest/registry/output/evidence. Trusted positive test
inputs are isolated trust-plumbing fixtures, never runtime behavior evidence. The full canonical
composition subject/hash, exact manifest/receipt/evidence formats and limits are documented in
[Snapshot compatibility report](studio-readiness.md).
