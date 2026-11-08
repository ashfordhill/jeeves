# FP06b — creator and real multipart evidence

2026-11-07 local / 2026-11-08 UTC. Base FP06a `65f3a33b5a16418f8ae414628def67c7da8bab77`, immutable
baseline `02ac280da62616e9c7aad7f88457dcb72084cb25`. Sequential Sol/xhigh sole writer on primary main;
no delegation, branch/worktree/stash/push. Active time/turns/tokens/cost and savings remain unknown.
[Exact next-unit handoff](../../fp06b-upload.md), [file provenance](provenance.json).

| Frozen scenario | This unit's bounded result |
| --- | --- |
| S01 | **Staged subset only:** in-repo safe first-run, initialized Upload/edge/providers, mouse creator identity/login/actual provider logout. Outside-checkout own frozen install/build/four network-free checks and Docker edge build pass; no outside-copy runtime startup/all-services S01 claim. |
| S02 | **Pass for upload:** three real PUTs5MiB/5MiB/5,099,193B, readable ETags and authoritative ListParts; complete/repeats202 preserve IDs; anonymous start/sign/complete401; other creator status/sign/complete/abort404 and empty recent list. Independently streamed completed object SHA/size matches actual fixture. |
| S03 | **Pass bounded refresh/reselect:** after acknowledged nonfinal part1, pause/refresh/reselect/resume same upload; successful resumed PUTs only2,3. Separate partial upload aborted by mouse; repeat abort200, complete410; provider multiparts0. |
| S04–S07 | **Not implemented/run.** Durable queue2/consumers0, pending metadata2, aborted1; no ready/publication/search/count result. |
| S08 | Partial finite-error observations only: invalid JWT visibly401/sign-in, oversize413 and non-MP4 declaration422, anonymous private original403, normal subset stop/start retains records. Final integrated S08 is still open. |

`browser-result.json` stores sanitized response projections, original ListParts/ETags, stable IDs,
error messages and successful PUT numbers. The Playwright payload reader returned no body length
for the two requests after reload; no size was invented there. S03's part numbers/ETags, acknowledged
first-part listing, enforced completion inventory and independent completed-object stream/hash
establish the resumed bytes. No bearer, signed URL query, code, password, raw token/HAR/trace is in
this evidence. Browser Chromium153.0.8010.12, actual DOM mouse controls and file chooser used.
Screenshots are actual UI, including pending/paused/resumed/aborted/visible failures and retained
recent uploads. These are agent evidence, not owner image feedback or native design snapshots.

`objects-and-queue-state.json` independently streams both completed private objects with the scoped
upload credential, comparing actual size15584953 and SHA256
`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`.
The multipart ETag `346805d5f3163911cfc48fa462669d69-3` is not that checksum. `queues.txt` records two
ready jobs/no consumers and all other queues empty. `restart-result.json` records the successful
normal stop/start, unchanged credential hashes accepted and persistent volume identities. Final
mouse audit after restart confirms the exact same two pending/one aborted records.

Fixture uses exactly `scenarios.md`'s frozen synthetic20s recipe with actual pinned field FFmpeg
image `jeeves-youtube-v1-ffmpeg`, image ID
`sha256:1792f4e0fb15896196cf9e3ba3d32ab2804ec27f4f7ab04c62ce050a102d8585` (local built manifest).
`ffmpeg-version.txt`, `fixture-generation.txt` and `fixture-ffprobe.json` retain version/configuration/
argv-derived log and streams. Build checks the frozen FFmpeg deb and288-package OS closure unchanged.
Actual media stays in ignored `app/.runtime/media/`; no video is in Git. No output encoding or
playback/audio observation is inferred from this fixture-generation run.

Commands were `pnpm install --frozen-lockfile`, `pnpm check:foundation` (build +4 checks),
`pnpm first-run`, `pnpm stop`, `pnpm start`; own outside-copy frozen install/checks and
`docker build --target edge` from `/tmp/fp06b/independent-app`. App and edge builds need no host
public mount or parent compiler. The scratch independent edge image was removed; no scratch runtime
or provider was started. Final seven-container `jeeves-youtube-v1` stack and all five volumes,
local secrets/fixture/FFmpeg image remain for FP06c/owner. Other four Compose projects and owner
4300/4310/4304 watchers are preserved. No cloud/paid/live model call or global prune occurred.

Planned integration: custom multipart extension/routes, PKCE/browser/edge build, tracked first-run/
restart and repeatable search settings assertions. Scoped helper repairs: HTTP close now drains
admitted work after response deadlines, unknown dependency failures default503, publisher exposes
fatal closed/cleanup signal. Existing foundation tests plus two meaningful new network-free tests
cover part inventories/file bounds/private projections and HTTP shutdown. No24h wait, broad fault/
provider/certification campaign or all-service readiness claim.

Actual failed attempts and fixes:

- Initial new Docker integration copied `scripts/` after `RUN pnpm build`; Node could not find
  `scripts/build-browser.mjs`. Moved COPY before build and resumed the recorded repeatable build
  step. No bootstrap/credential replay or reset; failed log retained locally `/tmp/fp06b-first-run.log`.
- Coordinator review caught `recent()` outside transfer's try/finally, which could strand busy
  controls on an expired token; moved it inside before real browser acceptance. It also required
  explicit persistent-volume identity checks before normal startup; implemented before restart.
- First root check stopped at formatting two new evidence JSON files; formatted those only.
  Full check then passed398/50 in22.87s, all lint/typechecks. No PGlite timeout in this unit.
- First E2E35/36: existing foundation view test timed out30s during setup waiting for Choose
  Architecture study, before its feature steps; page remained on TinyURL with project menu open.
  Exact unchanged test passed alone3.4s/6.4s total, then unchanged full suite **36/36 in1.4m**.
  No root source/test/timeout change. First log, isolated log and passing rerun retained below;
  private error context/trace remain `/tmp/fp06b/` and contain no field authentication traffic.
- Final retained-upload screenshot exposed a completed-transfer progress bug: closed uploads return
  no active multipart inventory, but selection displayed0/3. Preserved the initial screenshot, made
  progress state-aware in show(), and rebuilt own/independent browser + edge assets. Scoped mouse
  selection/refresh/reload now retains100% for pending; aborted shows explicit terminal text/0%.
  Failed-with-jobId retains completed-transfer progress for FP06c. App-only follow-up checks4/4
  and corrected captures pass; root sources/tests remained unchanged after the passing regressions.
- One scratch documentation-edit command used a repository-relative path from app cwd; corrected
  that command, with no product/runtime state effect.

Required checks were sequential with code steady and Docker build/cleanup finished: `pnpm check`,
`pnpm test:e2e`, then web build **971ms** (existing large-chunk advisory). See retained logs (trailing whitespace normalized; original command output remains in /tmp).
Final actual mouse4300 current v1(schema3/r6) Fit22/27 + Upload focus, TinyURL53 Fit12/13; all four
complete project/design/history/layout/blueprint responses and listing preserved; zero page errors.
E2E database restored to default-only. Current source still matches native010; no source/presentation
change warranted011. All historical inputs, `.jeeves`, current generated config, pins, locks,
generator/templates unchanged; provenance is cumulative against the untouched baseline, not a
functional percentage or template certificate. H01/H09 remain bounded reuse hypotheses.
