# Production foundations: true docs, a smaller surface, sturdier templates, regeneration

**Status:** planned 2026-11-12 from the owner's review of Jeeves after YouTube v3. The owner
confirmed every decision below the same day. Revised on 2026-11-12 after an independent review
([findings](review-findings.md), [response](review-response.md)): every exact string, path, count
and command was checked against the repository at `076d715`, and PF03–PF05's code and tests
were tried on a scratch copy. **Nothing is implemented yet.**
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-12](../../HUMAN_FEEDBACK.md).

There are 14 units, run in order: PF01 → PF14. A coordinator gives each unit to a fresh agent.
That agent does only its own unit on `main` in the primary checkout, commits it and stops.

| Phase | Units | What |
| --- | --- | --- |
| A. Docs | PF01, PF02 | Record the owner's goals; fix stale statements; current-state `PLAN.md` and generator READMEs |
| B. Smaller surface | PF03–PF05 | Remove direct async links and direct calls to a worker; retire the strict-contract surface from the web app and from chat |
| C. Sturdier templates | PF06–PF08 | Every failure is logged; the cache read recovers; one bad item never stops a process |
| D. Regeneration | PF09, PF10 | Update an existing export in place and keep the application's own files |
| E. Proof | PF11–PF13 | YouTube v4: v3 regenerated onto the new templates, then one Docker run: two copies, then faults |
| F. Review | PF14 | Independent review |

## Why

The review (2026-11-12) found:

1. Nothing shows the generated code holds when several copies run or a store fails.
2. An export can only be written to a new directory, so a completed app can't take new templates.
3. Agent-facing docs contain stale statements.
4. A strict-contract layer (units NC01–NC14) that no template uses fills chat's tools, a dialog
   and the docs.
5. The canvas allows two links that generate nothing: a dashed line straight between two
   services, and a direct call to a Worker, whose process has no HTTP listener.

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
- Run every `pnpm` command from the repository root, except PF11–PF13's commands inside an app
  copy in your scratch directory, which run in that copy.
- `grep` may be a shell function in an agent's shell. Run each grep a unit names as written; it
  searches folders only where it says `-r`.
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
  `pnpm db:up && pnpm exec playwright test -c jeeves/playwright.config.ts pfNN-check` (or
  `pnpm test:e2e:docker pfNN-check` if Chromium's system libraries are missing). Save at most 4
  screenshots under `docs/plans/production-foundations/evidence/pfNN/`. Delete the spec file
  before you commit. Delete every project it created.

**7. Export gates.**

- `pnpm check` includes `jeeves-generator/src/v2/assemble.test.ts`, whose test `retains the
  frozen v1 output including its exact manifest` keeps the frozen v1 export byte-identical. If it
  fails, stop as in rule 2.
- `pnpm check` includes `jeeves-generator/src/v2/processes-off.test.ts`, which pins three exports
  (Runnable processes off) by file hash. A unit that edits a template lists "Exported files this
  unit may change". If that test fails:
  1. Save the old pins: `cp jeeves-generator/src/v2/fixtures/processes-off.json "$SCRATCH/pins-before.json"`
     (`$SCRATCH` is your scratch directory).
  2. Run `pnpm --filter @jeeves/generator pins:update` (PF06 adds this command).
  3. List every changed, added and removed pinned path:

     ```sh
     node -e '
     const fs = require("node:fs");
     const [a, b] = process.argv.slice(1).map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
     for (const name of Object.keys({ ...a, ...b })) {
       const x = a[name]?.sha256 ?? {}, y = b[name]?.sha256 ?? {};
       for (const path of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort())
         if (x[path] !== y[path])
           console.log(name, !(path in x) ? "added" : !(path in y) ? "removed" : "changed", path);
     }' "$SCRATCH/pins-before.json" jeeves-generator/src/v2/fixtures/processes-off.json
     ```

     Each listed path must be in your unit's list, or be `.jeeves/manifest.json` or
     `.jeeves/report.json`. If any other path is listed, put the old pins back
     (`cp "$SCRATCH/pins-before.json" jeeves-generator/src/v2/fixtures/processes-off.json`) and
     stop as in rule 2.
  4. Run `pnpm format`, then `pnpm check` again. New pins never excuse another failing test.
  5. List the changed pinned paths in your handoff entry.
- Update the existing result-shape and emitted-string assertions your unit names. Change no other
  assertion to make a check pass.
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
The `@jeeves/generator` workspace. The `local-v2` registry exports a saved schema-3 design as a standalone project: nine templates, typed module stubs and, with Runnable processes on, one process per application tile. The frozen `local-v1` profile is kept for exact legacy snapshot exports (Generate project offers it only for the exact frozen YouTube v1 source, and `export:new` writes it) and regression checks; new module-authored projects use `local-v2`. See its [README](../jeeves-generator/README.md).
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
  is kept for exact legacy snapshot exports and regression checks: Generate project offers it
  only for the exact frozen YouTube v1 source, and `export:new` writes it. New module-authored
  projects use `local-v2`.

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

### PF03 — Remove direct async links and direct calls to a worker (D2, D6)

**Goal:** no line can be drawn or saved as asynchronous unless one end is a Queue or Topic tile,
and a Worker (or an older Notifications tile) is reached only from a Queue or Topic.
**Checks:** check, e2e, build, evals, mouse. **Exported files this unit may change:** none.

**Why the worker rule** (found while planning, after the decisions; it applies D6): a Worker's
process has no HTTP listener, so a direct call to one generates a client that reaches nothing.
Notifications runs as a worker process too (`generation-support.ts`), so it gets the same rule,
including as an action's entry. No study, pinned fixture or field design has such a link, or a
dashed line between two applications (checked on every study, every fixture under
`jeeves/packages/spec/src/fixtures/` and every field design).

**Code, in `jeeves/packages/spec/src/studio-links.ts`:**

1. Delete the constant `either`.
2. In `studioLinkRules`, the three rows `application → application`, `application → external`
   and `external → application` use `...sync` instead of `...either`.
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

5. Directly after the `roleKinds` constant, add:

```ts
/** Application kinds another tile can call directly. A worker (and the older Notifications
 * kind) answers no requests: it takes its work only from a queue or topic. */
const callableKinds: readonly StudioKind[] = applicationKinds.filter(
  (kind) => kind !== "worker" && kind !== "notification",
);
```

6. In `studioLinkRules`, add `targets: callableKinds,` to three rows: `application →
   application`, `external → application` and `cdn → application`. Leave `queue → application`
   as it is, so a queue still feeds a worker.
7. In the `action → application` row, delete `"notification", ` from its `targets`, so they are
   `["service", "redirect", "identity", "billing", "uploads", "gateway"]`.
8. In `pairRefusal`, directly after the `browser` check, add:

```ts
if (target === "worker" || target === "notification")
  return `${Noun(target)} takes its work from a queue or topic. Put one between them.`;
```

**Code, in `jeeves/packages/spec/src/studio-design-review.ts`** (text only; change no logic):

- In the header comment, replace `a dashed line between applications,` + `which the table allows,
  is accepted;` (it wraps after `applications,`) with `a dashed line between applications, or to
  an external API, is flagged too;`.
- In the line-style fallback `fix`, replace `so fix its interaction in Source & diagnostics.`
  with `so no mouse or chat command can redraw it.`
- In the user-reaches-store fallback `fix`, replace `so fix it in Source & diagnostics.` with
  `so no mouse or chat command can do it.` (Source & diagnostics is read-only.)

**Code, in `jeeves/apps/server/src/chat/tools.ts`:** in the `linkTable` preamble, replace
`async is sent without waiting (dashed): through a queue or topic, or a direct async call between
applications where the table allows it.` with `async is sent without waiting (dashed), always
through a queue or topic.`

Change nothing else.

**What must be true afterwards** (each was seen on a scratch copy with exactly this change):

- `linkTiles` or `addTile` with `link: "async"` between two services is refused; the reason ends
  with the sentence in step 4.
- `linkTiles` or `addTile` from a service, an external API or a CDN straight to a Worker or a
  Notifications tile is refused with the sentence in step 8, and no action can enter a
  Notifications tile. After a Queue or Topic, a Worker is still offered.
- On the TinyURL study, `planRemoveTile(design, "click-events")` returns
  `{ ok: true, value: { strands: ["analytics"] } }`: removing the queue no longer links its
  publisher straight to its consumer, so the consumer goes with it.
- A stored design with a direct link into a Worker still opens. `validateDesign` reports
  `LANE_INVALID` with the sentence in step 8; `designReview` gives it no `line-style` finding
  (the table has no row for the pair). No repair is promised.
- A stored design with a dashed link between two services still opens. `validateDesign` reports
  `LANE_INVALID` with the sentence in step 4, and `designReview` reports one `line-style`
  finding. Its redraw commands (`removeLink`, then `linkTiles`) are there only when removing the
  line cuts nothing off; otherwise its fix says no mouse or chat command can redraw it.
- `pnpm eval:chat` exits 0 with the same scripted scores as before. The recorded V3-19 live
  reports (`docs/evals/v3-19/live-*.json.gz`) no longer replay, because their requests carry the
  old link table; `docs/evals/v3-19/scripted.json` still replays.

**Tests.**

- Add to `jeeves/packages/spec/src/studio-lanes.test.ts`:
  1. `studioLinkRefusal("service", "service", "async")`,
     `studioLinkRefusal("service", "external-api", "async")` and
     `studioLinkRefusal("external-api", "service", "async")` each equal the step-4 sentence, with
     `a service`, `an external API` and `a service` as the noun.
  2. `studioLinkRule("service", "service")?.modes` equals `["sync"]`;
     `studioLinkRule("queue", "worker")?.modes` equals `["async"]`;
     `studioLinkRule("service", "worker")`, `studioLinkRule("external-api", "worker")`,
     `studioLinkRule("cdn", "worker")`, `studioLinkRule("service", "notification")` and
     `studioLinkRule("action", "notification")` are `undefined`; and
     `studioLinkRefusal("service", "worker")` equals
     `A worker takes its work from a queue or topic. Put one between them.`
- Add to `jeeves/packages/spec/src/studio-lane-commands.test.ts`:
  3. On the TinyURL study (`studio-tinyurl`), `planRemoveTile(design, "click-events")` returns
     `strands: ["analytics"]`; building `{ type: "removeTile", tile: "click-events", alsoRemove:
     ["analytics"] }` with `buildStudioCommand` and applying it leaves no `analytics` element and
     no connection from `redirect` to `analytics`.
- Add to `jeeves/packages/spec/src/studio-design-review.test.ts`:
  4. A copy of the TinyURL study with one more connection, `stats-shorten`, from `stats-api` to
     `shorten` (kind `calls`, `planned.interaction` `"Asynchronous"`), added to both
     `design.connections` and `architecture.studio.connections` (`{ connection: "stats-shorten",
     settings: {} }`): `validateDesign` returns a `LANE_INVALID` finding containing
     `is a direct call`, and `designReview` returns one `line-style` finding for `stats-shorten`
     whose commands are `removeLink` then `linkTiles`.
  5. The same with a connection `redirect-analytics` from `redirect` to `analytics`
     (`"Request / response"`): `validateDesign` returns a `LANE_INVALID` finding containing
     `takes its work from a queue or topic`, and `designReview` returns no `line-style` finding.
- These existing tests fail after the change (seen on a scratch copy). Update each to the new
  table and texts as its comment explains; change nothing else in them:

| File | Test | Change |
| --- | --- | --- |
| `jeeves/packages/spec/src/studio-lanes.test.ts` | `allow exactly the plan's pairs in each mode` | No async between applications or to an external API; no pair into `worker` or `notification` except from `queue` |
| same | `give each link its connection and name refusals in plain words` | Its `link("service", "worker", "async")` becomes a refusal |
| same | `holds the owner's rules as rows with allowed and default modes` | The rows as the table now prints them |
| same | `give every pair its default mode: async for queue links, sync otherwise` | A pair into a worker from an application is refused |
| same | `refuse each rule in plain words` | `("external-api", "billing", "async")` and `("billing", "external-api", "async")` now refuse with the step-4 sentence |
| same | `cover every kind but the browser once, with distinct kind icons` | `studioEntryKinds` no longer has `notification` |
| `jeeves/packages/spec/src/studio-lane-commands.test.ts` | `restitch: removing a CDN in front of Redirect moves the download entry back to it` | Its Click events removal now also removes Analytics worker (`alsoRemove: ["analytics"]`) |
| same | `always list the fan's eleven kinds in their groups, each allowed or with a reason` | After a service, Worker service is refused with the step-8 reason |
| same | `keep the fan's list for the canvas: addTile still takes every tile kind` | Add the Worker and Notifications tiles after a Queue |
| same | `link from the node, never reversed: the forward link, else its reason` | Redirect service → Analytics worker is a refusal |
| `jeeves/packages/spec/src/studio-design-review.test.ts` | `flags a line whose style contradicts its channel, redraws it and keeps its module link` | Its async Watch API → Recommendations `linkTiles` (`link: "async"`) is now refused when built: expect that refusal instead of an accepted dashed line; its expected fallback fix ends `so no mouse or chat command can redraw it.` |
| same | `finds the user reaching a store and removes the action's line when a service already reaches it` | Its `toContain("fix it in Source & diagnostics")` becomes `toContain("so no mouse or chat command can do it.")` |
| `jeeves-generator/src/v2/tile-processes.test.ts` | `runs the legacy kinds and empty tiles` | Put a queue between Go and Mail: replace the `go-mail` `addTile` with one adding `{ id: "mail-jobs", name: "Mail jobs", kind: "queue" }` after `go` (`linkId: "go-mail-jobs"`) and one adding Mail after `mail-jobs` (`linkId: "mail-jobs-mail"`). Its expected processes are unchanged |
| `jeeves/apps/server/src/chat/tools.test.ts` | `states the link table from the rules, and leaves the link mode optional` | Expect `External API -> service, redirect, identity, billing, uploads, gateway: sync (Calls).` instead of the `sync or async` row |

- These e2e tests fail after the change (seen on a scratch copy). Change them as follows:

| File | Test | Change |
| --- | --- | --- |
| `jeeves/apps/web/e2e/remove.spec.ts` | `removes a tile with its X, restitches its links and undoes` | Rename it `removes a tile with its X and the tile it cuts off, and undoes`. After clicking **Remove Click events**, the dialog `Remove Click events` lists Analytics worker; click its **Remove 2 tiles**. Then 9 tiles and 9 lines; the saved design has neither `click-events` nor `analytics` and no `redirect-analytics` connection. Undo: 11 tiles, 12 lines, both back |
| `jeeves/apps/web/e2e/relationship-tracing.spec.ts` | `removing a selected tile traces its surviving neighbour and Undo restores the route` | After clicking **Remove Click events**, click **Remove 2 tiles** in the dialog `Remove Click events`; the rest is unchanged |
| `jeeves/apps/web/e2e/connect.spec.ts` | `connects containers from anywhere in the Detailed view` | First drag the `stats-data` row onto Analytics worker: `.board-connect-tip` reads `Stats API can't link to Analytics worker. A worker takes its work from a queue or topic. Put one between them.`; press Escape and release. Then drag it onto Shorten service instead of Analytics worker, and expect the added link `stats-api shorten` |
| `jeeves/apps/web/e2e/spawn.spec.ts` | `clicks the link tab, then a kind, to add a linked tile` | After a service one kind is greyed: expect one `[aria-disabled="true"]` item, Worker service |
| same | `creates each of the eleven kinds by mouse, with its icon and label, and Undo removes one` | In its plan, the Worker service row comes from `"Message channel"` instead of `"Uploads"`; fix the comment above the plan to match |

- If any other test fails, stop (rule 2).

**Docs.**

- `jeeves/CATALOG.md`, link table:
  - the `action → …` row loses `` `notification`, ``;
  - `application → application` and `` `cdn` → application `` and `` `external-api` →
    application `` say `` (not `worker` or `notification`) `` after `application` in their first
    cell;
  - the Modes cell of `application → application`, `` application → `external-api` `` and
    `` `external-api` → application `` becomes `sync`.
- `jeeves/CATALOG.md`: after the paragraph that begins `So the user reaches a store`, add:
  `A Worker (or an older Notifications tile) is reached only from a Queue or Topic: its process answers no requests. A design stored with a dashed line between applications or a line straight into a Worker loads the same way and reports it; where removing that line would cut a tile off, no command can repair it.`
- `jeeves/CATALOG.md`: replace the sentence that begins `Application → application, application
  → external API and external API → application still` (it wraps after `still` and ends
  `for its channel.`) with:
  `A line between two applications, or between an application and an external API, is always a direct call: to hand work off without waiting, put a Queue or Topic between them (owner, 2026-11-12). Chat's review flags a stored line whose style the table refuses.`
- `jeeves/CATALOG.md`: replace the paragraph that begins `The table records design intent only.`
  with:
  `The table offers only links the generator can use (owner, 2026-11-12): a dashed line always goes through a Queue or Topic, and a Worker is reached only from one, because its process answers no requests. A gap found in a field project is recorded in [template gaps](../docs/template-gaps.md).`
- `docs/studio.md`, lane canvas, Lines bullet: replace the sentence that begins `The link table
  still allows a direct asynchronous call` (it ends `for its channel.`) with
  `A dashed line always goes through a Queue or Topic tile; a line between two services, or between a service and an external API, is always a direct call. A Worker is reached only from a Queue or Topic.`
- `docs/studio.md`, Chat, the **line-style** bullet: replace `A dashed line between applications,
  which the table allows, is accepted. A line the lanes can't remove first (it is all that
  reaches its store) is fixed in Source & diagnostics;` with
  `A dashed line between two services or to an external API is flagged too. A line the lanes can't remove first (it is all that reaches its tile) can't be redrawn by mouse or chat, and its fix says so;`
- `docs/studio.md`, `## Limits`: after the bullet that begins `A design stored with an entry
  straight into storage`, add the bullet
  `- A design stored with a dashed line between applications, or a line straight into a Worker, loads and reports it the same way; where removing that line would cut a tile off, no command can repair it.`
- `docs/chat-evals.md`: add at the end of `## Design evals 2.0.0 (V3-19)`:

```text
Since PF03 changed the link table chat's tools send, the recorded V3-19 live reports no longer replay (their requests differ); they stay as the record of that run. `pnpm eval:chat` still runs the scripted arms.
```

**Mouse check:** on a blank project add the Produce action, a Microservice after it, then a
second Microservice after that one from its link fan: the line between them is solid. Open the
second Microservice's link fan: Worker service is greyed, and its reason contains `takes its work
from a queue or topic`. Add a Message channel after it, then a Worker service after the channel:
both lines are dashed. On a new TinyURL study the lines into and out of its queue are dashed and
the legend shows Async.

**Done when:** `grep -n "either" jeeves/packages/spec/src/studio-links.ts` prints nothing and all
five checks pass.
**Commit:** `PF03: remove direct async links and direct calls to a worker`.

### PF04 — Retire the strict-contract surface: web app and default study (D3, D4)

**Goal:** the web app shows nothing of the strict-contract layer except three things that keep
legacy designs safe: the read-only ownership summary in Source & diagnostics (generation reads
ownership), the declarations a removal's confirmation names, and the confirmation that moving an
entry clears operation bindings. New project preselects the TinyURL study. Spec code is
untouched.
**Checks:** check, e2e, build, mouse. **Exported files this unit may change:** none.

**Do not edit** anything under `jeeves/packages/spec/src/` or `jeeves/apps/server/` except
`studio-examples/index.ts` and the test files named in step 4.

**1. Delete six unused files** (nothing imports them; confirm with
`grep -rn "DesignScopeForm\|OwnershipForm\|OperationsForm\|ResolveFields\|design-scope.css\|ownership.css" jeeves/apps/web/src`,
which must list only lines inside the four forms):
`jeeves/apps/web/src/studio/DesignScopeForm.tsx`, `OwnershipForm.tsx`, `OperationsForm.tsx`,
`ResolveFields.tsx`, and the two style sheets only they import, `design-scope.css` and
`ownership.css`. Keep `OperationChanges.tsx` and `OwnershipChanges.tsx`: the removal and
entry-move confirmations use them.

**2. `jeeves/apps/web/src/canvas/SourceDiagnostics.tsx`.**

- Remove `<ReadinessReport …/>`, `<OperationsSummary …/>` and the whole
  `<details>` whose summary is `Profile & requirements`.
- Remove the `selectedOperation` prop and the imports that become unused.
- Replace the paragraph's text with:
  `Saved schema v{design.schemaVersion} · revision {design.revision}. Read-only: the saved source, and who owns and may read each store.`
- The dialog then holds, in this order: that paragraph, **Download source JSON**, the ownership
  summary, and **Full saved source**.

Then delete `jeeves/apps/web/src/studio/ReadinessReport.tsx` and `OperationsSummary.tsx` (they
have no test files). In `jeeves/apps/web/src/canvas/Workspace.tsx`, stop passing
`selectedOperation`; then, since nothing can select an operation any more, delete
`operationPick`, `setOperationPick` (and its call in `select`), `selectedOperation`, the
`target.operation` branch of the dialog's `onTarget`, the operation branch of the chat selection
effect (and `selectedOperation` in its dependency list), and the operation half of the
`Selected … for chat` status, which becomes `Selected logical owner for chat · {selectedOwner.id}`
shown when `selectedOwner` is set. Keep the owner selection and the entry-move dialog. Remove the
imports that become unused.

**3. `jeeves/packages/spec/src/studio-examples/index.ts`.**

- `DEFAULT_STUDIO_EXAMPLE_ID = TINYURL_STUDIO_EXAMPLE.id`.
- `studioArchitectureExamples` holds three items, in this order: the TinyURL item exactly as it
  is now (keep its name `TinyURL · extended study (design only)`), `MARKETPLACE_STUDIO_EXAMPLE`,
  `YOUTUBE_STUDIO_EXAMPLE`.
- Keep the `studioArchitectureExample` switch as it is, with its foundation case, and keep
  `tinyurl-foundation.ts`.

**4. Tests.** With exactly these changes, every unit test and e2e test that this unit affects
passed on a scratch copy.

| File | Do |
| --- | --- |
| `jeeves/apps/web/e2e/design-scope.spec.ts`, `foundation.spec.ts`, `operations.spec.ts`, `readiness.spec.ts`, `resolve.spec.ts` | Delete the file |
| `jeeves/apps/web/e2e/operations.ts` | Delete it if `grep -rn "operations.ts" jeeves/apps/web/e2e` then finds no importer (only the deleted specs import it) |
| `jeeves/apps/web/e2e/source.ts` | Delete `selectOperation`: only the deleted specs use it |
| `jeeves/apps/web/e2e/ownership.spec.ts`, `ownership.ts` | Keep. Change only selectors or texts this unit changed. If it needs more, stop (rule 2). |
| `jeeves/apps/web/e2e/detailed-view.spec.ts` | Delete the one test titled `the TinyURL foundation, which has no modules: its services are containers holding just the +` |
| `jeeves/apps/web/e2e/studio.ts` | Add `createFoundation` (below), importing `studioArchitectureExample` and `studioStudySeedOperations` from `@jeeves/spec`. In the `tinyurl` fixture, replace the two comment lines that mention the extended schema2 study and `foundation.spec.ts` with `// The extended TinyURL study is New project's default.` |
| `jeeves/apps/web/e2e/diagram-export.spec.ts` | In the test that calls `createStudy(page, "E2E PNG owner")`, call `createFoundation(page, "E2E PNG owner")` instead; it needs the foundation design |
| `jeeves/packages/spec/src/studio-examples/foundation.test.ts` | `expect(DEFAULT_STUDIO_EXAMPLE_ID).toBe("studio-tinyurl-foundation")` becomes `.toBe("studio-tinyurl")`; every `studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID)` becomes `studioArchitectureExample("studio-tinyurl-foundation")` |
| `jeeves/apps/server/src/routes/foundation.test.ts` | `studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID)` becomes `studioArchitectureExample("studio-tinyurl-foundation")`; remove the import that becomes unused |
| `jeeves/packages/spec/src/studio-rekey.test.ts` | In `updates every kind of reference, exactly where the completeness walk finds them`, add `["TinyURL foundation", studioArchitectureExample("studio-tinyurl-foundation").design],` directly after `...studies,`: without it the walk loses the foundation's operation references and the test fails |
| `jeeves/packages/spec/src/studio-warnings.test.ts` | In `studies have no topology warnings; the foundation retains its honest verifier gaps`, loop over `const ids: string[] = [...studioArchitectureExamples.map((study) => study.id), "studio-tinyurl-foundation"]` (with `id` in place of `study.id` in the body): its `study.id !== "studio-tinyurl-foundation"` comparison no longer type-checks |
| `jeeves/apps/web/src/project/create-example.test.ts` | No change: it passes with any default |

`createFoundation`, in `jeeves/apps/web/e2e/studio.ts` before `export const tiles`:

```ts
/** A new project holding the TinyURL foundation study, which New project no longer offers. */
export async function createFoundation(page: Page, name: string): Promise<string> {
  const created = await page.request.post("/api/projects", { data: { name } });
  expect(created.status()).toBe(201);
  const id = (await created.json()).project.id as string;
  const seeded = await page.request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: 0,
      source: "canvas",
      ops: studioStudySeedOperations(studioArchitectureExample("studio-tinyurl-foundation").design),
    },
  });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  await page.goto(`/?project=${id}`);
  await ready(page);
  return id;
}
```

If any other test fails, stop (rule 2).

**5. Docs.**

- `docs/studio.md`: delete the paragraph that begins `Open **Export diagram → Source &
  diagnostics → Compatibility report**` (it ends with the report guide link). In `## Projects`,
  the study list is the TinyURL study (the default; a fresh installation starts with one), the
  marketplace study and the YouTube study. Delete the sections `## Profile and requirements`,
  `## The TinyURL foundation study` and `## Named API operation responsibilities`. Replace the
  body of `## Logical owners, roles and access` with:
  `Module commands derive who owns each store and who may read it; generation reads that. **Export diagram → Source & diagnostics** shows it read-only, with the saved source. Removal previews still name the declarations a removal affects, and one Undo restores them; moving an entry that would clear operation bindings asks first.`
- `docs/studio.md`, `## Diagram PNG export`: replace the paragraph that begins `**Source &
  diagnostics** opens read-only ownership/access` with:
  `**Source & diagnostics** shows, read-only, who owns and may read each store, and the full saved source. **Download source JSON** preserves the complete document, including historical settings and custom declarations. Its owner buttons select a logical owner for chat without changing source. This path supplies no declaration forms or extra settings menu.`
- `docs/studio-contracts.md` and `docs/studio-readiness.md` stay where they are, so every link
  into and out of them keeps working. Directly under each one's title, add:
  `> **Retired (owner, 2026-11-12).** The studio no longer shows or edits these declarations. A schema-3 design may still carry them: they are parsed, validated and exported in blueprint 3, so this page stays as their reference.`
- `jeeves/CATALOG.md`: delete the sections `## Persistent behavior scope`,
  `### Finite Create link contract (NC03)`, `### Finite Resolve link and positive cache (NC04)`
  and `### Exact snapshot compatibility report (NC05)`. In `## Studies`, delete the TinyURL
  foundation paragraph, keep `New project offers three studies`, and mark the Extended TinyURL
  study as the default. In `## Explicit logical authority and access`, replace the sentence that
  begins `**Export diagram → Source & diagnostics** retains read-only` (it wraps after `retains`
  and ends `useful installed settings.`) and the sentence after it (`Diagnostic buttons retain
  exact owner/operation chat selection.`, which wraps after `chat`) with:
  `**Export diagram → Source & diagnostics** shows ownership/access read-only, with the saved source and its JSON download; its owner buttons select a logical owner for chat. Normal forms contain only identity and useful installed settings.`
  Add this section before `### Experimental local-v2 video composition`:

````markdown
### Legacy declarations

A schema-3 design may carry `scope`, `operations` and cache-policy declarations from the retired
strict-contract work (NC01–NC14, 2026-11-07). They are still parsed, validated and exported in
blueprint 3, and the studio no longer shows or edits them. The TinyURL foundation study
(`studio-tinyurl-foundation`) is no longer offered; projects made from it still open. Details:
[contracts](../docs/studio-contracts.md) and [readiness](../docs/studio-readiness.md).
````

- `jeeves/PLAN.md`, `## Data model`: the studies offered are TinyURL v3.2 (the default), the
  marketplace and YouTube.

**Mouse check:** New project → Architecture study has **TinyURL · extended study (design
only)** preselected and lists three studies. Create it: the TinyURL study renders. Export
diagram → Source & diagnostics shows the four things in step 2 and nothing else.

**Done when:** the four checks pass, and
`grep -rn "ReadinessReport\|OperationsSummary\|DesignScopeForm\|selectedOperation" jeeves/apps/web/src`
prints nothing.
**Commit:** `PF04: retire strict-contract surface in the web app`.

### PF05 — Retire the strict-contract surface: chat (D3)

**Goal:** chat has 11 tools. None edits or reads persistent scope, operation contracts or the
readiness report, and what chat reads (`getDesign`, `validateDesign`, its reviews and each
turn's context) carries the design's own findings and only a count of readiness findings
(`notSpecified`). Ownership stays where generation needs it: each link's `access` and
`declaredAccess`, and a logical owner the user selects in Source & diagnostics (sent as
`Selected logical owners`). Chat still does exactly what the mouse can.
**Checks:** check, e2e, build, evals, mouse. **Exported files this unit may change:** none.

**Do not edit** `jeeves/packages/spec/src/` (tests included), `jeeves/apps/web/src/` or
`jeeves/apps/server/src/chat/service.ts`. With exactly the changes below (on top of PF03 and
PF04), the server tests and `pnpm eval:chat` passed on a scratch copy, with the same scripted
scores, and no e2e test failed because of them.

**1. `jeeves/apps/server/src/chat/tools.ts`.**

- Remove these five tools completely: `configureDesignScope`, `configureOwnership`,
  `describeOperation`, `configureOperations`, `readReadiness`. That is their entries in
  `schemas` and `descriptions`, their `case`s in `dispatch`, the private methods
  `configureOperations`, `configureOwnership` and `configureScope`, the fields
  `operationsPreview`, `ownershipPreview` and `scopePreview`, and the configure branch of
  `isWorkspaceMutation` (which then ends `return false;` after the apply-tools branch).
- In `designSummary`, remove these properties and the code only they use (including
  `const readiness = designReadiness(design);`): `readiness`, `persistentScope`,
  `availableProfileDefault`, `declaredOperations`, `operationFindings`, `availableOperations`,
  `availableCachePolicies`, `declaredOwnership`, `ownershipFindings`, `ownershipMeaning`. Replace
  its `findings: …` and `warnings: …` properties with `...designFindings(findings),`. Keep
  everything else, including each link's `declaredAccess` and `accessNote`.
- The `validateDesign` case logs `Checked the design's findings` and returns
  `designFindings(validateDesign(this.working))`.
- `reviewWithModules` keeps the review's other fields but projects these three:

```ts
const {
  findings,
  obligations,
  ownership: _ownership,
  operations: _operations,
  persistentScope: _persistentScope,
  ...review
} = reviewStudioDesign(base, working, scope);
const left = designReview(working, installed);
const readiness = findings.filter(isReadiness);
```

  and its returned object ends `...review,`, then
  `findings: findings.filter((item) => !isReadiness(item)),`,
  `...(readiness.length && { notSpecified: designFindings(readiness).notSpecified }),` and
  `obligations: obligations.filter((item) => "pattern" in item || "targetPresent" in item),`
  (only the turn's own review scope: a saved profile's requirements stay out).
- In `turnContext`, remove the sentence about selected operation bindings (from
  `\nSelected operation bindings` to the end of the string). Keep `Selected logical owners`.
- Texts:
  - in `INSTRUCTIONS`, replace `Readiness findings (a behavior profile, contracts, ownership
    declarations) are not design errors: leave them unless the person asks.` with
    `Readiness findings are only counted (notSpecified): they are not design errors, so leave them.`;
  - in `reviewWithModules`'s two `leftNote` strings, replace `findings below are readiness
    (profiles, contracts, ownership declarations), not design errors: leave them unless the
    person asks.` with `findings below are the design's validation findings; readiness findings
    are only counted (notSpecified).`;
  - `getDesign`'s description: replace `; findings and warnings; and the persistent scope,
    ownership and operation declarations the configure tools edit.` with `; and the design's
    findings and warnings, with readiness findings only counted (notSpecified).`;
  - `validateDesign`'s description becomes `Read the design's findings and warnings, with
    readiness findings only counted (notSpecified). Findings do not establish runtime support.`;
  - `reviewDesign`'s description: replace `the readiness findings, declared assumptions` with
    `the design's findings with readiness findings only counted, declared assumptions`.
- Remove the imports that become unused. Keep `validateDesign`, `declareReviewScope`,
  `reviewDesign`, the `notSpecified` count and every other tool as they are. `service.ts` is
  unchanged: its final review reads the projected review, so the reply's counts no longer
  include readiness findings or a saved profile's requirements.

**2. Tests.**

- `jeeves/apps/server/src/chat/chat.test.ts`: delete the tests `bounds persistent scope repairs,
  allows preview after exhaustion and saves scope-only edits as one Undo`, `bounds resolve
  repairs through actual ChatService and leaves policy lookup/preview available afterward`,
  `bounds actual operation repairs, preserves read-only lookup/preview and commits exact operation
  details as one Undo` and `bounds actual ownership repairs, permits previews after exhaustion,
  and saves exact declaration details as one Undo`. In `carries one explicit operation selection
  into actual context/history, preserves rename and refuses removed/malformed bindings`, the two
  expectations `toContain("Selected operation bindings")` and
  ``toContain(`"binding":{"id":"${binding.id}"`)`` become `not.toContain(…)`; keep its selection,
  rename and refusal checks. In `forces review when the model ends, invalidates it after later
  commands, and saves warnings`, the two `{ name: "readReadiness", arguments: {} }` calls become
  `{ name: "getDesign", arguments: {} }` and its `item.tool === "readReadiness"` count becomes
  `item.tool === "getDesign"`.
- `jeeves/apps/server/src/chat/openai-tools.test.ts`: delete the tests `round-trips the resolve
  union, null policy/connection and unknown exact policy through actual strict wire/history`,
  `transmits exact tagged operation refs, nullable verifier/retention, omission defaults and
  canonical history; refuses unknown fields`, `transmits bounded ownership with omitted
  deployables/boundaries, defaults, canonical history and atomic grant refusal` and `transmits
  persistent scope with exact nullable references, omission defaults and canonical history
  replay`. In `transmits every current schema as strict…`,
  `expect(requests[0]?.tools).toHaveLength(16)` becomes `11`.
- `jeeves/apps/server/src/chat/tools.test.ts`: delete the test `shares persistent scope commands
  with mouse edits and requires a fresh explicit upgrade preview`. `offers exactly the finite
  studio toolset` expects `["listStudioDefinitions", "describeStudioDefinition",
  "listStudioPatterns", "describeStudioPattern", "getDesign", "applyStudioCommands",
  "applyPattern", "validateDesign", "declareReviewScope", "reviewDesign", "askUser"]`. Add this
  test before it (import `turnContext` from `./tools.ts`):

```ts
it("names no strict-contract tool and keeps the retired declarations out of what chat reads", () => {
  const removed = [
    "configureDesignScope",
    "configureOwnership",
    "describeOperation",
    "configureOperations",
    "readReadiness",
  ];
  expect(toolDefinitions().filter((tool) => removed.includes(tool.name))).toEqual([]);
  // The foundation study declares a profile, ownership and operations.
  const design = { ...studioArchitectureExample("studio-tinyurl-foundation").design, revision: 3 };
  const summary = run(new Workspace(design), "getDesign");
  for (const key of ["readiness", "persistentScope", "declaredOperations", "declaredOwnership"])
    expect(summary).not.toHaveProperty(key);
  const review = run(new Workspace(design), "reviewDesign");
  for (const key of ["persistentScope", "operations", "ownership"])
    expect(review).not.toHaveProperty(key);
  const readiness = ["NEEDS_TEMPLATE", "CONFIG_REQUIRED", "ARCHITECTURE_UNBOUND"];
  const checked = run(new Workspace(design), "validateDesign");
  for (const findings of [summary.findings, review.findings, checked.findings])
    expect(findings.filter((item: { code: string }) => readiness.includes(item.code))).toEqual([]);
  expect(checked.notSpecified).toMatch(/readiness findings? .*not design errors/);
  expect(turnContext(design, [], [])).not.toContain("Selected operation bindings");
});
```

- Delete `jeeves/apps/server/src/routes/foundation-chat.test.ts` and
  `jeeves/apps/server/src/routes/readiness.test.ts`: each tests only chat's use of a removed
  tool.
- In `jeeves/apps/server/src/routes/ownership.test.ts`, `operation-contracts.test.ts` and
  `resolve-contracts.test.ts`, keep the test and its mouse/API half: delete each statement that
  uses the chat `Workspace` (the `chat` or `workspace` variable, the `args` it alone uses, and
  `expect(saved.state.design).toEqual(chat.working)` or `…(workspace.working)`), save the command
  builder's ops instead of `workspace.pending` (`buildOperationsCommand(before, { operations }).ops`
  in `resolve-contracts.test.ts`; the other two already have `mouseOps`), delete the `Workspace`
  import, and take `mouse/chat` out of the title (`mouse` in its place).
- Then remove each import and helper that TypeScript reports unused in these files
  (`pnpm exec biome check --config-path=tooling/biome.config.json --write --unsafe <file>` removes
  the imports).
- Change no other test. If another test fails, stop (rule 2).

**3. Docs.**

- `docs/studio.md`, Chat: in the `getDesign` row replace `findings and warnings; and the scope,
  ownership and operation declarations the configure tools edit.` with `the design's findings and
  warnings, with readiness findings only counted (notSpecified).`; in the `reviewDesign` row
  replace `with the readiness findings, assumptions` with `with the design's findings (readiness
  findings only counted), assumptions`. After `whose schemas total about 37 KB (44 KB as OpenAI's
  strict tools, down from 86 KB and 113 KB before V3-19)` add `, measured with sixteen tools; chat
  now has eleven`.
- `docs/chat-tool-schemas.md`: directly after the V3-19 table (its last row begins
  `| All sixteen tools, canonical`), add the paragraph below. Leave the NC01–NC03 paragraphs as
  the record.

```text
Five tools have since been removed (`configureDesignScope`, `configureOwnership`, `describeOperation`, `configureOperations`, `readReadiness`): chat has eleven. The sizes above were measured with sixteen.
```

- `docs/chat-evals.md`: after PF03's sentence at the end of `## Design evals 2.0.0 (V3-19)`, add:

```text
Since PF05 changed chat's tools and context, the recorded scripted report (`docs/evals/v3-19/scripted.json`) no longer replays either; `pnpm eval:chat` reruns its arms.
```

- `docs/studio-settings.md`: replace the sentence that begins ``Chat's `configureDesignScope` uses
  the canonical source command`` (it wraps after `RF04` and ends `remains turn-only metadata.`)
  with:

```text
RF04 `declareReviewScope` is turn-only review metadata; chat does not edit the saved scope.
```

- `jeeves/CATALOG.md`, `## Explicit logical authority and access`: in the sentence that begins
  `` `previewOwnership` / `buildOwnershipCommand` back ``, replace ``back explicit source commands
  and the narrow `configureOwnership` chat tool;`` (it wraps after `and the`) with
  `back explicit source commands;`. In `### Legacy declarations`, `the studio no longer shows or
  edits them` becomes `neither the studio nor chat shows or edits them`.
- `docs/studio-contracts.md` and `docs/studio-readiness.md`: in the Retired note, `The studio no
  longer shows or edits` becomes `Neither the studio nor chat shows or edits`.
- `jeeves/PLAN.md`, `## Chat`: delete the two sentences that begin ``Persistent scope uses a
  separate bounded `configureDesignScope` tool`` and `Schema v2 requires a read-only preview`
  (both on one line, ending `explicit upgrade.`).

**Mouse check:** open the TinyURL study, open the chat rail, and confirm it renders with its
input. (The scripted chat turns in `blueprint-chat.spec.ts` are the functional check.)

**If `pnpm eval:chat` fails a threshold,** stop as in rule 2 and report the scores it printed.

**Done when:** the five checks pass and
`grep -rn --include=*.ts --exclude=*.test.ts "configureDesignScope\|configureOwnership\|describeOperation\|configureOperations\|readReadiness" jeeves/apps/server/src`
prints nothing.
**Commit:** `PF05: retire strict-contract tools in chat`.

---

## Phase C — Sturdier templates

All template files are under `jeeves-generator/templates/local-v2/assets/`. The code that
writes each process file is in `jeeves-generator/src/v2/` (`tile-processes.ts`,
`http-wiring.ts`, `loop-wiring.ts`). Tests are beside them (`*.test.ts`); add each new test to
the existing file that already tests the same template (find it with `grep -rln`). The runtime
template tests load a template's source as a module (see `positive-cache.test.ts`'s `source` and
`moduleUrl`, and its fake `redis` client in `uses bound Valkey credentials/endpoint, fixed queue
bounds and destructive command/startup deadlines`); use the same harness. Each unit below states
its goal, the behaviour each changed function must have, and the tests that must pass. Where it
gives no code, write the smallest code that meets them.

### PF06 — Every failure is logged

**Goal:** when a generated process survives a failure, it writes one JSON line saying what
failed and why, with the original error. When startup, a fatal transport loss or a drain fails,
it says why. Answers, retries and what is kept stay as they are.
**Checks:** check, e2e, build.
**Exported files this unit may change:** `src/runtime/tile-process.ts`, `src/runtime/http.ts`,
`src/runtime/process.ts`, `src/runtime/outbox.ts`, `src/runtime/asset-worker.ts`,
`src/runtime/positive-cache.ts`, `src/runtime/multipart.ts` and `src/processes/*.ts`.

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
must show no change (on a scratch copy it printed `{ 'frozen-v2': 72, 'v2-module-design': 77,
'stub-stack': 52 }` and left the file byte-identical). If it shows one, stop (rule 2).

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
argument), call ``options.onFailure?.(`request ${request.method} ${request.routeOptions?.url ?? "unmatched"}`, error)``
inside a `try`/`catch` that ignores what it throws, before replying, when:

- the error is an `HttpError` with `statusCode >= 500` and `statusCode !== 501`; or
- the error is not an `HttpError` and is not one of the client errors 400, 413 and 415.

The answers themselves don't change.

**4. `src/runtime/process.ts.template`** (it is indented with tabs).

- In `runProcess`'s `catch`, bind the error and, before the existing
  `console.error("Application startup failed")`, write
  `console.error(JSON.stringify({ level: "error", event: "startup-failed", error: <name: message, at most 300 characters> }))`.
  Keep the existing line.
- `fail(error)` keeps what it does and, when given an error, first writes one
  `{"level":"error","event":"process-failed","error":…}` line (the same 300-character form).
- In `close`, the drain `catch` binds its error and writes one
  `{"level":"error","event":"drain-failed","error":…}` line; it still sets `failed`.
- `periodic` takes a fourth optional parameter, `onFailure?: (error: unknown) => void`. Its
  `.catch` calls it inside a `try`/`catch` that ignores what `onFailure` throws.

**5. `src/runtime/outbox.ts.template`.**

- `relayBatch` returns `{ selected, sent, deferred, errors }`, where `errors` is every error
  caught in the per-row `catch` (bind the error there), in order.
- In `startRelay`'s `tick`, after a batch resolves, call `options.onError?.(error)` for each of
  its `errors`, inside the same kind of guard that protects the existing `onError` call.

**6. `src/runtime/asset-worker.ts.template`.** `startAssetLifecycleWorker` takes one more
optional option, `onRelayError?: (error: unknown) => void`, called through its own guard (as
`notify` guards `onSweepError`). The publication relay's `onError` uses it; sweeps keep
`onSweepError`.

**7. `src/runtime/positive-cache.ts.template`.** `createPositiveReader` takes one more optional
option, `onFailure?: (what: "cache read" | "cache fill", error: unknown) => void`, called through
a guard. Its two `catch` blocks bind the error and call it (`cache read` for a failed or corrupt
cached read, `cache fill` for a failed fill) before going on exactly as now.

**8. `src/runtime/multipart.ts.template`.** `createOwnedMultipart` takes one more optional
option, `onFailure?: (what: string, error: unknown, extra?: Record<string, unknown>) => void`,
called through a guard. In `start`, the `catch` binds the original error and reports it as
`multipart start` (with `{ upload: saved.uploadId }`) before it records `INITIATION_FAILED`, and
the provider abort's `.catch(() => {})` reports `multipart abort` instead of discarding the
error. `start` still answers 503 `INITIATION_FAILED`.

**9. Wiring** (`jeeves-generator/src/v2/`). Every process file that the wiring writes:

- creates `const failure = createFailureLog(config.tile);` once, importing it from
  `../runtime/tile-process.ts`;
- passes `onFailure: failure` to `createHttpService`;
- passes `{ onError: (error) => failure("outbox relay jobs", error) }` as `startRelay`'s fourth
  argument in the multipart wiring (`http-wiring.ts`, the line with
  `startRelay(createOutbox(binding.outbox, "jobs", hooks.job), db, jobs)`), and
  ``onFailure: (what, error, extra) => failure(`${what} <module id>`, error, extra)`` to
  `createOwnedMultipart`;
- in the lifecycle wiring (`loop-wiring.ts`, `startAssetLifecycleWorker({`), passes
  `onSweepError: (error) => failure("sweep <module id>", error)` and
  `onRelayError: (error) => failure("outbox relay publication", error)`;
- passes ``onFailure: (what, error) => failure(`${what} <module id>`, error)`` to
  `createPositiveReader` in the Cache read wiring;
- passes `(error) => failure("sweep <module id>", error)` as the fourth argument of every
  `periodic(` call it writes (today one: the multipart sweep);

with the lead module's ID written in place of `<module id>`.

**Tests** (add to the existing files):

1. `createHttpService` with `onFailure`: a handler that throws `new Error("boom")` answers 503
   and calls `onFailure` once with `request GET <its route>`; an `HttpError(404, …)` doesn't
   call it; an `HttpError(503, "OVERLOADED", …)` does; a 501 doesn't; an `onFailure` that throws
   changes no answer.
2. `periodic` with a rejecting effect calls `onFailure` with that error and keeps ticking.
3. `relayBatch` whose codec throws for one row returns that error in `errors` and still defers
   the row; `startRelay` passes it to `onError`.
4. `createFailureLog("t")("x", new Error("y"))` writes one line with `"event":"failure"`,
   `"what":"x"` and `"error":"Error: y"`, and a second call within a second writes none.
5. `runProcess`: `scope.fail(new Error("x"))` writes one `process-failed` line containing
   `Error: x`; a drain that throws writes one `drain-failed` line and the exit code is 1.
6. `startAssetLifecycleWorker`: a failing sweep calls `onSweepError`, a failing publication relay
   calls `onRelayError`, and a callback that throws stops neither.
7. `createPositiveReader`: a corrupt cached value and a failing fill each call `onFailure` once
   (`cache read`, `cache fill`), and the read still answers from the loader.
8. `createOwnedMultipart`: a provider `create` that throws reports `multipart start` with that
   error and the upload ID, and `start` still rejects with 503 `INITIATION_FAILED`.
9. A wiring test: the exported `src/processes/<id>.ts` of an HTTP tile contains
   `createFailureLog(config.tile)` and `onFailure: failure`.

Update these existing assertions (rule 7): `jeeves-generator/src/v2/durability.test.ts`, the
`relayBatch` result at line 216 gains `errors` (one error, `confirm lost`);
`jeeves-generator/src/v2/http-wiring.test.ts`, the two pinned `periodic(scope, () =>
uploadMultipart.multipart.sweep(), 30000);` strings (lines 387 and 392) gain the fourth argument.
Another emitted-string assertion may differ only by this unit's lines (`failure`, `onFailure`,
`onError`, `onSweepError`, `onRelayError`); update it and list it in the handoff. Any other
failing assertion: stop (rule 2).

**Docs.** `jeeves-generator/README.md`, under Runnable processes: add the `failure` line, its
fields (`level`, `event`, `tile`, `what`, `error`, and `upload` where there is one) and what writes
it: a failed request (5xx other than 501), a failed sweep (multipart and lifecycle), a failed
outbox relay (jobs and publication), a failed cache read or fill, and a failed multipart start
or provider abort; and the `startup-failed`, `process-failed` and `drain-failed` lines.
`docs/template-gaps.md`: gap 3's Status becomes `Open: still retried for ever, now logged (PF06)`.

**Commit:** `PF06: log every failure`.

### PF07 — The cache read recovers

**Goal:** after the cache stalls or disconnects, the Cache read template uses the database for
a short time and then uses the cache again, and says so in the log, without ever piling up calls
on a cache that doesn't answer.
**Checks:** check, e2e, build.
**Exported files this unit may change:** `src/runtime/positive-cache.ts`,
`src/runtime/valkey.ts` and `src/processes/*.ts`.

**1. `src/runtime/positive-cache.ts.template`** (`createPositiveReader`).

- Replace `let usable = !!cache;` with `let skipUntil = 0;` and a count of cache calls that
  passed their deadline and haven't settled yet (`let stalled = 0;`).
- When a phase passes its 150 ms deadline, set `skipUntil = Date.now() + 5000` (it set
  `usable = false`), count the underlying call as stalled, and uncount it when that call
  settles (`.finally` on the effect's own promise; `Promise.race` doesn't cancel it).
- Use the cache when `cache && stalled === 0 && Date.now() >= skipUntil` (it tested
  `cache && usable`), in both places. So a call that never settles keeps the cache off; once it
  settles, the cache is tried again after the five seconds.
- Replace the comment above `phase` (it says the cache is disabled after a stalled phase) with
  one that says this.
- Change nothing else: the 150 ms bound, the single flight per key, the absolute expiry,
  "null is never cached" and PF06's `onFailure` stay.

**2. `src/runtime/valkey.ts.template`** (`createValkeyCache`).

- New optional option:
  `onState?: (state: "available" | "unavailable", error?: unknown) => void`.
- Keep the 500 ms connect bound, the 150 ms command bound, `disableOfflineQueue: true`,
  `commandsQueueMaxLength: 32`, `reconnectStrategy: false` and the `createClient` options.
- **State.** One client generation at a time (active or still connecting), one pending retry
  timer at most, and a permanent `closed` flag. Every `error` handler, connect result and
  command result captures the generation it belongs to and is ignored when that generation is
  no longer current or `closed` is set.
- **Losing the client.** The first connect failing or timing out, an `error` event, or a command
  that times out or rejects, for the current generation: destroy that client, mark the cache
  unusable, report `unavailable` (with that error), and start the 5000 ms retry timer if none is
  pending.
- **Retrying.** When the timer fires, a new generation creates a new client and connects it
  within 500 ms. Success makes it the client in use and reports `available`; failure is a loss
  as above (it starts the timer again).
- **Reporting.** `onState` is called only when the reported state changes, starting with the
  first connect's result (`available` or `unavailable`). A failed retry while already
  unavailable reports nothing. `onState` is called through a guard: what it throws is ignored.
- **Closing.** The returned `close()` sets `closed`, clears the timer and destroys the active
  client and any client still connecting. A connect that succeeds after `close()` destroys its
  client and reports nothing.
- `get` and `set` still reject with `Error("Cache unavailable")` while there is no usable
  client.

**3. Wiring.** Where the wiring writes `createValkeyCache({ binding: … })`
(`http-wiring.ts`, the Cache read), add:

```ts
onState: (state, error) =>
  state === "unavailable"
    ? failure("cache <module id>", error ?? new Error("Cache unavailable"))
    : console.log(JSON.stringify({ level: "info", event: "cache", tile: config.tile, module: "<module id>", state })),
```

with the lead module's ID written in place of `<module id>`.

**Tests** (in `positive-cache.test.ts`, with fake timers and its fake `redis` client):

1. In `preserves successful primary reads on failed fills and bounds stalled read/fill phases`,
   replace the expectation commented `Disabled after the stalled phase` with: a second read
   within 5 s doesn't call the cache. Add: a cache `get` that never settles keeps the cache
   unused across three 5 s intervals; a stalled `get` that settles at 7 s lets a read after
   that call the cache again.
2. A first connect that succeeds reports `available` once; one that fails reports `unavailable`
   once and is retried 5 s later.
3. After an `error` event the next `get` rejects with `Cache unavailable` and `onState` was
   called once with `unavailable`. 5 s later a new client is created and connected, `onState`
   is called with `available`, and `get` resolves.
4. Three failed reconnects in a row report no further `unavailable`.
5. After a new client is active, an `error` event or a late command rejection from the old
   client changes nothing.
6. Two commands that fail together report one `unavailable` and start one timer.
7. `close()` while a reconnect is still connecting destroys that client; its connect resolving
   afterwards reports nothing; advancing time afterwards creates no client.
8. An `onState` that throws breaks neither `get` nor the reconnect.
9. The existing test `uses bound Valkey credentials/endpoint, fixed queue bounds and destructive
   command/startup deadlines` passes unchanged.

**Docs.** `jeeves-generator/README.md`, the Cache reader bullet: say it reads the database
while the cache is down, reconnects every 5 s and logs each change (`event: "cache"` and the
`failure` line). `docs/template-gaps.md`: the cache limit's Status becomes `Fixed in PF07`.
`jeeves/CATALOG.md`: no change.

**Commit:** `PF07: cache read recovers`.

### PF08 — One bad item never stops a process

**Goal:** a hook that throws or returns something unusable while the Transcoder reports a
failure, or an upload whose completion keeps failing, no longer stops a process or blocks its
start (template gaps 5 and 2), and each such failure is logged.
**Checks:** check, e2e, build.
**Exported files this unit may change:** `src/runtime/media-worker.ts`,
`src/runtime/multipart.ts` and `src/processes/*.ts`.

**1. `src/runtime/media-worker.ts.template` (gap 5).**

- Split `emit` in two. `encode(job, event)` does the whole preparation: the ID
  (`messageId(options.codecs.eventId(job, event.kind))`), the wire value
  (`options.codecs.event` with `eventId` and `occurredAt`) and its body (`jsonBody`, which
  refuses a value it can't serialize and a body over 65,536 bytes). It returns `{ id, body }`.
  `emit` calls `encode`, then checks the publisher and publishes, as now.
- `startMediaWorker` takes one more optional option,
  `onSkippedReport?: (error: unknown, messageId: string | undefined) => void`, called through a
  guard.
- In `onTerminal`, after the existing `abort` check: call `encode` for the `failed` event
  inside `try`/`catch`. If it throws, call `onSkippedReport` with that error and
  `delivery.messageId`, then `return` (add the comment
  `// A hook that fails while reporting a failure must not stop the worker.`). Otherwise check
  the publisher and publish, outside that `try`, as `emit` does.
- So the delivery runner still moves the message to its `.failed` queue with its code, and the
  worker keeps consuming.

**2. `src/runtime/multipart.ts.template` (gap 2).**

- `sweep()` resolves to `{ failed: { uploadId: string; error: unknown }[] }`. Keep its single
  flight (a second call while one runs returns the same promise) and change its two
  `Promise<void>` types (the method and the `sweeping` variable) to match.
- In its first loop (durable cleanup) and its second loop (interrupted uploads), wrap the body
  of each iteration in `try`/`catch`. A caught error is pushed to `failed` with that row's
  upload ID, and the loop continues with the next row.
- The third part (unfinished provider uploads) is unchanged and may still throw. If it throws
  and `failed` is not empty, `sweep()` rejects with
  ``new AggregateError([...each failed item as new Error(`upload ${uploadId}: ${message}`, { cause: error }), providerError], "Multipart sweep failed")``;
  with `failed` empty it rejects with the provider error, as now.
- Update every caller of `sweep()` (`grep -rn "sweep()" jeeves-generator`): the wiring (below),
  `jeeves-generator/examples/product-attachment/service.ts.template` (at start and in its
  `periodic`: log each returned failure with
  `console.error(JSON.stringify({ level: "error", event: "failure", what: "sweep multipart", upload: item.uploadId, error: String(item.error) }))`),
  and the tests.

**3. Wiring.**

- Where the wiring writes the multipart's start and its periodic sweep (`http-wiring.ts`, its
  `initialize` and `started` lines):
  - at start: `for (const item of (await <name>.multipart.sweep()).failed) failure("sweep <module id>", item.error, { upload: item.uploadId });`
  - every 30 s: the same loop inside the `periodic` effect, keeping PF06's fourth argument.
- Where the wiring writes `startMediaWorker({` (`loop-wiring.ts`), pass
  `onSkippedReport: (error, messageId) => failure("failure report <module id>", error, { message: messageId })`.

**Tests.**

1. Media worker, for each of: `codecs.eventId` throwing for kind `failed`, `codecs.event`
   returning a cyclic object, and `codecs.event` returning a value whose JSON is over 65,536
   bytes: a job that fails for good is republished to the failed queue with its
   `x-terminal-code` and acknowledged; `onSkippedReport` was called once with the message ID;
   `closed` has not resolved; the next message is handled.
2. Multipart: with two interrupted uploads where the first one's completion throws a plain
   `Error`, `sweep()` resolves, `failed` holds the first upload's ID and error, and the second
   upload was completed.
3. Multipart, mixed: an interrupted upload's completion throws, then the provider inventory
   (`objects.unfinished`) throws: `sweep()` rejects with an `AggregateError` whose `errors` are
   the upload's (its message names the upload ID) and then the provider's.
4. A wiring test: the exported upload process contains `.sweep()).failed`.

Update these existing assertions (rule 7): `jeeves-generator/src/v2/http-wiring.test.ts`, the
`await uploadMultipart.multipart.sweep();` and `periodic(scope, () => …sweep(), …)` strings
(lines 386–392, after PF06's change); and the `sweep()` uses in
`jeeves-generator/src/v2/multipart.test.ts` (lines 222–225) where they read its result.

**Docs.** `jeeves-generator/README.md`: say both behaviours where the Video HLS loop and the
Multipart sweep are described. Add this sentence where the Video HLS loop is described:
`A video whose failure report is skipped is not marked failed at once: it stays pending until its ten-minute queue deadline, or processing until its thirty-minute processing deadline, and the lifecycle's next sweep then marks it QUEUE_DEADLINE or PROCESSING_DEADLINE, if that sweep succeeds (its failure hook runs inside the same transaction and can stop it).`
`docs/template-gaps.md`: gaps 2 and 5 become `Fixed in PF08`.

**Commit:** `PF08: one bad item never stops a process`.

---

## Phase D — Regeneration

### PF09 — Plan an update of an existing export

**Goal:** a pure function decides, file by file, what regenerating into an existing directory
does. It never deletes, overwrites or takes over a file the application owns, and a second
update keeps what the first one left for review. It writes nothing.
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
  /** SHA-256 of each file now on disk, for every path in `next`, `previous` or `overrides` that exists. */
  disk: ReadonlyMap<string, string>;
  /** Generated paths the application keeps as its own (`.jeeves/overrides.json`). */
  overrides: readonly string[];
  /** Paths that already have a file under `.jeeves/generated/` from an earlier update. */
  pendingShadows: readonly string[];
}): { actions: UpdateAction[]; refused: string[]; shadows: string[] };
```

`ownership` is `generated-extension` for the application's own files (hook files, stub bodies,
product SQL): **extension** below. Every other value (`generated-scaffold`,
`generator-metadata`) is **generated**. Below, `D` is the path's hash on disk (or absent), `N`
its hash in `next`, `V` its hash in `previous` (or absent), `P` its ownership in `previous` (or
absent), **overridden** means the path is in `overrides`, and **shadowed** means it is in
`pendingShadows`.

**First, for each path in `next`:** if its ownership is generated and `P` is extension, its
action is `edited` and `refused` gets `ownership changed: <path>`. An application's file never
becomes generated.

**Then, for each other path in `next`:**

| Row | Ownership | Condition, first match wins | Action |
| --- | --- | --- | --- |
| G1 | generated | `D` absent | `create` |
| G2 | generated | overridden | `override` (even when `D == N`) |
| G3 | generated | `V` absent | `edited` (an unknown file is in the way, even with the same bytes) |
| G4 | generated | `D == N` | `unchanged` |
| G5 | generated | `D == V` | `replace` |
| G6 | generated | otherwise | `edited` |
| E1 | extension | `D` absent | `create` |
| E2 | extension | `D == N` | `unchanged` |
| E3 | extension | `V == N` and not shadowed | `keep` |
| E4 | extension | otherwise | `keep-changed` |

**For each path in `previous` that is not in `next`:**

| Row | Condition, first match wins | Action |
| --- | --- | --- |
| R1 | `D` absent | no action |
| R2 | overridden | `orphan` (even when `D == V`) |
| R3 | `P` is extension | `orphan` |
| R4 | `D == V` | `remove` |
| R5 | otherwise | `edited` |

**For each overridden path in neither `next` nor `previous`:**

| Row | Condition | Action |
| --- | --- | --- |
| U1 | `D` present | `orphan` (an override the export dropped earlier: still the application's) |
| U2 | `D` absent | no action; `refused` gets `unknown override: <path>` |

**Also:**

- `refused` lists, sorted by path, every `edited` path (as the path itself, or as
  `ownership changed: <path>` for the first rule), then every `unknown override: <path>`.
- `shadows` lists every `override` and `keep-changed` path: the caller writes the new generated
  bytes for these to `.jeeves/generated/<path>`, and deletes each pending shadow that is not in
  `shadows` (a `keep-changed` file whose disk now equals `N` is `unchanged`, and the application
  may also delete a shadow to accept its file as it is). So a shadow stays until the
  application's file equals the new bytes or the application deletes it.
- `actions` is sorted by path. The function never throws for these inputs and reads nothing
  from disk.

**Tests** (`jeeves-generator/src/update.test.ts`): one case per row (the ownership rule, G1–G6,
E1–E4, R1–R5, U1 and U2: eighteen); the equal-byte collision (G3 with `D == N`); an override
winning over equal hashes (G2 with `D == N`, R2 with `D == V`); the three `refused` forms;
`shadows`; the sort order; and two consecutive plans, the second with `previous` set to the
first's `next` as PF10 would leave it: (a) an edited override that the export dropped is
`orphan` the first time (R2) and `orphan` again the second time (U1), never `unknown override`;
(b) an extension that is `keep-changed` the first time is `keep-changed` again while its shadow
is pending, and `keep` once the shadow is gone.

**Commit:** `PF09: plan an update of an existing export`.

### PF10 — `update:v2`: regenerate into an existing app (D5)

**Goal:** one command regenerates an export in place: generated files are rewritten, the
application's own files are kept, a hand-edited generated file refuses the update, and an
update that is refused or unsafe changes nothing at all.
**Checks:** check, e2e, build. **Exported files this unit may change:** none.

**1. `jeeves-generator/src/update.ts`:** add
`updateDirectory(bundle, directory, options: { check: boolean })`, where `bundle` is what
`assembleV2` returns. It:

1. Requires `directory` to be an absolute path to an existing real directory (not a symlink)
   that holds `.jeeves/manifest.json` whose `format` is `jeeves-v2-manifest-v1`. Otherwise it
   throws `Not a Jeeves v2 export: <directory>`.
2. Validates the directory's manifest: `files` is an array of records with a string `path`, a
   64-hex `sha256` and an `ownership` of `generated-scaffold`, `generated-extension` or
   `generator-metadata`, and `assertDistinctPaths` (`src/files.ts`) accepts their paths. Else it
   throws `Invalid .jeeves/manifest.json`.
3. Reads `.jeeves/overrides.json` if it exists. Its shape is
   `{ "overrides": [{ "path": "compose.yaml", "reason": "…" }] }`; each `reason` must be a
   non-empty string, `assertDistinctPaths` must accept the paths, and none may be under
   `.jeeves/`. Else it throws `Invalid .jeeves/overrides.json`.
4. Lists the files under `.jeeves/generated/`, if it exists, as the pending shadows.
5. **Preflight, before anything changes, and also with `check`:**
   - `assertDistinctPaths` over the union of `next`'s and `previous`'s paths (each path once):
     this refuses case collisions and a file that would become a directory or the reverse.
   - For every path in `next`, `previous` or the overrides, and every shadow path, `lstat` the
     path and each of its parent directories inside `directory`. A symlink anywhere, an existing
     target that is not a regular file, or an existing parent that is not a directory throws
     `Unsafe update path: <path>`.
   Then it hashes the files on disk and calls `planUpdate`.
6. If `refused` is not empty, or `options.check` is true: writes nothing.
7. Otherwise, in this order:
   - writes each `create` and `replace` file (making parent directories);
   - deletes each `remove` file;
   - writes each `shadows` path's new bytes to `.jeeves/generated/<path>`;
   - deletes each pending shadow not in `shadows`;
   - writes `.jeeves/manifest.json` last, from the bundle.
8. Returns `{ directory, check, refused, counts: { create, replace, unchanged, keep }, keepChanged, override, remove, orphan }`,
   where the last four are path lists.

It touches no file outside `next`, `previous` and the overrides, except `.jeeves/manifest.json`
and files under `.jeeves/generated/`.

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
7. A symlink in place of a file the update would replace or remove throws `Unsafe update path`
   before anything is written: a scaffold file changed as in test 2 is still changed.
8. A manifest record whose path is a directory of a generated file (add
   `{ path: "src/runtime", sha256: <any 64 hex>, ownership: "generated-scaffold" }`) throws
   before anything is written.
9. Two updates in a row keep a pending shadow: edit a stub body and set its `sha256` in the
   manifest to a different hash, update (`keep-changed`, shadow written), update again (still
   `keep-changed`, shadow still there), delete the shadow and update again (`keep`).
10. An edited override the export no longer has (add a `generated-scaffold` record for a new
    file `extra.txt` to the manifest, write the file with other bytes, and list it in
    `overrides.json`) is `orphan` on the first update and again on the second, and the second
    is not refused.

**Docs.**

- `jeeves-generator/README.md`: add `## Updating an existing export` after
  `## Preserving work and remaining export work`, with the command, the tables' meaning in
  plain words (what is rewritten, what is kept, what refuses), the preflight (an unsafe or
  refused update changes nothing), `.jeeves/overrides.json`, `.jeeves/generated/` and when a
  shadow goes away, and `--check`. Add the command to `## Current state`.
- `docs/studio.md`, Experimental project export: one sentence that the ZIP is for a new
  directory and `update:v2` regenerates into an existing one.
- `docs/glossary.md`: add rows **Override** (a generated file the application keeps as its own,
  listed in `.jeeves/overrides.json` with a reason; each one is a template gap) and **Update**
  (regenerating into an existing export with `update:v2`).

**Commit:** `PF10: update an existing export in place`.

---

## Phase E — Proof

Docker rules for PF11–PF13:

- Work in a copy **outside** the checkout (your scratch directory, `$SCRATCH` below), never in
  place.
- Before anything else, record the owner's containers, volumes and networks
  (`docker ps -a --format '{{.Names}}'`, `docker volume ls -q`, `docker network ls -q`) in the
  evidence folder, and compare at the end: only yours may have come and gone.
- Use the Compose project name and ports your unit gives. If a port is in use, add 10 to all
  three and say so. Never touch the owner's stacks, volumes or images.
- D7 asks for **one** run: PF12 starts the stack and leaves it running with two copies of each
  application process; PF13 uses that same stack and cleans up. At the end of PF13 run
  `docker compose --profile '*' down --volumes --remove-orphans` in the app copy with the same
  environment, remove the two images (`jeeves-pf12-app`, `jeeves-pf12-media`), and delete the
  copy with its `.runtime`.

### PF11 — YouTube v4: v3 regenerated onto the new templates

**Goal:** v3's completed app takes the new templates through `update:v2`, with every file the
application owns kept byte for byte, and still builds and passes its tests. No Docker stack is
started.
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
     `src/runtime/module-clients.ts` (v3's gap-6 edits, which the generator has matched since
     V3-18): copy each from `v4/generated/` over `v4/app/`, and run the check again.
   - If `refused` lists anything else, stop (rule 2).
6. Run the same command without `--check`. Save its output as
   `field-projects/youtube/v4/notes/update.json`. Expected: `refused` is empty and `override`
   lists the four paths. Then check that every file the application owns is byte for byte v3's:
   every previous manifest record with ownership `generated-extension` (hook files, stub bodies
   and product SQL, which lives under `infra/postgres/`), and every tracked v3 app file that is
   not in v3's manifest (such as `video-contract.ts`, the browser, scripts and tests). Run
   this from the repository root; it must print `"differ":[]` and exit 0:

```sh
node --input-type=module -e '
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const v3 = "field-projects/youtube/v3/app", v4 = "field-projects/youtube/v4/app";
const manifest = JSON.parse(readFileSync(`${v3}/.jeeves/manifest.json`, "utf8"));
const generated = new Set(manifest.files.filter((f) => f.ownership !== "generated-extension").map((f) => f.path));
const tracked = execFileSync("git", ["ls-files", v3], { encoding: "utf8" }).split("\n").filter(Boolean).map((p) => p.slice(v3.length + 1));
const own = tracked.filter((p) => !generated.has(p) && p !== ".jeeves/manifest.json");
const differ = own.filter((p) => !existsSync(`${v4}/${p}`) || !readFileSync(`${v3}/${p}`).equals(readFileSync(`${v4}/${p}`)));
console.log(JSON.stringify({ checked: own.length, differ }));
if (differ.length) process.exit(1);
'
```

   (Run on v3 against itself at `076d715`, it printed `{"checked":31,"differ":[]}`.) If it
   lists any path, stop (rule 2).
7. For each of the four override paths, compare the new generated file with v3's:
   `cmp field-projects/youtube/v4/app/.jeeves/generated/<path> field-projects/youtube/v3/generated/<path>`.
   If they are equal, do nothing. If one differs, re-apply v3's edit as a patch, and stop
   (rule 2) if it doesn't apply:

```sh
diff -u field-projects/youtube/v3/generated/<path> field-projects/youtube/v3/app/<path> > "$SCRATCH/<name>.patch"   # exits 1: they differ
cp field-projects/youtube/v4/app/.jeeves/generated/<path> "$SCRATCH/<name>.new"
patch --dry-run "$SCRATCH/<name>.new" "$SCRATCH/<name>.patch"
patch "$SCRATCH/<name>.new" "$SCRATCH/<name>.patch"
cp "$SCRATCH/<name>.new" field-projects/youtube/v4/app/<path>
```

   Then run step 5's `--check` again: `refused` must be empty.
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
every application process, then leave that two-copy stack running for PF13's faults (D7: one
run). **Change no code.** If a step fails, record exactly what happened and go on to the next
step; PF14 ranks the failures.
**Checks:** none (evidence and notes only).
**Project and ports:** `COMPOSE_PROJECT_NAME=jeeves-pf12`, `LOCAL_HTTP_PORT=45800`,
`LOCAL_IDENTITY_PORT=45801`, `LOCAL_OBJECT_PORT=45802`.

**Setup.**

1. The app: `mkdir -p "$SCRATCH/app"`, then
   `git archive HEAD:field-projects/youtube/v4/app | tar -x -C "$SCRATCH/app"`.
2. The harness: `tar -xzf docs/plans/youtube-v3/evidence/v3-17/operator-harness.tar.gz -C "$SCRATCH"`
   (it adds `env.sh`, four `.sh` helpers, `harness/`, `browser/` and V3-17's `runs/`). Then:
   - replace `$SCRATCH/env.sh` with these four lines, writing your scratch path for `<scratch>`:

     ```sh
     export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH
     export S=<scratch>
     export COMPOSE_PROJECT_NAME=jeeves-pf12 LOCAL_HTTP_PORT=45800 LOCAL_IDENTITY_PORT=45801 LOCAL_OBJECT_PORT=45802
     export APP=$S/app FIXTURE=$S/media/youtube-v1-fixture.mp4 INVALID=$S/media/invalid.mp4
     ```

   - make the helpers source the `env.sh` beside them:
     `sed -i 's|^\. /.*/env\.sh$|. "$(dirname "$0")/env.sh"|' "$SCRATCH"/*.sh`;
   - start with empty results, in one place for both script families:
     `rm -rf "$SCRATCH/runs" && mkdir "$SCRATCH/runs" && ln -s ../runs "$SCRATCH/harness/runs"`;
   - write `$SCRATCH/harness/pf.mjs` (below) and keep it in the evidence.
3. The media: `mkdir -p "$SCRATCH/media"`, copy
   `field-projects/youtube/v1/app/.runtime/media/youtube-v1-fixture.mp4` into it, and
   `chmod a-w` the copy.
4. In `$SCRATCH/app`, with `. "$SCRATCH/env.sh"`: `pnpm install --frozen-lockfile --ignore-scripts`,
   `pnpm build`, `pnpm first-run`, `node scripts/accounts.mjs`. Expect 15 healthy containers
   (`docker compose --profile '*' ps`).

Every harness command below runs as `cd "$SCRATCH/harness" && . ../env.sh && node <script> …`;
each writes `$SCRATCH/runs/<label>.json`. `<word>` is a new unique word for each upload's title.
Database reads use
`docker exec jeeves-pf12-local-postgres-1 psql -U postgres -d d_metadata -Atc "<sql>"`.

`pf.mjs` (built on V3-17's `lib.mjs`; its token-free steps were tried against a stub server):

```js
// PF12/PF13 steps by API through the edge, on V3-17's lib.mjs. Tokens stay in memory.
// node pf.mjs <step> <label> [args]. Writes ./runs/<label>.json.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { api, log, token } from "./lib.mjs";

const W = "/api/watch-api/modules";
const details = (id) => `${W}/watch-api-video-details-cache/${id}`;
const count = (id) => `${W}/watch-api-view-count-reader/${id}`;
const play = (id) => `${W}/watch-api-view-publisher/${id}`;
const search = (q) => `/api/search-api/modules/search-api-video-search?q=${encodeURIComponent(q)}`;
const FAV = "/api/account-api/modules/account-api-favorite-videos/items";
const ME = [
  `${W}/watch-api-viewer-check/me`,
  "/api/upload-api/modules/upload-api-creator-check/me",
  "/api/account-api/modules/account-api-account-check/me",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Reads every `every` ms until `done` holds or `ms` pass; keeps only the last read in the log. */
async function poll(read, done, ms, every = 250) {
  const started = Date.now();
  for (;;) {
    const entry = await read();
    if (done(entry) || Date.now() - started >= ms) return { entry, afterMs: Date.now() - started };
    log.pop();
    await sleep(every);
  }
}
const [step, label, ...args] = process.argv.slice(2);
if (!label) throw new Error("Usage: node pf.mjs <step> <label> [args]");
const out = { step, label, args };
switch (step) {
  case "signin": {
    const creator = { who: "creator", bearer: await token("creator") };
    const viewer = { who: "viewer", bearer: await token("viewer") };
    for (const path of ME) {
      await api("GET", path);
      await api("GET", path, creator);
      await api("GET", path, viewer);
    }
    break;
  }
  case "ready": {
    const [id, seconds = "120"] = args;
    const seen = await poll(
      () => api("GET", details(id)),
      (e) => e.status === 200,
      Number(seconds) * 1000,
      2000,
    );
    out.ready = { status: seen.entry.status, afterMs: seen.afterMs };
    break;
  }
  case "details": {
    const [id, times = "1"] = args;
    for (let i = 0; i < Number(times); i++) await api("GET", details(id));
    out.statuses = log.map((e) => e.status);
    break;
  }
  case "plays": {
    const [id, n = "1"] = args;
    const before = BigInt((await api("GET", count(id))).body.views);
    const ids = Array.from({ length: Number(n) }, () => randomUUID());
    for (const eventId of ids) await api("POST", play(id), { body: { eventId } });
    const expected = before + BigInt(ids.length);
    const seen = await poll(
      () => api("GET", count(id)),
      (e) => e.status === 200 && BigInt(e.body.views) >= expected,
      10000,
    );
    for (const eventId of ids) await api("POST", play(id), { body: { eventId } });
    await sleep(5000);
    const settled = await api("GET", count(id));
    out.counts = {
      before: String(before),
      expected: String(expected),
      after: seen.entry.body?.views,
      visibleAfterMs: seen.afterMs,
      settled: settled.body?.views,
    };
    out.playStatuses = [...new Set(log.filter((e) => e.method === "POST").map((e) => e.status))];
    break;
  }
  case "search": {
    const [word, id] = args;
    const hits = (e) => (e.body?.hits ?? []).filter((hit) => hit.videoId === id).length;
    const seen = await poll(
      () => api("GET", search(word)),
      (e) => hits(e) > 0,
      10000,
    );
    out.search = { status: seen.entry.status, found: hits(seen.entry), afterMs: seen.afterMs };
    break;
  }
  case "favorites": {
    const [id] = args;
    const viewer = { who: "viewer", bearer: await token("viewer") };
    await api("PUT", `${FAV}/${id}`, viewer);
    await api("GET", `${FAV}/${id}`, viewer);
    const listed = await api("GET", FAV, viewer);
    out.listed = (listed.body?.items ?? []).some((item) => item.itemId === id);
    await api("DELETE", `${FAV}/${id}`, viewer);
    await api("PUT", `${FAV}/${id}`);
    break;
  }
  default:
    throw new Error("Steps: signin, ready, details, plays, search, favorites");
}
out.log = log;
writeFileSync(new URL(`./runs/${label}.json`, import.meta.url), JSON.stringify(out, null, 2));
for (const e of log) console.log(`${e.method} ${e.path} [${e.who}] → ${e.status}`);
console.log(JSON.stringify({ ...out, log: undefined }));
```

If a harness script fails for a reason that isn't the app's behaviour, fix the script (it is
evidence, not app code), say what you changed, and keep it in the evidence.

**Part A — one copy of each process.** Record each as Observed or Failed, with the status codes.

| Step | Do | Expect |
| --- | --- | --- |
| A1 | `node pf.mjs signin a1` | The three sign-in module routes, `/api/watch-api/modules/watch-api-viewer-check/me`, `/api/upload-api/modules/upload-api-creator-check/me` and `/api/account-api/modules/account-api-account-check/me`, answer 200 with each token; without a token Watch's answers 200 `{"signedIn":false}` and the other two 401 |
| A2 | `node upload.mjs a2 fixture:<word>` (V3-17's: start, three parts, complete; the video ID is in `runs/a2-ids`), then `node pf.mjs ready a2-ready <videoId>` | Upload 200s; details 404 until ready, then 200 within 120 s (`ready.status` 200). This video is **A** |
| A3 | `node pf.mjs details a3 <A> 2`, then `docker exec jeeves-pf12-cache-hot-metadata-1 sh -c 'REDISCLI_AUTH="$(cat /run/secrets/cache-hot-metadata)" valkey-cli EXISTS ready-video:v1:<A>'` | 200 twice; the cache check prints 1 |
| A4 | `node pf.mjs plays a4 <A> 1` | `playStatuses` `[202]`; `counts.after` and `counts.settled` both equal `counts.expected` (`before` + 1): the resent play counted once |
| A5 | `node pf.mjs search a5 <word> <A>` | 200 with A as one hit within 10 s (`search.found` 1) |
| A6 | `node pf.mjs favorites a6 <A>` | PUT 200, GET 200, `listed` true, DELETE 204; PUT without a token 401 |

**Part B — two copies.** Run this one command in `$SCRATCH/app`, with the same environment. It
names the eight services so that no setup job runs again:

```sh
docker compose --profile application up -d --no-recreate --no-deps \
  --scale app-watch-api=2 --scale app-upload-api=2 --scale app-search-api=2 \
  --scale app-account-api=2 --scale app-video-lifecycle=2 --scale app-view-counter=2 \
  --scale app-search-indexer=2 --scale app-transcoder=2 \
  app-watch-api app-upload-api app-search-api app-account-api \
  app-video-lifecycle app-view-counter app-search-indexer app-transcoder
```

Wait until `docker compose --profile '*' ps` shows 23 containers, every one healthy (up to
180 s). Record that output.

| Step | Do | Expect |
| --- | --- | --- |
| B1 | `node pf.mjs details b1 <A> 20`; then `node pf.mjs search b1-search-<n> <word> <A>` and `node pf.mjs favorites b1-fav-<n> <A>` for `<n>` = 1 to 20 | Every answer as in Part A |
| B2 | `docker stop jeeves-pf12-app-watch-api-1`; wait 11 s (the edge re-resolves names every 10 s); `node pf.mjs details b2-1 <A> 20`. `docker start` it; stop `jeeves-pf12-app-watch-api-2`; wait 11 s; `node pf.mjs details b2-2 <A> 20`. `docker start` it | 200 every time |
| B3 | `node pf.mjs plays b3 <A> 50` | `counts.settled` equals `counts.expected` (`before` + 50) |
| B4 | `node upload.mjs b4 fixture:<word2>`, then `node pf.mjs ready b4-ready <B>` and `node pf.mjs search b4-search <word2> <B>` | B becomes ready; `search.found` 1; `select count(*) from published.videos where video_id='<B>'` prints 1 |

**Record.** Write `field-projects/youtube/v4/notes/scenarios.md`: the two tables with a Verdict
column and what was seen. Put raw outputs (the `runs/` files, `ps` outputs, the Docker
inventory) under `docs/plans/production-foundations/evidence/pf12/` (gzip anything over 100 KB),
with a `README.md` that lists them.

**Leave the stack running**, scaled to two, for PF13. Do not clean up. In the handoff entry's
**For the next unit**, give `$SCRATCH`, the project name and the three ports, and say whether
all 23 containers are healthy.

**Commit:** `PF12: run v4 with one and two copies`.

### PF13 — Run v4: faults and a throughput sample

**Goal:** on PF12's two-copy stack, record what v4 does when the cache, the broker and a worker
stop, and how fast one read path answers; then clean up. **Change no code.** Record failures and
go on, as in PF12.
**Checks:** none (evidence and notes only).
**Project and ports:** PF12's, from its handoff (`jeeves-pf12`, 45800, 45801 and 45802), and its
`$SCRATCH`.

**Setup.** `docker compose --profile '*' ps` in PF12's `$SCRATCH/app` must show its 23 healthy
containers; if the stack isn't there, stop (rule 2). Use PF12's harness as it left it. Upload
the fixture once and wait for ready (`node upload.mjs f-a fixture:<word>`, then
`node pf.mjs ready f-a-ready <videoId>`): this video is **A**. Before each fault, record a
boundary (`date -u +%Y-%m-%dT%H:%M:%SZ`) and read each container's log only since it
(`docker logs --since <boundary> <container>`).

| Step | Do | Expect |
| --- | --- | --- |
| F1a | `docker stop jeeves-pf12-cache-hot-metadata-1`; `node pf.mjs details f1a <A> 10` | 200 every time. Since the boundary, each `app-watch-api` container's log (`jeeves-pf12-app-watch-api-1` and `-2`) has a line with `"event":"failure"` and `"what":"cache watch-api-video-details-cache"` |
| F1b | `docker start jeeves-pf12-cache-hot-metadata-1`; wait 15 s; delete A's key (`docker exec jeeves-pf12-cache-hot-metadata-1 sh -c 'REDISCLI_AUTH="$(cat /run/secrets/cache-hot-metadata)" valkey-cli DEL ready-video:v1:<A>'`); `node pf.mjs details f1b <A> 2` | 200 twice; the `EXISTS` check (as in A3) prints 1; since F1b's boundary each `app-watch-api` log has `"event":"cache"` with `"state":"available"` |
| F2a | `docker stop jeeves-pf12-local-broker-1`; wait 20 s; `docker compose --profile '*' ps -a`; `node pf.mjs details f2a <A> 1`; `node pf.mjs search f2a-search <word> <A>` | Record which `app-*` containers exited and which stayed. Details and search are expected to answer or to answer 503: record which. |
| F2b | `docker start jeeves-pf12-local-broker-1`; in `$SCRATCH/app`, `pnpm start`; record `docker compose --profile '*' ps`; run PF12's Part B scale command again and wait for 23 healthy containers; `node pf.mjs plays f2b <A> 1` | Everything healthy with two copies again; `counts.settled` equals `counts.expected`. (Whether `pnpm start` itself changes the number of copies is not known: record what `ps` showed.) |
| F3 | `node upload.mjs f3 fixture:<word3>` (video **C**). Poll `select state from upload_api_multipart_uploads.assets where asset_id='<C>'` every 0.5 s. When it is `processing`, find the transcoder running the job: the one of `jeeves-pf12-app-transcoder-1` and `-2` whose `docker top <container>` lists an `ffmpeg` process. `docker kill` that one; wait 5 s; `docker start` it | C becomes ready (`node pf.mjs ready f3-ready <C> 180`); `node pf.mjs search f3-search <word3> <C>` finds it once; `select count(*) from published.videos where video_id='<C>'` prints 1 |
| T1 | `node "$SCRATCH/reads.mjs" "http://127.0.0.1:$LOCAL_HTTP_PORT/api/watch-api/modules/watch-api-video-details-cache/<A>" 2000 50` (the script below), three times | `failed` is 0 each time. Record `perSecond`, `p50Ms`, `p95Ms` and `p99Ms`; there is no pass mark for speed. |

**F3 if the job is never caught running.** Try F3 with three uploads (C1–C3). If no transcoder
was seen running `ffmpeg` while the state was `processing`, mark F3 **Unverified** (a worker
killed during a delivery was not observed). Then record, as a separate row **F3b**, the simpler
case: `docker stop` both transcoders, complete an upload, wait 10 s, `docker start` both, and
expect it ready within 180 s. F3b is not a result for F3.

`reads.mjs` (keep it in the evidence folder; each request gives up after 10 s):

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
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
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
count, memory) beside the T1 numbers, and that they are from one laptop. Then clean up as the
Docker rules say, and compare the Docker inventory with PF12's.

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
   `refused` must be empty, `counts.create` and `counts.replace` must be 0 and `remove` must be
   empty, and `override` and `keepChanged` must list only the paths v4's notes document. If not,
   v4 isn't on the final templates: say so first in the review.
3. Sweep the docs for false statements: read `AGENTS.md`, `jeeves/README.md`, `jeeves/PLAN.md`,
   `jeeves/CATALOG.md`, `docs/studio.md` (the sections this plan touched),
   `jeeves-generator/README.md`, `docs/glossary.md` and `docs/template-gaps.md`. Fix a false
   sentence only when the code proves it false; list each fix.
4. Fix a defect only if it is inside one of this plan's units, has a failing test you can write
   first, and needs fewer than 40 changed lines. A fix that changes emitted code is a follow-up
   unless you also regenerate v4 (`update:v2` without `--check`), rerun its 19 tests in a
   scratch copy and repeat step 2; PF14 runs no Docker, so then say in the review that PF12's
   and PF13's evidence covers the templates before that fix. List everything else as a
   follow-up.
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
