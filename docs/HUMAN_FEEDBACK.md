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
- **Resolution update (2026-11-10):** `TP03: ids follow names`: renaming a tile or module whose ID still has its creation form (`worker-service-3`) or its name's slug re-keys it to the new name (`video-lifecycle-worker`, its modules `video-lifecycle-worker-…` with it), every reference included, in one Undo step; mouse and chat share it, the selection stays on the renamed item, and a name another ID already has waits in the field with the reason. The studies, the frozen v2 project and hand-chosen IDs keep theirs. TP04–TP09 remain.
- **Resolution update (2026-11-10):** `TP04: process option and skeleton`: Generate project has an unticked "Runnable processes" checkbox (chat has the same command; Undo unticks it); a study or other design not built from modules refuses with the reason. With it on, every application tile, even an empty one, exports as its own healthy process: the stub stack's four came up healthy in Docker and stayed healthy across stop and start. With it off, exports are unchanged. Templates and stubs aren't wired into the processes yet. TP05–TP09 remain.
- **Resolution update (2026-11-10):** `TP05: http wiring`: with Runnable processes on, one edge publishes each public Service or Uploads tile at `/api/<tile>/`. Every stub in an HTTP tile answers any request under `/modules/<module>` with 501 "Not implemented: <name>" and one log line, and Multipart uploads and Cache reader run their real templates with a generated hooks file whose hooks answer 501 until written (Search query is a placeholder). In Docker the stub stack with a cache read came up healthy, answered exactly that through the edge, and stayed healthy across stop and start. Preview lists the edge and every route. TP06–TP09 remain.
- **Resolution update (2026-11-10):** `TP06: consume loops`: with Runnable processes on, a module that consumes a queue runs a loop on it, in any tile, and that queue is set up. Until it is written, each message goes to the queue's `.failed` with one log line ("Not implemented") and the process stays healthy; other errors retry 5 times with a short backoff. The asset lifecycle, Video HLS and event counter run their workers with a generated hooks file (the search projection is a placeholder). In Docker a message to Visits and one to Uploaded each landed in `.failed`, and everything stayed healthy across stop and start. Preview lists each loop. TP07–TP09 remain.
- **Resolution update (2026-11-10):** `TP07: provisioning for stubs`: with Runnable processes on, every database, cache, queue, bucket and search index a stub is connected to is now set up for its tile with the link's access (a database another owner writes is read only, through what that owner publishes), and each stub gets real clients, each checked once at startup. A store on another provider isn't set up and the stack isn't runnable. In Docker the stub stack's every resource existed, every check passed, every process was healthy, stubs still answered "Not implemented", and stop and start kept the credentials and data. Preview lists what is provisioned. TP08–TP09 remain.
- **Resolution update (2026-11-10):** `TP08: run the rebuild`: with Runnable processes on, the stub stack and v2 built from modules (with v2's useful values) both came up healthy in Docker, every process answered as the contract says (stubs and missing hooks "Not implemented", naming the hook; the two search templates placeholders), every message landed in its `.failed` with the processes still healthy, and stop and start kept credentials, data and dead letters. Ticking the box by mouse on v2 exports the same 98 files. Off, exports are unchanged. The run only reaches the first unwritten hook on each path (5 of 37); the [evidence](plans/tile-processes/evidence/tp08/README.md) ranks what it can't show yet. TP09 remains.
- **Resolution update (2026-11-10):** `TP09: review tile processes`: an independent [review](plans/tile-processes/review.md) found all six decisions delivered (by mouse at both sizes, and in a fresh Docker run of the stub stack); off, frozen v2, v1 and the YouTube PNG are unchanged. It fixed a test race behind TP08's one e2e failure, and template dead letters now say `NOT_IMPLEMENTED` with a `started` log line per template. Remaining: filling hooks past the first, and owner calls on product table grants, YouTube v3, tile settings and the TinyURL/Marketplace rebuild.

## 2026-11-10 — Studio feedback and YouTube v3

[Module add button sketch](human-feedback/2026-11-10-module-add-button.png)

- **Problem:**
  - Ctrl+Z and Ctrl+Shift+Z don't undo or redo.
  - "Queue or topic" is unclear.
  - Tiles don't show their kind, so names repeat it.
  - Adding a module is a drag-out tab.
  - The legend calls every solid line a "Request".
  - "Overview" is the default view, and there's a redundant Hand tool.
  - YouTube has no identity for watchers.
  - Modules can't be added from the inspector.
  - The chat agent isn't strong at designs.
  - Field projects need two outputs: generated code only, and the complete solution.
- **Decision:** undo and redo keys; Pointer and Connect only; Detailed (the default) and Simple. Grey kind labels on tiles, and Queue or Topic by mode. The legend shows only async. A module + inside the tile and in the inspector, sharing one command. Optional sign-in for watchers. Better chat tools with design evals. Build YouTube v3 with `generated/` and `app/` outputs. The owner allows editing the YouTube diagram freely.
- **Resolution:** planned as V3-01–V3-17 in the [YouTube v3 plan](plans/youtube-v3/units.md), with eight decision defaults awaiting the owner's confirmation. Nothing is implemented yet.
- **Update 2026-11-10:** the owner confirmed D1–D8 and added two directions. **Favorites** becomes a generic account template (reusable for Marketplace). **Chat** may do only what the mouse can, with tools that carry the knowledge (apply a pattern, preview, automatic review) so a cheap model is enough. The plan is now V3-01–V3-18.
- **Resolution update (2026-11-10):** `V3-01: undo keys, two tools, simple and detailed`: Ctrl+Z undoes and Ctrl+Shift+Z or Ctrl+Y redoes, exactly as the header buttons (not inside a field, where the browser's text undo works, nor under a dialog). The Hand tool is gone: the tools are Pointer and Connect, and dragging empty paper still pans. The toggle reads **Detailed | Simple**, Detailed is the default, and an old "Overview" choice opens as Simple. V3-02–V3-18 remain.
- **Resolution update (2026-11-10):** `V3-02: kind labels, queue or topic, legend`: every tile shows its kind in small grey type under its name (Simple faces and Detailed headers); a channel says **Queue** (each message to one consumer) or **Topic** (a copy to every subscriber) by its mode, and the kind is now "Message channel". The legend shows only **Async**; opened, solid is a direct call where the caller waits and dashed goes through a queue or topic. Every line of the four studies already followed that (now tested). YouTube's names drop the kind: Metadata, Hot metadata, Videos, Video delivery. Remaining: the link table still allows a direct async call between applications, drawn dashed with no channel; V3-03–V3-18 remain.
- **Resolution update (2026-11-10):** `V3-03: module + in the tile and inspector`: as in the sketch, every Service, Worker and Uploads container in Detailed has a small blue **+** at the bottom inside its frame (an empty one is a container holding just the +); in Simple the selected tile has one in its top-left corner, clear of its kind label; the inspector's Modules section has one whose menu pops out left of the rail. One menu (grouped Template / Part of a template / Stub, each kind with its icon, name and description) and one `addModule` command; a click toggles it, a click away or Escape closes it. The drag-out module tab is gone. The link fan opens by a click too (D3) and no longer covers its own tile in a narrow canvas. V3-04–V3-18 remain.
- **Resolution update (2026-11-10):** `V3-04: v3 contract`: the [v3 contract](plans/youtube-v3/contract.md) settles each writing module's own SQL file (readers see only its `published` views), the Auth guard as a template with Sign-in Required or Optional, a generic Favorites template on a separate Account API, process-tile settings, and the v3 design (21 tiles, 26 modules, no direct async line), outputs and acceptance S01–S10. One owner question: optional sign-in gives Watch API a fifth link, and a tile may have four (default: allow five). V3-05–V3-18 remain.
- **Update 2026-11-11:** the owner approved raising the outgoing-link limit from 4 to 5 per tile (the [v3 contract](plans/youtube-v3/contract.md)'s question 1); it was an early rule that predates the UI fixes. The direct-async legend wording (question 12) is still open until V3-09.
- **Update 2026-11-11:** legend: show only the dashed **Async** sample, with no explanatory text. Direct async lines stay allowed. v3 keeps its 8 async (dashed) lines through queues and topics. V3-09 applies the legend change.
- **Resolution update (2026-11-11):** `V3-05: product tables and published views`: with Runnable processes on, each module that writes a database gets its own SQL file (`infra/postgres/<database>/modules/<module>.sql`, yours to write), re-run at every start in its own schema; only its tile uses its tables, and every other tile on that database reads only the views it puts in `published` (D1). Checked in Docker: the reader's cache read reads the view, its base table is refused, an edit applies at the next start, and a restart keeps the data ([evidence](plans/youtube-v3/evidence/v3-05/README.md)). V3-06–V3-18 remain.
- **Resolution update (2026-11-11):** `V3-06: auth guard template`: an Auth guard connected to an Identity is now a Template, the tile's **Sign-in**, set on its page (or by chat) to **Required** (every call needs a valid sign-in, else 401) or **Optional** (signed-out callers are anonymous; a bad sign-in is still refused). Its tile's modules see who is calling, Multipart uploads needs it set to Required, and an upload's lifecycle steps are the lifecycle's own. A tile may now have **5 links** (your approval); checked at both window sizes with no line through a tile. In Docker both settings answered as above with a real Keycloak sign-in, and stop and start kept the realm and credentials ([evidence](plans/youtube-v3/evidence/v3-06/README.md)). V3-07–V3-18 remain.
