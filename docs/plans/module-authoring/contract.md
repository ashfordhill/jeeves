# Module and generation contract (MA01)

**Status:** approved by the owner on 2026-11-09, with every default below accepted. MA05 may start.
**Plan:** [module authoring](units.md) · **Code read at:** `18cda98`.

## Owner summary

- **Recommendation: responsibility modules, each template keyed by one lead module.** A
  template is chosen only by its lead (Multipart uploads, Lifecycle writer, Video encoder, Cache
  reader, Event counter, Index writer, Search query). The generic Data access, Event consumer,
  Event publisher and Auth guard in the same tile fill its other connections. Every other
  module, and a template still missing a part, generates a typed stub.
- **For you:** add a module with the tile's `+` (18 kinds, 8 new, three "Video …"), connect it
  by dragging, and its page says Template or Stub and what is missing. Generation, ownership
  and fixed settings are written for you in the same Undo step. "Add a supported feature" goes.
- **v2 rebuild:** keeps all 22 modules and names: 20 template, 2 stubs (View count reader and
  View publisher; `youtube-watch` is not offered). It needs 2 more module links and one more
  tile link, Upload API → Identity. The tile fan offers 11 kinds.
- **Open questions** [defaults]: what frozen v2 "byte-identical" means [70 of 72 files; two
  provenance files hash the code]; Upload API → Identity [add it]; the cache's loader link [one
  drawn in-process link]; Gateway [not offered]; retire the preset [yes]; a process per tile [later].

## 1. Tiles and modules

| Box | Generates today | Under this contract |
| --- | --- | --- |
| **Application tile** (Service, Worker, Uploads) | No process, entry point or compose service. An `app-<host>` service comes only from a feature's `local.services` contribution (`jeeves-generator/src/v2/local.ts:637-748`). No installed emitter contributes one, so every selected host is in the required `application-services` gap (`local.ts:834-844`). Its settings become template inputs (`src/features/application-bindings.ts`, `composition.ts:110-129`) and select the HTTP and admission libraries (`primitives.ts:25-45`). | Unchanged. The tile is the process boundary: its stubs live under `src/modules/<host>/`, and its settings feed its templates. A runnable process per tile stays a reported gap (question 6). |
| **Infrastructure tile** (Database, Cache, Queue, Object storage, Search index, Identity) | Provisioned only when a selection binds it (`local.ts:114-206`): one provider service each (Postgres, broker, Garage, `cache-<id>`, `search-<id>`, Keycloak for a bound Identity), setup scripts and `infra/local.json` (`local.ts:308-622, 752-833`). CDN and External API generate nothing. | Unchanged: provisioned when a template binds it. A tile linked only to stubs is not provisioned. |
| **Module** | Nothing of its own. A module's settings feed a selection when it traces the bound link (`packages/spec/src/generation-resolver.ts:204-221, 482-486`). Templates emit shared libraries per binding kind under `src/runtime/` and binding files under `src/features/` (`multipart.ts:29-53`, `asset-lifecycle.ts:64-100`, `video-hls.ts:40-75`, `positive-cache.ts:39-96`, `event-counter.ts:73-122`, `search.ts:28-117`), plus the required "application bindings" gaps. | A lead or part of a complete template: that template's libraries and the host's binding entry (unchanged emitters). Any other module: a typed stub (§6). |

Checked on a fresh export of `field-projects/youtube/v2/inputs/design.json`: 72 files, byte
for byte the recorded `generic-export.tar.gz`; no `app-*` compose service; 9 required gaps.

## 2. Module kind catalog

Today: 10 kinds (`studio-components.ts:33-44`); every application kind may hold every kind
(`studio-modules.ts:57-63`); none generates code.

### Kinds

| Kind | Name | Description | Icon | Hosts | Scope |
| --- | --- | --- | --- | --- | --- |
| `rate-limiter` | Rate limiter | Rejects requests above a per-key limit. | `shield` | Service, Worker, Uploads | generic |
| `cache-reader` | Cache reader | Reads from a cache before the database. | `bolt` | Service, Worker, Uploads | generic |
| `id-generator` | ID generator | Allocates unique short identifiers. | `repeat` | Service, Worker, Uploads | generic |
| `redirect-responder` | Redirect responder | Answers with an HTTP redirect and edge cache headers. | `route` | Service, Worker, Uploads | generic |
| `event-publisher` | Event publisher | Publishes events to a queue or topic. | `plug-connected` | Service, Worker, Uploads | generic |
| `event-consumer` | Event consumer | Consumes events from a queue or topic. | `plug` | Service, Worker, Uploads | generic |
| `data-access` | Data access | Reads and writes one database. | `database` | Service, Worker, Uploads | generic |
| `auth-guard` | Auth guard | Verifies caller credentials against an identity provider. | `lock` | Service, Worker, Uploads | generic |
| `external-call` | External call | Calls another service or external API. | `world` | Service, Worker, Uploads | generic |
| `custom` | Custom | Your own logic, generated as a stub. | `puzzle` | Service, Worker, Uploads | generic |
| `multipart-uploads` (new) | Multipart uploads | Uploads large files in resumable parts. | `cloud-upload` | Uploads, Service | generic |
| `lifecycle-writer` (new) | Lifecycle writer | Records each upload's processing state. | `progress-check` | Worker | generic |
| `video-encoder` (new) | Video encoder | Encodes a video into streamable renditions. | `movie` | Worker | video |
| `video-packager` (new) | Video packager | Stores a video's stream segments and playlists. | `stack-2` | Worker | video |
| `video-thumbnailer` (new) | Video thumbnailer | Creates a video's thumbnails. | `photo` | Worker | video |
| `event-counter` (new) | Event counter | Counts each event once. | `sum` | Worker | generic |
| `index-writer` (new) | Index writer | Adds records to a search index. | `list-search` | Worker | generic |
| `search-query` (new) | Search query | Searches one search index. | `search` | Service | generic |

- The four reworded descriptions are the owner's (MA02); the others are unchanged.
- New icons are Tabler names that MA05 adds to `StudioIcon.tsx:32-54`.
- **Hosts:** existing tiles of the legacy coded kinds (Redirect, Notifications, Billing) keep
  their modules and offer the generic kinds. Identity and Gateway take no modules: the local
  runtime runs them as products (Keycloak, `generation-resolver.ts:697-704`). Browser takes none.
- Existing kinds keep their targets, `thirdParty`, `requires` reasons and settings schemas.
  Narrower targets would invalidate saved links (`studio-validation.ts:383`), and the frozen v1
  export compares a fresh blueprint v3 that includes the rest (`jeeves-generator/src/input.ts:170`,
  `studio-blueprint.ts:466-479`).

### Slots and generation

A **slot** is one use of a tile (or, once, of a module) through the host's link. Its arrow
follows that link. "Needed" means needed for the module's template; an unconnected module is
still allowed and is a stub.

| Kind | Slots: target · use · need | Settings shown | Generation |
| --- | --- | --- | --- |
| Rate limiter | store: Cache · read & write · optional | none | Stub |
| Cache reader | cache: Cache · read & write · needed; loader: a Data access in this tile · in-process · needed | none (TTL is the Cache tile's) | **Lead** of `positive-cache-read`; else stub |
| ID generator | store: Database or Cache · read & write · optional | none | Stub |
| Redirect responder | none: **can't connect** | none | Stub |
| Event publisher | channel: Queue · publish · needed; outbox: Database · write · needed for jobs and publication | none (batch, linger, outbox fixed) | Part of `owned-multipart`, `asset-lifecycle`, `video-hls`; else stub |
| Event consumer | channel: Queue · consume · needed | none (concurrency is the Worker's) | Part of `asset-lifecycle`, `video-hls`, `event-counter`, `search-projection`; else stub |
| Data access | database: Database · read, or read & write · needed | Pool size, Statement timeout, while part of a template | Part of `owned-multipart`, `positive-cache-read`, `event-counter`; else stub |
| Auth guard | identity: Identity (or External API, as a stub) · verifies tokens · needed | none (JWT fixed) | Part of `owned-multipart`; else stub |
| External call | target: External API, an application tile or Identity · request · optional | none | Stub |
| Custom | uses: any tile · as the link · optional, many | none | Stub |
| Multipart uploads | objects: Object storage · read & write · needed | none | **Lead** of `owned-multipart` |
| Lifecycle writer | state: Database · read & write · needed | Pool size, Statement timeout | **Lead** of `asset-lifecycle` |
| Video encoder | originals: Object storage · read · needed | none | **Lead** of `video-hls` |
| Video packager | outputs: Object storage · writes · needed | none | Part of `video-hls` |
| Video thumbnailer | outputs: Object storage · writes · needed | none | Part of `video-hls` |
| Event counter | none: **can't connect** | none | **Lead** of `event-counter` |
| Index writer | index: Search index · writes · needed | none | **Lead** of `search-projection` |
| Search query | index: Search index · read · needed | none | **Lead** of `search-query` |

- **Settings shown** are those with a template consumer and a user need
  (`generation-support.ts:133-151`). Fixed values (`generation-support.ts:152-181, 196-210`;
  cache reader `generation-resolver.ts:607-621`) stay out of forms. Tile settings stay where they
  are: Request timeout and Concurrency limit on a Service or Uploads (`generation-support.ts:79-98`),
  Concurrency on a Worker (fixed 1 for Video HLS, `generation-support.ts:196-210`), TTL on a Cache
  (`generation-support.ts:126-131`).
- **Stub kinds show no settings.** That already holds: the inspector shows only installed
  consumers (`supported-authoring.ts:56-82, 112-144`). Old values stay in source.
- A part that is not in a complete template is a stub with the same slots.
- The module fan labels each kind **Template** (a lead), **Part of a template** or **Stub**.

## 3. Feature modules or responsibility modules

| Ground | (a) Feature modules | (b) Responsibility modules |
| --- | --- | --- |
| Reuse across projects | Each template is reused whole; no shared parts. | Data access, Event consumer and Event publisher serve 3–4 templates and any stub; leads are reused per template (a product video uses Multipart uploads, Lifecycle writer and the Video modules without search or counts). |
| Mix and match | None: one box per template. | Leads combine with generic parts; stubs sit beside them. |
| Generator change | Every SQL and queue setting moves from the modules the resolver traces today (`generation-resolver.ts:204-221, 482-486`) onto one feature module per template. | Bindings, emitters and setting sources stay. Lead kinds become `componentTargets` (today `["custom"]` or `["cache-reader", "custom"]`, `generation-support.ts:217, 280`); the Lifecycle writer becomes a SQL setting source; new derivation (§5) and stub emitter (§6). |
| v2 module table | Breaks: 22 modules become 9. | Keeps all 22 names. |

**Recommendation: (b), with one rule against shape-guessing.** Each template has exactly one
**lead** kind. A template is selected only when its lead is present and every needed part is
connected. Generic modules alone never select a template: a Worker with a consumer and a Data
access is a pair of stubs, not an event counter. This matches what generation already reads:
the resolver takes pool sizes, retry limits and outbox switches from the Data access, Event
consumer and Event publisher modules that trace each bound link.

### Templates as modules

All 7 installed templates (`local.video-composition`, `composition.ts:14-24`); binding fields
from `generation.ts:25-50`, host kinds and stores from `generation-support.ts:236-302`.

| Template | Host | Lead (field) | Other needed parts (field) | Optional (field) | Across tiles |
| --- | --- | --- | --- | --- | --- |
| `owned-multipart` | Uploads, Service | Multipart uploads (objects) | Data access (state); Event publisher on a work queue, with its outbox in the state database (jobs); Auth guard on an Identity (identity) | — | — |
| `asset-lifecycle` | Worker | Lifecycle writer (state) | Event consumer on a topic (results) | Event publisher on a topic, outbox in the state database (publication) | upload = the `owned-multipart` writing the same database |
| `video-hls` | Worker | Video encoder (originals) | Video packager and Video thumbnailer on one object storage (outputs); Event consumer on a work queue (jobs); Event publisher on a topic, no outbox (results) | — | — |
| `positive-cache-read` | Service, Redirect | Cache reader (cache) | the Data access its loader names (source) | — | — |
| `event-counter` | Worker | Event counter (—) | Event consumer on a topic (events); Data access (state) | — | — |
| `search-projection` | Worker | Index writer (index) | Event consumer on a topic (events) | — | — |
| `search-query` | Service | Search query (index) | — | — | the index needs an Index writer (its authority) |

**Not offered:** `youtube-upload`, `youtube-watch`, `youtube-search`. They stay readable as
known, uninstalled declarations (`generation-catalog.ts:101-103`) and no module selects them.

### v2's 22 modules under this contract

Names and descriptions follow the [rebuild table](units.md#names-and-descriptions-for-the-v2-rebuild-ma09).

| Tile | Module | v2 kind → kind | Fills | Generation |
| --- | --- | --- | --- | --- |
| Watch API | Video details cache | cache-reader → Cache reader | lead, cache | Template |
| | Video details reader | data-access → Data access | source (via the loader) | Template |
| | View count reader | data-access → Data access | — | Stub |
| | View publisher | event-publisher → Event publisher | — | Stub |
| View counter | View consumer | event-consumer → Event consumer | events | Template |
| | Receipt and increment | custom → **Event counter** | lead | Template |
| | Count writer | data-access → Data access | state | Template |
| Search API | Video search | custom → **Search query** | lead, index | Template |
| Upload API | Creator check | auth-guard → Auth guard | identity | Template |
| | Multipart uploads | custom → **Multipart uploads** | lead, objects | Template |
| | Job outbox publisher | event-publisher → Event publisher | jobs (+ outbox) | Template |
| | Upload state writer | data-access → Data access | state | Template |
| Transcoder | Job consumer | event-consumer → Event consumer | jobs | Template |
| | Segmenter and encoder | custom → **Video encoder** | lead, originals | Template |
| | Packager | custom → **Video packager** | outputs | Template |
| | Thumbnailer | custom → **Video thumbnailer** | outputs | Template |
| | Processing result publisher | event-publisher → Event publisher | results | Template |
| Video lifecycle worker | Processing consumer | event-consumer → Event consumer | results | Template |
| | Lifecycle writer | data-access → **Lifecycle writer** | lead, state | Template |
| | Video publication publisher | event-publisher → Event publisher | publication (+ outbox) | Template |
| Search indexer | Video publication consumer | event-consumer → Event consumer | events | Template |
| | Index writer | custom → **Index writer** | lead, index | Template |

### v2's 10 selections under this contract

| v2 selection (tile) | Template | Becomes |
| --- | --- | --- |
| `owned-upload` (Upload API) | `owned-multipart` | lead Multipart uploads |
| `lifecycle` (Video lifecycle worker) | `asset-lifecycle` | lead Lifecycle writer; `upload` derived from the shared Metadata database |
| `hls` (Transcoder) | `video-hls` | lead Segmenter and encoder |
| `ready-reader` (Watch API) | `positive-cache-read` | lead Video details cache |
| `counter` (View counter) | `event-counter` | lead Receipt and increment |
| `projection` (Search indexer) | `search-projection` | lead Index writer |
| `query` (Search API) | `search-query` | lead Video search |
| `upload-api` (Upload API) | `youtube-upload` | not offered; nothing |
| `watch-api` (Watch API) | `youtube-watch` | not offered; View count reader and View publisher are stubs |
| `search-api` (Search API) | `youtube-search` | not offered; nothing |

**Intended rebuild differences**, for MA09's diff:

- the kind changes in bold above;
- one tile link Upload API → Identity and one module link Creator check → Identity: v2's guard
  is bound in the selection only (`generation.selections[0].binding.identity`), with no drawn
  link (question 2);
- one in-process link Video details cache → Video details reader, its loader (§4);
- no `youtube-*` selections and no `preset`. The Watch API is no longer a provisioned user of
  View counts and View events (`youtube-watch` bound them), and its read grant on View counts
  goes;
- owner IDs and names are derived (§5). The resolved facts otherwise match v2's ownership;
- settings no template reads (CDN origin and provider, module mirror values such as
  `l2TtlSeconds`) and fixed values left to descriptor defaults may differ.

## 4. Links between modules in one tile

v2 has none. Every module link reaches a tile `via` a host link
(`studio-components.ts:217-234`). One case needs one: the Watch API has two Data access modules,
so the Cache reader must say which one loads on a miss. A rule by shape would guess.

- **Needed:** only the Cache reader's **loader** slot (Cache reader → Data access in its tile). It
  is saved as a component-target module link, the existing format.
- **Authored:** in Connect mode, drag from the Cache reader row's dot onto the Data access row.
  Valid rows highlight; others fade with the reason. Chat uses the same `connectModule`.
- **Drawn:** a short arrow in the container's left gutter, from row to row, in Detailed. Hovering it in
  Connect mode shows its X, which runs `disconnectModule`.
- **Not used:** other in-process links (the built-in studies have some, `studio-examples/youtube.ts:312-343`)
  stay saved, are neither drawn nor authored, and never decide what is generated. MA02 may drop
  `partners` (`canvas/selection.ts:60, 117`).

## 5. Derived declarations

Today generation needs hand-made declarations. These are: the host's role
(`generation-resolver.ts:245-257`); the store's authority, grant and dependency access
(`generation-resolver.ts:339-380`); the upload and lifecycle sharing one owner
(`generation.ts:330-356`); and supported fixed values. Only the preset writes them
(`generation-presets.ts:14-208`). Normal authoring refuses `createComponent` and
`connectComponent` (`supported-authoring.ts:97-100`).

### Commands (one batch each, so one revision and one Undo step)

| Command | Writes |
| --- | --- |
| `addModule(host, kind)` | The module, with a fresh name and ID (`studio-modules.ts:69-84`) and the kind's defaults plus any value its template fixes. On a schema-2 design (new projects are schema 2, `design.ts:77-78`) it also adds the schema-3 upgrade and an empty `generation` for the local runtime, as the preset does (`generation-presets.ts:177-179`). Then derivation. |
| `connectModule(module, slot, target)` | The module link. If the host has no link to the target tile, it adds the link the lane rules give (pair default; refused as `linkTiles` would be). New links already carry the local runtime's protocol and Private network (`studio-links.ts:88-89, 283-295`). Then derivation. |
| `disconnectModule(link)` | Removes the module link; the host link stays (`studio-operations.ts:265`). Then derivation. |
| `removeModule(module)` | Removes it and its links. Then derivation. |
| `removeTile`, `removeLink` | As today, then derivation when module-level selections exist. A lost store turns its templates into stubs. Today a bound store's removal is refused (`generation.ts:362`) and stays so for tile-level selections. |

### Derivation

Derivation is one pure pass over the whole design, run by each command above. It writes only
module-level declarations.

| Fact | Rule |
| --- | --- |
| Selection | A lead with every needed part gets `{id: lead, target: {kind: "component", component, host}, template: exact ref, binding}`, filled from its parts' links. Its parts get no selection of their own. Every other module gets a **stub selection**: template `module-stub@0.1.0`, binding `{kind: "module-stub"}`. |
| Fixed values | Written where the tile, module or link still holds its creation default or `unspecified`. Database: PostgreSQL, self-hosted. Cache: Redis-compatible, self-hosted. Search: OpenSearch, self-hosted. Queue: self-hosted, work queue for jobs, topic otherwise. Object storage: self-hosted, private, but public for outputs. Identity: public. A lane-entry host: public. Video HLS Worker: concurrency 1. Publisher outbox: on for jobs and publication, off for results. Cache reader: cache-aside, single-flight (the creation default is `none`, `studio-components.ts:192`). Sources: `generation-support.ts:99-181, 196-210`; `generation-resolver.ts:607-621, 684-695`. |
| Initial values | A needed user setting with no value gets one, because the inspector shows a setting only once it has a supported value (`generation-resolver.ts:520, 545-551`): Request timeout 1000 ms, Concurrency limit 1000, Worker concurrency 4, Cache TTL 3600 s, Pool size 10, Statement timeout 2000 ms. |
| Role | A template's host gets `worker` on a Worker and `api` elsewhere. The Identity an Auth guard binds gets `api` (`generation-resolver.ts:662-674`). |
| Owner | Hosts whose templates write the same store share one owner. A host whose template only reads a projection joins that projection's owner. Any other host gets a new owner, named after its group's first host in lane order. |
| Authority | A store a template writes belongs to its writers' owner. A Cache reader's cache is a `projection` of its loader's database. A search index is a `projection` of the outbox database of the publisher feeding the Index writer's queue. Anything else is a `source`. If a projection has no source, its template stays a stub, with the reason. |
| Grant, access | For each host and store: the widest access its templates need. A read of another owner's source gets `boundary: "published-read"`. For each bound link: its field's access. |
| Clean-up | Facts that only the previous module-level selections needed are removed. Facts that tile-level selections need, or that no module-level selection ever needed, are never touched. |

On v2's graph this gives v2's grants and dependencies. The only exceptions are the two that
`youtube-watch` needed.

### Refusals

The whole command refuses, in plain words naming the tiles and modules, when:

- a part has two candidates ("Upload API has two Data access modules on databases; Multipart
  uploads needs one");
- a part already serves another template;
- one tile would hold two templates of the same kind, or a module-level and a tile-level one;
- the host's kind is not one the template allows (the fan doesn't offer it; chat is refused);
- the packager and thumbnailer write different storage;
- a host would need two owners, or a derived fact contradicts a kept one: two writers of one
  store already with different owners, a role of the other kind, or a source declared where a
  projection is needed.

An old value the command may not overwrite, such as an unsupported provider, protocol or setting,
does not refuse the command. The module's status becomes **Refused** with the reason, and
Generate blocks as today (`generation-resolver.ts:755-787`). Old values are never cleared.

**Reads never invent.** Resolving, the blueprint, chat's `getDesign`, the inspector and the
Generate preview work out each module's status and write nothing
(`generation-resolver.ts:358`).

### `buildGenerationPresetCommand`

It copies a seed's tiles, tile-level selections and hand-made ownership
(`generation-presets.ts:14-208`, `generation-preset-selections.ts`). It backs "Add a supported
feature" (`PresetAttachment.tsx:65, 107`) and chat's `attachGenerationPreset`
(`supported-authoring.ts:90-96`, `chat/tools.ts:147`). **Retire both entry points in MA08**,
because module authoring reaches the same templates by mouse and two routes would confuse. Keep
the spec function as a source fixture for the product-attachment reuse example
(`jeeves-generator/examples/product-attachment/export.ts:14`) and tests. Its tile-level output
keeps resolving. It is not re-expressed as modules (question 5).

## 6. Stub contract

| Item | Contract |
| --- | --- |
| Selection | A stub selection (§5). The stub capability has no role, resources or settings. It is exempt from the role check (`generation-resolver.ts:245-257`) and from the host-setting audit (`generation-resolver.ts:579-595`), which would otherwise block a stub-only export. |
| Files | `src/modules/<host>/<module>.slots.ts`, a `generated-scaffold`: its `Dependencies` type and slot descriptors. `src/modules/<host>/<module>.ts`, a `generated-extension` (`registry.ts:27-34`): an exported entry point taking `Dependencies` that throws "Not implemented: <name>", with the module's name, kind and description as its comment. One shared `src/modules/dependencies.ts` (scaffold) declares a minimal interface per tile kind and use (database read or read-write, queue publish or consume, object read or write, cache, search read or write, HTTP target, module). Stubs import no template library, so a stub-only export builds. IDs are the canonical slugs (`generation-resolver.ts:100-103`). |
| Connected slots | One typed property per connected slot, named after the target tile (or module), plus a descriptor naming the tile, the link and its read or write (`studioStoreAccess`). |
| Unconnected slots | No property. One comment line per slot, e.g. `// channel: not connected (Queue, publish)`, and the report lists it. |
| Report | `.jeeves/report.json` gains `modules`: one row per module with host, kind, status (Template, Stub, Custom or Refused), template, files, unconnected slots and reason. It is written only when the design has a module-level selection, so v2's report keeps its shape. The preview response lists modules for every design; a module no module-level selection covers is **Template** if a tile-level binding traces it, else **Custom**. |
| Provisioning | None. A stub's tiles are provisioned only if a template binds them (§1). |
| Re-export | Existing rules, unchanged. Export writes only to a new directory (`src/v2/cli.ts`, `export.ts:10-16`), and the studio gives a ZIP. `planFileWrites` keeps identical files, refuses any changed file with `EXISTING_OUTPUT_CHANGED`, and leaves unrelated files alone (`files.ts:53-78`, test `assemble.test.ts:208-295`). Nothing merges. To update, export afresh and carry your stub bodies over; the `.slots.ts` file shows what changed. |

## 7. Tile fan

| Tile type | Kinds offered |
| --- | --- |
| Service | Service, Worker, Uploads, Identity |
| API | CDN |
| Database | Database, Search index |
| Cache | Cache |
| Queue | Queue |
| Storage | Object storage |
| External | External API |

- That is 11 kinds: all 10 v2 uses, plus External API, the target of External call and Custom stubs.
- **Gateway is not offered.** It has no template, takes no modules and the local runtime has
  one HTTP slot (`local.ts:699-707`). Existing gateways keep working (question 4).
- **Not offered:** Redirect, Notifications, Billing and Browser. Today the fan offers types and
  defaults only (`studio-tiles.ts:8-41, 52-58`).

## 8. Compatibility

| Topic | Rule |
| --- | --- |
| Tile-level selections | They resolve exactly as now: the element-target path is unchanged, and module rules apply only to component targets and `module-stub`. |
| Frozen v1 | Byte-identical, pinned by `assemble.test.ts:297-304`. v1 fingerprints only its own templates (`templates/local-v1/index.ts:28-31`), but its input check rebuilds blueprint v3 (`input.ts:170`), so existing kinds keep their blueprint fields (§2). |
| Frozen v2 | **70 of its 72 files stay byte-identical**: all but `.jeeves/manifest.json` and `.jeeves/report.json`. Those two record the hash of every file in `packages/spec/src`, `jeeves-generator/src/v2` and `templates/local-v2` (`templates/local-v2/index.ts:52-63`, `registry.ts:205-215`, `assemble.ts:227-231, 265-283`), so any code change, from MA02 on, changes them. They must match apart from that source and emitter inventory (question 1). |
| v2's preset identity | `youtube-core` is computed from the whole template catalog (`generation-catalog.ts:120-123`). Adding `module-stub` would change its sha256 (`d4c66f03…`), make v2's preset unknown and block its export (`generation-resolver.ts:763-770`). MA05 pins it to its current 10 template and 6 policy refs. Existing records stay unchanged. |
| Mixed designs | Both kinds of selection coexist. Module commands never edit tile-level selections or the facts they need. One tile can't hold the same template both ways. Removing a module a tile-level binding names (v2's Creator check) still refuses (`generation.ts:236-249`). A module command on an older module gives it a declaration. |
| Blueprint | v3 carries module-level selections in its existing `generation` block (`studio-blueprint.ts:358-361`), with no new fields. Blueprint v2 refuses them as it refuses all selections (`studio-blueprint.ts:217-240`). |
| Chat | Four tools, `addModule`, `connectModule`, `disconnectModule` and `removeModule`, go through `buildSupportedAuthoringCommand` (MA05). `getDesign` reports each module's status. Raw `createComponent`/`connectComponent` stay refused. `attachGenerationPreset` goes in MA08. |
| Frozen v2 project and studies | Never edited. Module derivation runs only on module commands. |

## Open questions for the owner

**Answered 2026-11-09:** the owner accepted every default. The owner wants #6 planned and built
as its own plan after the MA series finishes.

1. **What "frozen v2 byte-identical" means.** Two provenance files hash the generator's own
   source, so they change with any code change. *Default:* the other 70 files byte-identical;
   those two equal apart from the source and emitter inventory. v1 stays fully byte-identical.
2. **Creator check → Identity.** v2 binds its guard without a drawn link. *Default:* the rebuild
   adds Upload API → Identity, so the guard's connection is visible. Generated output is the same.
3. **The cache's loader.** *Default:* one drawn in-process link, Cache reader → Data access. No
   other in-process links are drawn or authored.
4. **Gateway in the fan.** *Default:* not offered until an edge template exists.
5. **Retire "Add a supported feature".** *Default:* yes, in MA08. Keep the spec function for the
   reuse example and tests.
6. **A runnable process per application tile, and provisioning for stubs.** *Default:* not in
   this plan. Templates and stubs are libraries; the `application-services` gap stays.

MA05–MA08 in [units.md](units.md) are revised to this contract.
