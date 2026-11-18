# Runtime and generation contract

Approved contract governed by the [owner decisions](README.md). This is the common contract for RG01–RG26.
Implementation choices inside it belong to the assigned agent; changes to its guarantees do not.

## 1. Processes and ownership

1. Each application tile continues to generate its own independently runnable process. Shared
   source is emitted once where useful and loaded independently by each process. No central
   coordinator service, global in-memory correctness state, or required single replica is added.
2. Modules inside one process may call each other directly through generated interfaces.
   Calls across process boundaries use authenticated transport. An in-process call still applies
   the capability's authorization and input checks; it is not a bypass around its HTTP adapter.
3. A logical owner may contain API and worker roles. They may share declared owned product state,
   but receive distinct credentials and precise grants. Another logical owner's writes are
   refused. Published reads name both the exposed view and its allowed readers.
4. Owner identity, process identity, module identity and display name are distinct. Renaming a
   display label must not rename a database, credential, durable record namespace or public API.
   Explicit identity changes require migration. Existing source identities remain readable.
5. Scheduled tasks may run inside a Service or a Worker. A separate Worker is available when
   progress must be independent of HTTP traffic. Its access follows logical ownership, not an
   exception granting every worker the API's credentials. Deployment must actually run a process
   for its timers to progress; this plan does not provision schedulers or CPU availability.

## 2. Existing model, finite extensions

Extend `NormalizedGeneration`, the installed registry and their existing source tracing. Do not
create a parallel architecture model. The new records are versioned JSON-serializable data:

- stable owner/process/module/capability IDs and declared dependencies;
- callable input/output contracts identified by stable names and versions;
- transport role: in-process, HTTP, delivery consumer or scheduled task;
- authority/caller requirements and named product-state access;
- finite effect classes: read, local atomic mutation, durable external work;
- delivery/replay/freshness/retention requirements used by a real emitter or refusal check;
- extension contract version and the generated mechanism that owns each lifecycle phase.

No function source, TypeScript type expressions, closures, Node objects or arbitrary code strings
belong in this semantic model. Runtime DTO validation and TypeScript interfaces are two consumers
of the same bounded data contracts. Do not add a general schema language: support only the data
forms needed by the capabilities in this packet. Product SQL stays application-owned SQL for the
selected database, not a new database-independent language.

A record is added only with an actual compiler check or emitted consumer. No normal inspector
field exists solely for internal metadata. TypeScript is the only implemented output language;
future emitters can consume the semantic records without promising identical handwritten hooks.

## 3. Narrow extension boundary

The generated public API has three kinds of extension:

| Extension | Receives | May do | Does not receive |
| --- | --- | --- | --- |
| Product policy | Validated, immutable DTOs and necessary identity facts | Synchronous validation, eligibility, keys, mappings and result selection | Clients, credentials, transaction/ACK/lease controls |
| Product operation | Validated input, operation context, declared capability handles | Invoke permitted reads/commands and compose product decisions within the operation's effect class | Raw clients/pools, direct token access, commit/rollback/ACK methods |
| Integration mapping | Bounded provider input/output DTOs | Construct/map a request or response for a declared external target | Arbitrary target URLs, auth overrides, unrestricted retry loops |

Use the existing product hooks and stub concept. Do not add three competing plugin systems.
Generated code owns setup/close, deadline allocation, authentication, replay, retry scheduling,
commit/rollback, acknowledgement, lease renewal/fencing and protected state transitions.

An operation declares whether it reads, commits a local mutation or requests durable external
work. A local-transaction callback must not have network capabilities. A provider request is not
silently retried as if it were a database statement. These are public API restrictions, checked
import boundaries and runtime validation, not a JavaScript security sandbox.

Application SQL and product operations remain handwritten. Expose registered, parameterized
product queries/commands through scoped handles; do not expose arbitrary SQL execution in policy
hooks. Product SQL may touch declared product state, not implementation tables for leases,
sessions, receipts or idempotency. Product migrations run with DDL authority over their declared
product namespace, separate from template-schema administration. Migration credentials never
reach application processes.

Generated checks reject cross-service private imports, direct provider-driver imports in hook
files, forbidden effect APIs in pure policy hooks, and writes to template-owned files. Maintain
one application-owned contract location for DTOs and pure shared definitions. Do not reject
legitimate shared contracts merely because multiple processes import them. Checks catch ordinary
misuse; `any`, dynamic code or malicious imports cannot be made safe by a type system alone.

Legacy unrestricted Custom stubs remain readable as source. New exports requiring the guarded
contract must migrate them explicitly or report the outstanding custom gap. Never silently wrap
unknown old code and claim it now satisfies the new guarantees.

## 4. Lifecycle and request semantics

- Configuration for both templates and stubs is validated before opening clients. One process
  creates a client once per compatible resource/configuration/credential scope. Different grants
  must not be merged just to share a pool. Hooks initialize once before readiness and close once
  in dependency order. Initialization failure cleans up what was opened.
- Requests carry a bounded context: request/correlation ID, authenticated caller facts, deadline
  and cancellation. A forwarded budget is clamped by the receiver's own maximum; never compare
  monotonic timestamps from different machines. Background delivery gets its own execution budget,
  not the expired deadline of the request that originally published it.
- Database/cache/HTTP/broker adapters consume that context where their operation supports it.
  Cancellation is best effort and is never evidence that an external effect did not occur.
  Distinguish refused, definitely failed and outcome-unknown results. Unknown commit/publish
  outcomes use recovery/idempotency; they do not trigger blind replay of effects.
- One error classification controls status, retryability and protected headers. A pure product
  formatter can shape the public body from safe fields; it cannot turn an auth refusal into
  success, remove required retry metadata, or expose credentials/provider internals.
- Raw webhook bytes are preserved before JSON parsing; body limits are enforced before buffering
  unbounded input. Finite route-level limits are supported only with a generated consumer.
- Liveness and readiness have separate meanings. Dependency waits are cancellable and logged;
  invalid configuration fails immediately. A necessary missing dependency prevents readiness.
- Shutdown stops admission, signals in-flight work, waits within a fixed documented budget and
  then terminates remaining work without claiming it rolled back. Durable work is recoverable by
  another process. A hung hook cannot hang shutdown indefinitely.
- Request/failure logs carry correlation and operation identifiers, with credentials and sensitive
  request bodies excluded. No metrics platform or audit product is added.

## 5. Mechanism guarantees

### Local idempotent operation

Authenticate and establish scope; validate the key/request and compute canonical identity; return
an already committed result before new-work admission/provider checks; coordinate a new operation;
commit its product mutation and replay record together. A key reused with different input conflicts.
Two replicas do not both perform the local mutation. Scope prevents another account reading a replay.
Secret-bearing replay values are sealed by a generated mechanism. Retention is explicit and bounded.
An ambiguous COMMIT remains recoverable. External effects use durable work, not this transaction.

### Distributed admission and cache reads

Admission is a single-key atomic shared-store decision. Its limit does not multiply with replicas.
The first implementation fails closed when admission cannot be checked; there is no per-copy
fallback allowance. A product policy supplies the key from trusted context, not an untrusted
forwarded-address header. Saturation is distinct from loss of connectivity.

Cache behavior explicitly separates immutable positive records from mutable/versioned records.
Do not apply the immutable cache contract silently to mutable redirects. Versioned fills cannot
overwrite a newer version; freshness uses an absolute validity bound that transport delays cannot
extend. The caller can observe the bound when a later side effect requires a final validity check.
Expiry, overload and optional cache failure behavior are defined, bounded and recover after outage.

### Durable work and scheduling

Persist intent before acknowledging accepted work. Every work item has a stable identity, state,
attempt count, next-attempt time, holder and monotonically advancing fence. Claim/renew/complete
operations use database time and compare ownership/fence. An expired holder cannot commit a stale
product update. Network work runs outside the database transaction.

External effects require a stable provider idempotency identity or a documented reconciliation
operation. The runtime cannot fence a remote provider that offers neither; that combination must
remain unsupported rather than claim exactly-once effects. A lease alone never means exactly once.
The first supported remote mutation target can be another generated idempotent operation.
Arbitrary providers require an installed adapter with explicit recovery semantics; adding an
Idempotency-Key header alone is not evidence that the provider implements them. A fault-injection
stand-in in the test harness does not establish production support for an external provider.

Scheduled intervals create stable work identities with database time. Missed intervals coalesce
to one current reconciliation tick in the first implementation; this is documented, not a cron or
catch-up scheduler. Execution may repeat; effects must satisfy the work contract. Retries use
bounded backoff and a finite terminal-failure state. Accepted unfinished work survives restart.
No correctness state depends on one timer process remaining alive.

### Webhook inbox and consumer receipts

For the selected generic HMAC protocol: verify timestamp/signature against raw bounded bytes,
then decode/validate, then persist the unique delivery and respond. A successful HTTP acknowledgement
means durable inbox acceptance, not completion of all business effects. Duplicate identity with
different content is refused/quarantined by a fixed policy. Hooks cannot skip verification or ACK
before storage. RG17 documents the exact supported envelope; it does not claim Stripe support.

Queue receipt and product effect commit atomically before ACK. Preserve stable event identity
across retention partitions; moving the event's date must not allow it to count twice. Keep
receipts at least as long as the declared replay/delivery horizon. Cleanup runs independently of
new arrivals, in bounded work. Heartbeat, last successful progress and backlog/unknown state are
distinct, so a stopped worker is not reported as a healthy idle worker. Quarantined work is visible
and replay is explicit. No QRWTY-specific analytics gate or erasure workflow is generated here.

### Identity and browser sessions

Workload identity is distinct from end-user identity. A user token does not authenticate the
calling service. New service calls use audience-bound workload tokens with caller allowlists;
the caller attaches credentials and the callee verifies them. Missing setup refuses the relevant
generation. Token/JWKS caches are per process and bounded; every request does not synchronously
contact the identity service. Local identity setup is test infrastructure, not a production issuer.

Browser sessions use a maintained OIDC implementation, code+PKCE, one-use state/nonce binding,
secure cookies, sealed tokens, CSRF and revocation. Public cookie/session policies are explicit
and consistent. Invalid/expired cookies follow the declared route policy; test-clock concessions
must not leak into production behavior. Concurrent refresh is coordinated across replicas before
rotation. Definitive issuer refusal differs from transient outage. Crash-after-rotation uncertainty
has an explicit result; do not claim it can always be recovered if the issuer invalidates the only
refresh token. Access/refresh tokens are not returned to product policy hooks.

Forwarding preserves user identity only to declared recipients, also authenticates the workload,
forwards a finite header set, and obeys the request budget. A retry after token refresh is bounded
and is permitted only where the operation's replay contract makes it safe. No arbitrary proxy.

## 6. Compatibility, evidence and limits

Generated extension API versions are recorded separately from saved design schema versions.
An incompatible update reports affected hook files and required migration; it never overwrites
handwritten bodies to make compilation pass. Legacy exports and evidence are preserved. A caller
must explicitly migrate its code before the new contract is considered satisfied.

Every unit identifies its observable assertions. Existing isolated tests are supplemented by
selected real two-copy/store-failure cases and two distinct product mappings. Do not generate the
oracle from the same emitter logic being tested. Do not create an exhaustive configuration matrix,
load benchmark, certification dashboard or new external test service.

Known limits are explicit. This contract covers implemented mechanisms under their declared
assumptions, not arbitrary business logic or every distributed failure imaginable. Keep human
choices about ownership and policy visible; keep retry bookkeeping and internal metadata out of
ordinary forms. The source of truth for generated files remains the diagram plus installed,
versioned template definitions.
