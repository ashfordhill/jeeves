# Public UX inspection inputs

These seven small files cover six acceptance cases from coverage §3. They contain deterministic
synthetic/public data, no credentials, production business data or runtime template registration.
The canonical IDs and raw/semantic before hashes are in the [manifest](../fixture-manifest.json).

| Input | Intended later observation |
| --- | --- |
| single-service.json | One Billing service selects Stripe, no dependencies/empty child graph. Provider is design intent. |
| package.json | API + independent worker (TypeScript and Go independently), one package owner for queue/cache/database. Resource ownership is separate from deployment membership. |
| shared-channel.json | One producer, two consumers, exactly one queue identity/provider/owner; publish/consume roles explicit. |
| shared-data.json | Two applications share one logical database, plus a separately owned database and two independent caches. Shared database ownership is explicit. |
| dense-graph.json | 24 applications, 47 connections, repeated fan-out, a cycle, opposite links, three protocols, long synthetic name. All nodes are visible at C2. |
| legacy-supported.json | Exact public link-shortener design/layout copy with supported legacy templates. No generation run. |
| legacy-rich.json | Compact materialization descriptor for the existing rich Discourse factory, including exact contracts/types/access policies. Append one synthetic note and merge one focused layout; avoid duplicating its 1.6 MB design here. Hashes refer to that exact materialized design/layout. |

The first five fixtures wrap a proposed design.architecture.studio value using the agreed model
contract; **the current strict parser does not accept that property yet**. They are tracked future
inputs, not runnable imports or implementations. UX02a supplies the parser and may correct a fixture
only with an explained evidence delta against its current hash. The fixtureVersion, id and provenance
envelope is evidence metadata; parse design, not this wrapper, as a DesignDocument.

Materialize the rich descriptor with the unchanged architectureExample discourse-core output,
append materialization.annotationAppend to design.annotations, and merge
materialization.layoutArchitectureMerge into layout.architecture. Use the exact source hashes
from the [source manifest](../source-hashes.json), not the mutable name of a live project. The
synthetic note/focused view are additive to the public fixture, never edits to the original factory
or frozen benchmark. Compare SHA-256 of JSON.stringify(design) and JSON.stringify(layout) to
expected before any later compatibility edit. No maintained unit/E2E test suite is introduced.
