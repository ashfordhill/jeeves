# FP02 verification evidence

FP02 implements the [generator foundation](../../../../../../jeeves-generator/README.md), not
application templates or a field runtime. No S01–S08 scenario ran and no functional coverage or
runtime certification is claimed. Frozen inputs/snapshots are unchanged.

Node **24.21.0**, pnpm **12.16.1**, primary `main`, after FP01
`acbc716c90245aeb398391f30f7800f988294cb4`. Required checks ran sequentially after source settled:

- [pnpm check](check.log): lint, all seven workspace projects' applicable typechecks,
  **393 tests / 48 files** (18.09s). The generator adds eight bounded tests to the prior 385.
- [pnpm test:e2e](e2e.log): **34 native Chromium tests, 1.1m**. No source edits during E2E;
  scripted chat and `jeeves_e2e` only. No retry was needed.
- [web production build](build.log): **959ms**, existing large-chunk advisory only.
- `pnpm install --frozen-lockfile --ignore-scripts` passed. Only the new generator importer is
  added to the lockfile; no dependency versions or prior optional-peer graph changed.

The eight network-free boundary tests cover repeated file bytes/provenance, exact source and
blueprint identity, all 25 unsupported overrides, named gaps/extensions, real optional-image hash
and a mutating renderer, malformed/stale/contradictory mappings and pins, unsafe/colliding paths,
invalid setting credit and preserving existing edits/custom files. A tiny diagnostic test renderer
emits JSON only and is never installed as an application template.

The bounded [mouse check](browser-result.json) used the running owner's web4300/API4310 at
1280×800: retained TinyURL study renders **12 tiles / 13 lines**; Fit and relationship legend work;
zero console/page errors. All four complete saved design/history responses and project listing
were equal before/after. The [screenshot](studio-tinyurl.png) was inspected. The [script](browser.mjs)
is retained for evidence, not part of an application. No new listener or project was created.
[E2E before](e2e-projects-before.txt) and [after](e2e-projects-after.txt) listings are equal and
contain only the original default project. Owner4300/4310 and other Compose projects were kept.

Early focused runs caught optional component-array type errors and one invalid test mutation
(the test added a service-only setting to the first worker); these were corrected before the
passing required checks. Initial pnpm resolution pruned unrelated optional-peer snapshots;
they were restored and frozen-lockfile installation passed. None is a field runtime result.
No Docker field stack, fixture video, paid model call, app files or application smoke was run.

Committed text logs strip trailing whitespace only; original command output remains in
`/tmp/jeeves-fp02/`. Browser evidence was formatted with Biome.
