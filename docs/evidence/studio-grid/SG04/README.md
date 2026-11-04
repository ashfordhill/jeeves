# SG04 evidence: TinyURL study, old studies removed

Date 2026-11-04, Node 24.21.0, from `0f98e4f`.

## What was checked

- `probe.mts` (run with `apps/server/node_modules/.bin/tsx probe.mts <spec index> <out-dir>`), pure:
  the registry holds only `studio-tinyurl@1.0.0`; the goal manifest hash matches and resolves;
  the design has 10 elements, 10 connections, 1 package, 11 components and 15 component links.
  `validateStudio` reports only the standing design-only `NEEDS_TEMPLATE` notice (no invalid,
  missing-reference or `CONFIG_REQUIRED` findings). `designBlueprintSchema.parse(designBlueprint(design))`
  succeeds with 4 services (analytics 3, redirect 4, shorten-api 4, web 0 components),
  5 resources, 1 external, the `link-platform` group, 10 connections, 15 component links and an
  empty `omitted` list. A saved origin from a removed study resolves as `unavailable`.
  Output: `probe.json`, `tinyurl-blueprint.json`.
- `capture.mjs`, Playwright at 1440×900 and 1280×800 against the running dev servers (4300/4310).
  Non-GET requests naming any existing project are aborted (none were attempted). New project
  shows the Architecture study with exactly one option, "TinyURL · studio study", preselected;
  Resource workspace, QR Studio and Blank architecture remain. Creating it renders C1 (4 nodes,
  3 lines) and C2 (10 nodes, 9 lines; Link platform shows as the current collapsed package card).
  Library → Examples lists only TinyURL. Output: `capture-log.json`, `screenshots/`.
- `api-blueprint-check.json`: the real `GET /projects/:id/blueprint` for a created project
  returns 200, parses, matches the counts above and omits nothing.
- Owner projects: the four existing projects return 200 for project, design, layout, findings
  and blueprint (GET only). None has a studio origin. Their revisions and `updatedAt` were the
  same before and after the browser run.
- Disposable projects: a first run created two `SG04 disposable TinyURL …` projects that its
  buggy response listener missed; they were deleted by id (204, then 404; `disposable-deletions.txt`).
  The fixed script finds its own projects by name; its second run (the committed
  `capture-log.json` and screenshots) created and deleted two more (204 each). Owner project
  revisions and `updatedAt` match the list taken before the first run.

## Expected limits

Components are not drawn until SG05; the collapsed Link platform card and fixed positions
are the pre-SG06 layout system. The study's layout file uses the existing per-scope format.
