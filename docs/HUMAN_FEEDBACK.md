# Human feedback

Keep each entry to **Problem · Decision · Resolution**, normally 3–5 short lines plus image links.
Record only decisions, meaningful clarifications and remaining issues here. Put implementation
logs, test output and detailed discussion in the linked plan/handoff. Append concise resolution
updates; preserve images. [Full earlier record](HUMAN_FEEDBACK.archive-2026-11-08.md).

## 2026-11-05 — Lane canvas controls

- **Problem:** redundant tabs, inconsistent creation menus, unclear TinyURL flows and “both” lanes.
- **Decision:** separate create/attach controls, consistent menus, one system per project.
- **Resolution:** DP01–DP10 (`cbc8346`–`aec1998`); follow-up layout/usability work remains in the [plan](plans/design-polish/units.md). Original review images were not retained.

## 2026-11-06 — User actions and crossing upload/playback lines

[Marked diagram](human-feedback/2026-11-06-youtube-dp09-marked.png) · [Fitted view](human-feedback/2026-11-06-youtube-la03-fit.png)

- **Problem:** apparent User→storage access, shared CDN/upload paths and confusing actor controls.
- **Decision:** one Consume/Produce action per lane; separate lane bands and design warnings.
- **Resolution:** LA01–LA05 (`d888d73`–`2273e27`); fitted text and long relationships still need review. [Details](plans/lane-actions/units.md).

## 2026-11-06 — YouTube upload, publication and layout

[Markup](human-feedback/2026-11-06-youtube-la05-marked.png) · [Before](human-feedback/2026-11-06-youtube-sd03-before.png) · [After](human-feedback/2026-11-06-youtube-sd03-after.png) · [Views](human-feedback/2026-11-06-youtube-sd04-views.png) · [Pipeline](human-feedback/2026-11-06-youtube-sd04-pipeline.png)

- **Problem:** unclear storage reads, upload forks, search publication and long return paths.
- **Decision:** keep durable originals; authorize uploads through a service; publish search through events; put stores near their users.
- **Resolution:** SD01–SD05 improved architecture/layout; later v1 implements publication after the ready-state commit. Overview readability remains open. [Design lessons](design-playbook.md) · [Current v1 review](../field-projects/youtube/v1/notes/review-pack.md).

## 2026-11-06 — Reliable foundations and better assistant designs

[YouTube](human-feedback/2026-11-06-foundations-review-youtube.png) · [Marketplace](human-feedback/2026-11-06-foundations-review-marketplace.png) · [TinyURL](human-feedback/2026-11-06-foundations-review-tinyurl.png)

- **Problem:** diagrams omit ownership/lifecycle contracts and can look plausible without supporting reliable code generation.
- **Decision:** explicit contracts, supported patterns and evidence; small sequential Sol/xhigh units; preserve custom behavior.
- **Resolution:** RF/NC foundations and YouTube v1 completed; enterprise reliability, broad generation, assistant-model quality and owner readability acceptance remain unproved. [Architecture review](plans/reliable-foundations/review.md) · [V1 review](../field-projects/youtube/v1/notes/review-pack.md).

## 2026-11-07 — API read/publish responsibilities

[Owner sketch](human-feedback/2026-11-07-api-action-sketch.png) · [Current crop](human-feedback/2026-11-07-watch-counts-crop.png)

- **Problem:** shared Watch API routes obscure consuming counts versus publishing view events.
- **Decision:** attached responsibility views retain one API identity and an explicit arrow convention.
- **Resolution:** NC03/NC04 added bounded Create/Resolve responsibility views; separate Read counts/Publish view ports and owner usability acceptance remain open. [Contract review](plans/reliable-foundations/nc14-review.md).

## 2026-11-07 — YouTube field versions and diagram snapshots

- **Problem:** need a working application and a fair comparison of generated versus custom work across versions.
- **Decision:** YouTube first; local Docker; PostgreSQL; creator uploads; automatic publication; minimal browser UI; immutable generated commit and numbered diagram snapshots. Heavy template certification stays deferred.
- **Resolution:** FP00–FP07b delivered export, snapshots and working custom v1 (`f0adefb`); owner/fresh-agent review precedes v2. [Plan](plans/reliable-foundations/youtube-field-project-plan.md) · [Snapshot history](../field-projects/youtube/v1/diagrams/index.md).

## 2026-11-08 — Source-line benchmark

- **Problem:** need a simple repeatable measure of template code versus code written after generation.
- **Decision:** count production source lines in `src/`, excluding tests/configuration/infrastructure; compare retained template lines with added/replaced lines.
- **Resolution:** v1 retains 159 template LOC out of 2,874 (5.53%); 2,715 are post-template. [Method/report](field-projects/source-loc.md) · [Implementation record](handoff.md#2026-11-08--workspace-cleanup-and-source-benchmark). Reliability remains separate.

## 2026-11-08 — Repository organization and owner documents

[Root file list](human-feedback/2026-11-08-root-layout.png)

- **Problem:** studio/generator files are mixed at root; the owner README and `.docs/` history were overwritten/deleted.
- **Decision:** studio in `jeeves/`, shared configs in `tooling/`; root README is owner-maintained and must not be edited by agents.
- **Resolution:** studio/shared tooling moved; README restored from remote `3ae6aff`, preserving later owner edits; 43 historical files recovered. [Layout](repository-layout.md) · [Recovery](archive/recovery-2026-11-08.json) · [Implementation record](handoff.md#2026-11-08--workspace-cleanup-and-source-benchmark).

## 2026-11-08 — Concise feedback records

- **Problem:** feedback history repeats implementation and testing detail at excessive length.
- **Decision:** use this short format; link detailed records instead of copying them.
- **Resolution:** condensed the main log; preserved the complete earlier text in the [archive](HUMAN_FEEDBACK.archive-2026-11-08.md). Future entries follow the same rule.

## 2026-11-08 — Backend-only LOC benchmark

- **Problem:** frontend work should not dilute a benchmark for Jeeves' backend generation.
- **Decision:** exclude all UI code, including frontend `src/`, until Jeeves has a UI builder and the owner expands the measure.
- **Resolution:** method v2 requires a backend/UI scope and refuses unclassified source; YouTube v1 remains 159 / 2,715 LOC (5.53%). [Method/report](field-projects/source-loc.md) · [Implementation record](handoff.md#2026-11-08--backend-scope-for-loc-benchmarks).

## 2026-11-08 — YouTube v2 extraction and inspector clutter review

- **Problem:** only 5.53% of v1 backend source remains templated; role explanations and unrelated configuration obscure useful studio controls.
- **Decision:** review reusable backend behavior and generation-relevant UI before a sequential v2 build plan; preserve basic functionality and the owner README.
- **Resolution:** [Review](plans/reliable-foundations/youtube-v2-review.md) identifies upload/lifecycle/media candidates and concrete inspector issues. Template breadth, 60% acceptance policy and normal-inspector scope await owner answers; no v2 implementation started.

## 2026-11-08 — V2 scope, reuse and normal controls settled

- **Problem:** v2 needs useful extraction without becoming a YouTube-only template or adding more editor clutter.
- **Decision:** include generic and reusable video templates; support attachments in other applications. V2 must exceed 5.53%; 60% is an eventual cross-project target. Show a control only when implemented and useful for the user to configure; hide internal metadata.
- **Resolution:** [Build plan](plans/reliable-foundations/youtube-v2-plan.md) defines 23 bounded sequential assignments and a separate reuse proof. Planning is complete; implementation begins with YV2-01 when assigned.

## 2026-11-08 — V2 inspector clutter resolved for normal authoring

- **Problem:** repeated owner/role/deployable text and unrelated contract forms precede useful controls; owner cards/collapse controls obscure recognizable processes.
- **Decision:** canonical process tiles and name/kind/settings first; preserve exact declarations and strict reports through read-only source diagnostics at Export.
- **Resolution:** `YV2-18: simplify diagram and inspector authoring`; [before/after, source/native snapshots and mouse evidence](plans/reliable-foundations/evidence/youtube-v2/yv2-18-clarity.md). Saved-source v2 project preview/ZIP remains YV2-19; owner usability acceptance and strict runtime certification remain separate.

## 2026-11-08 — V2 independent result and backend comparison

- **Problem:** need a working independent deliverable and a fair improvement over v1's 5.53% backend template share.
- **Decision:** compare the actual untouched baseline/completion with the frozen backend/UI scope; retain reused UI and independent functional limits separately.
- **Resolution:** `YV2-23: verify independent v2 and compare backend template share` records 5,456 / 5,456 backend LOC (100%), independent run/restart and scoped cleanup. [Owner pack](../field-projects/youtube/v2/notes/review-pack.md) · [actual evidence](plans/reliable-foundations/evidence/youtube-v2/yv2-23-independent.md). Human listening and successful live encoder argv/stderr evidence remain open; no automatic further version.

## 2026-11-08 — Modules on the canvas and a one-page inspector

[Module sketch](human-feedback/2026-11-08-module-detail-sketch.png) · [Current inspector](human-feedback/2026-11-08-inspector-current.png) · [Inspector sketch](human-feedback/2026-11-08-inspector-sketch.png)

- **Problem:** modules are hidden behind an inspector tab. Tabs, connection lists that repeat the arrows and a hard-to-exit Focus relationships mode clutter the inspector, and the Goal box is small.
- **Decision:** an Overview/Detailed canvas toggle that shows each module and its own attachments. A one-page inspector: name, Description, Options, then module cards you open and leave with Back. Remove Focus relationships and the connection lists. "Goal" and "Purpose" become Description.
- **Resolution:** planned as UI01–UI10 in the [UI overhaul plan](plans/ui-overhaul/units.md), with defaults the owner can change before UI01. Nothing is implemented yet.
- **Resolution update (2026-11-09):** delivered in `c03f45c`…`6bf1fda` (UI01–UI08) and `UI09: tune detailed view readability`. R6 Focus removed (UI01); R2, R3, R5 one tab-free page, Description growing from 6 rows, no connection lists (UI02, UI03); R4 module cards with Back, and rows that open modules (UI03, UI08); R1 Overview | Detailed with containers, module-anchored lines, port marks and tuned marks (UI04–UI09). Overview export unchanged. [Evidence](plans/ui-overhaul/evidence/ui09/README.md). Open: lines to an upstream store loop round the container (v2 worker → Metadata database, not the sketch's short lines); two rows into one store cross; rows need about 0.6 zoom; Choose relationship lists each drawn line; Hand-pan swallows a click. UI10 review pending.
- **Resolution update (2026-11-09):** `UI10: review UI overhaul` found R1–R6 delivered and the Overview export byte-identical to `091488e`. It fixed duplicate Choose relationship entries, port marks beside blue lines and the two-row toolbar. Open for the owner: upstream-store loops, rows read from about 0.6 zoom, two-row crossings, and where a container's X sits. [Review](plans/ui-overhaul/review.md).
