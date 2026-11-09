# YV2-22 — reused browser on the generated backend

The retained app is usable at <http://127.0.0.1:45400/> with the v1 browser and the actual generated
backend. This unit adds no backend adapter/repair and changes no template. The bounded integrated
walkthrough observes the frozen upload/resume/abort/processing/public Watch/search/count behavior;
**S01 outside-checkout execution remains YV2-23, S05 human listening remains unobserved**, and the
successful encoder's live argv/stderr were not retained. Do not turn those limits into passes.
[Per-scenario record](../../../../../field-projects/youtube/v2/notes/scenarios.md),
[actual browser flow](yv2-22/walkthrough.json), [restart mouse](yv2-22/restart-mouse.json).

## Baseline and custom accounting

Actual prior untouched baseline **695addeb3ac4a77c3a6fbfd2f68d901fced3619f**,93 files/4,243,495 B.
Every baseline Git blob independently matches the frozen path/hash/byte pins. Manifest remains
**1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc**, inventory
**ed6eab9609fd59b4148b72ddd25e4481770ab88bff826eebaf7cdbc93195c938**; frozen source
**e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b**.
All 4 `.jeeves` files, all generated backend `src/`, dependency lock/pins and FFmpeg OS lock are
unchanged. Historical generation-time runtime:none/strict:not-assessed metadata is preserved.
[Baseline before custom work](yv2-22/baseline-verify.json),
[all path/source-origin comparisons](yv2-22/provenance.json),
[comparison script](yv2-22/provenance.py.gz).

| Category | Actual post-baseline paths/responsibility |
| --- | --- |
| Reused custom UI | `browser/{auth,main,playback-policy,search,watch}.ts`, `public/{index.html,style.css}` from `field-projects/youtube/v1/app/`. Main/playback/search/watch/CSS copy exactly. Auth reads public runtime binding; HTML adds its config script. Individual origin commits/hashes are in provenance (main/watch/search/presentation FP07a9cd622f3…; auth retains its own recorded origin). No UI template credit. |
| Integration | `.dockerignore`, `.gitignore`, `README.md`, `Dockerfile`, `compose.yaml`, `infra/edge/nginx.conf`, `package.json`, `scripts/{local,browser-config,build-browser}.mjs`, `tsconfig.browser.json`; auth/HTML binding edits also integration. Browser compiler/build config copied from v1, exact pinned hls.js copied from own dependencies. Docker builds actual browser assets; local start emits public config and edge serves `dist-public`. v1 nginx routing/cache/ranges/log suppression adapted to v2 service/bucket names. Runtime configuration/build changes remain recorded outside backend LOC. |
| Custom backend | **None.** Actual generated PKCE/JWT/upload/lifecycle/media/cache/Watch/search/count behavior already fit the reused browser. |
| Generated-file repair | **None.** The static browser slot was intentionally replaced; no backend defect required repair. Nine modified generated app files and nine new app files are explicit post-baseline changes, not regenerated credit. |

The unchanged reviewed [scope](../../../../../field-projects/youtube/v2/notes/benchmarks/backend-scope.json)
excludes every UI file in `browser/` and exactly4 pure-data configuration paths from both backend
totals. No UI exists under `src/`; no backend logic was hidden in an excluded path.
[Completion scope review](../../../../../field-projects/youtube/v2/notes/source-scope.md).
No source-loc report or numerical v2 template share is claimed before independent YV2-23.

## Runtime and actual observations

Final Compose **jeeves-youtube-v2**, loopback HTTP45400/identity45401/objects45402, private
`field-projects/youtube/v2/app/.runtime`0700,5 retained volumes,14 healthy services. The allocation
and exact-project namespace were checked free before first-run. An initial allocation-note write
used a wrong relative cwd and failed; the shell continued into first-run, then the note was
corrected. [Transparent allocation record](yv2-22/allocation.json),
[operator/start instructions](../../../../../field-projects/youtube/v2/notes/runtime.md).
Never delete/reset this runtime for independent review. V1 was never stopped or changed.

Runtime public config follows the same `LOCAL_HTTP_PORT`/`LOCAL_IDENTITY_PORT` as provider setup
and backend issuer. Generated identity selection fixes realm`identity`, client/backend audience
`identity-web`; callback is selected loopback HTTP origin plus `/`. No independent realm/client
knob exists. Same browser sources work with other free ports/project, without hardcoded45401.
A disposable serialization-only check45510/45511 verified this binding and was removed; it is not
claimed as the independent runtime execution. All API clients use the current same-origin paths.

Two local admin-managed creator accounts were provisioned solely for review; password files0600
under private runtime, no password/token values or signed URLs in tracked evidence. Owner username
`creator`, local password path `app/.runtime/secrets/creator_password`; second account
`other-creator`/`other_creator_password`. Read locally without logging values. No signup feature.
[Executed provisioning operator source](yv2-22/provision.mjs.gz).

One valid upload uses the exact retained fixture copied with mtime:
15,584,953B/SHA2561658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9.
Mouse pause after acknowledged part1, refresh/reselect/resume only2/3, actual5 MiB/5 MiB/5,099,193B
PUTs and ListParts, stable repeated completion. Anonymous401/foreign-owner404; separate unfinished
upload abort410. Ready video **9abde227-6abb-4ee0-817e-3d94d90911ea** automatically publishes;
invalid named MP4 fails INVALID_MEDIA with no Watch/search hit. [Original/SQL/outbox](yv2-22/originals.json),
[anonymous original403](yv2-22/private-original.json), [flow](yv2-22/walkthrough.json).

Queued02:49:35.759Z→started36.551→ready39.677; actual output15 objects/14 verified inventory records.
ffprobe shows20 s H264/AAC640×360 and1280×720 plus1280×720 MJPEG thumbnail, master/rendition playlists
and10 real segments. Encoded hashes differ from original. [Media/marker/object/ffprobe records](yv2-22/media.json),
[unchanged exact encoder argv source](yv2-22/encoder-source.ts.gz),
[media read-only probe](yv2-22/media-probe.mjs.gz). The generated process captures/discards successful
stderr rather than logging it, so source argv is **source evidence**, not a retained live subprocess
command/log. No extra encode or backend logging change was done merely to fill that evidence gap.

Signed-out mouse title/description/channel search returns ready fixture1423ms after commit.
Watch decodes219 frames/0 dropped at8.009s; mouse seek8.257→15.453s. Unmuted decoded440.085Hz
PCM/RMS.06245 is recorded; **no human listening observation**. Repeated metadata/search0; short
play/pause/seek0; cumulative qualifying2 s accepts one event with visible1 after1764ms, duplicate
same-ID and same-page interactions retain1; new watch session reaches2. Actual2 receipts/total2
and positive metadata cache without views/total are [retained](yv2-22/count-state.json),
[cache state](yv2-22/cache-state.json). No search/relevance/count/fraud policy change.

| Mouse evidence | Image |
| --- | --- |
| Creator sign-in | [signed in](yv2-22/signed-in.png) |
| Pause and refresh/resume | [paused](yv2-22/paused.png), [resumed](yv2-22/resumed.png) |
| Ready/status and abort | [ready](yv2-22/ready.png), [aborted](yv2-22/aborted.png) |
| Finite failures | [invalid media](yv2-22/invalid-media.png), [public refusal](yv2-22/invalid-public-refusal.png), [invalid token](yv2-22/invalid-token.png), [oversize](yv2-22/oversize.png), [nonconforming](yv2-22/nonconforming.png) |
| Public search/playback/count | [search Watch](yv2-22/search-watch.png), [signed-out playback](yv2-22/signed-out-playing.png), [second session two views](yv2-22/new-session-two-views.png) |
| Normal restart and TinyURL | [retained Watch](yv2-22/restart-watch.png), [TinyURL lane/mouse](yv2-22/tinyurl-mouse.png) |

Normal stop/start retains credential-set digest and all5 volume identities, media/index/database;
14 healthy and mouse search/retained decode/creator login/count2 pass.
[Before](yv2-22/runtime-before-restart.json), [after](yv2-22/runtime-after-restart.json),
[retention result](yv2-22/restart-summary.json), [stop](yv2-22/stop.log.gz), [start](yv2-22/start.log.gz).
An auxiliary full-snapshot equality assertion failed on rebuilt app image IDs only. Its corrected
comparison checks the required credentials/volumes/health; byte-identical container images were
never claimed. No product/browser failure, source repair or provider rerun resulted from this
operator assumption. Walkthrough/restart page errors0; human listening/OS-tab behavior remain open.

## Builds, regressions and preservation

Own `pnpm install --frozen-lockfile --ignore-scripts`, combined backend/browser `pnpm build` and
Docker first-run pass using existing exact pins. Eight actual built browser/presentation/hls.js
assets independently match between host and Docker builds [by SHA256](yv2-22/browser-build.json).
[Install](yv2-22/install.log.gz), [app build](yv2-22/app-build.log.gz), [first-run](yv2-22/first-run.log.gz).
Root tooling is not application validation. Node24.21.0/pnpm12.16.1, Playwright1.63.0 with Chromium
153.0.8010.12 supplies operator tooling only; app never imports workspace code or calls Jeeves.

Required root checks ran after walkthrough browsers/disposable config/TinyURL project cleanup,
with final v2 runtime kept: `pnpm check` explicitly awaited exit0 before starting E2E,467 tests /
70 files, 34.91 s; then37 native E2Es, 1.5 m; web build completed exit0 in 875 ms (existing advisory).
[Check](yv2-22/check-final.log.gz), [E2E](yv2-22/e2e-final.log.gz), [web build](yv2-22/web-build.log.gz).
Mouse TinyURL lane/Fit/selection works on running studio4300 and its own temporary project was
deleted; frozen v2 studio project2c7c8b08-4633-4a97-8794-672a777f1d3a/r2 remains unchanged.

Temporary oversize/nonconforming files and media-probe temp directory removed; no disposable Docker
runtime was created. Retain final v2 private runtime/fixture/credentials/5 volumes, own dependencies
and built serving assets (all ignored), plus final images/14 services. Only unit sources/docs/evidence
are staged. V1 app/runtime/inputs/local-v1 assets,108 frozen hashes/historical manifest50987079…,
fixture/mtime, FFmpeg1792f4e… and14 healthy services/6 volumes remain preserved. Owner README,
feedback changes/Unicode deletions/colon variants/e2e-docker mode remain unchanged.
No branch/worktree/stash/push or later unit. Independent run/restart/report/owner review is YV2-23.
