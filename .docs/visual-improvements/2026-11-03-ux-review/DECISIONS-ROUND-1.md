# Owner answers and remaining decisions — round 1

Recorded after the owner's responses to [Q01–Q42](QUESTIONS.md), following the review at
`1565f85`. **Discussion record, not an implementation plan or permission to resume the backend
batch.** No implementation is performed by recording these decisions.

The owner sent successive messages while composing the answers. The last message continues
Q11–Q42 but does not repeat the complete Q04–Q09 passage from the preceding message. Those
earlier explicit answers remain applicable; omission is not withdrawal. Q10's final wording is
fragmentary, so its intended boundary is recorded provisionally rather than invented.

## Settled direction

- Improve the current UI and meaningful configuration/model capabilities. Do not make repairing
  QRWTY the task or the acceptance driver. Include it and the other examples in the eventual
  coverage review. What “buildable at the template level” demands is narrowed in R02 below.
- Expect users to start with AI and continue prompting, with manual editing when useful.
- Prefer independently deployed microservices and a Docker-oriented product. Support different
  implementation languages; do not make TypeScript the universal application assumption.
- Keep the C1/C2/C3 terminology for now. Kubernetes and Helm are outside this scope. The exact
  boundary of a C2 card and its C3 children still needs R01.
- Billing is one C2 card with relevant C3 configuration, delegating as much work as possible to
  existing external services. Redirect is a service; whether a service card can contain several
  deployable children remains open.
- Reintroduce base creation types through the Excalidraw-like toolbar as well as explicit presets.
  The owner names microservice, connection and database as examples, not an exhaustive palette.
- Default cards show names and icons. Zoom may reveal concise detail; sufficiently distant arrows
  show no labels. Eliminate repeated category captions, distracting box-border status styles and
  unrelated-object fading. Make selection prominent.
- Use compact inspector tabs and extremely concise wording. Do not render empty configuration
  sections or explanatory filler for things the user cannot configure.
- Timeout, retry and similar controls belong in relevant configuration, not on the diagram.
- Use shared connection trunks with branches. Remove repeated database labels and show a
  connection per application/group. Do not make exceptional data behavior a separate visual layer.
- Use suitable autosaving and silently discard abandoned drafts. R05 below distinguishes an
  abandoned invalid draft from a valid edit whose save is still in progress.
- Put consolidated readiness/review, generation, progress, history and outputs in Generate.
  The studio is the present task; the future generator may be separate, but its deployment or API
  architecture has not been selected.
- Chat is independently collapsible and open by default. A navigation panel, if retained, is
  independently collapsible and initially closed. Its need and purpose remain open.
- Single-click inspects; double-click opens children. Do not offer named focused views or
  user-created focused views. Do not offer text, notes or frames in the architecture toolbar.
- Automatic layout allows manual moves to organized grid positions/automatically chosen landing
  positions, informed by automation-pitch. Keep one **Tidy and fit** control.
- Layout priorities: readability, then compactness, then fewer crossings. Some unused space is
  acceptable. Detailed drag/connect semantics need R06 because the original questions were compound.
- Target laptop/desktop use. Do not add mobile/tiny-screen acceptance work to this scope.
- Distinguish capability with color. Use recognizable role shapes/icons and helpful vendor logos.
  Choose generic capability first, provider second. Providers should cover the major cloud,
  payment, email and existing data-service ecosystems; the depth of provider configuration is
  addressed in R07.
- Prefer new diagrams reconstructed from project goals, referencing old diagrams as evidence,
  after the redesign. Do not carry forward old layouts blindly or rewrite live projects now.
- Show usage information if it is available; broader chat improvements are later work.

## Trace to the original questions

| Question | Owner answer / status | Remaining qualification |
| --- | --- | --- |
| Q01 | Current UI plus meaningful configuration/model capability. Do not focus on repairing QRWTY. | No runtime implementation follows. |
| Q02 | AI-led workflow with manual edits. Include all examples; QRWTY does not drive acceptance. | R02 defines template-level coverage without an executable-generation promise. |
| Q03 | Prefer independent microservices, different languages and existing libraries/services. Queues may be configurable at C3 depending on abstraction. | R01/R03 settle packaging and queue representation. Do not turn every library into a service. |
| Q04 | Intentionally Docker-oriented; Kubernetes/Helm excluded. | Keep C1/C2/C3 names per Q05. Do not reopen Docker as a prerequisite question. |
| Q05 | One Billing card at C2, possibly more configuration at C3; delegate to providers. | Local service versus package mechanics follow R01. |
| Q06 | Show a Billing Service; avoid its current detailed decomposition. | Preserve meaningful provider integration configuration. |
| Q07 | Redirect is a microservice; if it comprises several services, show their configuration at C3. Omit unconfigurable internals. | This is the explicit reason R01 is still open. |
| Q08 | Data ownership/separation is unclear; visually distinguish caches and stores. Some storage needs more architecture. | Explain logical ownership versus physical hosting; no universal database count is selected. |
| Q09 | Work on UI/options first. Generation boundaries remain to be worked out. | Do not filter everything by today's generator support or expand runtime scope. |
| Q10 | The earlier message identifies trial days/roles/plan limits/retention/failure as potentially too application-specific. The continuation questions the value of templating them and suggests leaving them out. | Provisional interpretation: omit application-policy editors; R02 asks about API/data structure and extension boundaries. “Retention” and “failure” also have infrastructure meanings, so the name alone cannot decide scope. |
| Q11 | Leave detailed backend authoring out for now. | This does not authorize deleting stored declarations or dropping them from old exports. |
| Q12 | The Custom domains example feels too domain-specific to template. | Do not make that family the calibration/acceptance gate for the new plan. |
| Q13 | Explicit presets plus base-type creation from the toolbar. | Determine the finite palette in the later specification. |
| Q14 | Compact tabs, concise text, no empty/unconfigurable menu content. | R01/R02 identify the actual configurable objects and fields. |
| Q15 | Suitable autosaving; silently discard. | R05 defines in-flight, invalid and abandoned edits concretely. |
| Q16 | Unify configuration sources, but no backend generation now; generator might later be a separate application/API. | Unify the relevant configuration semantics, not every existing business-behavior editor. A separate generator is not yet a settled deployment decision. |
| Q17 | Consolidated Generate review. | Local save failure still requires concise truthful feedback; no permanent warning wall. |
| Q18 | Short action/action plus protocol/configurable information. At distant zoom show only arrows. | Later plan specifies density thresholds and exact label content. |
| Q19 | Shared trunk and branches. Selection behavior depends on what is configurable. | Preserve branch identities; do not present several independent settings as one shared value. |
| Q20 | Keep lines, remove repetition, one connection per application/group. No exceptional-behavior visual treatment. | Do not delete the underlying exact dependencies. |
| Q21 | Relevant timeout/retry/etc. settings in configuration, not diagram text. | Do not attach infrastructure placement to arbitrary arrows. |
| Q22 | Preserve whole diagram appearance; prominent selection; dislikes dotted box borders. | The objection is to boxes; it does not alone prohibit every patterned connection stroke. Prefer protocol labels/inspector for meaning. |
| Q23 | Name/icon; zoom can reveal more text. Last question unclear. | Automatically changing text detail is settled; automatically opening/closing structural children is not. |
| Q24 | Simple lines/boxes for a possible navigation map, but uncertain it is valuable. | R04 proposes depth navigation first and deferring the extra map. |
| Q25 | Independent collapse; chat open, other panel closed. | Conditional on retaining the other panel; no persistence rule has been selected. |
| Q26 | Click inspect/double-click children accepted. Unsure why a project needs multiple diagrams. | Explain different depths of one model; R04 resolves the extra navigation UI. |
| Q27 | No named/user-created focused views. | Do not reintroduce through a new menu. |
| Q28 | No text/notes/frames. | R06 covers placement and connection creation. |
| Q29 | Suggests drag behavior like automation-pitch. | This did not choose destinations for every old menu action. Directions on Generate, base creation and excluded deep authoring settle much of it; R02/R04/R06 address the remaining material parts. |
| Q30 | Automatic layout plus manual moves to organized positions; automatically chosen landing position; reference automation-pitch. | R06 gives a concrete gesture contract. |
| Q31 | “no.” | Original question listed several alternatives; do not infer which behavior was rejected. R06 replaces it. |
| Q32 | “no.” | Same ambiguity; do not infer that every drag/connect gesture is forbidden. R06 replaces it. |
| Q33 | Tidy and fit. | One visible action, not separate Fit/Focus/Arrange controls. |
| Q34 | Readability > compactness > fewer crossings; some unused space acceptable. | Do not demand mathematically optimal packing; stable rendering remains required. |
| Q35 | Laptop/desktop; no mobile/tiny-screen work. | Use ordinary desktop acceptance sizes in the plan. |
| Q36 | Role/type recognition, helpful vendor logos, capability colors, icons without repeated “Component.” | A vendor-neutral choice still needs a capability icon. |
| Q37 | Clearer names; reuse common client libraries behind different service types. Browser app remains a distinct component/application. | No standalone REST-client service solely because a library is used. Library reuse across languages means appropriate ecosystem implementations. |
| Q38 | Cloudflare, Google Cloud, AWS, payments, email, managed Postgres/Redis and common existing database solutions. Generic capability then provider. | Research a concrete catalog; R07 settles how deeply provider-specific options belong in its forms. |
| Q39 | Use judgment. | Decision below: design-time settings/references and Generate setup summary now; executable provisioning/onboarding later. |
| Q40 | Generate becomes the unified home. | Opening the destination does not start a generation job. |
| Q41 | Rebuild diagrams from goals after redesign, using old diagrams as reference and reviewing the result. | No live conversion now. Preserve old designs as sources until replacements are reviewed. |
| Q42 | Show available usage; broader chat work later. | Do not invent cost/context values where unavailable; do not bundle a chat redesign into this task. |

## Technical explanations and recommendations

Docker is a reasonable delivery boundary for repeatable service setup and a reusable black-box
test harness. The harness can start containers and test their HTTP/event behavior without depending
on the implementation language. The actual behavioral contract still determines what it can verify;
container packaging alone does not prove service correctness. Docker's own guidance favors
separating application concerns: [Docker build guidance](https://docs.docker.com/build/building/best-practices/).
No harness or runtime implementation is being added in this discussion.

Independent service ownership means, for example, that changing Billing's internal schema should
not force Redirect to change because it reads Billing's private tables. Communication through an
API/event contract preserves that boundary. Separate logical databases can share a physical
Postgres server/cluster. This distinction supports small installations and later physical separation;
it is not a rule that every service needs a separate database machine.
[Microsoft microservice data guidance](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations).

A queue is a resource/channel; a worker is application code consuming work; a broker is the
software hosting one or many queues. Choosing queued work can be a reusable configuration/preset
without Jeeves inventing a queue implementation. The design still needs an identity for a shared
queue and the selected provider/broker. C4 allows explicit queues or a named channel on a
relationship, depending on what the view explains.
[C4 queue guidance](https://c4model.com/abstractions/queues-and-topics).

Multiple independent containers inside a C2 card make that card a service **package/group**,
whereas standard C3 describes parts inside one deployable application. Jeeves can deliberately
offer a different product-specific depth model, but it must retain the actual deployment boundaries
underneath. R01 settles the behavior before the old C4 guidance is revised.
[C4 component guidance](https://c4model.com/abstractions/component).

The existing dashed box outlines have several presentation meanings: planned support in
[editor.css](../../../apps/web/src/architecture/editor.css), and people/external systems or enclosing
scope frames in [architecture.css](../../../apps/web/src/architecture/architecture.css).
[type-style.tsx](../../../apps/web/src/architecture/type-style.tsx) describes the planning convention.
They are not inherent requirements for those services. Use the owner's requested consistent box
treatment and recognizable symbols; readiness belongs in Generate. This does not convert a planned
capability into an implemented one.

For language flexibility, record the service's contracts and configuration without assuming one
runtime. A service can use an established HTTP client library internally; different languages can
use different established libraries implementing the same wire contract. The future generator can
consume that design whether it ultimately runs inside Jeeves or as another application. Its API,
runtime implementation and deployment are later decisions.

**Q39 judgment, selected within the owner's delegation:** capture provider choice and useful
non-secret configuration in the design; use environment/credential references rather than secret
values; show required setup in Generate. Defer executable cloud provisioning, account sign-in,
credential setup helpers and a setup-wizard project. This fits the explicit design-first scope.

## Remaining product decisions

These replace the unresolved portions of the original questionnaire. They are not seven new
permission gates: no dependent implementation has begun. The owner can answer in prose or revise
the offered choices.

**R01 — Is a C2 card one container, or can it be a package of containers?**

- **One deployable application:** Billing/Redirect each represent one service container. C3 exposes
  configurable parts such as incoming API, outbound HTTP, cache access and background execution
  inside that service. Additional independent services appear at C2.
- **Expandable service package:** a Billing/Redirect card may hide several independently deployed
  services. Opening C3 reveals those children and their configurable dependencies. The model
  distinguishes the package from its actual containers even if the normal card stays compact.

Which should Jeeves support? Also, for one service, should API/database/cache settings be ordinary
tabs in its inspector, or configurable C3 child objects? If a service has no deeper configurable
structure, the proposed behavior is no empty C3 editor or placeholder children.

**R02 — Where does reusable technical configuration stop and project-specific behavior begin?**

Candidate boundary to review:

| Area | Proposed treatment, awaiting answer |
| --- | --- |
| API exposure, connection/protocol, authentication-provider binding, pools, timeouts, retries, cache TTL, queue delivery controls, provider selection | Reusable technical configuration. Exact relevance varies by selected type/provider. |
| HTTP routes and request/response types; logical data entities/fields | Decide now: retain compact authoring, or leave to goals/contracts/custom implementation for a later task. |
| Trial days, subscription entitlements, domain-transfer policy, product-specific roles, command/lifecycle/state-machine/effect editors | Omit from this phase's normal manual editor; retain application intent for later implementation work. |

Does this capture what should be left out? Specifically, should humans still edit API shapes and
data fields here? Can example coverage mean that the architecture can be assembled from these
technical building blocks with explicit project-logic extension points, rather than every business
rule being configurable or executable? This does not reopen authorization for runtime generation.

**R03 — How should enabling queued work appear?**

Proposal: configure a service to publish/consume work, select an existing or new queue and provider,
and show a shared/independently configured queue once as a recognizable resource. A completely
internal queue packaged within one service stays inside its detail view. No new “queue microservice”
is invented just to wrap a broker, and no queue is silently duplicated per consumer.

Should the main C2 canvas show that queue when enabled, or do you prefer the queue to remain in
service/C3 configuration with the main relationship showing queued communication? The shared
resource and ownership remain explicit in the model either way.

**R04 — Can the extra left navigation diagram be deferred?**

Proposal: one project holds one architecture. C2 gives its overview; double-click opens the selected
service's children/configuration at C3; a short breadcrumb/back action returns to the overview.
These are different depths of the same design, not independently authored diagrams or projects.
There are no named focused views. Begin without an additional mini-map/Explorer drawer; keep chat
open by default. If the owner still wants a map, it stays simple and independently collapsible.

Does this satisfy the navigation need, or is the second panel wanted in the first version?

**R05 — What exactly should “silently discard” discard?**

Concrete proposal: a valid edit autosaves on a short pause/field completion; changing selection
finishes that valid edit's save. Incomplete/invalid unsaved input is discarded when leaving, without
a confirmation dialog. An already-started save is allowed to complete. A network/revision rejection
gets one concise save-error indication, not a false success or a modal decision flow.

Is that the desired behavior, or should switching objects discard even a valid edit that has not
yet been sent? This question concerns a small, observable distinction such as entering a valid
timeout and immediately clicking another service.

**R06 — Does this concrete interaction match the automation-pitch feel?**

Proposal: click to inspect; double-click to enter children; drag the card to an automatically chosen
grid landing position with a visible preview; settle layout on release. Ordinary movement does not
change service membership or create connections. Existing unrelated paths stay drawn throughout.
Create a connection with the connector tool by clicking its endpoints; retain the user's selected
Tidy and fit action. A node handle for pulling a connection is an alternative if that is the
specific automation-pitch gesture the owner wants.

Should the new toolbar also offer drag-from-object **add/connect handles** like automation-pitch,
or just card dragging plus the connector tool? Does dropping onto an existing connection insert
the dragged service into that communication path, or only move its visual position? Recommendation:
ordinary card movement changes layout only; semantic insertion needs a deliberate supported action.
The owner's “no” answers to old Q31/Q32 were not precise enough to decide these alternatives.

References rechecked: [drag preview](../../../../automation-pitch/.docs/improve-10-drag-preview.plan.md),
[insert preview](../../../../automation-pitch/.docs/improve-04-insert-preview.plan.md),
[layout animation](../../../../automation-pitch/src/board/layout/useAnimatedLayout.ts) and
[object controls](../../../../automation-pitch/src/board/controls/TileChrome.tsx). Borrow interaction
behavior selectively: its workflow insertion and graph rules are not Jeeves architecture rules.

**R07 — How deeply should provider-specific configuration go?**

The requested cloud/provider families and generic capability → provider workflow are settled.
The planner should research a concrete catalog without requiring the owner to enumerate products
or versions. For its forms, should the first version expose the common capability settings plus
essential provider-specific connection choices, or substantial vendor-specific configuration too?

For example, a CDN could offer origin and cache behavior, with the selected provider's necessary
identifiers, while leaving its many specialized security/routing options for later. Alternatively,
the studio could expose selected advanced provider sections on demand. Recommendation: start with
the small useful cross-provider set and necessary provider-specific choices, not an attempted copy
of each cloud console. Does that match the intended balance? No choice here claims implemented
provisioning or code generation.

## Consequences for the eventual plan

Latest owner instructions supersede older UX preferences for a modular default, named focused
views, explicit Save/Cancel everywhere, persistent planning border styles, mobile checks, and
the normal exposure of detailed backend authoring. Do not use the historical roadmap to restore
those choices. Where the boundary is not yet settled (especially C3), retain the open decision.

Once the remaining choices are resolved, revise the affected modeling/studio guidance together
with the new build specification. Include an explicit configuration-to-model mapping, conditional
visibility, data ownership/reference rules, template/provider availability and a multi-example
design coverage matrix. New diagrams are reviewed reconstructions from goals, not blind migrations.
Preserve the old designs and benchmark declarations as source material; do not silently erase
business obligations to claim implementation readiness.

The implementation plan will specify sequential assignments on primary `main`, scoped local
commits, handoffs, lint/typecheck/production-build/direct-browser verification, and no delegated
agents/worktrees. The current UI unit/E2E deferral remains. This discussion starts none of those
assignments and does not resume P73a/P73b.
