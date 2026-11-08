# YouTube field projects: learn from v1, improve generation in v2

Owner direction, 2026-11-07. This is the active plan for generation work in the Jeeves repository.
It supersedes the separate-repository, TinyURL-first sequence and broad template certification
before the first field project. Build a working YouTube v1, review it with a fresh agent, improve
Jeeves, then generate a fresh v2 and possibly v3. Marketplace and TinyURL follow when the owner is
satisfied. No generator, field application or benchmark result exists yet.

## Scope and decisions

- Start v1 from the existing YouTube diagram. Snapshot the actual saved design, blueprint and
  view before changes; do not require a broad diagram rewrite or all of NC07–NC11 first.
- Keep generator, templates, field-project source and learning records in this repository.
  Exported applications must also build and run outside the Jeeves checkout.
- Deliver uploads, real transcoding, playback, search and basic view counts in stages.
- Run locally in Docker without a cloud account. Upload requires a signed-in creator;
  successful processing automatically makes the video public.
- Generate from Jeeves; commit the actual untouched output; plan and implement the missing
  application-specific work; then review a working v1 before starting v2.
- Defer heavy generated-template certification while the designs iterate. Keep lightweight
  working checks and accurate experimental labels.

Two earlier questions remain unanswered: a minimal upload/search/watch interface versus APIs
only, and PostgreSQL versus the drawn MySQL. A minimal interface is proposed for demonstration.
Preserve the drawn database unless the owner chooses a change; do not silently switch it.
Record local replacements for Cloudflare storage/delivery and exact adapter versions before
generation. These choices do not prevent recording this process or taking the baseline snapshot.

## The experiment

1. **Freeze the starting point.** Record the saved diagram/revision, available blueprint,
   generator/template versions, explicit local bindings and a small feature checklist.
   Identify unsupported parts without completing them on the generator's behalf.
2. **Generate and commit the baseline.** A real deterministic generator emits supported
   scaffolding/code, configuration and explicit extension points. Record inputs, file hashes
   and missing behavior. Commit before custom implementation. An agent writing application
   files directly does not count as a generator run.
3. **Plan from the actual gaps.** Map every unmet feature to concrete code changes, a diagram
   omission or a template defect. Separate estimates from observed effort. Use the generated
   commit as the immutable comparison anchor.
4. **Complete the field application.** Work in small units. Distinguish custom changes,
   repairs to generated files and reused custom code. Show the complete flow working; record
   limitations, failed approaches and the effort required.
5. **Review and extract lessons.** The owner reviews v1 with a fresh agent. Propose diagram,
   operation, template, tile and assistant improvements with evidence and a reason to accept
   or reject each one.
6. **Improve Jeeves and generate fresh v2.** Capture untouched output in a new directory and
   commit. Repeat completion and compare the same features. Record new features separately;
   do not improve the score by changing the denominator.

The owner's review after a working v1 is an intentional checkpoint. Earlier baseline commits
and implementation units do not require stopping or repeated permission when execution is
authorized.

## Proposed repository boundaries and provenance

| Location | Responsibility |
| --- | --- |
| packages/generator/ | Deterministic assembly, finite input mapping, manifest and export. |
| packages/templates/ | Versioned source templates and supported configuration; initially experimental. |
| apps/server/ and apps/web/ | Existing Jeeves API and mouse-operated generation/export flow. |
| field-projects/youtube/v1/inputs/ | Frozen design/blueprint, local bindings, screenshot and input hashes. |
| field-projects/youtube/v1/app/ | Actual generated application, then completion through explicit custom commits. |
| field-projects/youtube/v1/notes/ | Baseline commit, implementation plan, work log, smoke results and retrospective. |
| field-projects/youtube/v2/ | A fresh later experiment with its own baseline and comparison. |
| docs/field-projects/ | Cross-version benchmark definitions and reusable-improvement decision log. |

These packages/directories are planned. Keep field apps outside the studio's apps/* workspace
discovery. Exported lockfiles/imports/build files must stand alone, without checkout paths or
unresolved workspace dependencies. Do not commit videos, caches, dependencies, container data or
secrets; use a reproducible small media fixture for checks.

Record the generated commit hash in the subsequent implementation-plan commit, avoiding
self-referential manifests. The final v1 commit and review identify the full custom-work range.
Editing a generated file is recorded repair/integration cost, not untouched-generated credit.
Prefer custom files and extension points, but allow necessary repairs during the experiment.
Never silently regenerate over edits. Preserve v1 while creating v2.

## Useful partial output and truthful claims

The current YouTube study has design intent and custom modules, not complete executable
contracts. V1 can generate service/worker shells, transport setup, configuration, resource
wiring, containers and behavior actually supported by its templates. Missing video/search/
counting behavior remains visible work for the custom phase.

Use an explicit finite mapping from supported definitions/settings to templates. Labels and
module prose are not algorithms. Do not build a universal workflow/entity language to finish
v1. Report unsupported meaningful settings instead of discarding them. Placeholders and fake
transcode results get no functional credit; unfinished entry points must fail clearly.

Keep the existing strict compatibility report and generationEligible meaning intact. Plan a
separate, clearly labeled experimental scaffold/export path that permits partial output and
named gaps, without declaring contract completeness or verified runtime evidence. Malformed
structure, unsafe output paths and contradictory bindings still refuse; unknown business
behavior can become an explicit extension task without blocking all scaffolding.

Record all generation inputs, generator/template identities, dependency pins, local bindings
and output hashes. Do not use TinyURL's composition identity or trusted-runtime fixture receipts
to certify video scaffolding. Same inputs/versions should emit the same source files; runtime
secrets and mutable data are provisioned separately.

Start from the current diagram and make only changes needed for a truthful, working v1. Do not
deliberately reproduce a confirmed defect just to match the drawing. Record each necessary
correction with before/after references and its classification: diagram change, template fix
or custom application decision. Keep actual ownership/dependencies consistent with the diagram;
track implementation details the diagram cannot yet express. Preserve the original owner
project and use a separate v1 copy or an explicit change preview.

## Validation now, certification later

For the generated baseline, check generation completes, expected files exist, a repeated run is
deterministic and the output builds. Record unfinished features honestly; a scaffold need not
already pass the completed application's walkthrough.

For finished v1, use a small repeatable smoke walkthrough: start the exported Docker project,
sign in, upload real bytes, observe processing, play actual encoded output, find the published
video and observe the agreed basic count behavior. Record fixture, commands, environment,
outcomes and known failures. A discovered defect may justify a targeted check.

Defer exhaustive template unit/contract suites, provider matrices, systematic crash/concurrency/
fault campaigns, performance/soak tests and a certification runner until relevant templates
stabilize. Existing Jeeves regression checks still apply to Jeeves changes; this deferral
concerns generated-template certification. Keep real-container field checks separate from
the studio's network-free PGlite unit tests.

Artifacts remain experimental and, where supported by results, smoke-checked. A working demo,
review or rising generated share does not prove template reliability. Keep the eventual heavy
verification work as an explicit backlog with stabilization triggers.

## Benchmark the work saved

Freeze observable feature scenarios before v1 completion. Keep their fixture, success criteria
and scope for later comparisons. Record changes in models, prompts, prior-code access, hardware
and dependencies rather than attributing every improvement to generation.

| Measure | Record |
| --- | --- |
| Behaviors supplied by generation | Each scenario works in untouched output, is partly supplied, or is custom. Empty scaffolds receive no functional credit. |
| Custom completion effort | Observed work per feature, human interventions, elapsed/active time where available, agent turns and reported tokens. Unknowns stay unknown. |
| Repairs and integration | Generated-code/configuration fixes, failed builds/runs, wiring corrections and rework. |
| Final source provenance | Untouched generated, modified generated, newly custom, reused custom and external dependencies. |
| Investment in Jeeves | Generator/template/diagram improvement effort separately from field-app completion; do not hide this cost. |
| Diagram usefulness | Missing concepts, ambiguous relationships, source/code disagreements and difficulties tracing or editing the design. |
| Working result | The same smoke scenarios, observed defects and limitations for each finished version. |

Behavior coverage and remaining effort are the primary comparison. Source-line counts are only
secondary, with explicit counting rules excluding dependencies, lockfiles and empty scaffolding.
Do not claim a generated percentage before measuring baseline and completed output. Reusing v1
custom code is useful but stays reused custom work unless an actual versioned template now emits
it. Copying a completed application into v2 does not demonstrate better generation.

## Improvement backlog: hypotheses to investigate

Each proposal needs an ID, observed problem, diagram/code references, another plausible use,
candidate abstraction, expected benefit, decision/rationale, implementation commit and later
comparison result. The following are hypotheses, not validated field-project findings.

| Candidate | Likely representation | Other potential use |
| --- | --- | --- |
| Signed/resumable uploads | Capability/module and template | Images, documents, bulk imports. |
| Durable jobs, retry and results | Message/job contract and worker template | Exports, processing tasks, background builds. |
| Processing status and stale results | Owner lifecycle pattern and operation view | Imports, reports, asynchronous provisioning. |
| Committed publication to search | Projection/event template and relationship | Listings, catalogs, content sites. |
| API read/publish responsibilities | Attached operation views/ports with one API identity | APIs that read state and emit events. |
| Event aggregation/counts | Consumer module with an explicit counting policy | Basic activity metrics and analytics. |
| Encoding/packaging/thumbnails | Video-specific template until reuse justifies more | Other video products. |

A new tile should introduce a useful architectural concept a developer can understand
independently. Many discoveries belong in operations, modules, settings or templates. Avoid
one tile per handler or treating YouTube-specific policy as a universal primitive. The owner's
Read counts/Publish view sketch remains a tracked presentation candidate.

## Feed the findings back into Jeeves

Retain raw run records and decisions, then curate small approved lessons into the design
playbook, retrievable pattern records and relevant chat evaluation cases. Record applicability,
what failed, the correction, unsupported variants and the source project/version. Preserve
rejected ideas and negative results in the research trail.

Do not add every log to the chat prompt. Use concise guidance through actual context/tools,
with applicability checks and evaluations against observed failures and other architectures.
Documentation alone does not update runtime guidance. Live/paid evaluations remain a separately
chosen activity; no assistant-quality improvement is claimed before measurement.

## Execution units after planning

| Unit | Deliverable and exit |
| --- | --- |
| FP01: baseline and mappings | Snapshot saved YouTube, settle open UI/database/local adapter choices, freeze smoke scenarios and supported-template/gap mappings. Keep necessary changes minimal and recorded. |
| FP02: experimental generator | Finite assembly, provenance, partial-output reporting, safe file ownership and deterministic export; strict readiness semantics preserved. |
| FP03: first templates and Jeeves export | Useful v1 template output plus mouse generation/download; prove independent build. No heavy template certification. |
| FP04: generated v1 checkpoint | Run the real generator and commit untouched output and provenance as its own unit. |
| FP05: custom completion plan | Use the committed output's actual gaps to write the implementation plan, work log and benchmark baseline before custom coding. |
| FP06: upload/process/playback | Complete the custom path and necessary correctness fixes through smaller assigned units, logging provenance, effort and diagram gaps; demonstrate real encoding/playback. |
| FP07: search/counts and usable v1 | Complete agreed core/interface, run lightweight walkthrough and prepare results/limitations for review. |
| FP08: owner review and next iteration | Owner reviews with a fresh agent; choose evidence-backed Jeeves changes and the v2 comparison. Do not automatically start v2 before that review. |

Follow one writer/unit on main, handoff and local-commit rules. Split oversized units further.
The review trail must connect diagram → generated baseline → custom plan/diff → working result
→ lesson → Jeeves improvement → fresh v2.
