# Stretch experiments after the three core foundations

These are optional future tasks, not part of the 100-point core ledgers. Their purpose is to expose
the next meaningful limits of Jeeves. Do not use a stretch label to hide a failed core case.
Start only an explicitly requested work unit. Where a stretch is split, each suffix is a separate
sequential assignment and local commit, using the same handoff/check rules as the main roadmap.

## X1 — GraphQL transport and a bounded Vendure-compatible surface

**Entry:** P110, especially complete REST contracts and shared command authorization. Vendure
documents separate [Shop/Admin GraphQL APIs](https://docs.vendure.io/current/framework/developer-guide/overview).

- **X1a:** model GraphQL query/mutation bindings, nullable/error-union mapping and schema version
  references for a small fixed subset: catalog query, cart command, order query. No business logic
  duplication; bind to the existing command/query interfaces. Validate unsupported graph shapes.
- **X1b:** implement one pinned maintained GraphQL adapter, authorization/error mapping, bounded
  complexity/pagination and request-scoped data loading. A resolver cannot bypass the shared policy.
- **X1c:** run the same domain acceptance through REST and GraphQL, compare observed state/errors,
  and document the exact compatible subset. Introspection alone does not prove semantic compatibility.

**Exit:** the bounded surface is verified, N+1/query-cost behavior measured, and differences from
upstream remain explicit. Full Vendure API/plugin compatibility is a separate decision.

## X2 — Medusa-style durable compensating workflows

**Entry:** P110, proven payment unknown/reconciliation behavior. Study the existing pinned Medusa
workflow references and [error/compensation model](https://docs.medusajs.com/learn/fundamentals/workflows/errors).

- **X2a:** persist a versioned two-step workflow with exact step inputs/results, deadlines,
  idempotency and resume semantics. Steps are registered capabilities/hooks, not arbitrary code strings.
- **X2b:** add explicit compensation handlers, their reverse dependency order, bounded retries and
  manual-reconciliation terminal state. A compensation can fail or be irreversible; never label it
  a database rollback or guarantee restoration of all external state.
- **X2c:** prove a reservation + reference payment + fulfillment-request scenario with interruption
  after each durable boundary. Old workflow versions remain executable while instances exist.

**Exit:** restart/duplicate/compensation-failure cases pass and no new mini programming language is
required. Adoption of a maintained workflow library is evaluated before writing another engine.

## X3 — Mastodon-style local social network and realtime delivery

**Entry:** P110. Use Mastodon's [technical overview](https://docs.joinmastodon.org/dev/overview/)
and [scaling guidance](https://docs.joinmastodon.org/admin/scaling/) as references.

- **X3a:** freeze a new local-only ledger for follow/unfollow, posts, visibility, block/mute and
  chronological home timeline. Configure shared access/data/notification capabilities; define
  fan-out-on-write versus read and cursor/rebuild behavior explicitly.
- **X3b:** implement bounded timeline materialization and one realtime transport with authorized
  subscriptions, slow-consumer policy, replay window and authoritative resynchronization. State
  remains readable when live delivery is interrupted. Do not promise lossless streams without storage.
- **X3c:** prove block/revocation during queued fan-out and active subscription, duplicate/reordered
  delivery, two instances and representative high-fan-out accounts. Report measured limits.

**Exit:** a substantial local social backend, explicitly not complete Mastodon. Recommendation ML,
federation and visual client behavior are excluded from this ledger.

## X4 — Bounded ActivityPub federation

**Entry:** X3 and an explicitly approved interoperability scope. Read the current official
[Mastodon ActivityPub specification](https://docs.joinmastodon.org/spec/activitypub/) and pin it.

- **X4a:** define a minimal actor/discovery/inbox/outbox contract and supported activity set. Resolve
  identity, key/signature verification, object authority and deletion semantics with source evidence.
- **X4b:** implement one adapter for that set with replay/deduplication, delivery retry, per-remote
  budgets and explicit unavailable/unknown remote outcomes. Remote data and fetched URLs are untrusted;
  bound bytes/redirects/time and protect private network addresses in server-side fetching.
- **X4c:** prove interoperability against controlled peer fixtures and one pinned test deployment,
  including forged activities, remote downtime, blocking and delete/update reordering.

**Exit:** verified interoperability for the declared subset only. This is a separate protocol project;
do not fold it into a quick 'Twitter clone' or reuse a local-only 60% claim for a federated system.

## X5 — GitLab-informed deployment and capacity study

**Entry:** P107/P110 measured local results. GitLab supplies detailed
[architecture](https://docs.gitlab.com/development/architecture/) and
[reference deployments](https://docs.gitlab.com/administration/reference_architectures/).

- **X5a:** map one chosen reference deployment into Jeeves logical identities and deployment views,
  including worker/storage roles, availability assumptions and stated workload boundaries. Keep
  source capacities distinct from the measured capacities of Jeeves components.
- **X5b:** extend workload/deployment configuration only for a demonstrated missing decision,
  such as connection budgets, queue placement, read replicas or recovery objectives. Review stale
  read behavior and failure consequences rather than just drawing replicas.
- **X5c:** if separately requested, implement one deployable target adapter and a disposable proof.
  Provisioning credentials, external spend and production promotion require their own scope.

**Exit:** an accurate enterprise deployment study and, only if executed, measured target evidence.
Reimplementing Git storage, CI runners and the complete GitLab product is not included.

## X6 — External search/cache implementations

**Entry:** P107 identifies a measured reason to change the initial PostgreSQL implementation.

- **X6a:** specify one alternative adapter's supported queries, consistency, revocation, rebuild,
  outage and migration contract. Choose the technology from actual workload evidence and current
  primary documentation; do not add both a cache and search engine speculatively.
- **X6b:** implement the adapter behind the existing responsibility, with exact template/version
  choice and safe source fallback or explicit unavailability.
- **X6c:** rerun the same privacy, deletion, cursor and failure observations plus comparative load.
  Cache hits and stale index documents never confer authorization.

**Exit:** a measurable benefit with known costs and unchanged domain contracts; no unsupported
availability/consistency option silently falls back to a weaker implementation.

## X7 — ERPNext/Frappe-style enterprise workflow slice

**Entry:** P110, proven generic entities/permissions/rules/deadlines. Read Frappe's
[architecture](https://docs.frappe.io/framework/user/en/basics/architecture) and
[DocType model](https://frappe.io/framework/doctype).

- **X7a:** freeze a procurement request -> approval -> purchase receipt ledger, roles, separation of
  duties, quantities and amendment history. Keep financial accounting/tax/inventory valuation outside
  the stated slice; do not claim this is 60% of an entire ERP.
- **X7b:** compose existing data/policy/lifecycle/calendar/inventory capabilities and identify genuine
  missing approval/amendment mechanisms. Implement one reusable gap at a time with narrow acceptance.
- **X7c:** prove delegated approval, requester self-approval rejection, concurrent receipt, partial
  quantity and amended document behavior with an independent thin-client consumer.

**Exit:** evidence that the library can support another enterprise domain without an ERP-specific
copy of its compiler or a generic arbitrary scripting escape hatch.

## X8 — Bounded contract import and upstream parity expansion

**Entry:** P110 and one requested upstream contract subset. Existing partial contract types and
exact-version rules remain the authority; an importer is not a business-logic extractor.

- **X8a:** offline OpenAPI import for a declared supported subset, with file/size/reference limits,
  unresolved diagnostics, provenance and a preview. No automatic remote `$ref` fetching or execution
  of content found in descriptions. Preserve unsupported shapes as unresolved, never text coercions.
- **X8b:** insert exact definitions through validated operations and compare version changes/consumer
  impact. No implicit replacement of an implemented contract or saved project.
- **X8c:** choose a small upstream compatibility expansion, freeze its behavior ledger, and implement
  the necessary adapters/hooks. Count newly verified behavior separately from the original benchmark.

**Exit:** imported contracts save work while keeping unsupported semantics and adaptations visible.
Successful schema import does not prove domain invariants, authorization, migration compatibility
or full product replication.
