# YouTube v2 frozen generation inputs

YV2-20 freezes the final generator investment before the untouched YV2-21 application commit.
The frozen generation step preceded the untouched `v2/app` baseline and custom completion.
See [baseline](baseline.md), [current runtime](runtime.md) and [walkthrough](scenarios.md).
Keep the separate studio project for owner review:
[YouTube · field v2 · local Docker](http://127.0.0.1:4300/?project=2c7c8b08-4633-4a97-8794-672a777f1d3a),
project `2c7c8b08-4633-4a97-8794-672a777f1d3a`, saved revision **2**. Earlier owner projects were
unchanged. [Snapshot](../diagrams/001-frozen-generation/README.md) retains native/source/studio views.

`../inputs/design.json` is the exact server-canonical generation input: sorted object keys,
array order preserved, UTF-8 with **no trailing newline**. The pretty downloaded source is a
separate review artifact. Do not pretty-print, resave or substitute it before baseline generation.
Its SHA256 is `e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b`.
The explicit installed YouTube attachment and mouse cache TTL3600→3601 are saved in that source;
TTL3601 reaches the actual Watch constructor.

YV2-21 runs exactly this from `/home/ash/github/jeeves`, on the committed YV2-20 tree:

```sh
export PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH
pnpm --filter @jeeves/generator export:v2 \
  /home/ash/github/jeeves/field-projects/youtube/v2/inputs/design.json \
  /home/ash/github/jeeves/field-projects/youtube/v2/app
```

The destination must not exist. Verify all **93** emitted path hashes against
[`output-path-hashes.json`](../inputs/output-path-hashes.json), including the manifest itself.
[`freeze.json`](../inputs/freeze.json) pins the input, normalized model, registry, output inventory,
manifest and concrete command. Registry source/asset hashes and implementation/template/dependency
identities are alongside it. Expected manifest:
`1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc`.
Use the generated project's own `pnpm install --frozen-lockfile --ignore-scripts` and untouched
`pnpm build`. Commit that output before any YV2-22 custom browser/completion work. Root tooling
excludes the field app; root checks do not build it or authorize formatting its baseline.

Reserved by YV2-20 and now retained by YV2-22 ([runtime record](runtime.md)): Compose `jeeves-youtube-v2`, loopback HTTP45400,
identity45401, objects45402, private `app/.runtime` (0700). Recheck availability immediately before
first start; preserve these values, credentials and volumes across normal restart. Scratch
preflight used different project names/ports and was completely removed.

[Reuse/preflight evidence](../../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-20-reuse-and-freeze.md)
proves the backend smoke, not the reused browser or all S01–S08 mouse criteria. The generated static
page is a browser slot. Runtime verification remains `none` and strict readiness `not-assessed`.
The reviewed [backend/UI scope](benchmarks/scope-review.md) excludes every UI file; YV2-23 owns the
actual final retained-template report and the strictly-greater-than-5.53% comparison. The final [actual report](benchmarks/README.md)
records 5,456 / 5,456 backend LOC (100%); 60% remains an eventual field-project target.
[Owner review pack](review-pack.md) separates source composition from observed behavior and limits.
