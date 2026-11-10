# UI09 evidence: Detailed view and inspector readability

Tuning only, at commit `UI09: tune detailed view readability` (parent `6bf1fda`). No layout,
behaviour, schema, blueprint, chat or generation change. Screenshots from scripted Chromium on my
own projects (TinyURL extended, Marketplace, YouTube, and one seeded from
`field-projects/youtube/v2/inputs/design.json`), all deleted afterwards.

## What changed (before → after)

| Where | Before | After |
| --- | --- | --- |
| Row frame | 1.5px, line colour at 30% | 1.5px, line colour at 50% |
| Row box | 24px tall, name 13px/700, padding 8px | 26px tall (pitch stays 32), name 14px/700, padding 7px |
| Header | name 14px/800; divider 1.5px family colour at 45% | name 15px/800; divider 2px line colour at 40% |
| Port marks | none: lines stopped at the frame, 10px from the row | a 2.75px stub (the line width) from the frame to the row on each side a drawn line uses; blue for the open row and for a selected container without an open module |
| Partner row | border at 80% selection colour | full selection-colour border, 1px inner ring, 10% tint (18% dark) |
| Open row | fill 32% in both themes | fill 32% light, 55% dark; ring and bold name unchanged |
| Container pull tabs | peek 18px: 22px over the rows' right ends | peek 36px: just outside the frame, beside the rows |
| Module cards | padding 10/12px, gap 8px, border `--grid-dot` (invisible on the dark rail) | padding 8/10px, gap 6px, border line colour at 30% |
| Section rules | `--grid-dot` | line colour at 30%, visible on the dark rail |
| Add a supported feature | browser fieldset, legend, select and buttons | a section like Options/Modules: rule, 13px heading, ordinary field, full-width buttons |

Kept: container width 256, header 48, row pitch 32. Measured alternatives: a 64px pitch (32px
header) makes YouTube 1,920×1,984 (from 1,920×1,600) and v2 2,528×1,824, so every fit drops by
about a fifth; 224px containers save only 96px of YouTube's width and cut "Publication outbox
publisher" short.

## Images

- `1440-transcoder-packager-before-after.png`: YouTube's Transcoder at 100% with Packager open.
  Port marks, tabs off the rows, visible partner rows (encoder, completion publisher).
- `1280-transcoder-dark-before-after.png`: the same in dark mode; the open row reads as filled.
- `1440-tinyurl-containers-before-after.png`: TinyURL extended at 100%; framed rows and marks.
- `1440-v2-lifecycle-worker-100.png`: v2's Video lifecycle worker with the Metadata database at
  100%, to compare with the [owner's sketch](../../../../human-feedback/2026-11-08-module-detail-sketch.png).
- `1440-youtube-detailed-fit.png`, `1280-v2-detailed-both-rails.png`: fits (0.34; 0.20 floor).
- `1280-system-inspector-before-after.png`, `1280-module-cards-dark-before-after.png`: inspector.

## Measurements

Unchanged by this unit (geometry kept); full tables in
[studio.md, Size and fit](../../../../studio.md#size-and-fit). Every Overview and Detailed layout
of the four designs is byte-identical to `6bf1fda`.

| Design | Overview: size, length, crossings | Detailed: size, length, crossings |
| --- | --- | --- |
| TinyURL extended | 1,024×832, 2,752, 0 | 1,280×800, 3,008, 1 |
| Marketplace | 1,280×1,472, 6,912, 1 | 1,568×1,536, 8,576, 4 |
| YouTube | 1,504×1,376, 8,864, 1 | 1,920×1,600, 12,608, 4 |
| YouTube v2 | 1,920×1,297, 10,080, 3 | 2,528×1,441, 17,536, 12 |

Detailed fit (rails closed / both open): TinyURL 0.70/0.44 and 0.62/0.35; Marketplace 0.35/0.35
and 0.31/0.28; YouTube 0.34/0.29 and 0.30/0.23; v2 0.38/0.21 and 0.33/0.20 (1440×900, then
1280×800). v2 at 0.20 is the floor, but every tile and line stays inside the canvas.

Overview export of the YouTube study, before and after: PNG
`472a4c8cf3f8eadf8f7c9f2dc79e20f37b19a3656abcb4587dda9b3f6d33dc9f` (the UI07 hash), capture
details and tile positions identical. The Detailed PNG changes (port marks, fonts), as expected.

## v2's Video lifecycle worker against the sketch

Matches: one container with Processing consumer, Lifecycle writer and Publication outbox publisher;
Processing events → the consumer's row (dashed); the outbox's row → Publication events (dashed);
each line now visibly reaches its row. Differs: the Metadata database sits upstream (up and to the
left), so the writer's line runs up over the worker (1,280px) and the outbox's under it and back
(1,312px), both into the database's left side, instead of the sketch's two short lines into a
database on the right. That is the stores-beside-their-users layout rule, unchanged here.

## Open issues, worst first

1. Lines to an upstream store loop round their container (v2 worker → Metadata database; the
   Transcoder's encoder, packager and thumbnailer back to Original and Transcoded videos). Layout
   rule; an open module's line can be the long one.
2. At the fit nothing in a row reads (14px names at 0.20–0.38 are 3–5px); rows read from about 0.6.
3. Two rows into one store cross (the Transcoder's Packager and Thumbnailer into Transcoded videos;
   twice in v2): UI05's two-returns limit.
4. **Choose relationship** lists each drawn line, so one relationship can appear twice (UI10).
5. A selected container's red X sits on its header, over the middle of a long name; its pull tabs
   cover the first 36px of the lines leaving its middle rows.
6. A port mark is solid even for a dashed line, and stays dark when a line is blue only because
   another tile or the relationship is selected.
7. After a Hand-mode pan the next click is sometimes swallowed (predates the plan; UI10).
