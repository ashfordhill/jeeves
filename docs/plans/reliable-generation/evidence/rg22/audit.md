# Composition contract audit

RG22 uses the existing installed resolver, normal command builder and emitter attestations. It
adds no analysis model, settings family, review screen, provider, capability or runtime service.
The pure assembler remains useful for diagnostics of readable partial source. Actual preview,
download and CLI exports apply `generationExportBlockers`; the CLI now does so before any
filesystem destination operation. Known absent implementations and application hooks remain
explicit custom gaps according to that same existing function.

## Independently expected authoring/export table

The input table is [rg-composition/design.ts](../../../../../field-projects/generator-system/fixtures/rg-composition/design.ts).
Expected outcomes are constants written independently of the resolver. The
[real surface test](../../../../../jeeves/apps/server/src/chat/composition-parity.test.ts) sends
the real supported mouse-equivalent command, actual Workspace chat tool, actual PGlite-backed
preview/download routes and a child process running the real CLI for every row. Accepted
downloads use the preview's actual archive hash. Refused CLI rows create no destination.

| Case | Expected outcome on all surfaces | Mechanism / declared gap |
| --- | --- | --- |
| Versioned in-process cache read | Partial scaffold exported | Installed `cache-reader.read@1`, finite version/validity contract; loader is custom |
| Immutable-positive in-process cache read | Partial scaffold exported | Installed immutable cache; immutability is a product promise, not diagram certification |
| Internal HTTP cache reader | Refused | No installed workload-authenticated template adapter; use in-process behind an authenticated route |
| Matching Browser session/user/workload, label rename | Partial scaffold exported | Declared HTTP route-stub target, separate user/workload verification; HTTPS/client registration remains integration work |
| Disconnect caller workload | Refused | Both processes need the same installed workload Identity |
| Remove caller user mechanism from Required-user call | Refused | Workload authority cannot substitute for required end-user authority |
| Disable complete scheduled lifecycle | Refused | Service/Worker task needs generated Runnable processes |
| Fixed retry override on stub Service link | Refused | Generated adapter owns budgets/recovery; no consumer for arbitrary link retry |

A separate real chat batch first renames a tile, then attempts a refused edit: both workspace
source and pending operations remain unchanged. Chat also refuses hidden retry, retention,
secret and Advanced fields. Imported incompatible source remains schema-readable; label-only
edits preserve semantics, removal can shift source array indexes without causing a false refusal,
and a supported repair succeeds. Another test adds a new end-user requirement at an already
refused link, proving that matching source address alone does not hide a changed requirement.
The command check operates on a disposable result before returning operations; it compares
existing blockers by stable addressed source IDs and requirement, not array index alone.
An invalid setting no longer prevents the resolver's remaining diagnostic passes: it still
returns `model:undefined`, so no renderer receives invalid source. This exposes pre-existing
missing callable/policy requirements before a repair, without treating them as introduced by
the repair. For the first module command on legacy source, the comparison baseline uses the
same existing module upgrade/derivation on unchanged source. Old unsupported transport intent
revealed by that upgrade stays visible; a new incompatible link/setting still refuses. The
original process-setting repair, TinyURL add/connect and sign-in-pattern success assertions
remain unchanged and pass in [focused repair checks](repair-targeted.txt). Additional malformed
typed-setting diagnostics and original legacy workflows pass [41 checks](legacy-diagnostics.txt).

## All named requirements and their actual boundary

[Mechanism audit](mechanism-audit.txt) executes 80 focused existing/new behavioral cases;
[caller/recovery audit](caller-recovery-audit.txt) executes five selected real generated-protocol
cases (20 unrelated cases intentionally skipped). These are offline controlled SQL/HTTP tests,
not native multi-process failure certification.

| Requirement | What is checked / where | Concrete observable evidence |
| --- | --- | --- |
| Incompatible effects | Exact installed callable effects in resolver; runtime read/policy/local scopes enforce captured handles | Raw mismatched cache callable refuses; callable auth/input/output/effect tests; local mutation captured same/other DB/network test; callee GET refuses command before dispatch |
| Cross-database local atomicity | Opaque handwritten local/durable declaration and scoped command binding, not a diagram setting for arbitrary code | `local-operation.test.ts` refuses captured same/other databases and nested network reads; `durable-work.test.ts` rejects cross-database claims before acquisition and rolls back product effect/completion together |
| Missing/foreign ownership | Existing ownership/resolver checks plus separate compiled product/framework credentials and grants | `generation-resolver.test.ts` insufficient/wrong grants; `logical-ownership.test.ts` conflicting owner/connection atomic refusal, foreign private read refusal, actual precise API/Worker/read grants with no DDL |
| User/workload caller authority | Shared resolver requires compatible Identity/callee; runtime verifies independent workload claims/audience/allowlist and preserves required-user guards | Missing-workload/user table rows; actual dedicated signed workload claims versus user tokens; private callee has no anonymous/user-only alias; ticketed generated protocol refuses required-user and unopted targets |
| Invalid callable contracts | Exact ID/version/input/output/effect and installed emitted adapter; standalone source operation must exist | `callable.test.ts` unavailable/incompatible adapter and output refusals; raw changed-effect test; source/template-part links remain unavailable rather than getting a fabricated handle |
| Replay/receipt horizon | Handwritten declarations validate finite retention/horizon before setup; generated fixed receipts consume finite normal horizon | Receipt retention below total delivery/retry/quarantine/operator horizon refuses; immutable store-time deadlines survive shorter config; quarantine identity preserves one effect within horizon; local retained replay expiry/cleanup and durable expired ticket protocol are exercised |
| Immutable/versioned cache assumptions | Both finite supported modes consumed by emitter; hook supplies version/expiry/eligibility, and product must choose truthful mode | Both accepted table rows remain custom; actual slow-old-fill/equal-version conflict/absolute validity/waiter authorization cases; both modes require LRU and raw shared admission store refuses |
| Unsafe external retry | Unsupported stub-link overrides now reach resolver, not only normal field allowlist; runtime generic mutation retries remain unavailable | Retry table row refuses CLI before writes; `never retries POST...` actual transport test; durable work rejects arbitrary integration declarations and actual ticket protocol never replaces a selected expired/missing ticket |
| Incomplete lifecycle | Complete installed task/session/webhook selections require Runnable processes; runtime owns startup/drain/independent maintenance | Scheduled off table row; generic receipt startup/grants refusal and idle cleanup/heartbeat; durable lifecycle stop/drain/reclaim without live user bearer |
| Unwritten custom hooks | Report/gaps distinguish scaffold support from application completion; checker does not evaluate product semantics | Every accepted table export has `applicationComplete:false` and required gaps. Fresh default export passes checker/TS while explicitly remaining partial |

No normal control was added. Fixture-wide normal-control checks require a useful user decision,
finite alternatives and an actual emitted consumer path. Raw schema fields do not become controls;
unsupported legacy intent stays readable. There is no Advanced section. Product SQL/routes/policy
stay application-owned. Runtime-declaration requirements above are deliberately not invented as
normal inspector/chat fields, nor inferred from an unwritten hook body.

## Mounts, names and extension packet

[Mount tests](../../../../../jeeves-generator/src/v2/composition-parity.test.ts) rename every tile
and module in foundations (cache/admission), sessions/workload forwarding, schedules, receipts
and webhook fixtures. Process/module IDs, selected bindings, environment names, route method/path,
loop queue/module, call targets and emitted paths stay identical. Display explanation prose is
allowed to follow labels. Existing callable Favorites tests independently verify typed callable
mounting and stable namespaces; calls add no duplicate HTTP endpoint.

Manifest/report/capability records and the actual checker report API8. The blueprint continues to
project saved design intent; it does not acquire an invented runtime certification field.
The [actual scratch runner](compile.ts) installs the emitted exact dependency/lock assets offline,
passes the real checker and real pinned TypeScript7.0.2, and compiles both retained API8 dynamic
string calls and additive named-operation/composite-response code. A legal `async` DTO property
compiles; actual async shared policy and private runtime import refuse. The source checker also
tests legal identifiers/methods named `async`, strings/comments and explicit async function/arrow/
method refusals. It remains a cooperative misuse check, with runtime guards for actual callbacks.

The generated application-writing packet now starts with allowed ownership/hook/import forms,
effect table, accepted/refused contextual code, explicit migration steps and limits, followed by
existing detailed installed mechanism reference. Project documentation no longer claims API6 or
that the checked public boundary is merely future work. No actual hook body is rewritten and no
breaking public hook signature is introduced; API8 and its explicit migration guard remain.

The off-pins [review](pins-reviewed.txt) confirms the same80/87/60 payload paths. Only the guide,
checker and manifest hash/size metadata change. Runtime, public APIs, package pins, credentials,
applied migrations and frozen v1 are unchanged by this unit.
