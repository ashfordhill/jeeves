# Production foundations: true docs, a smaller surface, sturdier templates, regeneration

**Status:** planned 2026-11-12 from the owner's review of Jeeves after YouTube v3. The owner
confirmed every decision below the same day. **Nothing is implemented yet.**
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-12](../../HUMAN_FEEDBACK.md).

There are 14 units, run in order: PF01 → PF14. A coordinator gives each unit to a fresh agent.
That agent does only its own unit on `main` in the primary checkout, commits it and stops.

| Phase | Units | What |
| --- | --- | --- |
| A. Docs | PF01, PF02 | Record the owner's goals; fix stale statements; current-state `PLAN.md` and generator READMEs |
| B. Smaller surface | PF03–PF05 | Remove direct async links; retire the strict-contract surface from the web app and from chat |
| C. Sturdier templates | PF06–PF08 | Every failure is logged; the cache read recovers; one bad item never stops a process |
| D. Regeneration | PF09, PF10 | Update an existing export in place and keep the application's own files |
| E. Proof | PF11–PF13 | YouTube v4: v3 regenerated onto the new templates, then run with two copies and with faults |
| F. Review | PF14 | Independent review |

## Why

The review (2026-11-12) found:

1. Nothing shows the generated code holds when several copies run or a store fails.
2. An export can only be written to a new directory, so a completed app can't take new templates.
3. Agent-facing docs contain stale statements.
4. A strict-contract layer (units NC01–NC14) that no template uses fills chat's tools, a dialog
   and the docs.
5. The canvas allows a dashed line straight between two services, which generates nothing.

## Decisions (owner, 2026-11-12)

| # | Decision |
| --- | --- |
| D1 | **No scale setting.** How many copies of a process run, and on what, is deployment and is outside Jeeves. Generated code must be correct when several copies run and when a store or the broker fails and comes back. |
| D2 | **Direct async links are removed.** A dashed line always goes through a Queue or Topic tile. A line between two services, or between a service and an external API, is always a direct call. Lines through a Queue or Topic stay dashed, and the Async legend stays. |
| D3 | **The strict-contract surface is retired** from chat, the web app and the docs. Its spec code stays so saved designs still open. Ownership stays: generation reads it. |
| D4 | **The default new project is the TinyURL study** (`studio-tinyurl`). The TinyURL foundation study leaves the New project chooser. No existing project needs to be preserved. |
| D5 | **The diagram is the source of truth for generated files.** Hook files, stub bodies and product SQL are the application's own and need no diagram change. Regeneration rewrites the first and keeps the second. |
| D6 | **Only what generates is offered.** Two templates that can't work together are refused when they are connected. Application-specific code is a stub. |
| D7 | **The plan ends with one Docker run of YouTube v4**: two copies of each process, then faults. |
| D8 | **Jeeves stays narrow.** Extra review or analysis features belong in a separate companion tool. |

## Not in this plan

Do none of these, even if they look easy. List anything you notice in your handoff entry.

| Item | Why not |
| --- | --- |
| A scale tier, replica counts, cloud targets, host names from the environment | Deployment (D1) |
| Deleting the strict-contract spec code or the design's `scope` and `operations` fields | Needs a schema change; later plan |
| Template gaps 1, 4, 7 and 8 ([template gaps](../../template-gaps.md), written by PF01) | Gap 1's benefit is in the browser page; UI is out of scope |
| Receipt retention in the event counter; outbox relay throughput; a restart policy | Recorded as known limits by PF01 |
| Rebuilding Marketplace or TinyURL from modules; message or record schemas on links; the runtime as a package; a lint for hook imports | Next plan |
| The root `README.md` | Owner-maintained |
| Paid model calls (`--live`) | Need the owner's go-ahead at the time |

## Rules for every unit

**1. Read first, in this order:** `AGENTS.md`; the last three entries of `docs/handoff.md`
(`grep -n '^## ' docs/handoff.md | tail -3` gives their line numbers); this plan's Decisions,
Not in this plan and Rules; then your own unit. Do not read or start later units.

**2. Exactness.** Where your unit names a file, function, string or number, use exactly that.

- If the code differs from the plan in a small way (a renamed variable, a moved line), follow the
  unit's **Goal** and record it under "Differences from the plan" in your handoff entry.
- If a named file or function doesn't exist, or a step can't be done as written, or doing it
  would change behaviour the unit doesn't mention: **stop**. Undo your own uncommitted work
  (`git checkout -- <each tracked path you edited>` and delete each new file you created; never
  the owner's files below), append a handoff entry titled `PFnn: blocked` saying what you
  found, commit only `docs/handoff.md`, and end. Do not invent an alternative.

**3. The owner's uncommitted work.** Run `git status` first. These are the owner's and must stay
unstaged and untouched: `README.md`, `.docs/`, `.jeeves-feedback/`, every `Zone.Identifier` file
and the mode of `jeeves/scripts/e2e-docker.sh`. Stage by path (`git add <path>`). Never run
`git add -A`, `git add .`, `git stash`, `git clean` or `git reset --hard`.

**4. Never edit:**

- the root `README.md`;
- `generated/`, `app/`, `inputs/` or `diagrams/` under `field-projects/youtube/v1`, `v2` or `v3`;
- `jeeves-generator/templates/local-v1/`;
- recorded eval reports under `docs/evals/`;
- earlier entries of `docs/handoff.md`.

**5. Environment.**

- Put Node 24 first: `export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH`.
- Run every `pnpm` command from the repository root.
- Never stop, restart or use the owner's dev servers (ports 4300 and 4310) or the `jeeves`
  database. Never edit the owner's projects.

**6. Checks.** Each unit says which of these it runs. Run them in this order, after your changes.

| Name | Command | Passes when |
| --- | --- | --- |
| check | `pnpm check` | exit 0 |
| e2e | `pnpm test:e2e` (or `pnpm test:e2e:docker` if Chromium's system libraries are missing) | every test passes |
| build | `pnpm --filter @jeeves/web build` | exit 0 |
| evals | `pnpm eval:chat` | exit 0 (offline; it sends nothing) |
| mouse | a temporary Playwright spec, below | passes at both sizes with no page error |

- If `check` fails **before** you change anything, stop as in rule 2.
- If an e2e test fails, rerun that one test alone and report both results. Never weaken a test,
  and delete a test only when your unit names it.
- **The mouse check.** Write `jeeves/apps/web/e2e/pfNN-check.spec.ts`. It uses the e2e servers
  (ports 4301 and 4311, database `jeeves_e2e`) and does what your unit's "Mouse check" lists,
  once with `test.use({ viewport: { width: 1440, height: 900 } })` and once with
  `{ width: 1280, height: 800 }`. It fails on any `pageerror`. Run it with
  `pnpm db:up && pnpm exec playwright test -c jeeves/playwright.config.ts pfNN-check`. Save at most 4
  screenshots under `docs/plans/production-foundations/evidence/pfNN/`. Delete the spec file
  before you commit. Delete every project it created.

**7. Export gates.**

- `pnpm check` includes `assemble.test.ts`: the frozen v1 export must stay byte-identical. If it
  fails, stop as in rule 2.
- `pnpm check` includes `processes-off.test.ts`, which pins three exports by file hash. A unit
  that edits a template lists "Exported files this unit may change". If the test fails:
  1. Read the failing paths. Each must be in your unit's list, or be `.jeeves/manifest.json` or
     `.jeeves/report.json`. If any other path is listed, stop as in rule 2.
  2. Run `pnpm --filter @jeeves/generator pins:update` (PF06 adds this command), then
     `pnpm format`, then `pnpm check` again.
  3. List the changed pinned paths in your handoff entry.
- Skip the older comparison with `generic-export.tar.gz`: the pin covers the same design.

**8. Docs.** Update the docs your unit names. If your change makes another sentence in
`docs/studio.md`, `docs/studio-settings.md`, `docs/studio-blueprint.md`, `jeeves/CATALOG.md`,
`jeeves/PLAN.md`, `jeeves-generator/README.md`, `docs/chat-evals.md` or `docs/glossary.md` false,
fix that sentence too. Describe what exists now; don't add history. Add one dated lesson to
`docs/design-playbook.md` only if you learned something a later designer needs.

**9. Finish.** Append one entry to `docs/handoff.md` with this shape, then make one local commit
with the unit's commit name. Don't push.

```markdown
## 2026-MM-DD — PFnn: <the unit's title>

**What changed.** <files and behaviour, as a short list>
**Checks.** <each check run, with its result and counts>
**Differences from the plan.** <or "None.">
**Noticed.** <things outside the unit, or "Nothing.">
**For the next unit.** <one or two lines>
```

Also append one `- **Resolution update (2026-MM-DD):**` line to the 2026-11-12 entry of
`docs/HUMAN_FEEDBACK.md`, in the owner's plain words, two sentences at most.

---

## Phase A — Docs

### PF01 — Record the owner's goals and fix stale statements

**Goal:** every later agent reads true statements about what Jeeves is for and what exists.
**Checks:** none (docs only). Say so in the handoff.

**1. `AGENTS.md`.** Insert this section between the opening paragraph and `## How work happens`,
exactly:

````markdown
## Goals and scope (owner, 2026-11-12)

- **What Jeeves is for.** One person designs a web application's backend as a diagram. Jeeves
  generates the deterministic part of the code from it: the target is 60% or more of backend
  source, across different applications. People or agents write the rest in the hook and stub
  files the export leaves for them.
- **The diagram is the source of truth for generated files.** Never edit a generated file by
  hand: a needed edit is a template gap, recorded in [template gaps](docs/template-gaps.md). Hook
  files, stub bodies and product SQL are the application's own and need no diagram change.
- **Only what generates is offered.** The canvas and chat offer only tiles, links, modules and
  settings that an installed template or a stub generates. Two templates that can't work
  together are refused when they are connected, with the reason. Application-specific code is a
  stub.
- **Production architecture, not deployment.** Generated code must be correct when several
  copies of a process run and when a store or the broker fails and comes back. How many copies
  run, and on what infrastructure, is deployment and is outside Jeeves.
- **Outside Jeeves:** the UI of generated applications; sizing, cloud provisioning and
  deployment; features that only review or analyse diagrams (a separate companion tool).
- **Field projects** (YouTube first) exist to grow and test the template library. They need core
  features only, and none is a product to preserve.
- **The owner is the only user.** Don't add onboarding, multi-user or audit features.
- **Words:** see the [glossary](docs/glossary.md).
````

In the Conventions list, replace the sentence that begins `For YouTube v2, follow the assigned
unit` (to the end of that sentence) with:
`Follow the assigned unit in the active plan, [production foundations](docs/plans/production-foundations/units.md); do not execute later units.`

**2. `docs/design-playbook.md`.** Four replacements:

1. In the Caps bullet, `4 links out of a tile` becomes `5 links out of a tile`.
2. Replace the whole table row that begins `| Payment provider |` with:

```text
| Payment provider | Service (`service`) and External (`external-api`) | A Service that owns its payment records and calls the provider as an External API. New Billing tiles are no longer offered. |
```

3. Replace the whole table row that begins `| Email |` with:

```text
| Email | Service (`service`) and External (`external-api`) | A Service that calls the email provider as an External API. New Notifications tiles are no longer offered. |
```

4. Replace the sentence `Lines have no arrowheads and a pipeline's lines are all dashed, so a
   dashed U reads as a group outline.` with:

```text
Lines have arrowheads, but a U still wraps the tiles between its ends, so it can read as a group outline.
```

**3. `docs/studio.md`,** in `## Limits`. Replace the sentence
`Live chat quality with the lane-canvas instructions has not been evaluated; only the scripted test model has run.`
with `Live chat quality was measured on four models in V3-19 ([results](evals/v3-19/README.md)).`
Keep the sentence after it.

**4. `field-projects/youtube/v3/notes/review-pack.md`** (a notes file, so rule 4 allows it).
Replace `**seven scenarios in full, S05 except human listening, and S02, S04 and S08 in part.**`
with `**six scenarios in full, S05 except human listening, and S02, S04 and S08 in part.**`

**5. Create `docs/glossary.md`** with exactly this content:

````markdown
# Glossary

| Word | Means |
| --- | --- |
| Tile | A box on the canvas: a service, worker, store, queue, CDN, identity or external API. In the saved design it is an *element* with a studio *binding*. |
| Kind | What a tile is (`service`, `worker`, `database` and so on). The small grey word under a tile's name is its *label*. |
| Link | A line between two tiles (a *connection* in the saved design), or from an action to a tile (an *entry*). Solid is a direct call. Dashed goes through a Queue or Topic. |
| Action | What the user does in a lane (Watch, Publish). It generates no code. |
| Module | A part inside an application tile (a *component* in the saved design). It is the unit of generated code. |
| Template | Generated, working code for one mechanism (sign-in, multipart upload, cache read). Its *lead* module selects it once its *parts* are connected. |
| Stub | A module with no complete template. It exports as a typed file that throws "Not implemented" until written. |
| Hook file | `src/modules/<tile>/<lead>.hooks.ts`: the product decisions a template asks for. The application's own. |
| Scaffold | Every generated file that is not a hook file, a stub body or a product SQL file. Never edited by hand. |
| Selection | The saved record that a template or a stub generates a module (`generation.selections`). |
| Runnable processes | The export option that makes each application tile its own process. |
| Edge | The nginx container that publishes public tiles at `/api/<tile>/` and a CDN at `/cdn/<cdn>/`. |
| Published view | A SQL view a writing module puts in the `published` schema. Other tiles may read only these. |
| Study | A built-in example design that New project offers. |
| Field project | A real application built from a Jeeves export to test the templates (`field-projects/`). |
| Template gap | Something a template could not do, found in a field project ([list](template-gaps.md)). |

## Version names

| Name | What it versions |
| --- | --- |
| YouTube v1, v2, v3, v4 | Field project versions under `field-projects/youtube/` |
| `studio-youtube@2.2.0` | The built-in YouTube study |
| `local-v1`, `local-v2` | Generator template registries. `local-v1` is frozen and legacy. |
| schema 2, schema 3 | The saved design's `schemaVersion` |
| blueprint 2, blueprint 3 | The read-only blueprint API |
| eval 1.1.0, design evals 2.0.0 | Chat evaluation suites |
| `source-loc-v2` | The backend LOC benchmark's method |
````

**6. Create `docs/template-gaps.md`** with exactly this content:

````markdown
# Template gaps

Generated files are never edited by hand (AGENTS.md). When a field project needs something a
template can't do, add a row here and say what the application did instead. A unit that closes a
gap changes its Status.

| # | Gap | Found | Status |
| --- | --- | --- | --- |
| 1 | Multipart's status, list and complete can't carry the video's state; complete answers 200, not 202 | v3 (V3-13) | Open |
| 2 | A completion stopped by a failing hook fails the next start, with no reason | v3 (V3-13) | Open (PF06 logs the reason; PF08 keeps startup going) |
| 3 | The outbox relay retries a failing codec silently, for ever | v3 (V3-13) | Open (PF06 logs each failure) |
| 4 | Lifecycle and Transcoder hooks get no key prefix | v3 (V3-13) | Open |
| 5 | A hook that throws while the Transcoder reports a failure stops the Transcoder | v3 (V3-14) | Open (PF08) |
| 6 | A stub's queue publisher can't name its message ID | v3 (V3-15) | Fixed in V3-18 |
| 7 | The cache read's 404 can't be shaped from its hooks | v3 (V3-15) | Open |
| 8 | The export serves no browser and has no place for one | v3 (V3-16) | Open; v3 edits four scaffold files instead. UI is outside Jeeves for now. |

Details of 1–8: [YouTube v3 notes](../field-projects/youtube/v3/notes/README.md#template-gaps-found-while-completing-app).

## Known limits

Found in the 2026-11-12 review. Each is a fixed policy inside a template.

| Limit | Status |
| --- | --- |
| The cache read turns its cache off for the life of the process after one stalled cache call | Open (PF07) |
| The event counter keeps one receipt row per event for ever | Open |
| The outbox relay sends at most 10 rows about once a second | Open |
| A process that loses its broker exits and is not restarted | Open; a deployment's restart policy covers it |
| Host names are compiled into the export for local Compose | Open; deployment is outside Jeeves |
````

**Done when:** the six edits are made exactly, and `grep -n "YouTube v2, follow" AGENTS.md`
prints nothing.
**Commit:** `PF01: record goals and fix stale docs`.

### PF02 — Current-state `PLAN.md` and generator READMEs

**Goal:** these three files describe what exists today, with no history narrative.
**Checks:** none (docs only).

**1. `jeeves/PLAN.md`.**

1. In the diagram at the top, replace `OpenAI API / Codex (chat only)` with
   `OpenAI API / Codex / Anthropic API (chat only)`.
2. In the Repository layout table, find the row whose first cell is the generator's path
   (`../jeeves-generator`). Replace its whole second cell with:

```text
The `@jeeves/generator` workspace. The `local-v2` registry exports a saved schema-3 design as a standalone project: nine templates, typed module stubs and, with Runnable processes on, one process per application tile. The frozen `local-v1` profile still exports byte-identically and is otherwise unused. See its [README](../jeeves-generator/README.md).
```

3. In the same table, replace the second cell of the `packages/providers` row with:

```text
A provider-neutral model interface with OpenAI Responses, Codex and Anthropic adapters and a scripted fake.
```

4. In `## Data model`, the words `ten component kinds` (they wrap over two lines) become
   `nineteen module kinds`. First count the rows of the Components table in
   `jeeves/CATALOG.md`; if the count isn't 19, write the number you counted instead.
5. In `## Chat`, replace the one sentence that lists the tools. It begins `The server loop` and
   ends just before the sentence that begins `The pattern tools supply`. Put this in its place:

```text
The server loop (`chat/service.ts`) calls the chosen model with a finite toolset (`chat/tools.ts`), listed in the [studio guide](../docs/studio.md#chat).
```

6. In `## Chat`, find the paragraph that begins with the word `Providers`. After its first
   sentence, add:

```text
The Anthropic Messages API gets the canonical schemas as they are, with the key read from `ANTHROPIC_API_KEY` only.
```

7. Delete everything from the line `## Next` to the end of the file. Put this in its place:

````markdown
## Status

Completed plans, oldest first: [lane grid](../docs/plans/lane-grid/execution-units.md),
[design polish](../docs/plans/design-polish/units.md),
[lane actions](../docs/plans/lane-actions/units.md),
[system design](../docs/plans/system-design/units.md),
[reliable foundations](../docs/plans/reliable-foundations/units.md),
[UI overhaul](../docs/plans/ui-overhaul/units.md),
[module authoring](../docs/plans/module-authoring/units.md),
[tile processes](../docs/plans/tile-processes/units.md) and
[YouTube v3](../docs/plans/youtube-v3/units.md).

The active plan is [production foundations](../docs/plans/production-foundations/units.md).
What each unit did is in [the handoff](../docs/handoff.md); the owner's decisions are in
[HUMAN_FEEDBACK](../docs/HUMAN_FEEDBACK.md); open template gaps are in
[template gaps](../docs/template-gaps.md).
````

**2. `jeeves-generator/README.md`.**

1. Insert this section directly after the `# Experimental generator foundation` heading:

````markdown
## Current state

- **Input:** a saved schema-3 design (`design.json`) built from modules.
- **Output:** a standalone Node 24 and TypeScript project for local Docker Compose. With
  Runnable processes on it has one process per application tile, the providers they use
  (PostgreSQL, RabbitMQ, Valkey, Garage, OpenSearch, Keycloak), an nginx edge, and `.jeeves/`
  with the manifest and report.
- **Templates (9):** Sign-in, Multipart upload, Upload lifecycle, Video encoding, Cache read,
  Event counter, Search indexing, Search query and Favorites. Any other module exports as a
  typed stub.
- **Yours to write:** each template's `<lead>.hooks.ts`, each stub's `<module>.ts` and each
  writer's product SQL file.
- **Commands:** `pnpm --filter @jeeves/generator export:v2 <design.json> <new directory>`. The
  studio's Generate project dialog produces the same files as a ZIP.
- **Not provided:** deployment to anything but local Compose, a browser UI, and load or runtime
  certification.
- **Legacy:** the frozen `youtube-local-v1` profile (the sections from API to Preserving work)
  still exports byte-identically and is otherwise unused.

The rest of this page is reference.
````

2. Find the paragraph that ends `No v2 studio preview or browser controls are wired yet.` (it
   begins with `loadLocalV2Registry()` in backticks). Replace the whole paragraph with:

```text
`loadLocalV2Registry()` installs the local runtime foundation (standalone package, lock and build files, pinned providers, setup and restart wiring), the nine templates, module stubs and tile processes. No process runs unless [Runnable processes](#runnable-processes) is on. The studio's Generate project dialog previews and downloads this export ([above](#jeeves-preview-and-zip-download)).
```

**3. `jeeves-generator/templates/README.md`.** Replace the first paragraph under the heading
(it contains the words `diagnostic inventory`) with:

```text
`local-v2/index.ts` is separate from the frozen registry below. `loadLocalV2Registry()` snapshots its source closure and assets before rendering and registers the local runtime foundation, the nine templates (sign-in, multipart upload, upload lifecycle, video encoding, cache read, event counter, search indexing, search query and favorites), module stubs and tile processes. New implementations belong in `local-v2/` and `src/v2/`. Shared files have one explicit owner and named contributors. See the [v2 API](../README.md#v2-registry-and-export).
```

**Done when:** `grep -n "No v2 studio preview" jeeves-generator/README.md`,
`grep -n "diagnostic inventory" jeeves-generator/templates/README.md` and
`grep -n "^## Next" jeeves/PLAN.md` each print nothing.
**Commit:** `PF02: current-state plan and generator readmes`.

---

## Phase B — Smaller surface

### PF03 — Remove direct async links (D2)

**Goal:** no line can be drawn or saved as asynchronous unless one end is a Queue or Topic tile.
**Checks:** check, e2e, build, evals, mouse. **Exported files this unit may change:** none.

**Code, in `jeeves/packages/spec/src/studio-links.ts`:**

1. Delete the constant `either`.
2. In `studioLinkRules`, the rows `application → application`, `application → external` and
   `external → application` use `...sync` instead of `...either`.
3. In the comment above `studioLinkRules`, replace `an application or external API sync or
   async.` with `an application or external API by request.` and replace
   `An external API calls an application, sync or async.` with
   `An external API calls an application, by request.`
4. In `modeRefusal`, directly before the final `return mode === "async"`, add:

```ts
const role = studioLinkRole(target);
if (mode === "async" && (role === "application" || role === "external"))
  return `A link to ${noun(target)} is a direct call. To hand work off without waiting, put a queue or topic between them.`;
```

Change nothing else in the spec's logic. In `studio-design-review.ts` change only the header
comment that says a dashed line between applications is accepted: it is now flagged.

**What must be true afterwards** (these follow from the change; don't write code for them):

- `linkTiles` or `addTile` with `link: "async"` between two services is refused with the
  sentence above.
- A stored design that has such a link still opens. `validateDesign` reports it as
  `LANE_INVALID` with that sentence, and `designReview` reports a `line-style` finding whose
  commands redraw it.
- Removing a Queue or Topic no longer links its publisher straight to its consumer. The consumer
  is listed among the tiles the removal also removes, unless something else still reaches it.

**Tests.**

- Add to `studio-lanes.test.ts` (or `studio-links.test.ts` if it exists):
  1. `studioLinkRefusal("service", "service", "async")`,
     `studioLinkRefusal("service", "external-api", "async")` and
     `studioLinkRefusal("external-api", "service", "async")` each equal the sentence, with
     `a service`, `an external API` and `a service` as the noun.
  2. `studioLinkRule("service", "worker")?.modes` equals `["sync"]`.
  3. On the TinyURL study (`studio-tinyurl`), `planRemoveTile` for its queue adds no link from
     the queue's publisher to its consumer and lists the consumer among the tiles to remove.
  4. A design with one service-to-service connection whose `planned.interaction` is
     `"Asynchronous"`: `validateDesign` returns a `LANE_INVALID` finding containing
     `is a direct call`, and `designReview` returns one `line-style` finding for that link.
- Update every existing test that expects an async link between two applications, or between
  an application and an external API, to be accepted. Find them with
  `grep -rln "async" jeeves/packages/spec/src/*.test.ts jeeves/packages/spec/src/fixtures/*.test.ts jeeves/apps/server/src --include=*.test.ts`
  and run the suite. A test of a restitched async link after removing a queue now expects the
  consumer to be removed with it.

**Docs.**

- `jeeves/CATALOG.md`, link table: the Modes cell of the three rows becomes `sync`. Replace the
  sentence that begins `Application → application, application → external API and external
  API → application still allow async` (it ends `for its channel.`) with:
  `A line between two applications, or between an application and an external API, is always a direct call: to hand work off without waiting, put a Queue or Topic between them (owner, 2026-11-12).`
- `jeeves/CATALOG.md`: replace the paragraph that begins `The table records design intent only.`
  with:
  `The table offers only links that generate something. A link or a module connection that no installed template or stub can generate is refused when it is made, with the reason (owner, 2026-11-12); a gap found this way is recorded in [template gaps](../docs/template-gaps.md).`
- `docs/studio.md`, lane canvas, Lines bullet: replace the sentence that begins `The link table
  still allows a direct asynchronous call` with
  `A dashed line always goes through a Queue or Topic tile; a line between two services is always a direct call.`
- `docs/studio.md`, Chat, the **line-style** bullet: replace `A dashed line between
  applications, which the table allows, is accepted.` with
  `A dashed line between two services or to an external API is flagged too.`

**Mouse check:** on a blank project add a Service after the Produce action, then a second
Service after it from the link fan: the line between them is solid. On a new TinyURL study the
lines into and out of its queue are dashed and the legend shows Async.

**Done when:** `grep -n "either" jeeves/packages/spec/src/studio-links.ts` prints nothing and all
five checks pass.
**Commit:** `PF03: remove direct async links`.

### PF04 — Retire the strict-contract surface: web app and default study (D3, D4)

**Goal:** the web app shows nothing of the strict-contract layer, and New project preselects
the TinyURL study. Spec code is untouched.
**Checks:** check, e2e, build, mouse. **Exported files this unit may change:** none.

**Do not edit** anything under `jeeves/packages/spec/src/` or `jeeves/apps/server/` except
`studio-examples/index.ts` and the test files named in step 4.

**1. Delete four unused files** (nothing imports them; confirm with
`grep -rn "DesignScopeForm\|OwnershipForm\|OperationsForm\|ResolveFields" jeeves/apps/web/src`,
which must list only these files and each other):
`jeeves/apps/web/src/studio/DesignScopeForm.tsx`, `OwnershipForm.tsx`, `OperationsForm.tsx` and
`ResolveFields.tsx`. Keep `OperationChanges.tsx` and `OwnershipChanges.tsx`: removal previews
use them.

**2. `jeeves/apps/web/src/canvas/SourceDiagnostics.tsx`.**

- Remove `<ReadinessReport …/>`, `<OperationsSummary …/>` and the whole
  `<details>` whose summary is `Profile & requirements`.
- Remove the `selectedOperation` prop and the imports that become unused.
- Replace the paragraph's text with:
  `Saved schema v{design.schemaVersion} · revision {design.revision}. Read-only: the saved source, and who owns and may read each store.`
- The dialog then holds, in this order: that paragraph, **Download source JSON**, the ownership
  summary, and **Full saved source**.

Then delete `jeeves/apps/web/src/studio/ReadinessReport.tsx` and `OperationsSummary.tsx`, with
their test files if they exist. In `Workspace.tsx` stop passing `selectedOperation`, and remove
only code that TypeScript or Biome then reports as unused.

**3. `jeeves/packages/spec/src/studio-examples/index.ts`.**

- `DEFAULT_STUDIO_EXAMPLE_ID = TINYURL_STUDIO_EXAMPLE.id`.
- `studioArchitectureExamples` holds three items, in this order: the TinyURL item exactly as it
  is now (keep its name `TinyURL · extended study (design only)`), `MARKETPLACE_STUDIO_EXAMPLE`,
  `YOUTUBE_STUDIO_EXAMPLE`.
- Keep the `studioArchitectureExample` switch as it is, with its foundation case, and keep
  `tinyurl-foundation.ts`.

**4. Tests.**

| File | Do |
| --- | --- |
| `jeeves/apps/web/e2e/design-scope.spec.ts`, `foundation.spec.ts`, `operations.spec.ts`, `readiness.spec.ts`, `resolve.spec.ts` | Delete the file |
| `jeeves/apps/web/e2e/operations.ts` | Delete it if `grep -rn "operations.ts" jeeves/apps/web/e2e` then finds no importer |
| `jeeves/apps/web/e2e/ownership.spec.ts`, `ownership.ts` | Keep. Change only selectors or texts this unit changed. If it needs more, stop (rule 2). |
| `jeeves/apps/web/e2e/detailed-view.spec.ts` | Delete the one test titled `the TinyURL foundation, which has no modules: its services are containers holding just the +` |
| `jeeves/apps/web/e2e/diagram-export.spec.ts`, the test that calls `createStudy(page, "E2E PNG owner")` | It needs the foundation design. Add `createFoundation(page, name)` to `jeeves/apps/web/e2e/studio.ts`: it creates a project through the API, posts `studioStudySeedOperations(studioArchitectureExample("studio-tinyurl-foundation").design)` as one batch with base revision 0 (copy the request shape from an existing e2e helper: `grep -rn "/operations" jeeves/apps/web/e2e`), opens `/?project=<id>` and returns the ID. Use it in that test only. |
| `jeeves/packages/spec/src/studio-examples/foundation.test.ts`, `jeeves/apps/server/src/routes/foundation.test.ts`, `jeeves/apps/web/src/project/create-example.test.ts` | Where a test uses `DEFAULT_STUDIO_EXAMPLE_ID` (or `DEFAULT_EXAMPLE_ID`) to get the **foundation** design, write the literal `"studio-tinyurl-foundation"`. Where it asserts what the default is, expect `"studio-tinyurl"`. Change nothing else in them. |
| Any other test that counts the chooser's studies as four, or expects the foundation in `studioArchitectureExamples` | Expect three studies without it |

Update the comment in `jeeves/apps/web/e2e/studio.ts` that mentions `foundation.spec.ts`.

**5. Docs.**

- `docs/studio.md`: delete the paragraph that begins `Open **Export diagram → Source &
  diagnostics → Compatibility report**`. In `## Projects`, the study list is the TinyURL study
  (the default), the marketplace study and the YouTube study. Delete the sections
  `## Profile and requirements`, `## The TinyURL foundation study` and
  `## Named API operation responsibilities`. Replace the body of
  `## Logical owners, roles and access` with:
  `Module commands derive who owns each store and who may read it; generation reads that. **Export diagram → Source & diagnostics** shows it read-only, with the saved source. Removal previews still name the declarations a removal affects, and one Undo restores them.`
- Move two files with `git mv`: `docs/studio-contracts.md` and `docs/studio-readiness.md` go to
  `docs/archive/`. In `docs/studio-settings.md`, `docs/studio-blueprint.md` and `jeeves/PLAN.md`,
  repoint each link to them at `archive/…` (relative to the linking file).
- `jeeves/CATALOG.md`: delete the sections `## Persistent behavior scope`,
  `### Finite Create link contract (NC03)`, `### Finite Resolve link and positive cache (NC04)`
  and `### Exact snapshot compatibility report (NC05)`. In `## Studies`, delete the TinyURL
  foundation paragraph, say three studies, and mark the TinyURL study as the default. Add this
  section before `### Experimental local-v2 video composition`:

````markdown
### Legacy declarations

A schema-3 design may carry `scope`, `operations` and cache-policy declarations from the retired
strict-contract work (NC01–NC14, 2026-11-07). They are still parsed, validated and exported in
blueprint 3, and no studio or chat surface edits them. The TinyURL foundation study
(`studio-tinyurl-foundation`) is no longer offered; projects made from it still open. Details:
[contracts](../docs/archive/studio-contracts.md) and [readiness](../docs/archive/studio-readiness.md).
````

- `jeeves/PLAN.md`, `## Data model`: the studies offered are TinyURL v3.2 (the default), the
  marketplace and YouTube.

**Mouse check:** New project → Architecture study has **TinyURL · extended study (design
only)** preselected and lists three studies. Create it: the TinyURL study renders. Export
diagram → Source & diagnostics shows the four things in step 2 and nothing else.

**Done when:** the four checks pass, and
`grep -rn "ReadinessReport\|OperationsSummary\|DesignScopeForm" jeeves/apps/web/src` prints
nothing.
**Commit:** `PF04: retire strict-contract surface in the web app`.

### PF05 — Retire the strict-contract surface: chat (D3)

**Goal:** chat has 11 tools, and neither its tools nor its context mention scope, operation
contracts, readiness reports or ownership declarations. Chat still does exactly what the mouse
can.
**Checks:** check, e2e, build, evals, mouse. **Exported files this unit may change:** none.

**Do not edit** `jeeves/packages/spec/src/` (tests included) or `jeeves/apps/web/src/`.

**1. `jeeves/apps/server/src/chat/tools.ts`.**

- Remove these five tools completely (schema, description, handler, any state fields and
  helpers only they use, and their names in `isWorkspaceMutation`): `configureDesignScope`,
  `configureOwnership`, `describeOperation`, `configureOperations`, `readReadiness`.
- In `designSummary`, remove these properties and the code only they use: `readiness`,
  `persistentScope`, `availableProfileDefault`, `declaredOperations`, `operationFindings`,
  `availableOperations`, `availableCachePolicies`, `declaredOwnership`, `ownershipFindings`,
  `ownershipMeaning`. Keep everything else, including each link's `declaredAccess` and
  `accessNote`.
- In `turnContext`, remove the sentence about selected operation bindings (from
  `\nSelected operation bindings` to the end of the string). Keep the rest.
- Keep `validateDesign`, `declareReviewScope`, `reviewDesign`, the `notSpecified` count and
  every other tool as they are.
- In the instructions and the remaining tool descriptions, remove any mention of the five
  removed tools (`grep -n "configureDesignScope\|configureOwnership\|describeOperation\|configureOperations\|readReadiness" jeeves/apps/server/src`
  must end with matches only in tests you are about to change, then none).

**2. Tests.** In `jeeves/apps/server/src/chat/chat.test.ts`, `tools.test.ts`,
`openai-tools.test.ts` and `jeeves/apps/server/src/routes/foundation-chat.test.ts`,
`operation-contracts.test.ts`, `resolve-contracts.test.ts`, `readiness.test.ts`,
`ownership.test.ts` (the test files that name a removed tool):

- delete each test that calls a removed tool or asserts a removed `designSummary` property;
- delete a file when no test is left in it;
- the expected tool list has 11 names, in the order `toolDefinitions()` returns them, and
  `expect(requests[0]?.tools).toHaveLength(16)` becomes `11`;
- change no other test.

Add one test to `tools.test.ts`: the names from `toolDefinitions()` include none of the five,
and `JSON.stringify(designSummary(<any study's design>, []))` contains none of `"readiness"`,
`"persistentScope"`, `"declaredOperations"` and `"declaredOwnership"`.

**3. Docs.**

- `docs/studio.md`, Chat: in the `getDesign` row delete `; and the scope, ownership and
  operation declarations the configure tools edit`. Say chat has eleven tools where a count is
  given.
- `docs/chat-tool-schemas.md`: remove the five tools. Leave size figures as they are and add
  `(before PF05 removed five tools)` after them, unless a test prints the new sizes.
- `docs/chat-evals.md`: add at the end of `## Design evals 2.0.0 (V3-19)`:
  `Since PF05 chat has eleven tools, so the recorded V3-19 live reports no longer replay: their requests differ. They stay as the record of that run.`
- `jeeves/CATALOG.md`, `## Explicit logical authority and access`: delete the words that name
  the `configureOwnership` chat tool.

**Mouse check:** open the TinyURL study, open the chat rail, and confirm it renders with its
input. (The scripted chat turns in `blueprint-chat.spec.ts` are the functional check.)

**If `pnpm eval:chat` fails a threshold,** stop as in rule 2 and report the scores it printed.

**Done when:** the five checks pass and the grep in step 1 prints nothing.
**Commit:** `PF05: retire strict-contract tools in chat`.

---

## Phase C — Sturdier templates

All template files are under `jeeves-generator/templates/local-v2/assets/`. The code that
writes each process file is in `jeeves-generator/src/v2/` (`tile-processes.ts`,
`http-wiring.ts`, `loop-wiring.ts`). Tests are beside them (`*.test.ts`); add each new test to
the existing file that already tests the same template (find it with `grep -rln`).

### PF06 — Every failure is logged

**Goal:** when a generated process survives a failure, it writes one JSON line saying what
failed and why. When startup fails, it says why.
**Checks:** check, e2e, build.
**Exported files this unit may change:** `src/runtime/tile-process.ts`, `src/runtime/http.ts`,
`src/runtime/process.ts`, `src/runtime/outbox.ts`, `src/runtime/asset-worker.ts` and
`src/processes/*.ts`.

**1. The pin updater (rule 7 needs it).** Create
`jeeves-generator/src/v2/fixtures/update-processes-off.ts`:

```ts
import { writeFileSync } from "node:fs";
import { loadLocalV2Registry } from "../../../templates/local-v2/index.ts";
import { offDesigns, offPin } from "./processes-off.ts";

const registry = loadLocalV2Registry();
const pins = Object.fromEntries(
  Object.entries(offDesigns(registry)).map(([name, designJson]) => [
    name,
    offPin(designJson, registry),
  ]),
);
writeFileSync(
  new URL("./processes-off.json", import.meta.url),
  `${JSON.stringify(pins, null, 2)}\n`,
);
console.log(Object.fromEntries(Object.entries(pins).map(([name, pin]) => [name, pin.files])));
```

Add to `jeeves-generator/package.json` scripts:
`"pins:update": "tsx src/v2/fixtures/update-processes-off.ts"`. Run it once now, before any
template change, then `pnpm format`: `git diff --stat jeeves-generator/src/v2/fixtures/processes-off.json`
must show no change. If it shows one, stop (rule 2).

**2. `src/runtime/tile-process.ts.template`.** Add:

```ts
/** An error in one line, for a log: its name and message, at most 300 characters. */
export function describeError(error: unknown): string {
  return (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300);
}
export type FailureLog = (what: string, error: unknown, extra?: Record<string, unknown>) => void;
/** One JSON line for a failure the process survives, at most once a second per `what`. */
export function createFailureLog(tile: string): FailureLog {
  const log = createProcessLog(tile, "error", "failure");
  return (what, error, extra = {}) => log(what, { what, error: describeError(error), ...extra });
}
```

A line looks like
`{"level":"error","event":"failure","tile":"watch-api","what":"request GET /modules/x/:key","error":"TypeError: …"}`.

**3. `src/runtime/http.ts.template`.** `createHttpService` takes one more optional option,
`onFailure?: (what: string, error: unknown) => void`. In `setErrorHandler` (use its request
argument), call `options.onFailure?.(`request ${request.method} ${request.routeOptions?.url ?? "unmatched"}`, error)`
before replying when:

- the error is an `HttpError` with `statusCode >= 500` and `statusCode !== 501`; or
- the error is not an `HttpError` and is not one of the client errors 400, 413 and 415.

The answers themselves don't change.

**4. `src/runtime/process.ts.template`.**

- In `runProcess`'s `catch`, bind the error and, before the existing
  `console.error("Application startup failed")`, write
  `console.error(JSON.stringify({ level: "error", event: "startup-failed", error: <name: message, at most 300 characters> }))`.
  Keep the existing line.
- `periodic` takes a fourth optional parameter, `onFailure?: (error: unknown) => void`. Its
  `.catch` calls it inside a `try`/`catch` that ignores what `onFailure` throws.

**5. `src/runtime/outbox.ts.template`.**

- `relayBatch` returns `{ selected, sent, deferred, errors }`, where `errors` is every error
  caught in the per-row `catch` (bind the error there), in order.
- In `startRelay`'s `tick`, after a batch resolves, call `options.onError?.(error)` for each of
  its `errors`, inside the same guard that protects the existing `onError` call.

**6. Wiring** (`jeeves-generator/src/v2/`). Every process file that the wiring writes:

- creates `const failure = createFailureLog(config.tile);` once, importing it from
  `../runtime/tile-process.ts`;
- passes `onFailure: failure` to `createHttpService`;
- passes `{ onError: (error) => failure("outbox relay jobs", error) }` as `startRelay`'s fourth
  argument in the multipart wiring, and makes the lifecycle's publication relay report through
  `failure("outbox relay publication", error)`;
- passes `(error) => failure("sweep <module id>", error)` as the fourth argument of every
  `periodic(` call it writes.

**Tests** (add to the existing files):

1. `createHttpService` with `onFailure`: a handler that throws `new Error("boom")` answers 503
   and calls `onFailure` once with `request GET <its route>`; an `HttpError(404, …)` doesn't
   call it; an `HttpError(503, "OVERLOADED", …)` does; a 501 doesn't.
2. `periodic` with a rejecting effect calls `onFailure` with that error and keeps ticking.
3. `relayBatch` whose codec throws for one row returns that error in `errors` and still defers
   the row; `startRelay` passes it to `onError`.
4. `createFailureLog("t")("x", new Error("y"))` writes one line with `"event":"failure"`,
   `"what":"x"` and `"error":"Error: y"`, and a second call within a second writes none.
5. A wiring test: the exported `src/processes/<id>.ts` of an HTTP tile contains
   `createFailureLog(config.tile)` and `onFailure: failure`.

**Docs.** `jeeves-generator/README.md`, under Runnable processes: add the `failure` line, its
fields and the five things that write it (a failed request, a failed sweep, a failed outbox
relay, and the `startup-failed` line). `docs/template-gaps.md`: gap 3's Status becomes
`Open: still retried for ever, now logged (PF06)`.

**Commit:** `PF06: log every failure`.

### PF07 — The cache read recovers

**Goal:** after the cache stalls or disconnects, the Cache read template uses the database for
a short time and then uses the cache again, and says so in the log.
**Checks:** check, e2e, build.
**Exported files this unit may change:** `src/runtime/positive-cache.ts`,
`src/runtime/valkey.ts` and `src/processes/*.ts`.

**1. `src/runtime/positive-cache.ts.template`** (`createPositiveReader`).

- Replace `let usable = !!cache;` with `let skipUntil = 0;`.
- When a phase passes its 150 ms deadline, set `skipUntil = Date.now() + 5000` (it set
  `usable = false`).
- Use the cache when `cache && Date.now() >= skipUntil` (it tested `cache && usable`), in both
  places.
- Change nothing else: the 150 ms bound, the single flight per key, the absolute expiry and
  "null is never cached" stay.

**2. `src/runtime/valkey.ts.template`** (`createValkeyCache`).

- New optional option:
  `onState?: (state: "available" | "unavailable", error?: unknown) => void`.
- Keep the 500 ms connect bound, the 150 ms command bound, `disableOfflineQueue: true` and
  `reconnectStrategy: false`.
- The client is created by an inner function, so a new one can replace it.
- When the client becomes unusable (the first connect fails, an `error` event, or a command
  that times out or rejects), destroy it, call `onState("unavailable", error)` once for that
  change, and start one timer of 5000 ms if none is pending.
- When the timer fires, create a new client and connect it within 500 ms. On success it becomes
  the client in use, and `onState("available")` is called. On failure, start the timer again.
- The returned `close()` clears the timer, destroys the client in use and prevents any further
  reconnect.
- `get` and `set` still reject with `Error("Cache unavailable")` while there is no usable
  client.

**3. Wiring.** Where the wiring writes `createValkeyCache({ binding: … })`, add:

```ts
onState: (state, error) =>
  state === "unavailable"
    ? failure("cache <module id>", error ?? new Error("Cache unavailable"))
    : console.log(JSON.stringify({ level: "info", event: "cache", tile: config.tile, module: "<module id>", state })),
```

with the lead module's ID written in place of `<module id>`.

**Tests** (in `positive-cache.test.ts`, with fake timers):

1. Replace the expectation commented `Disabled after the stalled phase`: after a stalled read,
   a second read within 5 s doesn't call the cache; a read 5 s later calls it again.
2. After an `error` event the next `get` rejects with `Cache unavailable`, and `onState` was
   called with `unavailable`. 5 s later a new client is created and connected, `onState` is
   called with `available`, and `get` resolves.
3. A reconnect that fails is tried again 5 s later.
4. After `close()`, advancing time creates no client.

**Docs.** `jeeves-generator/README.md`, the Cache reader bullet: say it reads the database
while the cache is down and reconnects every 5 s. `docs/template-gaps.md`: the cache limit's
Status becomes `Fixed in PF07`. `jeeves/CATALOG.md`: no change.

**Commit:** `PF07: cache read recovers`.

### PF08 — One bad item never stops a process

**Goal:** a hook that throws while the Transcoder reports a failure, or an upload whose
completion keeps failing, no longer stops a process or blocks its start (template gaps 5 and 2).
**Checks:** check, e2e, build.
**Exported files this unit may change:** `src/runtime/media-worker.ts`,
`src/runtime/multipart.ts` and `src/processes/*.ts`.

**1. `src/runtime/media-worker.ts.template` (gap 5).**

- Split `emit` in two. `encode(job, event)` calls the two hooks and returns `{ id, wire }`:
  `id` is `messageId(options.codecs.eventId(job, event.kind))`, and `wire` is what
  `options.codecs.event` returns for the event with `eventId: id` and `occurredAt`. `emit` calls
  `encode`, then checks the publisher and publishes, as now.
- In `onTerminal`, after the existing `abort` check: call `encode` for the `failed` event
  inside `try`/`catch`. If it throws, `return` (add the comment
  `// A hook that throws while reporting a failure must not stop the worker.`). Otherwise check
  the publisher and publish, as `emit` does.
- So the delivery runner still moves the message to its `.failed` queue with its code, and the
  worker keeps consuming.

**2. `src/runtime/multipart.ts.template` (gap 2).**

- `sweep()` resolves to `{ failed: { uploadId: string; error: unknown }[] }`.
- In its first loop (durable cleanup) and its second loop (interrupted uploads), wrap the body
  of each iteration in `try`/`catch`. A caught error is pushed to `failed` with that row's
  upload ID, and the loop continues with the next row.
- The third part (unfinished provider uploads) is unchanged and may still throw.
- Update every caller of `sweep()` (`grep -rn "sweep()" jeeves-generator`).

**3. Wiring.** Where the wiring writes the multipart's start and its periodic sweep:

- at start: `for (const item of (await <name>.multipart.sweep()).failed) failure("sweep <module id>", item.error, { upload: item.uploadId });`
- every 30 s: the same loop inside the `periodic` effect, keeping PF06's fourth argument.

**Tests.**

1. Media worker: with `codecs.event` throwing for kind `failed`, a job that fails for good is
   republished to the failed queue with its `x-terminal-code` and acknowledged; `closed` has not
   resolved; the next message is handled.
2. Multipart: with two interrupted uploads where the first one's completion throws a plain
   `Error`, `sweep()` resolves, `failed` holds the first upload's ID and error, and the second
   upload was completed.
3. A wiring test: the exported upload process contains `.sweep()).failed`.

**Docs.** `jeeves-generator/README.md`: say both behaviours where the Video HLS loop and the
Multipart sweep are described. Read `asset-lifecycle.ts.template` for what then happens to a
video whose failure report was skipped (search it for `deadline`) and state that in one
sentence; if you can't tell, write `Its state is then left to the lifecycle.` `docs/template-gaps.md`:
gaps 2 and 5 become `Fixed in PF08`.

**Commit:** `PF08: one bad item never stops a process`.

---

## Phase D — Regeneration

### PF09 — Plan an update of an existing export

**Goal:** a pure function decides, file by file, what regenerating into an existing directory
does. It writes nothing.
**Checks:** check, e2e, build. **Exported files this unit may change:** none.

Create `jeeves-generator/src/update.ts` and export it from `src/index.ts`.

```ts
export type UpdateActionKind =
  | "create" | "replace" | "unchanged"   // generated files
  | "keep" | "keep-changed"              // the application's own files
  | "override"                           // a generated file the application declared as its own
  | "remove" | "orphan"                  // files the new export no longer has
  | "edited";                            // a generated file edited by hand: refuses the update
export type UpdateAction = { path: string; action: UpdateActionKind };
export type ManifestFile = { path: string; sha256: string; ownership: string };
export function planUpdate(input: {
  /** The new export's files, each with its ownership from the new manifest. */
  next: readonly ManifestFile[];
  /** The files of the manifest already in the directory. */
  previous: readonly ManifestFile[];
  /** SHA-256 of each file now on disk, for every path in `next` or `previous` that exists. */
  disk: ReadonlyMap<string, string>;
  /** Generated paths the application keeps as its own. */
  overrides: readonly string[];
}): { actions: UpdateAction[]; refused: string[]; shadows: string[] };
```

`ownership` is `generated-extension` for the application's own files (hook files, stub bodies,
product SQL). Every other value (`generated-scaffold`, `generator-metadata`) is **generated**.
Below, `D` is the path's hash on disk (or absent), `N` its hash in `next`, and `V` its hash in
`previous` (or absent).

**For each path in `next`:**

| Ownership | Condition, first match wins | Action |
| --- | --- | --- |
| generated | `D` absent | `create` |
| generated | `D == N` | `unchanged` |
| generated | path is in `overrides` | `override` |
| generated | `V` present and `D == V` | `replace` |
| generated | otherwise | `edited` |
| extension | `D` absent | `create` |
| extension | `D == N` | `unchanged` |
| extension | `V` present and `V == N` | `keep` |
| extension | otherwise | `keep-changed` |

**For each path in `previous` that is not in `next`:**

| Previous ownership | Condition, first match wins | Action |
| --- | --- | --- |
| any | `D` absent | no action |
| extension | — | `orphan` |
| generated | `D == V` | `remove` |
| generated | path is in `overrides` | `orphan` |
| generated | otherwise | `edited` |

**Also:**

- `refused` lists every `edited` path, then `unknown override: <path>` for each override that is
  a generated path in neither `next` nor `previous`.
- `shadows` lists every `override` and `keep-changed` path: the caller writes the new generated
  bytes for these to `.jeeves/generated/<path>`.
- `actions` is sorted by path. The function never throws for these inputs and reads nothing
  from disk.

**Tests** (`jeeves-generator/src/update.test.ts`): one case per table row (fourteen), the two
`refused` forms, `shadows`, and the sort order.

**Commit:** `PF09: plan an update of an existing export`.

### PF10 — `update:v2`: regenerate into an existing app (D5)

**Goal:** one command regenerates an export in place: generated files are rewritten, the
application's own files are kept, and a hand-edited generated file refuses the update.
**Checks:** check, e2e, build. **Exported files this unit may change:** none.

**1. `jeeves-generator/src/update.ts`:** add
`updateDirectory(bundle, directory, options: { check: boolean })`, where `bundle` is what
`assembleV2` returns. It:

1. Requires `directory` to be an absolute path to an existing real directory (not a symlink)
   that holds `.jeeves/manifest.json` whose `format` is `jeeves-v2-manifest-v1`. Otherwise it
   throws `Not a Jeeves v2 export: <directory>`.
2. Reads `.jeeves/overrides.json` if it exists. Its shape is
   `{ "overrides": [{ "path": "compose.yaml", "reason": "…" }] }`; each `reason` must be a
   non-empty string, else it throws `Invalid .jeeves/overrides.json`.
3. Builds `next` from `bundle.manifest.files` and `previous` from the directory's manifest,
   hashes the files on disk, and calls `planUpdate`.
4. If `refused` is not empty, or `options.check` is true: writes nothing.
5. Otherwise, in this order:
   - deletes the directory `.jeeves/generated/` if it exists;
   - writes each `create` and `replace` file (making parent directories; refusing a target or
     parent that is a symlink);
   - deletes each `remove` file;
   - writes each `shadows` path's new bytes to `.jeeves/generated/<path>`;
   - writes `.jeeves/manifest.json` last, from the bundle.
6. Returns `{ directory, check, refused, counts: { create, replace, unchanged, keep }, keepChanged, override, remove, orphan }`,
   where the last four are path lists.

It never touches a file that is in neither manifest.

**2. CLI.** Create `jeeves-generator/src/v2/update-cli.ts`, modelled on `src/v2/cli.ts`:

- usage: `pnpm --filter @jeeves/generator update:v2 /path/design.json /absolute/existing-directory [--check]`;
- it assembles with `loadLocalV2Registry()`, calls `updateDirectory`, prints the result as JSON,
  and sets `process.exitCode = 1` when `refused` is not empty;
- add `"update:v2": "tsx src/v2/update-cli.ts"` to `jeeves-generator/package.json`.

**Tests** (`update.test.ts`, in a temporary directory under the OS temp directory, removed
afterwards). Export the stub stack (`stubStackDesign()`, as `processes-off.ts` builds it) with
`exportNewDirectory`, then:

1. Update with the same design: every action is `unchanged`, and no file's bytes change.
2. Edit one stub body. Delete one scaffold file. Change a second scaffold file's bytes, and set
   that path's `sha256` in the directory's `.jeeves/manifest.json` to the hash of the changed
   bytes (this stands for an older export). Update with the same design: the stub body is kept
   byte for byte (`keep`), the deleted file is back (`create`), and the second file again
   equals the generated bytes (`replace`).
3. Edit one scaffold file, then update: `refused` names it, and no file on disk changed.
4. The same, with that path in `.jeeves/overrides.json`: the update succeeds, the edited file is
   kept, its action is `override`, and `.jeeves/generated/<path>` holds the new generated bytes.
5. `check: true` writes nothing.
6. A directory with no manifest throws `Not a Jeeves v2 export`.

**Docs.**

- `jeeves-generator/README.md`: add `## Updating an existing export` after
  `## Preserving work and remaining export work`, with the command, the two tables' meaning in
  plain words (what is rewritten, what is kept, what refuses), `.jeeves/overrides.json`,
  `.jeeves/generated/` and `--check`. Add the command to `## Current state`.
- `docs/studio.md`, Experimental project export: one sentence that the ZIP is for a new
  directory and `update:v2` regenerates into an existing one.
- `docs/glossary.md`: add rows **Override** (a generated file the application keeps as its own,
  listed in `.jeeves/overrides.json` with a reason; each one is a template gap) and **Update**
  (regenerating into an existing export with `update:v2`).

**Commit:** `PF10: update an existing export in place`.

---

## Phase E — Proof

Docker rules for PF11–PF13:

- Work in a copy **outside** the checkout (your scratch directory), never in place.
- Before anything else, record the owner's containers, volumes and networks
  (`docker ps -a --format '{{.Names}}'`, `docker volume ls -q`, `docker network ls -q`), and
  compare at the end: only yours may have come and gone.
- Use the Compose project name and ports your unit gives. If a port is in use, add 10 to all
  three and say so. Never touch the owner's stacks, volumes or images.
- At the end run `docker compose --profile '*' down --volumes --remove-orphans` with the same
  environment, remove your two images (`<project>-app`, `<project>-media`), and delete the copy
  with its `.runtime`.

### PF11 — YouTube v4: v3 regenerated onto the new templates

**Goal:** v3's completed app takes the new templates through `update:v2`, with every hook file
kept, and still builds and passes its tests. No Docker stack is started.
**Checks:** check (the Biome config changes).

**Steps.**

1. `mkdir -p field-projects/youtube/v4/inputs field-projects/youtube/v4/notes`. Copy
   `field-projects/youtube/v3/inputs/design.json` and `blueprint.json` into `v4/inputs/` with
   `cp`. `sha256sum field-projects/youtube/v4/inputs/design.json` must print
   `9762df418108917c71f42de6190c3c756d1db62dbaeca83653b6e9b6db93813f`. If not, stop (rule 2).
2. `pnpm --filter @jeeves/generator export:v2 "$PWD/field-projects/youtube/v4/inputs/design.json" "$PWD/field-projects/youtube/v4/generated"`.
   It must report 0 findings.
3. `mkdir field-projects/youtube/v4/app` and fill it with exactly v3's tracked files:
   `git archive HEAD:field-projects/youtube/v3/app | tar -x -C field-projects/youtube/v4/app`.
4. Create `field-projects/youtube/v4/app/.jeeves/overrides.json`:

```json
{
  "overrides": [
    { "path": ".gitignore", "reason": "Ignores the built browser (template gap 8)." },
    { "path": "compose.yaml", "reason": "The edge mounts the built browser (template gap 8)." },
    { "path": "infra/edge/nginx.conf", "reason": "The edge serves the browser at / (template gap 8)." },
    { "path": "package.json", "reason": "first-run and start build the browser first (template gap 8)." }
  ]
}
```

5. Run `pnpm --filter @jeeves/generator update:v2 "$PWD/field-projects/youtube/v4/inputs/design.json" "$PWD/field-projects/youtube/v4/app" --check`
   and save its output.
   - If `refused` lists only `src/modules/dependencies.ts` and/or
     `src/runtime/module-clients.ts`: copy each from `v4/generated/` over `v4/app/`, and run the
     check again.
   - If `refused` lists anything else, stop (rule 2).
6. Run the same command without `--check`. Save its output as
   `field-projects/youtube/v4/notes/update.json`. Expected: `refused` is empty; `override` lists
   the four paths; every `.hooks.ts` file, both stub bodies, `video-contract.ts` and every
   product SQL file are byte for byte v3's. Confirm with
   `git diff --no-index --stat field-projects/youtube/v3/app/src/modules field-projects/youtube/v4/app/src/modules`:
   it must list no `.hooks.ts` file, neither stub body and not `video-contract.ts`.
7. For each of the four override paths, compare `v4/app/.jeeves/generated/<path>` with
   `v3/generated/<path>` (`cmp`). If they are equal, do nothing. If one differs, the generated
   file changed: copy the new generated file over the app's, then re-apply v3's one edit to it
   exactly as `field-projects/youtube/v3/notes/custom-paths.md` describes that path.
8. Copy `v4/app` to your scratch directory and run there:
   `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build`, `node --test "test/*.test.ts"`.
   All must exit 0, with 19 tests passing. If not, stop (rule 2) and report the output.
9. In `tooling/biome.config.json`, add to `files.includes`:
   `"!field-projects/youtube/v4/inputs/**/*.json"`, `"!field-projects/youtube/v4/generated"` and
   `"!field-projects/youtube/v4/app"`.
10. Write `field-projects/youtube/v4/notes/README.md`: what v4 is (v3's design, unchanged, on
    the templates after PF06–PF08; `app/` made by `update:v2` from v3's app); the counts from
    `update.json`; the four overrides and why; how to run it (as v3's notes say, with v4's
    paths); and that the diagrams are v3's. Copy v3's `notes/custom-paths.md` to v4's notes and
    add at its top that `.jeeves/overrides.json` and `.jeeves/generated/` are also new.

**Done when:** steps 1–10 are done and `pnpm check` passes.
**Commit:** `PF11: youtube v4 regenerated from v3`.

### PF12 — Run v4: acceptance by API, then two copies

**Goal:** record whether v4 works as v3 did, and whether it still works with two copies of
every process. **Change no code.** If a step fails, record exactly what happened and go on to
the next step; PF14 ranks the failures.
**Checks:** none (evidence and notes only).
**Project and ports:** `COMPOSE_PROJECT_NAME=jeeves-pf12`, `LOCAL_HTTP_PORT=45800`,
`LOCAL_IDENTITY_PORT=45801`, `LOCAL_OBJECT_PORT=45802`.

**Setup.**

1. Copy the app: `git archive HEAD:field-projects/youtube/v4/app | tar -x -C <scratch>/app`.
2. In the copy: `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build`,
   `pnpm first-run`, `node scripts/accounts.mjs`. Expect 15 healthy containers.
3. Extract `docs/plans/youtube-v3/evidence/v3-17/operator-harness.tar.gz` into your scratch
   directory. Read its `env.sh` and `harness/lib.mjs`; set the project and ports in your copy
   of `env.sh`. Its `harness/` scripts sign in and call the API. If a harness script fails for
   a reason that isn't the app's behaviour, write your own small script for that step from the
   route table in `field-projects/youtube/v3/notes/README.md`, and keep it in the evidence.
4. The media: `field-projects/youtube/v1/app/.runtime/media/youtube-v1-fixture.mp4`, copied
   read only.

**Part A — one copy of each process.** Record each as Observed or Failed, with the status codes.

| Step | Do | Expect |
| --- | --- | --- |
| A1 | Sign in as `creator` and as `viewer`; call each tile's `…/me` | Both tokens work; Watch's `me` without a token is `{"signedIn":false}` |
| A2 | As `creator`, upload the fixture in parts and complete it; poll Watch's details every 2 s for up to 120 s | 404 until ready, then 200 |
| A3 | Read the details twice, signed out | 200 twice; the key `ready-video:v1:<videoId>` then exists in the cache (`docker compose --profile '*' exec cache-hot-metadata valkey-cli -a "$(cat .runtime/secrets/cache-hot-metadata)" EXISTS <key>` prints 1) |
| A4 | Send one play (`{eventId}`), read the count, send the same event ID again, read the count | 202 twice; the count is `"1"` both times |
| A5 | Search for a word of the title | 200 with that video as a hit |
| A6 | As `viewer`: add, check, list and remove the favorite; then add without a token | 200, 200, the item listed, 204; 401 |

**Part B — two copies.** Run this one command, with the same environment. It names the eight
services so that no setup job runs again:

```sh
docker compose --profile application up -d --no-recreate --no-deps \
  --scale app-watch-api=2 --scale app-upload-api=2 --scale app-search-api=2 \
  --scale app-account-api=2 --scale app-video-lifecycle=2 --scale app-view-counter=2 \
  --scale app-search-indexer=2 --scale app-transcoder=2 \
  app-watch-api app-upload-api app-search-api app-account-api \
  app-video-lifecycle app-view-counter app-search-indexer app-transcoder
```

Wait until `docker compose --profile '*' ps` shows every container healthy (up to 180 s).

| Step | Do | Expect |
| --- | --- | --- |
| B1 | Repeat A3, A5 and A6 twenty times each | Every answer as in Part A |
| B2 | `docker stop jeeves-pf12-app-watch-api-1`; wait 11 s; read the details 20 times. Start it; stop `…-watch-api-2`; wait 11 s; read 20 times. Start it. | 200 every time |
| B3 | Send 50 plays with 50 new event IDs, then send each again; wait 5 s; read the count | It rose by exactly 50 |
| B4 | Upload the fixture again as a second video and wait for ready | It becomes ready; search finds it once; `published.videos` has exactly one row for it |

**Record.** Write `field-projects/youtube/v4/notes/scenarios.md`: the two tables with a Verdict
column and what was seen. Put raw outputs under
`docs/plans/production-foundations/evidence/pf12/` (gzip anything over 100 KB), with a
`README.md` that lists them. Then clean up as the Docker rules say.

**Commit:** `PF12: run v4 with one and two copies`.

### PF13 — Run v4: faults and a throughput sample

**Goal:** record what v4 does when the cache, the broker and a worker stop, and how fast one
read path answers. **Change no code.** Record failures and go on, as in PF12.
**Checks:** none (evidence and notes only).
**Project and ports:** `COMPOSE_PROJECT_NAME=jeeves-pf13`, ports 45810, 45811 and 45812.

**Setup:** as PF12's setup, then upload the fixture once and wait for ready (video **A**).
Then scale two services to 2, in PF12's form:
`docker compose --profile application up -d --no-recreate --no-deps --scale app-watch-api=2 --scale app-view-counter=2 app-watch-api app-view-counter`.

**F3's fallback.** If you can't catch the `processing` state in three tries, run the simpler
form instead and say so: stop the transcoder, complete the upload, wait 10 s, start the
transcoder. The expectation is the same.

| Step | Do | Expect |
| --- | --- | --- |
| F1a | `docker stop jeeves-pf13-cache-hot-metadata-1`; read A's details 10 times | 200 every time. Each `app-watch-api` container's log has a line with `"event":"failure"` and `"what":"cache watch-api-video-details-cache"` |
| F1b | `docker start` the cache; wait 15 s; delete A's key with `valkey-cli … DEL <key>`; read the details twice | 200 twice; `EXISTS <key>` prints 1; each `app-watch-api` log has `"event":"cache"` with `"state":"available"` |
| F2a | `docker stop jeeves-pf13-local-broker-1`; wait 20 s; list the containers; read the details and search | Record which `app-*` containers exited and which stayed. Details and search are expected to answer or to answer 503: record which. |
| F2b | `pnpm start` (it also returns every process to one copy); send one play for A; read the count | Everything healthy; the count rose by 1 |
| F3 | Upload the fixture as video **C**. As soon as its row in `upload_api_multipart_uploads.assets` has state `processing` (poll every 0.5 s; the harness's `snapshot.sh` and `incontainer.sh` show how V3-17 read that table), `docker kill jeeves-pf13-app-transcoder-1`; wait 5 s; `docker start` it | C becomes ready within 180 s; search finds it once; `published.videos` has one row for it |
| T1 | Scale `app-watch-api` to 2 again (the command in Setup). Run `node reads.mjs http://127.0.0.1:45810/api/watch-api/modules/watch-api-video-details-cache/<A's id> 2000 50` (the script below) three times | `failed` is 0 each time. Record `perSecond`, `p50Ms`, `p95Ms` and `p99Ms`; there is no pass mark for speed. |

`reads.mjs` (keep it in the evidence folder):

```js
const [url, total = "2000", concurrency = "50"] = process.argv.slice(2);
const times = [];
let failed = 0;
let next = 0;
const started = performance.now();
async function worker() {
  while (next < Number(total)) {
    next += 1;
    const at = performance.now();
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (response.status !== 200) failed += 1;
    } catch {
      failed += 1;
    }
    times.push(performance.now() - at);
  }
}
await Promise.all(Array.from({ length: Number(concurrency) }, worker));
const seconds = (performance.now() - started) / 1000;
times.sort((a, b) => a - b);
const at = (p) => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * p))]);
console.log(
  JSON.stringify({
    total: times.length,
    concurrency: Number(concurrency),
    seconds: Number(seconds.toFixed(2)),
    perSecond: Math.round(times.length / seconds),
    p50Ms: at(0.5),
    p95Ms: at(0.95),
    p99Ms: at(0.99),
    failed,
  }),
);
```

**Record.** Add a "Faults and throughput" table to
`field-projects/youtube/v4/notes/scenarios.md`, and raw outputs under
`docs/plans/production-foundations/evidence/pf13/` with a `README.md`. State the machine (CPU
count, memory) beside the T1 numbers, and that they are from one laptop. Clean up as the Docker
rules say.

**Commit:** `PF13: run v4 with faults and a throughput sample`.

---

## Phase F — Review

### PF14 — Independent review

**Goal:** an agent that wrote none of PF01–PF13 checks each unit against this plan and tells the
owner what was delivered, what failed and what to decide next.
**Checks:** check, e2e, build, evals.

1. For each unit PF01–PF13, read its handoff entry and check its **Done when**, its tests and
   its docs against this plan. Rerun each grep the units name.
2. Run the four checks. Run `pnpm --filter @jeeves/generator update:v2 "$PWD/field-projects/youtube/v4/inputs/design.json" "$PWD/field-projects/youtube/v4/app" --check`:
   `refused` must be empty.
3. Sweep the docs for false statements: read `AGENTS.md`, `jeeves/README.md`, `jeeves/PLAN.md`,
   `jeeves/CATALOG.md`, `docs/studio.md` (the sections this plan touched),
   `jeeves-generator/README.md`, `docs/glossary.md` and `docs/template-gaps.md`. Fix a false
   sentence only when the code proves it false; list each fix.
4. Fix a defect only if it is inside one of this plan's units, has a failing test you can write
   first, and needs fewer than 40 changed lines. List everything else as a follow-up.
5. Write `docs/plans/production-foundations/review.md`:
   - an **Owner summary** of at most 12 lines;
   - a table of D1–D8 with Delivered, Partly or Not, and what you saw;
   - PF12's and PF13's failed steps, most serious first, each with the template it points at;
   - follow-ups, most important first, each marked as needing an owner decision or not. Include
     at least: the open rows of `docs/template-gaps.md`; whether a broker loss should keep
     stopping processes; Marketplace as the next field project with the template set frozen
     first; schemas on links;
   - the checks you ran, with counts.

**Commit:** `PF14: review production foundations`.
