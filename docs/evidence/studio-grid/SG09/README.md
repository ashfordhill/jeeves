# SG09 evidence: component and performance inspector

Captured 2026-11-04 on a temporary Vite dev server (port 4302, this checkout) proxying the running
API on 4310. `capture.mjs` (one-off Playwright, real mouse) creates one disposable TinyURL project
per size, edits every form below, then deletes the project. `capture-log.json` holds the raw
observations. Owner projects: every non-GET request naming one would be aborted (none attempted,
`blocked: []`), and their `updatedAt` values are unchanged (`ownerUnchanged: true`).

Results, identical at 1440×900 and 1280×800:

| Check | Observed (stored design via `GET /projects/:id/design`) |
| --- | --- |
| Service (Shorten API) Options | min 2, max 12, autoscale requests-per-second, timeout 3000 ms, concurrency 500 |
| Invalid replicas (max 1 < min 2) | two field errors shown; stored max stays 10; corrected to 12 and saved |
| Worker (Analytics worker) | max replicas 6 |
| Database (Links database) | read replicas 3; partition key `bad key` rejected (field error), `link_code` saved |
| Cache (Link cache) | topology standalone, eviction LFU |
| CDN | Cache redirects set to **Unspecified** removes the field; then Enabled |
| Gateway (spawned from Web app at C2) | product Envoy, replicas 2–4 |
| Queue (Click events, C3) | partitions 24 |
| Rate limiter | limit 120, window 60 s |
| External call (Reputation check) | circuit breaker disabled; Connections shows the traced connection's `timeout 800 ms · 1 retry, 100 ms apart` |
| ID generator | min length 99 rejected (`<=32`), stored value unchanged; 7 saved; block size 500 (range allocation) |
| Data access (Link writer) | pool size 20 |
| Cache reader | shared cache TTL 3600 s |
| Redirect responder | status 307, edge max-age 120 s |
| Event publisher | linger 50 ms |
| Event consumer | retry limit 5 |
| Custom (Click aggregation) | clearing Purpose shows the readiness gap; new purpose saved and the gap clears |
| Auth guard | first component on Web app via its C3 `+` (picker groups: auth guard, external call, custom; then resources); Web app becomes a frame; credential Session |
| Undo / Redo | pool size 32 → Undo 20 → Redo 32 |
| Reload | rate limit 120 and credential Session read back in the inspector |
| Blueprint (`GET /projects/:id/blueprint`) | Shorten API settings min 2 / max 12 / timeout 3000; Rate limiter limit 120 / window 60; Web app components `Auth guard:session`; database read replicas 3, partition key `link_code` |
| Remove component | Auth guard gone from the design and the canvas |
| Page errors | none |

Screenshots (`screenshots/`, per size): one inspector crop per form (`*-service-options*`,
`*-worker-options`, `*-database-options`, `*-cache-options`, `*-cdn-options`, `*-gateway-options`,
`*-queue-options`, `*-component-<name>` for all ten kinds, the invalid ID generator, the custom
gap and the external call's Connections tab), the Web app picker, C3 before, with the new Web app
frame, and after removal.
