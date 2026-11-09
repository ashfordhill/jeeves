# YV2-22 integrated S01–S08 observations

Frozen scope is the unchanged [v1 scenarios](../../v1/notes/scenarios.md), not a new acceptance
method. Run2026-11-08 America/Chicago (UTC2026-11-09), retained `jeeves-youtube-v2`45400–45402.
[Actual flow, provider/media state, screenshots and operator sources](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-22-completion.md).
One valid fixture transfer/encode, one separate partial abort and one small invalid-media upload;
no second successful encode, broad provider/fault/load matrix, policy expansion or new UI.

| Scenario | Observed result and remaining criterion |
| --- | --- |
| S01 **partial; independent copy is23** | Own frozen install/backend+browser build and Docker first-run pass;14 services healthy. Mouse creator sign-in/out and fresh provider login form pass. This run is the retained primary app; the required outside-checkout execution belongs independent YV2-23. |
| S02 **observed bounded** | Mouse chooses exact15,584,953B fixture/title/description. Real PUT1/2/3:5,242,880/5,242,880/5,099,193B; real ETags and authoritative ListParts before completion. Actual downloaded original SHA matches1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9. Stable completion/job/attempt replay. Anonymous start/sign/complete401, other-creator status/sign/complete/abort404 and empty own list. |
| S03 **observed bounded** | Gate part2 before provider, mouse Pause after part1; refresh/reselect same fixture+mtime; same upload ID and only PUT2/3 resumed. Separate unfinished upload abort by mouse; later complete410. No cross-device/fault/24h-expiry campaign. |
| S04 **observed functionality; command-log limit** | Actual uploading→pending→processing→ready; queued02:49:35.759Z→started36.551→ready39.677. Real stored15 objects/14 hashed inventory entries; ffprobe20 s H264/AAC640×360 and1280×720, real segments/master/playlists and1280×720JPEG. Automatic committed publication. Source uses CPU libx264; bytes differ from original. Successful encoder stderr/live argv were not retained by the generated process; unchanged exact source argv is archived separately and is not labelled a live command log. |
| S05 **partial: human listening unobserved** | Signed-out mouse Watch/details/thumbnail/count, actual playlists+segments through edge. Time8.009s,219decoded/0 dropped frames, mouse seek8.257→15.453s. Unmuted decoded PCM peak440.085Hz/RMS.06245. No human listening; PCM does not establish that criterion. Pending/invalid Watch404; normal restart decodes retained media. |
| S06 **observed bounded** | Actual search finds ready fixture1423ms after ready commit; mouse title tourmalineazure, description zirconcerulean and channel creator all return its Watch link. Pending and invalid unique titles have0hits/public404; aborted fixture stays private. No prefix/relevance changes. |
| S07 **observed bounded** | Repeated metadata/search/no-play reads0. Short play/pause/seek<2 cumulative seconds adds0; cumulative normal play emits one202 event, visible1 in1764ms. Same-page pause/resume/seek and same-ID retry keep1; new page session accepts a distinct event and reaches2. Two actual transactional receipts/totals retained. Live positive metadata cache excludes views/total; Watch returns fresh2 after normal restart. |
| S08 **observed bounded; independence remains23** | Visible finite invalid-token, oversize and non-MP4 errors; server413/422. Small MP4-named text reaches INVALID_MEDIA/public404/search0. Anonymous original403. Normal stop/start preserves credentials/fivevolumes/media/database/index/count2,14 healthy and mouse search/Watch/login. Outside-checkout repeat remains23; no crash-safety claim. |

Everything in `browser/` is reused custom UI, including playback qualification. No post-baseline
backend logic or repair was needed. App-level interface/functionality completion is separate from
strict TinyURL readiness/template certification and source-share measurement. The successful
walkthrough had no product/browser failure and no page errors. Two operator-record errors remain
honest: initial allocation-note cwd write failed before correction, and an auxiliary whole-runtime
snapshot equality assertion failed only because normal rebuild changed app image IDs. Actual
credential/volume retention and all14health statuses match; byte-identical container images were
never an acceptance criterion. No product change or repeat encoding was needed for either issue.

Operator sources are archived as gzip under the linked evidence. `walkthrough.mjs` and
`restart-mouse.mjs` derive from the v1 FP07b harness, adapted to this allocation and a single valid
resumed flow. Provision harness creates admin-managed review accounts with password files0600;
it is test/operator setup, not a new account-creation feature. Credentials/tokens/signed URLs,
media bytes, dependencies/builds and private runtime are absent from tracked evidence.
