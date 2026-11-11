# V3-08 evidence: process settings, search and delivery, robustness

2026-11-11. [Plan](../../units.md#v3-08--process-settings-search-and-delivery-robustness) ·
[contract](../../contract.md) §4 (D5), §5 (search data, the CDN) and question 10 ·
[tile-processes review](../../../tile-processes/review.md) rows 5–8.

**Result:** with Runnable processes on, a stub-only Service shows Request timeout and Concurrency
limit and a Worker shows Concurrency; a value set by mouse reached its process in Docker. Search
projection and search query are mounted on hooks files, assert their index at start, and with the
hooks written in a run copy indexed a published event and found it. A CDN in front of public
object storage served its objects at `/cdn/<cdn id>/`, read only and typed. Two consumers of one
topic in one tile each got every message on their own queue; an unwritten template hook was
terminal at once; a stub's own error retried 5 times with backoff; a lost broker stopped its
processes (exit 1, no restart) until `pnpm start` brought them back. Three defects found on the
way were fixed (below).

## Before: the owner's Docker state

Recorded first and compared at the end ([Cleanup](#cleanup)): 43 containers (42 healthy, plus the
exited `excalidraw`), 18 volumes, 9 networks, 31 image rows. v1 (`jeeves-youtube-v1`, 14 healthy,
edge `127.0.0.1:4400`) and v2 (`jeeves-youtube-v2`, 14 healthy, `127.0.0.1:45400–45402`) both
answered `/healthz` 200; in 454xx only 45400–45402 listened. My projects: `jeeves-v308-search`
(45560–45562) and `jeeves-v308-timeout` (45563–45565), each checked free first.

## The search stack (Docker run A)

A new fixture, `jeeves/packages/spec/src/fixtures/search-stack.ts`, built by commands from a
blank design, then `setRunnableProcesses {on: true}`, exported with
`pnpm --filter @jeeves/generator export:v2 search-stack.json <new dir>`: 69 files, 0 findings,
`runnable: true`, 6 required gaps, all `custom` (the four stubs, the cache read's and search's
hooks files); no `search-mappings` gap and no `setup-search`.

| Tile | Modules | Runs |
| --- | --- | --- |
| Search API (Service, public) | Item search (Search query → Items index) | search query, mounted |
| Catalog API (Service, public) | Item cache + Item reader (cache read on Catalog), Item publisher (Event publisher stub: Item events, outbox Catalog), Image writer (Custom stub → Images) | cache read; two route stubs |
| Indexer (Worker) | Item consumer ← Item events, Index writer → Items index | search projection, mounted |
| Auditor (Worker) | Item auditor and Item notifier, both stub Event consumers ← Item events | two loops |
| Images (Object storage, public), Image delivery (CDN → Images) | | `/cdn/image-delivery/` |

| Step | Command | Result |
| --- | --- | --- |
| Install, build | `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build` | exit 0 |
| First run | `COMPOSE_PROJECT_NAME=jeeves-v308-search LOCAL_HTTP_PORT=45560 LOCAL_IDENTITY_PORT=45561 LOCAL_OBJECT_PORT=45562 pnpm first-run` | exit 0, 63.6 s; 10 containers healthy, `restarts=0`, `policy=no`; only the edge (45560) and Garage (45562) publish a port |

### Hooks unwritten

Each search process logged its `started` line (`"checks":["cluster health","index items-index
asserted once its mapping is written",…]`); the Indexer also logged its unwritten mapping once at
start (`{"event":"not-implemented","module":"index-writer","what":"mapping for Index
writer","action":"thrown"}`) and stayed healthy.

| Request (edge `http://127.0.0.1:45560`) | Answer |
| --- | --- |
| `GET /api/search-api/modules/item-search?q=hello` | 501 `{"error":"NOT_IMPLEMENTED","message":"Not implemented: mapping for Index writer"}` |
| the same with no `q`, with `page=0`, or with an extra parameter | 400 `SEARCH_QUERY` "Enter a query of 1–200 characters and a page from 1–100." |
| `GET /api/catalog-api/modules/item-cache/abc` / `…/image-writer` | 501 `key for Item cache` / `Image writer` |

One message (`v308-item-1`, published to the `item-events` exchange from inside `app-catalog-api`
with the runtime login) reached all three subscribers (`item-events--indexer`,
`item-events--item-auditor`, `item-events--item-notifier`, one consumer each). Each ended in its
own `.failed` on its first delivery, `x-delivery-attempt: 1`, `x-terminal-code: NOT_IMPLEMENTED`,
with one log line naming `mapping for Index writer`, `Item auditor` and `Item notifier`.

### The CDN route

Objects put into `images` with Catalog API's own key (its stub's provisioned access), then read
through the edge at `/cdn/image-delivery/<key>`:

| Key (stored type) | Answer |
| --- | --- |
| `hello.txt` (none) | 200 `text/plain`, 19 bytes |
| `thumbs/a.jpg` (`image/jpeg`) | 200 `image/jpeg`, the 8 bytes put |
| `media/seg-1.ts` (`application/octet-stream`) | 200 `video/mp2t`, 4096 bytes; HEAD 200 with type and length; `Range: bytes=0-99` 206 `content-range: bytes 0-99/4096` |
| `media/index.m3u8` (none) | 200 `application/vnd.apple.mpegurl` |
| `page.html` (`text/html`) | 200 `text/html`, sandboxed |
| every 200 | one `Content-Type`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `etag`, `last-modified`; a request's `Authorization` and cookies are not passed on |
| POST, PUT, DELETE, PATCH | 405 `{"error":"METHOD_NOT_ALLOWED","message":"This route only reads."}` |
| `missing.jpg`, the bucket root | 404 `{"error":"NOT_FOUND","message":"No object for this key."}` (`application/json`, after fix 1) |
| `/cdn/other/hello.txt` | 404 "Route not found." |
| the bucket through Garage's S3 port without a key | 403 |

### Hooks written (run copy only)

In the run copy, the Index writer's hooks got a generic item mapping (`itemId` keyword, `title` and
`description` text, `version` integer), its document codec, ID and version, and an `event` that
reads `{type: "ItemPublished", eventId, item}`; Item search's got a `multi_match` preset (title^3,
description; score, then itemId) and a hit of `{itemId, title}`. A fresh export of the same design
differs from the run copy only in those two files and Item auditor's (below). `pnpm build`,
`pnpm stop` (6.0 s), `pnpm start` (49.2 s): 10 healthy, no `mapping` line, and the index was
asserted at start: `{"dynamic":"strict","_meta":{"version":1},"properties":{…4 fields}}`, 1 shard,
0 replicas.

| Step | Answer |
| --- | --- |
| `?q=kettle` before any event | 200 `{"q":"kettle","page":1,"pageSize":20,"total":0,"hits":[]}` |
| publish `v308-item-2` (item-2 "Blue kettle", version 1); `?q=kettle`, `?q=enamel`, `?q=blue%20kettle` | 200, `total: 1`, `hits: [{"itemId":"item-2","title":"Blue kettle"}]` |
| `?q=teapot`; `?q=kettle&page=2` | 200 `total: 0`; 200 `page: 2`, `total: 1`, `hits: []` |
| publish `v308-item-3` (item-2 "Red kettle", version 3) | `?q=kettle` finds "Red kettle" |
| publish an older version (version 2) | "Red kettle" stays; acked with no log line and no dead letter (after fix 2) |
| publish with a message ID that isn't the event's | `item-events--indexer.failed`, attempt 1, `MALFORMED_MESSAGE` |

### Fault drill (review row 5)

**A stub's own error.** In the run copy Item auditor throws `Error("audit store unavailable…")`
(not "Not implemented"). For `v308-item-2` it ran at +0, +253, +754, +1757, +3760 and +10696 ms
(waits of 250, 500, 1000, 2000 and 4000 ms; the sixth delivery came 2.9 s after its wait), then
the message was in `item-events--item-auditor.failed` with `x-delivery-attempt: 6` and
`x-terminal-code: RETRY_EXHAUSTED`. The log held `loop-error` lines "retry 1 of 5 in 250 ms",
"retry 4 of 5 in 2000 ms" (`suppressed: 2`, the rate limit), "retry 5 of 5 in 4000 ms" and
"sent to item-events--item-auditor.failed (RETRY_EXHAUSTED)". Item notifier, unwritten, sent each
event to its `.failed` at attempt 1.

**A lost broker.** At 18:06:36 `docker compose stop local-broker` (my project only):

| Process | After |
| --- | --- |
| `app-indexer`, `app-auditor` (loops), `app-catalog-api` (a stub's queue publisher) | exited 1 at 18:06:36.98–.99, within 0.3 s; `restarts=0`, `policy=no`; still exited at 18:08:04 |
| `app-search-api` (no broker) | healthy; searches kept answering 200 |
| the edge, for Catalog API | HTML 502 (finding: fixed 3, 503 JSON) |

`pnpm start` from that state: exit 0, 30.8 s; all 10 healthy, 0 restarts; one consumer on each
loop queue again; the dead letters kept (`indexer.failed` 3, `item-auditor.failed` 6,
`item-notifier.failed` 6); a new event (`v308-item-6`, "Green teapot") was indexed and found.

**Stop and start.** `pnpm stop` 2.5 s (every `app-*` and provider exit 0, OpenSearch 143), `pnpm
start` 44.0 s: the same 8 secret hashes (`.runtime` and `.runtime/secrets` 0700), the same 5
volumes with their creation times, both indexed items still found, the CDN still serving, the dead
letters kept. Then, with the regenerated edge configuration, a stopped Catalog API answered 503
`{"error":"UNAVAILABLE","message":"Service unavailable."}` (`application/json`) at
`/api/catalog-api/healthz` and at a module route, and `pnpm start` restored it (10 healthy).

## Request timeout by mouse (Docker run B)

Scripted Chromium on my own API (4399, scratch database `jeeves_v308`) and Vite (4389), by mouse:
a blank project, Consume → Microservice → Message channel → Worker service from the fans, a Rate
limiter on Microservice, Generate project → Runnable processes ticked. Microservice's Options then
show **Request timeout** and **Concurrency limit**, empty with placeholder 1000
([request-timeout-1440.png](request-timeout-1440.png), after typing 300); Worker service shows
**Concurrency**, placeholder 1 ([worker-concurrency-1280.png](worker-concurrency-1280.png)).
Typing 300 saved `requestTimeoutMs: 300` on the tile; Undo removed it, Redo put it back. Preview
listed `requestTimeoutMs 300 (tile)`, `concurrencyLimit 1000 (fixed)` and the Worker's
`concurrency 1 (fixed)`. **Download project ZIP** (by mouse): 39 files, 0 findings, `runnable`;
`src/processes/microservice.ts` has `"settings": {"requestTimeoutMs": 300, "concurrencyLimit":
1000}`.

In the extracted copy only, the Rate limiter stub waits `?ms=` milliseconds and answers 200.
`COMPOSE_PROJECT_NAME=jeeves-v308-timeout LOCAL_HTTP_PORT=45563 LOCAL_IDENTITY_PORT=45564
LOCAL_OBJECT_PORT=45565`: install, build, `first-run` 22.3 s, 3 containers healthy.

| `GET /api/microservice/modules/microservice-rate-limiter?ms=` | Answer |
| --- | --- |
| 0, 100, 250, 299 | 200 `{"slept":…}` in 0.007–0.301 s |
| 350, 1000, 5000 | 503 `{"error":"DEADLINE","message":"Request deadline exceeded; check status before retrying."}` at 0.30 s |

## Defects found and fixed

1. **A 404 for a key ending `.jpg` was labelled `image/jpeg`:** nginx gives a `return` body its
   type from the path's extension through its built-in types. The edge now has `types { }`, so its
   own answers are JSON whatever the extension.
2. **An older version of a document retried and dead-lettered:** OpenSearch answers 409 to an
   older `external_gte` version, and the generic upsert treated it as an error (5 retries, then
   `RETRY_EXHAUSTED`). `startSearchIndexWorker` (`tile-search.ts`) now treats it as done: the newer
   document stays. The shared v2 library is unchanged.
3. **A stopped process answered HTML through the edge:** nginx's own 502 page. The edge now
   answers 503 `UNAVAILABLE` JSON for 502 and 504, in the CDN route too.

Each fix was carried into the run copy (`infra/edge/nginx.conf`, `src/runtime/tile-search.ts`,
checked equal to a fresh export) and rechecked above.

## Checks

- `pnpm check` exited 0: **695 tests in 97 files** (679 before; lint: only the existing info).
- `pnpm test:e2e`: **78 passed, 1 failed (3.4 m)** on the full run: `v2-rebuild.spec.ts:30`
  failed at its first step: the system Name field wasn't focused within 5 s when it began typing
  "YouTube" (before any module or process step). **Rerun alone it passed (1.7 m).** `jeeves_e2e`
  holds only its long-standing "TinyURL · studio study". The new D5 test also passed alone
  (5.8 s).
- `pnpm --filter @jeeves/web build` passed (1.12 s, the existing chunk-size advisory).
- **Mouse check** (scripted Chromium; my API 4399 with scratch database `jeeves_v308`, now
  dropped, and Vite 4389), at 1440×900 and 1280×800: the TinyURL study shows 7 tiles and 7 lines in
  Detailed and in Simple, and a tile selects; the process settings flow above (show, save, Undo,
  Redo, Preview) passed at both sizes; no page or console errors. My first script used a tile
  name from the extended study and timed out; its two leftover projects were deleted.

## Gates

- **Processes-off pin:** passes, unchanged (no intended update: everything here applies only with
  the option on).
- **Frozen v2:** a fresh export of `field-projects/youtube/v2/inputs/design.json`: 72 files, 70
  byte-identical to `generic-export.tar.gz`; `manifest.json` and `report.json` are equal once their
  inventory is set aside.
- **v1:** byte-identical (`assemble.test.ts`'s manifest pin, in `pnpm check`).
- **YouTube exports** (the study, by mouse): Simple
  `9332ea16be9913598eab3b53829a7bfac8052f9ccc918c27214df9172cb589bd` (3008×2752, 25 lines) and
  Detailed `21fe8400b200a4f0a3bb010e45038f8fd49420b16a23daaf071a1e7ce0219ae1` (3840×3392, 26
  lines), twice at 1440×900 and once at 1280×800: unchanged.

## Cleanup

Both projects `docker compose --profile '*' down --volumes --remove-orphans` with their own
project names and ports; image tags `jeeves-v308-search-app` and `jeeves-v308-timeout-app`
removed. The run copies (with `.runtime/secrets`), the exports, the ZIP, scripts and logs deleted
from the scratchpad; my API and Vite stopped and `jeeves_v308` dropped. Against the record taken
first: the owner's 43 container IDs and names, 18 volumes, 9 networks, 31 image tag and digest
rows and the listening 454xx ports (45400–45402) are identical; 42 containers healthy with
unchanged restart counts; both edges (4400, 45400) answer `/healthz` 200. The repository holds no
runtime secret of mine: its only `.runtime` folders are the owner's two field apps.
