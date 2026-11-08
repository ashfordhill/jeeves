# Workspace layout

| Location | Responsibility |
| --- | --- |
| `jeeves/` | Studio UI/API, libraries, Docker/dev/browser-test configuration, fixtures, catalog and plan |
| `jeeves-generator/` | Export/templates and source-composition benchmark tooling |
| `field-projects/` | Independent generated applications, snapshots and version evidence |
| `tooling/` | Shared Biome, TypeScript and Vitest configuration |
| `docs/` | Cross-project guidance, decisions, feedback and recovered history |
| `.docs/` | Historical image paths used by the owner README |

The root `package.json`, pnpm workspace/lock, Git/Node settings and `AGENTS.md` serve the shared
workspace. The root README is maintained by the owner. Root commands still work; see the
[studio README](../jeeves/README.md) and [source-line benchmark](field-projects/source-loc.md).

Studio browser-test artifacts live in `jeeves/test-results/`. The studio image uses repository
root as its build context with `-f jeeves/Dockerfile`; Docker selects the adjacent
`jeeves/Dockerfile.dockerignore`. Shared lint uses `tooling/biome.config.json` explicitly, avoiding
an extra auto-discovered nested Biome root. Existing historical plans/evidence keep their original
paths; prepend `jeeves/` when following their former `apps/`, `packages/`, `fixtures/` or `docker/`
references. Current guides and executable configuration use the new locations.
