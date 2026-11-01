# QRWTY target architecture

P56 refreshes this **separate editable planned SaaS study**. It never opens or changes the
live QRWTY repository, project, saved design or QR Studio recipe. Existing saved P43/P45
studies remain lossless and editable; newly created targets use the expanded model.
[Evidence](../evidence/p56/README.md) records actual authoring checks, separately from intent.

## Assemble and inspect

For a complete independent example, open **Library → Architecture examples → Create qrwty
target architecture**. For the staged exercise, create an empty project, open **Library →
Build a study step by step**, select **QRWTY**, and review/apply each stage:

1. Four logical blocks: management API, public redirect, background worker and primary data.
2. Tenant workspace and access, with shared scoped data and independent authorization intent.
3. A named visit channel and explicitly best-effort analytics delivery.
4. Signed billing callbacks, durable deduplication and entitlement ownership.
5. Public lookup with authoritative source fallback and bounded change/disable propagation.
6. Product responsibilities, exact contracts, datasets, policies, six scenario families,
   consequential decisions and illustrative hosted placement.

Each preview exposes boundaries/responsibilities, contract fields, policies, decisions and
scenario outcomes before an atomic save. Cancel changes nothing. Each stage is one semantic
undo step; chat commits the supplied stages in one turn/undo step. Every result remains editable
through ordinary C1/C2/C3, contract/binding, dataset, review, deployment and scenario inspectors.
Concurrent edits retain the old preview and require reopening it. No automatic retry overwrites
concurrent work. The stage builder is [architecture-proofs.ts](../../packages/spec/src/architecture-proofs.ts).

Chat discovers `listArchitectureStudies`, then previews/applies a supplied study stage with
`previewArchitectureStudyStage` / `applyArchitectureStudyStage`, `product: qrwty`, the listed
stage identity and `getDesign.patternBaseRevision`. These call the same operation builder and
validators as the mouse workshop. [Scripted journeys](../../fixtures/chat/e2e-script.json) use
no paid model calls. `getArchitectureReview` exposes real semantic findings and expectation
fingerprints; an assistant's prose cannot fill missing fields or dismiss a selected conflict.

## Small baseline and optional growth

The thirteen logical blocks are owner and staff web clients, management API, separately scaled
public redirect, background worker, relational authority, derived lookup cache, named visit
channel, artwork/export object storage, and external payment, e-mail, DNS/certificate and API-key
integration boundaries. Managed hosting does not change their C4 level. A broker hosts the named
channel in deployment; it is not an extra application. The hosted placement explains application,
data/broker and TLS operation responsibilities without choosing production capacity or a region.

Analytics initially uses relational data. Analytical storage and private delivery are explicit
optional growth decisions, absent from the baseline topology. No Kubernetes, infrastructure per
QR content type, multi-region or enterprise runtime is inferred. Numerical policies below are
**illustrative examples**, not production workload, SLO, recovery or scalability evidence.

**Management**, **Public redirect** and **Analytics** focus the same C2 identities and retain
navigation to hidden relationships. C3 scopes one host. The management API's cohesive modules
cover tenant membership/access, billing adapter/policy/entitlements, stable links, encoded payloads,
hosted landing content, artwork, custom domains, abuse, audit and reporting/data lifecycle. Owner
features cover Library/creation, Studio/payload editing, Analytics/exports and team/billing/domain
settings. Staff has its own audited support boundary. No client routing or widgets are generated.

## Trace the six scenario families

Select a saved scenario in C2 **Editor actions**. Its main path and named alternatives reference
real relationships and exact bindings; outcomes link requirements and decisions. For C3 detail,
follow the binding's provided/required interface to its owner, then inspect that component and
the same C2 boundary. Several operations share one C2 arrow without losing their C3 ownership.

| Family | Identity path and important outcomes |
| --- | --- |
| Create/edit link, artwork or hosted content | `member` → `library` / `studio` → `manage`, `payload-binding`, `content-binding`, `artwork-binding` → `records`, `payloads`, `content`, `artwork` → their exact authority datasets. Printed URL is stable; encoded payload and page/artwork versions remain distinct. Static printed payload changes require reprint. `lookup-change` reaches `lookup-updates` and its authority/invalidation bindings. |
| Follow QR during cache/queue failure | `visitor` → `lookup-lookup` → `lookup-read-cache-binding`, `lookup-read-source-binding`; `delivery-publish-work-binding` reaches the named visit channel. Cache miss/failure falls back to authority; disabled/unknown/source failure fails closed. Channel failure can return Location without persisted analytics acknowledgement. Browser follows the destination; service never fetches it. |
| Invite/restrict a member or use an API key | `members` → `tenant-workspace` / `tenant-access`; `developer` → `api-key` → `records`. `worker-access`, `export-access` and `aggregate-export` retain principal/tenant and data scope through background work and downloads. Revocation denies the next authorization check and cancels revoked jobs. |
| Duplicate billing webhook / downgrade | `payment-provider` → `billing-receive-callback-binding` → `billing-adapter` → `billing-billing` → `billing-entitlements`. Persist/deduplicate provider event and tenant before acknowledgement/side effects. Duplicates acknowledge accepted work; reconcile out-of-order versions. Downgrade blocks new paid features/exports while preserving safe existing printed links/content; abuse/domain revocation overrides grace. |
| Domain attach/transfer/removal and abuse | `domains-binding` → `domains` → external `dns-binding`, authority and `domain-change`; staff enters `abuse-binding` → `abuse`, audit and `abuse-change`. Ownership/TLS precede routing; transfer revokes old tenant first, removal fails closed and paths remain stable. Abuse shutdown has bounded monitored propagation. |
| Analytics query/export/delete and recovery | `reports` → `reporting`, `aggregate-query`; `export-job` → `export-jobs`, `export-access`, `aggregate-export` and expiring objects. Named delete/recovery alternatives persist tombstones, cancel downloads and reapply deletion before restored reads. Operations owns restoration/reconciliation; product owner must approve production objectives. |

## Policies and remaining decisions

The illustrative cache attempt is 25 ms with source fallback; source reads fail closed within
250 ms. Update/disable propagation and maximum stale lookup age are 15 seconds. Monotonic
revisions prevent an older update restoring a disabled destination. Authenticated mutations
commit authority before acknowledgement and retry failed propagation within the selected bound.

Best-effort visit publication has a 25 ms attempt, no persisted-ack prerequisite, and a 60-second
loss window. Beyond that window, visits circuit-break until recovery; redirects can continue and
analytics exposes gaps. Lost visits are never invented during recovery. A visit means an accepted
public resolution attempt, not a unique human or confirmed destination page view. Billing has
at-least-once durable acceptance and tenant/provider-event deduplication; its guarantees are
separate from analytics delivery.

Datasets identify exact versions, authority, authorized readers/writers, tenant scope, retention,
deletion and export policy. Illustrative reporting retention is 90 days, export objects 7 days
and redacted security audit 365 days. Restore reapplies deletion tombstones before access.
The **production-objectives** decision remains **Unresolved**, with product owner/operations
ownership and blocked production sizing/recovery scope. The recovery objective has a measurement
boundary but no invented production value/unit/window. Contract specializations use explicit v2
shapes and migrated consumers; referenced v1 shapes are not rewritten.

Architecture review remains incomplete for the assigned production decisions. A scenario starts
**Needs review**; agreeing to expectations is a separate authored action, never a test result.
Contradictory selected tenant, cache-failure or visit-loss policies fail review and cannot be
waived by accepting a decision. Structural dangling contracts fail the whole edit. A legitimate
availability/loss tradeoff remains visible with its consequence.

## Reuse and limits

The same pinned tenant and asynchronous delivery patterns form the five-block
[Inventory study](inventory-architecture.md), which selects durable transactional-outbox stock
work instead of the public redirect's best-effort visits. Portable selections can be saved to
[P55's local library](../architecture-library.md) at the composition stages before product-specific
v2 specialization and broader scenario coupling. Required hosts must already supply matching exact
interfaces/guarantees. Reuse never follows family/name alone. Published content/version provenance
stays historical; independent consumer edits and contract migration do not upgrade the source.

The whole C3 management topology is an overview; use mouse zoom, selection and inspectors for
individual contracts. Focused view membership follows existing layout pruning when referenced
objects are removed/undone; semantic redo does not reconstruct pruned layout membership. Existing
view editing restores a desired focus independently of semantic history.

This study supplies no runtime, executable template, generation filter, generated application,
load/security certification, provisioning, production capacity claim or live QRWTY adoption.
P57's portable implementation brief and diagram export remain a separate package.
