# FP04 evidence: untouched actual mouse ZIP baseline

Base FP03b **`aedbd606342c5a369142b10cf127fc7130d50671`**. Sequential Sol/xhigh unit, sole writer
on primary main; no delegation/branch/worktree/stash/push. The 108 actual generated files now live
in [app/](../../../app/). [Baseline provenance and S01–S08 observations](../../baseline.md) record
the exact source/profile/template/archive/image identities and remaining behavior. No FP05 plan,
custom application code, template repair or regenerated lockfile is part of FP04.

## Actual generation and extraction

`node /tmp/jeeves-fp04/capture.mjs` drives Chromium by mouse on the existing owner4300 instance:
select retained project `293b4a2d-e25b-4a5b-83da-b27de7876f02` revision3; **Generate project → Preview
scaffold → Download project ZIP**, then repeat Download. Final check repeats this after all required
Jeeves checks. [Preview](browser-preview.json.gz), [browser result](browser-result.json), inspected
[actual preview](generation.png) and [TinyURL](studio-tinyurl.png) screenshots are retained.

Both downloads are 946,247-byte stored ZIPs, SHA256
`c885dd34e323c1102447587db25d68d273c5897826c240db31a9c222b8269c86`.
The [current assembler result](assembler-result.json) records every family source hash and repeats
assembly byte comparison. [Inventory](expected-payloads.json.gz) includes all108 files, 931,999 bytes.
Final manifest is 80,362 bytes, SHA256
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`;
its 107 hashed payloads total 851,637 bytes.

`python3 /tmp/jeeves-fp04/verify-extract.py` uses independent Python `zipfile`; its
[result](archive-verification.json) records every CRC/path, exact byte comparison against the
current assembler, all manifest hashes, immutable JSON/005 PNG equality and ZIP metadata checks.
The complete preflight precedes any extraction. New destination roots/ancestors reject symlinks,
all paths come from the verified inventory and every file is exclusively created without overwrite.
App and independent scratch roots/nonsecret directories are0755; files0644. Runtime secrets were
never provisioned. ZIPs and assembler byte buffers remain scratch artifacts outside Git.

## Independent installs/builds and bounded failure observation

These commands ran sequentially in **both** `field-projects/youtube/v1/app/` and fresh independent
`/tmp/jeeves-fp04/independent-app/`:

```sh
PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:/home/ash/.local/bin:/usr/bin:/bin pnpm install --frozen-lockfile
PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:/home/ash/.local/bin:/usr/bin:/bin pnpm build
```

All four commands pass. Install logs report109 packages, all reused, zero downloaded. The independent
copy has no Jeeves parent; each app has its own node_modules/TypeScript7.0.2 and standalone lock.
[Build audit](build-audit.json) verifies all108 source files/locks unchanged after build, no workspace/
checkout/Jeeves imports or escaping relative imports, root lock unchanged, protected studio/template/
input/image bytes unchanged, and earlier handoff/work-log/ledger/index entries preserved verbatim.

`node /tmp/jeeves-fp04/behavior.mjs` from the independent app invokes all seven compiled extensions:
every call rejects `CUSTOM_IMPLEMENTATION_REQUIRED`, status501. [Observed results](independent-behavior.json).
Source inspection confirms HTTP fallback501, failing worker handlers and static browser notice.
No complete S01–S08 scenario ran; G01–G08/all25 unsupported paths remain. Prior real infrastructure/
provider/helper evidence is [FP03a](../fp03a/README.md), not repeated or relabeled as application credit.
No field setup, media, Docker campaign, runtime secrets or app server was needed in this unit.

## Existing Jeeves regression checks and preservation

Sequentially after source settled, on Node24.21.0/pnpm12.16.1:

| Command | Actual result / log |
| --- | --- |
| `pnpm check` | Lint and all workspace typechecks pass; **398 tests /50 files**, 19.79s unit run; [log](check.log.gz) |
| `pnpm test:e2e` | **36 native Chromium E2Es pass (1.2m)**, scripted model, no source changes during run; [log](e2e.log.gz) |
| `pnpm --filter @jeeves/web build` | Pass **990ms**, existing chunk advisory; [log](web-build.log.gz) |
| Final owner4300 mouse check | Real preview/two equal downloads, YouTube21 tiles/25 lines; TinyURL53 Fit12/13; zero page/console errors; [log](final-browser.log.gz) and [result](browser-result.json) |

All four complete owner project/design/history/layout/blueprint responses and project listing match
both around generation and across the entire unit. E2E database [before](e2e-projects-before.txt) equals
[after](e2e-projects-after.txt): original default TinyURL only. Owner4300/4310 stay healthy with their
original watchers; no duplicate watcher or capture server started. E2E4301/4311 stop normally.
Other Compose projects and unrelated `.jeeves-feedback/` are preserved. No paid/live/cloud calls,
secret/token/capability output, broad tests, certification campaign or automatic v2.

## Failed diagnostic attempts

The first install command trimmed PATH to Node plus system bins and omitted `/home/ash/.local/bin`,
where pnpm actually lives: `pnpm: command not found` ([log](install-path-failure.log.gz)). Adding that
directory fixes command discovery; no install/build or payload failed. A first extension probe
mistakenly expected `UNIMPLEMENTED_SCAFFOLD`; actual code is `CUSTOM_IMPLEMENTATION_REQUIRED`.
Correcting only the scratch probe expectation verifies all seven failures; no application edit.

Read-only inspection also assumed absent `pnpm-workspace.yaml` inside the ZIP, an obsolete server
test path, root `node_modules/.bin/tsx`, and child `biome.json`, `src/lib/unimplemented.ts` and
`infra/nginx.conf` paths. Actual inventory resolves the script via server's tsx, root Biome,
`src/lib/env.ts` and `infra/edge/nginx.conf`; the independent app intentionally has no workspace file.
These diagnostic misses changed no source. Mandatory checks pass first attempt in FP04.

Scripts and full install/build/check logs are gzip-compressed beside this file. The archive
extractor intentionally refuses existing destinations; do not rerun it over the retained app.
Future custom work records edited/new/reused files against the following recorded FP04 commit;
immutable `.jeeves` provenance and historical snapshots must remain unchanged.
