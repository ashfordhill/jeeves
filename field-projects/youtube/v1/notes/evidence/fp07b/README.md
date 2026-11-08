# FP07b independent integrated walkthrough

Base **9cd622f3bf1db14d8687b0ab88a0da6afb7c0ebe**, primary main, sequential sole writer,
**Sol xhigh** per owner assignment. Prior code/docs/runtime/fixture/operator harnesses were
available. No branch/worktree/stash/delegation/push, live-model/paid/cloud call, generator run or
product repair. [Review pack](../../review-pack.md), [per-file provenance](provenance.json),
[environment](environment.json), [tracked-copy inventory](copy.json). All executable app sources,
config, dependencies/locks and frozen `.jeeves` bytes remain unchanged from the accepted base;
app README is the only app-file edit. Frozen scenarios retain their historical not-run wording;
this is their current companion result record.

## Integrated results

All results use a fresh outside-checkout source copy at `/tmp/jeeves-fp07b/independent-app`,
fresh credentials/six volumes and **COMPOSE_PROJECT_NAME=jeeves-fp07b-review** on4400–4402.
Owner jeeves-youtube-v1 was normally stopped first, with runtime/media/secrets and6volumes retained.
The app installed its own frozen dependencies/compiler and built server/browser assets; Docker
first-run followed the README, initialized providers and started all14services healthy. Root
Playwright1.63.0/Chromium153.0.8010.12 was operator tooling only; no application call to Jeeves.

| Frozen scenario / outcome | Concrete independent evidence | Baseline foundation and custom completion |
| --- | --- | --- |
| S01 **pass** | [Install](install.log.gz), [build/10checks](foundation.log.gz), [Docker first-run](first-run.log.gz), [signed-in image](signed-in.png), [flow](walkthrough.json) S01: creator identity, mouse logout, fresh provider login form. [Restart identities/services](scratch-restart.json). | Generated standalone package/Compose/JWT clients were useful; custom PKCE/browser/creator roles/startup identity guard and integration made the scenario work. |
| S02 **pass** | [Flow](walkthrough.json): actual PUT1/2/3 **5,242,880/5,242,880/5,099,193B**, ETags and authoritative pre-complete ListParts, stable repeat job/attempt. Anonymous start/sign/complete401; other creator status/sign/complete/abort404, empty own list. [Actually streamed originals](originals.json) both match fixture SHA/size; [anonymous original403](private-original.json). | Generated S3/JWT helpers existed; multipart ownership/limits/state/completion reconciliation/API/browser extension behavior is custom. Multipart ETag is not SHA256. |
| S03 **pass bounded** | [Paused](paused.png)/[resumed](resumed.png)/[aborted](aborted.png), [flow](walkthrough.json): hold part2 before Garage, mouse Pause after acknowledged part1, refresh/reselect same bytes+mtime, same upload ID, PUT only2/3. Separate partial abort closes; complete410. | Generated S3 primitives existed; durable ownership/fingerprint/phase/ListParts/resume/abort UI and policy are custom. No arbitrary provider-fault/cross-device recovery claim. |
| S04 **pass bounded** | [Flow states](walkthrough.json) uploading→pending→processing→ready; [actual argv/encoder logs](transcoder.log.gz), [output inventory/playlists/ffprobe](media.json), [ready image](ready.png). Fresh real CPU H264/AAC640×360/1280×720 HLS and JPEG; success-only automatic publication. Bytes differ from original. | Generated FFmpeg/container/worker shells existed; seven throwing extensions supplied no application behavior. Custom worker/media validation/encoding/packaging/thumbnail/lifecycle/publication make this flow work. |
| S05 **partial: human listening open** | [Signed-out play](signed-out-playing.png), [flow](walkthrough.json): unmuted time8.009s,219decoded/0dropped frames, normal-speed second play runs about5s after seek to~3s, mouse seek8.298→15.453s; real playlists/segments through edge. Measured decoded PCM peak440.085Hz/RMS.06245. [Restart Watch](restart-watch.png) decodes retained media. Invalid/pending Watch404. **No human listening observation is recorded.** | Generated edge+hls.js dependency existed; custom public Watch/cache/player/ready boundary and actual FFmpeg output required. Unmuted PCM is not the frozen human audible-tone observation. |
| S06 **pass bounded** | [Flow](walkthrough.json): ready06:44:31.210UTC → actual search06:44:31.886 (**676ms**), mouse title`tourmalineazure`, description`zirconcerulean`, channel`creator`, Watch link and [thumbnail](search-watch.png). Pending404/search0 at completion, retained unfinished`amethystjade` search0/Watch404; invalid`nephelinemint` search0/Watch404. | Generated OpenSearch client/empty index existed; custom committed-publication outbox/indexer/strict mapping/query/public fields/browser required. No relevance/capacity benchmark. |
| S07 **pass bounded** | [Flow](walkthrough.json), [receipts/totals](count-state.json), [counter](counter.log.gz): repeated reads/search0; initial~.6s play/paused seek0, cumulative2s accepted event`b5db7053-765e-4203-967d-b974e3c8e64a`→visible1 in**5,348ms**, pause/seek/resume0, explicit same-ID202 repeat0, new session`f87019d8-99ac-4706-bdf2-e20e191efa5a`→2. [Final image](new-session-two-views.png). | Generated broker/count DB shells existed; actual-played browser policy, confirmed ready-only event route, receipt+increment transaction and fresh totals polling are custom. No fraud/unique-viewer/exactly-once promise. |
| S08 **pass bounded** | [Invalid token](invalid-token.png), [oversize](oversize.png), [nonconforming](nonconforming.png), [invalid-media failure](invalid-media.png)/[public refusal](invalid-public-refusal.png), finite413/422 in [flow](walkthrough.json), [original403](private-original.json). Normal [stop](scratch-stop.log.gz)/[start](scratch-start.log.gz) with [same6volume/credential identities](scratch-restart.json), [mouse search/Watch/login/count2](restart-mouse.json). | Generated independent build/provider helpers were useful; custom validation/error/lifecycle/publication/startup and browser code required. This is normal restart, not a crash/fault/expiry campaign. |

Fresh ready video **c8917d15-5662-4b4f-a324-bcf4c22a14f6**; resumed ready
**aec8e49a-a02f-4e0d-8100-bb241cc27ff9**. These scratch IDs are removed, not owner demo links.
Fixture reused exact retained bytes **15,584,953B**, SHA256
`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`, preserving mtime. It was
copied only **after first-run**, respecting the untracked-runtime guard; no media entered Git.

## Commands, replay and failures

The recorded operator sequence was tracked-file copy137files (no node_modules/dist/dist-public/
.runtime), then outside the checkout with Node24.21.0 on PATH:

```sh
pnpm install --frozen-lockfile
pnpm check:foundation    # includes pnpm build; own Node and browser compiler
COMPOSE_PROJECT_NAME=jeeves-fp07b-review pnpm first-run
# Only after initialization, copy the preserved fixture with cp -p into .runtime/media/.
```

For another run use a **new** scratch directory and Compose name with no prior volumes/runtime.
A new checked-out final commit can be copied with `git archive HEAD field-projects/youtube/v1/app`
and extracted with four path components removed; alternatively use the explicit paths in copy.json.
Use that same chosen Compose name for **every** subsequent command: prefix each `pnpm start`
and `pnpm stop` with `COMPOSE_PROJECT_NAME=<scratch-name>`, and use
`docker compose -p <scratch-name>` for every probe/copy/log/cleanup. The inline first-run variable
does not persist in the shell. Never omit the name or default to the retained owner project.
Free4400–4402 only by stopping your own conflicting field runtime normally; preserve all other
projects. Never reuse a deleted scratch setup record against recreated volumes or bootstrap the
owner. Root regressions are separate from field independence.

Sanitized harness sources are retained as gzip, not only temporary scripts. Decompress
[walkthrough.mjs.gz](walkthrough.mjs.gz) to an operator directory, then run:

```sh
APP=/absolute/outside/app OUT=/absolute/new/evidence TOOLING_ROOT=/absolute/operator/playwright-root \
FIXTURE=/absolute/preserved/youtube-v1-fixture.mp4 node /absolute/operator/walkthrough.mjs
```

OUT must exist. TOOLING_ROOT supplies only installed `@playwright/test` (1.63.0 and its browser);
the browser is headless with its default mute flag removed. The harness reads password **paths**,
uses actual mouse controls/file chooser injection and targeted probes, records safe IDs/times/
parts/statuses and never records access tokens, passwords, signed URLs or auth traces. The bounded
pause gate holds part2 before transmission; it is not a provider-fault campaign. Don't dump browser
session storage or HTTP traces. S05 still needs an owner/audio-device listening observation.

[Original probe](original-probe.mjs.gz) runs via stdin as
`docker compose -p <scratch-name> exec -T upload node --input-type=module`; it streams actual originals under the
mounted scoped credential and prints safe row IDs/media/fingerprints. [Media probe](media-probe.mjs.gz)
runs similarly in transcoder after copying the one safe ready row from originals.json to its
`/tmp/media-target.json`; it streams output inventory and invokes real ffprobe. Its temporary media
is removed in finally. [Count probe](count-probe.mjs.gz) runs in view-counter, read-only.
[Restart mouse](restart-mouse.mjs.gz) uses APP/OUT/TOOLING_ROOT after normal stop/start, retaining the
same evidence directory and walkthrough.json. It plays<2s so count2 stays2. No duplicate/fault/load/
soak/provider certification campaign was repeated in FP07b.

Failures are retained: the first full harness incorrectly waited for the words “public video”
when real search displayed “1 results · Page1”. [First source](walkthrough-first-attempt.mjs.gz),
[partial JSON](walkthrough-failure.json), [PNG](walkthrough-failure.png) and [log](walkthrough.log.gz)
show valid search and earlier successful upload/resume/failure evidence. Corrected selector and
[public continuation](public-continuation.mjs.gz)/[log](public-continuation.log.gz) reused those rows;
no product fix, count reset or unnecessary re-encoding. Final walkthrough.json carries original
start time and continuation time. An initial shell invocation used a not-yet-created cwd and
refused before commands; one later absolute pnpm path was absent (pnpm lives elsewhere on PATH).
Neither changed app/runtime state. No failed attempt is relabeled a product pass.
Staged diff-check reported trailing whitespace in verbatim Compose/FFmpeg output; logs are
retained losslessly as gzip so evidence bytes survive without source whitespace warnings.

Normal scratch restart commands were `COMPOSE_PROJECT_NAME=jeeves-fp07b-review pnpm stop` then
`COMPOSE_PROJECT_NAME=jeeves-fp07b-review pnpm start`. Initial default-
profile `docker compose -p jeeves-fp07b-review down --volumes` left application-profile containers/edge-cache/network;
[cleanup log](scratch-cleanup.log.gz) plus failed empty-resource assertion caught it. Exact named
`docker compose -p jeeves-fp07b-review --profile '*' down --volumes` [completed cleanup](scratch-cleanup-complete.log.gz).
Only three scratch app/edge/transcoder image tags were removed; pinned FFmpeg retained.
[Final resource check](scratch-cleanup.json) has0scratchcontainers/volumes/networks. The app README's
retained-owner `down` example was corrected to include all profiles **without -v**; normal
`pnpm stop` remains preferred. This is a documentation correction, not a runtime product failure.

Owner `pnpm start` [restored](owner-start.log.gz) all14healthy with same6volumes/secrets/exact fixture
and identical public ready/search/counts**3/0** [before](owner-public-before.json)/[after](owner-restored.json).
Other Compose projects were unchanged. Scratch private runtime/secrets/fixture copy were removed;
no owner project, failed job, count receipt or media was reset/deleted.

## Interpretation and required Jeeves checks

Baseline **02ac280da62616e9c7aad7f88457dcb72084cb25** has107hashed payloads+manifest,
manifest SHA256`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
[Provenance](provenance.json), recomputable with [provenance.py](provenance.py), distinguishes
61unchanged payloads+unchanged historical manifest,46modified-generated integration files
(including seven custom business implementations and separately annotated helper repairs),
29new custom app files, reused custom origins and external pinned dependencies. FP07b only edits
app documentation. Baseline delivered0complete scenarios with useful foundations. No coverage/
effort savings comes from bytes/files/LOC/eight scenario counts; active effort/tokens/cost unknown.
Studio/generator investment remains separate. Exact frozen005 export cannot emit customr6; safe
preservation/regeneration across edits is an FP08 review proposal, not delivered support.

Limits retained: S05 human listening open; FP07a controlled hidden signal is not OS background-tab
proof; remote partial/orphan outputs retained in owner runtime; guessed public encoded partial keys
can be served before ready; Watch/searchready is the application publication boundary. Local temp
cleanup does not prove remote cleanup/atomic ACL. Local HTTP/bucket credentials/single instances/
restricted media/basic anonymous counts are bounded choices, not enterprise readiness or capacity.
No new source/presentation decision, diagram011, generic DSL/tile/template, heavy certification or v2.

Mandatory checks ran sequentially after Docker work, with executable sources steady: [pnpm check](root-check.log.gz)
**398tests/50files,22.74s**, lint/types pass; [native E2E](e2e.log.gz) **36/36,1.4m**;
[web build](web-build.log.gz) **999ms**, existing chunk advisory. All passed first try, no timeout/test
or root code edits. No tests were added for documentation-only changes. [E2E DB after](e2e-projects-after.txt)
matches the [prior recorded default-only state](e2e-projects-expected.txt).

Actual owner4300 mouse [studio evidence](studio-mouse.json)/[harness](studio-mouse.mjs.gz): current
v1 Fit22tiles/27lines and Upload relationship focus; TinyURLrevision53 Fit12/13; all four complete
project/design/layout/blueprint responses and listing preserved,0pageerrors. [Current v1](studio-v1.png),
[focus](studio-upload-focus.png), [TinyURL](studio-tinyurl.png) and native010 were visually inspected.
No new source/presentation decision or duplicate011. [Final retained field mouse](final-field-mouse.json)/
[harness](final-mouse.mjs.gz) searches by description, opens Watch/thumbnail, retains the same player
through polling/count3 and emits0view events ([image](final-public-ready.png)). Owner stack remains
all14healthy; credentials,fixture,6volumes and other projects/watchers stay preserved. FP08 review is next.
