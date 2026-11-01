# P47 — Interface and contract authoring

P47 adds reusable project-local definitions and provided/required interfaces to component,
container and external-system inspection. The diagrams retain their existing boundaries;
endpoint details stay in inspection. Application runtimes and generated behavior are unchanged.

Definitions have a stable ID, explicit version, name, kind and description. Planned API and
in-process operations have bounded input/output fields; events and logical datasets have
bounded payload fields, including an explicit unresolved type. Interface instances name a
provider or consumer and reference one exact definition/version. Domain interfaces do not
need a new catalog family. Unbound required uses and unresolved shapes are saveable review
findings, separate from the findings consumed by generation readiness.

Existing REST operations use stable element/attachment/member ownership references, including
resource operation identity and session operations. Resource datasets and durable-event
members use their existing schemas. Their current authoritative shapes are read-only;
REST inspection also shows the existing P38 API projection. A canonical saved source snapshot
plus the author's saved base design revision identifies the reference. Relevant shape changes
or source removal mark it stale; no compatibility or runtime claim survives source drift.
No generated contract can be edited through this editor.

Names and descriptions can change without rewriting references. In-use shapes are protected:
Create version requires an explicit version, previews current provider/consumer instances,
and updates only selected instances. Other consumers retain their old exact versions.
Unreferenced drafts remain editable. Structural duplicates, dangling definition/owner references
and invalid source ownership reject an entire operation batch. Remove a component's interfaces
before removing the component; source removal can remain as visible stale intent.

Save/Cancel, one-step undo/redo, reload and revision conflict handling use the existing operations
API. A conflicting dialog retains its draft and original base snapshot, so a second Save cannot
overwrite the concurrent edit. Chat discovers sources/review through `getArchitectureContracts`
and uses the same schemas and validators; several tool edits still commit as one undo step.

## Inspected captures

Actual 1440 × 900 light and 390 × 844 dark Chromium captures. The body scrolls independently
of fixed Save/Cancel actions. Protected values retain readable text contrast. Narrow diagrams
remain fitted overviews; the inspector opens the same editor by mouse.

- [Exact versions and required-interface inspection](p47-versions-light.png)
- [Explicit consumer update preview](p47-consumer-preview-light.png)
- [Narrow dark editor](p47-versions-dark.png)
- [Narrow payload inspection](p47-payload-dark.png)
- [Stale authoritative REST source](p47-source-stale.png)

## Verification boundaries

Focused spec/generator/chat checks cover reuse, rename, v2 with retained v1 instances,
immutability, ownership/reference rejection, unresolved intent, source drift and atomicity.
Generation equality excludes only the intentionally lossless `jeeves/design.json` snapshot;
artifacts, executable files and element ownership stay equal. Existing API contract browser
coverage retains protected recipe behavior. Browser flows also cover mouse authoring,
Save/Cancel/history/reload, a retained conflict, container/external owners, accessibility,
narrow overflow and strict diagnostics.

Exact final commands, counts, run IDs and limitations are recorded in the P47 entry of
[the handoff](../../handoff.md). No dependency, runtime/template, generated contract/golden,
or live QRWTY change is included. P48 supplies relationship bindings and policies; P47 does
not compile declarations into runtime ports/adapters or infer semver compatibility.

Final recorded checks (unchanged fingerprints during each run):

| Check | Result | Run |
| --- | --- | --- |
| Focused contract/generator/chat suites | 40 passed / 4 files | `2026-11-01T03-05-38-772Z-unit-46283bf6` |
| `VITEST_MAX_WORKERS=4 pnpm work run check` | 769 passed / 111 files; all typechecks; no lint errors | `2026-11-01T03-05-57-218Z-check-c0b9716b` |
| P47, API contract and architecture authoring browser suites | 10 passed | `2026-11-01T03-05-57-218Z-browser-preview-c5d57e6d` |
