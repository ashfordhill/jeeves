# NC14 evidence

The independent [review ledger](../../nc14-review.md) records four confirmed corrections and
remaining gaps. The separate [backend build plan](../../backend-first-proof-plan.md) is a plan
only; no runtime, generator, assembler, registry, runner, new repository or paid model call exists.
Frozen Create/Resolve/cache/profile record bytes and old TinyURL source/legacy fixture match their
original commits exactly; [frozen-identities.json](frozen-identities.json) records byte hashes.

With Node **24.21.0** first in PATH, required checks ran sequentially against frozen source:

- `pnpm check`: Biome, all typechecks and **380 tests / 46 files** passed (`check.log.gz`).
- `pnpm test:e2e`: **32 native Chromium tests**, **50.3s**, passed (`e2e.log.gz`). No source edits
  overlapped the suite. The new test opens/edits the legacy disclosure, preserves declared facts,
  undoes/reloads and checks the API role wording; existing schema2 tests remain unchanged.
- `pnpm --filter @jeeves/web build`: passed in **843ms** (`build.log.gz`), with the existing large
  chunk advisory. Final lint and diff checks are retained separately.

The ten additional unit cases cover missing/mismatched/changed executable-suite identity and
weaker-format refusal, Create's actual source protocol/security/interaction (including saveable
Unspecified protocol and unknown-operation non-inference), atomic refusal, and detached ownership
export rows. Suite v2 hash-resolves its exact execution bundle; arbitrary positive fixture bytes
exercise trust plumbing only, never code execution or real runtime behavior. Frozen profile and
operation identities are unchanged. New initial focused-test attempts exposed test-authoring
errors (an invalid operation name, structural-stage assertion and non-Studio protocol label);
`focused-first.log.gz` / `focused-second.log.gz` retain those failures. The corrected focused and
full required suites passed. The initial probe script is retained; its pre-fix structured result
was observed in the review session rather than saved as a raw transcript file.

[results.json](results.json) records successful actual mouse walkthroughs at **1440×900** and
**1280×800** with zero page/console errors. Each chooser-created foundation has six collapsed /
seven expanded tiles and seven relationships. Explicit source authority/grants remain primary;
legacy facts and the old writer editor are initially collapsed. Mouse expansion/edit changes only
legacy writer metadata, not authority/grants/operations or the complete declaration result; one
Undo and reload restore the source. Source/cache/connection selection, focus/Fit/Show all preserve
full saved design and v3 blueprint after the known Undo revision difference. Declared role headings
and connection requests are qualified. The old extended schema2 study remains eleven tiles /
twelve lines with its original Owner/readers/Microservice inspector and unchanged v2 export.

All **33 retained PNGs were inspected**: 26 main walkthrough frames, four role close views and
three early coordinator frames. `1280-create-role-close.png` / `1280-resolve-role-close.png` show
the whole API role explanation after mouse-collapsing operation details; equivalent 1440 frames
are retained. Legacy closed/open/edited frames show the preserved writer control below explicit
facts. Some initial Connections-tab frames leave rows near/below the viewport edge; the script
then clicks the actual row, and relationship frames show its explicit request and legacy
disclosure. Scrollable inspector content is not a claim that the broader overview UX is solved.
The coordinator accepted this bounded change; owner usability acceptance remains open.

[audit.json](audit.json) measures actual strict-provider tools, not source-schema guesses.
Compared with NC06: strict tools **70,336 UTF-8 bytes**, instructions **15,427**, retained schema2
TinyURL context **17,016**: all unchanged. Foundation context is separately **17,019**. Giant
command union remains 427 properties / 538 enum values / depth 9; configureOperations 74 / 17 / depth 7.
These are bytes, not token usage, request cost, latency or model-quality measurements.

The full unit suite includes deterministic network-forbidden replay of all twelve synthetic
case/arm pairs. Historical RF06 as-run files remain untouched. The separate fetch-forbidden
[drift audit](replay-drift.json) reproduces the old first-request mismatch before any response:
`77669bb5b59a1dbcc98c08bbcd07d3a70a2cae54f285972bc6650417b2995a6b` →
`80781cbcb98dddf6c38b37ddc032d17af98e7646c4113a2a5da1465f20e6424e`.
The shared scoped context/readiness/selection additions explain it; NC14 leaves the NC06 request
identity unchanged. Intended Mini had no credits/no response; neither live strict acceptance nor
live design quality is established. The historical Codex Sol/medium fallback's 2.44× input /
2.07× responses is not a general quality win.

Every owned early/main/close-view project was deleted 204; the full E2E suite deletes its projects.
[scratch-projects-final.json](scratch-projects-final.json) equals the initial listing, containing
only the original default. [owner-projects-final.json](owner-projects-final.json) equals its initial
listing: TinyURL 53 / YouTube 1 / Marketplace 1, read-only throughout this unit. Only own 4312/4302
listeners were stopped; owner 4310/4300 remain (`listeners-final.txt.gz`). The isolated scratch
settings path was never created. An initial combined rm-style housekeeping command was rejected
before execution; inspection and explicit known-PID termination completed cleanup without
settings deletion. `.jeeves-feedback/` remains untouched.

[raw-evidence.json](raw-evidence.json) records byte counts/SHA256 for PNGs and lossless gzip
originals of scripts/logs/JSON, including pre-format JSON and failed attempts. Raw originals stay
in `/tmp/jeeves-nc14-browser/`; the duplicate final screen is not archived. No old evidence or
feedback image was overwritten.
