# YouTube v1 diagram history

Every numbered directory is immutable. Each includes an editable `design.json`, exact API
`design-response.json` (including Undo/Redo summary), available read-only `blueprint.json`,
project identity, real mouse-exported `diagram.png`, downloaded `capture.json`, 1280×800
`studio.png` and a hash manifest `snapshot.json`. Operation/create requests and responses are
retained where applicable. `blueprint.json` uses the discriminator **`blueprint: 3`**;
`snapshot.json` records the requested version 3. All source designs remain schema 2.

| Snapshot | Saved project / revision | Reason | Clean image SHA256 |
| --- | --- | --- | --- |
| [001 owner original](001-owner-original/diagram.png) | owner YouTube / 1 | Archive before any mutation; original MySQL, cloud and scale intent | `472a4c8c…6d33dc9f` |
| [002 PostgreSQL](002-postgresql-baseline/diagram.png) | owner YouTube / 2 | One atomic edit changes only `metadata-db` and `view-counts` engines | `472a4c8c…6d33dc9f` |
| [003 v1 copy](003-v1-copy/diagram.png) | named v1 copy / 1 | Full `studioStudySeedOperations` copy of approved owner revision 2 | `472a4c8c…6d33dc9f` |
| [004 local normalization](004-local-generation-baseline/diagram.png) | named v1 copy / 2 | Self-hosted storage, local edge, primary reads and single-node settings | `472a4c8c…6d33dc9f` |
| [005 aligned local intent](005-local-intent-aligned/diagram.png) | named v1 copy / 3 | Correct two replica descriptions; label/describe Local video edge; final generation source | `23c06f6d…dc5bdb9` |

Full hashes are in each snapshot. 001–004 PNGs really are byte-identical: their tile faces do not
show the changed settings. PostgreSQL inspector images in 002/004/005 make that setting visible.
The final label change in 005 changes the PNG; topology remains 18 canonical elements /
18 canonical connections and 21 projected tiles / 25 projected lines in every snapshot.

All images use FP00 renderer commit `a98bf70`, Nunito Variable, light paper, full bounds,
2× scale, 32-unit margins and current owner projection (no role owners in this schema 2 source).
Dimensions are 3008×2752. Capture uses all projected relationships and omits selection/focus;
the studio image uses Fit with no selection. Inspector screenshots retain the selected store.
Chromium is 153.0.8010.12. The clean downloads, UI images, labels, icons, full routes and
arrowheads were inspected. Full source/history/blueprint and interactive view equality are
asserted around every download.

[Renderer audit](renderer-audit.json) records source file hashes and clean tracked Git status
at capture. A fresh web server on 4302 sampled `a98bf70` with `trackedTreeDirtyAtBuild: false`
and proxied the existing owner API on 4310; owner 4300/4310 were not restarted. No rendering
source changed during these snapshots. Later documentation/Biome artifact-exclusion changes in
FP01 do not change that rendered source. Capture identity is startup identity, supported here
by the external audit, not a claim that development HMR attests itself.

[Owner before](owner-before.json) retains project/design/history/blueprint/layout responses for
all three original projects before mutation; [owner after](owner-after.json) and the
[audit result](../notes/evidence/source-audit.json) establish the approved changes and preserved
other projects. The owner is not renamed or replaced. The v1 copy is retained, not scratch.
The original shipped YouTube study, its history constants and global defaults were not changed.
No new owner image was supplied; the five earlier feedback images stay in their original archive.

004 deliberately remains as an intermediate record: its settings were local, but two module
descriptions still said replica and the CDN prose still promised resizing. 005 corrects that
actual context mismatch. Do not use 004 for generation. Frozen inputs reference 005. The next
unit should append the containing FP01 commit here or in the work log; no snapshot contains
its own containing commit.


## FP03b: experimental generation controls

[006 generation UI](006-generation-ui/snapshot.json) appends real mouse PNG/source/blueprint,
1280×800 [studio](006-generation-ui/studio.png), [preview](006-generation-ui/generation.png)
and [opened gaps](006-generation-ui/generation-gaps.png) captures. Architecture and saved revision 3
remain unchanged; the actual clean PNG is byte-identical to 005 (`23c06f6d…dc5bdb9`).
005 remains the immutable authoritative generator image/input profile. 006 records presentation,
not a new architecture/profile. The clean native PNG still uses full bounds, all 25 projected
lines, 21 tiles, 2× scale and Nunito/light paper.

The fresh owned 4302/4312 renderer samples dirty parent `5c79e4efe932b6ae138d966e2373f89216d8dd0c`.
[006 source audit](006-generation-ui/renderer-audit.json) records the actual file hashes and dirty
status at capture; startup identity alone is not HMR attestation. The containing FP03b commit is
recorded in a later work-log/index entry to avoid self-reference. The generation dialog retains
selected-source versus frozen-origin provenance, strict false/none distinction and missing work.
Actual mouse ZIP and non-root packaged API ZIP match; source/history/blueprint/layout/listing and
interactive view/preferences remain equal. TinyURL 12/13 renders and refuses this profile.
One expected browser console 422 accompanies that deliberately unsupported request; no uncaught
page errors or unexpected console errors occurred. Earlier 001–005 descriptions/audit remain
historical. No owner feedback image was supplied or recopied.


[007 generation draft guard](007-generation-draft-guard/snapshot.json) preserves 006 and records
one correction found by mouse E2E: the inherited general toolbar draft flag ignores invalid
fields, so the new generation trigger now separately blocks every pending/dirty draft. The
[actual invalid-name state](007-generation-draft-guard/draft-guard.png) shows the disabled trigger;
the original value is restored without a saved edit. Valid preview/ZIP controls, source revision 3
and full PNG remain unchanged. This second capture uses newly restarted owned 4302/4312 servers
and a [final source audit](007-generation-draft-guard/renderer-audit.json) over the corrected code.
006 remains the first real presentation record, not a silently replaced capture. Both 007 ZIP
and PNG match the previously verified bytes; the profile continues to reference 005.

## FP04 baseline provenance

FP03b commit **`aedbd606342c5a369142b10cf127fc7130d50671`** contains006/007 above. FP04 retains
actual mouse-downloaded [untouched generated output](../app/) with [baseline provenance](../notes/baseline.md).
Saved source/revision3 and view are unchanged, so005 remains the generation image;006/007 retain
presentation history. No new architecture snapshot or historical image/source edit in FP04.

## FP06a custom Video authority and publication boundary

All three new captures are **target-state designs; implementation incomplete**, with actual
source/blueprint/native Export diagram PNG,1280×800 overview/Upload inspector, view geometry and
renderer Git/tree audits.001–007, frozen005 inputs and `.jeeves` remain immutable.

- [008 Video authority](008-video-authority/snapshot.json), schema3 revision4, operation6470:
  ordinary atomic upgrade/ownership/event/outbox/batch/prose edit. One Video owner retains Upload
  and lifecycle canonical roles; Transcoder is separate Media with no SQL; Watch uses public views,
  Discovery is a projection, Counts owns receipts/totals. Native22tiles/27lines. This intermediate
  source honestly retains two missing direct outbox-module→database findings.
- [009 explicit outbox store](009-explicit-outbox-store/snapshot.json), revision5, operation6471:
  add the two direct publisher module→metadata links required by the existing outbox validator.
  Eight executable/profile/published-read/projection findings remain unresolved; no contract or
  runtime-template verification is invented. Native22tiles/27lines.
- [010 readable Upload role](010-readable-upload-role/snapshot.json), revision6, operation6472:
  review of009 found the long “Upload & status API” role title clipped. Shorten it to “Upload API”;
  status responsibility stays in Purpose. Native22tiles/27lines; all authority/relationships/settings
  preserved.008/009 are retained unchanged, including their identifier-like capture reason fields;
  these bullets provide their human-readable reasons.

The existing expanded-role fallback is used for the collapsed Video workflow cycle. Full native
exports retain all relationships, while fitted studio overviews have small names and still need
focus/inspector review. This is a documented readability limit, not a reason to split authority
or redesign the renderer. Captures use a fresh owned4302 web server proxying preserved owner4310;
renderer source stays unchanged. The modified saved source intentionally fails frozen005-profile
export; original CLI generation remains reproducible. No new owner feedback image was supplied.
