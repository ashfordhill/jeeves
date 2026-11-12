# V3-16 evidence: complete search and the browser

2026-11-11. [Plan](../../units.md#v3-13-to-v3-16--complete-v3-in-app) (the V3-16 row) ·
[contract](../../contract.md) §5 (search data), §6 (the reused v2 browser) and §7 ·
field project [notes](../../../../../field-projects/youtube/v3/notes/README.md) ·
[custom paths](../../../../../field-projects/youtube/v3/notes/custom-paths.md) · v1's
[bounded policies](../../../../../field-projects/youtube/v1/notes/scenarios.md#bounded-v1-policies).

**Result:** `app/` now works end to end in a browser served by its own edge:

- **Search:** a ready video's `VideoPublished` is indexed as its public record (v2's mapping,
  version 1). `…/search-api-video-search?q=&page=` finds ready, public videos by title,
  description or channel (v1/v2's preset), 20 a page, newest first among equal scores, each hit with
  its thumbnail under `/cdn/video-delivery/`. Failed and unfinished uploads are never found.
- **The browser:** v2's minimal page, moved to v3's routes, at the edge's origin `/`. A creator
  signs in, uploads with pause and resume and sees the status. Anyone searches and watches (HLS,
  seek), and a play counts after 2 seconds. A signed-in account also gets a ☆/★ toggle and "My
  favorites"; signed out there is no favorites UI.
- **Scaffold edits (gap 8):** the export has no place for a browser, so serving it took four
  small edits to generated files (`infra/edge/nginx.conf`, `compose.yaml`, `package.json`,
  `.gitignore`). The search hooks needed none. **`generated/` is untouched.**

## What was written

All of it in `app/`, each path a row in [`custom-paths.md`](../../../../../field-projects/youtube/v3/notes/custom-paths.md).

| Path | Area | What |
| --- | --- | --- |
| `src/modules/search-indexer/search-indexer-index-writer.hooks.ts` | hook | `mapping` (v2's `publicVideoMapping`), `document.parse` (the contract's `publicVideo`), `document.id` (videoId), `document.version` (publicationVersion), `event` (`VideoPublished` bound to its message ID, envelope dropped) |
| `src/modules/search-api/search-api-video-search.hooks.ts` | hook | `preset` (v2's `publicVideoQueryPreset`) and `hit` (v2's fields, `thumbnailUrl` under `/cdn/video-delivery/`) |
| `browser/auth.ts`, `main.ts`, `watch.ts`, `search.ts`, `playback-policy.ts` | UI | v2's five files on v3's routes; Optional sign-in for watchers (token when signed in; a 401 or an expired sign-in asks to sign in again); a sign-in returns to the watched video |
| `browser/favorites.ts` | UI (new) | D4: the ☆/★ toggle and "My favorites", only when signed in |
| `public/index.html`, `public/style.css`, `tsconfig.browser.json` | UI | v2's, plus the toggle and the favorites section in the page |
| `scripts/build-browser.mjs`, `scripts/browser-config.mjs` | integration | v2's build into `dist-public/` and the sign-in binding for the run's ports |
| `infra/edge/nginx.conf`, `compose.yaml`, `package.json`, `.gitignore` | integration (**scaffold edit**) | the edge serves `dist-public/` at `/`; `first-run` and `start` build it; Git ignores it |
| `test/search.test.ts` | test | 4 offline tests |

**Backend LOC:** source-loc-v2 over a temporary commit object of this tree against `d94b13a`
(the scope unchanged, `507a225b…0084`): **72 counted files, 6,740 LOC, 556 post-template, 67
replaced, 91.75% template**. V3-16 adds **58 post-template lines** (Index writer 30, Video
search 28) and replaces 10. The six `browser/` files are `ui-source`. `public/`, the scripts, the
tests and the four edited files are `outside-src`. Nothing UI is counted.

## Template gap 8 and the scaffold edits

The export serves no browser and has no place for one. The edge's `location /` answers 404 JSON,
`app-edge` mounts only `nginx.conf`, and nothing builds a browser or writes its sign-in binding
(issuer, client, callback) for the run's ports. v2's own edge had a `location /` and a
`dist-public` mount, and its `local.mjs` built and configured the browser. In v3 the smallest
route was four edits:

- **`nginx.conf`:** `location /` serves the mount (HTML, CSS and JS types, `index.html`,
  `no-cache`, `nosniff`); any other path stays the export's 404 JSON.
- **`compose.yaml`:** the edge mounts `./dist-public` read only, with `create_host_path: false`,
  so a missing build fails rather than Docker making an empty, root-owned folder. The JSON line is
  otherwise the export's, byte for byte.
- **`package.json`:** `first-run` and `start` run `node scripts/build-browser.mjs` first. `build`
  is unchanged, because the Docker image runs it and has no browser.
- **`.gitignore`:** `dist-public/`.

`local.mjs` records `compose.yaml`'s hash, so **an existing v3 runtime refuses to start with the
new edge**: `Runtime project/ports/composition/history differs` (step 8 below). A fresh
`first-run` is needed. The generator fix: when a design has a user, emit a browser folder the
edge serves at `/`, a build step and the sign-in binding. The search hooks expressed v1/v2's policy
fully; no search gap.

## Docker: the owner's state, recorded first

- **Containers:** 43, of which 42 are healthy. The other is `excalidraw`, exited 9 days ago.
- **Other resources:** 18 volumes, 9 networks and 31 image rows (tag, ID and digest).
- **v1:** edge `127.0.0.1:4400/healthz` 200. **v2:** 45400–45402, edge 200.
- **Ports:** in 454xx only 45400–45402 listened.

**Mine:** loopback **45680** (HTTP), **45681** (identity) and **45682** (objects), all free.
Two projects: `jeeves-v316-browser` for the steps, then `jeeves-v316-final` for the browser run.

## The steps, in the order a message and then a search reach the hooks

**The copy:** a `git archive` of `app/` at V3-15's commit (117 files), in the session scratchpad.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts` (Node 24.21.0, pnpm 12.16.1) | exit 0, 0.3 s |
| `pnpm build` | exit 0, 0.5 s |
| `pnpm first-run` | exit 0, 120.2 s; 15 healthy, 0 restarts |
| `node scripts/accounts.mjs` | exit 0 |

**Each step:** `stage.py` put the export's "Not implemented" body back in every hook after the step.
Then `pnpm build`, `pnpm stop` and `pnpm start`. As the creator, by the real PKCE flow, it uploaded
one fixture titled for the step (v1's 15,584,953-byte fixture, copied read only); every one was
ready about 5 s after complete. Then `indexstate.mjs` read the index and the indexer's dead letters
inside `app-search-indexer`, and `searchprobe.mjs` made the searches through the edge. Every
restart was **15 healthy, 0 restarts**.

| Step | Written | Stop / start | Where the message and the search stop |
| ---: | --- | --- | --- |
| 0 | nothing (V3-15's commit) | (first-run 120.2 s) | no `videos` index. The publication of `ce0dfd82…` is on `publication-events--search-indexer.failed`, attempt 1, `NOT_IMPLEMENTED` "mapping for Index writer". Every search 501 "mapping for Index writer" |
| 1 | `mapping` | 8.4 / 77.6 s | **the index is created at start:** `dynamic: strict`, `_meta.version` 1 and the 11 properties as written. The message stops at "event for Index writer"; the search at 501 "preset for Video search" |
| 2 | `event` | 4.4 / 78.7 s | "document.parse for Index writer" |
| 3 | `document.parse` | 4.2 / 81.4 s | "document.id for Index writer" |
| 4 | `document.id` | 4.2 / 76.7 s | "document.version for Index writer" |
| 5 | `document.version` | 8.1 / 76.6 s | **indexed:** `abeb09da…` at `_version` 1, exactly the public record (11 fields, no envelope). The search is still 501 "preset" |
| 6 | `preset` | 4.6 / 77.0 s | index count 2; a search with hits is 501 "hit for Video search"; page 2 (no hits) is 200 `total: 2` |
| 7 | `hit` (= `app/`'s hooks) | 4.4 / 76.8 s | **200:** `q=step7` 1 hit; `synthetic` (description) and `creator` (channel) 3 hits each, newest first (step 7, 6, 5) |

In every step, a `q` that was empty or over 200 characters, a `page` of 0 or 101, or an extra
`sort=views` answered 400 `SEARCH_QUERY`.

A step 7 hit, as answered:

```json
{
  "videoId": "f77fc2a8-2769-4b5b-bd12-379ad000224e",
  "title": "V3-16 step7: test card",
  "description": "V3-16 step7: a 20 s synthetic test card and 440 Hz tone.",
  "channel": "creator", "durationSeconds": 20,
  "publishedAt": "2026-11-12T00:52:43.334Z",
  "thumbnailUrl": "/cdn/video-delivery/videos/f77fc2a8-…/7cc67d07-…/9768a906-…/thumbnail.jpg"
}
```

Its `thumbnailUrl` through the edge: 200 `image/jpeg`, 68,896 bytes.

**After step 7, on the same stack:**

- **Never found:** an invalid upload ("V3-16 extras: invalid media", failed `INVALID_MEDIA`) and an
  upload started and never completed ("… never completed", uploading). Searching for their titles
  gives `total: 0`. The step 0 invalid upload never appears either.
- **Dead letters sent back:** the five publications refused at steps 0–4 were still in `.failed`.
  `indexstate.mjs` with `MODE=requeue` put them back on the queue as fresh messages (same body and
  message ID). All five were indexed at `_version` 1: index count 8, `.failed` 0, and
  `synthetic` → `total: 8`, newest first.
- **The edge:** at step 7, `/` was still the export's 404 JSON.

**Step 8, the browser on the existing runtime:** the copy got `app/`'s final files
(`diff -rq` against `app/` empty, apart from the build output). `pnpm start` built the browser,
then refused: "Runtime project/ports/composition/history differs; preserve original values and
volumes." `compose.yaml` had changed (gap 8). The stack was untouched (15 healthy, 0 restarts).
So the copy went `down --volumes`, both image tags were removed, and the browser run used a fresh
copy.

## The browser run (`jeeves-v316-final`)

**The copy:** `app/`'s working tree (129 files, no build output). `pnpm install` exit 0;
`pnpm build` 0.45 s; `node --test "test/*.test.ts"` **19 passed**.

**The recorded run** (`final-run.sh`) started from a fresh `pnpm first-run`:

- **Setup:** first-run 116.4 s, which built the browser into `dist-public/` first. The accounts
  script took 0.66 s. 15 healthy, 0 restarts.
- **The edge:** `/` 200 `text/html`; `/main.js`, `/hls.min.js` and `/runtime-config.js` 200
  `text/javascript`; `/style.css` 200 `text/css`. `/nope` 404 `application/json` and `/healthz`
  200. `/` sends `Cache-Control: no-cache` and `X-Content-Type-Options: nosniff`.
- **The browser:** Playwright 1.63.0's Chromium at 1280×900. Every action is a mouse click on the
  control; text is typed into fields, the fixture is chosen through the file chooser, and the
  only keyboard use is that typing. Scripts: `app.spec.mjs` and `refused.spec.mjs` in the harness.

**Phase A (passed, 28.0 s):**

| Step | What happened |
| --- | --- |
| Signed out | "Signed out" and Sign in; Upload video disabled; no favorites section; the message says watching and search need no sign-in |
| Creator signs in | Keycloak's own page (username, password, Sign In) → back at `/`, "Signed in as creator", Sign out shown; Recent uploads "No uploads yet." |
| Upload, then pause | The fixture, a title and a description, then Upload video, with upload throughput held to 1 MiB/s. Part 1 PUT 200; Pause during part 2 aborted its PUT (`net::ERR_ABORTED`) |
| Refresh | The page reloaded and selected the same upload: "Selected “V3-16 browser: test card”. Reselect the same file and click Resume." Progress "1 of 3 parts acknowledged · uploading", from ListParts |
| Resume | The same file again, then Resume selected upload. **Only parts 2 and 3** were sent (both PUT 200), each part signed first, then complete 200: "Upload received…" |
| Ready | 4.8 s later the creator's list showed "ready" and Watch video |
| Sign out | Back at `/`, "Signed out" (Keycloak's logout with the ID token hint) |
| Anonymous search | "synthetic test card": the first click gave "0 results" (indexing takes about a second), the second, 2.1 s later, "1 results". Also found by "creator" (channel) and "uploaded by mouse" (description) |
| Anonymous watch | Watch video → title, "creator · 20 seconds", "0 views"; **no favorite toggle and no favorites list** |
| Play | The player's play control: playing; "Playback accepted" 2.8 s later; **"1 views" 3.7 s after the click**. Browser HLS: master, the 360p and 720p playlists and `.ts` segments under `/cdn/video-delivery/`, all 206. 90 frames decoded, 0 dropped |
| Seek | A click at 60% of the timeline → 12.03 s; 3 s later 14.92 s, still playing, 174 frames, 0 dropped; **still 1 view** |
| Viewer signs in on the watch page | Sign in → Keycloak → back to `/?watch=<id>` with the video open, "Signed in as viewer". The toggle shows ☆ Add to favorites and My favorites says "No favorites yet". The upload panel says "Uploads need a creator account." (the list answered 403 `CREATOR_REQUIRED`; the sign-in is kept) |
| Viewer plays | A new page load, so a new event ID: "Playback accepted" 2.8 s after the click, **"2 views"** |
| Favorite | ☆ → "★ In favorites"; My favorites lists the video (title, Watch video, Remove) |
| Unfavorite | ★ → "☆ Add to favorites"; "No favorites yet" |
| Favorite again | ★, kept for the restart |

No page errors. The browser's console logged four "Failed to load resource" lines, each an answer
the page reads: 404s for a video not yet ready and an item not yet a favorite, and the viewer's
403 above. The request log missed the 404s; Playwright records a request once its body is read,
and the page reads only those answers' status.

**The plays on View events:** a scratch queue (`v316-tap-views`) bound to the exchange got two
messages, each with its event ID as message ID:

- the anonymous play, with `viewer: null`;
- the viewer's, with `viewer` = the viewer's subject `b1150acc-…` (Keycloak's user ID for
  `viewer`).

The counter kept one receipt for each, with that viewer in its identity, and the total is 2. The
counter's `.failed` was empty.

**A refused token** (`refused.spec.mjs`, passed): the viewer signed in, then the stored token's
signature was changed, and the viewer opened the video by ID. The page sent one details request,
**with** the token. It got 401, then showed "Your sign-in expired or was refused. Sign in again."
in the header message and the watch status, "Signed out" and Sign in, and no favorites. It never
retried anonymously.

**Stop and start:** `pnpm stop` 4.8 s, then `pnpm start` 67.1 s (it rebuilt the browser first),
15 healthy, 0 restarts. A snapshot before and after was **identical**:

- `.runtime` and `.runtime/secrets` 0700, 25 secrets, the same combined hash, `local-setup.json`;
- the 5 volumes' creation times;
- the video ready and in `published.videos`;
- the total (2) and the 2 receipts;
- 1 favorite;
- the index (1 document, the same hash);
- the cached details record;
- the realm's 3 accounts.

**Phase B (passed, 4.4 s), after the restart:**

1. Signed out: search found the video. Watch video showed **"2 views"**; the player had loaded
   (`readyState` 4).
2. The creator signed in; the list still showed "ready".
3. The creator signed out. **Signing in as `viewer` asked for the password again** (Keycloak's
   form).
4. My favorites still listed the video. Its Watch video opened it with ★ and 2 views.
5. **Remove** emptied the list ("No favorites yet") and set the toggle to ☆. The database then
   held 0 favorites.

| Screenshot | What |
| --- | --- |
| [Creator: upload](v3-16-creator-upload.png) | After the resume: "Upload complete · ready", Recent uploads with the video ready and Watch video |
| [Anonymous watch](v3-16-anonymous-watch.png) | Signed out, after search: playing at 0:14 after the timeline seek, "1 views", "Playback accepted", no favorites UI |
| [Viewer favorites](v3-16-viewer-favorites.png) | Signed in as viewer on the watch page: "2 views", "★ In favorites", My favorites with the video |
| [After restart](v3-16-after-restart.png) | After `pnpm stop` and `pnpm start`: the viewer's My favorites still holds the video, "2 views", ★ |

**Earlier attempts, for the record.** The recorded run is the fifth attempt, on the fourth fresh
first-run of this project; the stack was reset with `down --volumes` before each later first-run.
The browser code didn't change between them; only the spec did:

1. On the first stack, twice: the spec checked the fieldset itself (`toBeDisabled` doesn't apply
   to it; it now checks Upload video), then searched once, too soon after ready (it now searches
   again, as a person would, within 60 s, S06).
2. It clicked the player's controls before the smooth scroll had brought them into view; it now
   waits for the player to stop moving.
3. Every step passed, but the console check counted the viewer's expected 403. It now allows
   401, 403 and 404 answers that the page reads.

## Tests

- **`test/search.test.ts`:** with V3-13's to V3-15's tests, `node --test "test/*.test.ts"` gives
  **19 passed** (4 new) in the copy. The tests use an in-memory OpenSearch with the template's real
  `openSearchIndex`, `startSearchIndexWorker` and `createSearchHandler`:
  - the index is created strict from the mapping, and the query opens it again;
  - the lifecycle's real `publication.construct` output indexes once, without its envelope;
  - another message ID, a private, processing or unbound record, an extra field or another type
    is `MALFORMED_MESSAGE`;
  - the exact OpenSearch request (from 20 on page 2, 20 a page, 750 ms, exact totals, the preset);
  - the hit's shape;
  - bad input, a hit under another ID, and a private hit are refused.
- **Types:** `tsc --noEmit` passed for every staged step (1–7). The browser compiled with
  `tsconfig.browser.json` (strict, DOM).

## Gates (D2)

- **`generated/`:** `git diff d94b13a -- field-projects/youtube/v3/generated/` is empty, and
  there are no untracked files in it.
- **The processes-off pin and v1:** `processes-off.test.ts`, `generator.test.ts` and
  `assemble.test.ts` pass (3 files, 17 tests), and were in `pnpm check` too. v1 is byte-identical.
- **Frozen v2:** a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` gives 72
  files, the same paths as `generic-export.tar.gz`, 70 byte-identical; `manifest.json` and
  `report.json` are equal under `provenanceWithoutInventory`. No difference to report.
- **`custom-paths.md`** has a row for every path that `diff -rq generated app` lists, leaving out
  `node_modules`, `dist`, `dist-public` and `.runtime`.

## Repository checks

- **`pnpm check`:** exit 0 (71 s), **748 tests in 104 files** (the app's tests run with Node's own
  runner, outside the repository's suite); lint only the existing info.
- **E2E:** **80 passed (5.7 m)** on the first full run, with my Docker stacks down.
- **The connection-dots flake** (`connection-dots.spec.ts`, V3-15's `:208`, now `:213`): its
  `camera()` wait returned after one unchanged read 60 ms apart, which can fall between two slow
  frames of a Fit or wheel animation under load. It now waits for three unchanged reads 100 ms
  apart, as `stillBoard` does; no assertion changed. The file passed **15 of 15** with
  `--repeat-each=5` (42.8 s), and the full run above. The cause isn't proven: the edge pan also
  moves at most 50 ms a frame, so very slow frames could still exceed `holdPastEdge`'s 15 s
  budget. That is for V3-18 if it recurs.
- **Web build:** passed (1.20 s), with the existing chunk-size advisory.
- **Studio browser check** (scripted Chromium, by mouse, through the e2e helpers): my API on 4468
  with the scratch database `jeeves_v316` (now dropped) and Vite on 4478. At 1440×900 and 1280×800
  it made the TinyURL foundation study and showed Detailed and Simple: 7 tiles and 7 lines in
  each, no page or console error, both projects deleted (204). No studio UI changed in this unit.
- **Dev servers:** the owner's 4300 and 4310 were not touched. Mine on 4468 and 4478 are stopped.

## Cleanup

- **Projects:** both are down with their volumes. Their 4 image tags are removed, and no
  container, volume or network of either is left.
- **Files:** the copies (with `.runtime`, its passwords and `dist-public`), the fixture copies, the
  browser outputs, the type-check folder and the temporary benchmark index are deleted. The
  temporary commit object is unreferenced.
- **The owner's state** matches the record: 43 containers (IDs, restart counts, start times,
  health), 18 volumes, 9 networks and 31 image rows. 42 are healthy, both edges answer 200, and
  only 45400–45402 listen in 454xx.
