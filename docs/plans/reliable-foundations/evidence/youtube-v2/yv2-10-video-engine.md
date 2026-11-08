# YV2-10 fixed video engine evidence

The actual generated engine compiles and processes the retained fixture without a product
contract, lifecycle SQL, search or counter module. It accepts the existing asset/job/attempt
identity plus explicit source fingerprint/result prefix. [APIs and runner cleanup contract](../../youtube-v2/interfaces.md#yv2-10--fixed-reusable-video-to-hls-engine).
`local.video-hls` and shared `local.asset-identity` are dependency implementations; no installed
source-bound video template or runnable service is advertised. Required worker/runtime recipe
gaps remain. Non-video outputs acquire no FFmpeg dependency.

## Actual pinned media execution

Executed the generated standalone `dist/runtime/video-hls.js` in an owned, network-disabled,
read-only container **jeeves-yv2-10-engine** from the retained exact image
`sha256:1792f4e0fb15896196cf9e3ba3d32ab2804ec27f4f7ab04c62ce050a102d8585`.
The fixture file alone was bind-mounted read-only; no owner runtime parent or credentials were
mounted. Output and evidence used separate owned `/tmp/jeeves-yv2-10` directories. No image/tag,
provider stack, port or volume was created or changed.

Actual **FFmpeg/ffprobe 5.1.9-0+deb12u1**, Debian package **7:5.1.9-0+deb12u1**, gcc12,
linux/amd64. All **288** installed package versions exactly match the retained
`infra/ffmpeg-os.lock`, SHA256
`8ec109b1f0d8354d937debaa4f62b387c78d178c6236adc639c8e6183476382d`.
FFmpeg executable SHA256
`0dafc1360bb07743f76abeb1e4ae16b0aaa1331e9041a0e8d6a8524111dc0cbb`;
ffprobe executable SHA256
`0e598fe6d247bfe63757f5c839dc145a166b3f876f2875ca88a306a5b8ec5a58`.
Full executable version/configuration is retained in `media-evidence/runtime.json` under that
scratch log directory. Image was already built with the frozen Debian/security snapshot
`20261024T000000Z`, exact FFmpeg deb SHA
`2ba8ead87657c123ce6de2de5ecdbc1fb4ead9a4b317b85b8ec41e16c890fe01` and package closure;
this unit verifies the installed closure rather than downloading a new package or changing pins.

The existing frozen-recipe fixture was **not regenerated**: **15,584,953 bytes**, SHA256
**1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9**,
source H.264/AAC1280×720,20.000s. Generic execution uses asset
`e724c5da-9e59-4b3e-a897-823c47d5463d`, source key
`lessons/raw/retained-fixture.mp4` and result prefix
`attachments/training-clip/renders/run-a/`; no `videoId` or product path module is imported.
The harness independently hashes the mounted source, every output file and the final inventory.

| Observed output | Independent probe/inventory |
| --- | --- |
| 360p rendition | H.264640×360 + AAC,20.000s; five actual MPEG-TS segments + VOD playlist,3,050,047 bytes |
| 720p rendition | H.2641280×720 + AAC,20.000s; five actual MPEG-TS segments + VOD playlist,8,348,639 bytes |
| Full-size thumbnail | MJPEG1280×720,68,896 bytes |
| Master | Both fixed renditions,194 bytes |
| Bound marker |14 unique allowed paths; every size/SHA256/content type checked against actual local bytes; asset/job/attempt/source/result prefix validated |

A separate scratch invalid-media file returns **INVALID_MEDIA**, removes the newly created
output and retains caller input. A pre-aborted signal preserves its reason and creates no
output. Existing successful output is refused and its master bytes preserved. Harness `finally`
removes input/success/failure output; `media-evidence/cleanup.json` records an **empty workspace**
and unchanged retained fixture size/hash. Container was automatically removed after exit.
No media bytes were committed. This is real local encoding/inventory evidence, not browser
playback, object publication, duplicate remote reuse, listening or end-to-end service evidence.

## Standalone output and focused invariants

Two final deterministic **31-file** engine-only exports have equal path/hash lists. One passes
its own frozen install and untouched TypeScript build. A separate typed course-video adapter also compiles
against the actual emitted engine and shared identity/result contracts; it owns course↔asset
link/visibility/prefix decisions without lifecycle SQL or product event imports. There is no
second engine implementation. Output paths are `src/runtime/{asset-identity,media-process,
video-result,video-hls}.ts`; dependency source hashes and contributors are in the generated
manifest. Required `video-hls-worker-bindings` and foundation/application gaps remain;
`applicationComplete:false`, installed templates empty.

Three focused offline cases execute exact template code: fixed source bounds/nonlocal path
refusal; marker identity/fingerprint/prefix/inventory checks; unsafe/incomplete playlist refusal
and honest engine-only generation. No unit test needs FFmpeg, Docker, providers or network.
Existing lifecycle tests continue through unchanged `assetUuid`/`AssetJobIdentity` reexports.
The shared identity extraction brings no SQL/SDK dependency into the engine.

YV2-11 still owns original download/hash verification, marker inventory validation/reuse,
immutable ordered uploads, confirmed callbacks and unconditional workspace cleanup.
YV2-15/16 own product schemas/path adapters and installed pinned service/image composition.
No extra codec, portrait mode, encoder form, GPU, scheduling or remote cleanup was implemented.

Frozen v1 remains **108 identical paths/hashes**, manifest SHA256
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
No local-v1 or v1 app/input/runtime/fixture/pin was edited. Root README and unrelated owner dirt
were preserved. No v2 field app, branch, worktree, stash, push or global cleanup was created.

## Regression checks and retained logs

`pnpm check` passed lint/types and **441 tests / 62 files (29.42s)**, with the existing Biome
style info. Native `pnpm test:e2e` passed **36 tests (1.3m)**;
`pnpm --filter @jeeves/web build` passed **988ms**, with the existing chunk-size advisory.
No UI behavior changed; E2Es include actual TinyURL lane rendering and mouse flows.

Logs under `/tmp/jeeves-yv2-10/`: `check.log`, `e2e.log`, `web-build.log`, `focused.log`,
`export-final.log`, `install-final.log`, `build-final.log`, `build-adapter-final.log`,
`export-summary.json`, `runtime-image.log`, `media-smoke-final.log`,
`media-evidence/{runtime,probes,marker,result,cleanup}.json`, both rendition playlists/master,
`v1-path-hashes.json` and `cleanup.log`. Scratch export/dependency/build/media work is removed
at handoff; sanitized logs/harness/evidence remain. The retained FFmpeg image and all owner
services/volumes/ports/fixture remain untouched.
