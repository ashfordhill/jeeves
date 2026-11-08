# YV2-11 media worker evidence

`local.media-worker` emits reusable `src/runtime/{media-worker,media-objects}.ts`, composing
YV2-05 confirmed delivery and YV2-10's fixed video engine. It contributes explicit selected
originals read, outputs read/write and job-consumer wiring through the existing foundation.
[Actual APIs, wire boundaries, ownership and remaining bindings](../../youtube-v2/interfaces.md#yv2-11--storage-backed-media-worker-runner).
There are no product contracts, SQL credentials, search/count requirements or new controls.
Required compiled job/result/event/namespace/transport/service and pinned-image bindings remain
unfinished until YV2-15/16; libraries and access alone do not install a source-bound template.
`applicationComplete:false`, installed templates empty. YV2-16 must check FFmpeg/ffprobe before
marking its actual process ready; non-video apps still need no media runtime.

## Real storage, broker and media execution

Disposable project **jeeves-yv2-11-media**, recorded before startup in
`/tmp/jeeves-yv2-11/resources.json`. Allocated free loopback ports **45260/45261/45262**, with
**45263** reserved for a possible broker probe; only Garage **45262** was published. Actual
generated first-run started **local-broker/local-objects**, two volumes and one network, using
the existing exact provider pins. No SQL/identity/search/count service or login was generated.
A separate scratch seed key wrote source fixtures; worker source writes were actually **403**.
The foundation's existing broker credential scope/local storage website limits are unchanged.

Final generated code ran in the inspected **jeeves-yv2-11-probe** container from retained image
`sha256:1792f4e0fb15896196cf9e3ba3d32ab2804ec27f4f7ab04c62ce050a102d8585`, actual
FFmpeg **5.1.9-0+deb12u1**. YV2-10 records that image's exact FFmpeg/288-package verification.
Root filesystem, generated code, own scratch credentials and exact source fixture mount were
read-only; workspace/evidence were owned writes. The fixture file alone was mounted from v1,
not its private runtime parent. Container inspection and the generated plan confirm **no SQL
mount/login/service**. No image/tag pin or global provider configuration changed.

The retained fixture remains **15,584,953 bytes**, SHA256
**1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9**.
A lesson/attachment envelope uses `course`, `attachment` and injected source/result namespaces;
the worker imports no YouTube schema. Real AMQP job delivery downloads and hashes actual
Garage bytes, encodes with the fixed engine and emits broker-confirmed callbacks.

| Observed boundary | Result |
| --- | --- |
| Fresh job | One source download and engine call; real H264/AAC360/720 HLS and full-size thumbnail;14 inventory objects and final marker =15 PUTs |
| Upload order | All segments, then rendition playlists, then thumbnail, master and `_complete.json` last |
| Verification | Worker re-reads bound marker and Heads all inventory before success; harness independently downloads/hashes every output and checks size/type/SHA metadata |
| Duplicate same job | Same logical success ID/result; no extra source read, encode, temp directory or PUT; all15 objects' actual bytes/SHA/ETag/LastModified/version remain equal |
| Invalid media | Actual invalid-file ffprobe rejection; confirmed **INVALID_MEDIA** event, failed queue **INVALID_MEDIA**, first attempt, no outputs |
| Local ownership | Workspace empty after success/duplicate/failure; normal close returns `fatal:false`; fixture hash unchanged |

This is bounded real queue/storage/media evidence. Reuse checks remote SHA **metadata**, not
remote object bytes; only the independent probe re-downloads output bytes. One worker/prefetch1
is assumed; no distributed namespace lock, multi-object atomic publication or stronger ACL is
claimed. Partial prefixes can be rewritten before a complete marker; remote cleanup, process
signals/readiness and installed product lifecycle/publication/playback remain later bindings.

## Standalone and offline checks

Two final deterministic **33-file** exports have identical path/hash lists. A fresh export
passes its own exact frozen install and untouched build. An additional typed lesson worker
adapter compiles with a different wire envelope, result/path codecs, explicit bucket clients
and real YV2-05 factories; no SQL/search/count/product dependency or copied media implementation.
Three focused offline cases execute emitted source: ordered uploads/stable duplicate/inventory
refusal; actual byte-hash mismatch/finite terminal/malformed identity/cleanup; fatal abort/drain,
all owned closes attempted despite rejection, and exact selected storage/queue-only access.
No unit test needs a provider, Docker, FFmpeg or network.

The first full regression run found an older multipart emission test selected every feature
while asserting only upload storage. It now selects multipart alone and retains its exact
minimal-permissions assertion. Media permissions are checked separately. No production
assertion, timeout, provider pin or frozen fixture was weakened.

Final `pnpm check` passes lint/types and **444 tests/63 files,28.59s**, with existing Biome info.
Native `pnpm test:e2e` passes **36 tests,1.3m**; web build passes **880ms**, with the existing
chunk-size advisory. No UI changed; browser checks retain TinyURL lane rendering and mouse flows.

Frozen v1 remains **108 identical paths/hashes**, manifest SHA256
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Root README (including owner Future Benchmarks), owner feedback dirt/e2e-docker mode, all v1
source/input/runtime/fixture and fourteen healthy retained services were preserved. No field
v2 app, branch, worktree, stash, push or global prune.

Logs/harness under **`/tmp/jeeves-yv2-11/`**: `focused-final.log`, `export-verified.log`,
`export-summary.json`, `install-verified.log`, `build-verified.log`, `build-adapter-verified.log`,
`first-run-final.log`, `probe-final.log`, `mount-check.log`, `check-final.log`, `e2e.log`,
`web-build.log`, `cleanup-final.log`, `cleanup-files.log`, `cleanup-summary.json`,
`media-evidence/{summary,marker,mounts,snapshot-before,snapshot-after}.json`, `v1-path-hashes.json`
and `fixture-after.log`. Scoped containers, two volumes, network and own app image are removed;
all four ports free, retained pinned media image untouched. Owned scratch source/dependencies/
build/runtime/work were removed; sanitized logs/harness/evidence remain without media/secrets.
