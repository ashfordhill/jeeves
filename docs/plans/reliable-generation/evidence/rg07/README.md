# RG07 — versioned product migrations and registered SQL

Verified on accepted RG06 `0a059385ad9223b6c69c0acc73d5ce02c6fcd2a1` for coordinator acceptance.
Extension API is **v7**. This unit adds no normal inspector setting, command, provider or ORM.

New Runnable exports emit application-owned `infra/postgres/<database>/products.json`, initial
namespace migrations and query/command SQL scaffolds. Each namespace has one ordered history in
the protected `public.jeeves_product_migrations(namespace, version, sha256)` ledger; modules with
the same namespace share it. The existing cluster/database setup locks and a namespace transaction
lock cover checksum checks and application. Missing/changed applied versions and inserting an old
version refuse. Applied SQL is skipped on restart. Product DDL and ledger writes commit in the
same enclosing setup transaction; failed SQL leaves neither partial DDL nor an applied ledger row.
Fresh exports no longer emit the old re-runnable module SQL files; Preview names the actual initial
migration. Previously handwritten module files remain preserved by the updater.

The setup credential alone administers template state, grants and the ledger. For each product
migration it uses `SET LOCAL ROLE` to a separate **NOLOGIN, NOINHERIT** role with USAGE/CREATE only
on that product namespace. The role cannot read/edit template tables, foreign schemas or the
ledger, and has no CREATE on `published`. Generated code resets the role before writing the
ledger; its object grants to setup permit the later exact ACL changes. It publishes only declared
product-schema source views into `published`. Runtime processes receive neither setup credentials
nor migration-role membership. Bounded lexical checks refuse transaction/role/lifecycle controls
(including `set_config`) and handle ordinary quotes and nested comments. This is a cooperative SQL
mistake check, **not** a complete SQL parser or hostile SQL/JavaScript sandbox. Direct protected DDL
is actually refused by PostgreSQL under the restricted role.

Declarations bound namespaces, versions/files, tables, published source views, module/process
operation names, parameter counts and relation operations. They can only narrow the compiled
owner/grant maximum and actual module/database link access. Reserved/foreign/ungranted targets,
control statements, mismatched placeholders and unsupported declaration fields refuse. Product
SQL remains application-authored; no cross-owner dependency can be introduced by the declaration.

Stub database dependencies expose only `call(registeredName, positionalScalarValues)`. There is
no SQL, pool, commit or rollback handle. Returned rows are copied/frozen. Each process/database
has a separate product-only login/secret; its pool key retains the full credential/configuration
scope and cannot reuse a broader template pool. All product SQL/credentials are prepared before
any process connection or probe. Dispatch applies the existing inherited read/local-mutation
effect boundary: read-to-command escalation refuses before execution. Queries use **BEGIN READ
ONLY** on a reserved connection, so SELECT functions cannot widen their effect. Commands retain
the existing poisoned-transaction, tracked-driver and unknown-COMMIT behavior. Calls are separate
transactions; no multi-call atomicity or public replay API is added. Policy hooks receive no SQL
handle. Template loaders without a registered binding remain explicit gaps.

Old re-runnable SQL is never executed by the new runner. The migration guide requires preserving
and reviewing actual schema/data, writing an explicit versioned baseline, and performing existing
database baselining/data movement externally. Same-namespace update needs the declaration,
migration files and an `external-reviewed` receipt naming every old module file's actual SHA-256;
missing/stale material refuses with existing bytes unchanged, even with API acknowledgement.
The receipt is the application's **manual attestation**, not database migration proof. Namespace
replacement still refuses independently of acknowledgement. Staged checking/TypeScript remain
mandatory; no handwritten bodies are rewritten and no automatic destructive conversion occurs.

The new [fixture](../../../../../field-projects/generator-system/fixtures/rg07/README.md) contains
application-owned declaration and migration inputs plus two API modules, their separately running
shared-owner worker and an unrelated published-view reader. The active RG06 SQL input was migrated
to create source views inside its product namespace; recorded RG06 evidence is unchanged.

[Actual emitted SQL trace](executed.sql) and [18 captured outcomes](database.json) include the
actual exported foundation/idempotency migrations and exact template grants. The template login
can read `jeeves.idempotency_records`; the product login cannot. API insert, shared-owner worker
update and named reader view succeed. Protected template DDL, foreign DDL and ledger mutation
fail at the database boundary; failed statements leave no partial table and only the original
ledger version. Focused tests additionally prove checksum/missing-history refusal, parameter
binding, unknown handle refusal, copied outputs, successful UPDATE SET, inherited-effect refusal,
READ ONLY refusal of a SELECT `setval` write (with sequence privileges deliberately granted to make
the read-only assertion meaningful), literal/comment control handling, no-connect/probe startup
refusal, pool separation/reuse and updater byte preservation.

| Check | Actual result |
| --- | --- |
| [Final `pnpm check`](check.txt) | Node 24.21.0; Biome, workspace type checks, **125 files / 1,122 tests passed**. No skipped suites. Existing `local.mjs` informational style suggestion remains untouched. |
| [Full `pnpm test:e2e`](browser.txt) | **76/76 passed**, 6.6 min. TinyURL renders; revised migration Preview path and ownership controls work by mouse; both complete v2/v3 mouse rebuilds pass. |
| [Web build](build.txt) | Passed; existing chunk-size warning only. |
| [Focused final cases](focused.txt) | **16 passed** for actual SQL and HTTP grant expectations. [Pool-scope test](pool-scope.txt) passes separately and is included in the final full run. |
| [Scratch exports](emitted-compile.txt) | Seven variants pass emitted checker and TS 7.0.2 offline: ownership **93**, callable **74**, sign-in **84**, search **86**, Favorites **72**, video **123**, stubs **91** files. Existing callable negative type proof still refuses invalid IDs/result mutation. |
| [New RG07 fixture](fixture-compile.txt) | Final two-module fixture: **95 files**, checker/TS7 pass. The later empty-process artifact correction changes no payload in the seven nonempty variants above. |
| [Processes-off pins](pins.json) | Reviewed **79→79 / 85→85 / 59→59**; no paths added/removed. API guide/header/version, checker, metadata and the internal optional READ ONLY transaction mode account for changed payloads. Frozen v1 unchanged. |
| [Offline chat evals](offline-evals.txt) | Passed, network disabled, scripted scores unchanged; twelve deterministic replay arms. No paid/live model call. |

Earlier checks exposed stale API/path/credential-list expectations, a missing fake-runtime import,
a missing generated `readSecret` import, and an optional test mount array type. All were corrected.
The lexical scan initially treated ordinary UPDATE SET / ON CONFLICT DO as control statements;
statement-level scanning plus quote/comment handling fixes this without allowing lifecycle controls.
The pool-separation test initially left its fake connection trace for the next suite; test cleanup
now resets it, and the final full run passes. No assertion or timeout was weakened. Successful
browser/build/eval checks were retained; failed regressions received focused diagnosis and reruns.

Seven root-file hashes match `/tmp/jeeves-rg-resume-root-files.json`. The owner's exact **34,001-byte**
binary diff/modes match `/tmp/jeeves-rg-owner-diff.patch`, including feedback/Zone.Identifier files.
Historical evidence, old exports and frozen v1 are untouched. Scratch exports use only read-only
installed-dependency symlinks and are removed in `finally`; no install occurs. Before/after Docker
inventory remains only `c0fbbc2996fe jeeves-postgres-1` at `127.0.0.1:54329`. No task Docker resource,
owner studio port, push, deployment, secret inspection or live QRWTY access was used. Browser
services use 4301/4311 and `jeeves_e2e`, deleting only test-created projects.

PGlite uses explicit role/session authorization, **not authenticated native PostgreSQL connections**.
The locks and ledger behavior are exercised locally, but real simultaneous migrators and native
login/role proof remain **RG14**. This is not a generated-system checkpoint. No later unit began.
