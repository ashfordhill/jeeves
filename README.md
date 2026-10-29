# Jeeves

Jeeves turns a software design into a working, tested application by combining strict, reusable templates with coding agents. Draw Jeeves is its design canvas. See [PLAN.md](PLAN.md) for the architecture and build plan.

Status: S1–S6 are done (see `docs/handoff.md`). The Draw view has a working board with an inspector, findings, undo/redo, and a design chat (the rail's Chat tab) that edits the board for you. Settings shows provider key status and the model per role. Runs is still empty.

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

## Design chat and API keys

The Chat tab calls OpenAI. Give Jeeves a key in either place (the environment wins):

- `OPENAI_API_KEY=sk-… pnpm dev`
- `~/.jeeves/config.json`: `{ "openai": { "apiKey": "sk-…" } }` (keep it `chmod 600`)

Settings shows whether a key is set (never the key) and lets you pick the model for each role; models are saved to the same file. `JEEVES_HOME` moves that directory. Setting `JEEVES_FAKE_MODEL_SCRIPT=<file>` makes the server replay a scripted fake model instead (the e2e suite uses `fixtures/chat/e2e-script.json`).

## Test

```bash
pnpm check        # Biome lint, type check, Vitest unit tests (no Docker needed; API tests use in-process PGlite)
pnpm test:e2e     # Playwright; starts Postgres and both apps itself
pnpm test:templates  # template conformance tests (Testcontainers; needs Docker, about a minute)
```

Playwright's Chromium needs system libraries. If it fails with a missing `libnspr4.so` (or similar), either install them once with `sudo pnpm exec playwright install-deps chromium`, or run the suite inside the official Playwright image with `pnpm test:e2e:docker`.

## Layout

```text
apps/web          Jeeves UI (React, Vite, Mantine)
apps/server       Fastify API, Drizzle + Postgres
packages/*        spec, registry, providers (OpenAI + fake model), template-kit (template contract + conformance harness); generator and orchestrator are empty until later sections
templates/        template packages; postgres, http-service and rest-api-server are complete (S7, S8), the others are manifests only until S9
docs/             sources, template briefs, handoff log, reference notes
```
