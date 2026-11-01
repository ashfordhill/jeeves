# Jeeves

Jeeves is a local software architecture studio. Describe the system at C1, compose its
applications and stores at C2, and design the responsibilities inside each application at C3.
The diagrams, contracts, data ownership and scenarios share one editable model.

**Current focus: C2/C3 design and reusable composition.** Code generation and coding-agent
execution are a separate phase. A design option does not claim an implemented or verified runtime.

## Run locally

Requires Node 24, pnpm (`corepack enable`) and Docker with Compose for PostgreSQL.

```sh
pnpm install
pnpm dev
```

Open <http://127.0.0.1:4300>. The API listens on `127.0.0.1:4310`; Postgres uses `54329`.
`pnpm db:down` stops Postgres without deleting its data. Schema migrations apply at API startup.
Never put API keys in this repository.

## Design a system

1. Use **New project → Architecture study**, or start blank. **Streamly · video platform**
   is the default study; the enterprise orders example remains available.
2. In **C1 Context**, describe the purpose, people and external systems.
3. In **C2 Containers**, use **Add container** and **Connect containers**. Give every boundary
   a responsibility and every arrow a directional verb and protocol.
4. Click a responsibility inside an application card to open its **C3 Components** view.
   Use **Add component**, **Connect components**, and **Connect dependency** to compose it.
5. Select an arrow to attach interfaces and failure policies. Use **Data & objectives** for
   ownership, lifecycle and measurable workload assumptions.
6. Use focused C2 views, the searchable **Explorer**, and **Focus selection** to navigate a
   large model. **Auto-arrange** routes the diagram; dragging the grip saves a layout override.
7. Use **Review** for unresolved architecture decisions. Scenarios and implementation handoff
   are in **Editor actions**. Review approval and runtime verification remain separate.

Save/Cancel protects form drafts. Undo/Redo handles model edits; layout history is separate.
The URL retains the selected C1/C2/C3 scope for reload and sharing. Every ordinary action works
with a mouse. **Editor actions → Freeform board & annotations** retains the earlier board tools.

See the [studio guide](docs/architecture-studio.md), [catalog](CATALOG.md), and
[Streamly walkthrough](docs/examples/streamly.md).

## Reuse and implementation

**Library** separates C2 containers, C3 components, patterns, examples and runtime templates.
Saved architecture templates preserve explicit interfaces and compatible bindings. Planning
families work before a runtime exists; missing implementation stays visible.

Existing implementation workflows remain available under **Editor actions → Generate code**
and **Runs**. See [runtime workflows](docs/runtime-workflows.md), [template contracts](docs/templates/README.md),
[product recipes](recipes/README.md), and [editable starters](starters/README.md).

## Develop

```sh
pnpm lint                        # Biome checks
pnpm typecheck                   # All workspaces and scripts
pnpm --filter @jeeves/web build   # Production editor bundle
```

The current UX work defers unit/E2E test maintenance and suite execution at the user's request.
Existing suites remain available with `pnpm check`, `pnpm test:e2e`, and
`pnpm test:templates`. E2E runs use their own database and ports `4301` / `4311`.
See [developer workflow](docs/developer-workflow.md) for the optional task runner.

| Path | Purpose |
| --- | --- |
| `apps/web` | React architecture studio, inspector and design assistant |
| `apps/server` | Local API, revision history, persistence and implementation jobs |
| `packages/spec` | Shared design model, catalog, projections and examples |
| `packages/registry` | Runtime template lookup and compatibility |
| `packages/generator`, `packages/orchestrator` | Separate implementation phase |
| `templates`, `recipes`, `starters` | Versioned implementation assets and editable seeds |
| `docs` | [Current documentation index](docs/README.md) and historical evidence |

[AGENTS.md](AGENTS.md) governs repository work. [PLAN.md](PLAN.md) retains architecture contracts
and historical build sections; [handoff.md](docs/handoff.md) is the append-only implementation record.
