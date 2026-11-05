# Repository cleanup plan (November 2026)

**Status: in progress, started 2026-11-04.** Owner request: "a massive code cleanup", removing all
unused, old and outdated code, including tests and low-quality tests. A later visual pass on the
studio grid follows this cleanup; it is not part of it.

Everything removed stays recoverable at git tag `pre-cleanup-2026-11-04`. The owner's four old
projects were exported to `~/jeeves-legacy-exports/2026-11-04/` (JSON per project plus a full
database dump) and then deleted from the local database. The database now holds no projects.

## Owner decisions (2026-11-04)

| # | Decision |
| --- | --- |
| K1 | Remove the whole original code-generation stack: generator, template-kit, templates, recipes, starters, orchestrator, registry, runtime packages, the Generate and Runs screens and server routes, and the QR Studio and Resource workspace starters. Future code generation is a separate service reading the blueprint API. |
| K2 | Drop the pre-studio design format and the old backend, contract, deployment, pattern, library, handoff and proof models. Only the studio format remains. No compatibility projection, no migration. |
| K3 | Remove the backend benchmark material: `benchmarks/`, the Discourse, Vendure and Zammad models, P73a and the benchmark queue. |
| K4 | Keep only current docs. Delete evidence, historical plans, reviews, `.docs/` and similar. Rewrite README, AGENTS, PLAN and CATALOG to match what exists, and restart `docs/handoff.md` with a short summary. |

## What survives

The studio (C1/C2/C3 tabs, ELK layout, `+` spawn, merged lines, component and performance
inspector, Library with the TinyURL study and Blank architecture), chat with its finite studio
commands and whatever provider code chat needs, Settings, the server's project, design,
operations, history/undo, layout and blueprint routes, Postgres, and the studio spec
(studio model, definitions, components, operations, validation, view, relationships, blueprint,
TinyURL study). If something not listed is still needed by these, keep it and say why.

## Phases

Run one at a time, each by a fresh worker, each its own commit titled `CLn: <change>`.

| Phase | Scope |
| --- | --- |
| CL1 | Remove K1's stack and all web UI that the app no longer reaches (old `architecture/`, `draw/` editors, `api-reference/`, Generate, Runs), with their server routes, packages, tests, E2E specs, fixtures and dependencies. Keep the app working. |
| CL2 | Apply K2 and K3: reduce `packages/spec` and the server (design service, operations, validation, chat tools) to the studio model; remove `benchmarks/`, benchmark models and legacy fixtures. A design document is a studio document. |
| CL3 | Tests. Keep and repair meaningful unit tests for what remains; delete low-value ones (snapshot noise, tests of removed behaviour, duplicate trivia). Replace the E2E suite with a small current-flow smoke set. `pnpm check` and the E2E smoke set must pass. |
| CL4 | Apply K4, plus repository hygiene: unused dependencies, scripts, config files, Docker/compose and CI workflow, dead exports found by a final sweep. Rewrite current docs. |

## Rules for every phase

- Work on primary `main`. Do not spawn agents, create branches or worktrees, or use `git stash`.
- Deleting is the point, but never delete something still reached by what survives. Find usages
  before deleting; remove whole files and packages rather than leaving stubs.
- CL1 and CL2 keep `pnpm lint`, `pnpm typecheck` and `pnpm --filter @jeeves/web build` passing;
  tests of removed code are deleted, other test breakage is noted for CL3. From CL3 on, `pnpm check`
  must pass. This overrides the older "tests deferred" verification profile in AGENTS.md.
- Check the running app in a browser after each phase: create a TinyURL project, view C1/C2/C3,
  spawn a box, edit a setting, reload, fetch the blueprint, then delete exactly that project.
- Append a short entry to `docs/handoff.md` and commit only the phase's changes.
