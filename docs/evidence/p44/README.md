# P44 — Design assistant knows the library

[Specification](../../build-plan-c4-saas.md#p44--design-assistant-knows-the-library).
Started clean at `140f956` on the existing `main` checkout; one agent, sequential
work, no branches/worktrees or delegation.

The design assistant now discovers every planned C2/C3 family through
`listPlannedCapabilities` and reads its fields, choices, defaults, schema and
compatible component host roles through `describePlannedCapability`. Both reuse
the existing planning catalog. Implemented templates retain their separate tools.
The per-turn context includes planned identities, options currently selected,
descriptions, technology, relationship metadata and the complete existing C1/C3
architecture so subsequent edits can preserve it.

Prompt rules cover C1 without technology, one-line descriptions, proposed C2/C3
technology, verb/protocol relationships, asynchronous line semantics, at most
15 initial containers and 10 responsibilities per host, host compatibility,
external identity reuse and whole-architecture replacement. Unknown capabilities
must use an appropriate generic responsibility or an explicit placeholder;
invented IDs/options are refused by the shared validator. Planning choices have
no runtime and continue to block generation.

The existing operations schema already accepted all required design metadata,
planned connections and `setArchitecture` components. This package exposes and
explains those contracts to chat; it adds no parallel editing path. Multiple
successful tool batches still commit as one revision and undo step.

## Verification

- `pnpm work run unit apps/server/src/chat/chat.test.ts apps/server/src/chat/context.test.ts apps/server/src/chat/tools.test.ts`
  passed **18 tests / 3 files**, Vitest **3.66s**, profile **4.1s**;
  `2026-11-01T00-27-09-788Z-unit-ef8330b1`.
  Tests cover every catalog family's options/schema/host roles, scope filtering,
  rejection of invented IDs/options and incompatible C3 with no partial writes,
  honest placeholder recovery, complete context and context-only designs. The
  scripted bit.ly conversation discovers/describes families, prepares C2 and C1/C3
  in separate batches, persists everything at revision 1, undoes it together,
  redoes it and supplies the full architecture to the next conversation.
- `pnpm work run browser-preview apps/web/e2e/chat-planning.spec.ts apps/web/e2e/chat.spec.ts`
  passed **6 tests**, Playwright **10.6s**, profile **12.8s**, no retries;
  `2026-11-01T00-29-10-612Z-browser-preview-64462c8b`, unchanged fingerprints.
  The new mouse journey sends the planning brief, traverses C1/C2/C3, checks
  planning status and labels, undoes/redoes the full turn and reloads. It then
  edits the chat-authored responsibility through the existing options dialog,
  exercises Cancel/Save/undo/redo/reload, and checks accessibility at each capture
  and in the narrow dialog. Existing implemented chat, subtype review, clickable
  questions, uploads/placeholders and settings pass. Strict browser diagnostics
  remain enabled.
- `pnpm work run check` → `pnpm check` passed: **742 tests / 108 files**, Vitest
  **34.04s**, profile **42.2s**, all workspace/script typechecks. Biome checked
  **718 files**, **645 warnings / 75 infos / no errors**;
  `2026-11-01T00-29-23-534Z-check-34a16d0c`.
  Generator golden/ownership checks pass with no fixture changes. The runner
  flags changed fingerprints because the eight screenshot copies and sanitized
  real-provider JSON were added under this evidence directory during the check;
  code, tests, existing fixtures and planning documents were unchanged. The JSON
  was separately formatted/checked, and final `pnpm lint` also passed on **719 files**, with **645 warnings / 75 infos / no errors**, covering the completed evidence.
- `git diff --check` and local documentation targets checked before commit.

An initial focused test expected six findings, omitting the two planned-connection
findings; the correct expected total is eight. An expanded browser check initially
assumed editing retained component array order; the shared editor replaces the
edited component at the end, so assertions now find the stable component ID.
Neither issue required product changes, timeout/retry increases or diagnostic
suppression. Intermediate logs remain under ignored `.jeeves-work/runs/`.

## Real-provider smoke

The configured design-chat provider was **Codex**, using its **provider default**
model (actual model identity is not reported by this adapter). The manual smoke
used the real provider through the updated ChatService/API with an isolated
in-memory PGlite database. It left live projects and provider settings untouched.
Its synthetic brief requested a small bit.ly planning study with owners,
visitors, click activity, C1/C2/C3 and reasonable defaults.

The turn completed in **55.277s / 4 model rounds**, with **94,657 input / 2,357
output tokens** reported. It read the design and planning library, described six
families and applied seven operations: three planned containers, two planned
connections and context with four API responsibilities. All tool activities
succeeded; the nine remaining findings were expected `NEEDS_TEMPLATE` planning
findings. One undo cleared both design and architecture; redo restored them.
[Sanitized request, reply, activity and resulting design](real-provider.json)
record the concrete result. Credential values and provider configuration are
excluded. Ignored raw logs remain in `.jeeves-work/p44/`.

This is one successful provider sample, not a guarantee of every model response.
No runtime, generated application or live QRWTY adoption was performed. Eight
screenshots were inspected: desktop **1440 × 900 light** and narrow **390 × 844
dark**. Narrow diagrams remain fitted overviews with mouse zoom/inspection.

| View | Light | Dark / narrow |
| --- | --- | --- |
| Chat turn | [Chat and atomic edit activity](p44-chat-light.png) | — |
| C1 | [Context](p44-c1-light.png) | [Context](p44-c1-dark.png) |
| C2 | [Containers](p44-c2-light.png) | [Containers](p44-c2-dark.png) |
| C3 | [API responsibilities](p44-c3-light.png) | [API responsibilities](p44-c3-dark.png) |
| Component options | — | [Editable chat-created responsibility](p44-component-options-dark.png) |

Removed twelve exact-ID session-created E2E projects and 129 session-created
settings/output directories. The new journey deletes its own project, including
on failure. Shared Postgres, pre-existing data/logs and Jeeves on 4310 were retained;
its health remains OK. Next: **P45** dynamic scenarios.
