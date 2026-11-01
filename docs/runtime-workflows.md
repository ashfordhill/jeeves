# Existing implementation workflows

Runtime expansion is deferred while Jeeves focuses on C2/C3 authoring. These existing paths
remain available; architecture intent and template availability are distinct.

## Generate

Open **Editor actions → Generate code**, choose an output folder and generate a template project.
The default parent is `~/jeeves-projects`; `JEEVES_PROJECTS_DIR` overrides it. Generation writes
versioned runtime packages, contracts, Compose files, an ownership lock and project scaffolds.
Required planned capabilities prevent generation instead of silently disappearing.

A second generation preserves project-owned files and refuses changed generated-owned files.
The optional baseline installs dependencies, checks types and runs the templates in local Docker.
The [generator contract](../PLAN.md#9-generate-design-to-template-project) and
[templates](templates/README.md) describe exact behavior. Product-specific coverage is in
[recipes](../recipes/README.md) and [starters](../starters/README.md).

## Runs and providers

After successful generation, **Runs → Plan a run** derives explicit remaining implementation work.
The run UI provides start, pause, resume, cancel, logs, diffs and usage. It does not implement
planned catalog families automatically. Providers and per-role model settings are under Settings.
Credentials stay in environment variables or the user's local configuration, never in designs.
See [orchestration](../PLAN.md#10-orchestration) and [providers](../PLAN.md#12-providers).

## QRWTY bootstrap

The historical proving application can be prepared with:

```sh
pnpm qrwty:bootstrap [--output-dir ~/github/qrwty] [--api http://127.0.0.1:4310] [--public-origin http://127.0.0.1:5173]
```

This command creates/reuses its saved design, configures the output folder, merges local
`.env` settings, generates the template project and may commit generated changes in that output
repository. It is not an architecture-only import. Use the configured public origin exactly.
See the [QRWTY brief](examples/qrwty.md) and script for the supported envelope.
