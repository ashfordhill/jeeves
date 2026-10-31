# P38 — saved-design API contracts and reference

Approved bounded package, 2026-10-31. Builds on [P37](build-plan-p37-editor.md)
and the API section of the [JEEVES-2 review](reviews/jeeves-feedback-2-2026-10-31.md).
Work sequentially in the current checkout; do not repeat C4 research.

## Scope

- One contextual API workspace lists each structured REST capability's generated
  sessions, resource CRUD and existing extensions exactly once. Rows show method,
  full path, purpose and success status/media/type. C3 responsibility selection
  exposes its operations and links to the same workspace. No endpoint canvas.
- Compile the current saved revision on the server with `resourceContract`, using
  the exact pinned REST version's session behavior. Return revision and explicit
  unavailable/invalid states. No filesystem generation, app requests or live-contract
  claims; legacy project-owned contracts are outside saved-design preview support.
- Selected operations show access, supported inputs, every response/media/header.
  Reuse the resource editor for generated operations. Existing project extensions
  get a focused Save/Cancel form for route/access/notes and the existing bounded
  parameter/body/response contract, with JSON for schema detail. Validate the whole
  model, preserve all supported JSON Schema fields and invalid/conflicting drafts,
  and reject unsupported fields/methods or route duplication. Keep recipe operations
  protected. New operation creation/import and a general schema editor are excluded.
- Evaluate maintained Swagger UI against real QR and non-QR contracts before
  integration. Pin an eligible release exactly; bundle assets locally, load only on
  demand, disable execution, external validation and network access in design mode.
  Use its renderer for full schema/reference detail rather than another schema tree.
- Preserve compact chrome, responsibility groups, selection and drafts, mouse access,
  undo/redo and existing pins/generation. No live QRWTY changes.

## Completion

Unit/API checks cover builder equality for old/new pins, complete unique operations,
JSON, PNG, redirects/headers, invalid models and protected edits. Browser checks
cover real-contract viewer fit, local-only loading, mouse selection/edit/save/cancel,
undo/redo/reload, conflict and selection continuity, resource reuse, recipe protection,
desktop/narrow screenshots and accessibility. Inspect actual captures; run focused
production browser checks and `pnpm work run check`. Record exact evidence/limits,
append the handoff, update pointers and commit only P38 with a `P38:` title.

## Outside this package

C4 implementation/code graphs, handler/library bindings, backend data/deployment
authoring, new runtimes, source analysis, broader HTTP methods, general OpenAPI
import/export, live exploration/adoption and generated-output changes remain separate.
