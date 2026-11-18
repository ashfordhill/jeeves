# WD03 — board returns in lanes

Complete for coordinator review on accepted WD02 `4aa656cc4714fcf25c74118ed96f681ab40b8189`.

## Change and focused evidence

Applied exactly the prescribed `returns.ts` edits: lane offsets at both endpoints; upright slots
past `LANE_APPROACH` in `LANE_GAP` steps; lane rows in `LANE_GAP` steps; no grid penalty with
lanes; and the 8px parallel-run clearance. Sharing rules, widening, fallback and the default
path remain unchanged. No other production file changes. The board stays generic and the
studio does not enable lanes yet.

Before edits, the exact required fixture’s `endColumns` were a/b1/b2/c/s = 0/1/1/2/2 and
`comesBack(c→s)` was true. Both new real-ELK cases assert that premise before layout. The single
return has six points from c’s right edge to s’s left edge. Two returns from c’s out ports r1
(y64) and r2 (y96), on a 256×192 tile, have six points, start on their named rows, enter s’s left
edge, and have level runs 11px or 22px apart. Both complete fixtures have zero shared runs.

Extended WD02’s three study tests with every-line route and whole-layout `sharedRuns === 0`
assertions, retaining all original forward-route/shared-run/time assertions. All pass with real
ELK. Corrected focused run: 13 pass/30 skip. The selection also includes four existing study/
hint cases because their names contain “lanes”. Total lane layout times were 41.52/50.21/79.80ms
for TinyURL/Marketplace/YouTube, with widths 1136/1376/1627px; whole-layout shared runs are zero.
No ELK design failure, false premise or other stop condition occurred. No alternate design.

Initial focused run: 12 pass/1 fail/30 skip. My new named-port fixture omitted required
`side: "out"`; `checkPorts` rejected it before ELK. Added only the required out-side declarations
to the new fixture, matching the brief; no premise, existing fixture or assertion changed.
Both logs are retained. Biome wrapped the new test object/expression using
`tooling/biome.config.json`; no supplied production type/algorithm correction or moved find text.

## Required checks

| Check | Result |
| --- | --- |
| Focused real-ELK board/study run after fixture correction | 13 pass, 30 skip |
| `pnpm check` | Lint/types pass; 146 files / 1369 tests pass, 195.56s |
| Native `pnpm test:e2e` | 87/87 pass, 6.4m; TinyURL and both mouse study rebuilds included |
| `pnpm --filter @jeeves/web build` | Pass; existing Vite large-chunk warning |
| Original board bodies/assertions/fixtures and preserved web assertions | Pass unchanged/extended only |
| Own tracked-state/resource audit and reused read-only RG21 preservation | Pass |

Full gates each ran once after the final executable/test change. No successful full check was
rerun. Lint’s 8 warnings and 12 informational diagnostics are inherited. Logs:
`/tmp/jeeves-wd03-{focused,focused-corrected,check,e2e,build}.log` and
`/tmp/jeeves-wd03-{preservation-initial,preservation-final,rg21-final}.log`.

## Preservation and limits

Starting own bytes/modes and 7235 other tracked byte/mode/absence states are saved under
`/tmp/jeeves-wd03-*`; all protected states compare exactly after checks. This includes root/
owner changes, feedback archives, historical evidence, original apps, WD01 and other board files,
accepted SQL/dependency assets and frozen v1. The existing board test content differs only by
one import and appended new cases; the web test gains only its three assertion lines. The
handoff is append-only, and own starting file modes are unchanged.

All 42 original full container ID/name/state triples, 9 networks, 23 volumes and 43 images match
the original/WD02/starting inventories exactly. Both old E2E project rows are unchanged; own
projects left: 0. E2E servers exited and ports 4301/4311 are free. Owner 4300/4310 listener PIDs
are unchanged. No unrelated cleanup was needed or performed.

No design/schema/blueprint/chat/generation/settings/template/dependency change, root edit,
original app or historical evidence write, owner-studio access, later unit, branch/worktree/stash,
paid/live call, push or deployment. This unit proves optional board routing; the studio still
draws its default path, so no lane UI behavior is claimed. Stop for coordinator review.
