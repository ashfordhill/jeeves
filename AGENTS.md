# Agents working on Jeeves

Jeeves is built one section or improvement package at a time (PLAN.md §15). For work on an S section, P improvement package or UX work unit:

1. Read [PLAN.md §15 "How to work a section"](PLAN.md#15-build-sections) and do exactly what it says.
2. Read the latest entries in [docs/handoff.md](docs/handoff.md) before writing code. For P7–P11, your package's section in [docs/build-plan.md](docs/build-plan.md) is the specification.
3. When you finish, append your own entry to `docs/handoff.md`. Never edit earlier entries.
4. After the required checks and handoff are complete, create a local Git commit for that section or improvement package, using its ID in the commit title (for example, `P4: ...` or `S15: ...`). The user has given standing authorization for local commits: do not ask for permission. Keep each completed package in its own commit, stage only its scoped changes, and preserve unrelated work.

The improvement-package ordering in `docs/improvements.md` supersedes the historical S14-next sequence.

Work sequentially in the primary checkout, `/home/ash/github/jeeves`, on `main`. If a session starts in a Codex worktree, inspect its local changes and switch work to the primary checkout before implementation; preserve any unique work. The user is running one agent at a time on Jeeves; do not create additional worktrees or branches, or delegate to other agents, unless the user changes that instruction. Keep committing completed packages locally on `main`.

## Architecture work

Before changing C1/C2/C3 authoring, the catalog, connections or architecture patterns, read
[C4 modeling guidance](docs/c4-modeling.md). The current user priority is C2/C3 design and
reusable composition; new application runtime/code-generation work is deferred to a separate
task. The [revised P46–P57 roadmap](docs/build-plan-c4-evolution.md) is the planning
record for that completed sequence; the [direction review](docs/reviews/c4-direction-review-2026-10-31.md)
explains its rationale. P46–P57 are complete. Runtime/template and generation work needs a separate task. When asked to execute, start with the requested package,
not the whole sequence.
The current UX specification is the [studio build plan](docs/build-plan-studio-ux.md), with
[25 sequential assignments](docs/plans/studio-ux/execution-units.md) and the
[resolved owner decisions](.docs/visual-improvements/2026-11-03-ux-review/DECISIONS-FINAL.md).
It supersedes conflicting older UI requirements. Assign one exact UX unit, starting with UX01
when execution is requested; split parents require separate child assignments and local commits.
The plan is not implemented and does not authorize starting its queue automatically.
P73a is checkpointed incomplete; P73a/P73b and the backend batch remain paused for this UX work.
The [backend benchmark roadmap](docs/build-plan-backend-benchmarks.md) now specifies future
Discourse, Vendure and Zammad core foundations. It is a plan, not implemented capability or
authorization to start the sequence. For that work, read its shared contract and
[79-unit assignment queue](docs/plans/backend-benchmarks/execution-units.md). Execute one requested
work unit at a time; split parents require separate child assignments and local commits.
Keep architecture intent, template availability and verification evidence distinct.
The [studio guide](docs/architecture-studio.md) describes the currently implemented, pre-cleanup UX;
do not use its superseded controls as requirements for the new studio.
For this UX cleanup, the user explicitly defers unit/E2E test maintenance and suite execution.
Use lint, typecheck, a production build and direct browser inspection instead of `pnpm check`.

## Repo conventions

- Maintain [CATALOG.md](CATALOG.md) when offerings, reusable C1/C2/C3 boundaries or availability change. Keep it conceptual and cross-linked; exact implementation details belong in the referenced template documentation.

- pnpm workspaces, TypeScript (strict), ESM everywhere. Workspace packages export their TypeScript source directly (`"exports": "./src/index.ts"`); there is no build step for internal packages.
- Relative imports include the `.ts`/`.tsx` extension.
- Biome does lint and formatting: `pnpm format` fixes, `pnpm lint` checks. Don't add ESLint or Prettier.
- Pin dependency versions exactly. Prefer versions automation-pitch already uses; otherwise pick a release at least two weeks old.
- Outside an explicit task-specific verification exception above, `pnpm check` (lint, type check, unit tests) must pass before you hand off. Unit tests must not need Docker, Postgres or network access.
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
