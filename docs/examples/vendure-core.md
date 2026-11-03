# Vendure core: partial backend design

**P72a is complete; parent P72 is incomplete.** Library → Examples → **Vendure core · partial
backend design** creates an independent editable study. Mattermost remains the default and the
complete Discourse study remains available. No application, runtime, template implementation,
provider adapter or measured acceptance is supplied. All three benchmark applications remain
absent/not run, with zero observed implementation points.

The [exact split](../plans/backend-benchmarks/execution-units.md) assigns P72a boundaries,
contracts, money/data ownership and access. **P72b** owns command/state/transaction/payment/recovery
bindings, eight typed H briefs, five scenarios, focused views/deployment intent and the final
V01–V20 trace. Missing behavior is visible in the partial designation; existing availability gates
remain unchanged. This is not foundation-generation readiness.

## Source and protocol

[P60b](../reference/backend-benchmarks.md#vendure-core-p60b) pins **Vendure v3.3.0** at
`a4c56359ec831b0c54dd01eab14fb75455c43ab7`. Its
[source map](../../benchmarks/vendure-core/v1/source-map.json) distinguishes inspected inspiration
from JV/JH adaptation decisions. No source code, application runtime or license text is copied.
The upstream API is **GraphQL**. The independent [P61c REST/JSON/OpenAPI
pack](../../benchmarks/vendure-core/v1/README.md) is a deliberate functional adaptation;
GraphQL compatibility/parity remains excluded as X1.

[Static authored contracts](../../packages/spec/src/vendure-core-contracts.ts) retain all **42**
frozen HTTP methods/paths, parameter locations, strict request/response/error schemas,
nullable/bounded fields and exact status/header mappings. Catalog and private receipt bytes use
bounded binary bodies. Literal Content-Type mappings must agree exactly with their body descriptor;
Content-Length remains body-owned. No shipping OpenAPI interpreter or fixture import is added.
Provider callbacks have separate provider-to-API interfaces and original-byte authentication
obligations, rather than treating the thin client as their source.

## Boundaries and authority

[The factory](../../packages/spec/src/vendure-core-example.ts) has one modular Commerce API,
an independently runnable Commerce worker and authoritative PostgreSQL. Twenty cohesive C3
responsibilities cover access/sessions, catalog/publication, carts/quotes, inventory/reservations,
orders, payment attempts, fulfillment, history/audit, discovery, policy seams and bounded worker
responsibilities. Tax and shipping share a rate-quote responsibility while retaining separate
contracts and future H14/H15 seams. Endpoints and tables are not C3 components.

Thin client, byte store, notification delivery, payment providers and warehouse source are explicit
external boundaries. The client is outside generated backend scope. SQL delivery channels require
no Redis/search cluster/broker. [Adapter interfaces](../../packages/spec/src/vendure-core-adapters.ts)
record boundaries without asserting network/SQL atomicity or live adapter availability. The V08
reference provider and V19 pinned Stripe protocol remain distinct evidence obligations.

[Data declarations](../../packages/spec/src/vendure-core-data.ts) contain **28 entities/datasets**
and **22 aggregates**. The API is the sole mutable application authority; the worker may execute
explicitly granted modules against the same store. Existing principal/session storage retains
its owner; no app-user/password/session schema is introduced. Every field has a stable physical
storage identity. JSON addresses/return-line snapshots have bounded schemas and opaque query limits.
Foreign keys carry shop scope and exact keys. Snapshot line keys include their root, preserving a
source cart line identity across multiple quote/order representations.

## Exact money and snapshots

| Meaning | Declaration |
| --- | --- |
| Core amount | USD integer minor units, inclusive 0..9007199254740991; required minor/currency fields map to explicit separate storage columns. |
| Cart | At most100 distinct variants; quantity 1..1000. No client price field. Cart CAS covers line edits; quotation leaves its version unchanged. |
| Quote | Append-only five-minute snapshot of cart/version, exact line quantities, address, per-variant price versions, tax/shipping provenance and totals. |
| Fixture arithmetic | Checked integer products/sums before persistence; reject overflow. Tax 750bps half-up on summed merchandise only; shipping 500, untaxed and nonrefundable. |
| Order | One per converted cart; immutable purchased lines/address/price/tax/shipping/total. Lifecycle state/version are separate. Future catalog/rate changes never rewrite completed money. |
| Conversion | H-only immutable rational USD→EUR 92/100, half-even; 1999→1839. Core USD does not silently broaden to converted orders. |
| Refund/payout | Refund ceiling excludes shipping (fixture 6447); seller payout 5397 differs from customer charge 6947. Stable request identities remain inspectable. |

All unit prices bind the exact current variant price version; a maximum/common price version cannot
stand in for a mixed-version vector. A changed catalog price invalidates unconverted quotes and
never alters prior orders. Quote/order policies expose no write projection for immutable commercial
fields; actual append-only writers and expected-version/expiry checks belong to P72b.

Stock separates physical onHand, allocated unshipped units and active/held/consumed reservation
state. Availability is onHand minus active minus held minus allocated. Consumed reservations are
not subtracted twice; shipment decrements onHand and allocated together. Unknown payment keeps
stock held. Data descriptions retain the order/reservation-then-stock locking obligation; P72b
must bind exact local participant sets, race outcomes, durable receipts and recovery.

## Current access and bounded reads

[Access declarations](../../packages/spec/src/vendure-core-access.ts) select live shop membership,
actual persisted roles, owner/staff, current publication and seller attribution. Public registration
never grants shop roles. Body fields, raw headers, cursors and callbacks cannot establish trusted
principal/scope. Policies use default deny, deny-wins, no authority cache and all nine sensitive
recheck sites. Query access applies before matching, snippets, pagination and counts.

Public catalog/search/asset policies exclude private cost/stock. Product-only assets require a null
variant association; variant-associated assets require that exact current published variant under
the same product/shop. Bounded nullable-parent checks never infer permission from a missing parent.
Owner/staff history/receipt/payment access and administrator-only reconciliation/audit are distinct.
Seller policies reveal attributed line/entitlement metadata, without whole customer orders/addresses.
Notification recipients retain compound order-owner and current membership relations; service work
uses a named verified purpose and the persisted recipient, never borrowed initiating-user authority.
Revoked inbox selection yields no eligible rows.

Ten queries use bounded keyset pages (default 25/max 100), complete root unique tie-breakers and
current policies for joined source records. Catalog/search order is product creation time,
product identity, variant identity. Order/history/audit/inbox/shipment pages retain the frozen
creation-or-event-time ordering. Cursors remain validated data bound by the future protocol,
never authorization. Search rebuilds cannot resurrect hidden data.

## Editing, portability and limits

All declarations use the existing component Data/Access/Interfaces editors and Save/Cancel,
revision conflicts, atomic Undo/Redo and reload. Explicit successors preserve referenced exact
contract/policy versions. Full extraction, independent insertion, exact pinned reuse, immutable
handoff/fingerprints/chat JSON Schema and pure compiler lowering preserve the same model, money
storage and exact policy references. Layout does not change semantics.

P72a checks the exact frozen schemas and semantic negatives, direct mouse authoring/export/reuse
and existing offline compatibility. This does not execute money, inventory, transactions,
authorization against real rows, callback cryptography, provider calls or recovery. The synthetic
access preview uses explicitly assumed facts; unknown facts cannot demonstrate permission.
P72b is the next separate assignment. No generated hooks/stubs/migrations, new runtime capability,
source port, benchmark run or capacity claim is included here.

The complete partial-study fragment uses 28 roles and 23 optional extension points. The existing
finite extension-point bound now matches the 32-role bound, including library metadata; 33 rejects.
No saved role identity, earlier fragment or implementation availability changes.
