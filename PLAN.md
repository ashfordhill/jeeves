# Jeeves architecture

Jeeves is a local, single-user web app for designing a software system at C1/C2/C3 and exposing
the result as a versioned blueprint. This page describes how it is built. What the studio does
for a user is in the [studio guide](docs/studio.md); field values are in
[studio settings](docs/studio-settings.md).

```text
apps/web (React studio) ──/api──▶ apps/server (Fastify) ──▶ Postgres
        │                              │
        └──── @jeeves/spec ◀───────────┤   (schemas, operations, validation, views, blueprint)
                                       └──▶ @jeeves/providers ──▶ OpenAI API / Codex (chat only)

GET /projects/:id/blueprint ──▶ future code generator (separate service, not in this repo)
```

## Repository layout

| Path | Holds |
| --- | --- |
| `apps/web` | Vite + React 19 + Mantine. `App.tsx` is the shell (Design and Settings tabs, project menu, status bar). `project/` holds the project store (zustand), API client, form drafts, project menu, chooser and browser. `studio/` holds the canvas (React Flow), ELK layout (in a worker), routing, `+` spawning, inspector forms and Library. `chat/` the chat rail and its store; `settings/` the Settings view; `shell/` and `theme/` the chrome. |
| `apps/server` | Fastify 5 with Zod type providers, Drizzle ORM on `pg`, migrations in `drizzle/`. `routes/` (projects, chat, settings), `design/service.ts` (projects, revisions, history, layout, blueprint), `chat/` (turn loop, tools, files, model wiring), `settings.ts` (provider keys and the chosen model). |
| `packages/spec` | The design format and every pure function over it (no I/O). |
| `packages/providers` | A provider-neutral model interface with OpenAI Responses and Codex adapters and a scripted fake. |
| `apps/web/e2e`, `fixtures/chat` | The Playwright smoke set and its scripted chat model. |
| `docker/`, `Dockerfile`, `compose.yaml` | The single-container image (nginx, API, Postgres 17) and the dev/E2E Postgres. |

Internal packages export TypeScript source directly; nothing is built except the web bundle.

## Data model (`packages/spec`)

A **design document** is `{schemaVersion: 2, revision, architecture?, elements, connections}`
(`design.ts`), parsed strictly; any other shape is rejected.

- `elements`: C2 boxes `{id, name, classification?, description?}`.
- `connections`: `{id, kind, from: {element}, to: {element}, planned: {label, protocol,
  interaction, security}}`.
- `architecture` (`architecture.ts`): the C1 `system`, `nodes` (people, external systems) and
  `relationships`, plus `studio` (`studio-model.ts`): a binding per element (definition ref,
  typed settings, optional owner), packages, per-connection settings, C3 `components` and
  `componentConnections`, and an optional study origin.

The vocabulary is finite: fifteen kinds with immutable definitions (`studio-definitions.ts`), ten
component kinds (`studio-components.ts`) and one package preset (`studio-presets.ts`). The only
study is TinyURL (`studio-examples/`).

`validateDesign` (`validate.ts`, `studio-validation.ts`) returns findings: structural errors
reject a batch; readiness gaps (`CONFIG_REQUIRED`) are saved and reported. `studio-view.ts` and
`studio-relationships.ts` project the design into C1/C2/C3 scopes with merged relationships;
`studio-blueprint.ts` projects it into the blueprint.

## Operations and history

Every change, from the canvas, chat or API, is an **operation batch** posted to
`POST /projects/:id/operations` with a `baseRevision` (`operations.ts`): `setArchitecture`,
`updateArchitectureSystem`, `setStudio`, `addElement`, `updateElement`, `removeElement`,
`connect`, `updatePlannedConnection`, `disconnect`. The UI and chat build batches from
higher-level **studio commands** (`buildStudioCommand` in `studio-operations.ts`: create, edit,
connect, group, components, delete and so on), so both share one rule set.

`applyOperations` applies a batch all-or-nothing and bumps `revision` once. The server runs each
change in one transaction that locks the project row: a stale `baseRevision` is a 409 with the
current state, an invalid batch a 422 with findings. Each applied batch is a row in `operations`
with before/after snapshots and a source (`canvas`, `chat`, `api`). Undo and redo
(`POST /projects/:id/undo|redo`) restore a snapshot as a new revision; a new edit ends the redo
chain. The web store keeps one chronological stack over server edits and local row-order
changes.

Tables: `projects`, `design_revisions`, `operations`, `layouts`, `files`, `chat_turns`. The server
applies migrations on start.

## Layout

Positions are never stored. The web app lays out each view with ELK (`studio/layout.ts`, layered,
left to right, 32px grid, frames as compound nodes) in a worker. The **layout document**
(`layout.ts`, `PUT /projects/:id/layout`) holds only a per-view row `order` and an optional
`viewport`; it never changes the design revision. The live camera is a browser preference.

## Chat

`POST /projects/:id/chat` streams a turn as NDJSON. The server loop (`chat/service.ts`) calls the
chosen model with a finite toolset (`chat/tools.ts`): `listStudioDefinitions`,
`describeStudioDefinition`, `getDesign`, `applyStudioCommands`, `validateDesign` and `askUser`.
Commands run against a working copy with the same builder and validation as the canvas; the whole
turn commits as one operation, so it is one undo step. A concurrent edit stops the turn rather
than overwriting it. Attached files (Markdown, text, PNG, JPEG, WebP; SVG rasterized with resvg)
are stored in `files`. Turns, replies, questions, activity and token usage are kept in
`chat_turns`; turns interrupted by a restart are marked failed on start.

Providers (`packages/providers`): the OpenAI Responses API with an API key, and Codex through its
own CLI login. Settings (`GET /settings`, `PUT /settings/roles`) choose one design-chat provider
and model, stored in `~/.jeeves/config.json`. E2E tests set `JEEVES_FAKE_MODEL_SCRIPT` to replay a
scripted model.

## Blueprint

`GET /projects/:id/blueprint` returns `designBlueprint(design, projectName)`: services with
settings and components, resources, externals, groups, resolved connections, component links,
omissions and findings, at `blueprint: 1`. It is derived per request, `no-store`, and is the only
interface a future code generator should read. See [studio blueprint](docs/studio-blueprint.md).

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | Server and database status |
| `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` | Projects |
| `GET /projects/:id/design`, `/findings`, `/blueprint` | Design state, findings, blueprint |
| `POST /projects/:id/operations`, `/undo`, `/redo` | Changes and history |
| `GET/PUT /projects/:id/layout` | Row order and viewport hints |
| `GET/POST /projects/:id/chat`, `POST /projects/:id/files`, `GET /projects/:id/files/:fileId` | Chat and attachments |
| `GET /settings`, `PUT /settings/roles` | Providers and the chat model |

The web app reaches these under `/api` (Vite proxy in development, nginx in the image).

## Next

The canvas is being rebuilt on an automation-illustrator-style locked lane grid: one actor, two
lanes, typed tiles and no islands ([build plan](docs/build-plan-lane-grid.md), units LG01–LG13 in
[execution units](docs/plans/lane-grid/execution-units.md)). Code generation will be a separate
service that reads the blueprint.
