# YouTube v2 owner review pack

The retained app works at <http://127.0.0.1:45400/>. A separate exact tracked copy of completion
`08699b2dc631709bff12fb25914e0d2681b6b535` independently installed, built, ran the bounded frozen S01–S08 flow and retained data
through normal stop/start. The actual backend measurement is **5,456 / 5,456 LOC = 100% retained
template source**, above **5.53%**. Custom reused browser and integration remain outside that
backend measure. **S05 human listening is unobserved; S04 live encoder argv/success stderr were
not retained.** No complete-certification or all-criteria-pass claim follows.

[Independent evidence](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-23-independent.md) ·
[actual backend report and attribution](benchmarks/README.md) · [completion](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-22-completion.md) ·
[frozen scenarios](../../v1/notes/scenarios.md) · [current observations](scenarios.md).

[Owner-requested provenance/reuse review](../../../../docs/plans/reliable-foundations/youtube-v2-provenance-review.md)
reproduces the 100% source result, separates reusable mechanisms from generated YouTube policy
and custom integration, and proposes an off-by-default developer view. No developer mode is
implemented by that review.

## Retained owner walkthrough

1. Open the app signed out. Search the full title keyword `tourmalineazure`, description keyword
   `zirconcerulean` or channel `creator`, then click Watch video for **YV2-22 tourmalineazure public fixture**.
   Direct [ready Watch](http://127.0.0.1:45400/?watch=9abde227-6abb-4ee0-817e-3d94d90911ea).
   Last completion count was **2**; later legitimate owner playback can increase it.
2. Expand Video thumbnail, click Play, listen for the synthetic tone and use the timeline to seek.
   Human listening on an audio device is the outstanding observation; automated decoded PCM does
   not settle it. Two cumulative qualifying played seconds add one basic view per page session.
3. Click Sign in, username **creator**. Read the password locally at
   `field-projects/youtube/v2/app/.runtime/secrets/creator_password` (0600); no value is recorded here.
   Sign out also ends the identity-provider session. The second review account is `other-creator`,
   with separate private `other_creator_password`; there is no signup feature.
4. To exercise upload, choose the retained `.runtime/media/youtube-v1-fixture.mp4`, enter title and
   description, and click Upload video. Pause/refresh/reselect/resume uses the same bytes/mtime;
   abort applies to an unfinished upload. View status shows processing/ready or finite failure.
   Successful processing publishes automatically. The exact retained fixture is **15,584,953 B**,
   SHA256 `1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`.
5. Open the saved [v2 studio project](http://127.0.0.1:4300/?project=2c7c8b08-4633-4a97-8794-672a777f1d3a),
   revision **2**. Its [frozen native/source/1280+1440 views](../diagrams/001-frozen-generation/README.md)
   record explicit YouTube attachment and cache TTL3601. Fit/select and Generate preview/ZIP use
   the installed registry. The app browser is custom reused UI; Jeeves has no UI builder here.

Normal retained commands, from `field-projects/youtube/v2/app`:

```sh
export PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH
export COMPOSE_PROJECT_NAME=jeeves-youtube-v2
export LOCAL_HTTP_PORT=45400 LOCAL_IDENTITY_PORT=45401 LOCAL_OBJECT_PORT=45402
pnpm stop
pnpm start
```

Keep this private runtime0700, credentials and all five volumes. First initialization is already
complete; normal `start` checks retained identity/data and rebuilds using its own installed lockfile.
[Runtime record](runtime.md) has details. Identity is45401; object signing45402. The independent
proof used **jeeves-yv2-23-independent /45410–45412**, fresh credentials/five volumes, then removed
only that copy's containers/volumes/network/two image tags/runtime/dependencies/build/media.
Its scratch video `8d973dc2-be73-42ff-822c-26a0b76a5228` is removed evidence, not a retained owner link.
Original v1 remains independently running at4400–4402; neither owner stack was stopped/reset.

## What was independently observed

| Scenario | Current evidence / limit |
| --- | --- |
| S01 observed bounded | Outside-checkout exact102-file copy, own frozen install/backend+browser build, first-run14 healthy, real PKCE creator login/logout on different ports without source edits or Jeeves/model calls. |
| S02 observed bounded | Real5 MiB/5 MiB/5,099,193 B PUTs, ListParts and downloaded original SHA; stable complete/job/attempt; anonymous401, other-owner404/empty list. |
| S03 observed bounded | Mouse pause after part1; refresh/reselect same file; only 2/3 resume; separate abort with later complete410. |
| S04 observed; command evidence partial | Uploading→pending→processing→ready, actual15 objects/14 verified output hashes,20 s H264/AAC360p+720p/JPEG and automatic publication. Exact source argv is available; successful live argv/stderr were not retained by the generated process. |
| S05 partial | Signed-out details/thumbnail;8.014 s,218 decoded/0 dropped frames, mouse seek8.244→15.453 s; playlists/segments; unmuted440.085 Hz PCM/RMS .06245. **No human listening observation.** Retained media decodes after restart. |
| S06 observed bounded | Real title/description/channel mouse search953 ms after ready commit; pending/invalid search 0 and Watch 404. |
| S07 observed bounded | Read-only fetch/search 0; short play/seek 0; cumulative play event visible 1 in1,762 ms; same-page/same-ID stays 1; new session 2; actual 2 receipts and fresh total 2 outside metadata cache after restart. |
| S08 observed bounded | Finite invalid token/oversize/non-MP4/invalid-media errors,413/422, private-original 403; one normal restart retains credentials/five volumes/database/index/media/count 2,14 healthy and mouse login. |

## Provenance and reuse

[Untouched baseline](baseline.md) `695addeb3ac4a77c3a6fbfd2f68d901fced3619f` matches all93 emitted hashes, separate from YV2-22
completion. All60 generated backend files, four `.jeeves` files and package/FFmpeg locks are
unchanged. Exact source `e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b`, default
registry `6d0a8916c90be61c10736dc58cac91a0f9deaabeefeadc5ec077b7d997b4086f`, manifest
`1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc`, inventory
`ed6eab9609fd59b4148b72ddd25e4481770ab88bff826eebaf7cdbc93195c938` match frozen provenance.
[Inputs/pins](../inputs/freeze.json), [current verification](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-23/provenance.json).

Node24.21.0/pnpm12.16.1, own TypeScript7.0.2,13 exact package pins and pinned provider images remain
frozen. FFmpeg5.1.9 and OS lock retain the original recipe/build. The operator alone uses root
Playwright1.63.0/Chromium153.0.8010.12. The independent app has no checkout imports/workspace
packages or network model dependency. [Build/runtime identity](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-23/build-identity.json).

[YV2-20 alternate attachment proof](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-20-reuse-and-freeze.md)
uses the same upload/lifecycle/media/durability implementations under unrelated fitting-* authority,
resources and productId/caption metadata, with real multipart/CPU encoding/ready receipts. Its28
shared runtime files are byte-identical; no YouTube/search/count modules or grants are required.
That is a small compiled consumer, not a full Marketplace application. Base feature hooks remain
honest when unbound. Generated YouTube-specific adapters are distinguished from reusable mechanisms.

The studio drawing is design input, installed templates establish available implementation, and
these runtime observations are verification evidence. Frozen generation metadata deliberately stays
runtime:none/strict:not-assessed; no strict TinyURL/enterprise/template certification is inferred.
No fieldv3, arbitrary codecs, UI redesign, cloud/fraud/HA/security expansion or provider/fault/load
campaign was performed. Existing guessed partial/public-output keys, remote orphans, local HTTP,
bucket-scoped secrets, single instances and basic anonymous counts remain documented limits.
Source share does not measure reliability, coverage or labor savings; effort/tokens/cost remain unknown.

Required Jeeves regression results and final preservation proof are linked in the independent
evidence. Owner readability/usability acceptance and human listening remain owner observations.
