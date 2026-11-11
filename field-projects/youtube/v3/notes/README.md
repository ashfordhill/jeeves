# YouTube v3

YouTube v3 is v2's video platform designed again in the studio, by mouse, from a blank project,
with the studio's v3 additions: an **Optional** sign-in for watchers on Watch API, a separate
**Account API** whose **Favorites** keep each signed-in account's favorite videos, kind labels
instead of kind words in names, and **Runnable processes** on. It has 21 tiles, 33 lines in
Simple (8 dashed, all through a queue or topic), 26 modules (24 Template, 2 Stub), 30 module
connections and 8 useful values.

- **Plan:** [YouTube v3 plan](../../../../docs/plans/youtube-v3/units.md) (V3-11 to V3-17).
- **Design:** [v3 contract](../../../../docs/plans/youtube-v3/contract.md) §5, as data in
  [`fixtures/v3-modules.ts`](../../../../jeeves/packages/spec/src/fixtures/v3-modules.ts).
- **Built by mouse:** [V3-11 evidence](../../../../docs/plans/youtube-v3/evidence/v3-11/README.md)
  and its spec, [`e2e/v3-build.spec.ts`](../../../../jeeves/apps/web/e2e/v3-build.spec.ts).

## The studio project

**YouTube v3**, ID `e56a3800-d0d6-43df-b6d0-01019c4bae8b`, saved revision **171**, in the owner's
`jeeves` database ([open](http://127.0.0.1:4300/?project=e56a3800-d0d6-43df-b6d0-01019c4bae8b)).

## Snapshot (V3-11)

| File | What |
| --- | --- |
| [`inputs/design.json`](../inputs/design.json) | The saved design in the server's canonical encoding (sorted keys, array order kept, UTF-8, no trailing newline), the bytes Generate project assembles. SHA-256 `9762df418108917c71f42de6190c3c756d1db62dbaeca83653b6e9b6db93813f`. Don't pretty-print or resave it. |
| [`inputs/blueprint.json`](../inputs/blueprint.json) | Blueprint v3 of the same revision (`GET /api/projects/<id>/blueprint?version=3`). |
| [`diagrams/detailed.png`](../diagrams/detailed.png), [capture](../diagrams/detailed-capture.json) | Export diagram → PNG in Detailed: 5312×3520, 24 tiles (with the user and actions), 37 lines. |
| [`diagrams/simple.png`](../diagrams/simple.png), [capture](../diagrams/simple-capture.json) | Export diagram → PNG in Simple: 3904×2976, 24 tiles, 33 lines. |

Both captures name revision 171 and the design's SHA-256 above. They were taken from a Vite dev
server at commit `2cf676f`; its uncommitted changes were V3-11's e2e files and the owner's
`.jeeves-feedback/`, none of them renderer code.

## Two outputs

The owner asked for two outputs per field project ([owner feedback](../../../../docs/plans/youtube-v3/units.md#owner-feedback-2026-11-10)
item 11, decision D8):

| Folder | What it is | Who edits it |
| --- | --- | --- |
| [`generated/`](../generated/) | **Generated code only.** The exact export of [`inputs/design.json`](../inputs/design.json) with Runnable processes on, as Generate project's ZIP gives it. Read it to see what Jeeves writes from the diagram. | Nobody, ever. |
| [`app/`](../app/) | **Generated code plus the rest of the solution.** It starts as a byte-for-byte copy of `generated/` and is completed in place. | V3-13 to V3-16, each change listed in [`custom-paths.md`](custom-paths.md). |

### `generated/`

It was made in V3-12 by `pnpm --filter @jeeves/generator export:v2
"$PWD/field-projects/youtube/v3/inputs/design.json" <new directory>`, which uses the same
assembler and template registry as the studio's **Generate project → Download project ZIP**.
It has 112 files (5,133,781 bytes), 0 findings and `processes.runnable: true`; manifest SHA-256
`1e06c42996279d0c34f1f5db37387b000332ba9cbd6cfb86ef5193aaf4427250`. A fresh export and the
studio ZIP of the kept project gave the same 112 files, byte for byte
([evidence](../../../../docs/plans/youtube-v3/evidence/v3-12/README.md)).

Nothing was added to it, removed from it or reformatted. Its [`README.md`](../generated/README.md)
is the export's own, which is why this explanation lives here. Biome skips it. Later units check
that `git diff <V3-12 commit> -- field-projects/youtube/v3/generated/` is empty.

Where to look:

- **`src/processes/<tile>.ts`:** one process per application tile (four HTTP, four workers),
  with its compiled settings and what it mounts.
- **`src/runtime/`:** the reusable mechanisms (sign-in, multipart, lifecycle, HLS, cache, counter,
  favorites, search, delivery, loops).
- **`src/modules/`:** what is yours to write. There are 9 hooks files and the 2 stub bodies,
  View count reader and View publisher.
- **`infra/postgres/`:** the template migrations, plus the 4 product SQL files, which are empty
  in the export.
- **`.jeeves/report.json`:** what runs, every route and loop, and the 9 required gaps (7 template
  binding files and the 2 stubs).

### `app/`

At V3-12, `app/` equals `generated/`, byte for byte. That commit is the backend LOC benchmark's
baseline (contract §6), with the reviewed [scope](benchmarks/backend-scope.json) and its
[file-by-file review](benchmarks/scope-review.md): 71 backend `src/` files, 6,251 LOC. V3-13 to
V3-16 then fill in the following, and V3-17 measures the result:

- the product hooks;
- the two stub bodies;
- the product SQL (`published.videos`);
- the account script;
- the reused v2 browser.

**`app/` doesn't fully work until V3-16.** Until then it runs and is healthy exactly like
`generated/`, but each request or message stops at its first unwritten hook.

#### Progress

| Unit | Area | State |
| --- | --- | --- |
| V3-13 | Upload | **Done** ([evidence](../../../../docs/plans/youtube-v3/evidence/v3-13/README.md)). The account script; the creator check on multipart's `principal`; every multipart hook; the lifecycle's `metadata`, `job` and `response`. A signed-in creator starts a multipart upload, sends its parts to signed URLs, pauses and resumes from the parts that arrived, and completes it; the job reaches Upload jobs. Anonymous 401, a non-creator 403, another creator 404, an aborted upload 410. |
| V3-14 | Processing and lifecycle | Next. The Transcoder answers the job "Not implemented: job for Segmenter and encoder", so a completed upload stays `pending` and the lifecycle fails it `QUEUE_DEADLINE` after 10 minutes. |
| V3-15 | Watch and Favorites | To do |
| V3-16 | Search and the browser | To do |

What each unit wrote is in [`custom-paths.md`](custom-paths.md); what the templates can't yet
express is under [template gaps](#template-gaps-found-while-completing-app).

### How to run each

Both run the same way: Node 24.21.0, pnpm 12.16.1 and Docker. Run `generated/` from a copy
outside the checkout, so the folder stays the bare export. `app/` can run from a copy too. Its
`.gitignore` keeps `node_modules`, `dist` and `.runtime` out of Git if it runs in place.

```sh
cp -a field-projects/youtube/v3/generated /somewhere/youtube-v3-generated   # or .../app
cd /somewhere/youtube-v3-generated
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
export COMPOSE_PROJECT_NAME=youtube-v3-generated \
  LOCAL_HTTP_PORT=45600 LOCAL_IDENTITY_PORT=45601 LOCAL_OBJECT_PORT=45602
pnpm first-run          # once: about 2 minutes, then 15 containers healthy
node scripts/accounts.mjs   # app/ only, once: the creator role and the three local accounts
pnpm stop               # drains every process; keeps volumes and .runtime
pnpm start              # back, with the same credentials and data
```

**Ports:** pick a unique project name and three free loopback ports. Avoid the owner's v1
(4400) and v2 (45400–45402) stacks and Jeeves' own ports.

**Where things answer:**

- the edge at `http://127.0.0.1:$LOCAL_HTTP_PORT/healthz`, and each public tile under `/api/<tile>/`
  (for example `/api/watch-api/modules/watch-api-viewer-check/me`);
- Keycloak's sign-in at `$LOCAL_IDENTITY_PORT` (realm `sign-in`, client `sign-in-web`);
- Transcoded videos at `/cdn/video-delivery/`.

**Credentials:** they are generated into the copy's private `.runtime/secrets` and are never in
Git. In `app/`, `node scripts/accounts.mjs` adds the realm role `creator` and three accounts:
`creator` and `other-creator` (creators) and `viewer` (not a creator). Their passwords are in
`.runtime/secrets/creator_password`, `other_creator_password` and `viewer_password`. Sign in
through Keycloak's own page (client `sign-in-web`, PKCE); there is no sign-up.

**Clean up a disposable copy:**

1. `docker compose --profile '*' down --volumes --remove-orphans`, with the same environment.
2. `docker image rm "$COMPOSE_PROJECT_NAME-app" "$COMPOSE_PROJECT_NAME-media"`.
3. Delete the copy, with its `.runtime`.

### What `generated/` answers

From V3-12's outside run, every route and loop answers, and each one stops at the first hook on
its path, which names itself:

| Path | Answer |
| --- | --- |
| Viewer check `me`, Optional | `{signedIn:false}` without a token, the account with one, and 401 for a bad one |
| Creator check and Account check `me`, Required | 401 without a token, the account with one |
| Video details cache `GET …/<id>` | 501 "Not implemented: key for Video details cache" |
| View count reader and View publisher, any method | 501 "Not implemented: View count reader" / "View publisher" |
| Video search `?q=` | 501 "Not implemented: mapping for Index writer"; 400 `SEARCH_QUERY` for a bad `q` or `page` |
| Multipart `POST …/uploads`, signed in | 501 "Not implemented: validate for Multipart uploads"; the list is empty; an unknown upload is 404 |
| Favorites `PUT …/items/<id>`, signed in | 501 "Not implemented: eligible for Favorite videos"; check 404, list empty, remove 204; 401 signed out |
| `/cdn/video-delivery/<key>` | 404 JSON for a missing key, 405 for a write |
| Upload jobs, Processing events, Publication events, View events | the message goes to its queue's `.failed` with `NOT_IMPLEMENTED` at attempt 1, and the log names `job for Segmenter and encoder`, `event for Lifecycle writer`, `mapping for Index writer` and `event for Receipt and increment` |

Hooks after the first one on a path (for example multipart's `metadata`, or the lifecycle's
`publication`) are reached only once the hooks before them are written. That happens in `app/`.

## Template gaps found while completing `app/`

Recorded as found, not worked around: no generated scaffold in `app/` was edited.

| Unit | Gap | Effect in v3 |
| --- | --- | --- |
| V3-13 | **Multipart's HTTP answers can't be shaped from its hooks.** `src/processes/upload-api.ts` mounts `createMultipartHttpHandlers({ multipart, principal })` without its `response` and `error` options, and the compiled mounts carry no `statusCode`. | Start answers 200 with `assetId` (v2: 201 with `videoId`); complete answers 200 (v2 and contract S02: 202; its body does carry `videoId` and `jobId`). Status and list give the upload's own state (`uploading`, `completed`, `aborted`, `expired`), not the video's (`pending`, `processing`, `ready`, `failed`) or its failure, which v2's status merged in. Errors keep their codes, with one message, "Upload operation refused.". S04's "uploading → pending → processing → ready" therefore has no upload route to read from: V3-14/V3-16 must say where it comes from. |
| V3-13 | **A completion stopped by a failing hook blocks the next start.** The upload stays `completing`; multipart's sweep at start re-runs the completion, and any error that isn't the template's own fails the process: "Application startup failed", without the reason. Until then its status route re-runs it too. | Seen once mid-unit with an unwritten hook (the scratch upload was closed by moving its expiry); with every upload hook written nothing on the upload path reaches it now, but any other throw in a completion hook (a bug, a refused SQL statement) would. |
| V3-13 | **The outbox relay retries a codec failure silently.** An unwritten (or throwing) `job` codec is treated as a failed publish: the row is retried every ≤5 s for ever, with no log line and no `.failed`. | Seen mid-unit: 13 attempts, then sent once `job` was written. |
| V3-13 | **The lifecycle's and Transcoder's hooks get no key prefix.** Only multipart's hooks get `prefix`. | `video-contract.ts` repeats the compiled prefix as `ORIGINALS_PREFIX`; multipart's hooks refuse to start if they differ. |
