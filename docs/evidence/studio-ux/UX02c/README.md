# UX02c — copy, portable preservation and read-only legacy adaptation

Completed UX02c only on primary `main`, from `2d8b0f965f0675c8572acac603ed449f20348ec4`.
No new catalog definitions, projected C2/C3 graph, new authoring UI, runtime, provider execution,
application generation, historical example repair or resumed P73/backend work.

`mapStudioModel` and `mapStudioSettings` remap graph references while retaining exact definition
refs and seed origin. The existing reusable Library extraction/preview/apply path now handles
packages, their members/owned resources, connection settings, frontend serving, CDN origins and
Redirect lookup selections. Package IDs join fragment/collision enumeration and decision links.
Required studio dependencies use explicit ID mappings, exact definition/settings compatibility and
the destination resource's existing owner. A missing mapping prevents insertion, even when there
is only one candidate. Destination seed provenance is retained. C4b source decisions retain their
source descriptions and their reserved identity prefix through repeated copies.

`exportStudioProject` / `importStudioProject` provide strict, lossless full design/layout exchange.
They preserve backend contracts/configuration, annotations, old layouts and optional studio data.
This is separate from the existing bounded implementation-review handoff. That handoff now retains
studio settings and design-only coverage, plus optional typed `studioSources` (at most one).
Static local source resolution checks the exact example version and canonical manifest SHA-256;
missing/version-mismatched/hash-mismatched sources stay explicit and are never fetched or replaced.
Resolved portable imports verify their manifest identity/hash. The immutable example registry is
empty until the later example assignments register their reviewed manifests. Source paths are
relative documentation references, including possible sibling-source references, never read inputs.

Studio scope/node layout keys prune only removed identities; old focused/deployment views remain
supported. Target workspace copies retain their existing identity-preserving baseline contract and
now report studio edits in their comparisons. Disjoint identities apply to reusable insertion into
a graph, not to those intentionally comparable project targets.

`legacyStudioDisplay` is a pure adapter with an explicit table of known legacy capability/template
IDs. It exposes canonical names/descriptions, context action text, existing relationship values and
references to summarized components. It supplies no provider/language/policy settings or guessed
transport/channel roles. Unknown families retain their real name and a generic symbol. New studio
bindings are excluded from legacy element adaptation. No read conversion/defaulting operation is
introduced. Later projection/UI units consume these helpers; the current surface remains intact.

New unresolved `studio-c4b-` source decisions retain historical links when linked objects disappear;
implementation review becomes Stale. Other legacy/backend reference validation remains unchanged.
Package links and owned resources participate in review-reference lookup/freshness. Existing raw
factory/source declarations and frozen benchmark meanings stay intact.

Evidence:

- [Model observations](model-observations.json) exercise two copies of a real two-service package,
  package-owned shared queue/cache/database, Redirect lookup selections, bundled frontend and CDN.
  Each copy has 13 disjoint board/package IDs; all architecture IDs are separately remapped too.
  One explicitly reused API retains its ID. A separate single-worker composition reuses one existing
  shared queue with its destination owner, proving no duplicate resource or ownership adoption.
  Missing mappings and mismatched exact definitions reject. Source inputs remain unchanged.
- [Public copy input](copy-source.json) contains all 14 settings kinds, including managed/Docker
  execution, independent languages, providers, optional queue/cache/concurrency values and connection
  timeout/retry/channel roles. Full export/reimport preserves every field alongside the rich Discourse
  backend fixture and synthetic old note/focused view. The ~4 MB exchange is observed by exact hashes
  instead of committing a duplicate backend export. Handoff studio/backend/source data also match.
  Missing exact source/version, wrong hash and tampered resolved manifest are exercised explicitly.
- [Compatibility observations](compatibility-observations.json) prove all nine old factories emit
  their UX01 design/layout hashes. A legacy v1 portable round-trip remains v1 with studio absent.
  An unknown `9.9.9` studio definition survives round-trip and remains unsupported.
- [API observations](api-observations.json) prove owned target copy/reload preserves full studio,
  seed origin, old annotation and layouts; target settings edits appear in its comparison without
  changing the source. Two layout-only saves preserve semantic values/revisions/hashes, including
  studio absence on a legacy design. Handoff export reports the missing source explicitly.
  All three owned projects were [deleted and confirmed missing](api-cleanup.json).
- [Browser observations](browser-observations.json) cover existing QRWTY C2/API-C3 at 1440×900 and
  1280×800. Four directly inspected screenshots retain 16/22 cards and 21/39 labels. Existing saved
  cameras extend content outside the viewport, as in UX01. Before creating a page, every non-read
  request was blocked. No write was attempted, and no console warning/error, page error or HTTP error
  occurred. Browser-imported remapping, legacy adaptation and portable exchange work. All 13 existing
  projects retain semantic/layout hashes and revisions. The API inspection independently verifies
  the same project preservation. These are current-shell compatibility checks, not new-UI acceptance.
- [Preservation](preservation.json) confirms all seven UX01 input files, 21 feedback original/copy
  pairs, 48 frozen benchmark files and earlier handoff bytes. Source deltas identify inherited
  changes and this unit's scoped model integrations. No original factory/helper/benchmark or sibling
  application content was changed; `.jeeves-feedback/` remains unrelated/untracked.

Combined UX02 contract evidence consists of [UX02a](../UX02a/README.md)'s strict schema/reference
and malformed-case observations, [UX02b](../UX02b/README.md)'s atomic API/history/cleanup and generation
guard observations, and this unit's copy/exchange/legacy observations. No newly generated runtime
or full studio UI is claimed. Full descriptors are UX03; C2/C3 projection is UX04.

Required checks use Node 24.21.0 / pnpm 12.16.1 with the Node directory prepended to PATH:

| Command | Final result |
| --- | --- |
| `pnpm lint` | Exit 0; unchanged 2,797 warnings / 88 infos, no errors |
| `pnpm typecheck` | Exit 0 across workspaces and scripts, including existing source/test types |
| `pnpm --filter @jeeves/web build` | Exit 0; existing >500 kB chunk-size advisory |
| One-off model/API/compatibility/browser observations | Exit 0 with the bounded results above |
| Scoped formatting / staged Git whitespace / preservation | Passed |

Logs and command results are under `checks/`. No unit/E2E/template suite or `pnpm check` ran, and
no maintained test or snapshot changed. The first lint run needed new evidence JSON formatting.
The package reference enum exposed an existing production review lookup that required a real
package case; it was implemented, then typecheck passed. Early inspection setup corrected fixture
field names/working directory and retried once after the dev server's watch restart briefly refused
connections; no live project or source data changed during those retries. No task scope or product
requirement was weakened. Later catalog/projection/UI/runtime work remains deferred to its unit.
