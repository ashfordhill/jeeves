# UX discussion questions — 3 November 2026

**Historical first questionnaire.** [First answers](DECISIONS-ROUND-1.md) and
[final decisions](DECISIONS-FINAL.md) now resolve this scope; the
[build plan](../../../docs/build-plan-studio-ux.md) follows them. At initial publication all answers were pending.
This is not a build plan. See the [review and source inventory](REVIEW.md)
for what was inspected and why these questions exist. Options below explain tradeoffs; their order
does not select a default. A recommendation is identified as such. “Undecided” is a valid answer,
and silence is not agreement.

The explicit requests do not need to be confirmed again: remove the marked chrome and both
ellipsis menus, replace the current selectors/lists on the canvas, restore level-appropriate
toolbar editing, make relationships inspectable, fix flicker, improve condensation and type
recognition, and rename Runs to Generate. The questions address the remaining behavior and scope.

For a manageable first discussion, start with **Q01, Q03–Q06, Q09–Q12, Q18–Q20, Q24 and Q30**.
The others settle details needed before an implementation agent receives an exact specification.
We can work through them in batches and append agreed answers without rewriting your feedback.

## Product direction and architectural boundaries

**Q01. How far should this UX plan change the underlying architecture model?**

Should it (a) reorganize the current information and controls, (b) also add the model/editor work
needed for a chosen set of meaningful settings and reusable groups, or (c) also redesign the QRWTY
target's actual service/data boundaries? These are different sizes of work. The current request
does not authorize new runtime generation or cloud provisioning. The aim is to settle whether the
later plan can change design semantics, rather than infer that from a request for fewer boxes.

**Q02. What is the main authoring workflow, and which examples must feel good?**

Do you mainly want to assemble/configure reusable pieces yourself, have AI construct a design
that you inspect and adjust, or use both equally? Should the UX be judged primarily on the QRWTY
target, with another example as a cross-check, or must the recently added large backend designs
be equally comfortable in this phase? This determines how prominent manual creation, detailed
editing and large-model navigation need to be. It does not ask you to set an arbitrary box limit.

**Q03. What should a reusable building block promise about deployment?**

Do you want reusable features that can live inside an application, independently deployed
services by default, or a library that explicitly offers both forms? A reusable Billing module can
run inside the API; a Billing service can run independently and communicate over a network.
Neither form is inherently more reusable. My recommendation is to support both with explicit
boundaries, but we should choose your preferred default. If you want service-first composition,
which benefits matter most: independent scaling, release, reuse across products or isolation?

**Q04. How literally should C2 mean a container, and what should the navigation call it?**

Would **C2 · Applications & data** with separate deployment choices make the distinction clearer,
do you prefer retaining **Containers**, or should Jeeves intentionally offer a more opinionated
Docker-oriented product view? In the standard model, browser apps and logical databases are also
C2 containers, while Docker containers/pods describe deployment. A product-specific view is possible,
but we should name it honestly and decide how browser apps, managed services and stores fit it.
Should C1/C2/C3 numbers remain visible alongside plain-language labels?

**Q05. What should collapsing a family mean?**

For a cluster such as Billing, would you prefer one card with relevant settings in the inspector,
a card that expands into smaller responsibilities on demand, or a click that opens a separate
focused view? Should collapse be purely visual, preserving internal responsibilities, or should
some responsibilities actually become one configurable model component? A family such as “data
access” can have unrelated instances, so grouping every instance with the same family would be
misleading. Would you expect to choose the group membership, or have library compositions supply it?

**Q06. What should Billing look like in the ordinary QRWTY view?**

Choose the closest starting point: one Billing module inside Application API connected to a
payment provider; a separate Billing service connected to that provider; or only the provider
on the overview, with local integration revealed when selected. For the local adapter, plan rules
and entitlements, should any stay separate in normal C3, or only appear when you deliberately
inspect Billing? A provider can handle payments without deciding all of your product's access
rules. This question chooses visibility and ownership, not whether those rules may be discarded.

**Q07. What exactly should the reusable Redirect service contain?**

Do you mean one C2 service whose internal lookup/update/event behavior is hidden until you enter
C3, or a library package that inserts the service plus optional cache, visit channel and related
connections? Those are respectively a reusable application and a reusable multi-part composition.
Would you ever want to edit its internals, or configure it as a sealed feature with a few documented
extension points? We should not turn “available in the C2 library” into “has no C3 model” by accident.

**Q08. Is the database concern about appearance, or a change in data ownership?**

For QRWTY, do you want the existing primary store shown more clearly, or do you want to revisit
which services own separate data? One Postgres cluster can host several logical databases/schemas;
one shared database is another choice. If independent services are the goal, which capabilities
must be independently released or isolated? Those requirements let us advise on boundaries instead
of asking you to guess a database count. Should the normal canvas show logical ownership while
physical co-hosting stays in deployment, or show a physical-store grouping as well?

## Useful configuration without a wall of fields

**Q09. Does “affects generation” mean supported today, or intended to generate later?**

The QRWTY target currently has planned architecture choices that do not generate the corresponding
implementations. Do you want only currently supported settings, future settings with a compact
availability explanation, or a design workflow that keeps those choices while explaining readiness
on Generate? Removing everything not executable today would hide much of the architecture you are
trying to design. Conversely, displaying future choices as working switches would mislead you.

**Q10. Which kinds of decisions count as useful configuration?**

Besides connections and performance, should the normal editor include functional choices such
as trial days, access roles, plan limits, cache expiration, analytics retention and behavior when a
provider is unavailable? My recommendation is to include choices that change meaningful product
behavior, even when they are not infrastructure knobs. Are some of these decisions meant for AI
or fixed templates rather than manual forms? Concrete examples of “useful” and “extra crap” are
especially helpful here.

**Q11. How much detailed backend authoring should humans be able to reach?**

The current editor exposes Data, Access, Behavior, Effects & hooks, and Settings. Should these remain
available in a deliberate advanced editor, appear only when relevant to the selected building block,
or largely become AI-authored material with a human-readable summary? Another option is a simple
template configurator plus a separate custom-component editor. Which feels closest to the product
you want? We should not make a simplified panel the only way to inspect decisions with real effects.

**Q12. Can we use Custom domains to calibrate the right level of detail?**

For each row, mark **ordinary control**, **advanced/on demand**, **AI/template decides**, or
**not part of this phase**. These are candidate controls, not a promise that every one is already
implemented or should be added.

| Candidate | What the choice changes |
| --- | --- |
| DNS/provider integration | Which outside service handles domain/certificate work. |
| Ownership verification | How someone proves they control a domain before attaching it. |
| Certificate management | Who obtains and renews HTTPS certificates. |
| Transfer/reverification | What happens when a domain changes owner or workspace. |
| Disable/update delay | How quickly a changed or disabled destination must stop being served. |
| Takeover protection | Whether an old domain mapping can accidentally grant a new owner access. |
| Database/cache connections | Which existing resources this feature uses. |
| API operations and input/output types | The interface other parts of the system can call. |
| Retry/timeout behavior | What happens when an outside call fails or takes too long. |
| Description, sources and version IDs | Explanatory and traceability information rather than a behavior switch. |

Once we agree on this example, we can apply the same visibility rule to Billing, cache, API and
database controls instead of letting each implementation agent invent its own rule.

**Q13. How should defaults and unanswered decisions appear?**

Should a newly added piece start with an explicit preset, leave consequential decisions as
“Not chosen,” or accept AI-suggested values that are visibly proposed? Should unchanged defaults
be mostly hidden behind a compact summary, or always appear in the form? This matters because
the current catalog can display default values even when the saved component config is empty.
We need to distinguish an intentional preset from an unresolved decision without adding badges
to every field.

**Q14. What should happen immediately when you select a box or arrow?**

Should the right panel show editable practical options immediately, a short summary followed by
one Configure action, or compact tabs with Overview/Configure? Should name/purpose be editable
there as well, or tucked away? For an arrow with no configurable behavior, would a short description
be enough? This settles the inspection-versus-editing split demonstrated by your GIF.

**Q15. How should editing and navigation handle unsaved work?**

Would you like the existing explicit Save/Cancel approach in the right panel, or automatic saving
for suitable fields? When you select another object, should an unfinished draft stay attached to
the first object, or should the UI ask you to save/discard before switching? The current validated
draft and undo behavior must have an intentional replacement if we change it; a cleaner panel
should not make an accidental click lose work.

**Q16. Should this phase unify the older family forms and newer exact backend settings?**

They currently coexist, and the QRWTY target uses the older model. Do you want presentation cleanup
over each existing source of truth first, or a bounded semantic mapping so selected families get
one authoritative form now? If the latter, which families matter first—API, data store/cache,
Billing, Custom domains, or something else? The implementation plan will need an explicit field
mapping and migration policy; it must not quietly translate broad prose into exact behavior.

**Q17. Where should incomplete choices and implementation limits appear?**

Would you prefer a small selected-object notice only when something needs action, a consolidated
list in Generate, or both? Should opening a component immediately expose its unanswered decisions,
or only after you ask to configure/generate it? Structural save errors still need to explain what
failed; the open product choice is how much nonblocking design/readiness information belongs on
the normal authoring surface. We should not recreate the current interface-report wall with a new name.

## Relationship display and condensation

**Q18. What should an ordinary arrow show before selection?**

Choose a starting rule: a short action such as “Calls API”; action plus protocol; no text until
selected; or labels only for unusual/important interactions. Should zooming out progressively
hide details, and if so which detail should remain readable? A direction and meaningful action
help explain the architecture, but the current large repeated panels are not required for that.

**Q19. How should repeated connections combine, and how should selection work?**

For the Owner web app's repeated API calls, would you prefer one shared trunk/label with visible
branches, one compact line representing several underlying uses, or separate faint lines whose
labels appear on selection? If several uses become one displayed connection, should clicking it
open a short list in the inspector, highlight/expand the branches, or both? Equal text is not enough
to establish equal meaning, so the plan must preserve access to individual contracts and destinations.

**Q20. How much database wiring should remain visible by default?**

Would you keep the lines but remove repeated SQL/read-write labels, display one summary connection
per container/group, or reveal data dependencies only for the selected responsibility? Should
unusual data behavior—read-only access, another service's store, cache fallback—remain visible?
The model still needs explicit store ownership and bindings even when the canvas hides repetition.
This is separate from deciding whether QRWTY actually needs more databases in Q08.

**Q21. Where should settings that belong to an interaction be edited?**

Would you expect timeout/retry/authentication/channel settings when selecting the arrow, on the
source component with a link to that arrow, or in both places editing the same value? For a load
balancer, should selecting the request path offer a link to the target service's deployment settings,
or show that deployment configuration inline? A load balancer is not simply an attribute of every
arrow, so the UI must keep the setting's actual owner understandable.

**Q22. Should selection simplify the surrounding diagram?**

When you select a component, should everything stay equally visible, should unrelated items fade,
or should you enter a focused neighborhood with a clear way back? If fading, how strong can it be
before the context becomes hard to read? The current code already dims unrelated items, so “more
emphasis” could mean a clearer selected card, a better inspector, fewer visible relationships,
or a combination. Which effect are you after?

**Q23. What belongs on a compact card, and what should zooming change?**

Would name + recognizable icon be enough, would you add a one-line purpose, or should technology
also appear? Is a component count or one drill-in affordance useful after removing the full C2
component lists? Should zooming automatically reveal more text, or should expansion always be
explicit? Automatic text detail and automatic structural expansion are different behaviors;
the latter can move the diagram and affect your sense of place.

## Navigation and command placement

**Q24. What should the proposed small diagram on the left explain?**

Do you want a map of which applications communicate, a hierarchy of which components live inside
which application, or a combination? In the current target, Background worker and Application API
are separate C2 applications; the worker is not a child of the API. A containment tree and a
topology mini-map answer different questions. Should clicking the map switch scope, select an
object on the main canvas, or first preview the destination?

**Q25. How should chat and navigation share the left side?**

Should they be two tabs in one collapsible drawer, a slim map/rail beside chat, or separate drawers
that can be open together? On first opening a project, should both be collapsed, chat be open,
or navigation be open? Should the drawer remember your choice per project or across projects?
This is still open in your “maybe” wording; I have not selected a layout for you.

**Q26. How should someone enter a container's C3 view after the selectors disappear?**

For example, single-click could select Application API and show its settings, while an explicit
Open components action or double-click enters its internals. Alternatively, the left map could
be the only scope navigator. Which feels natural? How should you go back and switch to a sibling
application—a breadcrumb/map, a back action, or both? The same gesture should not unpredictably
alternate between editing a container and navigating inside it.

**Q27. Do named focused views still belong in the experience?**

Would you like saved views such as Management, Redirect path and Analytics in the left navigator,
or should selecting a feature produce a temporary focus automatically? Should you be able to create
your own focused views? Removing “Whole system / New focused view” from the toolbar does not tell
us whether to move or retire that capability. A focused view can show selected members of the same
model without inventing an extra parent-child hierarchy.

**Q28. What belongs in the Excalidraw-like toolbar beyond the core editing tools?**

Select, pan, add a level-appropriate object, connect, delete and mouse-accessible undo/redo cover the
core workflow. Do you also want text, notes and frames in these architecture views? If so, should
annotations belong only to the current view or follow their referenced component between views?
Should Add open a compact visual library, and placement be click-to-place/drag-to-place, or should
automatic layout place the new item after configuration? This determines whether the toolbar is
just visually similar or also behaves like the older board.

**Q29. What should happen to the useful actions inside the removed chrome?**

For these candidate destinations, mark **keep there**, **put elsewhere**, or **retire from UI**.
These are proposals to discuss, not selected replacements. A new giant overflow menu would repeat
the problem.

| Existing action | Candidate home |
| --- | --- |
| Patterns and reusable compositions | Library, alongside individual building blocks. |
| API/interface and data configuration | Relevant selected object or a deliberate advanced editor. |
| Review/findings/implementation readiness | Generate, with a contextual link for the selected problem. |
| Evidence and implementation handoff/export | Generate/project output area. |
| Dynamic scenarios and saved focused views | Left navigation, if retained. |
| Global objectives and design decisions | Project configuration; selected objects link to relevant items. |
| Layout undo/redo | Agreed toolbar/history behavior, rather than a second hidden menu. |
| Freeform board and annotations | Architecture toolbar if integrated, another explicit workspace, or retire its normal entry point. |

The permanent Saved indicator is marked for removal. Would brief saving/failure feedback be enough,
or do you want a subtler persistent status somewhere? Failures must remain observable even if
successful saving is visually quiet.

## Layout, snapping and movement

**Q30. How much control over placement should a user retain?**

Should layout be automatic with no persistent manual placement, automatic with manual moves/pins,
or guided dragging that chooses an organized slot and settles on release? Automation-pitch is
closest to guided placement, but its drag can change workflow structure. For Jeeves we need to
decide whether dragging only changes presentation; connecting or moving a component to another
application would remain separate semantic actions unless explicitly chosen otherwise.

**Q31. Which snapping behavior are you imagining?**

Rounding to the dot grid, alignment with neighboring boxes, standard rows/columns with equal gaps,
or a preview of the automatically chosen landing position? More than one can be useful, but they
feel different. Should nearby nodes make room during the drag, only after release, or never move
unless you request a new arrangement? Your automation-pitch reference favors a visible landing
preview; the exact Jeeves behavior remains open.

**Q32. What should dragging and connecting feel like?**

Should any part of the card drag it, or should the current small grip remain? While moving one
card, is it acceptable for its connected arrows to follow temporarily and settle on release,
with other routes staying fixed? For creating a relationship, do you prefer selecting the connector
tool then clicking two objects, pulling from a handle, or both? These choices determine the hit
targets and distinguish clicking to inspect from dragging to move.

**Q33. What should the one visible view/layout action do?**

**Fit/Center** changes zoom/pan while preserving positions. **Tidy/Arrange** repositions boxes and
routes; it can then also fit the result. With automatic layout, one Fit action may suffice. With
manual positions, one “Tidy and fit” action is possible but deliberately changes those positions.
Which promise should the button make? Should a way to recover the overview remain available without
rearranging the design? This is a behavior choice, not just a naming preference.

**Q34. When layout goals conflict, which should win?**

Please rank readability, fewer crossings, compact use of space, and keeping familiar positions after
small edits. For example, adding one component could make the whole diagram slightly more compact
by moving many existing boxes, or leave most boxes in place with a little extra space. Which feels
better? There is no single arrangement that always optimizes all four goals, so the eventual plan
needs a clear priority rather than an instruction to “find the most efficient layout.”

**Q35. What screen sizes should drive the design?**

What window size/browser zoom do you usually use, and should laptop-sized editing be equally
comfortable? Your supplied captures have different dimensions, so they do not establish your normal
viewport. Is phone-width support intended for full editing, inspection only, or basic usability in
this phase? This sets the allowed drawer/panel combinations and the concrete visual acceptance
examples; it does not change the existing requirement that normal actions work by mouse.

## Visual language, integrations and remaining scope

**Q36. What should shapes, icons and colors communicate?**

People as figures and recognizable stores are already requested. For the rest, should shape/icon
identify the role—API, browser app, worker, relational store, cache, object store, queue, external
service—while a small technology label identifies Postgres/Redis/etc.? Would provider logos help,
or add noise? Should color primarily identify role, capability family, or provider? Distinguishing
“cache” from “relational database” is different from giving every vendor a different visual system.
Should C3 icons stay visible even when the redundant “Component” caption disappears?

**Q37. Which surrounding actors and infrastructure should ordinary C2 show?**

Would you keep browser/mobile clients as explicit applications with clearer names, and show named
queues where asynchronous work matters? Or would you prefer hiding clients/actors already explained
at C1 and representing a channel on its connecting line? A REST client library inside another
application is different from a separately running browser app or integration service. We should
resolve that terminology before eliminating the Client or Messaging categories. The chosen palette
can be friendlier than the internal model vocabulary.

**Q38. Which managed services should be first-class library choices in this phase?**

You mention an AWS CDN. Is the concrete starting set CloudFront/S3, a Cloudflare alternative,
payment/email providers, managed Postgres/Redis, or another shortlist? These names are examples to
locate your preference, not a popularity ranking. Would you rather choose a generic capability and
then its provider, or choose a recognizable provider directly? Provider selection should reveal
relevant choices without adding duplicate-looking library entries or promising unavailable code.

**Q39. How much external-service setup belongs in the upcoming plan?**

Should this phase capture the selected provider, connection/configuration references and missing
setup requirements only, design an eventual setup wizard, or separately plan executable onboarding?
For the later onboarding experience, do you lean toward a local helper script, an in-app checklist/
wizard, or a provider portal link? The implementation mechanics and credential storage would be
specified in that later scope; secret values should not become ordinary diagram metadata.

**Q40. What should the renamed Generate destination contain?**

Is this a label change around the current run workflow, or should it become the unified home for
implementation readiness, generation, progress/logs, run history and outputs? Should entering
Generate show a review/summary with an explicit start action, or another layout? The rename is
settled; what the destination does is not. It must not start work merely because its tab is opened.

**Q41. How should the redesigned presentation apply to existing projects and saved layouts?**

Should existing designs automatically use the new compact presentation while retaining manual
positions, open with a newly derived layout while preserving the previous one, or change layout
only after an explicit Arrange action? Newly sized/grouped cards may make an old layout less useful.
Semantic data should remain intact unless Q01 authorizes a specific migration. Are the current
QRWTY manual positions important to preserve as a visible arrangement, or primarily the design
content? No existing layout will be reset during this review.

**Q42. Should the archived AI-usage feedback be included now or remain separate?**

The older feedback asks for token usage, cost, context percentage and previewing answers to AI
questions. The current feedback focuses on diagram UX. Should those older requests join this plan
or stay in a separate chat improvement task? If included, should usage be a small expandable chat
footer, and do you care about the current turn, current conversation or project totals? The plan
would need to distinguish reported usage, estimates and unavailable provider information rather
than invent precise numbers.

## Decision record

No answers had been received at the time of the initial review. The first response is now recorded
in [DECISIONS-ROUND-1.md](DECISIONS-ROUND-1.md), with each Q ID mapped to its answer and any
remaining ambiguity. Append subsequent agreed answers with their Q IDs,
date and any relevant examples. If one answer changes an earlier one, record the supersession
explicitly. Only after the material choices are resolved should the build plan select controls,
defaults, migrations, scope and acceptance criteria.
