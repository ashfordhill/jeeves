# Resolved UX direction — 3 November 2026

This records the owner's answers to R01–R07 in [round 1](DECISIONS-ROUND-1.md).
Read it together with the Q01–Q42 trace there. The resulting specification is the
[studio build plan](../../../docs/build-plan-studio-ux.md). Recording a decision or writing that
plan does not implement it or resume the paused backend batch.

## Final answers

| Decision | Owner answer | Binding consequence |
| --- | --- | --- |
| R01: service versus service package | “sure” to the proposed direction, alongside the earlier explicit request for services that can expose a collection of services underneath | Support a single deployable service and a clearly modeled package of deployable services. A package is a grouping, not an extra running service. Scalar settings use the inspector; actual configurable dependencies/children use C3. Do not create empty child diagrams. |
| R02: API/data editing | “No let's not leave it manually editable for now … Anything else … would need to be a C4b … thing” | No route, request/response schema, entity/field, policy, lifecycle or business-rule editors in this studio scope. Fixed template contracts may exist underneath; project-specific additions belong in C4b. Preserve existing stored declarations. |
| R03: queues | “a queue belongs in C3” | Queue/topic objects appear at C3. Preserve one shared logical identity and provider selection. C2 can summarize the associated communication without showing the queue box. |
| R04: depth navigation | Accept the suggestion | One architecture per project, C2 overview, explicit drill into C3, breadcrumb/back. No additional map, Explorer or named views. Zoom changes text density, not structural depth. |
| R05: autosave details | “Do what you think is best” | Use the proposed valid-edit autosave, invalid abandoned draft discard and truthful brief failure behavior. The interaction contract specifies timing, serialization, conflict behavior and undo. |
| R06: movement/connection gestures | “Let's start with your suggestions” | Click inspects, double-click opens children, card drag previews a grid landing position, drop commits layout only. Connector tool clicks its two endpoints. No automatic insertion into a relationship and no object add/connect handles in this version. |
| R07: provider depth | Avoid substantial provider controls or handholding; Cloudflare integration can be left as stubs | Capability first, provider second, a small common technical vocabulary. No cloud-console reproduction, provisioning, account/credential setup wizard or provider-specific infrastructure forms. Record custom integration obligations for C4b. |

The owner wants to field-test the approach against dropshipping, QRWTY and the other examples:
less low-level prompting, more high-level control, and understandable/reproducible foundations.
This is a product outcome to evaluate, not evidence that current templates already achieve it.

## The README's boundary is authoritative

The [README](../../../README.md) and [C4 flow diagram](../../c4-flow.svg) distinguish:

- **C4a:** deterministic template output and a common verification approach for the foundation.
- **C4b:** missing features, extension implementations and integration stubs completed by humans
  or agents after generation.

The new plan stays at design/configuration and truthful availability. It must make this division
legible in Generate without turning the diagram into a code editor. It neither implements C4a
runtimes nor chooses an in-process versus separate generator application. C4a/C4b are Jeeves's
product terminology, not additional levels defined by the C4 standard.

## Engineering consequences, with their limits

Predictable templates are a valid way to reduce the amount of fresh code an agent invents.
The useful boundary is a versioned template with defined inputs, outputs and extension points.
Reproducibility and tests can give confidence in that foundation; neither Docker packaging nor a
template badge establishes correct behavior on its own. The later runtime task must supply the
evidence. Docker's [build guidance](https://docs.docker.com/build/building/best-practices/) supports
reusable build stages, pinned inputs and separating application concerns.

A feature is not automatically a separate microservice. A service is a deployment/ownership
boundary; an internal library, external API, logical queue and database are different things.
Standard [C4 components](https://c4model.com/abstractions/component) are internal to a deployable
container. Jeeves deliberately uses C3 as a configurable detail view that can also open a package
of services. The model must retain that difference even when the canvas stays compact.

Similarly, a [queue](https://c4model.com/abstractions/queues-and-topics) is a channel/resource, not
necessarily another custom service. C3-only visibility is an agreed presentation choice, not a
claim that its broker executes inside the producer. Store ownership describes who owns the data;
several logical stores can share physical infrastructure without sharing private schemas.

The dropshipping [frozen goal](../../../../dropshipping/.docs/GOAL.md) and
[architecture](../../../../dropshipping/.docs/BUILD_PLAN.md) currently specify a single Cloudflare
Worker with D1, R2, Workflows and Stripe-hosted checkout. Its scaffold/handoff do not establish
the full product as implemented. The field-study fixture should faithfully describe that documented
boundary, without rewriting the other repository or silently converting it into Docker microservices.
Docker remains the default for new Jeeves-managed application services. Managed/browser/device
boundaries remain representable. This preserves the documented example rather than inventing a
new product decision about its deployment.

## What remains for a later task

No additional product answer is required to write this UI plan. The following questions are
deliberately outside its implementation scope and must not be answered implicitly by an agent:

- Which C4a runtime/template families and languages should be implemented first?
- What files and extension interfaces form the supported C4a/C4b contract, and how will later
  regeneration preserve C4b changes?
- Will the generator run inside Jeeves or be a separate application/API?
- Which real generated builds and black-box checks will establish reliability and reduced manual
  work? Design coverage alone cannot establish that result.
- What detailed requirements are still missing for the inventory/grocery concept briefs? Those
  remain labeled unknown in coverage, rather than becoming invented business decisions.

Numerical layout thresholds, schema names, the initial finite provider list and package boundaries
in the build plan are explicit implementation choices made to operationalize the accepted direction.
They are reviewable specifications, not claims that the owner individually selected every constant.
Agents may not replace them with unrelated UX preferences or expand the scope without recording
the conflict and asking the owner when it is a product decision.
