# Reliable generation: build plan

**Status: RG01–RG26 accepted, through amended RG26 `0ea91d3`.** The
[owner handback](owner-handback.md) gives every unit's revision, actual capabilities, proof and
limits. See the [plan index](../README.md) for current execution status.

Prepared against Jeeves `73266a1`, after the QRWTY A/B evaluations and the owner's follow-up.
This is a Jeeves improvement plan. QRWTY and YouTube supply examples and regression cases;
neither product is being rebuilt or deployed by this plan.


## Owner amendment — 2026-11-16

The owner authorized execution of the reliable-generation sequence; this approved plan supersedes
stale older queues and await-start conditions. Units remain sequential and require acceptance
before the next unit begins.

The owner also approved the exact whitespace-only correction in
`evidence/rg01/fixture.json`, previewed as
`/tmp/jeeves-rg01-fixture-format-preview.{json,diff}`. The original SHA-256 was
`17545fc9b9b78b742c454f750bd6a5972b9325b4235948e3cb4455106401f9d1`; application verified
identical parsed JSON and identical non-whitespace bytes. This exception permits only that
specific historical fixture formatting correction so the existing Biome check can run. All other
protected paths, historical evidence/exports, root files and owner changes remain unchanged.

## Intended result

### Owner amendment — 2026-11-17 (RG15)

The owner approved explicit background application/workload identity ("I see. Yes then") after
the restart-authority gap was explained. RG15 may add explicitly opted-in workload-only generated
operations, a separate workload replay scope and callee-owned expiring recovery tickets.
Required-user guards remain required; callers/audiences remain enforced. No saved user bearer,
account impersonation or new provider/session/delegation framework is authorized. Remote work
identity remains stable across holders/fences. Ticket expiry must refuse mutation reexecution
even after replay cleanup; unresolved outcomes remain unknown. See
[the decision record](evidence/rg15/authority-decision.md).

Independently running, horizontally scalable services assembled from reliable mechanisms.
Generated code owns coordination, transaction completion, acknowledgements, credentials,
recovery and resource lifecycle. Handwritten code supplies product decisions through narrow,
checked interfaces. A common runtime contract means common semantics in each process, not one
application process, shared process memory, or a central runtime service.

The final evidence must demonstrate callable modules, precise ownership, authenticated internal
calls, atomic admission, safe request replay, durable scheduled/webhook work and browser sessions
working together. Generated percentage is secondary to correctness and handwritten maintenance.

## Owner decisions

| ID | Decision | Status |
| --- | --- | --- |
| D1 | One unit per fresh agent, strictly sequential; no parallel implementation or agent-created units. | Confirmed |
| D2 | Independent service/worker processes and horizontal scaling remain fundamental. Replica counts and cloud deployment stay outside Jeeves. | Confirmed |
| D3 | Include foundations, sessions, atomic rate limiting and durable background/webhook processing. Exclude Stripe billing, UI polish and rebuilding QRWTY. | Confirmed in clarification |
| D4 | Preserve saved diagrams and historical evidence. Generated APIs may change through explicit migration; old handwritten hooks need not work unchanged. | Confirmed in clarification |
| D5 | An API and a separate worker may share one logical service's owned data, with precise permissions, while running and scaling independently. | Confirmed in clarification |
| D6 | New generated service-to-service calls require authenticated service identity, including on private networks. Missing identity support is a generation gap. | Confirmed in clarification |
| D7 | Restrict product hooks and tighten composition checks; do not expose unrestricted control of protected runtime mechanisms. | Confirmed |
| D8 | Unimplemented old plans may be abandoned. Documentation cleanup is the last unit. | Confirmed |
| D9 | Extend the existing serializable normalized model; generate TypeScript only. Do not build Go/Rust emitters, a language-neutral programming language, or a new general compiler framework. | Confirmed by owner |
| D10 | Protection targets mistakes by cooperative application authors/agents. No hostile-code sandbox. Enforce public API/import rules, runtime validation and database permissions; do not claim arbitrary Node code is unbreakable. | Confirmed by owner |
| D11 | Code units keep existing Jeeves regression checks. Add focused mechanism tests and three bounded integration checkpoints plus final review. Documentation-only work and reviews with no code changes use focused link/status/evidence checks. No exhaustive combination matrix or full generated-system rerun per unit. | Confirmed by owner |
| D12 | Use generic HMAC webhooks in this plan. Provider-specific signatures/SDKs, including Stripe, wait for a later provider pack. | Confirmed by owner |

The owner approved this packet, including D9–D12 and the contract, and subsequently authorized
execution on 2026-11-16. The original await-start condition is satisfied. Any subsequent owner
change is recorded here before dependent work proceeds.

## Owner amendment — 2026-11-17 (next queue)

Owner commit `95d60ac4b34a70336b246d30949e5f8ce006fb3c` authorizes
[Wires and deployment](../wires-and-deployment/units.md) after RG26 is accepted and committed.
It is the approved next plan, not an inactive old queue. RG26 closes this RG packet only; its
agent does not read WD unit briefs or execute WD work/checks. The coordinator dispatches WD01
after RG26 acceptance. Other unfinished old plans remain inactive unless owner-selected.

## Packet

- [Contract](contract.md): architecture, extension boundary, invariants and finite scope.
- [Execution](execution.md): fresh-agent packet, checks, stopping rules and handoff.
- [Evidence and old-plan disposition](evidence.md): source map and what is replaced/deferred.
- The assigned unit below. An implementer reads only its own unit, not later unit briefs.

## Fixed sequence

Dependencies are all preceding units. The table names the most important inputs; it never permits
parallel execution. A review checkpoint is itself one fresh agent's unit.

| Unit | Outcome | Main inputs |
| --- | --- | --- |
| [RG01](units/rg01.md) | Versioned capability contracts in the existing normalized model; migration refusal | Existing resolver/manifest |
| [RG02](units/rg02.md) | One resource lifecycle and checked extension API per process | RG01 |
| [RG03](units/rg03.md) | Deadlines, cancellation and explicit uncertain outcomes across clients | RG02 |
| [RG04](units/rg04.md) | Consistent HTTP errors, limits, health and request logging | RG03 |
| [RG05](units/rg05.md) | Callable module binding, stable identities and shared contract locations | RG01–04 |
| [RG06](units/rg06.md) | Logical ownership and precise grants for APIs, workers and readers | RG01, RG05 |
| [RG07](units/rg07.md) | Versioned product migrations and declared SQL boundaries | RG06 |
| [RG08](units/rg08.md) | Restricted key-ring, signing and sealed-value mechanisms | RG02 |
| [RG09](units/rg09.md) | Authenticated service calls and per-operation caller allowlists | RG03, RG05, RG08 |
| [RG10](units/rg10.md) | Complete local idempotent operations and safe replay | RG04, RG07–09 |
| [RG11](units/rg11.md) | Atomic cache operations and correct saturation/recovery behavior | RG03 |
| [RG12](units/rg12.md) | Callable distributed rate limiter | RG05, RG11 |
| [RG13](units/rg13.md) | Callable cache reader with explicit freshness and version behavior | RG05, RG11 |
| [RG14](units/rg14.md) | Independent foundation review and two-copy integration checkpoint | RG01–13 |
| [RG15](units/rg15.md) | Durable work records, fenced completion and bounded retries | RG07–10 |
| [RG16](units/rg16.md) | Scheduled tasks in services/workers with explicit owner and lifecycle | RG02, RG06, RG15 |
| [RG17](units/rg17.md) | Verified webhook ingress and durable inbox processing | RG04, RG08, RG15–16 |
| [RG18](units/rg18.md) | Bounded receipt lifecycle and observable consumer progress | RG15–16 |
| [RG19](units/rg19.md) | Browser sign-in, cookie sessions and CSRF | RG04, RG07–09 |
| [RG20](units/rg20.md) | Coordinated refresh, revocation and session failure behavior | RG19 |
| [RG21](units/rg21.md) | Session-aware service forwarding without exposing tokens to product hooks | RG09, RG20 |
| [RG22](units/rg22.md) | Complete composition refusals and mouse/chat/export parity | All mechanisms |
| [RG23](units/rg23.md) | Cross-domain, two-copy failure/recovery proof | RG22 |
| [RG24](units/rg24.md) | Regeneration and hook-migration proof; maintenance measurements | RG23 |
| [RG25](units/rg25.md) | Independent final review and bounded corrections | RG24 |
| [RG26](units/rg26.md) | Documentation cleanup and owner handback | RG25 |

This is a substantial but closed scope of 26 units. RG14 and RG25 may correct defects in the work
they review; they may not introduce new capabilities. A required architectural change outside
this contract returns to the owner, rather than becoming an extra unit automatically.

## Not included

- Go/Rust generation, multiple language runtimes, a runtime package distribution project.
- A general workflow language or Temporal replacement; arbitrary long-running business sagas.
- Stripe subscriptions, QRWTY entitlement policy, link-shortener or dropshipping features.
- Cloud provisioning, autoscaling controls, production deployment, managed-provider certification.
- UI polish, arrow layout or a new diagram-review/certification product.
- A hostile JavaScript sandbox or a proof of correctness for arbitrary custom code.
- Rebuilding or changing either QRWTY repository or old YouTube exports.
- Root-level file edits. In particular, the root README and AGENTS remain owner-maintained/read-only.

## Completion

Every included feature is either implemented with its required composition evidence or explicitly
unavailable; no stub is relabelled as a completed mechanism. The final handback includes the tested
composition matrix, known limits, migration instructions and the before/after maintenance results.
It does not claim that passing these cases proves every future application correct.
