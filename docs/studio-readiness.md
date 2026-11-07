# Snapshot compatibility report

The inspector's **Compatibility report**, blueprint v3 `readiness` and chat `readReadiness {}`
all call `designReadiness` over the same design snapshot. Reads never upgrade, save, change Undo
history or mark a staged review complete. The initial chat context carries only statuses, blocker
counts and the composition hash; the read-only tool returns full detail on demand.

| Stage | Status | Meaning |
| --- | --- | --- |
| Design validity | `valid` / `invalid` | Every structural finding from full `validateDesign`, including IDs, C1 references, lanes and finite settings. |
| Exact contracts | `complete` / `incomplete` | Exact profile, schemas, operations, callers, source/owner namespace, permissions, retention and policy declarations cover the whole design. |
| Implementation availability | `available` / `unavailable` | A trusted pinned manifest supports exactly this composition and its template, dependency and concrete auth-verifier bytes resolve with matching hashes. |
| Exact output evidence | `verified` / `none` / `insufficient` | Trusted independently pinned output/receipt and evidence agree on the entire composition and pass the pinned verification policy. |

`generationEligible` requires valid structure, complete contracts and available exact artifacts.
It does not require evidence for an output that cannot exist before first generation. It never
means that output is runtime verified. There is no combined enterprise-readiness status.

**Product availability remains unavailable; product runtime evidence remains none.** Jeeves has
no template, dependency, auth-verifier or evidence registry, generated output, generator, runner
or backend here. Positive paths exercise trust plumbing exclusively with isolated test bytes;
they prove no HTTP, storage, clock, cancellation, concurrency or real-adapter behavior.

Missing exact schemas/policies/retention/bindings/grants are contract gaps. A known verified-user
auth behavior and an unavailable concrete verifier are distinct: verifier availability blocks
the implementation stage. Unknown exact refs stay unresolved, without version substitution.
Required custom obligations and unsupported included/excluded behavior block contracts;
advisory obligations remain visible separately and acquire no implementation.

Whole-design coverage independently rejects extra generic APIs, workers, resources, connections,
entries, context boundaries or modules without finite behavior. Known Create/Resolve bindings do
not bless an extended analytics study. Only traced compatible data-access/cache-reader/redirect-
responder intent can refine these bindings; Create data access needs primary reads within its
10-second total deadline. A trusted manifest cannot override this finite coverage check.

Create needs explicit source **read-write** dependency and role grant for durable retained-result
lookup and unknown-outcome reconciliation as well as writes. Existing write-only declarations
stay unchanged and saveable with a targeted `CONFIG_REQUIRED` gap. Read-only still refuses a
Create write. No permission follows from co-deployment or ownership; frozen Create record bytes
and behavior are unchanged.

## Composition identity

The hash is SHA256 of compact UTF-8 canonical JSON containing domain
`jeeves.tinyurl.composition.v1`. Keys sort by code-unit order, without locale dependence;
identity/set collections sort by complete canonical rows, package member IDs sort, and other
array order remains significant. Blueprint v3 exposes the complete canonical `composition.subject`
alongside its digest, so no hidden input is needed to recompute it.

The subject includes source schema version, all scope obligations, exact resolved local profile
definition digest, the explicitly pinned Create v1 / Resolve v1 / positive-cache v1 record hashes,
all elements/classifications/names/descriptions, connection endpoints/labels/protocol/security,
system/context, studio definitions/settings/providers/engines/languages, modules/links, actions,
entries/packages, ownership/authority/grants/dependencies/deployable assignments and exact
operation/caller bindings. Revision, studio origin provenance and external layout/UI state are
excluded. Source prose supplies no inferred runtime promise, but is included conservatively:
future output could use it in identifiers or documentation. Any meaningful change invalidates
the old exact composition's evidence. Future unrelated catalog additions do not alter this
profile's frozen definition or its explicit contract list.

The immutable first resolved profile record is
[`tinyurl-readiness-profile.json`](../packages/spec/src/tinyurl-readiness-profile.json).
Its fixed digest is independently recomputed in tests. It extends the existing ID/version scope
reference with a content identity; selecting a known profile alone implements nothing.

## Trusted artifact boundary

`TrustedReadinessContext` is a host-only optional input, never design content, a model parameter,
a manifest editor or an upload endpoint. Product callers provide none. A host independently pins
`manifest`, optional `expectedReceipt`, optional `evidence`, and a resolver for exact artifact
content. Every resolved byte sequence is rehashed; missing, malformed, hash-mismatched or
throwing resolution produces targeted blockers. No caller-supplied composition hash is trusted.

- A strict `jeeves.template-manifest.v1` document supports one full canonical composition and
  pins template, dependency and auth-verifier refs. The manifest approves that exact combination,
  not all configurations of reusable templates. Leaf mismatches name `composition.subject`
  paths; these indexes refer to the canonical subject, while validator paths refer to source
  rows and carry independently resolved canonical tile/edge/owner/operation targets.
- An independently pinned `jeeves.generated-receipt.v1` document binds composition, profile,
  manifest, templates, dependencies, verifiers and expected generated-output content refs. It
  also pins the required suite/version, environment image/configuration hashes and acceptance
  window. Output and suite bytes must resolve; a matching self-reported output hash is insufficient.
- Strict `jeeves.runtime-evidence.v1` binds that expected receipt and every exact identity above,
  suite/environment, completion instant and case outcomes. The pinned suite must cover all twelve
  finite profile obligations exactly once. Evidence must include every case once, all passing;
  missing, duplicate, failed or skipped cases refuse. Completion must lie within the trusted
  inclusive window. The report reads no ambient clock: the host's pinned policy defines staleness.

These documents are trust-input formats, not a registry implementation or proof that arbitrary
bytes implement the stated contracts. A future real registry/runner must establish those claims
before supplying trusted receipts and evidence.

SHA256 uses exactly pinned `@noble/hashes` **2.0.1** to preserve the shared synchronous blueprint/
chat/browser boundary. automation-pitch has no direct hash dependency to reuse. The
[official release](https://github.com/paulmillr/noble-hashes/releases/tag/2.0.1) was published
2025-09-22, over two weeks before selection, and supports the project's Node version.
The [release security notes](https://github.com/paulmillr/noble-hashes/blob/2.0.1/README.md#security)
describe an independent audit of version 1.0.0, not an audit of this exact release. No cryptographic
primitive was implemented in Jeeves.
