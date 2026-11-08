# FP01 evidence

Baseline/source/mapping evidence only. No field runtime, generator, templates, application code,
media fixture or functional benchmark was executed/created. S01–S08 remain **not run**.

Required existing Jeeves checks passed sequentially using Node **24.21.0**, pnpm **12.16.1**:

- `pnpm check`: Biome/all typechecks and **385 tests / 47 files**, 18.23s unit duration
  ([log](check.log.gz)).
- `pnpm test:e2e`: **34 native Chromium tests**, **1.1m**, source unchanged during the suite
  ([log](e2e.log.gz)).
- `pnpm --filter @jeeves/web build`: **1.02s**, existing chunk-size advisory
  ([log](build.log.gz)).
- Final diff/lint and [source audit](source-audit.json) pass. Exact snapshot file hashes,
  canonical sorted-JSON source hashes, PNG hashes/revisions, frozen-input hashes, every mapping
  selector and every unsupported source path were checked.

[Mouse result](browser-result.json) records Chromium **153.0.8010.12**, **1280×800**, fresh web
4302 proxied to owner API 4310. TinyURL renders 12 tiles / 13 lines; mouse Fit/line guide work.
The mouse project menu opens the retained named v1, showing 21 tiles / 25 lines; Options shows
both PostgreSQL engines, self-hosted private originals and the external local edge with resizing
disabled. Export opens/closes. Zero page/console errors; complete saved designs/history and
listing are unchanged by the walkthrough. `studio-*.png` retain these checks. Original/final
clean PNGs and representative standard UI/engine/provider screenshots were visually inspected;
the four identical clean exports are supported by their exact matching hashes.

The [diagram index](../../diagrams/index.md) retains all five immutable mouse exports with exact
downloaded capture JSON, saved editable source, API/blueprint responses, source-linked manifests,
standard studio screenshots and relevant operation requests/responses. Source schema stays 2,
blueprint is 3, strict readiness stays ineligible with availability/verification none. The fresh
renderer started from clean tracked `a98bf70`; every audited renderer/spec/lock file hash remains
unchanged. The later Biome change only excludes frozen artifact JSON from formatting.

`source-audit.json` proves owner revision 1→2 changes only the two engines plus revision, the v1
copy's exact derivation and two local batches, and full TinyURL/Marketplace preservation. Raw
before/after owner responses remain in `diagrams/`. The E2E database returns to its original
single default project ([listing](e2e-projects-final.txt.gz)). No scratch project was created;
the named v1 copy is the retained deliverable. [Final audit](final-audit.json) records post-check
source/port/cleanup status. Only the unit's fresh web4302 listener was stopped; owner4300/4310
remain. No settings path was created, no owner process restarted, no paid/live chat used,
`.jeeves-feedback/` and all original feedback images remain untouched.

`image-manifests/*.json.gz` retain exact registry inspections for selected image tag/digest
references. `image-availability.json.gz`, `npm-availability.json.gz` and FFmpeg package/changelog/
source-descriptor records support pins/dates/availability. These are read-only metadata checks;
the FFmpeg package bytes were downloaded and hash-checked but not installed or committed.
The package's transitive OS closure remains a named FP03 build detail. No adapter startup or
compatibility result is inferred from publication/availability.

Compressed `.mjs`/`.mts`/`.py` files retain as-run capture/edit/copy/audit/research scripts.
They contain historical mutation commands and are **evidence, not a rerunnable setup tool**.
Early inspector-tab and tsx CJS mistakes and the superseded nginx candidate are described in
the work log; neither mutated the owner beyond the one authorized database batch. `.gz` records
are lossless; no videos, container data, package archives, dependency directories or secrets
are retained. `artifact-hashes.json` indexes the final committed evidence files excluding itself.

Observed host tools: Linux x86_64, Docker client/server **29.9.1**, Compose **5.6.0**;
`vm.max_map_count=1048576`, unchanged. This is the check environment, not a promise that the
future field runtime works on all hosts or platforms. Full provider/fault/performance testing
and heavy template certification remain deferred.
