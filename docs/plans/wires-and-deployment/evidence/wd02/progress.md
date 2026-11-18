# WD02 — board lanes through ELK

Complete for coordinator review on accepted WD01 `1a2bf592dd5324f2f2b75e0b7942d85121f0cd36`.

## Implementation and focused milestone

Applied the exact WD02 design: optional two-pass engine, per-line fixed ELK ports, disabled
edge merging and lane spacing in flat/banded passes, shifted alignment endpoints and tracks.
No change to the default graph/options, diagram schema, blueprint, chat, generation, settings,
templates, dependencies or board package boundaries. The studio does not enable lanes yet.

Four new real-ELK board tests cover the flat fork, existing named-port band fixture, three
22px arrivals and unlaned output isolation. Three new study tests check every forward route,
the specified <8px parallel overlap count and the 3s total limit. Return routing is outside WD02.
Original test bodies/assertions/fixtures remain byte-identical; the web file only gains imports
before its existing content. WD01 helper and tests are untouched.

Focused run: 7/7 pass (34 existing tests skipped). The default reporter suppressed successful
console output, so a second run of only the three study tests captured the required measurements:
3/3 pass (10 existing tests skipped). Both logs are retained under `/tmp/jeeves-wd02-*.log`.

| Study | First pass ms | Second pass ms | Total ms | Width before → lanes | Crossings before → lanes | Forward shared runs |
| --- | --- | --- | --- | --- | --- | --- |
| TinyURL | 35.83 | 35.14 | 70.97 | 1024 → 1120 | 0 → 0 | 0 (11 lines) |
| Marketplace | 34.32 | 32.82 | 67.14 | 1280 → 1344 | 1 → 1 | 0 (23 lines) |
| YouTube | 36.28 | 39.99 | 76.27 | 1504 → 1568 | 1 → 2 | 0 (20 lines) |

[Raw measurements](studies.json). Times are wall time on this machine for each complete engine
request, divided when its first lane-specific ELK graph is submitted; each pass includes the
band layouts and final routing. Width is `bounds.w`; crossings use `bandClashes(...).crossings`
on the whole layout, including returns. YouTube adds one crossing; crossing growth is not a
WD02 stop condition. All three stay below 3s, ELK throws no error, forward shared runs are zero.
No stop condition is met and no alternative design was introduced.

Only mechanical adjustments to the supplied snippets: actual Biome import sorting/wrapping,
expression wrapping, and removal of the now-unused `lineSourcePortId`/`lineTargetPortId` imports
from `bands.ts`. No type error or moved find text. Formatting used `tooling/biome.config.json`.

## Required checks and preservation

| Check | Result |
| --- | --- |
| Focused new real-ELK board/study cases | 7/7 pass |
| Study measurement receipt, explicit verbose output | 3/3 pass |
| `pnpm check` | Lint/types pass; 146 files / 1367 tests pass, including original board and WD01 tests |
| Native `pnpm test:e2e` | 87/87 pass in 5.0m, including TinyURL rendering and both mouse rebuilds |
| `pnpm --filter @jeeves/web build` | Pass; existing Vite large-chunk warning remains |
| Original test bodies/fixtures and unlaned golden behavior | Pass unchanged |
| Read-only RG21 preservation utility and own baseline comparisons | Pass |

Required checks ran once after the final executable/test files and JSON evidence were formatted.
No behavioral/type correction or successful full-check rerun was needed. Lint's eight warnings
and twelve informational diagnostics are inherited. Full logs are
`/tmp/jeeves-wd02-{check,e2e,build}.log`; focused logs are
`/tmp/jeeves-wd02-{focused,studies}.log`.

Starting own bytes/modes and all 7230 other tracked path states were snapshotted under
`/tmp/jeeves-wd02-*`. Final comparison preserves every protected byte/mode/absence state,
including all root files, owner feedback/archive changes, historical evidence, original apps,
WD01 helper/tests, frozen v1 and accepted SQL/dependency assets. All existing test bodies,
assertions and fixtures in both extended files are byte-identical after the web import additions.
The handoff is append-only and own starting file modes are unchanged.

The 42 original full container ID/name/state triples, 9 networks, 23 volumes, 43 images and both
old E2E project rows match the WD01 and starting inventories exactly. Own E2E projects left: 0.
The E2E servers exited; ports 4301/4311 are free. Owner ports 4300/4310 retain their original
listener PIDs and were untouched. No cleanup of unrelated resources was performed.

Two preliminary preservation-script assumptions were corrected, with no product/test changes:
the Docker image comparator first used a different output format than WD01, and the original-test
prefix comparator first expected the added web imports before Biome sorted them. Matching the
saved image format and actual added-import order confirms both preservation assertions pass.
No product or regression test failed.

No design/schema/blueprint/chat/generation/settings/template-support/dependency changes,
other unit, later brief, branch, worktree, stash, root/owner-studio edit, paid/live call, push or
deployment. The new layout path is opt-in; the studio does not enable it in this unit. Returns
keep the existing routing and are outside WD02. Stop here for coordinator acceptance.
