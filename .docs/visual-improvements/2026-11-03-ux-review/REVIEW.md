# Architecture UX feedback review — 3 November 2026

**Status: review and questions only.** The user requested a thorough review, a detailed discussion
of ambiguities, and a build plan **after** those ambiguities are resolved. No UI implementation,
architecture migration or runtime work is performed or approved here. The execution plan will be
written for a Sol 6.1 xhigh implementation agent, with bounded assignments and explicit decisions.

Read [the questions](QUESTIONS.md) alongside this review. Every question starts unanswered;
recommendations are proposals, not inferred answers. The incomplete P73a checkpoint and paused
backend batch remain untouched.

## Evidence and coverage

- Reviewed the current [UX-Feedback.md](sources/UX-Feedback.md), every distinct current PNG,
  and sampled frames spanning all three GIFs. The recordings contain 70, 78 and 102 frames;
  twelve frames from each were decoded for inspection, with larger individual frames inspected
  where text mattered. This is visual review, not a frame-by-frame performance measurement.
- Reviewed both archived feedback documents, their three screenshots and the editor sketch.
  The sketch's PNG was inspected; its editable Excalidraw source and SVG were preserved.
- Preserved **21 original files** byte-for-byte in `sources/`, with sizes and SHA-256 hashes in
  [source-manifest.json](source-manifest.json). Windows `:Zone.Identifier` metadata is not a
  feedback artifact and was not copied. `image.png` and `uses-tenant-product-apis.png` are exact
  duplicates; both original names are preserved. The broken image markup in the original Markdown
  is preserved, with working links in the inventory below.
- Read repository instructions, PLAN §15, current C4 guidance, the studio guide, the revised
  roadmap's shared contract, prior feedback review and latest handoffs. Reviewed the relevant
  projection, layout, graph, toolbar, inspector, catalog and implementation-support code.
- Read automation-pitch's README, visual improvement log, relevant layout/drag/simplification
  plans and current layout engine. This was read-only reference work, not permission to import
  its workflow semantics or change that repository.
- Consulted official C4 guidance on containers, components, microservices, queues/topics and
  deployment, plus Microsoft's guidance on microservice data ownership. Links appear below.
- Inspected the running QRWTY target and its Custom domain lifecycle inspector/configuration
  dialog in Chromium at 1600 × 1000. The browser context intercepted every request and blocked
  non-read methods; **no non-read requests were attempted** in this inspection. No model,
  layout, chat, generation or provider action was saved or executed. The browser was closed.

Repository revision reviewed: `f5eabbbd38b1ac8bf76b47f7377691fb0b245d05`.
Live target inspected: `684f5790-df6b-4447-91d1-668cf7e1cc87`, semantic revision 1.
These identify evidence; future implementation must re-read current state rather than hard-code them.

Inspection artifacts: [current C3](inspection/current-c3.png),
[configuration dialog](inspection/current-config.png),
[read-only browser record](inspection/browser-observations.json),
[drag recording samples](inspection/chrome_FlmBak2gUQ.gif-sheet.png),
[inspector recording samples](inspection/PzufI5UjUN.gif-sheet.png), and
[selection recording samples](inspection/chrome_PjQUjhqJA5.gif-sheet.png).

## Request inventory

The source repeats the number “3”; identifiers below distinguish those requests without editing it.

| ID | Source | What is clear | What needs a decision |
| --- | --- | --- | --- |
| F01 | [Repeated API labels](sources/uses-tenant-product-apis.png) | Repeated identical label panels waste space. | Shared label, bundled trunk, selected-only detail, or a combination; how individual destinations remain selectable. Q18–Q19. |
| F02 | [Database arrows](sources/image-1.png) | Repetitive storage descriptions clutter the diagram. | Hide labels versus connections; distinguish database ownership from physical hosting. Q08, Q20. |
| F03 | Current feedback, General 2 | Cache, Redis and Postgres need clearer visual differentiation. | Shapes, role icons, technology identifiers and color meanings. Q36. |
| F04 | [Billing decomposition](sources/image-2.png) | The visible provider/adapter/policy/entitlement decomposition feels excessive. | A collapsed Billing unit versus a new deployment boundary. Q03, Q05–Q06. |
| F05 | [Toolbar and Explorer](sources/image-3.png) | Remove the circled action row; restore a level-appropriate Excalidraw-like toolbar; reduce Explorer's prominence. | Toolbar membership, chat/navigation arrangement and destinations for retained actions. Q24–Q29. |
| F06 | [Dragging](sources/chrome_FlmBak2gUQ.gif) | Unrelated arrows disappear/reappear while one card moves; stronger organization/snapping is wanted. | Guided versus free positioning, collision response and layout stability. Q30–Q34. |
| F07 | [Long inspector](sources/PzufI5UjUN.gif) | The default selected-component panel is dominated by repetitive reference material. | Useful fields, depth of manual authoring and treatment of future generation settings. Q09–Q17. |
| F08 | [Top controls](sources/image-4.png) | Remove marked Review, Patterns, Data & objectives and Saved chrome; replace the flat application selector; rename Runs to Generate. | Retained capabilities' new locations, contextual navigation and Generate's contents. Q24, Q27, Q29, Q40. |
| F09 | [Workspace ellipsis](sources/image-5.png) | Remove this menu from the editor surface. | Which capabilities survive and where, without recreating another oversized overflow menu. Q29. |
| F10 | [Redirect and inconsistent icons](sources/image-6.png) | Icon treatment is inconsistent; the redirect responsibility decomposition may be too prominent. | Consistent symbol system and the reusable redirect package's boundary. Q07, Q36. |
| F11 | [Fit / Focus / Auto-arrange](sources/image-7.png) and General 9 | Simplify these controls and remove the top-right diagram ellipsis. | Which behavior the one visible action performs. Q33. |
| F12 | [C2 component-list selection](sources/chrome_PjQUjhqJA5.gif) | Remove the component lists/selectors inside C2 cards. | How to inspect the container versus enter its components. Q26. |
| F13 | Current feedback, C2 | People should look like people; generic boxes and categories do not communicate enough. | Palette vocabulary; client, queue and actor visibility. Q04, Q36–Q37. |
| F14 | Current feedback, General 5 | Common managed services and eventual setup should fit the product. | Which providers, how concrete presets should be, and current versus later scope. Q38–Q39. |
| F15 | Current feedback, General 10 | Dense views need a deliberate condensation strategy. | Card content, grouping, focused views and movement priorities. Q05, Q23, Q27, Q34. |

The screenshot named `image-7.png` shows the bottom controls; it does not itself show the upper-right
ellipsis. The written feedback explicitly requests that ellipsis removal. Similarly, the source's
“component dropdown” GIF shows the inline list inside a C2 card, while `image-4.png` marks the separate
application selector. These are two distinct controls to address.

## Findings from the current implementation

**1. Several apparent boxes are relationship labels.**
The repeated “Uses tenant product APIs” and “Reads / writes authoritative data” panels are rendered
by `Relation` in [ArchitectureGraph.tsx](../../../apps/web/src/architecture/ArchitectureGraph.tsx).
They are not separate services. C3 projects a shared C2 connection onto its component uses, so one
outer connection can appear as several lines. Their wording alone does not establish identical
contracts, authorization or failure behavior. A display bundle can reduce repetition while retaining
the individual model identities and bindings. Merging model relationships solely by equal text would
be a different and potentially incorrect change.

**2. The layout reserves substantial space for labels and component lists.**
[layout.ts](../../../apps/web/src/architecture/layout.ts) gives every relationship a label rectangle,
with at least 42 units of height. C3 component cards have fixed 252 × 160 bounds. C2 cards with
responsibilities grow with every listed component. The Application API in the supplied GIF contains
13 rows. Shorter cards and fewer visible labels affect the layout inputs themselves; merely reducing
CSS text size would leave much of the reserved space in place.

**3. The drag path can disturb unrelated relationships.**
Every drag event updates temporary geometry. `positionedArchitectureGeometry` iterates over all
edges, reserves labels against all cards and earlier labels, and can relocate a nonincident label.
A relocated label causes its path to be rebuilt. This is a source-backed candidate contributor to
the observed instability. It is **not** a measured proof of the complete flicker root cause; rendering,
selection updates and saved-position interactions still require a bounded reproduction during an
implementation assignment. No fix was attempted in this review.

**4. Icon absence in C3 is deliberate rendering logic, not missing image assets.**
The graph sets `showKind` false for authored C3 components, and the icon is inside that same block.
Outside applications retain their kind/icon row. Therefore the user's example compares an outside
Application API with inner components rendered by a different rule. [type-style.tsx](../../../apps/web/src/architecture/type-style.tsx)
also maps several stores to one data family. Icons, shape, category text and color need separate
decisions; hiding a redundant type caption should not necessarily hide its useful icon.

**5. The long default inspector and the configuration editor are different surfaces.**
The GIF scrolls the inspection surface. Live inspection confirms repeated provided/required interface
headings, version/planning text and operation names, plus a “Relationships in this scope (39)” section
that includes the scope's relationships rather than only those of the selected object. Actual Custom
domain controls appear after **Configure component**: ownership verification, certificate lifecycle,
domain transfer and takeover protection, followed by traffic targets and dependency selection.
The problem includes discoverability and presentation, not simply an absence of configuration.

**6. Today's architecture settings are not uniformly executable settings.**
The inspected QRWTY target has 23 C3 components, 33 contracts, 105 interface instances and 52 bindings.
It has **no `architecture.backend` model**, and all inspected component `config` objects are empty;
the family editors display catalog defaults where applicable. Newer Data/Access/Behavior/Effects/
Settings editors and exact implementation support coexist with these older family forms.

[CapabilityFields.tsx](../../../apps/web/src/architecture/CapabilityFields.tsx) renders catalog choices,
including prose fields. [backend-implementations.md](../../../docs/backend-implementations.md)
describes stricter typed support and explicitly says arrow text supplies no adapter wiring.
Existing executable templates remain real, but the presence of a target setting or a compiled design
obligation does not establish an implementation of it. Filtering the UI to “currently generated”
options would remove much of the target's authoring. Treating all displayed fields as working
generator switches would also be wrong. Q09 and Q16 must settle the product treatment.

**7. Some apparently missing features already exist in generic form.**
The catalog includes **CDN & edge protection**, billing/identity providers, generic third-party
services, cache/storage/channel choices and a separate deployment model. The question is how to
make these useful and discoverable, and which concrete integrations to specify. It is not evidence
that AWS provisioning, credentials setup or provider-specific templates already exist.

**8. Fit and Auto-arrange currently perform different actions.**
Fit changes the camera. Auto-arrange clears the scope's manual position overrides and saved camera
so layout is derived again. The workspace also has separate layout undo/redo. Removing one visible
button is straightforward; deciding what the survivor promises matters if manual positioning remains.

## System-design context for the discussion

Reusability, runtime separation and diagram detail are separate choices. For example:

| Design | What it means | What the user could see |
| --- | --- | --- |
| Reusable Billing module inside Application API | Code and business rules run inside the API process. | One collapsed Billing component; settings expose its meaningful policies. |
| Independently deployed Billing service | A separate application has its own API/events, failure boundary and deployment lifecycle. | A C2 service, with optional C3 detail inside it. |
| Payment provider plus a local adapter | A third party performs provider functions; local code translates requests/callbacks and applies the application's policies. | An external provider and a compact local Billing/Payments unit, with adapter detail available when needed. |

A C4 component is not independently deployed; a separately deployed service belongs at a larger
runtime boundary. A C4 container can be a browser application, service or logical store and need not
match Docker packaging. [Official component guidance](https://c4model.com/abstractions/component),
[container guidance](https://c4model.com/abstractions/container).

Microservices are valid when independent release, scaling, ownership or isolation is worth the added
network and operational coordination. A feature family does not automatically need its own process.
C4 can show a microservice as an API plus its store inside one product, or as a separate system when
ownership calls for that view. The proposed UI should not make either topology look mandatory.
[Official microservice modeling](https://c4model.com/abstractions/microservices).

For Billing, a payment provider does not by itself settle this product's trial duration, feature
eligibility or behavior after a downgrade. Some providers offer more of that behavior than others;
the intended integration must decide what remains local. Those decisions can be configured behind
one meaningful unit without requiring three permanently visible boxes.

For databases, distinguish **who owns data**, **which logical database/schema stores it**, and
**which physical server/cluster hosts it**. One database can be appropriate for a modular application.
Independent services generally need explicit data ownership and access through contracts, while
separate logical stores can share a physical server. Changing the number of cylinders is not enough
to establish independence. [Microsoft's microservice data guidance](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations).
The correct QRWTY choice depends on its intended service boundaries and workload, not a generic
“enterprise” label or a diagram's appearance.

A queue can appear as a named store or as a named channel on a relationship, with the underlying
broker described in deployment. A browser app still runs in a different execution environment from
a backend service, even when both ship from one repository. [C4 queues and topics](https://c4model.com/abstractions/queues-and-topics),
[C4 containers](https://c4model.com/abstractions/container).
Pods, replicas, machines and infrastructure load balancers describe deployment of these logical
applications; they are not a deeper code level. Contextual access to deployment settings can make
this distinction easy to use. [C4 deployment](https://c4model.com/diagrams/deployment).

My recommendation for discussion is to allow reusable modules, independent services and external
adapters, while making collapsed presentation independent of that choice. This is **not** a selected
default. The user may prefer a more opinionated product; Q03–Q07 make that choice explicit.

## What to borrow from automation-pitch

Useful references:

- [README and design lessons](../../../../automation-pitch/README.md).
- [Visual feedback log](../../../../automation-pitch/.docs/VISUAL_IMPROVEMENTS.md): preserve originals,
  connect each issue to its eventual resolution and record subsequent amendments.
- [Layout/routing improvement](../../../../automation-pitch/.docs/IMPROVEMENTS.md): derive routes and
  label positions together; retain usable previous geometry through asynchronous layout.
- [Insert preview](../../../../automation-pitch/.docs/improve-04-insert-preview.plan.md) and
  [drag refinement](../../../../automation-pitch/.docs/improve-10-drag-preview.plan.md): preview a guided
  placement without running the layout engine on every pointer movement; settle after drop.
- [Current layout engine](../../../../automation-pitch/src/board/layout/layoutEngine.ts): cached,
  coalesced layout requests and preservation of previous layout when a request is superseded.

Its snapping is more than rounding positions to a dot grid. Tiles occupy a derived workflow layout;
dragging can insert/reparent within that workflow. Jeeves has cycles, multiple clients and shared
stores, so a drop must not accidentally acquire workflow semantics or change architectural
dependencies. We should borrow the stable visual response after the user chooses what a drag means.
No automation-pitch tests were rerun and no cross-repository code was copied.

## Configuration mapping required in the eventual plan

Once the user chooses the presentation policy, each retained field needs an explicit mapping. The
following is a specification requirement for the later planner, not a field list approved here:

| Mapping entry | What the implementation agent must be told |
| --- | --- |
| User decision | A concrete purpose, such as expiry, role eligibility or timeout behavior. |
| Owner | Container, component, relationship, dataset or deployment environment. |
| Visibility | Default control, contextual control, advanced editor, derived/read-only, or removed from UI. |
| Source of truth | Existing exact model path or an explicitly scoped model change; no second independent setting. |
| Allowed values | Type, units, bounds, optionality, defaults and the meaning of undecided. |
| Dependencies | Which selections reveal it, invalidate it or make it irrelevant. |
| Consequence | Display-only; validated design intent; future implementation obligation; supported runtime/template configuration. |
| Generation mapping | Exact supported implementation/option if one exists; explicitly unavailable otherwise. |
| Editing | Save/Cancel or agreed alternative; draft retention, revision conflict and undo behavior. |
| Existing data | How older designs and pinned references are retained; no guessed migrations. |
| Demonstration | A named before/after example showing that changing the field has the promised effect. |

Candidate examples for the discussion: cache expiry/fallback, provider callback verification,
billing trial/entitlement policy, database selection, API authentication/timeout and domain ownership
verification. A free-text “Technology” field is different from choosing an implemented library;
changing one should not masquerade as changing the other.

## Constraints for the later build plan

- Resolve the product questions first. Include accepted answers and rejected alternatives explicitly,
  so an implementation agent cannot silently reintroduce removed controls or choose defaults.
- Assign new work IDs without colliding with the paused backend queue. Keep work sequential on
  primary `main`, one bounded assignment and local commit at a time; no delegation/worktrees.
- Include exact source/evidence reads, files likely to change, concrete acceptance examples,
  preservation requirements, non-goals, stop conditions and an append-only handoff for each assignment.
- Give every retained command a deliberate mouse-accessible home. Do not use the removed ellipsis
  menu as a convenient answer to unspecified navigation.
- Separate presentation grouping from model merging, and layout changes from semantic changes.
  Preserve exact contracts, interfaces, ownership, versions and scenarios unless an agreed work
  unit deliberately changes them. A bundled edge must still reach its individual relationships.
- Do not silently convert older architecture settings to the newer typed backend model. That requires
  an explicit mapping and scope decision. Do not restart the paused benchmark implementation work.
- For this UX work, follow the user's explicit lint/typecheck/production-build/direct-browser profile;
  unit/E2E maintenance and suite execution remain deferred. If later agreed scope needs a different
  semantic validation profile, specify that conflict before assigning the work.
- Verify meaningful mouse interactions, readable selected content, light/dark appearance, selection
  and draft continuity, and preservation of project data. Record actual outcomes and limitations.
  Do not substitute screenshot existence or green generation readiness for usability.
- Application runtime generation, infrastructure provisioning and credential onboarding remain future
  work unless the user explicitly includes them in a separately bounded scope.

This review did not run application lint, build, unit or E2E suites: no application source changed.
Documentation links, original-file hashes and whitespace are checked when the review is recorded.
