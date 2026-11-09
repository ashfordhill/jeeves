# YouTube v2: corrected reusable generation baseline

Owner-requested correction, 2026-11-08. Generate from the **same saved diagram**, after removing
YouTube product implementations from the active v2 generator. Count reusable backend output
before product completion. Video-domain features qualify; YouTube product policy does not.

## Result

The fresh export contains **4,325 backend LOC in 42 files**. Docker, Nginx, configuration, UI,
tests, docs and other existing exclusions remain outside the metric. The reviewed scope and
`source-loc-v2` parser/matching rules are unchanged.

| Measurement | Backend LOC |
| --- | ---: |
| Fresh reusable export from the original diagram | **4,325** |
| Lines matching the already-completed v2 backend | **4,317** |
| Existing v2 product implementation absent from this export | **1,139** |
| Existing completed v2 backend total | **5,456** |

The retrospective overlap is **4,317 / 5,456 = 79.12%**. The other 1,139 lines are 880 lines of
YouTube adapters/features and 259 lines of YouTube service wiring. They remain in the field
application, outside the active template baseline. These are **not newly observed lines added
after this export**: v2 already exists. A future field run must freeze its reusable export first,
then record the actual agent-completed commit and added/replaced lines.

The eight extra lines in the new export provide a generic positive-cache constructor that consumes
the diagram's TTL and accepts the application's record codec/eligibility/loader. Previously that
constructor call lived in the YouTube service entry point. No product schema or policy was moved
into this replacement. The per-file report identifies the difference in `service-resources.ts`.

Artifacts:

- [Per-file count and historical comparison](../../../field-projects/youtube/v2/notes/benchmarks/generic-source-loc.json)
- [Exact 72-file fresh export](../../../field-projects/youtube/v2/notes/benchmarks/generic-export.tar.gz),
  including the manifest, source, normalized model and explicit custom gaps
- [Recount command implementation](../../../field-projects/youtube/v2/notes/benchmarks/count-generic.ts)
- [Unchanged reviewed backend/UI/config scope](../../../field-projects/youtube/v2/notes/benchmarks/backend-scope.json)
- [Verification results](../../../field-projects/youtube/v2/notes/benchmarks/generic-verification.json)

## What went wrong in the original v2 measurement

The [original plan](youtube-v2-plan.md) put product adapters in YV2-15 and complete YouTube
composition in YV2-16, before YV2-21 froze generated output. That output already contained the
product's creator rules, public video schema, routes, search/event codecs and service recipe.
The old 100% result correctly measured that those files survived unchanged; it did not measure
the reusable starting point the owner intended. Moving application code into a product-specific
template cannot earn reusable baseline credit.

The old [raw report](../../../field-projects/youtube/v2/notes/benchmarks/source-loc-v2.json),
baseline commit `695addeb3ac4a77c3a6fbfd2f68d901fced3619f`, completion commit
`08699b2dc631709bff12fb25914e0d2681b6b535`, original pins and running field app are preserved.
The new count is a separately named replay, not a rewrite of that history. Excluding deployment,
UI and tests was intentional and was not the cause of the misleading reusable percentage.

## Generator boundary now

The active `local-v2` registry installs seven reusable capabilities: owned multipart upload,
asset lifecycle, CPU video/HLS processing, positive-cache reads, event counting, search projection
and search queries. Shared resource clients, transaction/outbox/receipt handling, admission,
authentication and process helpers remain. Video processing can serve another product without
the YouTube public record, creator rule, endpoints or playback event policy.

Removed from active generation: ten YouTube adapter assets, three product feature/schema assets,
the YouTube service entry point, their emitter/registration and the product recipe's SQL,
credentials, roles, search mapping and three-API edge wiring. Product implementations live in
`field-projects/youtube/v2/app`; regression tests consume those retained adapters against the
current generic mechanisms. The frozen legacy v1 exporter and historical source vocabulary remain
for compatibility. Keeping a saved `youtube-*` declaration readable does not install its code.

Normal mouse/chat attachment offers the reusable video feature only. The original v2 diagram
can still be exported without deleting or rewriting its product selections. Its report now has
three unfinished product selections, four missing-implementation findings and nine required
custom gaps; `applicationComplete` is false. It exports backend mechanisms and provider scaffolding,
not a finished YouTube backend. The application must supply its codecs, SQL projections, policy,
routes and service construction afterward. Known uninstalled declarations may produce a partial
export; unknown identities, invalid bindings, missing runtime and unsupported settings still block
the studio download. Existing stale-source and archive-integrity checks remain.

## Reproduce

From the repository root, using the checked-in Node/pnpm versions and a new destination:

```sh
pnpm --filter @jeeves/generator export:v2 \
  "$PWD/field-projects/youtube/v2/inputs/design.json" \
  /tmp/youtube-v2-generic-replay
pnpm --silent --filter @jeeves/generator exec tsx \
  ../field-projects/youtube/v2/notes/benchmarks/count-generic.ts \
  /tmp/youtube-v2-generic-replay
```

To recount the recorded artifact instead of regenerating with a later generator, extract
`generic-export.tar.gz` into an empty directory and pass that directory to the second command.
The command verifies every payload against the manifest and all 56 historical completed backend
files against the original report before counting. The archive contains no installed dependencies,
build output, runtime credentials or media. Its paths are sorted; tar metadata and gzip time are
zeroed for a deterministic archive.

| Pinned artifact | SHA256 |
| --- | --- |
| Unchanged source/canonical design | `e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b` |
| Fresh generator registry | `5e111615b7c4144ca7deea4be865be656dc55458efaf5619deb21a8cf6690990` |
| Fresh export manifest | `098355e2f11372a3493499bd6cb60d3e74b8a08740c8364751d12de671c04971` |
| Recorded export tar.gz | `c197b374f37c375349e69799497f906f67fff7f83a8a586991bd2af0032dd9ae` |

## Verification and limits

Two fresh exports matched all 72 files byte for byte. Their source/package/build payloads match
the export that passed frozen dependency installation and TypeScript build. The unrelated product
attachment export also installed and built using the same generic components. A compiled cache
consumer with an unrelated record shape exercised the selected TTL, a single load and a cache hit.
These checks do not claim the partial export runs a completed application or establish time saved.
Three counted SQL-constructor modules execute during generation rather than in the retained
application runtime; they remain in the unchanged reviewed scope.

Repository regression and live mouse-check results are recorded in the
[handoff](../../handoff.md): 468 unit tests, 37 native browser tests and the web build passed.
The live studio's 72-file download matched the recorded manifest and showed nine custom gaps;
TinyURL rendered and responded to mouse Fit/select. Six pre-existing designs were unchanged,
the temporary project was deleted and no page errors occurred. No full app regeneration, provider/media campaign or developer-mode
implementation is part of this correction.
