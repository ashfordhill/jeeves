# Finite operation contracts

NC03 adds declarative Create link contracts. There is no HTTP runtime, auth verifier, adapter,
generator, template manifest or runtime evidence. Resolve and expiry/cache lookup policy are
separate NC04 work. Existing studies and saved projects are never upgraded by reading them.

The immutable local [catalog record](../packages/spec/src/operation-catalog.json) contains
`links-create@1.0.0`, the actual request/success/error JSON Schemas and the finite behavior.
Every exact reference is `{id, version, sha256}`: bounded exact SemVer (40 characters maximum,
no leading zeroes), lowercase SHA256, no ranges or latest fallback. Hashes cover recursively
key-sorted compact UTF-8 JSON; the operation hash covers the entire definition, including the
schemas and their individual hashes. Unit tests independently recompute them. Availability lives
outside this identity: a known verification requirement supplies no available verifier.

## Bindings and editing

Optional schema-v3 `operations` holds at most 50 receiver bindings and 100 calls. Absence remains
unspecified; reads never add it. `setOperations` requires v3. The mouse **Operation contracts**
form and chat `configureOperations` use `previewOperations` / `buildOperationsCommand` together.
A legacy design needs a pure preview and explicit **Upgrade & save operations**. Apply matches
the exact latest preview/revision; the entire save is one Undo step.

A receiver has its own stable `id`, canonical `role` element, exact `implementation` signature
and tagged `binding:{kind:"create-link",storeConnection,successRetentionHours,authVerifier}`.
Create requires an explicit API role, its own source database, and both an explicit write
request and write grant. Same-owner reads remain reads; co-deployment grants nothing. The
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
10,000 ms deadline. No implicit schema subtyping or compatible-version guess is made.

Known incompatible promises refuse atomically. Well-formed unknown exact refs remain saveable
and unresolved, including an unknown operation that reuses known schema records. It acquires no
Create link behavior; create-specific access, retention and verifier checks apply only to the
exact known operation. Canonical graph references are still checked. Malformed references,
missing explicit binding references and contradictory endpoints refuse.

Represented connection/receiver timeouts must agree with the fixed deadline. A known non-HTTP
protocol or asynchronous/channel use contradicts a create call. Unknown protocol labels, fixed
retries without same-key/total-deadline propagation, or service/public/network security without
a declared verified-user propagation path remain targeted gaps. Public reachability alone says
nothing about whether the user is authenticated. Existing TinyURL's shorter API timeout must be
edited explicitly through its ordinary **Options → Request timeout** before binding; the
operation form does not rewrite existing settings.

**Details & bindings** selects exactly `operation:<binding-id>` for chat (maximum 73 characters,
including a 63-character ID), separately from the API/owner and other operations. Generic
configuration selects no operation. Rename preserves the binding; removed/malformed selections
refuse at the chat boundary and disappear from live selection. History retains the original ref.
The attached role label and inspector disclosure are views, add no service/edge, and keep request
arrows caller → target. The old fitted-overview small-label limitation remains.

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
Create declarations replace the old blanket create-unspecified finding only when exact caller /
receiver declarations exist; missing verifier and resolve/expiry/cache requirements remain. The one-public-namespace profile also retains an explicit unresolved composition obligation: all create/resolve bindings must share one authoritative source and compatible logical owner. NC04/NC05 must implement that agreement check; independent source databases in arbitrary designs are not blanket structural errors.
Templates and runtime verification stay `none`.
