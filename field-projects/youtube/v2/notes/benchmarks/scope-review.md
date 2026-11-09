# Reviewed backend and UI scope for v2

Reviewed in YV2-20 against the final 93-file YouTube export, before baseline/custom commits.
The scope is [`backend-scope.json`](backend-scope.json); use it with the unchanged source-loc-v2
parser/LCS rules in the [method](../../../../../docs/field-projects/source-loc.md). YV2-23 must review
any custom additions and pin the actual generated/completed commits before reporting totals.

- `src/runtime/`: executable HTTP, identity, SQL, outbox/receipts, upload, lifecycle, cache,
  counter, search and media mechanisms; SQL-construction TypeScript counts, SQL files do not.
- `src/features/`: backend resource constructors, media readiness/paths and public search mapping
  logic. Mixed executable/data files remain backend; no exclusion based on provenance or size.
- `src/adapters/`: narrow YouTube metadata/wire/authorization/publication/read/search/count policy.
- `src/services/`: actual backend process composition, startup/readiness and ordered drain.
- `browser/`: the existing custom browser and all its clients/state/pages/presentation. It is
  excluded from numerator and denominator, as is any UI under a future `src/` after explicit review.
  New eligible source outside these declared paths refuses classification; do not silently add UI
  to backend roots. There is no frontend/UI in the frozen generated `src/` tree.

Four exact dedicated data files use the optional `configurationPaths`, excluded from both totals
with the existing `configuration-or-build` reason:

| File | Reviewed contents |
| --- | --- |
| `src/features/application-bindings.ts` | Selected IDs/settings/resource names and relation constants; no executable consumer |
| `src/features/local-bindings.ts` | Exact local SQL login descriptors; no credentials or executable logic |
| `src/features/positive-cache-bindings.ts` | Normalized cache/client names and TTL constants |
| `src/features/search-bindings.ts` | Normalized projection/query client/index/topic constants |

Types, codecs, identity functions, HTTP handlers and resource constructors still count. Infrastructure,
SQL, setup scripts, locks/manifests, docs, generated diagnostics, tests, dependencies and builds remain
outside the existing method. This classification records backend/UI intent, not a numerical claim.
Optional configuration paths extend scope classification only; omitting them produces byte-identical
CLI output to the previous implementation for the historical v1 scope. Historical report content,
parser/version, matching algorithm and v1 files remain unchanged. [Evidence](../../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-20-reuse-and-freeze.md).
