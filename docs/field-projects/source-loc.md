# Template versus post-template source lines

Use **source-loc-v1** for each field version, comparing its actual untouched generated commit
with its completed application commit. This is the owner's requested source-composition metric;
behavior checks and reliability evidence remain separate.

| Measure | Meaning |
| --- | --- |
| Generated baseline LOC | Eligible lines in the original template output |
| Retained template LOC | Original lines still matching in the completed app, within the same file |
| Post-template LOC | New or replaced lines in the completed app, including edits to generated files |
| Removed/replaced template LOC | Original lines no longer retained; excluded from the final total |
| Template share | Retained template LOC ÷ completed LOC × 100 |

Count JS/TS production files inside `src/` directories. Exclude tests/specs, fixtures/mocks,
configuration/settings/environment files, declarations, dependencies/vendor output and build output.
Docker/Compose, scripts, manifests, SQL migrations, docs and other folders are outside this metric.
In YouTube v1, `browser/` is outside `src/`, so its UI code is explicitly excluded too. Runtime
logic that reads settings still counts; dedicated config/env files do not. The JSON report lists
every included file and every exclusion with its reason.

Count physical nonblank lines after removing parsed comments; strings, regexes and template
literals keep their content. Imports, braces, types, boilerplate and throwing stubs count as code.
Matching ignores indentation/trailing whitespace but preserves other content and line wrapping.
The longest ordered matching sequence within each same-named file counts as retained template
lines. Other final lines count as post-template; new paths are wholly post-template. Renames and
semantic equivalence are not inferred. This is a mechanical line comparison, not exact authorship:
formatting, moving code and coincidentally identical lines can affect it. Keep formatting and scope
consistent across versions; version the rules if they change.

## YouTube v1

| Source composition | LOC | Share of final src LOC |
| --- | ---: | ---: |
| Retained template lines | 159 | 5.53% |
| Post-template lines | 2,715 | 94.47% |
| Completed production src | 2,874 | 100% |

The original baseline had **275 LOC** in scope; **116** were removed or replaced. The comparison
covers 45 file paths. [Per-file report](../../field-projects/youtube/v1/notes/benchmarks/source-loc-v1.json)
pins the two commits and verifies baseline source hashes against the original generated manifest.
The low v1 source share reflects that much of the generated foundation was infrastructure/config
and the business behavior was completed afterward. It is not a reliability or effort-saving score.

## Run for the next version

From repository root:

```sh
pnpm --silent --filter @jeeves/generator benchmark:source \
  field-projects/youtube/v1/app \
  02ac280da62616e9c7aad7f88457dcb72084cb25 \
  f0adefb5d7feb961bf9eb320a72ccc99184f8681
```

The equivalent root shortcut is `pnpm benchmark:source <app-path> <generated-commit> <completed-commit>`.
The command reads Git objects and writes JSON to stdout; it does not inspect a dirty working tree,
alter an application or need Docker/network access. Save each report as a new versioned artifact;
never replace v1's report with a later comparison. Reused custom code remains post-template until
an actual versioned template emits it in that version's untouched baseline.

The parser is pinned to the already-used Rolldown 1.2.15; comment handling and edit accounting have
small offline checks. Later languages/source layouts need an explicit method revision or separately
labelled scope so their percentages are not silently compared with this one.
