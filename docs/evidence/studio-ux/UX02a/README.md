# UX02a — strict studio schemas and reference validation

Complete model-only assignment on primary `main`, based on UX01 commit
`1c7fb2aa345d9dc41792d175e099dd0888518d63`. No definition/runtime template registration,
UI authoring, provider/generation job, project mutation, sibling edit, branch or delegation.

Implemented `studio-model.ts` and `studio-validation.ts`, exported through spec. The optional
`architecture.studio` has strict version-1 structure, all 14 settings kinds, exact slug/version
references, packages, logical ownership and connection policies. Shared enums, numeric bounds,
engine/provider tables and explicit creation defaults are exported for later definitions/forms.
Docker creation and unspecified language are separate choices; managed execution requires its
explicit host and Docker rejects hidden host settings. Browser delivery has its own union.
Parsing supplies no studio defaults. Unknown studio versions reject explicitly; unknown exact
definition IDs/versions remain preserved, unresolved design intent with a readiness finding.

Schema validation handles types, strict keys, ranges, duplicate bindings/memberships and finite
compatibility. `validateStudio`, called by existing semantic validation, handles real targets,
classification/clean bindings, package/global ID collisions, ownership, served-by/CDN/lookup refs,
planned canonical relationship fields, queue roles/direction and timeout/retry applicability.
Invalid references yield structural findings at the existing batch rejection boundary. The
existing `NEEDS_TEMPLATE` readiness code distinguishes design intent from generation support;
there are no new finding codes requiring deferred test maintenance. Package IDs participate in
`designIds`. Grouping does not give a package deployment settings.

Evidence:

- [Schema observations](schema-observations.json): all seven UX01 public inputs parse; all 14
  kinds also parse together in one finite design; 70 malformed cases reject, including an example
  from every invariant family. Large duplicate cases retain five sample issues plus the full
  issue count. All 83 database/cache/search engine-provider combinations match the finite tables.
  Valid bounded HTTP timeout/fixed retry, managed host, browser serving, CDN origin and redirect
  store/cache references parse and validate. Unknown `studio-billing@9.9.9` stays unresolved.
- [Legacy observations](legacy-observations.json): both legacy public inputs, all nine shipped
  factories, annotations/backend declarations and focused-layout input retain their previous
  parser behavior. Their raw factory/source hashes remain UX01's values. The old parser is
  reconstructed by omitting only the new optional `studio` property from the same architecture
  shape; its parsed output equals the new parser's output for old inputs. JSON parse/serialize/
  parse is stable and adds no studio property; a v1 empty document is also unchanged.
- Parsing has always normalized schema key order and trimmed applicable descriptions. The rich
  Discourse factory has a few pre-existing trailing-whitespace description normalizations. This
  evidence compares the previous parser with the new one, and keeps raw hashes separate from
  normalized parsed hashes. It does not claim raw input serialization equals parsed serialization.
  No old fixture or factory was edited to make that comparison pass.
- [Browser observations](browser-observations.json): existing QRWTY C2 and API C3 at 1440×900 and
  1280×800, with actual screenshots under `screenshots/`. Both sizes retain 16 C2 cards/21 labels
  and 22 C3 cards/39 labels. Saved cameras can place content outside the viewport, as in UX01.
  New spec modules also parse the public package directly in the browser, with a design-only
  readiness result. No console warnings/errors, page errors or HTTP errors were observed.
- Before creating a browser page, a context guard allowed only GET/HEAD/OPTIONS and blocked all
  other methods. No mutation request was attempted. Semantic/layout hashes and revisions of all
  13 pre-existing projects match before/after. No disposable project was needed for this read-only
  inspection; no provider or generation route was called.
- [Preservation](preservation.json): seven public fixture files, 21 original/copied feedback pairs,
  all 48 frozen benchmark files and old factory outputs remain unchanged. Four baseline source
  files have the intentional schema integration changes. The prior UX01 derived JSON newline
  correction is recorded as inherited; UX02a does not edit it. Earlier handoff bytes are preserved.

Required checks use Node 24.21.0 with `/home/ash/.nvm/versions/node/v24.21.0/bin` prepended to PATH:

| Check | Actual result |
| --- | --- |
| `pnpm lint` | Exit 0; existing 2,797 warnings / 88 infos, no errors |
| `pnpm typecheck` | Exit 0 across all workspaces and scripts |
| `pnpm --filter @jeeves/web build` | Exit 0; existing >500 kB chunk advisory |
| One-off schema/round-trip inspection | Exit 0; seven fixtures, 70 rejection cases, 14 kinds, nine old factories and 83 compatibility combinations |
| Direct installed-Playwright browser inspection | Exit 0; four desktop views, 13 live projects unchanged, browser parsing passed |
| Scoped Biome / Git whitespace / preservation | Passed |

Actual logs and [command results](checks/results.json) are under `checks/`. CLI log trailing
whitespace is trimmed for Git hygiene; command text, diagnostics and outcomes are retained. Initial lint errors
were confined to formatting the new observation JSON and one new callback, all corrected. The
one-off scripts used installed tsx/Playwright and remained local inspection tools, not maintained
unit/E2E tests. Early inspection setup retries used the wrong pnpm-filter working directory,
assumed byte-identical parse ordering, or supplied an incomplete lookup stub; they were corrected
before the passing observations. No application data was written during those retries.

Unit/E2E/template suites, snapshots and `pnpm check` remain deferred by the owner. Atomic studio
commands and a direct generation guard belong to UX02b; copy/remapping/portable preservation and
legacy display mapping belong to UX02c. Catalog definition descriptors are UX03. The normal UI is
unchanged. P73a/P73b/backend work remains paused. This worker stops at the UX02a local commit.
