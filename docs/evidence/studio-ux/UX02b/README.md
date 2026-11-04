# UX02b — atomic studio edits, cleanup and generation guard

Completed only UX02b on primary `main`, from `3f8caab6046b87b5b6ae9e2985cc19f865ab3208`.
The new authoring UI, definition descriptors, copy/remapping/portable adapter and later UX units
remain outside this change. P73a/P73b/backend work remains paused.

`setStudio` replaces or explicitly removes only `architecture.studio`, requiring an existing
architecture system. `updatePlannedConnection` edits exactly the canonical planned label, protocol,
interaction and security; ordinary connections retain their existing operation. Complete final
studio structural validation runs inside the existing all-or-nothing operation boundary. Existing
backend/contract transition guards remain intact.

The exported `buildStudioCommand(acceptedDesign, command)` returns the accepted `baseRevision`
and one strict operation batch for create, edit, connect, relationship edit, group, remove members,
ungroup or delete. Create can include a system, multiple applications/resources, their connections
and a package. Settings replacement removes inapplicable optional fields. Commands clone inputs,
retain unrelated architecture declarations, and use the existing API/history. The thin browser
`api.studioCommand` submits that same batch; toolbar/chat integration remains their later units.

Explicit deletes prune only the deleted element/connection bindings and optional selected lookup,
serving and origin references. Member removal dissolves packages below two members. Ownership is
never silently reassigned or cascade-deleted: missing element/package owners reject unless the
same batch explicitly reassigns or removes the resource. Ungroup preserves children, resources and
connections. Package delete defaults to ungroup; explicit `delete-members` remains a distinct command
whose later UI must use its existing destructive-action confirmation.

`studioGenerationSupport` rejects any element binding, connection binding or package until an exact
runtime resolver exists. GenerationService checks it before acceptance-pack loading, busy state,
job/database/output changes or runner calls. Both pure `planProject` and `generateProject` also use
the guard at their shared entry boundary. The API returns 422 `STUDIO_DESIGN_ONLY`. Empty studio
metadata alone retains legacy eligibility, and portable design export is unaffected.

Evidence:

- [Direct API observations](api-observations.json): 23 observations using owned disposable projects.
  Create+binding is one undo step; invalid binding and stale revision reject without partial writes;
  unrelated architecture survives; owner deletion and invalid ungroup reject; explicit reassignment
  succeeds; remove-members and raw deletion never persist a one-member package; default ungroup and
  explicit delete-members differ. Canonical planned fields and policy removal commit together and
  survive undo, redo and GET reload. Strict unsupported fields and planned edits on ordinary
  connections reject. Cleanup preserves targets created later in the same batch and cannot hide
  an unrelated invalid binding. Queue edits cannot violate explicit channel direction/interaction.
- Legacy eligibility is proved without launching generation: the unchanged supported fixture passes
  the pure compiler plan, and its direct generation request reaches `INVALID_OUTPUT_DIR` for a
  deliberately relative path. After adding a new studio service to the same legacy document, the
  direct generation request returns `STUDIO_DESIGN_ONLY`; project metadata, semantic/history state
  and generation overview are identical before/after, and its absolute output path never exists.
  The pure compiler guard rejects the mixed document too. No actual generation/provider/agent ran.
- [Browser observations](browser-observations.json): four existing C2/API-C3 desktop views at
  1440×900 and 1280×800 retain 16/22 cards and 21/39 relationship labels respectively. The browser
  command client creates a bound service, edits its language, and performs undo/redo/GET reload.
  Existing mouse Undo/Redo buttons also restore unspecified/Go and survive page reload. The owned
  service is visible through the old shell; its new scalar settings await later inspector work.
  Screenshots were directly inspected; saved legacy cameras still extend content outside the view.
- A browser request guard was installed before page creation. Only GET/HEAD/OPTIONS were allowed
  on existing projects. POST operations/undo/redo and PUT layout were permitted solely for the exact
  owned disposable ID. Seven owned saves returned 200. No disallowed request, console error, page
  error or HTTP error occurred in the passing run. One existing React Flow attribution warning was
  observed; the unchanged graph uses `proOptions.hideAttribution`. This unit does not alter that UI.
- All 13 pre-existing projects retain semantic/layout hashes and revisions. Final API and browser
  disposables were deleted with 204 and confirmed 404; [API cleanup](api-cleanup.json) and
  [browser cleanup](browser-cleanup.json) record IDs. Earlier inspection retries also used owned
  projects and cleaned them in `finally`; no active project was changed.
- [Preservation](preservation.json): all seven public fixtures, 21 feedback original/copy pairs and
  48 frozen benchmark files remain exact. Earlier handoff bytes are preserved. Manifest deltas
  distinguish inherited UX01/UX02a changes from intentional operation/client changes here. No
  historical factory, benchmark implementation, sibling repository or source feedback changed.

Required checks use Node 24.21.0 / pnpm 12.16.1 with the Node path prepended:

| Check | Actual result |
| --- | --- |
| `pnpm lint` | Exit 0; unchanged 2,797 warnings / 88 infos, no errors |
| `pnpm typecheck` | Exit 0 across all workspaces/scripts, including existing source/test types |
| `pnpm --filter @jeeves/web typecheck` | Exit 0 |
| `pnpm --filter @jeeves/server typecheck` | Exit 0 |
| `pnpm --filter @jeeves/web build` | Exit 0; existing >500 kB chunk advisory |
| One-off direct API / browser / preservation inspection | Exit 0, with results above |

Command logs are under `checks/`; no maintained suite was introduced or executed. The initial
one-off script was corrected for the mutation response's extra operationId and bundled browser
settings having no standalone provider. A dev-server restart cleared Vite's stale resolution cache
for newly added files. The browser allowlist was extended to the owned layout PUT after the old
shell initialized its disposable layout. Initial evidence JSON formatting was corrected. These
verification setup corrections did not change product requirements or live project semantics.

The required operation-type expansion initially made the exhaustive `opCases` record fail to typecheck.
Added only two meaningful entries for the new operations as a narrow compilation compatibility
adjustment under the owner’s routine bug-fix direction. No type suppression, snapshots, new suite
or suite execution. Broader unit/E2E/template maintenance and suite execution remain deferred. UX02c owns reference remapping/portable
preservation/read-only legacy adaptation; UX03 owns definition descriptors. No runtime availability
or generated-build verification is claimed.
