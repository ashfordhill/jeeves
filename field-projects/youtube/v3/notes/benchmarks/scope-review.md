# Reviewed backend and UI scope for v3

Reviewed in V3-12, file by file, against the untouched 112-file export in `generated/`, which is
the baseline `app/` at the V3-12 commit. The scope is [`backend-scope.json`](backend-scope.json)
(JSON-content SHA-256 `507a225b48609ea3228f7bf9cd768460e5e55ad3e9e8f5be08ce3a4adf680084`). Use it
with the unchanged source-loc-v2 rules in the [method](../../../../../docs/field-projects/source-loc.md):
backend code only, and UI excluded wherever it lives. It differs from
[v2's](../../../v2/notes/benchmarks/backend-scope.json) only in its backend directories: v3's
export has `src/modules` and `src/processes` where v2's had `src/adapters` and `src/services`.

| Classification | Files | LOC | Contents |
| --- | ---: | ---: | --- |
| Counted `src/runtime` | 47 | 5,044 | The mechanisms: HTTP, admission, process, AMQP, identity and the tile guard, SQL constructors (`upload-sql.ts`, `asset-sql.ts`, `counter-sql.ts`), outbox and receipts, multipart, lifecycle, media and HLS, cache, counter, favorites, search, delivery and the tile loops |
| Counted `src/processes` | 8 | 764 | One per application tile: its compiled `config` and the code that mounts its templates, stubs and loops. These files mix data and code, so they count |
| Counted `src/modules` | 14 | 316 | The 9 hooks files (each hook throws "Not implemented" until written); the 2 stub entry points; the 2 `.slots.ts` files (a `Dependencies` type that the process and the stub import, plus a `slots` descriptor); `dependencies.ts` and `entry.ts` (types) |
| Counted `src/features` | 2 | 127 | `service-resources.ts` (resource constructors) and `video-runtime.ts` (the media binary check) |
| **Counted total** | **71** | **6,251** | |
| Excluded `configuration-or-build` | 4 | 4 | `configurationPaths`: `application-bindings.ts`, `local-bindings.ts`, `positive-cache-bindings.ts` and `search-bindings.ts`. Each is one exported constant of normalized IDs, settings, logins, hosts and queue names, with no logic. Code in `service-resources.ts`, `runtime/module-clients.ts` and the processes reads them, as it would a config file |
| Excluded `outside-src` | 37 | — | `.jeeves/` (4), `diagnostics/` (1), `infra/` (the edge's `nginx.conf`, `local.json` and 12 SQL files, among them the 4 product SQL files), `scripts/` (9 `.mjs` files, 621 LOC by the same parser), `Dockerfile`, `compose.yaml`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `ffmpeg-os.lock`, `README.md`, `.gitignore` and `.dockerignore` |
| UI (`uiPaths`) | 0 | — | The export has no `browser/` and no UI under `src/`. The only `document` matches in `src/` are search documents, not the DOM. V3-16's browser goes in `browser/` |
| Tests, fixtures, declarations | 0 | — | The export has none |

71 + 4 + 37 = 112 files: every path of the export is classified. The counts come from
source-loc-v2's own `exclusionReason` and `codeLines`, run over `app/`.

- **Hooks and stub bodies count** (contract §6), so filling them in V3-13 to V3-16 is
  post-template work in files that already exist.
- **SQL doesn't count:** neither the template migrations nor the product SQL files, even once
  they are written. Neither do scripts, nginx, Compose or docs. `custom-paths.md` lists the ones
  a unit changes.
- **For V3-16 and V3-17:** the report refuses only eligible source *outside* every listed path. A
  UI file put inside `src/modules` or another backend path would be counted without warning, so
  put the browser in `browser/`, or add any UI path under `src/` to `uiPaths` before the report.
  New backend directories under `src/` must be added to `backendPaths`, or the report refuses.
