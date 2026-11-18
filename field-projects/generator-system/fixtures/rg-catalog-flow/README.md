# Catalog/event mechanism fixture

The JSON diagram is independently exportable through the ordinary CLI. design.ts records its
construction from existing source helpers; attachments.json lists every handwritten API8 file.
Catalog DTO validation/mapping, registered parameterized SQL and narrow policies supply product
behavior. There is no copied private runtime, frontend, billing or deployment configuration.

Caller is a Service with HMAC ingress and durable replication. Callee is an explicitly opted-in
workload-only generated local operation with its own owned database and expiring recovery tickets.
Projector is a separately runnable Worker sharing Caller's logical owner, with distinct runtime
and product credentials and access only to deliveries. SQL increments an effects column even on
conflict, so a unique primary key cannot conceal repeated business effects.

The task-only network proxy wraps the actual generated recovery protocol and native RabbitMQ.
It can hold a real acceptance COMMIT, a remote response and AMQP Basic.Ack; it supplies no production
provider guarantee. The fresh-context fence observation uses the emitted store, compiled hook,
registered SQL and actual scoped logins, retaining an opaque claim across OS pause. It is separate
from the public HMAC/recovery flow and exposes no test routes or controls to product hooks.

Receipts use a 60-second declared total delivery horizon/retention for this bounded local fixture.
Deduplication is not promised after retention. The sequential rg-mechanisms suite observes the
immutable database deadline, idle maintenance and stopped versus live idle worker state.
