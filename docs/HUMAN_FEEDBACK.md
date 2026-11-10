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

## 2026-11-09 — Modules generate code; build v2 from scratch

- **Problem:** after the UI overhaul there's still no way to add a module or to create every tile kind v2 uses (Worker, Search index, CDN, Identity, Uploads). Modules generate no code. Linking still needs the tiles' tabs. Opening a module lights up other rows for reasons you can't see. Module descriptions are too verbose.
- **Decision:** tiles are generic containers for any supported modules, and modules generate code: a template, or a stub when unconnected or uninstalled. A tile shows a link-icon fan for new tiles and a left `+` for modules; insert-before goes. A Connect mode (C, next to Hand) links and unlinks by dragging. Video-specific modules are named "Video …". Descriptions are one short purpose line, and four kind descriptions are reworded. YouTube v2 stays frozen. The acceptance test is rebuilding it from scratch by mouse; v3 and the Marketplace/TinyURL revisit come later.
- **Resolution:** planned as MA01–MA10 in the [module authoring plan](plans/module-authoring/units.md). The owner approves MA01's contract before MA05. Nothing is implemented yet.
- **Resolution update (2026-11-09):** `MA02: drop partner marks and tighten kind descriptions`: an open module marks only its own row and lines, and the four kind descriptions are reworded. MA03–MA10 remain.
- **Update 2026-11-09:** the owner approved the [MA01 contract](plans/module-authoring/contract.md) and all six of its defaults: responsibility modules, each template chosen by a lead module. A runnable process per tile comes next, as its own plan after MA10.
- **Resolution update (2026-11-09):** `MA03: connect mode`: tiles lose the attach tab; **Connect** (C) links by dragging from tile to tile, in the drag's direction (a refused direction shows its reason and is never reversed), and a hovered line's X removes it. MA04–MA10 remain.
- **Resolution update (2026-11-09):** `MA04: link fan with every tile kind`: a selected tile or action has one link tab whose grid fan offers the contract's 11 kinds, Worker service (CPU icon), Search index, CDN, Identity and Uploads included, greyed with the reason where refused; the left `+` and insert-before are gone. MA05–MA10 remain.
- **Resolution update (2026-11-10):** `MA05: module catalog and authoring commands`: the spec has the contract's 18 module kinds, with their hosts, slots, icons and generation. `addModule`, `connectModule`, `disconnectModule` and `removeModule` (mouse and chat) derive each module's template or stub, the fixed values and the ownership in one Undo step. Built by these commands, v2's graph derives v2's seven templates. Chat can use them now; the canvas gets them in MA06. MA06–MA10 remain.
- **Resolution update (2026-11-10):** `MA06: add and connect modules by mouse`: a tile's left `+` opens the module kinds it allows, captioned Template, Part of a template or Stub for that tile; a new module opens with its name focused and shows what it generates. In Detailed, a row that can connect has a dot (filled once connected); in Connect mode a drag from it connects the module, the Cache reader's loader is a row-to-row drag drawn as a gutter arrow, and a module line's X disconnects it. On the TinyURL extended and YouTube studies, a module command shows the existing Cache reader as Refused (their links keep Service identity). MA07–MA10 remain.
- **Resolution update (2026-11-10):** `MA07: generated module stubs`: every module without a complete template exports as a typed stub in `src/modules/<tile>/`: a typed dependency per connection, a comment per unconnected slot, and an entry point that throws "Not implemented" until written; an edited stub is never overwritten. The Generate dialog and the preview list every module as Template, Stub, Custom or Refused with the reason, and stub reasons read as plain sentences. MA08–MA10 remain.
- **Resolution update (2026-11-10):** `MA08: template-backed modules`: a lead with its parts connected exports its installed template exactly as the same template selected on its tile does (v2 built from modules matches v2's seven tile-level selections, apart from its two stubs); the Lifecycle writer's page now shows Pool size and Statement timeout. "Add a supported feature" and chat's preset attachment are gone; designs that used the preset still open and export. MA09–MA10 remain.
- **Resolution update (2026-11-10):** `MA09: rebuild YouTube v2 by mouse`: v2 was rebuilt from a blank project by mouse alone (262 gestures: every tile, link, module, module connection and useful value). A diff by name finds only the contract's intended differences, and Preview selects v2's seven templates with no findings, the two stubs covering the rest. One fan defect blocked a step and was fixed. The kept project is "YouTube v2 rebuild (MA09)"; the [evidence](plans/module-authoring/evidence/ma09/README.md) ranks what was awkward (tiny connection dots at the fit; generated names follow the creation kind). MA10 remains.
- **Resolution update (2026-11-10):** `MA10: review module authoring`: an independent review by mouse at both window sizes found decisions 1–9 delivered, the kept rebuild matching its evidence, and the frozen exports and Overview unchanged. It made stub and Refused reasons plain, stopped chat leaving a stale template, and removed the attach tab's last helper. MA01–MA10 are done; the [review](plans/module-authoring/review.md) ranks the follow-ups (five need your decision) and notes what matters for the per-tile process plan.

## 2026-11-10 — A runnable process per tile

- **Problem:** exported designs are libraries. No application tile runs, and stores connected only to stubs aren't set up. IDs come from the kind at creation, and connection dots are hard to hit.
- **Decision:** an opt-in "Runnable processes" export option, off by default, so today's exports and the frozen v2 rule stay unchanged. With it on, each application tile is a healthy process with its templates and stubs wired in. Missing product hooks answer "Not implemented". Consumer stubs run loops that survive, and stores a stub connects to are provisioned. IDs follow typed names first. Dots get usable hit areas. The owner's own edits in the running UI are play, not incidents.
- **Resolution:** planned as TP01–TP09 in the [tile processes plan](plans/tile-processes/units.md). Nothing is implemented yet.
- **Resolution update (2026-11-10):** `TP02: usable connection dots`: in Connect mode a module's dot is grabbed anywhere in an area at least 16px wide on screen and as tall as the row spacing allows (about 16×11px at the YouTube study's Detailed fit, where the dot is 4px), the hovered container's dots grow a little, and a drag held near or past the canvas edge pans the canvas and still connects on release. TP03–TP09 remain.
