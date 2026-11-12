# YouTube v3 owner review pack

**Where v3 stands.** v3 was designed by mouse in the studio (V3-11). It was exported once into
`generated/` (V3-12), and that export was completed in a copy, `app/` (V3-13 to V3-16).

V3-17 ran `app/` from a fresh copy outside the checkout and observed S01–S10 by mouse and by API:
**seven scenarios in full, S05 except human listening, and S02, S04 and S08 in part.** All three
partial rows have one cause: the upload's status can't show the video's state (template gap 1).

The backend is **91.75% template source**: 6,184 of 6,740 lines. The other 556 lines are the
product's hooks and stub bodies.

[Scenarios, row by row](scenarios.md) · [V3-17 evidence](../../../../docs/plans/youtube-v3/evidence/v3-17/README.md)
· [benchmark](benchmarks/README.md) · [custom paths](custom-paths.md) ·
[how both outputs run](README.md#how-to-run-each) · [template gaps](README.md#template-gaps-found-while-completing-app)
· the studio project **YouTube v3** ([open](http://127.0.0.1:4300/?project=e56a3800-d0d6-43df-b6d0-01019c4bae8b)).

## The two outputs

| Folder | What it is | Generated or custom |
| --- | --- | --- |
| [`generated/`](../generated/) | The exact export of [`inputs/design.json`](../inputs/design.json) with Runnable processes on: 112 files, the same bytes as Generate project's ZIP. Never edited. | All generated |
| [`app/`](../app/) | `generated/` plus the rest of the solution: 129 files | 95 files are byte for byte the export. 34 are custom ([`custom-paths.md`](custom-paths.md)): 13 backend `src/` files, 1 product SQL file, 7 integration files, 9 UI files and 4 test files |

What is custom in `app/`, by area:

- **Hooks and stub bodies (backend, counted):**
  - the shared `video-contract.ts`;
  - all 8 hooks files: upload, lifecycle, transcoder, details cache, counter, favorites, index
    writer and search;
  - the 2 stub bodies, View count reader and View publisher.
- **Product SQL (not counted):** `published.videos`, in the Lifecycle writer's SQL file.
- **Integration (not counted):**
  - the account script (the creator role and three local accounts);
  - the browser build and its sign-in binding;
  - six scaffold edits:
    - two lines so a module can name its message's ID (gap 6);
    - four small edits so the edge serves the browser (gap 8).
- **UI (not counted):** v2's browser in `browser/` and `public/`, on v3's routes, with optional
  sign-in for watchers, a ☆/★ toggle and My favorites.
- **Tests (not counted):** 19 offline tests in `test/`.

## Run it yourself

No v3 stack is left running; each unit removed its own. To review `app/` by hand, use your own
copy:

```sh
export PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH
cp -a field-projects/youtube/v3/app ~/youtube-v3-app && cd ~/youtube-v3-app
pnpm install --frozen-lockfile --ignore-scripts && pnpm build
export COMPOSE_PROJECT_NAME=youtube-v3-review LOCAL_HTTP_PORT=45720 LOCAL_IDENTITY_PORT=45721 LOCAL_OBJECT_PORT=45722
pnpm first-run              # about 2 minutes; 15 containers healthy
node scripts/accounts.mjs   # creator, other-creator and viewer; passwords in .runtime/secrets/*_password
```

Then open <http://127.0.0.1:45720/>:

1. **Sign in** as `creator` (password in `.runtime/secrets/creator_password`).
2. **Upload** v1's fixture (`field-projects/youtube/v1/app/.runtime/media/youtube-v1-fixture.mp4`),
   with a title and a description. You can Pause upload, refresh, reselect the file and click
   Resume selected upload.
3. **Wait for ready.** The upload reads "uploaded · not ready yet", then "ready" about 5 s later.
4. **Watch signed out.** Sign out, search for a word of the title, and click Watch video. Listen
   for the 440 Hz tone; nobody has listened yet. The count rises after 2 seconds of play.
5. **Favorites.** Sign in as `viewer` on the watch page, play again, then click ☆ and see My
   favorites.

`pnpm stop` and `pnpm start` keep everything. To remove it, run `docker compose --profile '*' down
--volumes --remove-orphans`, then `docker image rm youtube-v3-review-app youtube-v3-review-media`,
then delete the copy.

To read `generated/` as it runs, the [notes](README.md#what-generated-answers) list what each
route answers ("Not implemented" naming its hook) and how to run it the same way.

## What was observed (V3-17)

| | Result |
| --- | --- |
| S01, S03, S06, S07, S09, S10 | Observed by mouse and by API |
| S05 | Observed, except human listening. The decoded audio peaked at 440 Hz, but Chromium ran muted |
| S02 | Partial. Complete answers 200, not 202, and the page shows "uploaded · not ready yet", not "pending" |
| S04 | Partial. The full sequence, H.264/AAC 360p and 720p HLS, and publication only when ready were observed by API. The page can't show processing or "failed", and the encoder's log isn't kept |
| S08 | Partial. A refused token, an oversize file and a non-MP4 file show clear errors, and the server answers 401, 413 and 422. Invalid media fails with no publication, but the page still says "not ready yet". Stop and start kept everything |

## Screenshots

| | |
| --- | --- |
| [Creator](../../../../docs/plans/youtube-v3/evidence/v3-17/v3-17-creator.png) | Recent uploads: ready, aborted, and an invalid file still "not ready yet" (gap 1) |
| [Anonymous watch](../../../../docs/plans/youtube-v3/evidence/v3-17/v3-17-anonymous-watch.png) | Signed out, from search: playing, "1 views", no favorites UI |
| [Viewer favorites](../../../../docs/plans/youtube-v3/evidence/v3-17/v3-17-viewer-favorites.png) | Signed in as viewer: "★ In favorites" and My favorites |
| [After restart](../../../../docs/plans/youtube-v3/evidence/v3-17/v3-17-after-restart.png) | After stop and start: the favorite and the count are kept |

The [studio diagrams](../diagrams/) show the design as built: Detailed and Simple.

## What remains

- **Template gaps 1–8** ([notes](README.md#template-gaps-found-while-completing-app)). Gap 1 (the
  upload's status, 202) is the one the acceptance feels. Gaps 6 and 8 are why `app/` edits six
  generated files.
- **Human listening** for S05, and the encoder's log for v1's S04 wording.
- **V3-18** reviews the owner's feedback items 1–14 and D1–D8 against this evidence.
