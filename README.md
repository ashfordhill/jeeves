# Jeeves

Jeeves turns a software design into a working, tested application by combining strict, reusable templates with coding agents. Draw Jeeves is its design canvas. See [PLAN.md](PLAN.md) for the architecture and build plan.

Browse [CATALOG.md](CATALOG.md) for system offerings and reusable C2/C3 building
blocks, with implemented and planned capabilities distinguished. The shared C1/C2/C3
editor keeps chat, diagrams and selected-object controls together. **Library**
includes editable SaaS architecture examples and planned capacity options; those
options do not generate runtimes or certify traffic targets.

Current status: qrwty has a working Library, saved artwork Studio and bounded owner Analytics. Jeeves can generate a complete [QR Studio product recipe](recipes/README.md) or an editable [resource application starter](starters/README.md) without implementation-model calls for their supplied features. The same design has intentional C4 context/container/component views, structured resource and screen editors, and explicit project extension seams. Experimental [durable delivery](packages/durable-events/README.md) supplies transactional events and finite retry policies; it is locally proven, not cloud infrastructure. Exact package evidence and limits are in the [handoffs](docs/handoff.md) and [current architecture/product review](docs/architecture-product-review-2026-10-31.md).

**Draw** authors the model by mouse or optional design chat. **Generate** writes the owned template project and runs checks. **Runs** derives remaining work and can execute it through configured coding agents. Supplied recipe/resource behavior needs no implementation run; new domain behavior still needs contracts and independent acceptance. S1–S12 are implemented, the original S13 attempt remains partial, and S14 local models are deferred. Current work follows the [bounded package plan](docs/build-plan-execution.md).

For local implementation work, use the [repeatable task runner and source-reference cache](docs/developer-workflow.md). The [architecture reference review](docs/reference/enterprise-architecture.md) connects inspected open-source applications to proposed reusable components; proposed capabilities are not yet generated features.

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm via Corepack: `corepack enable`
- Docker with Compose (for Jeeves's Postgres)

## Run

```bash
pnpm install
pnpm dev          # starts Postgres in Docker, the API on :4310 and the UI on :4300
```

Open http://127.0.0.1:4300. The status bar shows "Server healthy" once the API can reach Postgres. `pnpm db:down` stops Postgres (data stays in the `jeeves-pg` volume). The server applies pending database migrations (`apps/server/drizzle/`) every time it starts. After changing `apps/server/src/db/schema.ts`, run `pnpm --filter @jeeves/server db:generate` to add a migration.

## Structured resources and the production editor

P3 implements the [approved resource and editor architecture](docs/improvements.md#p3-implementation-notes). Place a **Service**, choose its subtype, then add compatible components. Postgres has a distinct database shape. All connections attach to outer elements; ambiguous capabilities appear as inspector choices. Subtype changes show the exact discarded data and require a human confirmation. Moving/resizing saves layout without changing the design revision.

A REST server component can declare a validated resource model through **Configure resources** in the inspector: select its database, author typed fields/relationships and choose supported CRUD operations. Advanced JSON and design chat remain available. See [the complete example](fixtures/designs/resources.json). Set session authentication, select the owning service's Postgres connection ID in `model.storeConnection`, and provide fixed extension contracts and acceptance references. Generate produces standard owner-scoped CRUD, account/session routes, contracts, clients, migrations, and isolated HTTP tests. Extension implementation remains project-owned. Configure the generated Compose environment references (for the example, `DB_LINKS_PASSWORD` and `LINKS_PUBLIC_ORIGIN`) in the generated project's ignored `.env` before starting it. Use the deployment's fixed public origin.

Regeneration preserves custom files and immutable SQL. Destructive changes stop before writes with affected resource/field IDs; reviewed SQL is available through the generator API. Converting an existing custom API contract to generated ownership requires an explicit project migration. The structured editor preserves stable resource/field IDs and exact extension contracts; recipe-provided core definitions remain protected. **Configure resource workspace** selects actual API-bound resources, labels, columns, page size and visual preset without duplicating the backend schema. P11 completed the qrwty application and QR-01–QR-09 proof; the continuing product packages preserve those invariants.

P4 runs generated session/CRUD tests and fixed project acceptance in disposable Compose fixtures with fresh volumes. Generate reports infrastructure readiness, template conformance and deferred application acceptance separately. Required empty smoke coverage, missing examples and missing fixed acceptance references fail with operation IDs. PNG data and documented redirect headers are verified explicitly; P11–P19 added QR decoding and complete fixed QR product acceptance.

For structured services, Runs seeds one narrow task per declared extension, using its operation contract and acceptance references. It bypasses the planner for generated CRUD and service boundaries. Legacy designs retain notes-based planning. Fixed suites are registered before coding by `pnpm qrwty:bootstrap` (or `generateProject({ fixedAcceptance: [...] })`); each has `id`, `service`, `operationIds`, `acceptanceIds`, optional `requires` (`extensions` or `frontend`), a `node`/`playwright` runner, exact test dependencies, support files, and source. They become protected files in `tests/acceptance/`, survive regeneration, and run independently of agent-owned tests. A run cannot finish successfully until every declared acceptance case has a passing suite. See [P4 implementation notes](docs/improvements.md#p4-implementation-notes) and the [qrwty bootstrap](docs/examples/qrwty.md).

## Architecture and product configuration

Open **Architecture** at the lower left of Draw to explore the same design as **Context**, **Containers** or **Components**. Context records people, external systems and purpose. Containers use actual application/data-store bindings and connections. Components expose cohesive generated responsibilities and declared extension modules within one application; data contracts remain separate. The inspector shows provision, provenance and acceptance references, with a full relationship list. **Focus selected object**, zoom and **Fit View** keep large scopes usable by mouse. **Edit on board** returns to the real configuration without moving the board or changing its camera.

**Edit context** saves one undoable semantic change. Unbound system interactions remain visible intent with a warning. **Product configuration** on a QR Studio recipe edits title, tagline and the default analytics range; Save is one undo step and Cancel discards the draft. Generate applies saved configuration to the generated app. Neither form restarts a running application. Stable printed-link origins require a separate reviewed migration.

**Create target from this design** in the project menu creates a separate planning workspace with
a frozen source baseline. Current baseline / Proposed target / Changes keeps the saved topologies
and later source drift distinct. Targets copy pins/configuration and retain recipe protection;
an explicit conceptual replacement records a reason and its original recipe in the baseline.
Targets cannot take an output folder, generate or start runs, and inherit no verification passes.
**Suggest responsibility annotations** previews editable C1/C3 drafts with exact binding sources.
See the [target workspace guide](docs/architecture-targets.md).

**Inspect evidence** shows the latest recorded generation and implementation run beside the current design revision. It separates readiness stages, template conformance and application acceptance, scopes named checks to their actual service, and marks stale/different-output evidence. **Supplied & project work** describes current responsibilities. Refresh is read-only; Open Generate and Open Runs lead to the actual workflows. Stored results do not inspect current files or live deployments.

**Deployment plans** in Editor actions adds editable hosted/private placement alternatives over the same logical C2 identities. Declare nested hosting boundaries, container replicas, broker infrastructure with distinct logical channels, external products and traced interactions. Save/Cancel, semantic history and P49 diagram layout stay separate from runtime evidence. Existing infrastructure can be explicitly mapped after review; source C2 is retained. **Local deployment** remains P33's derived read-only view for supported HTTP templates. Neither view provisions resources or proves capacity/failover. See the [deployment planning contract](docs/architecture-deployments.md).

These are C4-informed views, not a claim of production certification or automatic internal-call discovery. Focused views and saved layouts are available; P54 adds scenario outcomes/client journeys, and P55 adds [local reusable architecture templates](docs/architecture-library.md). P56 adds [staged QRWTY and Inventory design proofs](docs/evidence/p56/README.md), with six QR scenario families and open production objectives. See [P20 evidence and comparison](docs/evidence/p20/README.md) for the original scope.

## User guide: from a brief to a running app

This is the supported workflow. The original S13 attempt stopped during implementation because of provider credits; P11 subsequently completed the qrwty real-provider proving run. See `docs/handoff.md` for that application's acceptance and usage evidence. This does not establish completion for arbitrary application briefs.

1. **Choose a starting point.** Open the project menu → **New project**. Pick an editable **Resource workspace**, protected **QR Studio**, or **Blank canvas**, name it and create a separate diagram. The resource starter supplies accounts and private Inventory records that you can reshape. Provider setup is optional for supplied behavior; to use design chat or implement additional work, open **Settings**. Each role (design chat, planner, coding agent) has a provider and a model. With only a ChatGPT plan, choose **Codex** for all three and leave the model empty to use Codex's default; run `codex login` first. With an OpenAI API key that has credits, the design chat and planner can use **OpenAI API** instead (it streams replies and is quicker per call). See [Providers and models](#providers-and-models).
2. **Describe additional work, if needed.** Open the rail's **Chat** tab, **Attach** a Markdown brief (or a PNG/SVG sketch), and ask for a design, e.g. "Make me a design for the app in the attached brief." The assistant reads the template catalog, places elements, attachments, and connections, and writes implementation notes for each. The whole turn is one undo step.
3. **Adjust it.** Click a card to open it in the **Inspector**: change config values, edit the notes (they're what the coding agents implement), add or remove attachments, or draw connections with the Connector tool. The **Findings** tab lists anything that blocks generation.
4. **Generate.** Press **Generate**, keep **Run the baseline check** on, and press **Generate project**. "Green" means the template project installs, type checks, starts in Docker, and passes every template test pack, before any AI writes code.
5. **Plan remaining work, if any.** Supplied resource screens and QR recipe behavior need no implementation task. For additional work, open **Runs** → **Plan a run**. Review the generated capabilities, coding model, verification layers and execution mode. Continuous is the default; **Review after each task** pauses after verification and commit. Read the tasks: edit, reorder, or remove any before pressing **Start**. Each task runs a coding agent, then Jeeves's own checks, then a commit. Click an attempt for its live log, check results, and diff. A failed task is retried with the check output; if it still fails, the run stops as **Needs attention** and **Resume** tries again.
6. **Run the app.** The work is on the run branch in the project folder:

   ```bash
   cd ~/jeeves-projects/<project>
   # If an implementation run was needed:
   git merge jeeves/run-<id>        # or: git checkout jeeves/run-<id>
   docker compose up --build --wait
   docker compose port <web element id> 5173   # prints 127.0.0.1:<port>; open it
   ```

   Starter/recipe frontends use their allocated stable loopback port; other generated services can publish random local ports, so `docker compose port` (or `docker compose ps`) tells you where. `docker compose down` stops it (data stays in its volumes).

To change the app later: edit the design, generate again (project-owned files and the agents' work are kept), and plan a new run.

## Providers and models

Settings lists each provider's connection status and setup command (CLI logins are exact; API-key providers show the `export …=` prefix to complete). **Design model** and **Implementation model** are in the Models card; the planner is under **Advanced**. Each role picks a provider and a model (type any name; the list only suggests some). Choices are saved to `~/.jeeves/config.json` (`JEEVES_HOME` moves that directory).

| Provider | Roles | Set up |
| --- | --- | --- |
| **OpenAI API** | design chat, planner | `OPENAI_API_KEY=sk-… pnpm dev`, or `{ "openai": { "apiKey": "sk-…" } }` in `~/.jeeves/config.json` (keep it `chmod 600`). The environment wins. API usage is billed separately from ChatGPT plans, so the account needs credits |
| **Codex** | design chat, planner, coding | `codex login` once (a ChatGPT plan or an API key). An empty model means Codex's default from `~/.codex/config.toml`. The coding role can also set a reasoning effort |
| **OpenCode** | coding | `npm i -g opencode-ai` (v1) or the OpenCode 2 installer, then `opencode auth login` once (for example DeepSeek). Jeeves detects which CLI version is on PATH. The model is `provider/model` (for example `deepseek/deepseek-flash`) or empty for OpenCode's configured default. OpenCode has **no sandbox**: `--auto` approves its tool calls, and Jeeves's owned-path revert plus the task branch are the guard |
| **Local model** | coming in S14 | Shown as "coming later" |

As a design chat or planner model, Codex answers each step in one structured reply instead of streaming, and a chat turn takes about a minute. Jeeves never shows or stores keys in designs or generated projects. A Claude adapter needs an Anthropic API key and is planned after v1 (PLAN §12).

Setting `JEEVES_FAKE_MODEL_SCRIPT=<file>` makes the server replay a scripted fake model instead (the e2e suite uses `fixtures/chat/e2e-script.json`).

## Generate

The **Generate** button (top right of the board) opens the output drawer. Pick an output folder (the default is `~/jeeves-projects/<project name>`; `JEEVES_PROJECTS_DIR` moves the parent) and press **Generate project**. Jeeves writes the template project there: every element as its template, wired together with a `docker-compose.yml`, vendored runtime packages, `jeeves/lock.json`, per-element notes in `jeeves/elements/`, and an `AGENTS.md`. A new folder gets a git repository with an initial commit.

With **Run the baseline check** on, Jeeves then runs `pnpm install`, `pnpm -r typecheck`, `docker compose up --build --wait`, and every template's test pack (Playwright's Chromium is used for web apps), then `docker compose down` (volumes are kept). The drawer streams the output. A design needs no error-level findings to generate.

Generating again is safe: files Jeeves owns (listed with hashes in `jeeves/lock.json`) are rewritten, project-owned files are never touched, and missing dependencies are added to each element's `package.json`. If a generated-owned file was edited by hand, Jeeves stops without writing anything and names the file. Removed elements are reported, never deleted.

### qrwty bootstrap

The qrwty proving application uses a committed design and reviewed acceptance suites instead of hand-authoring the large resource model. With the API server running (`pnpm dev`), run:

```sh
pnpm qrwty:bootstrap [--output-dir ~/github/qrwty] [--api http://127.0.0.1:4310] [--public-origin http://127.0.0.1:5173]
```

It creates or reuses the `qrwty` project through the API, applies `fixtures/designs/qrwty.json` through the validated operations endpoint, points the project at the output folder (default `~/github/qrwty`), merges the folder's `.env` (existing variables are kept) with `DB_QRWTY_PASSWORD` and `QRWTY_PUBLIC_ORIGIN`, and runs **Generate** through the server with the `qrwty` acceptance pack and no baseline. It then reads `jeeves/lock.json` back and proves six suites are registered. If the folder was already a git work tree with uncommitted changes, it commits `Generate qrwty template project (design revision N)`. The repository's existing `README.md` and `.docs/` are left alone, and the generated `.gitignore` ignores `.env`. Open the app at exactly `http://127.0.0.1:5173` (not `localhost`), because the browser/CSRF origin and the QR payload origin must match. `--public-origin` must equal the fixture's web `hostPort`. Run Generate in the UI with the baseline before planning a run.

## Runs

After generating, open **Runs** and press **Plan a run**. Jeeves reads the generated project (`jeeves/lock.json`, `jeeves/design.json`, `jeeves/elements/*.md`). Structured services get narrow tasks from unresolved extensions and fixed acceptance references; generated CRUD needs no planner call. Legacy designs get tasks from implementation notes, in dependency order. For legacy plans, the planner model (Settings, "Planner") may split tasks and add acceptance tests. Without a key, or if the planner fails, the plan is the seed and the run says why. A task may only change its element's owned paths.

Before starting, you can edit a task's title, description, and acceptance tests, move tasks up or down (a task moved ahead of something it depends on gets a warning), and remove tasks. **Start** runs the tasks one at a time. **Continuous** proceeds through verified tasks; **Review after each task** pauses after verification and commit while tasks remain. The mode is saved across reloads/restarts and can change while stopped between tasks. **Pause** stops after the current task, **Resume** continues, and **Cancel run** stops everything. Planning and each step are pg-boss jobs in Jeeves's Postgres, and run state is saved there. If Jeeves restarts mid-task, that attempt is marked interrupted and the run waits, paused, for **Resume**.

**Execution.** Each task runs a [Codex](https://github.com/openai/codex) or [OpenCode](https://opencode.ai) session in the project folder with a brief: the task and its acceptance tests, the element's notes and template guide, the paths it may change, neighbouring API contracts, the checks, and `AGENTS.md`. Codex is sandboxed to the folder with the network on for `pnpm install`; OpenCode has no sandbox, so Jeeves's owned-path revert and the task branch are the guard. When the agent stops, Jeeves itself:

1. reverts and rejects changes outside the task's owned paths (and to generated-owned files),
2. runs `pnpm install`, the type check, `pnpm -r test`, `docker compose up --wait`, and every template test pack (then `docker compose down`),
3. on success commits the task; on failure sends the check output back to the same Codex session, up to the retry limit (default 2), after which the task needs attention and the run stops.

A Codex credential or quota problem moves the run to **Waiting for provider** instead; fix it and press **Resume**. **Resume** after a failure or a restart tries the task again from the work already in the folder (a new session after a restart is told what's there).

Git: every run works on `jeeves/run-<id>`, branched from what the project had checked out; uncommitted changes there (such as `pnpm-lock.yaml` after Generate) are committed first. The project's git strategy (Runs sidebar, "New run settings") is **branch per task** (`jeeves/run-<id>-<task>`, merged with `--no-ff` after the checks pass) or **direct** (commits on the run branch). Jeeves never pushes or touches your other branches; merge the run branch yourself. Generate is refused while a run is executing.

Click an attempt to see its live log (agent messages, commands, file edits, and each check), the check results, the changed files, and the diff. The overview shows progress, current activity, elapsed time, blockers and implementation usage. The sidebar sums initial-build and feature runs, including planning, failures, retries and interrupted work; design chat is excluded. Unknown tokens/cost retain known subtotals and reporting coverage (Codex does not report cost). Open **Usage ledger, provenance and human help** for actual model requests, generated design hash/revision, templates, starting Git revision, execution settings and timestamped interventions. Use **Record note** to log human help or review. Historical usage is imported where available; older missing evidence cannot be reconstructed. New feature runs currently seed declared extensions again, so prior task keys alone never imply acceptance.

Codex uses its own login: run `codex login` once (ChatGPT or an API key). The Codex CLI comes with the SDK; `JEEVES_CODEX_PATH` points Jeeves at another `codex` binary. The model is Settings → Implementation model (empty for Codex's default, or one your Codex account can use). OpenCode is detected with `opencode --version`; `JEEVES_OPENCODE_PATH` points Jeeves at another binary. Its model is `provider/model`; the Implementation effort select passes `--variant <effort>` on OpenCode 1 and appends `#<effort>` on OpenCode 2.

## Test

```bash
pnpm check        # Biome lint, type check, Vitest unit tests (no Docker needed; API tests use in-process PGlite)
pnpm test:e2e     # Playwright; starts Postgres and both apps itself
pnpm test:templates  # template conformance tests and the generator baseline (Docker, Chromium, network; several minutes)
```

In e2e tests the chat and planner replay `fixtures/chat/e2e-script.json`, and tasks run a scripted coding agent (`fixtures/coding/e2e-script.json`) with quick marker checks instead of Docker; see `playwright.config.ts`.

Playwright's Chromium needs system libraries. If it fails with a missing `libnspr4.so` (or similar), either install them once with `sudo pnpm exec playwright install-deps chromium`, or run the suite inside the official Playwright image with `pnpm test:e2e:docker`.

## Layout

```text
apps/web          Jeeves UI (React, Vite, Mantine)
apps/server       Fastify API, Drizzle + Postgres, pg-boss jobs for runs
packages/*        spec, registry, providers (OpenAI + fake model), template-kit (template contract + conformance harness), generator (design to template project, baseline check), orchestrator (seed planning, planner refinement, run states, the task-execution seam)
templates/        versioned service/data/frontend templates and REST, durable-events, resource-workspace, local-execution attachments
docs/             sources, template briefs, handoff log, reference notes
```

Existing editable templates can use [reviewed compatible upgrades](docs/templates/compatible-upgrades.md) to gain new attachment choices while preserving the application. Protected recipes retain separate release boundaries.

## Current architecture review

The [review through P29](docs/architecture-product-review-2026-10-31.md) compares current capability with the original PLAN, Excalidraw and automation-pitch visual improvements, and separates proven local behavior from remaining enterprise needs. The [qrwty acceptance milestone](docs/examples/qrwty.md) is complete for its documented envelope. The historical editor comparison remains available at `http://127.0.0.1:4300/editor-review.html` with `pnpm --filter @jeeves/web dev`; it makes no project writes and is excluded from production builds.
