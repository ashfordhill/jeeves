# Backend composition and maintenance

These are small mechanism mappings, not completed products or a new full
QRWTY A/B benchmark. Correctness and maintenance evidence are separate from source percentage.

## Counting method and reviewed scope

Each report uses the **unchanged source-loc-v2** parser/LCS rules from
[the method](../../../../field-projects/source-loc.md). The baseline is an actual untouched current
public export; the completed snapshot is that scratch application's handwritten mapping at the
checkpoint. Each is represented by real Git blob/tree/commit objects in a disposable **bare object
database with zero refs, branches or worktrees**. These are export snapshot commits, not Jeeves
source commits. No commit is added to the primary repository for measurement.

The gzip input bundle preserves exact baseline/completed text and manifests. The report embeds
the snapshot commit IDs, baseline manifest hash, reviewed scope and scope-content hash. Recount:

```sh
pnpm --silent --filter @jeeves/generator exec tsx integration/rg24-recount.ts \
  /absolute/path/to/<fixture>-source-loc-inputs.json.gz
```

The reporter verifies every eligible baseline file against the actual generated manifest.
Physical nonblank source lines retain strings/regex/template literals and strip parsed comments.
Within a same-named file, ordered matching lines are retained template credit; new/replaced lines
are post-template. Imports/types/braces/throwing stubs count. Coincidentally matching authored hook
lines may count retained, so a second inventory reports the physical code in every handwritten
TypeScript attachment. SQL/declarations/manual setup are additional work, never hidden in this ratio.

Reviewed scope for **each** report is committed beside it: backendPaths=[src], uiPaths=[browser,
public]. All present src files were reviewed as server/runtime/public contracts or backend hook
code. Browser session files implement server-side OIDC/cookie handling; they are not UI code.
No frontend/UI exists under src in these fixtures. The explicit UI exclusions win everywhere.
Dependency/build/test/config/declaration exclusions remain the existing method's exclusions.
Link's deliberately failing/slow backend probe routes are counted, and make this an artificial
mechanism fixture rather than a product percentage forecast.

TLS/CA generation, Keycloak registration, fault/protocol proxies and administrative native probes
are **test infrastructure**, outside application src and excluded. They are required for these
local proof runs, not product implementation credit. Update shadows under .jeeves/generated are
metadata copies, never loaded as application source, and are omitted from both snapshot trees.
SQL/migrations remain outside backend source LOC and are listed separately, as are product JSON
registrations, lifecycle commands and manual migration actions. No generated source was bulked up
or manually patched for a percentage target.

## Actual counts

| Scratch application | Backend files | Untouched baseline | Retained template | Post-template | Removed/replaced | Final backend | Template share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| In-place migrated hook | 22 | 2,257 | 2,252 | 4 | 5 | 2,256 | 99.82% |
| Cold migrated catalog | 39 | 5,794 | 5,772 | 25 | 22 | 5,797 | 99.57% |
| Link/account | 66 | 7,572 | 7,509 | 132 | 63 | 7,641 | 98.27% |
| Catalog/event | 49 | 6,495 | 6,474 | 98 | 21 | 6,572 | 98.51% |

Reports/scopes and exact recount input bundles:

- [In-place hook report](native-4/1-rg-regeneration/in-place-hook-source-loc.json),
  [scope](native-4/1-rg-regeneration/in-place-hook-backend-scope.json),
  [inputs](native-4/1-rg-regeneration/in-place-hook-source-loc-inputs.json.gz).
- [Cold catalog report](native-2/2-rg-regeneration/migrated-catalog-source-loc.json),
  [scope](native-2/2-rg-regeneration/migrated-catalog-backend-scope.json),
  [inputs](native-2/2-rg-regeneration/migrated-catalog-source-loc-inputs.json.gz).
- [Link/account report](native-3/2-rg-link-flow/link-account-source-loc.json),
  [scope](native-3/2-rg-link-flow/link-account-backend-scope.json),
  [inputs](native-3/2-rg-link-flow/link-account-source-loc-inputs.json.gz).
- [Catalog/event report](native-4/2-rg-catalog-flow/catalog-event-source-loc.json),
  [scope](native-4/2-rg-catalog-flow/catalog-event-backend-scope.json),
  [inputs](native-4/2-rg-catalog-flow/catalog-event-source-loc-inputs.json.gz).

[Reviewed scopes and exact omitted shadow paths](reviewed-scope-and-shadow-exclusions.json)
connect every non-runtime omission to its hash in the full determinism receipt. No application
runtime source is omitted. [All four exact recounts](recount-verification.json) reproduce the original reports, snapshot
commit IDs and provenance using the unchanged reporter.

| Application-owned inventory (SQL/JSON outside source ratio) | Physical TypeScript code | SQL files / nonblank non-line-comment lines | Product JSON registrations |
| --- | ---: | ---: | ---: |
| In-place hook | 1 file / 6 lines | 0 / 0 | 0 |
| Cold migrated catalog | 2 files / 36 lines | 3 / 4 | 1 |
| Link/account | 11 files / 162 lines | 6 / 9 | 1 |
| Catalog/event | 6 files / 112 lines | 6 / 8 | 2 |

“Physical TypeScript” counts the entire handwritten file using the same parser, including lines
that mechanically match the generated stub. It is an alternate view of that source, not an extra
term to add to final LOC. The per-fixture `*-manual-sql.json` receipts list SQL paths/hashes and
registered declarations; [manual inventory](manual-work-inventory.json) supplies the cold hook
count and separately labels this checkpoint's **974 new test-infrastructure source lines**, plus
one existing harness export. Those test tools, TLS/proxy/issuer setup and this evidence are
excluded from every application backend count; their substantial proof effort is not a claim of
zero engineering cost. SQL counts exclude blank and -- comment-only lines; all measured files
were reviewed to have no multiline SQL comments requiring a different rule.

## Maintenance touchpoints

| Concrete change | Handwritten product touchpoints | Other work | Handwritten coordination/recovery | Manual generated-file edits |
| --- | --- | --- | --- | --- |
| Link admission key becomes account-prefixed | One policy hook | Public build/start | 0 | 0 |
| Rate limiter limit2→3 | 0 hooks/SQL | One supported diagram control; check/update/build/start | 0 | 0 |
| Catalog title strips outer spaces | One shared DTO/validation function | Public build/start | 0 | 0 |
| Webhook maximum body65536→1024 | 0 hooks/SQL | One supported diagram control; check/update/build/start | 0 | 0 |
| Label-only rename | 0 hook bodies/data migrations | Display labels in diagram; public update | 0 | 0 |
| Stable module identity change | None automatically | Guarded refusal; drain/reconcile/data migration remains explicit outside updater | Not performed/claimed | 0 |
| Legacy catalog cold adoption | Two manually migrated hooks; one product declaration; three SQL files | One precise-grant diagram declaration; fresh export and install/build/check; no live database conversion | 0 new runtime loops | 0 |

“0 coordination/recovery” means the application change introduces no lease/ACK/retry/commit/session
refresh algorithm, protected-table SQL or raw network client in a product hook. It does not mean
zero work: identity/ownership/policy choices, DTO validation, registered SQL, native issuer/client
integration and manual migration review are real obligations. Generated output may replace several
files for one control edit; the author edits the diagram once and the public updater writes them.
The link limit edit replaces5 generated files and the catalog body-limit edit replaces5,
including provenance/model/report payloads; the author performs zero direct generated-file edits.
The recorded UpdateResult names keep/replace/orphan/refusal actions; exact application-owned bytes
are compared independently. Runtime retention/replay remains finite and cannot be inferred forever.

## Named A gaps and B lessons

The pinned references are the preserved
[Codex evaluation](../../../../../.docs/readme/v0/qrwty/evaluations/codex-2026-11-16.md) and
[Fable evaluation](../../../../../.docs/readme/v0/qrwty/evaluations/fable-2026-11-16.md), A at0647e4a
and B atf2fb3ce. This is a comparison of demonstrated mechanisms and maintenance surfaces, not new
measurements of A/B, a rebuilt QRWTY application or a claim that their old LOC forecast was achieved.

| Named lesson | Demonstrated reuse/maintenance evidence | Precise limit |
| --- | --- | --- |
| AG-31/32; Fable C1/C2; Codex N4; B atomic admission | RG24 changes one diagram limit and one pure key policy; generated admission changes behavior. RG23 foundation evidence supplies the existing two-copy/fail-closed fault proof | No per-copy fallback, IP grouping or product quota/entitlement policy is added |
| AG-18; Fable C3/C4; Codex N8; B replay before dependencies | Link hooks use defineLocalOperation and scoped commands. RG23 proves replay before unavailable admission, sealed committed replay and lost-COMMIT recovery | RG24 does not rerun those failure groups or claim arbitrary POST/provider replay |
| AG-11/12/24/35; Codex ownership/migration recommendation; B named grants/migrations | Catalog API/Projector product SQL uses one logical owner and scoped declarations. Cold legacy adoption exposes the actual namespace/grant migration cost instead of masking it | No automatic live m_*→p_* conversion; framework migrations050–055 and Counter100/101 remain unchanged |
| AG-22; Fable C7; Codex P1/N1; A refresh race and B expired-cookie lesson | RG24 retains a real stored session row and its expiry promises through update; cookie remains usable. RG23 separately proves concurrent refresh and temporary/unknown/definitive outcomes | No generic proxy, provider-user deletion or arbitrary bearer forwarding; unknown rotation may need sign-in |
| AG-33; Fable C11; Codex N2/N11; B durable deletion/progress | Accepted public catalog work retains its stable work ID/chosen ticket across stopped update; recovery uses generated protocol rather than handwritten retry/lease code | Only the installed generated-operation recovery target; no erasure saga, arbitrary provider exactly-once claim or deployment scheduler |
| AG-29/30; Fable C10; Codex N10; B commit/ACK and idle cleanup | Existing catalog hooks map DTO/SQL only. Accepted RG23 receipt proof covers commit-before-ACK, redelivery, finite idle retention and stale/live heartbeat | Receipt failures are not rerun in RG24; no Pub/Sub requeue, retention-forever or QRWTY freshness gate claim |
| AG-34; Fable C5/C11 | A supported finite body-limit control changes generated HTTP behavior with unchanged product hook bytes | Generic HMAC only. The allowlist tops out at65536; A's requested256KiB/Stripe integration is not claimed solved |
| AG-25/26/27; Fable C6/C8; B lifecycle/deadline semantics | Same generated lifecycle rebuild/start and preserved runtime identities; no hook setup/close/ACK/commit authority | RG23 supplies failure/shutdown evidence. No additional exhaustive native matrix here |

External cloud credentials, Web Risk/Stripe provider packs, URL/IP/CSV primitives, entitlement
policy, account erasure and deployment are outside this checkpoint. Missing functionality cannot
be counted as removal of existing A handwritten code. The small-fixture percentages are high
because reusable runtime code dominates; they do not establish labor hours saved, a generic app
being60% generated, or a full product needing only these hooks.

The tested maintenance workflow coordinates a stopped application: one diagram control edit,
`pnpm stop`, public `update:v2 --check`, public update, `pnpm build`, then public `pnpm start`.
The final start also rebuilds its native image and rechecks unchanged migrations. This is five
operator commands around the edit, plus the smoke observations, not zero operational coordination.
Link runs separate API/Gateway/Browser/owner-Worker roles; catalog runs Caller/Callee/Projector.
All relevant old copies must stop before resuming the selected new configuration. Replica counts,
rolling mixed-version certification and deployment provisioning are outside the proof. The two
extra identical update applications are determinism checks, not mandatory product-change work.
