# Backend template versus post-template source lines

Use **source-loc-v2** for each field version, comparing its actual untouched generated commit
with its completed application commit. This is the owner's requested source-composition metric;
behavior checks and reliability evidence remain separate.

**Baseline eligibility:** first generate reusable mechanisms and reusable domain features from
the diagram, then freeze/count that output. Product-specific behavior (for example YouTube's
creator policy, public schema, API adapters and application recipe) must be implemented after
that baseline and counted as application work. Putting it in a product-specific template before
export does not qualify it as reusable generated credit. Video processing itself can qualify.
The owner clarified this boundary after v2; the counting exclusions below remain unchanged.

**Measure backend code only until Jeeves has a UI builder and the owner explicitly expands the
benchmark.** Exclude frontend/UI code from both the template and post-template totals, wherever
it lives, including UI packages with their own `src/`. Browser API clients, UI state, pages,
components and presentation code stay outside this measure.

| Measure | Meaning |
| --- | --- |
| Generated baseline LOC | Eligible lines in the original template output |
| Retained template LOC | Original lines still matching in the completed app, within the same file |
| Post-template LOC | New or replaced lines in the completed app, including edits to generated files |
| Removed/replaced template LOC | Original lines no longer retained; excluded from the final total |
| Template share | Retained template LOC ÷ completed LOC × 100 |

Count backend JS/TS production files inside `src/` directories. Exclude tests/specs, fixtures/mocks,
configuration/settings/environment files, declarations, dependencies/vendor output and build output.
Docker/Compose, scripts, manifests, SQL migrations, docs and other folders are outside this metric.
Each run requires a reviewed scope file listing app-relative `backendPaths` and `uiPaths`
(directories or individual files). UI exclusions take precedence, including within a backend
directory. Optional `configurationPaths` excludes reviewed dedicated configuration files whose
names do not match the existing config/settings/env convention; it uses the same
`configuration-or-build` reason. Omitting it preserves historical scope/report identities. Eligible source outside both lists stops the report for classification, so new frontend
or backend folders cannot silently alter the percentage. Prefer dedicated backend directories;
review shared folders and explicitly exclude their UI files. The report embeds the scope and its
JSON-content hash. Commit the scope alongside each version's report.

In YouTube v1, [the scope](../../field-projects/youtube/v1/notes/benchmarks/backend-scope.json)
lists seven backend directories and excludes `browser/`. Its `src/clients/` contains backend
service adapters and counts; directory names alone do not determine whether code is UI. Runtime
logic that reads settings still counts; dedicated config/env files do not. The report lists every
included file and every exclusion with its reason.

Count physical nonblank lines after removing parsed comments; strings, regexes and template
literals keep their content. Imports, braces, types, boilerplate and throwing stubs count as code.
Matching ignores indentation/trailing whitespace but preserves other content and line wrapping.
The longest ordered matching sequence within each same-named file counts as retained template
lines. Other final lines count as post-template; new paths are wholly post-template. Renames and
semantic equivalence are not inferred. This is a mechanical line comparison, not exact authorship:
formatting, moving code and coincidentally identical lines can affect it. Keep formatting and scope
consistent across versions; version the rules if they change.

## YouTube v1

| Backend source composition | LOC | Share of final backend src LOC |
| --- | ---: | ---: |
| Retained template lines | 159 | 5.53% |
| Post-template lines | 2,715 | 94.47% |
| Completed backend production src | 2,874 | 100% |

The original baseline had **275 LOC** in scope; **116** were removed or replaced. The comparison
covers 45 file paths. [Per-file report](../../field-projects/youtube/v1/notes/benchmarks/source-loc-v2.json)
pins the two commits and verifies baseline source hashes against the original generated manifest.
The low v1 source share reflects that much of the generated foundation was infrastructure/config
and the business behavior was completed afterward. It is not a reliability or effort-saving score.

The [original method-v1 report](../../field-projects/youtube/v1/notes/benchmarks/source-loc-v1.json)
is preserved. It already excluded v1's UI because `browser/` was outside `src/`; reviewing all 45
counted files confirmed they are backend code. Method v2 adds explicit classification and leaves
these totals unchanged. This is a benchmark-method revision, not a YouTube v2 application.

## YouTube v2

The [historical v2 comparison](../../field-projects/youtube/v2/notes/benchmarks/README.md) retains
**5,456 / 5,456 backend LOC (100%)**, with **0 post-template** and **0 removed/replaced** lines in
56 included files. It compares untouched `695addeb3ac4a77c3a6fbfd2f68d901fced3619f` with completed
`08699b2dc631709bff12fb25914e0d2681b6b535`, using the pre-baseline reviewed scope and unchanged
parser/LCS/method. All UI stays excluded. Reused custom browser and build/runtime/edge integration
are separately attributed; three included shared SQL constructors are generator-used rather than
runtime-imported. The report exceeds the strict 5.53% criterion; 60% was an eventual target.
Independent runtime evidence and remaining criteria are in the [owner review pack](../../field-projects/youtube/v2/notes/review-pack.md).
Its baseline included YouTube product implementation, so the 100% result does not satisfy the
intended reusable-generation baseline. Preserve it as a historical file-retention result.
The [generic replay](../plans/reliable-foundations/youtube-v2-generic-baseline.md) exports the
same exact saved design after removing product implementations. It counts the new output with
these same exclusions and reports overlap with existing v2 separately; it does not invent a
new chronological application-completion measurement.

## YouTube v3

v3 keeps the untouched export in `field-projects/youtube/v3/generated/` and completes a copy in
`app/` (contract D8). The baseline is `app/` at the `V3-12: v3 generated output` commit, which
equals `generated/`. The [reviewed scope](../../field-projects/youtube/v3/notes/benchmarks/backend-scope.json)
and [its file-by-file review](../../field-projects/youtube/v3/notes/benchmarks/scope-review.md)
count 71 backend `src/` files, 6,251 LOC, at the baseline. The rules are unchanged. V3-17
reports the comparison with the completed commit.

## Run for the next version

From repository root:

```sh
pnpm --silent --filter @jeeves/generator benchmark:source \
  field-projects/youtube/v1/app \
  02ac280da62616e9c7aad7f88457dcb72084cb25 \
  f0adefb5d7feb961bf9eb320a72ccc99184f8681 \
  field-projects/youtube/v1/notes/benchmarks/backend-scope.json
```

The root shortcut is `pnpm benchmark:source <app-path> <generated-commit> <completed-commit> <scope.json>`.
Both paths are repository-relative. The command reads application code from Git objects and the
scope from the specified JSON file, then writes JSON to stdout. It does not count dirty source,
alter an application or need Docker/network access. Save each report as a new versioned artifact;
never replace v1's report with a later comparison. Reused custom code remains application work;
only extracting a reusable mechanism and emitting it before that version's untouched baseline
can make it eligible for generated credit. Product-specific code remains application work even
when a product recipe emits it.

The parser is pinned to the already-used Rolldown 1.2.15; comment handling and edit accounting have
small offline checks. Later languages/source layouts need an explicit method revision or separately
labelled scope so their percentages are not silently compared with this one.
