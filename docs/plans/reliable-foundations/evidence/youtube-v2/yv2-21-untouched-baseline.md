# YV2-21 — untouched generated YouTube v2 baseline

On 2026-11-08, from `main` at YV2-20 commit
`13bc6f83737253998fb224472d0590c39d05eb23`, the destination
`field-projects/youtube/v2/app` was confirmed absent. The actual new-directory exporter created
all **93 files, 4,243,495 bytes** in that directory. No generated file was edited, formatted,
repaired, substituted or supplemented. This containing commit is the immutable generated
comparison anchor; YV2-22 records its hash afterward, avoiding self-reference in generated metadata.

## Exact command and provenance

From `/home/ash/github/jeeves`, with Node **24.21.0** and pnpm **12.16.1**:

```sh
export PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH
pnpm --filter @jeeves/generator export:v2 /home/ash/github/jeeves/field-projects/youtube/v2/inputs/design.json /home/ash/github/jeeves/field-projects/youtube/v2/app
```

Actual exporter result:

```text
files: 93
applicationComplete: true
findings: 0
requiredGaps: 0
```

The [frozen input](../../../../../field-projects/youtube/v2/inputs/design.json) is the exact
30,016-byte canonical UTF-8 source, with no trailing newline. It was passed directly to the CLI,
never reserialized. The embedded `.jeeves/inputs/design.json` is byte-identical. Every emitted
path, SHA256 and byte count matches the frozen
[93-file inventory](../../../../../field-projects/youtube/v2/inputs/output-path-hashes.json),
including the manifest itself.

| Identity | SHA256 |
| --- | --- |
| Exact source / embedded source | `e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b` |
| Normalized semantic input | `03f0e523e6bcc303e89e4465fe7163d4ca886feafd9a75d3ea23d53d7d671ec0` |
| Default registry | `6d0a8916c90be61c10736dc58cac91a0f9deaabeefeadc5ec077b7d997b4086f` |
| Manifest | `1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc` |
| Report | `e56c904f3e21eed4300d77483554df672bd7f5c41c10ca44b3602a8e598e6d57` |
| Normalized file | `19d900c8bea6bfde107eee0aa7d6a21f3bfb676fade59ef62ff0fe8365df4e62` |
| Complete output inventory | `ed6eab9609fd59b4148b72ddd25e4481770ab88bff826eebaf7cdbc93195c938` |

The manifest's **92 payload records, 1,076,935 bytes**, all match their actual files. Its registry
records match all **156** current source/asset byte counts and hashes and the frozen registry
inventory. Generator `jeeves-v2@0.1.0-experimental.1`, runtime, preset, **10 template** selections,
**15 implementation** identities and dependency/FFmpeg lock hashes match
[template-identities.json](../../../../../field-projects/youtube/v2/inputs/template-identities.json).
No template, provider, dependency version, frozen input or benchmark method changed.

## Own frozen install and untouched build

From the emitted app directory, both commands exited **0**:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
```

The install used the app's own unchanged lockfile: **109 packages reused, 0 downloaded**. Its
TypeScript **7.0.2** compiler resolved beneath the app's own `node_modules/.pnpm/`; the actual
build log is `$ tsc -p tsconfig.json`. All 93 payloads still matched after build. Review of
**13 exact dependency pins** and **229 imports** found no Jeeves/workspace/checkout dependency
or relative import escaping the app. No runtime was initialized; there are no actual credentials,
tokens, private keys, `.env`, `.runtime`, media, dependencies or build files in the baseline.

Only ignored `node_modules/` and `dist/` were created. Both were removed before root checks,
then every emitted hash and byte count was checked again. Root tooling excludes the field app;
the successful root checks do not replace this separate emitted-project build.

## Required checks and preserved state

After cleanup, `pnpm check` was explicitly awaited to exit **0** before starting E2E:

| Command | Actual result |
| --- | --- |
| `pnpm check` | Lint/types pass; **467 tests / 70 files**, **31.17s** |
| `pnpm test:e2e` | **37 native Chromium tests**, **1.3m**, exit 0 |
| `pnpm --filter @jeeves/web build` | Pass, **979ms**, existing chunk-size advisory |

Existing browser coverage includes TinyURL's lane canvas, mouse selection/actions/Undo and the
selected-source v2 generation flow. This unit changes no studio UI or browser implementation.
No assertions, timeouts or pins were weakened. Existing generator lint advisories remain.
The additional `git diff --cached --check` reports the frozen generated Dockerfile's blank line
at EOF (line 31). Its pinned bytes are preserved; the evidence and appended handoff pass that check.

All **748** captured protected file hashes/modes remain unchanged, including owner README,
feedback changes/Unicode Zone.Identifier deletions/colon variants, e2e-docker mode, v1 app/inputs/
evidence and local-v1 assets. Historical v1 manifest remains
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
The retained fixture is **15,584,953 bytes**, SHA256
`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`;
all **14** v1 services are healthy, its **six** volumes remain, and retained FFmpeg image
`1792f4e0fb15896196cf9e3ba3d32ab2804ec27f4f7ab04c62ce050a102d8585` still exists unchanged.
No own Docker resources, databases, credentials or listening services were created. No branch,
worktree, stash, push, global cleanup or owner-service restart occurred.

## Evidence and limits for YV2-22

Logs and the independent standard-library verifier are under `/tmp/jeeves-yv2-21/`:
`export.log`, `install.log`, `app-build.log`, `check-final.log`, `e2e-final.log`, `web-build.log`,
`verify.py`, `verify-after-build.json`, `verify-after-cleanup.json`, `artifacts-cleanup.json`
and `preservation.json`. Build log SHA256 is
`29c5ee0f6b0b20dbb259b99d01276198c3d28190090706394608d4deda6d2c0b`;
check/E2E/web logs respectively are
`5ab9d8659db9a6b9e902206ce66fffdd486a018da567668170ad20499694b6c7`,
`c1f24e189bb59873d931f8bf682ffadd6aa784033e667ca0b3174d1df51de72f`,
`24dee820a510de9f7287ef3511b607df5a4f0464d105473333c4e16506c0da63`.

The generated report remains `applicationComplete: true`, `runtimeVerification: none`,
`strictReadiness: not-assessed`; support completeness is separate from browser/scenario evidence.
The static page is still the explicit browser slot. The exact bytes already received one complete
backend and alternate-consumer preflight in [YV2-20](yv2-20-reuse-and-freeze.md); this unchanged
baseline does not repeat those providers/encodes or claim S01–S08 browser completion.
No v2 LOC percentage or new certification is claimed.

Next **YV2-22 only** reuses the existing browser and records this baseline commit before custom
changes. Preserve kept studio project `2c7c8b08-4633-4a97-8794-672a777f1d3a`, revision 2.
Final runtime remains unstarted and reserved as `jeeves-youtube-v2`, loopback
**45400 / 45401 / 45402**, private `app/.runtime`; recheck availability before first start.
Independent restart and final backend-only retained-template report remain YV2-23.
