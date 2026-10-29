# Dropshipping storefront (prototype project brief)

Status: stub for the user to fill in. Not part of the Jeeves v1 build. Repository: `~/github/dropshipping` (existing; Cloudflare Workers/D1/R2/Workflows). Its own `.docs/GOAL.md` and `.docs/BUILD_PLAN.md` remain the detailed source.

## To fill in

- Should Jeeves design a new storefront or describe the existing repo?
- Must-have journeys for a first version
- Elements you expect on the board

## Notes carried over from the earlier plan

These were written during architecture planning. They are background, not decisions.

### Dropshipping: durable workflows and reusable adapters

The local contract describes a multi-brand storefront with guest checkout, catalog data, Stripe-hosted payment, vendor routing, an order state machine, operator tasks, sourcing, notifications, and an admin UI. Brand identity is configuration. Customer accounts are explicitly outside its launch scope, so a generic user-management service must not be forced into this reference. Sources: [frozen goal](../../../dropshipping/.docs/GOAL.md), [build plan](../../../dropshipping/.docs/BUILD_PLAN.md).

Current code and the handoff show the baseline scaffold is present. `src/db/schema.ts` contains no application tables; `OrderWorkflow.run` is a stub. The extensive product plan and future test scenarios are specifications, not completed reusable implementations. Sources: [schema entry](../../../dropshipping/src/db/schema.ts), [workflow stub](../../../dropshipping/src/worker/workflows/order-workflow.ts), [handoff](../../../dropshipping/.docs/handoff.md).

Candidate reusable units are a brand/configuration module, catalog module, hosted-checkout integration, signed/idempotent webhook handler, durable order process, provider-adapter interface, human-task inbox, notification adapter, asset store, and scenario simulator. The existing project deliberately deploys several of these together in a Worker; logical Slices must support that packaging.

The first meaningful workflow fixture should cover one demo brand and product, fake/test payment, exactly one order despite duplicate payment events, a mock or assisted vendor, operator confirmation, shipment update, and the customer status page. Add a timeout branch that creates an operator task and resumes from a recorded action. Use fake time and simulated external events so multi-day scenarios remain fast and deterministic. Preserve real business data outside public examples and fixtures, as required by the repository.

The project's planned `VendorAdapter` conformance suite is a direct model for strict-but-additive templates: a new vendor implements a stable interface and passes shared behavior checks, while the order workflow stays stable. Provider-specific behavior and failure modes still get their own tests. Jeeves's orchestration engine and the generated application's order-workflow runtime are separate responsibilities; using Temporal for Jeeves does not change the storefront's Cloudflare Workflow contract.
