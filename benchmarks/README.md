# Frozen backend behavior ledgers

P59 supplies requirements and evidence accounting for three bounded Jeeves adaptations. It supplies
no application implementation, runtime, provider verification or measured coverage. Each v1 ledger
has 20 immutable case identities, 100 weighted points and a **66-point candidate template target**.
There are no recorded benchmark passes in this directory.

| Profile | Manifest | Mandatory observations | Detached canonical pins |
| --- | --- | --- | --- |
| Discourse-core | [v1 manifest](discourse-core/v1/manifest.json) | [66 observations](discourse-core/v1/requirements.json) | [integrity](discourse-core/v1/integrity.json) |
| Vendure-core | [v1 manifest](vendure-core/v1/manifest.json) | [63 observations](vendure-core/v1/requirements.json) | [integrity](vendure-core/v1/integrity.json) |
| Zammad-core | [v1 manifest](zammad-core/v1/manifest.json) | [66 observations](zammad-core/v1/requirements.json) | [integrity](zammad-core/v1/integrity.json) |

The [original scope](../docs/plans/backend-benchmarks/benchmarks.md) remains the human-readable
specification. Its descriptions, weights and G/H targets are transcribed verbatim. G/H labels are
planning intent. Actual origin is recorded independently as shared template, domain template,
product recipe, upstream integration or project hook. Weight measures evaluation importance, not
engineering effort. Workload profiles are frozen **unmeasured targets**, including data cardinality,
offered rates, latency limits, reference-host guidance and measurement/recovery conditions.

The manifest's `sourceMap.path` reserves a sibling `source-map.json` for its named P60a/P60b/P60c
assignment. P60a supplies the [Discourse source map](discourse-core/v1/source-map.json) and
P60b supplies the [Vendure source map](vendure-core/v1/source-map.json), and
P60c supplies the [Zammad source map](zammad-core/v1/source-map.json), with
[inspected reference reviews and the complete 60-row gate](../docs/reference/backend-benchmarks.md#combined-p60-reference-review).
P60 is complete as reference work. It adds provenance sidecars without editing
frozen v1 requirements or conferring implementation evidence. Likewise `fixtureVersion: v1` identifies
the application fixtures assigned to P61b–d, not application contracts supplied by P59.
[P61a protocol v1](protocol/v1/README.md) now supplies shared error/auth/paging/idempotency contracts,
strict fixture validation and namespaced acceptance identities, proved by an isolated synthetic
pack. Application fixtures and the combined P61 gate remain incomplete; all three applications
are absent/not run. No runner alias is registered until its actual tests exist.

## Loading and evaluating

The pure API is exported from [@jeeves/spec](../packages/spec/src/benchmark.ts):

1. `parseBenchmarkLedger(manifest, requirements, integrity)` strictly validates both documents,
   all observation/category references, critical flags, scoped identities, totals and acyclic
   dependencies, then checks the detached SHA-256 pins.
2. `evaluateBenchmark(ledger, currentInputs, evidence)` revalidates the pins and evaluates records
   against independently supplied current inputs. Omitted evidence gives zero actual points.
3. `benchmarkSummaryJson(summary)` and `benchmarkSummaryText(summary)` provide deterministic
   summaries with every row, missing critical observations, failed points and supplied incomplete
   paths retained. No date or random identity is added by these functions.

Inputs bind profile/version, both ledger hashes, design, dependency lock, contracts, fixtures and
their version/seed, test pack, template/runtime/archive hashes, generated source, database version
and image digest, plus environment profile/fingerprint. All digests are lowercase SHA-256 hex.
An empty artifact map explicitly means no such artifacts; a template-origin result additionally
requires its exact `implementationReference` in `templateHashes`. A changed input makes a recorded
declaration/run stale. Other applications' records are ignored as foreign inputs; relabeled foreign
case or observation identities are rejected. Current inputs must match the selected ledger pins.

Evidence keeps fingerprint-bound declarations separate from run records. Design references earn
designed points only. `supported` and `generated` declarations identify an advertised path, exact
implementation reference and origin; `custom-required` and `unsupported` paths earn no verified
points. Synthetic `implemented` declarations are rejected. Runs retain command, start/finish,
generation mode, origin, project-code use, provider mode and raw per-observation report locators
and hashes. A passed observation requires a report; skipped, not run, blocked, unavailable and
failed are distinct outcomes. An unavailable hook never becomes functional completion.

Every mandatory observation must pass for a row to earn its entire weight. All declared capability
dependencies must also be verified. Partial rows earn zero; not-applicable is permitted only for
a material-failure category with an explicit reason, never alongside an applicable observation and
never as a scored observation. V03's pure arithmetic has no persistence/retry boundary; its exact
arithmetic and overflow rejection remain mandatory. Transaction/race coverage belongs to V04–V06.

Template points require fresh generation with no project implementation code for that case.
Recipes, integrated upstream engines and custom hooks earn separately reported completion points.
Provider modes distinguish ordinary application evidence, the V08 local reference payment protocol
and V14/V19 concrete adapters; reference-provider reports cannot satisfy the latter. Concrete-adapter
verification may use an independent pinned provider contract fixture; it does not imply production
provider approval or require live credentials merely to evaluate a record.

No foundation verdict is possible below 60 verified shared/domain-template points, with missing
critical coverage, or with any incomplete advertised path. An observed failure on any supplied
path yields a failed verdict, including a critical veto at an otherwise high score. Unimplemented
H targets remain visible without blocking an otherwise verified foundation; a complete application
requires all 100 points. Missing and failed points are separate, so completion + missing + failed
always totals 100. Designed points overlap completion and never increase it.

Repeated matching attempts retain conservative precedence: failed, unavailable, blocked, not run,
skipped, passed. A later pass cannot erase a matching failure. A current interrupted/ineligible
attempt blocks borrowed earlier passes and preserves observed failures. Keep raw history; a fix
must change the relevant source/input fingerprint before that prior failure can become stale.
Duplicate run IDs or duplicate case/observation identities within a run are rejected; the same
observation across distinct attempts is intentional history. Aggregation is independent of input
record order.

This API accounts for supplied records; it does not run tests, inspect report files, attest their
truth or infer implementation availability. Later runners must supply independently observed,
protected acceptance evidence and preserve raw reports. The adversarial records in the evaluator's
unit tests are synthetic test inputs only and are never published as benchmark results.

## Preserving versions

Canonical JSON recursively sorts object keys, preserves array order and uses compact UTF-8 JSON
without a trailing newline. Hashes cover the entire parsed manifest and requirements independently;
file whitespace has no significance. Detached pins and test constants freeze these v1 identities.
Strict parsing rejects unknown properties instead of silently dropping a new requirement.

Keep the old directory/pins unchanged. A changed requirement, observation, weight, dependency or
scope creates `v2` (then `v3`, etc.), new pins and a reviewed diff.
`diffBenchmarkVersions(before, after)` returns deterministic path/value changes and rejects changed
data without a newer version. New evidence must bind the new hashes; historical passes confer no
credit on the revised requirements. Adding source maps or future protocol fixtures is independent
of changing the frozen behavior ledger.

Focused verification uses the existing work runner, with no services or UI suite:

```bash
pnpm work run unit packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
```
