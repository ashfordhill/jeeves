# YouTube v3 contract (V3-04)

**Status:** written 2026-11-10 for the coordinator. One open question goes **beyond** D1–D8 and
the owner's feedback, and pauses the coordinator: the link cap (question 1). The others have
defaults within the decisions. **Plan:** [YouTube v3](units.md) · **Code read at:** `a0c470f`.

## Owner summary

- **One thing to decide:** optional sign-in needs a 5th link on Watch API, and a tile may have 4. Default: allow 5.
- **Product tables (D1):** each module that writes a database gets its own SQL file, created empty and
  re-run at every start. Its tables stay private; readers see only the views it puts in `published`.
- **Sign-in (D4):** Auth guard becomes a template, **Required** (401 without a valid token) or
  **Optional** (anyone may call; a signed-in account reaches the tile's stubs and hooks).
- **Favorites (D4):** a generic template beside a Required guard: add, check, remove and list items. Hook: `eligible`.
- **Settings (D5):** with Runnable processes on, every Service shows Request timeout and Concurrency limit; every Worker, Concurrency.
- **v3:** v2 plus an Optional Viewer check on Watch API, an Account API and a Favorites database: 21 tiles, 26 modules.
- **Outputs (D8):** `generated/` is the exact export; `app/` is its copy plus completion. LOC counts backend `src/` only.
- **Acceptance:** S01–S08 as in v1/v2, plus S09 signed-in and anonymous watching and S10 Favorites.
- **Plan changes:** V3-06 also joins uploads to the lifecycle; V3-08 also runs search and serves the CDN.

## Today, in brief

| Fact | Where |
| --- | --- |
| A tile may have at most 4 outgoing links. Connecting a guard on v2's Watch API to Identity is refused: "Watch API already has 4 links; the most is 4." (in-memory probe of `v2ModuleDesign()`). | `jeeves/packages/spec/src/studio-links.ts:27`, `studio-lanes.ts:173` |
| An Auth guard is only a part of `owned-multipart`; the multipart binding names it. It has one setting, Credential (JWT). | `studio-components.ts:704-714`, `module-generation.ts:233-251`, `generation.ts:23-32` |
| Multipart builds its own verifier, and its `principal` hook throws "Not implemented". Its hooks get no asset lifecycle, so `reserve`, `complete` and `closed` can't reach the lifecycle's tables. | `jeeves-generator/src/v2/http-wiring.ts:326-340, 419-464` |
| The cache read's source login has CONNECT and USAGE only. In the v2 module design, `r_metadata_db__watch` has no grant, while the stub's login on View counts gets SELECT on `counter_sum_public.totals` (probe). | `http-wiring.ts:223`, `local.ts:593-626` |
| Template SQL runs once per file and is pinned by its sha256. Views are re-created on every run, and then grants are applied. Migrations run at every first-run and start. | `templates/local-v2/assets/scripts/migrate.mjs:55-106`, `local.mjs:213-214` |
| One Keycloak per design. The realm and one public PKCE client, `<identity>-web`, are written once at setup, with roles only from template contributions (none today). | `local.ts:338-348, 698-728`, `setup.mjs:45-86` |
| A process with no template value runs HTTP limits fixed at 1000 ms and 1000, and stub loops at concurrency 1. No control changes them. | `generation-support.ts:73-74`, `generation-resolver.ts:1105-1119`, `loop-wiring.ts:31` |
| Search query and search projection are placeholders: no mapping and no index. CDN tiles generate nothing, and the edge routes only `/api/<tile>/`. | `http-wiring.ts:497-547`, `loop-wiring.ts:559-590`, `local.ts:1056-1074` |
| `youtube-core` pins its 10 templates, but hashes **every** policy record. | `generation-catalog.ts:122-139` |

## 1. Product tables (D1)

**Rule.** The writer owns its tables, and readers see only what it publishes. This applies only
when Runnable processes is on. With it off, nothing below is emitted, and exports keep their
bytes.

| Item | Contract |
| --- | --- |
| Who gets a file | Every module whose resolved access to a database is `write` or `read & write`, other than through an Event publisher's `outbox` slot (that table is its template's). That covers a writing Data access, a Lifecycle writer, Favorites, and any stub with a write link. A stub's access is its link's, worked out as TP07 does (`stubLinkUse`), so a store another owner writes is read only and gives no file. In v3 that is 4 modules (§5). |
| Path | `infra/postgres/<database id>/modules/<module id>.sql`, one per module and database. Its ownership is `generated-extension` (`registry.ts:27-34`): it is yours, like a hooks file. |
| Content at export | A header only: the module, tile and database; its schema; the template tables it may read, by qualified name; who reads `published`; and "Keep it re-runnable (`IF NOT EXISTS`, `CREATE OR REPLACE`)". |
| Schemas | Each writer module has its own private schema, `m_<module sql>`. Unqualified names in its file land there. Each database has one shared `published` schema for views. Template schemas stay `<selection sql>` and `<selection sql>_public` (TP contract §3). |
| Apply order | Per database, in the owner's one transaction (`migrate.mjs:49-107`): `000-foundation.sql`; then template migrations (once each, sha-pinned); then template views; then `CREATE SCHEMA IF NOT EXISTS` for `published` and each `m_<module>` (`REVOKE ALL … FROM PUBLIC`); then **each product file, in module-ID order, on every first-run and start**, with `SET LOCAL search_path TO m_<module>`; then grants. A failing file rolls the database back, and setup fails naming the file. |
| Who runs it | The database's setup-only owner `o_<db>` (`migrate.mjs:47`). No app login can create objects. |
| Writer's grants | Its host's login gets USAGE on `m_<module>`, and SELECT, INSERT, UPDATE and DELETE on its tables and sequences, plus default privileges. They are re-granted every run, after the existing `REVOKE ALL` (`migrate.mjs:87-105`). |
| Readers' grants | **Every** login on the database, a template's or a stub's, gets USAGE on `published` and SELECT on all its views, with default privileges so a new view is covered. A read-only login (`published-read`) gets nothing else except SELECT on template-contributed views, as stub logins already do (`local.ts:593-626`). This gives the cache read's source login its read (TP08 finding 4). |
| Template tables versus product tables | Template-owned: uploads, assets, receipts and outbox (multipart and lifecycle, in the upload selection's schema); counter receipts and totals, with its `_public.totals` view; favorites (§3). Their migrations and grants are unchanged. Product files never create template tables; a template never touches `m_*` or `published`. |
| Re-export | Export writes only to a new directory, and `planFileWrites` keeps identical files and refuses a changed one (`files.ts:54-78`). Carry your SQL file over, as you do hooks. A rename re-keys the path (TP03). In v3, `generated/` keeps the empty files and `app/` holds the written ones. |
| Runner change | `migrate.mjs` is an asset that every v2 export copies byte for byte. With processes on, the foundation substitutes its product step once, refusing otherwise, as TP04 did for `local.mjs`. With processes off, the asset bytes are unchanged. The step reads `databases[].modules` in `infra/local.json`. The composition hash covers that list, not the files' content (`local.mjs:76-77`), so an edited file starts. |
| Report | Each writer's row in `report.modules` gains `sql: {database, file, schema}`. Each process row's database store says `published` when it reads published views. |

## 2. The Auth guard template (D4)

| Item | Contract |
| --- | --- |
| Template | `verified-identity@0.1.0`, binding `{kind: "verified-identity", identity: {element, guard}}` (the existing `generationIdentitySchema`, `generation.ts:23`). Lead: **Auth guard**, whose kind's `generation` becomes `lead`. It is no longer a part of multipart. Its hosts are Service and Uploads; in another tile it stays a stub. Menu group: Template. Name on its page: "Sign-in". |
| Slot | `identity`: an Identity tile, verify, needed (unchanged). An External API target stays a stub. |
| Setting | **Sign-in: Required \| Optional**, saved as the module's `settings.signIn`, an optional field. If it is absent it reads as Required, so v1, v2 and the studies keep their meaning. Derivation writes Required as the initial value once the guard is a template. It is a normal control on the module page while the guard is a template, and chat sets it with `editComponent`, as the mouse does. Credential stays fixed at JWT and hidden. |
| One per tile | Two complete guards in one tile are refused by the existing rule: "Watch API can hold one sign-in template; …" (`module-generation.ts:166-175`). |
| Verification | The tile process builds one verifier with `createPrincipalVerifier` (as `http-wiring.ts:333-340`, and v2 `services/youtube.ts:109-115`): `OIDC_ISSUER`, audience `<identity id>-web`, `OIDC_JWKS_URL`, RS256, a 3 s JWKS timeout, `exp` and `sub` required. |
| Required | Every `/modules/*` route in the tile (templates and stubs) needs `Authorization: Bearer <token>`. A missing or invalid token gives **401** `{"error":"SIGN_IN_REQUIRED","message":"Sign in to continue."}`. `/healthz` stays open. |
| Optional | No `Authorization` header: the caller is anonymous. A header that fails verification still gives 401 (question 2). |
| The value | A new scaffold, `src/runtime/tile-guard.ts`: `type Caller = { signedIn: true; principal: VerifiedPrincipal } \| { signedIn: false }`, with `guard.caller(request)` and `guard.require(request)` (the latter gives 401 when anonymous). Route stubs get `ModuleRequest.caller` (`entry.ts.template:5-13` gains it; it is `{signedIn: false}` in a tile with no guard). Template hooks that take a request get the guard (below). Loops get no caller; events carry the account in their payload. Cache reader hooks take no request, so they get no caller. |
| `me` | `GET /modules/<guard>/me` gives `{signedIn: true, subject, username}` (`preferred_username`, or null) or `{signedIn: false}`. Required without a token gives 401. This is for S01's identity display and the V3-06 test (question 3). |
| Multipart's `principal` | Multipart and Favorites need their tile's guard set to **Required**. Otherwise they stay a Stub: "Needs an Auth guard set to Required in <tile>." Multipart's hooks factory gets `guard` in place of `verify`. The generated `principal` body is `return resources.guard.require(request);`, so it is satisfied and leaves the unwritten list. The product may wrap it: v3 adds v2's `creator` role check, 403 `CREATOR_REQUIRED` (`youtube-upload.ts:24-56`). |
| Provisioning | Every guard selection binds its Identity, so the Identity runs as Keycloak (`local.ts:142, 698-728`). There is one realm, `<identity id>`, and one public PKCE client `<identity id>-web`, with the edge origin `/` as redirect (`setup.mjs:45-86`). Every guarded process gets `OIDC_*` and depends on Keycloak healthy (`local.ts:813-861`). The guard declares no roles. A field project's own account script adds roles and users through the admin API, which is not an app feature (as v2: `v2/app/README.md:26-34`). |
| Errors | 401 as above. A JWKS fetch failure is a failed verification: 401, as in v2. |
| Marketplace | Buyers and sellers are accounts in one realm. A Storefront API with an Optional guard (browse anonymously, personalise when signed in). A Seller API with a Required guard whose hooks check a `seller` role. An Account API with Favorites on listings (§3). |

**Also in V3-06, multipart and the lifecycle** (question 10). When an asset lifecycle names this
upload, multipart's hooks factory also gets `lifecycle`: that lifecycle's upload hooks, built in
the upload tile's process from the lifecycle's own hooks file and binding. The generated
`reserve`, `complete` and `closed` bodies delegate to it, as v2 composed them
(`v2/app/src/adapters/youtube-upload.ts:94-103`). Their "Not implemented" then comes from the
lifecycle hooks they reach (`metadata`, `job`, `response`).

## 3. The Favorites template (D4)

| Item | Contract |
| --- | --- |
| Kind | New module kind `favorites`: "Favorites", "Keeps each signed-in account's favorite items.", Tabler `star`, scope generic, hosts Service. It is the lead of `favorites@0.1.0`, menu group Template, page name "Favorites". The catalog has 19 kinds. |
| Slots | `state`: a Database, read & write, needed (its own table). `items` (new slot ID): a Data access in this tile, in-process, optional, like the Cache reader's loader (`module-generation.ts:303-315`). That Data access is a part, and its database is the one `eligible` reads. It is drawn and authored as the loader is, by a drag from row to row in Detailed + Connect (question 7). |
| Needed part | An Auth guard in the same tile, connected to an Identity, with Sign-in **Required**. Without it the module stays a Stub, with "Needs an Auth guard set to Required in <tile>." |
| Endpoints | Under `/modules/<lead>/`, behind the tile's Required guard. The account is `principal.subject`. `PUT /items/:itemId` adds it, idempotently: **200** `{itemId, addedAt}`, the same `addedAt` when already there. `DELETE /items/:itemId` gives **204**, even when it wasn't there. `GET /items/:itemId` gives **200** `{itemId, addedAt}` or **404** `NOT_FAVORITE` (for a toggle). `GET /items?after=<cursor>` gives **200** `{items: [{itemId, addedAt}], next}`, newest first, 50 to a page. |
| Errors | **401** `SIGN_IN_REQUIRED` (the guard). **400** `ITEM_ID`: an ID is 1–200 characters of `[A-Za-z0-9._:-]`. **400** `CURSOR`. On add only: **404** `NOT_ELIGIBLE` "This item can't be added to favorites." when `eligible` is false; **409** `FAVORITES_FULL` at 1,000 per account; **501** "Not implemented: eligible for <lead name>" until written. List, check and remove never call `eligible`. |
| Table | Template-owned, in schema `<selection sql>`: `favorites(account text 1–255, item text 1–200, added_at timestamptz default clock_timestamp(), PRIMARY KEY(account, item))`, plus an index on `(account, added_at DESC, item)`. It is created by `100-<selection>.sql`. The host's login gets SELECT, INSERT and DELETE. It publishes no view. |
| Bounds | Item ID size, 1,000 per account and 50 to a page are fixed in a `favorites-policy` record. Add it only after `youtube-core`'s policy list is pinned to its six refs (sha unchanged; V3-06). |
| The hook | `src/modules/<host>/<lead>.hooks.ts`: `<lead>Hooks(resources: { items?: pg.Pool })` returns `{ async eligible(itemId: string): Promise<boolean> }`. The `items` pool is the Data access's login, which can see that database's `published` views (§1). |
| v3's answer | `eligible` is true when `itemId` is a UUID and `SELECT 1 FROM published.videos WHERE video_id = $1` finds a row. So a pending, failed or unknown video is refused with 404. |
| Marketplace | Account API: Required guard, Favorites, and a Data access on Listings, whose writer publishes `published.listings`. `eligible` is `SELECT 1 FROM published.listings WHERE listing_id = $1 AND state = 'active'`. There is no YouTube code in the template. |

## 4. Settings on process tiles (D5)

While Runnable processes is on, every tile that runs as a process (`generation-support.ts:64-71`)
shows the limits its process uses. With it off, nothing changes: they appear once a template
derives them.

| Tile kind | Fields | Consumed by |
| --- | --- | --- |
| Service, Uploads (and legacy Redirect, Billing) | Request timeout (ms), Concurrency limit | The process's admission for every route: templates and stubs |
| Worker (and legacy Notifications) | Concurrency | Every loop on the tile: templates as today, and stub loops (today fixed at 1). Fixed at 1, and hidden, on a Video HLS worker. |

- **Values:** with no saved value, a field shows what the process runs (1000 ms, 1000, or 1 for a
  Worker's stub loops), and typing saves it on the tile. Turning the option on writes nothing.
  A tile's saved value wins over the fixed one (origin `tile`), and the report shows its origin.
- **v3:** every process tile in v3 has a template, so D5 adds no control there. It matters for
  stub-only tiles (the stub stack, early v3 by mouse).

## 5. The v3 design

v2's MA09 rebuild, with V3-02's names and D4's additions. Names carry no kind word: Identity is
**Sign-in**, and "Video lifecycle worker" is **Video lifecycle** (question 11). IDs follow names
(TP03): `watch-api`, `sign-in`, module `watch-api-viewer-check`, and so on.

### Tiles and links, in build order

The format is V2_TILES's (`jeeves/apps/web/e2e/v2-rebuild.ts:22-50`): a pick from a fan, or a
Connect drag. **New** marks what v2 lacks.

| # | Step | Tile (label) |
| ---: | --- | --- |
| 1 | Watch → Microservice | **Watch API** (Service) |
| 2 | Watch API → Cache | **Hot metadata** (Cache) |
| 3 | Watch API → Database | **Metadata** (Database) |
| 4 | Watch API → Database | **View counts** (Database) |
| 5 | Watch API → Message channel | **View events** (Topic) |
| 6 | View events → Worker service | **View counter** (Worker) |
| 7 | Connect View counter → View counts | |
| 8 | Watch → Microservice | **Search API** (Service) |
| 9 | Search API → Search index | **Videos** (Search index) |
| 10 | Watch → CDN | **Video delivery** (CDN) |
| 11 | Watch → Microservice | **Account API** (Service), new |
| 12 | Account API → Database | **Favorites** (Database), new |
| 13 | Connect Account API → Metadata | new |
| 14 | Publish → Identity | **Sign-in** (Identity) |
| 15 | Connect Watch API → Sign-in | new; Watch API's 5th link (question 1) |
| 16 | Connect Account API → Sign-in | new |
| 17 | Publish → Uploads | **Upload API** (Uploads) |
| 18 | Connect Upload API → Metadata | |
| 19 | Upload API → Object storage | **Original videos** (Object storage) |
| 20 | Upload API → Message channel | **Upload jobs** (Queue) |
| 21 | Upload jobs → Worker service | **Transcoder** (Worker) |
| 22 | Connect Transcoder → Original videos | |
| 23 | Transcoder → Object storage | **Transcoded videos** (Object storage) |
| 24 | Connect Video delivery → Transcoded videos | |
| 25 | Transcoder → Message channel | **Processing events** (Topic) |
| 26 | Processing events → Worker service | **Video lifecycle** (Worker) |
| 27 | Connect Video lifecycle → Metadata | |
| 28 | Video lifecycle → Message channel | **Publication events** (Topic) |
| 29 | Publication events → Worker service | **Search indexer** (Worker) |
| 30 | Connect Search indexer → Videos | |
| 31 | Connect Upload API → Sign-in | |

That gives 21 tiles and **33 lines in Simple**: 2 user links, 6 entries (Watch has 4, the most an
action may have; Publish has 2) and 25 tile links.

- **Dashed (async, nobody waits): 8.** Watch API → View events → View counter; Upload API →
  Upload jobs → Transcoder; Transcoder → Processing events → Video lifecycle; Video lifecycle →
  Publication events → Search indexer. All go through a queue or topic. **No line is a direct
  async call.**
- **Solid (direct, the caller waits): 25.** These are every entry and user link, and every link
  to a database, cache, object storage, search index, CDN or Sign-in.
- Outgoing links: Watch API 5 (Hot metadata, Metadata, View counts, View events, Sign-in);
  Upload API 4; Account API 3; Transcoder 3; others 1–2.

### Modules

The format is V2_MODULES's (`v2-rebuild.ts:59-110`). v2's text is unchanged except where noted.

| Tile | Module (kind) | Description | Generates |
| --- | --- | --- | --- |
| Watch API | Viewer check (Auth guard), new, **Optional** | Lets watchers sign in; others watch anonymously. | Sign-in, lead |
| | Video details cache (Cache reader) | Serves video details from the cache. | Cache read, lead |
| | Video details reader (Data access) | Reads public video details. | Cache read, part (loader) |
| | View count reader (Data access) | Reads a video's view count. | Stub (route) |
| | View publisher (**Custom**, was Event publisher) | Reports each play of a ready video as an event, with the viewer when signed in. | Stub (route) |
| View counter | View consumer (Event consumer) | Receives view events. | Event counter, part |
| | Receipt and increment (Event counter) | Counts each view event once. | Event counter, lead |
| | Count writer (Data access) | Stores view totals. | Event counter, part |
| Search API | Video search (Search query) | Searches published videos. | Search query, lead |
| Account API | Account check (Auth guard), new, Required | Allows only signed-in accounts. | Sign-in, lead |
| | Favorite videos (Favorites), new | Keeps each account's favorite videos. | Favorites, lead |
| | Video reader (Data access), new | Reads which videos are public. | Favorites, part (`items`) |
| Upload API | Creator check (Auth guard), Required | Allows only signed-in creators. | Sign-in, lead (was multipart's part) |
| | Multipart uploads (Multipart uploads) | Uploads large videos in resumable parts. | Multipart upload, lead |
| | Job outbox publisher (Event publisher) | Queues a processing job once an upload completes. | Multipart upload, part |
| | Upload state writer (Data access) | Records each upload's progress. | Multipart upload, part |
| Transcoder | Job consumer, Segmenter and encoder (Video encoder), Packager, Thumbnailer, Processing result publisher | as v2 | Video encoding; the encoder leads |
| Video lifecycle | Processing consumer, Lifecycle writer (Lifecycle writer), Video publication publisher | as v2 | Upload lifecycle; the writer leads |
| Search indexer | Video publication consumer, Index writer (Index writer) | as v2 | Search indexing; the writer leads |

That gives **26 modules: 24 Template and 2 Stub.** There are 13 selections: 11 templates (Sign-in
×3, Cache read, Favorites, Multipart upload, Video encoding, Upload lifecycle, Event counter,
Search indexing, Search query) and 2 stubs. View publisher becomes a Custom module, because it
must read Metadata to accept views of ready videos only (the v1 policy, question 8).

### Module connections

The format is V2_CONNECTIONS's (`v2-rebuild.ts:116-141`). "⇢" is an in-process drag onto a
module row. There are **30**: v2's 24 (View publisher's channel link kept, now as `uses`) plus 6 new.

| Tile | Connections |
| --- | --- |
| Watch API | Viewer check → Sign-in (new) · Video details cache → Hot metadata · Video details reader → Metadata · Video details cache ⇢ Video details reader (loader) · View count reader → View counts · View publisher → View events (`uses`) · View publisher → Metadata (`uses`, new) |
| View counter | View consumer ← View events · Count writer → View counts |
| Search API | Video search → Videos |
| Account API | Account check → Sign-in (new) · Favorite videos → Favorites (`state`, new) · Favorite videos ⇢ Video reader (`items`, new) · Video reader → Metadata (new) |
| Upload API | Creator check → Sign-in · Multipart uploads → Original videos · Job outbox publisher → Upload jobs · Job outbox publisher → Metadata (outbox) · Upload state writer → Metadata |
| Transcoder | Job consumer ← Upload jobs · Segmenter and encoder → Original videos · Packager → Transcoded videos · Thumbnailer → Transcoded videos · Processing result publisher → Processing events |
| Video lifecycle | Processing consumer ← Processing events · Lifecycle writer → Metadata · Video publication publisher → Publication events · Video publication publisher → Metadata (outbox) |
| Search indexer | Video publication consumer ← Publication events · Index writer → Videos |

### Useful values

The format is V2_VALUES's (`v2-rebuild.ts:144-152`): v2's seven, plus one.

| Tile | Module | Field | Value |
| --- | --- | --- | --- |
| Upload API | | Request timeout | 5000 |
| Upload API | | Concurrency limit | 500 |
| Watch API | | Concurrency limit | 2000 |
| Watch API | Video details reader | Pool size | 50 |
| Watch API | Video details reader | Statement timeout | 500 |
| Hot metadata | | TTL | 3601 |
| View counter | | Concurrency | 8 |
| Watch API | Viewer check | Sign-in | Optional (new) |

Everything else keeps its initial value: Creator check and Account check Required, Account API
1000 ms and 1000, Video reader 10 and 2000, and Search API 1000 ms and 1000.

### What it reads and writes

| Database | Writer modules and their SQL file (§1) | Published | Read by |
| --- | --- | --- | --- |
| Metadata | Upload state writer (`metadata/modules/upload-api-upload-state-writer.sql`, empty in v3); **Lifecycle writer** (`metadata/modules/video-lifecycle-lifecycle-writer.sql`) | `published.videos`, a view in the Lifecycle writer's file | Video details reader (cache read `load`), View publisher (ready check), Video reader (`eligible`) |
| View counts | Count writer (`view-counts/modules/view-counter-count-writer.sql`, empty) | the counter's own `view_counter_receipt_and_increment_public.totals` | View count reader |
| Favorites | Favorite videos (`favorites/modules/account-api-favorite-videos.sql`, empty) | none | its own host only |

- **Which module writes `videos`:** the Lifecycle writer. Only the lifecycle makes a video
  ready. v3 has no product `videos` table: `published.videos` selects the ready rows of the
  lifecycle's template table `upload_api_multipart_uploads.assets`. It has `video_id`, `title`,
  `description`, `channel`, `duration_seconds`, `manifest`, `thumbnail`, `published_at` and
  `publication_version`, as v2's `asset_public.ready` (`v2/app/src/adapters/youtube-public-sql.ts:5-12`).
- **Search reads no SQL.** Search API queries the Videos index. The indexer fills it from
  Publication events, whose payload the lifecycle's `publication` hook builds inside its own
  transaction.

### Processes and routes

There are 8 processes plus `app-edge`, and 6 providers: Postgres, broker, Garage,
`cache-hot-metadata`, `search-videos` and Keycloak `identity-sign-in`. Through the edge:

| Path | Answers |
| --- | --- |
| `/api/watch-api/modules/watch-api-viewer-check/me` | the caller, or anonymous |
| `/api/watch-api/modules/watch-api-video-details-cache/<videoId>` | the `published.videos` record, or 404 |
| `/api/watch-api/modules/watch-api-view-count-reader/<videoId>` | `{views}` (stub body) |
| `POST /api/watch-api/modules/watch-api-view-publisher/<videoId>` `{eventId}` | 202, or 404 `VIDEO_NOT_READY` (stub body) |
| `/api/search-api/modules/search-api-video-search?q=&page=` | a page of hits |
| `/api/account-api/modules/account-api-favorite-videos/items[/<videoId>]` | §3 |
| `/api/upload-api/modules/upload-api-multipart-uploads/uploads…` and `…/upload-api-creator-check/me` | the six multipart routes, and the creator |
| `/cdn/video-delivery/<key>` | Transcoded videos' public objects (V3-08, question 10) |

A view event is v2's `ViewPlayed` (`youtube-contract.ts:45-50`) plus `viewer: <subject> | null`.

### Search data

Both search templates become mounted, with hooks files holding product data (V3-08, question
10). Both processes call `assertSearchIndex` at start, which creates the index when it is missing
(`search-schema.ts.template:7-31`), as v2's indexer and query did. Until the hooks are written,
they answer "Not implemented" naming the hook, and stay healthy.

| Hook | v3 value (from v2) |
| --- | --- |
| Index writer: `mapping` | Version 1. Fields: videoId, state and visibility keyword; publicationVersion integer; title, description and channel text; durationSeconds double; manifest and thumbnail keyword with `index: false`; publishedAt date (`v2/app/src/features/public-video.ts:32-47`). |
| Index writer: `document` | ID `videoId`, version `publicationVersion`, codec as `publicVideoDocumentSchema` (`public-video.ts:26-29, 48-53`). |
| Index writer: `event` | Parse `VideoPublished` (`youtube-contract.ts:56-69`, with `wireEvent`) and drop its envelope (`youtube-projection.ts:18-27`). |
| Video search: `preset` | Filter `state = ready` and `visibility = public`; `multi_match` on title^3, description and channel^2, `best_fields`; sort by score desc, publishedAt desc, videoId asc (`public-video-search.ts:11-27`). The runtime fixes q at 1–200 characters, pages 1–100, 20 to a page, and 750 ms (`search-query.ts.template:31, 58-60`). |
| Video search: `hit` | videoId, title, description, channel, durationSeconds, publishedAt, and `thumbnailUrl` `/cdn/video-delivery/<thumbnail>` (`youtube-search.ts:23-31`, path changed). The mapping and document are imported from the Index writer's hooks file, so the two can't drift. |

## 6. Field-project layout (D8)

```
field-projects/youtube/v3/
  inputs/     design.json and blueprint.json (V3-11)
  diagrams/   Detailed and Simple PNGs (V3-11)
  notes/      README.md (both outputs, how to run each), custom-paths.md, scenarios.md, benchmarks/, review-pack.md
  generated/  the exact export, processes on (V3-12); never edited
  app/        generated/ copied in the same commit, then completed (V3-13 to V3-16)
```

- **`generated/`:** made by `export:v2` from `inputs/design.json` (whose `generation.processes`
  is on). A by-mouse ZIP gives the same bytes (TP08). Nothing is added to it: its `README.md` is
  the export's own, so the field project's explanation goes in `notes/README.md`. Later units
  check that `git diff <V3-12 commit> -- generated/` is empty.
- **`app/`:** byte for byte `generated/` at the V3-12 commit. `notes/custom-paths.md` has one row
  per path that is added or changed in `app/`, with its area, the unit and why. The areas are
  hook, stub body, product SQL, UI or integration. V3-17 checks the table against
  `diff -rq generated app`, leaving out `node_modules`, `dist`, `dist-public` and `.runtime`.
- **Benchmark:** `pnpm benchmark:source field-projects/youtube/v3/app <V3-12 commit> <final
  commit> field-projects/youtube/v3/notes/benchmarks/backend-scope.json`. The baseline is `app/`
  at V3-12, which equals `generated/`, so this compares `app/` with `generated/` with no tool
  change (`docs/field-projects/source-loc.md`).
- **Scope:** `backendPaths` `src/runtime`, `src/features`, `src/modules` and `src/processes`.
  `uiPaths` `browser`. `configurationPaths` holds the pure-data binding files the export has
  (v2's four: `application-bindings.ts`, `local-bindings.ts`, `positive-cache-bindings.ts`,
  `search-bindings.ts`), reviewed against the real export in V3-12. Hooks and stub bodies under
  `src/modules` count. SQL, product SQL included, plus scripts, nginx, Compose and docs are
  outside the metric: they are listed in `custom-paths.md`, not counted.
- **Reused v2 browser:** v2's `browser/*.ts` (5 files), `public/`, `scripts/build-browser.mjs` and
  `browser-config.mjs` are copied into `app/` as UI and integration. They are moved to §5's
  routes. They gain optional sign-in on the watch page and, when signed in, a favorite toggle
  and a Favorites list. The edge serves them: `app/` adds a `location /` for the built files, as
  v2's edge had, which is integration.
- **Biome:** add `field-projects/youtube/v3/{inputs,diagrams}/**/*.json`, `v3/generated` and `v3/app`
  to the exclusions in `tooling/biome.config.json` (as v1 and v2 are).

## 7. Acceptance

The run is from a copy of `app/` outside the checkout, on its own project and three ports. An
account script in `app/` (integration) creates the `creator` role and the users `creator` and
`other-creator` (with the role) and `viewer` (without it). Their passwords go in
`.runtime/secrets/<user>_password`. Each row is observed **by mouse in the browser** and **by
API**, with the evidence kept. Partial results are reported as partial.

| ID | By mouse | By API, and evidence |
| --- | --- | --- |
| S01 Setup and sign-in | Open the edge origin. Sign in as `creator` through Keycloak; the header shows "creator" and a Sign out control. Sign out, and the next Sign in asks for the password again. | `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build` and `pnpm first-run` exit 0. `docker compose ps` shows 9 `app-*` and 6 providers healthy, with `RestartCount` 0. `…/upload-api-creator-check/me` gives `{signedIn:true, username:"creator"}`. |
| S02 Multipart upload | As creator, choose the fixture, a title and a description, and click Upload video; it reaches "pending". | Anonymous `POST …/uploads` gives 401 `SIGN_IN_REQUIRED`; `viewer` gets 403 `CREATOR_REQUIRED`. At least 3 part PUTs (5 MiB, 5 MiB, the rest) with ETags; ListParts. The original's SHA-256 equals the fixture's. Complete gives 202 with videoId and jobId. `other-creator`: status 404, list empty. |
| S03 Resume and abort | Pause after part 1, refresh, sign in, reselect the file and resume: only the missing parts are sent. Abort a second upload. | The same upload ID throughout; ListParts before the resume. Complete after abort gives 410. |
| S04 Processing and publication | Status goes uploading → pending → processing → ready. An invalid-media upload ends "failed" with its message. | ffprobe: H.264/AAC HLS at 360p and 720p, about 4 s segments, one thumbnail. `published.videos` has the video only once it is ready, and never the failed one (psql as the owner, in the scratch run). |
| S05 Playback | Signed out, open the ready video from search. Its details, thumbnail and count show. Play 5 s or more with the tone, and seek. | Playlist and segment GETs under `/cdn/video-delivery/` at the edge. Segment bytes differ from the original. A pending or failed ID gives 404 from the details route. |
| S06 Search | Search the title, a description keyword and the channel: the ready video appears within 60 s of ready, and opens. | `…/search-api-video-search?q=` finds only ready videos. The pending and invalid uploads' unique titles give 0 hits. |
| S07 Counts | Details and search fetches add nothing. 2 cumulative seconds of play add 1 within 10 s; pausing and seeking add none; a new page session adds 1. | The same event ID sent twice gives one receipt. `…_public.totals` shows the count, and keeps it after a restart. |
| S08 Failures and independence | An invalid token, a file over 256 MiB, a non-MP4 file and invalid media each show a finite error. | 401, 413, 422, and failed with no publication. An anonymous GET of an original gives 403. `pnpm stop` then `pnpm start` keeps media, counts, favorites, credentials and volumes, with 0 restarts. |
| S09 Signed-in and anonymous watching | Watch signed out: no sign-in is asked. Then sign in as `viewer` on the watch page and watch again. Both plays count. | `…/watch-api-viewer-check/me` gives `{signedIn:false}` without a token, `{signedIn:true, username:"viewer"}` with one, and 401 for an invalid one. A scratch queue bound to View events receives both plays: `viewer: null` and the viewer's subject. Each adds 1. |
| S10 Favorites | Signed in as `viewer`, on a ready video, click ☆: it shows ★, and the Favorites list shows the video. Remove it from the list. Signed out, there is no toggle, only Sign in. | With viewer's token: `PUT …/items/<ready id>` gives 200, and again 200 with the same `addedAt`; `GET …/items/<id>` 200; `GET …/items` lists it; `DELETE` 204, then `GET …/items/<id>` 404. Without a token every call gives 401. A pending or failed video's ID gives 404 `NOT_ELIGIBLE`, and a bad ID 400. The list survives stop and start. |

## Open questions

Each has a recommended default. **Only question 1 goes beyond D1–D8 and the owner's feedback.**
The rest apply them, and don't pause the coordinator.

1. **Answered 2026-11-11: the owner approved raising the cap to 5** ("that was a rule made early on").
   **BEYOND D1–D8: the link cap.** Optional sign-in on Watch API (D4, feedback 8, and this
   unit's brief) needs Watch API → Sign-in. Watch API already has v2's 4 links, the most a tile
   may have (`studio-links.ts:27`; the probe is refused). *Default:* raise
   `laneLimits.outgoingLinks` to 5 in V3-06, with docs and a mouse check of the 5-link Watch API
   at 1440×900 and 1280×800. The layout and board are generic over the cap (`studio-lanes.ts:173`,
   `board/src/graph/types.ts:25`). DP08 raised the entry cap the same way. *If not:* the View
   count reader moves to Search API, which then reads Videos and View counts, and the watch page
   takes counts from there.
2. **Optional and an invalid token.** *Default:* 401, not anonymous, so an expired session is
   noticed and never counted as anonymous. (D4)
3. **The guard's `me` route.** *Default:* `GET /modules/<guard>/me`. It is generic, it gives
   S01's identity display, and the V3-06 test reads it. (D4)
4. **The guard as its own template.** *Default:* the Auth guard leads `verified-identity`, and
   Multipart uploads and Favorites need it Required in their tile. The v2 module design's export
   with processes off gains one selection (Creator check). V3-06 records this and updates the off
   pin, the v2-rebuild spec, `v2IntendedDifferences` and the equivalence test. Frozen v2 and v1
   are unchanged. (D4; the off rule allows a recorded change.)
5. **The creator role.** *Default:* product policy. v3 wraps the multipart `principal` hook with
   v2's role check (403). Roles and accounts come from the field project's account script, as
   v2's did. (v1/v2 scope)
6. **Product SQL runs at every start.** *Default:* re-run in the owner's transaction, so the file
   must be re-runnable. That lets completion edit it between runs. The alternative, once-only
   migrations pinned by sha, would refuse an edited file. (D1: "first run and start apply it")
7. **Favorites' details.** *Default:* `items` is a drag from row to row onto a Data access (the
   loader's proven mouse path; two Database slots would make a drop ambiguous). There is a
   one-item check for the toggle, 200-character IDs, 1,000 favorites per account and 50 to a page.
   (D4)
8. **View publisher becomes Custom.** *Default:* it uses View events and Metadata, so it accepts
   views of ready videos only, as v1's policy requires; an Event publisher can't read a database.
   (v1/v2 scope)
9. **D5 on Workers.** *Default:* the matching field is Concurrency, and stub loops use it instead
   of a fixed 1. A worker has no request timeout. (D5)
10. **Generation gaps v3 needs.** *Defaults:* the search templates are mounted on hooks files
    (§5), and a CDN tile in front of public object storage gets the edge route
    `/cdn/<cdn id>/`, both in V3-08. Multipart's `reserve`, `complete` and `closed` reach the asset
    lifecycle that names its upload (V3-06). Without these, S02, S05 and S06 would need edits to
    generated scaffolds. None is product behaviour. (v1/v2 scope; Phase B)
11. **Names and placement.** *Default:* Identity is named **Sign-in** (it reads well after
    Publish, and as each guard's target), "Video lifecycle worker" becomes **Video lifecycle**, and
    Account API is the Watch action's 4th entry. The alternative keeps "Identity", as the study
    does. (Feedback 3, D4)
12. **Answered 2026-11-11:** the legend shows only the dashed **Async** sample, with **no explanatory text**. Direct async lines stay allowed. v3's 8 dashed lines all go through queues or topics. V3-09 removes the legend's help text.
    **Direct async lines (V3-02's finding).** The link rules still
    allow a dashed line with no queue or topic: application → application, application → External
    API, and External API → application (`studio-links.ts:114-115, 160`). The legend says "Dashed:
    sent through a queue or topic". *Coordinator's default:* keep direct async lines, and reword
    the legend to "Dashed: async, nobody waits (usually through a queue or topic)". V3-09 applies
    it with its line-style review. **v3 has none:** all 8 dashed lines go through Upload jobs, View
    events, Processing events or Publication events. (D7 and feedback 5. It rewords D7's text, so
    V3-09 needs the owner's yes; no unit before V3-09 depends on it.)

## Unit changes

[units.md](units.md) is revised to this contract, with the same unit IDs:

- **V3-05:** the §1 details: path, schemas, apply order, the `migrate.mjs` substitution, grants
  for every login on `published`, and the report.
- **V3-06:** the guard leads `verified-identity`. Also: `tile-guard.ts`, `me`, `caller`, the
  multipart `principal` default, and multipart's hooks reaching the asset lifecycle. Pin
  `youtube-core`'s policies. Raise the link cap (question 1). Record the off pin change.
- **V3-07:** the `items` loader-style slot, the one-item check, the bounds and `favorites-policy`.
- **V3-08:** D5 per §4, mounted search (it replaces row 8) and the CDN edge route.
- **V3-09:** the legend wording and line review (question 12).
- **V3-10:** writes the v3 reference fixture and generalises `v2-diff.ts`.
- **V3-11:** expected counts.
- **V3-12:** nothing added in `generated/`; the baseline commit and `custom-paths.md`.
- **V3-13 to V3-16:** areas per §5 and §7.
- **V3-17:** S01–S10 and the benchmark command.
