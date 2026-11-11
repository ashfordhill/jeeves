# YouTube v3

YouTube v3 is v2's video platform designed again in the studio, by mouse, from a blank project,
with the studio's v3 additions: an **Optional** sign-in for watchers on Watch API, a separate
**Account API** whose **Favorites** keep each signed-in account's favorite videos, kind labels
instead of kind words in names, and **Runnable processes** on. It has 21 tiles, 33 lines in
Simple (8 dashed, all through a queue or topic), 26 modules (24 Template, 2 Stub), 30 module
connections and 8 useful values.

- **Plan:** [YouTube v3 plan](../../../../docs/plans/youtube-v3/units.md) (V3-11 to V3-17).
- **Design:** [v3 contract](../../../../docs/plans/youtube-v3/contract.md) §5, as data in
  [`fixtures/v3-modules.ts`](../../../../jeeves/packages/spec/src/fixtures/v3-modules.ts).
- **Built by mouse:** [V3-11 evidence](../../../../docs/plans/youtube-v3/evidence/v3-11/README.md)
  and its spec, [`e2e/v3-build.spec.ts`](../../../../jeeves/apps/web/e2e/v3-build.spec.ts).

## The studio project

**YouTube v3**, ID `e56a3800-d0d6-43df-b6d0-01019c4bae8b`, saved revision **171**, in the owner's
`jeeves` database ([open](http://127.0.0.1:4300/?project=e56a3800-d0d6-43df-b6d0-01019c4bae8b)).

## Snapshot (V3-11)

| File | What |
| --- | --- |
| [`inputs/design.json`](../inputs/design.json) | The saved design in the server's canonical encoding (sorted keys, array order kept, UTF-8, no trailing newline), the bytes Generate project assembles. SHA-256 `9762df418108917c71f42de6190c3c756d1db62dbaeca83653b6e9b6db93813f`. Don't pretty-print or resave it. |
| [`inputs/blueprint.json`](../inputs/blueprint.json) | Blueprint v3 of the same revision (`GET /api/projects/<id>/blueprint?version=3`). |
| [`diagrams/detailed.png`](../diagrams/detailed.png), [capture](../diagrams/detailed-capture.json) | Export diagram → PNG in Detailed: 5312×3520, 24 tiles (with the user and actions), 37 lines. |
| [`diagrams/simple.png`](../diagrams/simple.png), [capture](../diagrams/simple-capture.json) | Export diagram → PNG in Simple: 3904×2976, 24 tiles, 33 lines. |

Both captures name revision 171 and the design's SHA-256 above. They were taken from a Vite dev
server at commit `2cf676f`; its uncommitted changes were V3-11's e2e files and the owner's
`.jeeves-feedback/`, none of them renderer code.

## Outputs to come

`generated/` (V3-12) will be the exact export of `inputs/design.json`, never edited, and `app/`
its copy completed by V3-13 to V3-16 (contract §6). This README will then explain both outputs
and how to run each.
