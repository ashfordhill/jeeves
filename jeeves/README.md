# Jeeves studio

The architecture editor, chat API and studio libraries live here. The generator lives in
[`../jeeves-generator/`](../jeeves-generator/); independently runnable applications live in
[`../field-projects/`](../field-projects/). Shared pnpm manifests and commands remain at repository root.

From the repository root, with Node 24 and pnpm 12.16.1:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The studio opens at http://127.0.0.1:4300/; API 4310 and PostgreSQL 54329 stay on loopback.
`pnpm db:up` uses this folder's `compose.yaml` with the existing `jeeves` project and data volume.

| Path | Contents |
| --- | --- |
| `apps/web/`, `apps/server/` | Editor and chat/blueprint API |
| `packages/board/`, `packages/spec/`, `packages/providers/` | Canvas, design contracts and model adapters |
| `docker/`, `Dockerfile`, `Dockerfile.dockerignore` | Studio image, built with the repository root as context |
| `fixtures/`, `playwright.config.ts`, `scripts/` | Scripted browser checks and Docker fallback |
| `../tooling/` | Shared Biome, TypeScript and Vitest configuration |

Root verification commands remain `pnpm check`, `pnpm test:e2e`, and
`pnpm --filter @jeeves/web build`. Browser artifacts go into `jeeves/test-results/`.

Build the studio image from repository root:

```sh
docker build -f jeeves/Dockerfile -t jeeves-local .
```

See the [studio guide](../docs/studio.md), [settings](../docs/studio-settings.md),
[catalog](CATALOG.md), [plan](PLAN.md), and [Docker guide](../docs/docker.md).
The root README belongs to the owner; agent-maintained instructions belong here or in `docs/`.
