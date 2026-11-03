# Eight Zammad project-hook contracts

These are independently fixed decisions for Z13–Z20, with [strict schemas](hooks.contracts.json),
[host-trusted examples](hooks.examples.json) and [ordered requests/recovery expectations](fixtures.json).
All eight implementations are **absent/not run**. Reference-mode fixture output is not a production
hook. P73b still owns exact design bindings, repositories/dependencies and scaffold/owned-path briefs.

The host authenticates, builds current authorized snapshots and validates every result before
mutation. A hook cannot mint authority, choose arbitrary SQL/network calls, write a repository,
change internal visibility or bypass a normal command. Pure planners receive only named snapshots;
effectful adapters use the configured source/transport outside SQL. Proposed local changes commit
through existing ticket/customer/publication commands with CAS, canonical receipts and outbox/audit.
Lock multiple tickets in ascending UUID order and recheck every affected membership/visibility.

Default timeout is five seconds, result budget 64 KiB, cooperative cancellation and no partial
commit from a late result. Unavailable/timeout/invalid result returns **503 HOOK_UNAVAILABLE** with
zero domain writes, command receipts and intent for that attempted command. Readiness precedes
mutation. After an external delivery, unknown is explicit and requires same-identity reconciliation;
never treat timeout as rollback. Strict fields are necessary but not sufficient: the host also checks
subset, version, audience, quantity and elapsed-fact invariants. Hook outputs cannot add candidates.
All production defaults fail closed; each seam's fixed reference case still remains not run.

## Z13 — JH-inbound-email

Verified source account, original MIME bytes/hash/reference, stable Message-ID, server-confirmed
sender/thread candidates and bounded inspected attachment candidates → normalized sender, ticket,
plain text and attachment IDs, **public** visibility. Parsing is pure, with no DNS, remote images,
URLs, file paths or database access. Exactly one sender and unambiguous authorized ticket must match;
unknown sender, foreign ticket, unsafe MIME/attachment or ambiguous reference rejects 422. Header
From is a candidate, not authentication. Current normal customer posting policy runs afterward.

The selected `mail-v1` source requires `X-Source-Timestamp` Unix seconds and lowercase hex
`X-Source-Signature`: HMAC-SHA256 of **timestamp + dot + original HTTP JSON bytes** using its configured
source secret, constant-time comparison, absolute timestamp age at most 300 seconds. Decode the
signed envelope's base64 MIME only afterward. No reserialization before signature verification.
Modified, unsigned, wrong-source or stale bytes reject 401 without receipts. Selected fixture-only
secrets/signatures are in [source examples](sources.examples.json); the positive time is exactly
2026-10-30T21:00:00Z. This local source contract is not a certification of an email vendor or SMTP.

Transport permits base64 up to 16000 characters, with a 12000-byte decoded MIME ceiling. MIME depth
at most five, at most five attachments and at most ten parts; only UTF-8 plain text plus text/plain
or image/png attachments with inspected exact size/hash. Aggregate MIME ceiling still applies.
HTML-only, executable/disallowed MIME, malformed base64, oversized decoded data and ambiguous
Message-ID reject. Strip MIME framing/trailing line endings to yield `Email reply` from the committed
[inbound fixture](inbound.eml). Do not render HTML or infer membership from an address/domain.

Normal API transaction uniquely owns `(scope,source,Message-ID)` plus canonical source-input hash,
article/attachment association, audit and intent. Duplicate verified delivery returns the original
201 with one article/receipt. Changed bytes under a committed message identity conflicts 409.
Before local commit, rollback leaves no receipt so the same identity can retry; after response loss,
replay resolves the uncertainty. Retain source receipts seven days, then reject/require operator
review for older reimport rather than promise eternal deduplication. Safe candidates require byte
staging/normal association; external mail acceptance does not prove a completed ticket write.

## Z14 — JH-conversation

Trusted authorized ticket set, both versions, message references, selected article IDs, internal
IDs/provenance and subscribers → explicit attach/create/merge/split plan. Planner is pure. All source
articles retain immutable identity, author, timestamps, visibility and origin-ticket provenance.
A customer never receives an internal article because it moved. Merge/split requires equal customer,
organization and group in this finite policy, supervisor access to both and current versions; other
moves require a separate reviewed policy. Preserve eligible subscriptions only, intersecting current
access. Do not copy article IDs or give target readers broader access to internal text.

The fixed merge moves internal article 202 from ticket 101 to 106, both v1→v2, preserving provenance
101 and subscriber Alice. Both are her own support-group tickets, but article detail remains 404
for her. Ambiguous reference maps to both tickets: attach rejects 422 and requires an explicit
supervisor decision. Foreign sets return 404; stale versions 409. The host locks/rechecks both roots
and commits movement/provenance/subscription decisions/receipt/intent atomically. Precommit fault
leaves versions 1/1, one unmoved article, zero receipts. Retry/replay gives versions 2/2 and exactly
one article/receipt; no intermediate wider visibility. Split creates a new authorized root and
moves selected IDs under the same policy; it does not clone author/history or discard provenance.

## Z15 — JH-sla-extension

Trusted immutable timeline, ticket/CAS, chosen calendar/policy version, elapsed working minutes,
clock kind and explicit action → versioned create/pause/resume/recalculate decision. This is a
pure planner; the host validates deadlines and applies only the authorized new schedule generation.
Core first-response is never silently recalculated or paused. Additional clocks are next-response
and resolution. Resolution starts at creation with 240 business minutes in policy v1; pending
pauses it, resolved satisfies it, explicit reopen creates a new generation with the preserved prior
outcome. Next-response starts with an unsatisfied public customer follow-up, stops on an authorized
public agent reply, and pauses in pending under this selected extension policy.

Pause/resume records immutable facts, not edits to historical timestamps. The example reaches
**105 minutes** elapsed at Monday Nov 2 09:45 CST, pauses, then resumes Tuesday Nov 3 09:45 CST.
Its remaining **135 minutes** end **2026-11-03T18:00:00Z**. Explicit recalculation at 10:15 CST has
**135 elapsed** preserved (30 more since resume), selects calendar v2 10:00–18:00 and policy v2
**300 minutes**, and schedules remaining **165 minutes** to **19:00:00Z**. Decision generations are
1→2→3; no old fact/due record is overwritten. Existing first response is a separate unchanged clock.

Customer recalculation is 403; missing/invalid version or impossible timeline is 422; stale ticket
is 409. Precommit failure leaves old generation and no successful receipt. Same-key recalculation
returns the original decision once, including its old dueAt; it never repeatedly consumes elapsed
time or edits old generations. Cancellation fences old handlers; runtime P88 must recheck the new
state/generation under lock before committing an effect.

## Z16 — JH-customer-connector

Verified `crm-v1` source revision, configured external-ID mapping, local customer/organization/CAS,
field authority and display name → set-display-name, ignore-stale or explicit reconciliation plan.
No arbitrary URL/schema/mapping code or membership/role/email grant is permitted. CRM owns only
`displayName`; role, verified email and organization membership remain local authority. Use the same
original-byte timestamp/HMAC protocol as Z13 with a different configured CRM secret/account.
Cross-organization references return 404; forged/unsigned source returns 401.

Seed is `customer-A`, source revision 10/local v3. Revision 11 sets `Alice CRM` once to local v4;
precommit failure rolls back before the same event resumes. Replay is unchanged. Revision 9 is
stale and performs no write. A controlled concurrent local display-name edit makes local v5;
source revision 12 then creates one `local-edit` reconciliation item, retaining the local value
and last applied revision 11. Retry the same item without applying a second command. An operator
must explicitly choose authority before later revision 13 can apply; no silent last-write-wins.
Keep stable source/revision receipts and reconciliation provenance for seven days, with older
source-history review after expiry. Planning is pure; external pull/ack uses a named connector
outside SQL, while revision advancement and the local patch/receipt/intent are one transaction.

## Z17 — JH-knowledge

Publication request, immutable revision/text, current version and authorized audience → bounded
publication/search plan. Draft, public and agents audiences are distinct. Only administrators may
publish or withdraw; customers/public cannot promote a known draft ID. The pure planner cannot
change revision content or audience without the host's current CAS and audit. Plain text only;
rich rendering is outside this seam. Versioned content has a 20k-character bound.

Knowledge item 901 revision 1 publishes the fixed public guide; public detail/search return that
same revision only. Draft 902 and agents-only 903 are 404 on the explicitly public read surface,
even if the caller has a session. Withdrawal to draft leaves the authoritative record private
before projection refresh. Replay preserves revision/publication identity; rebuild cannot
resurrect withdrawn text. Missing/timeout/invalid hook never creates a public fallback. Storage and
projection changes use durable intent with current audience rechecked on every public read.

## Z18 — JH-custom-workflow

Exact versioned schema, trusted typed values/lifecycle/current ticket, eligible agents and applied
rule identities → finite validated action plan. Schema v1 fixes `severity: low|critical` and
`assetId: ASSET-` plus 1–8 digits; unknown fields/types/executable strings reject 400. No arbitrary
JSON schema/SQL/code or dynamic evaluation. Incompatible schema versions require an explicit new
mapping/migration; they reject 422 rather than coercing old values. Only group writers may invoke.

For open tickets, critical severity proposes set-priority high, low proposes no action; actions are
at most five and use the same reviewed set-priority/eligible-assignment vocabulary as core routing.
The fixture changes ticket 106 v2→v3 with one action/receipt; repeat same key returns it, stale other
key conflicts. The host validates references/permissions, commits once per ticket/version/schema
rule identity and never recursively triggers itself. Bad output cannot grant access or overwrite
immutable fields. Pure hook, transactional host application; cancellation before commit is zero
writes, recovery uses the command receipt, with no second workflow application.

## Z19 — JH-customer-privacy

Subject, self/privacy-admin authority, export/erase intent, authorized public-owned article IDs,
internal/held IDs, delivery candidates and progress → bounded plan with retained reasons. Pure
planner has no bulk-delete ability. Host applies bounded batches (at most 100) with progress/CAS
receipts, current authority and hold rechecks. Customer export is public-owned text only, never
internal notes/attachments or another customer's organization data. Export cannot widen visibility.

Alice's export IDs are 201, 207 and 304; internal 202/303 excluded. Legal-held public 207 remains
retained on erase, while 201/304 are erased and pending disallowed delivery 1003 is cancelled.
Hold metadata is authoritative; callers cannot submit an ignore-hold flag. Internal notes retain
agent/audit policy and are never returned to the customer as retained content. Safe pseudonymous
audit metadata is retained 365 days; erasure removes customer identity from mutable projections
and public text/byte links according to the approved plan. No automatic destruction of holds.

A batch crash resumes plan 951 from its persisted progress to complete v2 without duplicate erase,
receipt or cancellation. Repeated resume is idempotent and returns the same plan, while output
rechecks access. A wrong subject is 403. Retain plan/command receipt identities for seven days;
longer retention requires policy/operator handling, not automatic unlimited reexecution.

## Z20 — JH-reporting

Authorized group set, half-open creation window, immutable timeline version/asOf, calendar-tagged
first-response facts → typed metadata aggregate. Pure planner receives only authorized candidates.
No free SQL, arbitrary group traversal, internal-note text or unbounded window. Supervisor/admin
must have every requested group grant; a foreign group is 404, customer 403. Window at most 31 days;
unknown SQL fields are 400 and out-of-range/reversed windows 422.

`created-cohort-v1` counts distinct tickets created in the window, including later closed/reopened
tickets once. `reopenedCount` counts distinct cohort tickets with at least one resolved→open event
by fixed asOf, not number of reopen events or another creation. First response uses each ticket's
snapshotted calendar, public agent response only, actual business time; pending/internal notes do
not subtract time. Unresponded tickets remain in the cohort but contribute no invented zero to
responded count. Expose sum/count rather than a rounded implicit average.

Window **2026-10-23T00:00Z .. 2026-10-24T00:00Z**, archived timeline v1 at **2026-10-26T15:00Z**, support group:
**13 tickets, 1 reopened ticket** (two reopen events), **3 responded**, sum **90 + 30 + 30 = 150
business minutes**. The foreign scope is excluded. The thirteen archive identities 1501–1513 differ from active
scenario ticket identities 101–114; the retained report timeline is not the active ticket history.
Same inputs/retry/rebuild produce the same result; new facts require a new timeline version/asOf.
Projection freshness is explicit and cannot silently switch a pinned report to current mutable state.
