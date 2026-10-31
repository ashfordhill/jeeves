# P38 — API contracts and reference evidence

[Specification](../../build-plan-p38-api.md). Started clean at `0627fe5` on the
existing `main` checkout, one agent, no delegation/branches/worktrees. Read the
requested P37/review material; did not repeat C4 research.

## Viewer fit and dependency decision

Selected **Swagger UI Dist 5.33.3**, published **2026-10-15T13:31:32.343Z**, from
`pnpm view swagger-ui-dist version time --json` on October 31. The release was
sixteen days old and satisfies the two-week policy; automation-pitch has no existing
Swagger/Scalar pin. [Upstream releases](https://github.com/swagger-api/swagger-ui/releases)
and [supported configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
were checked. No additional C4 research or broad viewer benchmark.

Before integration, installed that exact release in `/tmp/jeeves-p38-viewer`, built
real fixture contracts using `resourceContract`, and served only on `127.0.0.1:4398`.
Chromium rendered all 16 QR architecture operations and 9 resource-fixture operations;
zero execution controls, script errors or external requests. Opened and inspected PNG
and redirect captures. PNG retained `image/png` and `Content-Disposition`; the 302
retained `Location`/`Cache-Control` and no response body. The integrated inventory
fixture additionally covers 12 non-QR session/warehouse/stock-item operations,
nullable/enum inputs and the `warehouseId` relationship.

The viewer uses a separate opaque sandbox frame so its bundled React and CSS do not
alter P37's shell. Both JS and inline vendor CSS come from the exact local package;
the lazy reference module is about **186 kB / 28 kB gzip**, plus **1.59 MB** vendor JS
loaded only when the viewer opens. Existing build chunk-size warnings remain.
`validatorUrl: null`, `supportedSubmitMethods: []`, disabled query configuration and
a rejecting request interceptor disable execution/validation. CSP `connect-src 'none'`
and the sandbox prevent API/ref requests, forms and navigation out of the frame.
Local installation analytics (`@scarf/scarf`) are explicitly disabled in `allowBuilds`.

The selected-operation view filters a cloned display document and adds purpose/group
labels. Full reference includes all operations. Neither changes the compiled document,
semantic model or generated output. Ordinary views hide acceptance IDs and extensions;
raw protected metadata is retained. Swagger's default version/location colors needed
small contrast fixes. Its vendor reference surface stays light inside either theme.

## Verification

Final production browser profile: `2026-10-31T20-27-53-659Z-browser-preview-1afc4c29`.
**23 tests passed / 8 suites**, Playwright **18.7s**, full profile **21.2s**, no retries,
strict diagnostics and unchanged source fingerprints.

```bash
pnpm work run browser-preview \
  apps/web/e2e/api-contracts.spec.ts \
  apps/web/e2e/editor-simplification.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/resources.spec.ts \
  apps/web/e2e/workspace.spec.ts \
  apps/web/e2e/template-upgrade.spec.ts \
  apps/web/e2e/chat.spec.ts
```

Mouse journeys cover grouped C3 selection, every operation once (16 QR / 12 inventory),
complete/selected reference, JSON/PNG/redirect contracts, resource-editor reuse,
GET/POST constraints, unsupported contract fields/CRUD duplication, exact schema
round trips, selection/scope/close draft retention, Save/Cancel, undo/redo/reload,
409 conflicts and protected recipes. Existing resource creation/generation, workspace,
chat, product/context and explicit-upgrade journeys also passed. The only expected
browser HTTP error is the specifically registered operation-conflict scenario.
Provider responses are scripted; generation uses disposable output.

Axe checks cover the API workspace in desktop/light and 390px/dark presentations,
plus WCAG 2 A/AA and 2.1 AA inside the actual opaque viewer frame. Existing suites
cover the other changed navigation/configuration paths. Request capture verifies
local-only viewer assets and no application or validator requests. The viewer's
request/authorization controls are absent. This is a bounded fit check, not a claim
of complete third-party accessibility certification.

`pnpm work run check` → `pnpm check` **passed**, profile
`2026-10-31T20-28-31-424Z-check-50e93611`, **42.2s**, unchanged source fingerprints.
All workspace/script typechecks passed. **672 tests / 101 files**, Vitest **34.41s**;
Biome checked **697 files**, **546 warnings / 75 infos / no errors**. Includes
builder equality for both existing REST pins, non-mutating revisioned API reads,
generation golden/compatibility checks, strict contract-edit round trips and a
regression distinguishing 302 redirects from body-free 304 responses. Focused
preview/editor/server tests also passed before the full gate.

Interim logs remain in `.jeeves-work/runs/`. They record fixes for default viewer
contrast, selected-reference focus, duplicate ungrouped headings, obsolete disclosure
selectors, an invalid conflict-test setup and test fixture typing. The opaque frame
blocked axe's attempt to fetch an external CSSOM stylesheet; locally inlining the
vendor CSS made the stylesheet inspectable without relaxing `connect-src 'none'`.
One overlapping full-check/browser attempt timed out an existing server restart test
and exposed an upgrade test's premature camera snapshot. Final gates ran separately;
no timeout/retry was increased and no diagnostic was suppressed. Cleanup in the
existing resource test now leaves C2 through its layout-flush path before deleting
its project; upgrade verification waits for a persisted mouse-chosen camera.

## Inspected screenshots

Opened and visually inspected all six captures from the final successful run.

| Capture | Observation |
| --- | --- |
| [Operations](operations.png) | Selected analytics row stays in view; concise purpose, owner access, dates and every status; compact C3 responsibility shell remains behind it. |
| [PNG reference](image-reference.png) | Local viewer shows `image/png`, binary schema and Content-Disposition without an execution control. |
| [Redirect reference](redirect-reference.png) | 302 shows Location and Cache-Control, with no invented JSON body. |
| [Inventory reference](inventory-reference.png) | Non-QR JSON body exposes stock-item fields, enum/nullable values and warehouse relationship. |
| [Conflict draft](conflict.png) | Saved route stays unchanged while `/api/conflict` remains in the draft, with a visible conflict and reachable Save/Cancel. |
| [Narrow dark](narrow-dark.png) | Selected inventory operation, scrolling list and fixed close/footer fit a 390px viewport. |

Only evidence/planning/handoff documentation and screenshot copies changed after
the final checks. Removed **46** session-created projects from `jeeves_e2e` and
**114** session-created E2E settings/output directories, restricted by exact test
names and the session time window. Stopped the temporary fit server on 4398.
Retained existing projects, logs and shared Postgres. Existing dev API health on
4310 is OK. Live QRWTY source, services, saved design and data were not edited.

## Boundaries and limitations

- Preview is a no-store server projection of a saved revision, using the existing
  generation builder and exact old/new REST pin. It reads no generated files and
  contacts no running application. Empty, invalid, missing-template and legacy
  project-owned contracts have explicit states. A running app may be older.
- Resource CRUD uses the existing structured resource editor. Existing project
  extensions edit GET/POST path, access, notes and the supported single-operation
  JSON contract. Arbitrary schema keywords/examples/headers/media survive round trips;
  unsupported contract fields, extra HTTP methods and duplicate CRUD routes fail
  validation with the draft retained. There is no new YAML source or general import.
- Valid recipe bindings now reject incompatible mutations at the shared edit API,
  in addition to existing UI/generation protection. Historical invalid recipes can
  still be repaired. Template/runtime pins and generator bodies are unchanged.
- Purposes come from documented success descriptions, not guessed route semantics.
  Full schema detail is the viewer's responsibility. Existing generated PATCH contracts
  use the builder's creation-input schema while the runtime accepts partial updates;
  P38 preserves that output and notes partial updates in the concise detail view.
- This is design/reference/UI evidence, not live API, binary decoding, load or runtime
  certification. C4 implementation, data/deployment authoring, new runtimes, source
  analysis, broader methods and live QRWTY adoption remain separate packages.
- Catalog offerings/availability/C1–C3 boundaries did not change; `CATALOG.md` is unchanged.
