# V3-12 evidence: generated output

2026-11-11. [Plan](../../units.md#v3-12--generated-output) · [contract](../../contract.md) §6 (layout and
benchmark scope) and §7 · field project [notes](../../../../../field-projects/youtube/v3/notes/README.md).

**Result:**

- **The export:** `field-projects/youtube/v3/generated/` is the exact export of
  `inputs/design.json` with Runnable processes on. It is committed untouched, with no file added.
  A fresh export and the studio ZIP of the kept project are identical to it, byte for byte.
- **The outside run:** a copy outside the checkout installed, built and came up with all 15
  containers healthy. Every route and loop answered, each stopping at its first unwritten hook
  or stub, named. Stop and start kept the state.
- **`app/`:** a byte-for-byte copy of `generated/` in the same commit, the benchmark baseline.
- **One small fix came first:** the duplicated Keycloak row.

## The fix before the freeze

V3-11 found that the resolver recorded the Identity's local Keycloak substitution once per
`verified-identity` selection. v3 has three Sign-in guards on one Identity, so it got 3 identical
`localAdapterTreatments` rows, and Preview keyed them by source path, which logged React's
duplicate-key error.

- **The resolver** (`generation-resolver.ts`) now adds that note once per Identity source path.
- **Preview** (`V2GenerationDetails.tsx`) keys each row by its source path, actual vendor and
  reason.
- **Tests:**
  - `v3-modules.test.ts`: 3 `verified-identity` selections and exactly 1 treatment, at the
    Identity's `language`.
  - New `V2GenerationDetails.test.tsx`: two limits give two rows and no console error.

**The fix's effect:**

- **v3's export.** The same design exported by the pre-fix generator (`git archive 758a895` into
  scratch, offline install) and by today's both give 112 files. 108 are byte-identical. The other
  4 are provenance and diagnostics:
  - `.jeeves/report.json`, `.jeeves/normalized.json` and `diagnostics/generation.json` go from
    3 treatments to 1;
  - the inventory moves with `generation-resolver.ts` (59,876 → 60,178 bytes), in
    `manifest.json`, `report.json` and the registry hash.
- **Processes-off pin:** passes unchanged. None of its three designs has more than one guard per
  Identity.

## The export

```sh
pnpm --silent --filter @jeeves/generator export:v2 \
  "$PWD/field-projects/youtube/v3/inputs/design.json" "$PWD/field-projects/youtube/v3/generated"
# { files: 112, applicationComplete: false, findings: 0, requiredGaps: 9 }   (0.7 s)
```

This is the same `assembleV2` and `loadLocalV2Registry()` that the server's preview and download
routes use.

| Fact | Value |
| --- | --- |
| Input | `inputs/design.json`, SHA-256 `9762df418108917c71f42de6190c3c756d1db62dbaeca83653b6e9b6db93813f` (also `.jeeves/inputs/design.json`) |
| Files, bytes | 112, 5,133,781; no executable bit, no CR, every path tracked by Git (`.gitignore`: `node_modules/ dist/ .runtime/ .env *.mp4`) |
| `.jeeves/manifest.json` | `1e06c42996279d0c34f1f5db37387b000332ba9cbd6cfb86ef5193aaf4427250` |
| `.jeeves/report.json` | `c7198800605929a6af85bac4b51726d35b00af73e535af233c757b197ba45625`: 0 findings, `processes.runnable: true`, 8 process tiles, 1 local adapter limit |
| `.jeeves/normalized.json` = `diagnostics/generation.json` | `0fc8f85199c5e8a7a46483bceed1ab388246eb8181aed844ac1a61aff2b7bf47` |
| Hash of the sorted per-file list (`find . -type f -print0 \| sort -z \| xargs -0 sha256sum`) | `fdcc066b1f9c497bc8a02e3c32fce1838ba02a8eb8ba7a54de4c4d1597ac9207` |
| Required gaps (9, all `custom`) | asset-lifecycle, event-counter, favorites, multipart and positive-cache application bindings; search application bindings; video-hls worker bindings; `module-watch-api-view-count-reader`; `module-watch-api-view-publisher` |
| Product SQL files (4, header only) | `metadata/modules/upload-api-upload-state-writer.sql`, `metadata/modules/video-lifecycle-lifecycle-writer.sql`, `view-counts/modules/view-counter-count-writer.sql`, `favorites/modules/account-api-favorite-videos.sql` |

**Equality:**

- **A fresh export** into scratch: `diff -r` showed nothing and the hash lists are equal.
- **The studio ZIP, by mouse.** My API (4463) and Vite (4473) ran on the owner's `jeeves`
  database, read only. At 1440×900 and again at 1280×800, I opened **YouTube v3**
  (`e56a3800-…`, revision 171) and clicked **Generate project** (Runnable processes already
  ticked) → **Preview scaffold** → **Download project ZIP**.
  - Preview: "Ready: 112 files", "Processes · 8 · runnable", 0 findings, and **Local adapter
    limits** with **1** row.
  - The ZIP: `jeeves-local-v2-experimental.zip`, 5,149,349 bytes, SHA-256
    `898c9edb3278dc26f24942d0c16405c0b6544fc98db8793271704f121725c5a0`, equal to the preview's
    archive hash. Both downloads were identical: 112 stored entries, manifest
    `1e06c429…7250`.
  - Extracted into an empty directory, all 112 files equal `generated/`.
  - There is no difference to explain.
  - The project kept revision 171 and its `updatedAt`, and showed no page or console error.

## The outside run

**Before.** I recorded the owner's Docker state:

- 43 containers (42 healthy, plus the exited `excalidraw`), 18 volumes, 9 networks and 31 image
  rows (tag, ID and digest);
- v1 (`jeeves-youtube-v1`, 14 healthy, `127.0.0.1:4400`) and v2 (`jeeves-youtube-v2`, 14
  healthy, `127.0.0.1:45400–45402`), both answering `/healthz` 200;
- in 454xx only 45400–45402 listening (45410–45412 closed).

My project was `jeeves-v312-generated` on 45600–45602, all three checked free, with no container,
volume or image of that name.

**The copy:** `cp -a generated` into the session scratchpad, outside the checkout. Its 112
hashes matched `generated/`.

| Step | Command (in the copy) | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile --ignore-scripts` (Node 24.21.0, pnpm 12.16.1) | exit 0, 0.3 s (warm store) |
| Build | `pnpm build` | exit 0, 0.5 s; `dist/processes/` has the 8 tiles |
| First run | `COMPOSE_PROJECT_NAME=jeeves-v312-generated LOCAL_HTTP_PORT=45600 LOCAL_IDENTITY_PORT=45601 LOCAL_OBJECT_PORT=45602 pnpm first-run` | exit 0, 130.0 s (both images built) |
| Stop | `pnpm stop` | exit 0, 4.6 s; every `app-*` and provider exited 0, Keycloak and OpenSearch 143 (their JVMs' SIGTERM exit) |
| Start | `pnpm start` | exit 0, 64.8 s; all healthy again |

**Health:** `docker inspect` of every container, after `first-run` and again after stop and
start, gave the same lines:

```
app-account-api  app-search-api  app-search-indexer  app-transcoder (media image)  app-upload-api
app-video-lifecycle  app-view-counter  app-watch-api       8 app-*:  running healthy restarts=0 policy=no
app-edge                                                   running healthy restarts=0 policy=no 127.0.0.1:45600->8080
cache-hot-metadata  local-broker  local-postgres  search-videos   running healthy restarts=0 policy=no
identity-sign-in                                           running healthy restarts=0 policy=no 127.0.0.1:45601->8080
local-objects                                              running healthy restarts=0 policy=no 127.0.0.1:45602->3900
```

At rest the stack used about 2.1 GiB: OpenSearch 951 MiB, Keycloak 641 MiB, the broker 99 MiB,
and each `app-*` 29–90 MiB.

**Startup logs.** Each of the 11 mounted templates logged its `started` line, for example:

- Viewer check `"sign-in Optional on every module route"`;
- Creator check and Account check `Required`;
- multipart `jobs publisher open, outbox relay started, SELECT 1 on its state login, sweep at start, sweep every 30 s`;
- Video HLS `pinned ffmpeg and ffprobe, results publisher open, subscribed upload-jobs`;
- lifecycle `sweep at start, publication relay started, subscribed processing-events--video-lifecycle`;
- search `cluster health, index videos asserted once its mapping is written`.

Watch API's three stub clients (`metadata`, `view-counts`, `view-events`) each logged a `probe` line
`"result":"ok"`. The Index writer logged its unwritten mapping once at start (`"action":"thrown"`)
and stayed healthy.

**A token.** I made one scratch user, `v312-viewer`, through Keycloak's admin API, with the
copy's admin secret. Its access token came from the real PKCE flow: the authorization endpoint,
the login form, the code, then the token with `code_verifier`. Client `sign-in-web`, redirect
`http://127.0.0.1:45600/`. The password and token were private 0600 files in scratch, now deleted.

### Requests

45 requests through the edge (`http://127.0.0.1:45600`). "Token" means the viewer's token;
"bad" is the same token with its signature changed.

| Request | Answer |
| --- | --- |
| `GET /healthz`; `/api/{account-api,search-api,upload-api,watch-api}/healthz` | 200 `{"service":"<id>","application":"ready"}` |
| `GET …/watch-api-viewer-check/me`, none / token / bad | 200 `{"signedIn":false}` / 200 `{"signedIn":true,"subject":…,"username":"v312-viewer"}` / 401 `SIGN_IN_REQUIRED` |
| `GET …/watch-api-video-details-cache/video-1` | **501 "Not implemented: key for Video details cache"** |
| `GET …/watch-api-view-count-reader` and `…/video-1` | **501 "Not implemented: View count reader"** |
| `POST …/watch-api-view-publisher/video-1` `{eventId}`, `DELETE …/watch-api-view-publisher` | **501 "Not implemented: View publisher"** |
| `GET …/search-api-video-search?q=hello` (and `&page=2`) | **501 "Not implemented: mapping for Index writer"** |
| the same with no `q` or `page=0` | 400 `SEARCH_QUERY` "Enter a query of 1–200 characters and a page from 1–100." |
| `GET …/upload-api-creator-check/me`, none / bad / token | 401 / 401 / 200 with the viewer |
| `POST …/upload-api-multipart-uploads/uploads`, none / bad / token | 401 / 401 / **501 "Not implemented: validate for Multipart uploads"** |
| `GET …/uploads` (token) | 200 `{"uploads":[]}` |
| `GET …/uploads/<uuid>`, `POST …/parts/1`, `…/complete`, `…/abort` (token) | 404 `UPLOAD_NOT_FOUND`; a malformed ID 400 `UPLOAD_ID` |
| `GET …/account-api-account-check/me`, none / token | 401 / 200 with the viewer |
| `PUT …/account-api-favorite-videos/items/video-1`, none / bad / token | 401 / 401 / **501 "Not implemented: eligible for Favorite videos"** |
| `GET …/items/video-1`, `GET …/items`, `DELETE …/items/video-1` (token); `GET …/items` (none) | 404 `NOT_FAVORITE`, 200 `{"items":[],"next":null}`, 204; 401 |
| `GET` / `POST /cdn/video-delivery/videos/x/index.m3u8` | 404 `{"error":"NOT_FOUND","message":"No object for this key."}` / 405 `METHOD_NOT_ALLOWED` |
| `GET /api/watch-api/modules/nope`, `/api/view-counter/healthz` (a worker), `/nothing` | 404 "Route not found." |

Each 501 logged one `not-implemented` line naming its tile, module and hook, for example:

```
{"level":"warn","event":"not-implemented","tile":"upload-api","module":"upload-api-multipart-uploads","what":"validate for Multipart uploads","route":"POST /modules/upload-api-multipart-uploads/uploads","action":"answered 501"}
```

### Messages

From inside `app-watch-api`, with the runtime broker login and the image's amqplib, I sent one
confirmed message to each worker's channel: the `upload-jobs` queue and the `processing-events`,
`publication-events` and `view-events` exchanges. Four seconds later each was in its own
`.failed`, read with `channel.get` and put back. Each loop had logged once, and each queue kept 1
consumer:

| Queue | Dead letter | Log names |
| --- | --- | --- |
| `upload-jobs` | `upload-jobs.failed`, attempt 1, `NOT_IMPLEMENTED` | `job for Segmenter and encoder` |
| `processing-events--video-lifecycle` | `….failed`, attempt 1, `NOT_IMPLEMENTED` | `event for Lifecycle writer` |
| `publication-events--search-indexer` | `….failed`, attempt 1, `NOT_IMPLEMENTED` | `mapping for Index writer` |
| `view-events--view-counter` | `….failed`, attempt 1, `NOT_IMPLEMENTED` | `event for Receipt and increment` |

So every missing hook or stub that a request or message can reach answers by name. As TP08
found, a run reaches only the **first** unwritten hook on each path; the later ones (for
example multipart's `metadata`, `response` and `job`, the lifecycle's `publication`, the cache
read's `load`) are reached once the earlier ones are written, in `app/`.

### Stop and start kept the state

Captured before `pnpm stop` and after `pnpm start` (`state.sh`), the two were identical:

- `.runtime` and `.runtime/secrets` 0700; 22 secrets with the same combined SHA-256
  `1ae98688…654b`; `.runtime/local-setup.json` `c91f8693…599c`;
- the 5 volumes with the same creation times;
- in `d_metadata`, `d_favorites` and `d_view_counts`: the same template tables and views, the
  `m_<module>` schemas of the 4 product SQL files and `published`;
- the Keycloak account (1 user in realm `sign-in`), with the realm's keys kept: the token taken
  before the stop still verified after it, and the same 45 answers came back;
- the 4 dead letters and 1 consumer per queue.

A second message set after the restart went the same way, so each `.failed` then held 2.

`pnpm start` rebuilds the two app images from the build cache. The rebuild gave them new image
IDs, so Compose recreated the `app-*` containers; `restarts=0` is per new container. The state
lives in the volumes and `.runtime`, which were kept.

## Benchmark baseline and scope

`app/` was copied with `cp -a generated app`; `diff -r` and all 112 hashes are equal. This commit
is the baseline (contract §6). The [scope](../../../../../field-projects/youtube/v3/notes/benchmarks/backend-scope.json)
has the contract's paths. [Its file-by-file review](../../../../../field-projects/youtube/v3/notes/benchmarks/scope-review.md)
uses source-loc-v2's own rules over `app/`:

- **Counted:** 71 backend `src/` files, **6,251 LOC**: `src/runtime` 47 / 5,044,
  `src/processes` 8 / 764, `src/modules` 14 / 316, `src/features` 2 / 127.
- **Excluded:** the 4 pure-data binding files (`configuration-or-build`), and 37 files outside
  `src/`, among them the SQL, scripts, Compose, nginx, provenance and docs.
- **UI and tests:** none.

`notes/custom-paths.md` starts with an empty table.

## Gates (D2)

- **Processes-off pin:** passes (`processes-off.test.ts`), with no update; see the fix above.
- **Frozen v2:**
  - a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` gives 72 files, 70 of
    them byte-identical to `generic-export.tar.gz`;
  - `manifest.json` and `report.json` are equal once the processes-off fixture's
    `provenanceWithoutInventory` sets their inventory aside.
- **v1:** byte-identical (the manifest pins in `pnpm check`).
- **YouTube study exports:** unchanged. By mouse on my scratch API and Vite, twice at 1440×900
  and once at 1280×800:
  - Simple `9332ea16be9913598eab3b53829a7bfac8052f9ccc918c27214df9172cb589bd` (3008×2752, 25 lines);
  - Detailed `21fe8400b200a4f0a3bb010e45038f8fd49420b16a23daaf071a1e7ce0219ae1` (3840×3392, 26 lines).

## Cleanup

- **My stack:**
  - `docker compose --profile '*' down --volumes --remove-orphans` on `jeeves-v312-generated`,
    then `docker image rm jeeves-v312-generated-app:latest jeeves-v312-generated-media:latest`;
  - the copy's tracked bytes still matched all 112 hashes after the run;
  - then I deleted the copy with its `.runtime/secrets`, `node_modules` and `dist`, and the
    scratch password, token and logs.
- **The rest of my scratch work:** the scratch exports, the pre-fix archive and its export, the
  extracted ZIPs and v2 archive.
- **My servers:** the APIs (4462, 4463) and Vite servers (4472, 4473) are stopped, and
  `jeeves_v312` is dropped.
- **The owner's eight projects:** the same revisions and `updatedAt`, and the same counts of
  design revisions, operations and layouts.
- **Against the record taken first:**
  - the owner's 43 container IDs and names, 18 volumes, 9 networks and 31 image tag and digest
    rows are identical;
  - 42 containers are healthy, with unchanged restart counts and start times;
  - both edges (4400, 45400) answer `/healthz` 200;
  - in 454xx only 45400–45402 listen;
  - no container, volume, network or image tag named for V3-12 remains;
  - the repository holds no runtime secret of mine.
