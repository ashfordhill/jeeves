# Actual v2 backend source composition

**5,456 retained template LOC / 5,456 completed backend LOC = 100%.** Post-template backend
LOC **0**; removed/replaced template LOC **0**; **56** included files. This exceeds the v2
criterion **strictly greater than 5.53%**. The eventual 60% cross-project target was never an
acceptance threshold. UI and integration work remain custom; this is not a whole-app/effort score.

[Actual report](source-loc-v2.json), [reviewed scope](backend-scope.json),
[per-file feature attribution](feature-attribution.json), [method](../../../../../docs/field-projects/source-loc.md),
[independent functional evidence](../../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-23-independent.md).

- Actual untouched baseline: `695addeb3ac4a77c3a6fbfd2f68d901fced3619f`.
- Actual completed app: `08699b2dc631709bff12fb25914e0d2681b6b535`.
- Scope JSON-content SHA256: `e326c2ea0041620bf43ec23f13942306656223cfc5637713acee89e77d89ef2d`.
- Committed report SHA256: `fd18d44fdd4a8fabaccb346fdf22d17e3cde6d00bb677bf73c6fbfb83e2f2de4`.
- Exact CLI stdout SHA256: `5dc3ca627a205d3dfa52f30de5d367aa26b86eb613be0815775137db0d26d380`; its [raw gzip](../../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-23/source-loc-v2-cli.json.gz)
  is retained. Biome changes JSON whitespace only in the committed report; parsed content matches.
- Manifest SHA256: `1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc`.
- Parser `rolldown@1.2.15`, method `source-loc-v2`, same per-path LCS and denominator policy.

```sh
pnpm --silent --filter @jeeves/generator benchmark:source \
  field-projects/youtube/v2/app \
  695addeb3ac4a77c3a6fbfd2f68d901fced3619f \
  08699b2dc631709bff12fb25914e0d2681b6b535 \
  field-projects/youtube/v2/notes/benchmarks/backend-scope.json
```

The YV2-20 scope and frozen baseline remain unchanged. All 60 backend `src/` files are byte-identical;
exactly four pure-data binding files are excluded from both totals, including two unused emitted
binding descriptors. Mixed executable/data files count. All five browser files and presentation,
browser build/runtime identity serialization, Docker/edge/setup integration, SQL and infrastructure
stay outside this backend source metric. No backend logic was moved into an excluded path.

The import review finds **55 of 60** source files reachable from `src/services/youtube.ts` (including
type imports and two configuration files excluded from LOC). The remaining three counted SQL constructors
are `upload-sql.ts` (34 LOC), `asset-sql.ts` (26) and `youtube-public-sql.ts` (15). The generator uses
their exact shared template source to render the actual upload/lifecycle/ready SQL. They are also
emitted for module consumption but are not called by this app's runtime; do not present the LOC
metric as runtime coverage. The other two are excluded pure-data descriptors. No code, baseline,
scope or parser was added/changed to pad this measurement. Backend growth versus v1 reflects the
extracted mechanisms, interfaces and composition; LOC does not establish their necessity or quality.

Each file is assigned once to its **frozen manifest owner emitter** below; shared helpers are not
counted again in each consumer. YouTube adapters contain generated product policy and do not become
generic merely by being emitted. “Repaired” means post-baseline backend repair in this comparison.

| Frozen owner / responsibility | Files | Generated retained LOC | Custom backend LOC | Repaired backend LOC |
| --- | ---: | ---: | ---: | ---: |
| `local.youtube-adapters` | 13 | 880 | 0 | 0 |
| `local.video-composition` | 4 | 473 | 0 | 0 |
| `local.primitives` | 8 | 647 | 0 | 0 |
| `local.asset-identity` | 2 | 24 | 0 | 0 |
| `local.asset-lifecycle` | 3 | 557 | 0 | 0 |
| `local.event-counter` | 4 | 146 | 0 | 0 |
| `local.durability` | 4 | 300 | 0 | 0 |
| `local.foundation` | 1 | 10 | 0 | 0 |
| `local.media-worker` | 2 | 450 | 0 | 0 |
| `local.video-hls` | 3 | 532 | 0 | 0 |
| `local.multipart` | 3 | 555 | 0 | 0 |
| `local.upload-state` | 2 | 457 | 0 | 0 |
| `local.positive-cache` | 2 | 140 | 0 | 0 |
| `local.search-projection-query` | 5 | 285 | 0 | 0 |
| **Total** | **56** | **5,456** | **0** | **0** |

The reused custom browser implements PKCE, upload controls/state, search and playback qualification.
[YV2-22 provenance](../../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-22/provenance.json)
records its v1 origins plus nine modified generated integration paths/nine added paths. This
independent unit changes no app/template file. Generator/studio/template investment in YV2-01–20
preceded baseline credit; custom UI/integration followed in YV2-22. Active effort, tokens/cost and
savings are unknown. Source share is neither reliability nor certification.

V1 remains **159 / 2,874 = 5.53%**, post-template 2,715. Historical reports are untouched.
[Identity audit](../../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-23/v1-report-identity.json)
shows identical parsed historical content and exact 26,598-byte current CLI parity with YV2-20's
old/new CLI comparison. The stored historical report has a one-line `uiPaths` array; its 26,586-byte
formatting is preserved. The two versions have different implementations/LOC sizes, the same frozen
scenario scope and backend-only method; they are not equal-work/coverage/effort experiments.
