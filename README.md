# Jeeves

Jeeves turns a software design into a working, tested application by combining strict, reusable templates with coding agents. Draw Jeeves is its design canvas. See [PLAN.md](PLAN.md) for the architecture and build plan.

Status: S1–S12 are implemented; S13 is partial (see `docs/handoff.md`). The real-provider journey stopped on the first coding task when credits ran out; a completed application has not been demonstrated. The next work is the [deterministic behavior and qrwty plan](docs/improvements.md); S14 local models are deferred. The Draw view has a working board with an inspector, findings, undo/redo, and a design chat (the rail's Chat tab) that edits the board for you. **Generate** writes a runnable template project for the design and checks that it's green. **Runs** plans the generated project into tasks that you can edit and reorder, then runs each task with Codex, checks the result itself, and commits it to a run branch. Settings picks the provider and model for each role (design chat, planner, coding).

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

A REST server component can declare a validated resource model using its inspector JSON field or design chat. See [the complete example](fixtures/designs/resources.json). Set session authentication, select the owning service's Postgres connection ID in `model.storeConnection`, and provide fixed extension contracts and acceptance references. Generate produces standard owner-scoped CRUD, account/session routes, contracts, clients, migrations, and isolated HTTP tests. Extension implementation remains project-owned. Configure the generated Compose environment references (for the example, `DB_LINKS_PASSWORD` and `LINKS_PUBLIC_ORIGIN`) in the generated project's ignored `.env` before starting it. Use the deployment's fixed public origin.

Regeneration preserves custom files and immutable SQL. Destructive changes stop before writes with affected resource/field IDs; reviewed SQL is available through the generator API. Converting an existing custom API contract to generated ownership requires an explicit project migration. Resource-model JSON authoring is supported; a dedicated field-by-field resource builder is not included. The qrwty application and QR-01–QR-09 proof follow P5.

P4 runs generated session/CRUD tests and fixed project acceptance in disposable Compose fixtures with fresh volumes. Generate reports infrastructure readiness, template conformance and deferred application acceptance separately. Required empty smoke coverage, missing examples and missing fixed acceptance references fail with operation IDs. PNG data and documented redirect headers are verified explicitly; QR decoding remains part of qrwty's later proof.

For structured services, Runs seeds one narrow task per declared extension, using its operation contract and acceptance references. It bypasses the planner for generated CRUD and service boundaries. Legacy designs retain notes-based planning. Before coding, supply reviewed fixed suites via `generateProject({ fixedAcceptance: [...] })`; each has `id`, `service`, `operationIds`, `acceptanceIds`, and Node `node:test` `source`. These become protected files in `tests/acceptance/`, survive regeneration, and run independently of agent-owned tests. See [P4 implementation notes](docs/improvements.md#p4-implementation-notes) for fixture requirements and limits.

## User guide: from a brief to a running app

This is the supported workflow. S13 exercised it through generation and planning, then stopped during the first implementation task because of provider credits (`docs/handoff.md`, S13). The final application steps remain unverified on real providers.

1. **Pick providers.** Open **Settings**. Each role (design chat, planner, coding agent) has a provider and a model. With only a ChatGPT plan, choose **Codex** for all three and leave the model empty to use Codex's default; run `codex login` first. With an OpenAI API key that has credits, the design chat and planner can use **OpenAI API** instead (it streams replies and is quicker per call). See [Providers and models](#providers-and-models).
2. **Describe the app.** In **Draw**, open the project menu (top right) → **New project**, then **Rename project** (the name becomes the generated folder's name). Open the rail's **Chat** tab, **Attach** a Markdown brief (or a PNG/SVG sketch), and ask for a design, e.g. "Make me a design for the app in the attached brief." The assistant reads the template catalog, places elements, attachments, and connections, and writes implementation notes for each. The whole turn is one undo step.
3. **Adjust it.** Click a card to open it in the **Inspector**: change config values, edit the notes (they're what the coding agents implement), add or remove attachments, or draw connections with the Connector tool. The **Findings** tab lists anything that blocks generation.
4. **Generate.** Press **Generate**, keep **Run the baseline check** on, and press **Generate project**. "Green" means the template project installs, type checks, starts in Docker, and passes every template test pack, before any AI writes code.
5. **Plan and run.** Open **Runs** → **Plan a run**. Read the tasks: edit, reorder, or remove any before pressing **Start**. Each task runs a coding agent, then Jeeves's own checks, then a commit. Click an attempt for its live log, check results, and diff. A failed task is retried with the check output; if it still fails, the run stops as **Needs attention** and **Resume** tries again.
6. **Run the app.** The work is on the run branch in the project folder:

   ```bash
   cd ~/jeeves-projects/<project>
   git merge jeeves/run-<id>        # or: git checkout jeeves/run-<id>
   docker compose up --build --wait
   docker compose port <web element id> 5173   # prints 127.0.0.1:<port>; open it
   ```

   Compose publishes each service on a random local port, so `docker compose port` (or `docker compose ps`) tells you where. `docker compose down` stops it (data stays in its volumes).

To change the app later: edit the design, generate again (project-owned files and the agents' work are kept), and plan a new run.

## Providers and models

Settings lists each provider with its status, and each role picks a provider and a model (type any name; the list only suggests some). Choices are saved to `~/.jeeves/config.json` (`JEEVES_HOME` moves that directory).

| Provider | Roles | Set up |
| --- | --- | --- |
| **OpenAI API** | design chat, planner | `OPENAI_API_KEY=sk-… pnpm dev`, or `{ "openai": { "apiKey": "sk-…" } }` in `~/.jeeves/config.json` (keep it `chmod 600`). The environment wins. API usage is billed separately from ChatGPT plans, so the account needs credits |
| **Codex** | design chat, planner, coding | `codex login` once (a ChatGPT plan or an API key). An empty model means Codex's default from `~/.codex/config.toml` |
| **Local model** | coming in S14 | Shown as "coming later" |

As a design chat or planner model, Codex answers each step in one structured reply instead of streaming, and a chat turn takes about a minute. Jeeves never shows or stores keys in designs or generated projects. A Claude adapter needs an Anthropic API key and is planned after v1 (PLAN §12).

Setting `JEEVES_FAKE_MODEL_SCRIPT=<file>` makes the server replay a scripted fake model instead (the e2e suite uses `fixtures/chat/e2e-script.json`).

## Generate

The **Generate** button (top right of the board) opens the output drawer. Pick an output folder (the default is `~/jeeves-projects/<project name>`; `JEEVES_PROJECTS_DIR` moves the parent) and press **Generate project**. Jeeves writes the template project there: every element as its template, wired together with a `docker-compose.yml`, vendored runtime packages, `jeeves/lock.json`, per-element notes in `jeeves/elements/`, and an `AGENTS.md`. A new folder gets a git repository with an initial commit.

With **Run the baseline check** on, Jeeves then runs `pnpm install`, `pnpm -r typecheck`, `docker compose up --build --wait`, and every template's test pack (Playwright's Chromium is used for web apps), then `docker compose down` (volumes are kept). The drawer streams the output. A design needs no error-level findings to generate.

Generating again is safe: files Jeeves owns (listed with hashes in `jeeves/lock.json`) are rewritten, project-owned files are never touched, and missing dependencies are added to each element's `package.json`. If a generated-owned file was edited by hand, Jeeves stops without writing anything and names the file. Removed elements are reported, never deleted.

## Runs

After generating, open **Runs** and press **Plan a run**. Jeeves reads the generated project (`jeeves/lock.json`, `jeeves/design.json`, `jeeves/elements/*.md`) and makes one task per element or attachment that has implementation notes, in dependency order: databases, then services, then their clients, then frontends. The planner model (Settings, "Planner") may split tasks and adds acceptance tests to each. Without a key, or if the planner fails, the plan is the seed and the run says why. A task may only change its element's owned paths.

Before starting, you can edit a task's title, description, and acceptance tests, move tasks up or down (a task moved ahead of something it depends on gets a warning), and remove tasks. **Start** runs the tasks one at a time, **Pause** stops after the current task, **Resume** continues, and **Cancel run** stops everything. Planning and each step are pg-boss jobs in Jeeves's Postgres, and run state is saved there. If Jeeves restarts mid-task, that attempt is marked interrupted and the run waits, paused, for **Resume**.

**Execution.** Each task runs a [Codex](https://github.com/openai/codex) session in the project folder (sandboxed to it, network on for `pnpm install`) with a brief: the task and its acceptance tests, the element's notes and template guide, the paths it may change, neighbouring API contracts, the checks, and `AGENTS.md`. When the agent stops, Jeeves itself:

1. reverts and rejects changes outside the task's owned paths (and to generated-owned files),
2. runs `pnpm install`, the type check, `pnpm -r test`, `docker compose up --wait`, and every template test pack (then `docker compose down`),
3. on success commits the task; on failure sends the check output back to the same Codex session, up to the retry limit (default 2), after which the task needs attention and the run stops.

A Codex credential or quota problem moves the run to **Waiting for provider** instead; fix it and press **Resume**. **Resume** after a failure or a restart tries the task again from the work already in the folder (a new session after a restart is told what's there).

Git: every run works on `jeeves/run-<id>`, branched from what the project had checked out; uncommitted changes there (such as `pnpm-lock.yaml` after Generate) are committed first. The project's git strategy (Runs sidebar, "For new runs") is **branch per task** (`jeeves/run-<id>-<task>`, merged with `--no-ff` after the checks pass) or **direct** (commits on the run branch). Jeeves never pushes or touches your other branches; merge the run branch yourself. Generate is refused while a run is executing.

Click an attempt to see its live log (agent messages, commands, file edits, and each check), the check results, the changed files, and the diff. Token usage is shown per attempt and per run (cost is unknown: Codex doesn't report it).

Codex uses its own login: run `codex login` once (ChatGPT or an API key). The Codex CLI comes with the SDK; `JEEVES_CODEX_PATH` points Jeeves at another `codex` binary. The model is Settings → "Coding agent" (empty for Codex's default, or one your Codex account can use).

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
templates/        template packages; the five v1 templates are complete (S7–S9): postgres, http-service, rest-api-server, web-app, rest-api-client
docs/             sources, template briefs, handoff log, reference notes
```

## Current architecture review

The [resource pattern and generated output](docs/improvements.md) and [editor/provider recommendation](docs/editor-provider-review.md) were approved by the user on 2026-10-29, along with qrwty service boundaries and email/password with server sessions. P3 resource generation/editor interactions and P4 verification/task derivation are implemented; P5 Runs/usage is next. The isolated comparison runs at `http://127.0.0.1:4300/editor-review.html` with `pnpm --filter @jeeves/web dev`; it loads both real editor engines and makes no project writes. It is a development entry and is excluded from the normal production build. New Runs controls and the [qrwty acceptance milestone](docs/examples/qrwty.md) remain outstanding.
