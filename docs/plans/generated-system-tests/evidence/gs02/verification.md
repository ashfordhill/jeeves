# GS02 verification

| Check | Result |
| --- | --- |
| Fresh core | 4/4 tests in two files passed; 216.01 s Vitest, 265.239 s including cleanup. `/tmp/gs02-resume-core-command.log`, `/tmp/gs02-resume-core/` |
| `pnpm check` | Lint/typechecks passed; 820 tests in 105 files passed (52.20 s). `/tmp/gs02-check-final.log` |
| `pnpm test:e2e` | 73/73 passed in 4.7 min, no reruns. `/tmp/gs02-e2e.log` |
| `pnpm --filter @jeeves/web build` | Passed. `/tmp/gs02-web-build.log` |
| Evidence integrity | 25 Biome-formatted JSON files have the same parsed values as the raw artifacts; compressed observations match their original bytes. No retained file exceeds 100 KB. |

An initial `pnpm check` stopped at lint on three copied evidence JSON files needing Biome
formatting (`/tmp/gs02-check.log`). Only evidence whitespace changed before the complete
passing check. The earlier core harness failure is retained in `first-failure/` and explained
in [the evidence inventory](README.md). No existing test, timeout, assertion or retry policy
changed. Browser checks and generated Docker runs were executed in separate phases.
