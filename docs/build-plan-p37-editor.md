# P37 — editor simplification

Approved direction (2026-10-31): the user chose focused C4 implementation with
linked data/traffic settings, contextual menus for retained actions, and C3
responsibility groups. This settles the three choices from the
[JEEVES-2 review](reviews/jeeves-feedback-2-2026-10-31.md); it does not approve every
recommendation in that research document.

## Bounded implementation

- Initially collapsed chat opens from the left edge, closes inside the drawer,
  and retains conversation and draft across collapse and scope changes.
- Keep C1/C2/C3 navigation, parent application selection, Library, Generate and
  mouse undo/redo. Move infrequent editing, findings, evidence, deployment,
  object search and diagram controls into compact menus/dialogs. Remove the
  permanent Architecture label, action row, object picker, Findings tab and counters.
- Selection drives the inspector. Use one heading and purpose, compact operation
  summaries (method/path/response media), and disclosures for contracts, resource
  fields and implementation configuration. Keep existing configuration entry points.
  Hide acceptance IDs from ordinary editing and version pins in advanced details.
- Keep existing C3 groups and all ungrouped members visible. No automatic grouping
  or mutation of saved designs. No endpoint-view switch in this package.
- Share type colors/icons across board, diagram, inspector and Library; retain
  separate selection, planned and issue cues. Deduplicate subtype releases by type,
  preserve existing pins, and retain the explicit reviewed upgrade operation.
- C1 renders saved purpose/actors/interactions. Without context, offer a concise
  setup state leading to the existing context editor; never invent live context.

Use existing components, draft persistence, validated operations and contracts.
Do not change templates, runtimes, dependency pins, generated output, live QRWTY
source/services/data or its saved Jeeves design. Catalog offerings and boundaries
remain unchanged. Work in the current branch/checkout with one agent.

## Completion evidence

Exercise actual mouse selection, menus, chat collapse/draft continuity, context
save/cancel/undo/redo/reload, existing configuration and conflict retention. Check
old pins remain unchanged by navigation/type selection, and explicit upgrades
still use their reviewed dialog. Inspect actual desktop and narrow/dark screenshots
and run accessibility checks. Run affected browser suites and `pnpm work run check`;
record exact results and limitations, append the handoff and commit scoped P37 work.

Implementation evidence and seven inspected screenshots: [P37 evidence](evidence/p37/README.md).

## Separately specified follow-ups

1. API tooling is implemented by [P38](build-plan-p38-api.md): complete
   CRUD/session/extension operations, saved-design OpenAPI preview, bounded existing
   extension editing and a locally bundled reference viewer. [Evidence](evidence/p38/README.md)
   records real-contract fit and remaining limits.
2. Focused C4 implementation: explicit handler/library bindings with linked data
   and traffic settings; begin with analytics and a non-QR operation. No combined
   backend canvas, inferred dependency graph or automatic provisioning.
3. Broader backend data/deployment authoring, new runtimes, source analysis, page
   flows, developer testing and live adoption require separate scope and evidence.
