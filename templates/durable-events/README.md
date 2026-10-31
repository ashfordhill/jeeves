# Durable events · attachment 0.1.0

Add **Durable events** to **HTTP service 0.2.0**, connect that service to PostgreSQL, then use **Configure durable events**. The worker runs inside each service process. HTTP service 0.1.0 remains available and does not accept this capability. The released QR Studio recipe remains pinned to its original service version.

Choose Standard (5 attempts, 1s initial/60s maximum backoff, 30s lease, 10s cooperative deadline, 500ms idle polling) or Responsive (3 attempts, 250ms initial/5s maximum backoff, 15s lease, 5s deadline, 250ms polling). Retry jitter is deterministic, 75–125%, capped at the maximum. Each queued delivery stores its policy; changing the preset affects new deliveries only. Known transient PostgreSQL/connection/Docker DNS failures disable worker readiness and retry after one second; a successful claim/idle cycle restores it. Unexpected failures keep the worker unready until restart. Shutdown aborts and awaits its single in-flight handler.

Each event declares a stable ID, type, version, required payload fields, domain notes and fixed acceptance references. Fields are bounded text, integer, boolean or enum; unknown payload fields are rejected. There are at most 20 events and 20 fields per event, with the runtime's additional 64KiB JSON limit. Once generated, retain every published event identity and payload contract. Append a new event ID/version to evolve it. Attachment/store movement or removal requires a separately reviewed data and ownership migration; this version provides no automatic migration for those changes.

Generated ownership:

- `src/delivery/contracts.ts`: pure validators, typed payloads and event definitions.
- `src/delivery/adapter.ts`: typed producer, migration journal, policy, worker lifecycle/readiness and handler registry.
- `event-migrations/0001.sql`: immutable P21 schema. A separate `jeeves_event_schema_v1` checksum journal and transaction/advisory lock preserve normal Drizzle/resource migration numbering. Applied mismatches stop startup.
- `vendor/jeeves/jeeves-durable-events-0.1.0.tgz`: copied from the [P21 release](../../artifacts/durable-events/0.1.0/manifest.json), SHA-256 `b0658fce9fbb692e317c54ded4c9b4fff3d4eb3c66b5d4b550947f67f60776fd`. Generation/verification protect its bytes and production dependency binding; it is never repacked.
- `src/event-handlers/<event-id>.ts`: project-owned scaffold, preserved on regeneration. Its initial handler fails permanently rather than claiming to perform an unspecified effect. Fixed handler tasks are seeded even when notes are blank; the generated delivery machinery is outside their implementation paths.

A trusted producer supplies the tenant from its authenticated domain context. Its business command and enqueue share the same component-owned transaction:

```ts
import { delivery } from "./jeeves.generated.ts";

const result = await delivery.transaction(tenantId, async (tx) => {
  // Authorize and apply an idempotent business command with parameterized DML here.
  return tx.emit("order-placed", commandId, { orderId, quantity });
});
// result: { id, created }; equivalent enqueue identity returns the original id.
```

Enqueue deduplication does not make arbitrary business mutations idempotent. The project still owns producer authorization, command idempotency and domain effects. A handler uses `context.effect(tx => ...)` for a database effect and durable receipt in one transaction. External effects need destination idempotency using `context.id`; they remain at-least-once. Cancellation is cooperative. An ignoring handler can block its worker and be redelivered after lease expiry. No ordering, fan-out, replay/retention UI, network transport, detached worker fleet, cloud deployment or capacity guarantee is supplied.

Fixed suites use explicit behavior IDs `event:<attachment-id>:<event-id>` in the existing `operationIds` registration field. These identify event handlers, not HTTP routes. Every event acceptance reference needs a fixed suite before planning. Baseline reports deferred handler acceptance visibly; per-task and terminal verification require the declared behavior. The disposable Orders fixture exposes proof-only routes; this attachment adds no public management/producer endpoint.

Run `pnpm work run generated-events` for the small generated non-QR consumer: installation/types, normal Postgres/service checks, database interruption recovery, graceful shutdown, transactional enqueue/equivalent key, one committed inventory effect, application/database restart persistence and regeneration. `pnpm work run durable-events` is the separate lower-level P21 conformance profile. These are focused evidence, not exhaustive certification.
