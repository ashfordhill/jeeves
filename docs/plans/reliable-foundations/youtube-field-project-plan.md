# YouTube field projects: learn from v1, improve generation in v2

Owner direction, 2026-11-07. This is the active plan for generation work in the Jeeves repository.
It supersedes the separate-repository, TinyURL-first sequence and broad template certification
before the first field project. Build a working YouTube v1, review it with a fresh agent, improve
Jeeves, then generate a fresh v2 and possibly v3. Marketplace and TinyURL follow when the owner is
satisfied. FP00 implements diagram PNG export; FP02 provides the experimental generator foundation. FP03a now adds 19 real experimental local
template families and a new-directory CLI, with actual standalone build/bounded startup evidence;
business benchmark results remain unmeasured. FP01 freezes the [actual v1 source, images and local mapping](../../../field-projects/youtube/v1/README.md);
FP03b adds guarded Jeeves mouse preview/ZIP download for the exact frozen saved source. FP04
retains the [actual untouched generated baseline](../../../field-projects/youtube/v1/notes/baseline.md),
independently installed and built both in this repository and outside the checkout. Custom planning
is next in FP05; no application scenario is complete.

## Scope and decisions

- Start v1 from the existing YouTube diagram. Snapshot the actual saved design, blueprint and
  view before changes; do not require a broad diagram rewrite or all of NC07–NC11 first.
- Keep generator and templates under `jeeves-generator/`, with field-project source and learning
  records in this repository. Exported applications must also run outside the Jeeves checkout.
- Deliver uploads, real transcoding, playback, search and basic view counts in stages.
- Run locally in Docker without a cloud account. Upload requires a signed-in creator;
  successful processing automatically makes the video public.
- Generate from Jeeves; commit the actual untouched output; plan and implement the missing
  application-specific work; then review a working v1 before starting v2.
- Include a minimal browser interface for creator sign-in, upload, search and playback.
- Use PostgreSQL. The owner approved updating the drawn MySQL selection before v1; retain
  before/after diagram snapshots and record why the binding changed.
- Retain diagram images inside each field version. Capture a new snapshot for every intentional
  diagram change during that version, including changes to its visual presentation.
- Defer heavy generated-template certification while the designs iterate. Keep lightweight
  working checks and accurate experimental labels.

The owner answered the two remaining product questions: minimal interface and PostgreSQL.
PostgreSQL fits the relational metadata/counting requirements and shares Jeeves' existing database
tooling; this is a deliberate v1 choice, not a claim that MySQL cannot support this application.
FP01 records explicit local replacements for Cloudflare storage/delivery and exact adapter
versions in the [frozen v1 inputs](../../../field-projects/youtube/v1/inputs/manifest.json).
Compatibility remains unverified until the actual field build/smoke. Ask again only if a
discovered tradeoff changes the agreed scope, needs a cloud account or introduces a paid service.

## The experiment

1. **Freeze the starting point.** Record the saved diagram/revision, available blueprint,
   clean diagram image, generator/template versions, explicit local bindings and a small feature checklist.
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
| jeeves-generator/ | Generator workspace package: deterministic assembly, finite input mapping, manifest and export. |
| jeeves-generator/templates/ | Versioned source templates and supported configuration; initially experimental. |
| apps/server/ and apps/web/ | Existing Jeeves API and mouse-operated generation/export flow. |
| field-projects/youtube/v1/inputs/ | Exact generation inputs: design/blueprint, local bindings, input hashes and a diagram snapshot reference. |
| field-projects/youtube/v1/diagrams/ | Numbered immutable diagram images, editable source, view metadata and change index. |
| field-projects/youtube/v1/app/ | Actual generated application, then completion through explicit custom commits. |
| field-projects/youtube/v1/notes/ | Baseline commit, implementation plan, work log, smoke results and retrospective. |
| field-projects/youtube/v2/ | A fresh later experiment with its own baseline and comparison. |
| docs/field-projects/ | Cross-version benchmark definitions and reusable-improvement decision log. |

FP01 creates the v1 input/diagram/note directories. FP02 adds the explicit
[`@jeeves/generator` workspace](../../../jeeves-generator/README.md), one frozen local-v1 input
profile, deterministic in-memory bundles, provenance/partial reports and safe write preflight.
FP03a adds the explicit real local registry, standalone package/locks, physical new-directory
export and [bounded independent build/startup evidence](../../../field-projects/youtube/v1/notes/evidence/fp03a/README.md).
FP03b supplies guarded mouse preview/download of the unchanged real bundle; FP04 retains the untouched field baseline.
Add `jeeves-generator` explicitly to pnpm workspace
discovery when implementing its package; put reusable backend code there with a thin Jeeves API
entry point. A separate running generator service is not necessary for the first local export.
Keep field apps outside the studio's apps/* and packages/* workspace discovery.
The exact `field-projects/youtube/v1/app` path is also outside root Biome; its independent
frozen-lockfile install, TypeScript build and applicable field checks are required at handoff.
Exported lockfiles/imports/build files must stand alone, without checkout paths or
unresolved workspace dependencies. Do not commit videos, caches, dependencies, container data or
secrets; use a reproducible small media fixture for checks.

Record the generated commit hash in the subsequent implementation-plan commit, avoiding
self-referential manifests. The final v1 commit and review identify the full custom-work range.
Editing a generated file is recorded repair/integration cost, not untouched-generated credit.
Prefer custom files and extension points, but allow necessary repairs during the experiment.
Never silently regenerate over edits. Preserve v1 while creating v2.

## Diagram images and visual history

FP00 provides the mouse-operated **Export diagram → PNG** action before freezing v1. It uses
the existing board's HTML tile and SVG relationship renderers with a frozen resolved layout;
no layout rerun or alternate diagram drawing is involved. The server's SVG rasterizer remains
for chat attachments. See [usage and capture limits](../../studio.md#diagram-png-export) and
[FP00 evidence](evidence/fp00/README.md). PNG is implemented; vector export remains optional.

The exported full logical view preserves the canvas's current expanded/collapsed owner
projection, explicitly recorded in capture details. Expand roles first when the snapshot should
show individual responsibilities. All projected relationships render even during focus. The
secondary capture-details download records exact PNG/source hashes and resolved layout/view
context. FP01 archives the editable source, blueprint and external renderer Git/tree audit.
Development identity is recorded at server startup and cannot attest later HMR changes.
The 2× light capture refuses missing/failed layout/fonts, stale source and oversize images rather
than silently clipping or shrinking. No version archive service is implied.

Export the full diagram at a readable scale, including offscreen tiles, labels, icons, routes
and arrowheads. Omit editing controls, selection highlights and transient focus filters. Record
owner expansion and other view choices explicitly; never present a filtered view as the complete
architecture. Use a stable light background for comparison. Export must preserve the user's
camera, selection, focus, saved design, revision and Undo history. Wait for the matching saved
revision, fonts and settled layout; stale or failed captures must produce a clear error.

For each version, use numbered snapshot directories such as:

```text
field-projects/youtube/v1/diagrams/
  index.md
  001-owner-original/
    diagram.png
    design.json
    blueprint.json
    snapshot.json
  002-postgresql-baseline/
    diagram.png
    design.json
    blueprint.json
    snapshot.json
```

Each snapshot records project/revision, content hashes, blueprint schema, Jeeves renderer commit,
capture settings and reason. Retain the resolved layout/view information needed to explain the
image: layout is not persisted in the current design and stability hints can affect placement.
Record a dirty renderer tree explicitly or capture from a clean commit. Link the snapshot's
containing Git commit from a later index/work-log entry; avoid self-referential commit hashes.
An image is a review artifact; saved source and blueprint remain the machine-readable inputs.

Archive the current owner diagram first, then the approved PostgreSQL change, then the exact
generation baseline. A baseline can reference the preceding snapshot when its source and view
are identical. During v1, every intentional saved architecture edit or adopted layout/rendering
change gets a new snapshot before the corresponding unit is handed off; multiple edits in a
unit retain their individual change snapshots. Do not overwrite earlier files. Incidental pan,
zoom and selection do not create architecture versions. Label intermediate snapshots explicitly
when code has not caught up, and reconcile diagram and implementation before the final v1 review.

When changing studio controls, layout or diagram presentation, also retain a standard-size
`studio.png` screenshot alongside the clean diagram image, with viewport and interaction state
recorded. This captures UI/readability differences that a clean diagram alone cannot show. Use
the same capture settings across versions, explaining unavoidable differences. If the source
is unchanged but the renderer changes, retain both renders with their renderer identities.

Include the referenced diagram snapshot in the exported field-project bundle and record its
link to the generator input hashes. Keep capture timestamps and image provenance separate from
deterministic generated-source hashing; freeze image bytes as explicit inputs when bundling
them. Do not claim pixel-identical renders across different fonts, browsers or renderer versions.

FP00's checks cover readable actual mouse PNG downloads for YouTube and TinyURL, including
pan/zoom/focus, owner projection and saved-state/view preservation. Its bounded regression checks
cover route ink, stale source, font failure and cancellation. FP01 establishes the actual
archived source and PostgreSQL baseline in five numbered snapshots, ending with an explicitly
local v1 copy. This is bounded export and provenance work, not a new
image-certification suite.

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
snapshot before the approved PostgreSQL update. Use a clearly named v1 project copy for subsequent
experiment changes; retain its source-project identity and before/after snapshot links.

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
| Visual evolution | Numbered source-linked diagram images and UI screenshots, with the reason and outcome of each architecture or presentation change. |
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
| FP00: diagram image export (implemented) | Mouse PNG export of the real full canvas; readable labels/routes, stable capture and no saved-state or view mutation. Document usage and the snapshot convention. |
| FP01: baseline and mappings (implemented) | Five immutable source/image snapshots retain original owner, approved PostgreSQL and the named local v1 copy. Exact local pins, canonical finite mapping/gaps, S01–S08 scenarios and decision ledger are frozen; no templates/runtime are supplied by this freeze. |
| FP02: experimental generator (implemented) | Frozen local-v1 validation, deterministic in-memory assembly, provenance/setting/gap reports and conservative file-write preflight. No application templates, physical writer or archive/browser export; strict readiness unchanged. |
| FP03a: first real templates (implemented) | Versioned local families emit useful standalone shells/clients/resources/containers and exact dependency/OS locks. Real scratch export builds and bounded provider/helper probes pass; business scenarios remain unrun. |
| FP03b: Jeeves export (implemented) | Guarded mouse preview/download of the same in-memory bundle as a bounded deterministic ZIP, including frozen input/image/template provenance. Trusted profile/template assets ship in Jeeves Docker; only exact saved-source matches export. No strict eligibility credit or heavy template certification. |
| FP04: generated v1 checkpoint (implemented) | Actual Jeeves mouse ZIP retained untouched in v1/app with exact archive/payload/input/image provenance; frozen installs and TypeScript builds pass in-repo and in a fresh independent extraction. Business scenarios remain incomplete/unrun. |
| FP05: custom completion plan | Use the committed output's actual gaps to write the implementation plan, work log and benchmark baseline before custom coding. |
| FP06: upload/process/playback | Complete the custom path and necessary correctness fixes through smaller assigned units, logging provenance, effort and diagram gaps; demonstrate real encoding/playback. |
| FP07: search/counts and usable v1 | Complete agreed core/interface, run lightweight walkthrough and prepare results/limitations for review. |
| FP08: owner review and next iteration | Owner reviews with a fresh agent; choose evidence-backed Jeeves changes and the v2 comparison. Do not automatically start v2 before that review. |

The owner requested fresh Sol agents at xhigh for implementation. Coordinate sequential units
with one writer on main; each agent reads the latest handoff, completes only its assigned unit,
runs the applicable checks and makes one local commit. Split oversized units further.
The review trail must connect diagram → generated baseline → custom plan/diff → working result
→ lesson → Jeeves improvement → fresh v2.
