# Agents working on Jeeves

Jeeves is an architecture design studio with chat and a read-only blueprint API (see
[studio README](jeeves/README.md) and [PLAN](jeeves/PLAN.md)). The owner selected same-repository generation through
the [YouTube field-project plan](docs/plans/reliable-foundations/youtube-field-project-plan.md).
Keep studio, `jeeves-generator/` and independently runnable field apps separate. Templates start
experimental; heavy certification is deferred while field projects inform their design.
That deferral does not remove the existing Jeeves regression checks below.

## How work happens

- **The root `README.md` is owner-maintained. Agents must never edit it during implementation,
  cleanup or documentation updates.** Put agent-maintained guidance in `docs/` or project-level
  READMEs. Preserve its referenced images and historical owner feedback; do not delete them as
  stale documentation.

- Work one assigned unit at a time, on `main` in the primary checkout
  (`/home/ash/github/jeeves`). Do not create branches or worktrees, use `git stash`, or delegate to
  other agents unless the owner asks. The owner may have a coordinator hand sequential units to
  fresh agents; each one does only its own unit.
- Before writing code, read the latest entries in [docs/handoff.md](docs/handoff.md). When you
  finish, append your own short entry: what changed, how it was checked, notes for the next unit.
  Never edit earlier entries.
- When the checks below pass and the handoff entry is written, create one local commit for the
  unit. Local commits are authorized; do not ask. Stage only the unit's changes and preserve
  unrelated work (for example the untracked `.jeeves-feedback/`). Push only when asked.
- **Owner feedback is a paper trail.** When the owner sends feedback with images (screenshots,
  marked-up diagrams, sketches), save each image in `docs/human-feedback/` and add an entry to
  [HUMAN_FEEDBACK](docs/HUMAN_FEEDBACK.md): date/image links, **Problem · Decision · Resolution**,
  normally 3–5 short lines. Include Q&A only when it changes a decision. Link detailed plans,
  test results and handoffs instead of repeating them. Resolution updates name the commit and
  remaining issue briefly. Preserve earlier records/images; archive verbose history intact when
  the owner requests condensation.
- **Design lessons go in the [design playbook](docs/design-playbook.md)**: when
  a study, research or an owner review shows how a kind of system should be designed, or what
  looks wrong on the canvas, add it there. Read it before designing a study.
- Keep docs current with the code: [studio guide](docs/studio.md),
  [studio settings](docs/studio-settings.md), [blueprint](docs/studio-blueprint.md) and
  [CATALOG](jeeves/CATALOG.md) when kinds, lane rules, settings, components or providers change.
  Describe what exists; history lives in Git.

## Verification

Before handing off:

1. `pnpm check` (Biome lint, type checks, unit tests).
2. `pnpm test:e2e` (or `pnpm test:e2e:docker` when Chromium's system libraries are missing).
3. `pnpm --filter @jeeves/web build`.
4. A browser check of the running app for anything user-visible: it loads, the TinyURL study
   renders on the lane canvas, and the changed behaviour works by mouse.

Unit tests must not need Docker, Postgres or network access (the server uses PGlite). E2E tests
live in `jeeves/apps/web/e2e/`, use the `jeeves_e2e` database and a scripted chat model, and delete the
projects they create. Agents may create, change and delete projects in the owner's `jeeves`
database when their work calls for it.

## Conventions

- pnpm workspaces, TypeScript (strict), ESM everywhere. Workspace packages export their
  TypeScript source directly (`"exports": "./src/index.ts"`); there is no build step for internal
  packages.
- Relative imports include the `.ts`/`.tsx` extension.
- `jeeves/packages/board` imports no Jeeves code.
- Biome does lint and formatting: `pnpm format` fixes, `pnpm lint` checks. Don't add ESLint or
  Prettier.
- Pin dependency versions exactly. Prefer versions automation-pitch already uses; otherwise pick a
  release at least two weeks old.
- Every UI action must work by mouse alone; keyboard shortcuts are optional extras.
- The server binds to `127.0.0.1` only. Never put API keys in the repo.
- Settings are a finite allowlist ([studio settings](docs/studio-settings.md)): add a field only
  with its schema, form, validation and blueprint output together.
- Keep design intent, template availability and verification evidence distinct.
- Field-project LOC benchmarks measure **backend code only**. Exclude all UI/frontend code,
  including UI under `src/`, until the owner expands the measure after adding a UI builder.
  Record a reviewed backend/UI scope with each report; follow [the method](docs/field-projects/source-loc.md).

## Ports

| What | Port |
| --- | --- |
| Web dev server (`pnpm dev`) | 4300 |
| API server (`pnpm dev`) | 4310 |
| Web / API during Playwright | 4301 / 4311 |
| Jeeves Postgres (Docker) | 54329 |
