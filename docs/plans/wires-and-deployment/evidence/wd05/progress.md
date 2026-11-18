# WD05 — wire colour rule and saved slots

Complete for coordinator review on accepted WD04 `6b6bd124a811e39139fdef64170028b160b0e957`.

## Change and focused evidence

Implemented the exact prescribed `wireHue`, `wireTone`, `wireStep` and `assignWireSlots` pure
functions, plus the project/browser-local `Preferences.wires` record, empty default and saved
slot validation. Nothing draws with them yet. The existing hook persists the record alongside
canvas view preferences; it never enters the design, history, blueprint or chat.

All 11 focused cases pass: four new colour cases, five new preference cases and the two existing
preference cases. These cover the twelve hue spacings and skipped sky-blue sector, later-round
offset, distinct theme hex tones, neutral slate, shade permutations for one through fourteen
lines, stable slots/lowest-free reuse, empty/saved preferences and negative/fraction/string slot
rejection. No network, database or Docker is used by these unit tests. Existing preference tests
are byte-preserved as a prefix; every board source/test file is untouched. The colour source is
verbatim to the approved block.

The initial targeted Biome check found only the supplied slots predicate's line wrapping;
formatted that one file with actual `tooling/biome.config.json`. No algorithm/type correction,
moved find, design stop or alternative design.

## Required checks

| Check | Result |
| --- | --- |
| Focused colour/preferences tests | 11/11 pass |
| `pnpm check` | Lint/types pass; 148 files / 1389 tests pass, 195.87s |
| Native `pnpm test:e2e` | 87/87 pass, 6.4m; TinyURL and both mouse rebuilds included |
| `pnpm --filter @jeeves/web build` | Pass; existing Vite large-chunk warning |
| Protected paths, modes, board/preference assertions and resource comparison | Pass |
| Reused read-only RG21 preservation audit | Pass with process-local seven-digit Git abbreviation |

Each full gate ran once after the final executable/test change. Existing lint warnings (8) and
informational diagnostics (12) remain. No extra manual browser run: WD05 exposes no visible
behavior. Logs: `/tmp/jeeves-wd05-{focused,check,e2e,build,preservation-final}.log`.

The reused RG21 audit initially differed only in three Git `index` headers: automatic hash
abbreviations grew from seven to eight digits after WD04. The unchanged audit passes with
process-local `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.abbrev GIT_CONFIG_VALUE_0=7`; the owner
patch matches exactly, 34021 normalized bytes. No Git configuration file or prior baseline was
edited. Initial `/tmp/jeeves-wd05-rg21-final.log` and corrected
`/tmp/jeeves-wd05-rg21-corrected.log` are retained. An unscoped read-only `git diff --check`
also reported inherited root/feedback CRLF whitespace; those bytes are unchanged and the scoped
WD05 diff check passes.

## Preservation and limits

Starting own bytes/modes are saved in `/tmp/jeeves-wd05-starting-files.json`. All 7262 other
tracked or untracked nonignored byte/mode/absence states match the starting snapshot exactly,
including root/owner changes, feedback archives, historical evidence, original apps, board
sources/tests, accepted SQL/dependencies and frozen v1. Own starting modes are unchanged and
the handoff is append-only. Only the six explicit WD05 paths change.

All 42 original full container ID/name/state triples, 9 networks, 23 volumes and 43 images
match WD04 and the starting inventories exactly. Both old E2E rows are unchanged; own projects
left: 0. E2E servers exited and ports 4301/4311 are free; owner 4300/4310 listener PIDs are
unchanged. No unrelated cleanup was needed or performed.

No root/owner-studio/original-app/historical-evidence edit, design/schema/blueprint/chat/generation/
settings/template-support/dependency change, later brief/unit, branch/worktree/stash, live/paid
call, push or deployment. Stop for coordinator review.
