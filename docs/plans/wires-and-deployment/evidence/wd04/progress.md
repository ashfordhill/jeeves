# WD04 — board wires

Complete for coordinator review on accepted WD03 `0c545f9ee68ffae11d0374274d6c9ffe43aa1978`.

## Change and focused evidence

Implemented the prescribed optional `wireArt` geometry, `WireTone`, board `lanes`/`wire`/`dot`
props, outline/fill/beads/soft-head rendering, chip reuse and CSS. The board stays generic.
Without these props the old layout and rendering branch remain unchanged. No studio caller
enables them yet, so this unit makes no claim about visible studio wire behavior.

All 11 named focused cases pass (15 existing board cases skipped by the focused name filter):
six pure geometry cases cover straight routes, 36px fans, two rounded corners, 0.75 gathers,
undirected ends and upright heads. Five board cases cover wire path/fill/head counts with no
crossing, mouse selection and outline stroke, async beads, real-ELK lane ranks 0/1/2 of 3, and
dots only when supplied. Additional assertions cover the 12px hit band, mouse chip selection,
and live/frozen dot and wire rendering. No network, database or Docker is used by these tests.
Every preexisting board test body/assertion/fixture is byte-preserved; the existing file gains
only one import and a new nested `describe("wires")`.

The snapshot implementation has moved since the plan: `snapshot()` clones the live resolved
layout rather than calling `layoutInput`. Passed `lanes` at the single current call and added
`dot` to both live and frozen node-data builders. Mechanical changes only: actual Biome import/
expression wrapping, including the new tests. A preliminary targeted formatting report was
resolved with the configured formatter. No failed executable/full gate, supplied type/algorithm
correction, design stop or alternative design.

## Required checks

| Check | Result |
| --- | --- |
| Focused wire geometry/render tests | 11 pass, 15 skip |
| `pnpm check` | Lint/types pass; 147 files / 1380 tests pass, 194.57s |
| Native `pnpm test:e2e` | 87/87 pass, 6.4m; TinyURL and both mouse rebuilds included |
| `pnpm --filter @jeeves/web build` | Pass; existing Vite large-chunk warning |
| Original board cases, own modes, protected paths and resource audit | Pass |
| Reused read-only RG21 preservation audit | Pass |

Full gates each ran once after the final executable/test change; no successful check was rerun.
Lint's 8 warnings and 12 informational diagnostics are inherited. Logs:
`/tmp/jeeves-wd04-{focused,check,e2e,build}.log` and
`/tmp/jeeves-wd04-{preservation-initial,preservation-final,rg21-final}.log`.

## Preservation and limits

Starting own bytes/modes are saved in `/tmp/jeeves-wd04-starting-files.json`; all 7257 other
tracked or untracked nonignored byte/mode/absence states compare exactly with the starting
snapshot. This covers root/owner changes, feedback archives, historical evidence, original apps,
other board files, accepted SQL/dependencies and frozen v1. The handoff is append-only and own
starting modes are unchanged.

All 42 original full container ID/name/state triples, 9 networks, 23 volumes and 43 images match
WD03's and the starting inventories exactly. Both old E2E project rows are unchanged; own
projects left: 0. E2E servers exited and ports 4301/4311 are free. Owner 4300/4310 listener PIDs
are unchanged. No cleanup of unrelated resources was needed or performed.

No root/owner-studio/original-app/historical-evidence edit, design/schema/blueprint/chat/generation/
settings/template-support/dependency change, later unit, branch/worktree/stash, live/paid call,
push or deployment. Stop for coordinator review.
