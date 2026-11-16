# RG06 — explicit logical ownership and precise database grants

Verified for coordinator acceptance, on accepted RG05
`7e0b02a5a2041c4bb7a93188c1d038c06eb9039d`. Extension API is **v6**.

## Implemented boundary

- Existing ownership records carry explicit worker `sharedWith` API membership, the source
  resource's stable `productNamespace: owner`, and exact `grants[].product` table operations and
  named published-view audiences. There is no second owner system, owner card or deployment UI.
- Worker/process inspector choices and normal chat commands share the same strict schemas and
  builder. `shareOwner {worker, api}` chooses membership explicitly. New multi-writer template
  connections require matching declared owners; a conflict refuses before host/module links or
  source are saved. Saved matching owners remain readable. Unsupported owner reset is disabled.
- `setDatabaseAccess` declares bounded table names with SELECT/INSERT/UPDATE/DELETE and named
  published views. Foreign owners cannot select private product tables or declare mutations.
  The current coarse grant remains a bound for generated template mechanisms; the exact product
  allowlist controls the emitted product ACL. Normal authoring requires a module-authored design,
  matching the implemented Runnable-process boundary. A shared finite API-kind list serves both
  chooser and command validation; provider, missing, queue and worker targets refuse. Historical
  forms/source stay readable.
- Owner-scoped product SQL uses `p_<owner ID>`; every schema exists before module SQL runs.
  Namespace selection persists independently of current permissions. Clearing/regranting access
  retains both namespace and SQL contributors; views-only reader changes retain legacy module
  schemas. Composed names over 63 bytes or collisions with contributed private template schemas
  refuse, including the no-writer case. Labels change no owner/process/module/login identity.
- Generated `products.mjs` revokes previous blanket/default grants, then grants exact ordinary
  tables in the owner namespace and exact views in `published`. Missing/wrong relation kinds
  fail setup. New relations grant nothing by default. Product declarations cannot address
  template implementation schemas; generated template mechanisms retain separate private grants.
- Each process/database retains its own login and secret. No extra login scope or pool-key merger
  was introduced. Application services receive no setup owner secret, CREATE, schema/database
  ownership or migration credential. A write-only product grant does not receive product SELECT
  because its generated idempotency mechanism needs a separate exact internal-table grant.
- The existing updater now compares actual product SQL namespaces, including legacy
  `m_<module>` fallback. Existing namespace removal/replacement refuses at the same API version
  and across API acknowledgement, preserving all target bytes and handwritten SQL. v5→v6 also
  requires staged explicit extension migration. There is no automatic application/data migration.

The fixture is [module-authored source](../../../../../field-projects/generator-system/fixtures/rg-ownership/design.ts)
with application-owned [API SQL](../../../../../field-projects/generator-system/fixtures/rg-ownership/items.sql)
and [worker SQL](../../../../../field-projects/generator-system/fixtures/rg-ownership/worker.sql).
The source contains an API, its explicitly shared worker and an unrelated reader process.

## Actual SQL evidence

[Executed product SQL](permissions.sql) is dispatched by the emitted `scripts/products.mjs`.
[Metadata and 20 outcomes](permissions.json) record the generated database/login/access plan and
PGlite assertions. The capture also applies the actual emitted foundation/idempotency migrations
and exact template grants before product grants.

| Process role | Allowed | Refused |
| --- | --- | --- |
| API `r_links_db__links_api` | INSERT/SELECT on `p_links_api_owner.items` | UPDATE, private template table, CREATE schema/temp/product table |
| Worker `r_links_db__visit_worker` | UPDATE/SELECT on the same table | INSERT, private template table, CREATE schema/temp table, ALTER product table |
| Reader `r_links_db__stats_api` | SELECT on `published.visible_items` | Other/later published views, private product table/read/write, private template table, CREATE schema/temp table |

The focused test executes the actual export's script through PGlite, removes pre-existing
blanket/default/schema-CREATE grants, clears/regrants exact permissions without losing rows,
and checks missing relations. Separate cases cover atomic owner/connection refusal, display
rename, API-only namespace retention, 63-byte refusal, private-schema collisions without writer
files, and actual export-directory migration refusal with unchanged bytes. The named audience
edit test proves a read declaration alone neither relocates a legacy writer nor requires a
namespace migration. [Historical normal-command refusal proof](historical-boundary.txt).

PGlite uses **SET ROLE**, not independent authenticated PostgreSQL connections. Distinct generated
login/secret metadata and exact grants are proved here; real connection authentication/roles and
two-copy behavior remain for RG14. This is not a generated-system checkpoint or provider proof.

## Checks run

All commands used Node **24.21.0**.

| Check | Result |
| --- | --- |
| Final `pnpm check` | Exit 0: Biome, all workspace types, **124 files / 1,117 tests passed**. [Output](check.txt); `/tmp/jeeves-rg06-check-complete.log`. |
| Final focused SQL/migration/chat cases | **40 passed** after the collision correction; included in final full check. A test-only API-target addition then passes **8/8 ownership cases** plus generator typecheck, with runtime source unchanged: [output](api-targets.txt). `/tmp/jeeves-rg06-final-focus.log`. Earlier namespace/fixture group **51 passed**. |
| Full `pnpm test:e2e` | **75 passed / 1 failed**, 5.6 min. TinyURL, RG06 mouse choice/refusal, normal preview/download and both complete v2/v3 mouse rebuilds passed. `/tmp/jeeves-rg06-e2e-final.log`. |
| Targeted browser completion | **2 passed**, 16.7 s: strict historical preset inspector/Undo/Redo/reload plus RG06 owner/table/view/refusal/source/blueprint case. [Output](browser-completion.txt). |
| Web production build | Exit 0 after final UI gate; existing chunk-size warning. `/tmp/jeeves-rg06-build-complete.log`. |
| Scratch exports | Seven exports pass emitted extension checker and TS **7.0.2** offline: ownership **89**, callable **66**, sign-in **80**, search **81**, Favorites **64**, video **116**, stubs **86** files. [Output](emitted-compile.txt). Affected ownership/sign-in/video pass again after final namespace work: [final output](emitted-compile-final.txt). Callable negative type proof still rejects numeric item IDs and mutation of copied results. |
| Processes-off pins | Reviewed **79→79 / 85→85 / 59→59**, no added/removed paths. API header/version, extension guide and normalized/provenance/diagnostic metadata change; module source additionally records explicit ownership choice. [Paths](pins.json). Frozen v1 unchanged. |
| Offline chat evals | Exit 0, network disabled; unchanged scores: good **100/100/100/review 100**, patterns **86.3/98.2/98.2**, bad **1.7/18.5/18.5/review 5**, twelve deterministic replay arms. [Output](offline-evals.txt). No live/paid model call or model-quality claim. |

The first full check failed: fixture setup/import errors caused skipped cases, alongside stale
API-version/count/reference/rendering expectations. The active command fixtures and upload
pattern now make the explicit owner choice; the final full run has no skipped suites. An
intermediate typecheck caught an unused import; a new evidence JSON needed Biome formatting.
Both were corrected, not bypassed. No failed check is counted as a success.

The full browser failure exposed product controls on a historical preset that cannot enable
Runnable processes. Both normal commands and the mouse controls now use that supported boundary;
the original strict historical inspector assertion remains intact and passes. The initial RG06
browser test looked for an inspector-local alert, while the store correctly displayed its
atomic refusal in the global alert. Its final assertion targets that existing alert and proves
unchanged source. No timeout or permission assertion was weakened.

## Preservation and limits

Seven root hashes match `/tmp/jeeves-rg-resume-root-files.json`. The owner's 34,001-byte binary
working diff matches `/tmp/jeeves-rg-owner-diff.patch`, including feedback/Zone.Identifier files
and all three protected mode changes. Scratch exports are removed in `finally`, with installed
dependencies only symlinked read-only; no install or historical export edit occurred.

Before/after Docker inventory is only `c0fbbc2996fe jeeves-postgres-1`, PostgreSQL at
`127.0.0.1:54329`. No task Docker resource, owner studio port, push or deployment was used.
The browser harness used 4301/4311 and `jeeves_e2e`, deleting only its test-created projects.

Product SQL remains application-owned, re-runnable setup SQL. Versioned product migration
execution and public registered SQL handles are not installed; arbitrary setup SQL is not
isolated by these grants or TypeScript. New namespaces require explicit application/data
migration to a fresh export. The generated checked API targets cooperative mistakes, not hostile
JavaScript. No new provider, tenant, audit, cloud or later-unit mechanism was added.
