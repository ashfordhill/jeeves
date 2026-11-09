# YV2-23 — independent actual v2 and fair backend comparison

**Actual backend result: 5,456 retained / 5,456 final LOC = 100%, with 0 post-template LOC.** The
unchanged source-loc-v2 report exceeds 5.53%. An exact tracked copy of actual completion independently
builds/runs/restarts without product edits. S05 human listening remains unobserved; S04 successful
live encoder argv/stderr are absent. [Owner review pack](../../../../../field-projects/youtube/v2/notes/review-pack.md) ·
[actual report/attribution/scope/identities](../../../../../field-projects/youtube/v2/notes/benchmarks/README.md).

## Actual source and independent execution

On main, exact completion **08699b2dc631709bff12fb25914e0d2681b6b535**, prior untouched baseline **695addeb3ac4a77c3a6fbfd2f68d901fced3619f**. No app/template/input/
scope/parser/pin edit, branch/worktree/stash/delegation/push or model call. Outside copy
`/tmp/jeeves-yv2-23/independent-app` came from `git archive` of all102 tracked app files;
[copy inventory](yv2-23/copy.json) verifies every blob by hash/size, before install and again before
cleanup. No ignored runtime/build/dependencies/symlink/checkouts import was copied.
[Provenance audit](yv2-23/provenance.json), [operator source](yv2-23/audit.py.gz),
[current actual default-registry verification](yv2-23/current-registry.json).

[Allocation](yv2-23/allocation.json) was written before first-run and rechecked immediately before:
**jeeves-yv2-23-independent**, loopback45410/45411/45412, new private0700runtime and new credentials.
The owner v2stack45400–02 and v1stack4400–02 stayed running. Followed the actual copied README:

```sh
export PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
export COMPOSE_PROJECT_NAME=jeeves-yv2-23-independent
export LOCAL_HTTP_PORT=45410 LOCAL_IDENTITY_PORT=45411 LOCAL_OBJECT_PORT=45412
pnpm first-run
# Provision review users privately, then copy the exact retained fixture preserving mtime.
APP=/tmp/jeeves-yv2-23/independent-app OUT=/tmp/jeeves-yv2-23/evidence \
TOOLING_ROOT=/home/ash/github/jeeves FIXTURE=/tmp/jeeves-yv2-23/independent-app/.runtime/media/youtube-v1-fixture.mp4 \
node /tmp/jeeves-yv2-23/walkthrough.mjs
pnpm stop
pnpm start
```

Own frozen [install](yv2-23/install.log.gz), untouched copied [backend/browser build](yv2-23/app-build.log.gz),
[Docker first-run](yv2-23/first-run.log.gz), [provisioner](yv2-23/provision.mjs.gz) and
[public runtime identity](yv2-23/build-identity.json).14 services healthy. Realm/client/audience
identity/identity-web and browser callback/issuer use the new allocation without source editing.
Node24.21.0/pnpm12.16.1 and all package/provider/FFmpeg pins are unchanged. Root Playwright is
operator tooling, not an application dependency or a source import.

## One bounded flow and one normal restart

[Full sanitized browser result](yv2-23/walkthrough.json), [harness](yv2-23/walkthrough.mjs.gz),
[log](yv2-23/walkthrough.log.gz), [original/SQL/outbox](yv2-23/originals.json),
[actual output hashes/ffprobe](yv2-23/media.json), [private original 403](yv2-23/private-original.json),
[two count receipts](yv2-23/count-state.json), [metadata cache](yv2-23/cache-state.json).
The owner pack gives per-S01–S08 observed/partial/unobserved criteria. This independent flow uses
one valid exact fixture transfer/CPU encode, one separate partial abort and one tiny invalid-media
file. No extra successful encode, duplicate-job/provider/fault/load matrix or product repair.

Valid ready **8d973dc2-be73-42ff-822c-26a0b76a5228**, exact15,584,953B original SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9.
Part 1 pause, refresh/same-ID/parts 2+3 only, stable completion/job/attempt, anonymous401/foreign404,
abort410, invalid→INVALID_MEDIA/public404/search 0. Uploading→pending→processing→ready; actual
15 objects/14 inventory hashes,20 s H264/AAC640×360+1280×720 and1280×720JPEG. Real search953 ms after
committed publication. Signed-out8.014 s/218 decoded/0 dropped, mouse seek8.244→15.453 s. Automated
unmuted440.085 Hz PCM/RMS .06245 is **not human listening**. Successful encoder live argv/stderr were
not retained; [unchanged source argv](yv2-22/encoder-source.ts.gz) remains source evidence only.

Metadata/search/no-play0; short play+seek0; cumulative2s event→visible 1 in1,762 ms; same-page/duplicate
same-ID stays 1; a new page session reaches2. Actual DB 2 receipts/total 2 and uncached fresh total 2
are retained. [Signed in](yv2-23/signed-in.png), [paused](yv2-23/paused.png), [resumed](yv2-23/resumed.png),
[ready](yv2-23/ready.png), [aborted](yv2-23/aborted.png), [invalid](yv2-23/invalid-media.png),
[search/thumbnail](yv2-23/search-watch.png), [public play](yv2-23/signed-out-playing.png),
[two views](yv2-23/new-session-two-views.png).

Normal [stop](yv2-23/stop.log.gz)/[start](yv2-23/start.log.gz) retain the same credential-set digest,
exact five volume identities/database/index/media/count 2,14 healthy. [Before](yv2-23/runtime-before-restart.json),
[after](yv2-23/runtime-after-restart.json), [summary](yv2-23/restart-summary.json),
[real mouse search/retained decode/login](yv2-23/restart-mouse.json), [image](yv2-23/restart-watch.png).
No initialization/credential rotation/volume replacement was performed.

Operator-only failed assumptions were corrected without product changes: an initial shell targeted
a directory before it was created and refused before executing; a reachability assertion expected
every emitted source to be runtime-imported, while the original template intentionally emits three
generator-used SQL constructors and two excluded descriptors; a raw media object key was mistaken
for an edge URL prefix; a DB probe compared PostgreSQL bigint's string to a number. Repeated only
affected read-only probes, not the functional walkthrough or encoding. The CLI audit also initially
assumed historical JSON formatting matched raw CLI bytes; parsed content is identical and exact
old/current CLI parity is verified separately. Root `tsx` was unavailable; the registered generator
workspace executable performed the registry check. No product defect was observed or repaired.

## Cleanup, regression and preservation

Before required root checks, exact
`docker compose -p jeeves-yv2-23-independent --profile '*' down --volumes --remove-orphans`
and removal of only its two app/media image tags completed. [Cleanup result](yv2-23/cleanup.json),
[log](yv2-23/cleanup.log.gz), [operator source](yv2-23/cleanup.py.gz):0 own containers/volumes/networks/
image tags, ports 45410–12 free,102 tracked hashes rechecked; entire copied app/runtime/secrets/media/
dependencies/build removed. No global prune. Owner normal stacks remain retained.

The first required root check stopped at eight pre-existing YV2-22 evidence JSON formatting errors,
not product/test failures. Exact eight files received whitespace-only Biome formatting; parsed
content is identical. [Old/new SHA mapping](yv2-23/prior-evidence-format.json) verifies each original
against completion08699b2; [original byte archive](yv2-23/yv2-22-evidence-before-format.tar.gz)
preserves any prior byte-hash reference. No app/template/input/scope/parser/history was changed.
[Initial lint result](yv2-23/check-initial.log.gz). Final regression/preservation results follow below;
no product behavior or source-share claim depends on a regression log alone. Runtime:none/strict:not-assessed
stay frozen historical facts. No new field version or certification follows.


Required checks after independent cleanup completed sequentially: `pnpm check` explicitly awaited
exit0 (**467 tests/70 files,33.45 s**, lint/types pass), then native `pnpm test:e2e` exit0
(**37 passed,1.4 m**), then web build exit0 (**1.24 s**, existing chunk advisory).
[Root check](yv2-23/check-final.log.gz), [E2E](yv2-23/e2e-final.log.gz),
[web build](yv2-23/web-build.log.gz). No assertion/timeout/pin weakening or tests removed.
Running studio4300 mouse TinyURL lane/Fit/select passed,0 page errors and temporary project deleted;
[mouse record](yv2-23/tinyurl-mouse.json), [image](yv2-23/tinyurl-mouse.png). TinyURL and independent
restart Watch screenshots were visually inspected.

[Final preservation](yv2-23/preservation.md):748 protected owner/v1 path hashes/modes and original
dirty status records retained; all 22 pre-existing named Docker tag→ID mappings unchanged; owner
v1/v2 remain14 healthy each,6+5samevolumes/credentials/fixtures. All 102 actual completion app bytes and
historical v1 benchmarks unchanged; saved v2 studio project retains r2/exact source. Only documentation,
new sanitized evidence/report and eight prior evidence whitespace fixes belong to this unit.
No later field version, branch/worktree/stash/push/delegation or further runtime campaign.
