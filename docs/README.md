# Jeeves documentation

Start with the [architecture studio guide](architecture-studio.md),
[conceptual catalog](../CATALOG.md), and [C4 modeling guidance](c4-modeling.md).

| Task | Documentation |
| --- | --- |
| Compare a real system's C2/C3 and deployment | [Mattermost architecture reference](examples/mattermost.md) |
| Explore an earlier illustrative media design | [Streamly video platform](examples/streamly.md) |
| Compose reusable architecture | [Patterns](architecture-patterns.md), [saved templates](architecture-library.md) |
| Review intent and unresolved decisions | [Architecture review](architecture-review.md) |
| Capture an implementation brief | [Portable handoff](architecture-handoff.md) |
| Plan or implement the three backend foundations | [Roadmap](build-plan-backend-benchmarks.md), [P58 baseline and checks](evidence/p58/README.md), [small agent assignments](plans/backend-benchmarks/execution-units.md), [behavior scopes](plans/backend-benchmarks/benchmarks.md) |
| Compare a proposed target with an existing system | [Target workspaces](architecture-targets.md) |
| Use existing generation/orchestration | [Runtime workflows](runtime-workflows.md) |
| Work on the repository | [AGENTS](../AGENTS.md), [developer workflow](developer-workflow.md) |

Most earlier `build-plan*.md` files, package evidence and dated reviews are historical specifications
and records. P46–P57 are complete. The new [backend benchmark roadmap](build-plan-backend-benchmarks.md)
is a future specification; P58's baseline is recorded, and backend capability implementation has
not started. Neither category is a request to
restart or execute a whole sequence. [PLAN](../PLAN.md) retains implementation contracts;
[handoff.md](handoff.md) preserves the append-only history. The superseded original plan and
retired editor comparison are recoverable from Git at `c6c3ad5`.
