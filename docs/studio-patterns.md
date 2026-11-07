# Reviewed chat patterns

The local catalog in [studio-patterns.ts](../packages/spec/src/studio-patterns.ts) supplies reviewed
design guidance to the actual chat tool loop. Catalog and record versions are **1.0.0**. There
are four records; runtime lookup uses no network, embeddings or external documents.

| ID | Applies to | Current model support |
| --- | --- | --- |
| `cache-aside-lookup` | Repeated reads with an explicit freshness policy | Service/cache/database topology; cache-reader settings express intent. No enforced freshness, invalidation, consistency or authorization contract. |
| `durable-background-job` | Slow or retryable work, including media processing | Durable source, job channel, worker and output dependencies. A result returning to the same initiating owner is outside the acyclic model. |
| `publication-to-search` | Derived search after an authoritative publication decision | Owner/database/event/indexer/index topology. No enforced publication, event-version, removal or read-after-publish contract. Media processing is one explicit variant. |
| `pending-order-payment` | Narrow fixed-price checkout, with finite-stock scope chosen explicitly | Participants and integration intent only. Pending state, reservation, payment outcomes, callbacks, compensation and reconciliation need implementation contracts. |

Each record declares applicability, roles, required relationships, variants/tradeoffs, an
invariant/failure checklist, primary-source URLs, represented topology and precise unsupported
obligations. Checklist and obligation IDs are stable within a pattern; identify a requirement
with its pattern ID and record version. They are reference material, not automatically applicable
findings about every design.

`listStudioPatterns({})` returns the bounded index and catalog version.
`describeStudioPattern({id})` accepts exactly one of those four IDs and returns the complete
record with its support limitations. Unknown IDs and extra arguments are refused. Both tools are
read-only and appear in the chat activity list. They use the existing Workspace dispatch and
ChatService tool-result loop.

Chat is instructed to retrieve relevant records before building or substantially restructuring
a design, select the scope that applies, and keep unresolved obligations explicit. A trivial
rename need not retrieve patterns. For upload/processing/publication it should retrieve both
the job and publication records. This is model guidance, not a server-enforced retrieval gate
or a deterministic architecture reviewer.

Three records contain executable **topology-only** command examples starting from an empty
design. Their commands use the existing catalog defaults and link rules and are checked with
`buildStudioCommand` and `applyOperations`. The payment record instead gives a conceptual
obligation sequence because its outcome returns to the same order owner. Chat must not turn
unsupported callbacks into extra independent services to satisfy lane rules. No example changes
the current ownership model, graph restrictions or saved studies.

Keep these separate: **reviewed guidance**, **represented design intent**, **template availability**
and **runtime verification**. All records report `templateAvailability: none` and
`runtimeVerification: none`. Prose, settings and command validation do not implement domain
behavior. Scripted-provider transcripts prove tool transport, topology validation and atomic
chat edits; they do not measure live-model architecture quality or verify a generated runtime.

The catalog follows the [reliable-foundations review](plans/reliable-foundations/review.md):
database/outbox intent shares only one database transaction; jobs can execute more than once;
processing success differs from committed publication; index ordering does not resolve replica
or negative-cache races; finite stock needs concurrency/expiry/recovery rules; redirect-response
cache hits may bypass analytics. Each record links the relevant primary references. Changes to
guidance or support must update its version and be reviewed against those distinctions.
