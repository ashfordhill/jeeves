# v3 backend source composition

**556 post-template backend LOC in a completed backend of 6,740: 6,184 lines (91.75%) are
retained template source.** This compares `app/` at its untouched baseline, `V3-12: v3 generated
output`, with `app/` completed through `V3-16: complete search and browser`. Backend `src/` code
only; the browser and every non-`src` file are outside the measure. It measures where the source
lines came from, not whether the app works (see the [acceptance](../scenarios.md)), how good it is,
or the effort saved.

[Report](source-loc-v2.json) · [reviewed scope](backend-scope.json) and its
[file-by-file review](scope-review.md) · [method](../../../../../docs/field-projects/source-loc.md)
· [custom paths](../custom-paths.md) · [V3-17 evidence](../../../../../docs/plans/youtube-v3/evidence/v3-17/README.md).

| Measure | LOC |
| --- | ---: |
| Generated baseline (71 files) | 6,251 |
| Retained template lines | 6,184 |
| Removed or replaced template lines | 67 |
| Post-template lines | **556** |
| Completed backend (72 files) | 6,740 |
| **Template share** (retained ÷ completed) | **91.75%** |

- **Baseline:** `d94b13a5b759fd4ead1f7ac10bc0ac7197206f30`. `app/` equals `generated/` there, so
  this is `app/` against the exact export. Manifest SHA-256 `1e06c429…7250`.
- **Completed:** `3409af283040330f64cb791ada38b9bad48282d3`, the last commit to change `app/`;
  `app/` is unchanged at the V3-17 commit.
- **Scope:** JSON-content SHA-256 `507a225b…0084`, unchanged since V3-12.
- **Method:** `source-loc-v2`, with parser `rolldown@1.2.15`.
- **CLI stdout:** SHA-256 `5951ed4c946c0c5495f203686b3b4e7be62a98c39917b45e5be9cb7b2c3e6a6e`
  ([raw gzip](../../../../../docs/plans/youtube-v3/evidence/v3-17/source-loc-v2-cli.json.gz)).
  Biome reformatted only the committed report's whitespace; parsed, the two are equal.

```sh
pnpm --silent --filter @jeeves/generator benchmark:source \
  field-projects/youtube/v3/app \
  d94b13a5b759fd4ead1f7ac10bc0ac7197206f30 \
  3409af283040330f64cb791ada38b9bad48282d3 \
  field-projects/youtube/v3/notes/benchmarks/backend-scope.json
```

## Where the 556 lines are

All of them are in `src/modules` (the hooks, the two stub bodies and the shared contract), plus
one line in each of two scaffold files.

| File | Post-template | Replaced | Unit |
| --- | ---: | ---: | --- |
| `src/modules/video-contract.ts` (new) | 222 | 0 | V3-13 to V3-15 |
| `video-lifecycle/…-lifecycle-writer.hooks.ts` | 73 | 16 | V3-13, V3-14 |
| `upload-api/…-multipart-uploads.hooks.ts` | 56 | 7 | V3-13 |
| `transcoder/…-segmenter-and-encoder.hooks.ts` | 44 | 10 | V3-14 |
| `watch-api/watch-api-view-publisher.ts` (stub body) | 43 | 1 | V3-15 |
| `search-indexer/…-index-writer.hooks.ts` | 30 | 7 | V3-16 |
| `search-api/…-video-search.hooks.ts` | 28 | 3 | V3-16 |
| `watch-api/…-video-details-cache.hooks.ts` | 20 | 12 | V3-15 |
| `watch-api/watch-api-view-count-reader.ts` (stub body) | 20 | 1 | V3-15 |
| `view-counter/…-receipt-and-increment.hooks.ts` | 13 | 6 | V3-15 |
| `account-api/…-favorite-videos.hooks.ts` | 5 | 2 | V3-15 |
| `src/modules/dependencies.ts` (scaffold edit, gap 6) | 1 | 1 | V3-15 |
| `src/runtime/module-clients.ts` (scaffold edit, gap 6) | 1 | 1 | V3-15 |

**By directory:**

| Directory | Files | LOC | Retained | Post-template |
| --- | ---: | ---: | ---: | ---: |
| `src/runtime` | 47 | 5,044 | 5,043 | 1 |
| `src/processes` | 8 | 764 | 764 | 0 |
| `src/modules` | 15 | 805 | 250 | 555 |
| `src/features` | 2 | 127 | 127 | 0 |

## What is excluded

| Reason | Files | Contents |
| --- | ---: | --- |
| `ui-source` | 6 | `browser/` (v2's browser on v3's routes, plus `favorites.ts`) |
| `configuration-or-build` | 4 | the four pure-data binding files in `src/features` |
| `outside-src` | 47 | `infra/` (the edge, SQL, with `published.videos`), `scripts/` (with the account script and the browser build), `public/`, `test/` (19 tests), `compose.yaml`, `package.json` and the rest |

`custom-paths.md` lists every non-counted change too: the product SQL, the browser, the account
script and the four gap-8 scaffold edits.

## Reading it

- **The mechanisms came from the templates.** Upload, lifecycle, HLS encoding, cache, counter,
  favorites, search, delivery, sign-in and the processes are all generated. Only two scaffold
  lines changed (gap 6).
- **The product policy is post-template work, as the method requires.** v1/v2's codecs, keys,
  events, the ready check, the search preset and the creator role are 556 lines in the hooks and
  stub bodies the export left for them.
- **Comparison with earlier versions.** v1's completed backend was 5.53% template, and v2's
  historical 100% included product code before its baseline. v3 is the first version measured
  from a generic baseline, with its product code written after it.
- **Lines aren't equal work.** A line of a hook is not a line of runtime.
