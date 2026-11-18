# Receipt and delivery contract

Event counter declares `deliveryHorizonSeconds` (1–604800; default604800). Its immutable retention
promise is seven days after the database-time receipt completion update. The horizon bounds the
**total original delivery, retries, quarantine/operator delay and subsequent delivery together**.
It is not renewed on retry/requeue. Generic scoped consumers declare both horizon and retention
(1–2592000 seconds); generation/runtime refuse insufficient retention. The validated declaration
is snapshotted. Each receipt persists `retain_until`, so later shorter configuration cannot erase
an earlier promise. Event-provided dates/timestamps never choose retention.

Counter identity is `(its private receipt table, event-counter-v2, eventId)`. Aggregate/date is
content, not identity scope; a changed date that changes the aggregation destination conflicts.
Pure identity mapping may discard only timestamps/data irrelevant to the effect. Generic identity
is `(database, logical owner, consumer-v1, compiled module, messageId)`. Its mapper must return that
same message ID. Canonical mapped DTO content is compared; changing meaningful content yields
`RECEIPT_IDENTITY_CONFLICT`. Display renames do not rename these compiled identities.

The receipt, registered local product effect, command drain, result, expiry and durable progress
update commit together before ACK. COMMIT uncertainty remains unknown. Redelivery finds a
committed receipt without repeating the effect. The actual transaction retains its delivery slot
through final COMMIT/ROLLBACK/release even after caller timeout. Existing RG15 final database-time
lease/fence checks remain unchanged; receipt-local SQL transactions do not add a competing lease
framework. Hooks receive bounded immutable DTOs and registered commands under precise product-only
credentials, with no SQL/client/transaction/ACK/lease/network authority. Mapper accessors and async
returns refuse; async rejection is observed. This is a cooperative extension boundary, not a
hostile-code sandbox.

A standalone Event consumer can connect optional writable owned state and export
`receiptConsumer = defineReceiptConsumer<Dependencies>({database:"items",deliveryHorizonSeconds:86400,
retentionSeconds:604800,map,complete})` through API8. The existing generated loop invokes that
opaque declaration instead of its legacy entry. `map(input,messageId)` returns exact `{id,payload}`;
`complete(event,commands)` invokes same-database registered product commands. Register product SQL
in `products.json` and append application migrations as usual. A missing declaration retains the
legacy void loop, whose durable progress is unknown and whose requeue command refuses. A route or
missing writable-state declaration refuses startup. Required receipt schema/grants are checked
before subscription/readiness.

Append-only053 installs generic protected receipt/progress tables only for databases written by
eligible delivery-loop stubs; counter101 upgrades its existing tables. Existing100/052 bytes remain
unchanged. Counter101 refuses duplicate legacy event IDs across aggregates with
`COUNTER_LEGACY_DUPLICATE_ID_REQUIRES_RECONCILIATION`; reconcile original receipts and product totals
explicitly before migration. Unique legacy IDs move to the stable scope and completed rows receive
a conservative fresh seven-day migration window. Old exports, product bodies and frozen templates
are not rewritten. Generic receipt-library calls without lifecycle opt-in keep their prior permanent
receipts rather than acquiring an undocumented cleanup policy.

Independent lifecycle maintenance sweeps at startup and every15s, deleting at most100 expired
completed receipts with an indexed `retain_until` path and `FOR UPDATE SKIP LOCKED`. Active/incomplete
receipts and all in-horizon receipts remain. Per-receipt deadlines govern mixed-policy sweeps.
An indexed EXISTS query records observed cleanup backlog (boolean), removed batch size and database
last-success time. A failed sweep leaves the earlier observation intact; a fixed batch makes no
throughput/ingestion-capacity promise. Generic cleanup covers the shared consumer receipt store in
that database and is labeled `database-consumer-receipts`.

Each compiled consumer records its worker ID, consumer ID, heartbeat, transactionally committed
last durable progress, in-flight count, latest processing state and available broker backlog.
Unsupported broker depth stays null/unknown. Idle live workers heartbeat without progressing;
a heartbeat older than45s is stale even after a quick last event. Status reads at most100 workers
plus a truncation sentinel, using indexed consumer/heartbeat queries. Bounded maintenance removes
observations older than one day; missing observations explicitly remain unknown. These records
are current observations, not worker history/audit. A maintenance failure log carries only its fixed
classification, compiled operation ID and generated correlation ID.

Internal operations run under the existing process credentials and add no public administration
service. For a counter:

- `node dist/operations/<process>-<counter-module>-receipts.js status`
- `node dist/operations/<process>-<counter-module>-receipts.js requeue <head-message-id>`

For a generic receipt-backed loop:

- `node dist/operations/<process>-<module>-receipt-status.js`
- `node dist/operations/<process>-<module>-requeue-<queue-index>.js <head-message-id>`

Generic status uses the compiled declaration's existing precise framework login and read-only
bounded queries. It filters workers by compiled consumer ID, labels shared cleanup separately, and
creates **no heartbeat**, so an operator read cannot make a stopped worker look live. Requeue reads
one head-of-quarantine message and requires its exact expected original ID. It preserves original
bytes/ID/properties, resets retry metadata, confirms destination persistence before source ACK,
then closes transport. Missing receipt support, wrong source/head/identity, `OUTCOME_UNKNOWN` and
`RECEIPT_IDENTITY_CONFLICT` refuse; reconcile those cases explicitly. Broker metadata cannot prove
original age reliably, so no sender clock is trusted to infer or renew the horizon. Outside the
declared total horizon, cleanup may already have removed identity and an effect may repeat;
reconcile before any out-of-horizon operator action. This is not indefinite safe replay.

Quarantine remains the existing `.failed` queue/topic with original body/identity and a fixed safe
terminal code. Poison input/conflict is terminal; definitely unreachable storage waits without
counting a business attempt; ambiguous COMMIT goes to quarantine as unknown. RabbitMQ uses confirmed
copy-before-ACK. Pub/Sub preserves its native retry/delivery-attempt/nack semantics, copies the
original fallback native ID into `attributes.messageId`, and caps actual pending terminal-copy
publications at consumer concurrency even beyond caller timeout/across generations. Saturation
nacks without another dispatch; shutdown drains admitted handlers and then actual publications,
under the existing final process budget. A late terminal handler during shutdown remains unacked.
The generated Pub/Sub requeue command compiles without RabbitMQ imports and explicitly refuses.
Event counter's installed transport remains self-hosted RabbitMQ: Google Cloud counter composition
reports `NEEDS_TEMPLATE` and export refuses an unsupported local broker contribution. No new cloud
provider, provider certification, exactly-once broker/external-effect claim or public replay API.
