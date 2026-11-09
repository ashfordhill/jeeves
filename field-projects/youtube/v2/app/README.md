# Generated local v2 foundation

Experimental provider/project foundation. Inspect .jeeves/report.json for missing features and hooks. No application readiness or strict certification is claimed.

Node 24.21.0 and pnpm 12.16.1. Run `pnpm install --frozen-lockfile --ignore-scripts` then `pnpm build`. Set a unique `COMPOSE_PROJECT_NAME` and three distinct free loopback ports: `LOCAL_HTTP_PORT`, `LOCAL_IDENTITY_PORT`, `LOCAL_OBJECT_PORT`. Run `pnpm first-run` once, `pnpm stop` to stop all profiles and `pnpm start` for normal restart. Reuse those exact values and private .runtime with the original Docker volumes. No resets or credential rotation occur. An interrupted single-use storage bootstrap requires manual inspection.

Migration owners/admin are mounted only into setup. Runtime logins receive no implicit table access; features contribute explicit relation/view grants. PostgreSQL names are quoted and provider/composed-name limits refuse rather than truncate. Storage originals remain private; local public websites are a declared local-security limitation.

Cleanup only an owned disposable export: `docker compose --profile '*' down --volumes --remove-orphans` with its recorded project/ports, then remove its .runtime. Never run cleanup against a retained runtime.
