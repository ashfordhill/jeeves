# Regeneration and explicit migration

RG24 changes only checkpoint infrastructure, a new adoption fixture and this
evidence. There is no production runtime/emitter/API/dependency/framework-SQL change.

The live preservation guarantee tested here is a **compatible API8 update with unchanged stable
identities**. The old GS08 catalog design lacks current product grants; adopting its m_* product
schema as an owned p_* schema requires a fresh export and a reviewed external application/data
migration. The updater does not convert that live database. This checkpoint's catalog adoption
is cold, and does not establish that unperformed conversion.

## Reproduce the bounded cases

Use Node24.21.0 and the repository's pinned dependencies. From the repository root, select RG24
only; the original B10 TTL scenario and RG23's broad native mechanisms are not rerun:

```sh
pnpm test:generated --suite=regeneration --test-name='RG24:' \
  --artifacts=/absolute/new-empty-rg24-results
```

The public commands inside every case are:

```sh
pnpm --filter @jeeves/generator export:v2 /absolute/design.json /absolute/new-app
pnpm --filter @jeeves/generator update:v2 /absolute/design.json /absolute/existing-app --check
pnpm --filter @jeeves/generator update:v2 /absolute/design.json /absolute/existing-app
```

Extension migration alone adds `--ack-extension-api=8`; 8 is the extension API version. Actual
application compilation uses pinned **TypeScript7.0.2**, independently recorded in build logs.
Acknowledgement never authorizes namespace changes, bypasses the boundary checker or changes a
hook body. Every refused/dry-run command is surrounded by an exact disk-hash comparison.

## Passing witnesses and retained failures

| Selected case | Passing receipt | Actual observation |
| --- | --- | --- |
| Unchanged-namespace in-place API migration | [native4 tiny](native-4/1-rg-regeneration/migration-preservation.json) | API1 check/apply refuse; acknowledgement still rejects readonly-input mutation; one handwritten repair then acknowledged check/apply succeeds; actual checker/TypeScript7.0.2 pass; two identical updates preserve body |
| Existing E10 catalog cold adoption | [native2 old export](native-2/1-rg-regeneration/old-export-preserved.json), [adoption](native-2/2-rg-regeneration/migration-preservation.json) | Genuine old manifest/SQL retained; SQL/type/checker/namespace refusals enforced; fresh API8 namespace and explicit handwritten adoption compile/check; two identical updates preserve bodies |
| Compatible link/account update | [native3 preservation](native-3/2-rg-link-flow/update-preservation.json) | Exact old rows/xmin, runtime/volumes/hooks and session hash/expiry promises survive; real cookie200; limit2→3 produces [201,201,429]→[201,201,201,429]; labels preserve capabilities and rekey refuses |
| Compatible catalog/event update | [native4 preservation](native-4/2-rg-catalog-flow/update-preservation.json) | Exact accepted pending row and chosen ticket survive before app resumption; original work ID/ticket completes with local1/remote1 effects; body limit65536→1024 changes oversized input401→413 |

[Native4 summary](native-4/summary.json) is2 passed/3 skipped (201.773s including teardown),
not a rerun of the passed cold/link cases. Native2 and native3 overall summaries remain failed
because other selected cases failed in those attempts. Passing per-case receipts above are the
witnesses; no all-skipped result is counted as a pass. Original B10 TTL and the complete RG23
mechanism matrix are deliberately not rerun. RG23's accepted evidence supplies those separate
composition/fault guarantees, not new RG24 observations.

Initial failures are preserved: legacy1 exposed the missing precise grant; native2 exposed a
source-counting attempt to include a non-runtime update shadow and the RPC200/business201 oracle
mistake; native3 exposed a missing async fixture hook and a reused fresh-export scratch path.
The final harness fixes only these test/data-selection issues. It relaxes no production guard,
timeout, retention horizon or product-effect assertion. All run-specific exact cleanup receipts
remain beside the runs.

The tiny hook mutates a query DTO under the real old mutable request interface; that old hook
compiles. In the new API the DTO is readonly, so acknowledgement fails at the actual staged
compiler. Its author changes the hook to read a fallback into a local variable and import the
public API. The acknowledged dry run writes nothing; the acknowledged application installs only
the current generated scaffold and preserves the repaired body byte-for-byte. Separate checker
and TypeScript version logs confirm the result. Existing application-owned package/lock defaults
remain explicitly kept; neither is manually patched. This fixture has no SQL/data identity change,
so it isolates successful API migration from the catalog's genuine namespace limitation.

## Genuine legacy provenance and SQL limit

The harness archives GS08 `d52484597b7fb62d5c3b3bfb629884ab3978255f` from Git objects into its
owned temporary directory. It runs that revision's CLI, resolver/spec and templates, using
third-party dependency links only. Archived `@jeeves/spec` resolution and both archived/pinned
source hashes are recorded. No branch, worktree or primary-checkout mutation is involved.
The archived CLI exports the existing E10 `regeneration/design.json`; its original absent
extension-version field remains absent. Missing metadata means API1 by the implemented rule.

The original two raw-client hooks compile under that genuine export. Public current updates
name both hooks and require a product SQL baseline before writing. Acknowledgement with no SQL
review still refuses. A temporary minimal reviewed declaration allows the staged compiler and
checker to be observed: raw `.query`/Pool bodies fail the new types; adding a driver import to a
migrated body fails the checker. All these failed attempts retain every pre-command byte.
The temporary empty declaration is a refusal probe, never claimed usable product support.

A normal `setDatabaseAccess` declaration supplies the missing finite table grant. That changes
m_catalog_writer to p_catalog_api_owner. Both check/apply refuse this identity/namespace change,
even with acknowledgement, and preserve the genuine old manifest and original legacy SQL.
Explicit cold adoption exports this supported diagram to a **fresh** directory, carries two
manually migrated hook bodies, and supplies registered queries, a product declaration and ordered
migration SQL. Old hooks are not overwritten by the updater. There is one current runtime: all
its generated scaffold/runtime hashes match a separate fresh export. No legacy runtime is copied
into product hooks or retained as a compatibility implementation in the adopted application.

## Current API8 live update scenarios

The RG23 link/account and catalog/event fixture inputs are read-only. The harness exports scratch
copies, applies the listed handwritten mappings, modifies a real product policy, builds, and starts
through the ordinary generated lifecycle. All TLS/issuer/protocol proxies and administrative
observation remain test infrastructure outside the application backend scope.

Link/account changes the supported Rate limiter limit from2 to3. Product rows include a uniquely
seeded retained row absent from startup SQL; real sign-in creates a stored browser session. Before
and after update, the oracle compares database/relation identities, exact row values/xmin and the
session row hash/absolute expiry/idle promise before any application resumes. It checks private
runtime hashes, exact volume identities and every modified handwritten attachment hash. A separate
label rename preserves capabilities. An actual module rekey refuses even with acknowledgement.
Behavior after restart changes from two admitted creates then429 to three then429 on a fresh
real account scope (avoiding reuse of its earlier admission window), while the
old browser cookie still identifies its session.

Catalog changes the supported webhook body limit from65536 to1024. A verified webhook seeds
durable product state. A separate public durable request is accepted202, its generated callee
commits a remote effect, and the task proxy withholds the actual response. Killing only the owned
Caller leaves accepted work with its original chosen recovery ticket. While every application
is stopped, update/dry-run/repeats must preserve the exact work row, database/relation/row identities,
product data, hook bodies, runtime secrets/history and volumes. PostgreSQL alone is started for the
pre-resumption observation. After public start, pending work must finish with its original work ID
and chosen ticket, with local/remote effects each1. The HTTP body limit must change behavior.

Each compatible update is followed by **two actual consecutive public update applications** with
identical input. Both require zero create/replace actions and identical complete disk hashes.

## Verification and boundaries

[Full check](check-final.txt) passes145 files/1353 tests, lint and type checks (113.20s).
[Web build](build-final.txt) passes with its existing chunk-size advisory. [Browser regression](e2e-final.txt) passes87/87 (5.0m), including TinyURL on the lane canvas and
both full mouse rebuilds. [Final preservation](preservation-final.txt),
[inventory](preservation-inventory.json), [cleanup](cleanup-audit.json) and
[artifact scan](safe-artifacts.json) pass. The original42 container triples/9 networks/23 volumes/
43 images and both old e2e projects match exactly; unit-created projects/resources remaining0.
No authoring command/tool description changed, so no new offline chat eval is required.
The real exports run their extension checker and pinned compiler; unfilled hooks remain custom
work even when types/checker pass. No production compatibility runtime or private runtime copied
into product code is introduced. API/Worker lifecycle, auth, receipts, retention and unknown-outcome
guarantees are carried forward unchanged. No cloud/live issuer/Stripe/paid call or deployment occurs.

Own text logs normalize terminal trailing whitespace and blank EOF lines after sanitization;
assertion text, outcomes, errors and measured values are preserved. Binary snapshot payloads are
unchanged. The one rejected shell cleanup command was safely completed using an explicit checked
Python path list; it caused no lost audit or required user approval.
