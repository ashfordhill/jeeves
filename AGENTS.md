# Agents working on Jeeves

Jeeves is built one section or improvement package at a time (PLAN.md §15). For work on an S section or P improvement package:

1. Read [PLAN.md §15 "How to work a section"](PLAN.md#15-build-sections) and do exactly what it says.
2. Read the latest entries in [docs/handoff.md](docs/handoff.md) before writing code. For P7–P11, your package's section in [docs/build-plan.md](docs/build-plan.md) is the specification.
3. When you finish, append your own entry to `docs/handoff.md`. Never edit earlier entries.
4. After the required checks and handoff are complete, create a local Git commit for that section or improvement package, using its ID in the commit title (for example, `P4: ...` or `S15: ...`). The user has given standing authorization for local commits: do not ask for permission. Keep each completed package in its own commit, stage only its scoped changes, and preserve unrelated work.

The improvement-package ordering in `docs/improvements.md` supersedes the historical S14-next sequence.

## Repo conventions

- pnpm workspaces, TypeScript (strict), ESM everywhere. Workspace packages export their TypeScript source directly (`"exports": "./src/index.ts"`); there is no build step for internal packages.
- Relative imports include the `.ts`/`.tsx` extension.
- Biome does lint and formatting: `pnpm format` fixes, `pnpm lint` checks. Don't add ESLint or Prettier.
- Pin dependency versions exactly. Prefer versions automation-pitch already uses; otherwise pick a release at least two weeks old.
- `pnpm check` (lint, type check, unit tests) must pass before you hand off. Unit tests must not need Docker, Postgres or network access.
- E2E tests live in `apps/web/e2e/` and run with `pnpm test:e2e` (or `pnpm test:e2e:docker` when Chromium's system libraries aren't installed; see README).
- Every UI action must work by mouse alone; keyboard shortcuts are optional extras (PLAN §5).
- Server binds to `127.0.0.1` only. Never put API keys in the repo.

## Ports

| What | Port |
| --- | --- |
| Web dev server (`pnpm dev`) | 4300 |
| API server (`pnpm dev`) | 4310 |
| Web / API during Playwright | 4301 / 4311 |
| Jeeves Postgres (Docker) | 54329 |
