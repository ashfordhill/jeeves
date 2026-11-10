# Tile process contract (TP01)

**Status:** written 2026-11-10 for the coordinator. Every open question stays within the plan's
owner decisions 1–6. **Plan:** [tile processes](units.md) · **Code read at:** `e8b53a3`.

## Owner summary

- **Option:** saved in the design as `generation.processes` by an unticked "Runnable processes" box
  (chat sends the same command). Off keeps today's bytes. Only module-built designs can use it.
- **Shape:** each Service and Uploads tile is an HTTP process, each Worker runs consume loops, and
  a Service holding a consumer does both. One edge exposes lane-entry tiles at `/api/<tile id>/`.
- **Templates:** five run their real libraries with a generated hooks file that answers "Not
  implemented" (501, or a logged dead letter). The two search templates are placeholders.
- **Stubs:** a consumer stub gets a loop; any other stub in an HTTP tile answers
  `/modules/<module id>`; Worker stubs are only compiled. You fill a stub in its own file.
- **Loops:** "Not implemented" goes to `.failed` with one log line; other errors retry 5 times.
- **Stub stores** are provisioned with each link's access; nothing is written to ownership.
- **IDs:** renaming re-keys an ID that still follows its name or kind (one Undo step; a clash
  refuses). Studies, frozen v2 and hand-chosen IDs keep theirs. **Acceptance:** §8.

## Today, in brief

| Fact | Where |
| --- | --- |
| An `app-<host>` service exists only from a `local.services` contribution. Its host must already have a selection, and no installed emitter contributes one. | `jeeves-generator/src/v2/local.ts:637-748`, `local-contract.ts:36-50` |
| Every selected host lands in the required `application-services` gap. | `local.ts:834-844` |
| One HTTP port slot; a port is published only for a public host. | `local.ts:699-707, 742-745` |
| Providers exist only for resources a template selection binds. No template contributes an SQL login, so no host can connect to Postgres yet. | `local.ts:114-206`; probe of `v2ModuleDesign()`: `logins: []` |
| The asset lifecycle contributes no subscriber queue on `completion-events`. | `asset-lifecycle.ts:64-99` (no `local`); probe: `queues: []` |
| `process.ts`, `http.ts` and `admission.ts` are emitted only beside templates. A stub-only export has just `src/runtime/local.ts`. | `composition.ts:78-82, 140-143`, `primitives.ts:26-27`; probe: 30 files |
| `first-run`/`start` refuse when any `app-*` exists and `applicationComplete` is false. | `templates/local-v2/assets/scripts/local.mjs:7-15` |
| The HTTP error handler turns any unknown error into 503. | `assets/src/runtime/http.ts.template:33-45` |
| A stub's entry point takes only `Dependencies` and throws `Not implemented: <name>`. | `module-stubs.ts:230-240` |
| `youtube-core` hashes *every* policy record. A new policy would change its sha256 and block v2. | `jeeves/packages/spec/src/generation-catalog.ts:138` |

The probes were in-memory `assembleV2` runs (no export to disk) of the MA07 stub test design,
`v2ModuleDesign()` and frozen v2.

## 1. The option

| Ground | Saved in the design (`generation.processes`) | Chosen at export only |
| --- | --- | --- |
| Reproducible | Yes. The export's own `.jeeves/inputs/design.json` reproduces it, and the input hashes cover it. | No. The inputs alone lose it; the manifest and CLI need a separate flag. |
| Off means unchanged | Yes: absent means off. | Yes: an absent flag means off. |
| Mouse, chat, generation share it | Yes: one command (AGENTS.md). | No. Chat has no generation tool, so it couldn't choose it. |
| Blueprint | v3 carries it in the cloned `generation` block (`studio-blueprint.ts:292, 358-361`). | It is invisible. |
| Cost | A revision and an Undo step per toggle. The schema, form, validation and blueprint change together. | The request schema (`apps/server/src/routes/generation.ts:21-25`), the CLI and the manifest change. |

**Recommendation: save it in the design.**

- **Schema:** `processes: z.literal(true).optional()` in `generationSchema` (`generation.ts:63-68`).
  Turning it off deletes the key and never writes `false`, so off has one form.
- **Command:** `setRunnableProcesses { on }` in `studioCommandSchema`. The Generate dialog
  (`apps/web/src/canvas/GenerateProject.tsx`) and chat send it. It refuses in plain words when:
  - there is no module-level selection ("Add a module first.");
  - the design has a tile-level selection or a preset ("Runnable processes needs a design built
    from modules."), which protects the frozen v2 project and preset designs;
  - the registry doesn't install it (`buildSupportedAuthoringCommand` already receives `installed`).
- **Support:** `GenerationInstalledSupport` gains `processes?: true`. With the option on and
  `processes` not installed, the resolver reports `NEEDS_TEMPLATE` at `/generation/processes`.
  The dependency-only registry never installs it.
- **Model:** `NormalizedGeneration` gains `processes` **only when on**, so `.jeeves/normalized.json`
  and `diagnostics/generation.json` are unchanged when off. Each row has the tile, kind, shape,
  exposure, settings, module roles and stores (§2–§6).
- **Manifest:** the input hashes already cover the option. Add `"processes": true` beside
  `runtime`, only when on (`assemble.ts:304-322`).
- **Report:** a `processes` section, only when on. Each tile's row lists:
  - its service, shape, edge path and settings with their origin;
  - its routes, loops and hooks, each with what it answers;
  - what is provisioned for it.

  It also has `runnable`: no findings, no `unsupported` gap, and every application tile has a
  process. `applicationComplete` keeps its meaning (`assemble.ts:262`).
- **Chat:** getDesign (`chat/tools.ts:313, 565-571`) gains `processes: true|false`. The instructions
  gain one line.
- **Blueprint:** v3 carries the field as is. Blueprint v2 refuses it, as it refuses all generation
  (`studio-blueprint.ts:220-240`).
- **Off means unchanged:** `local.tile-processes` is always registered, so with the option off,
  every v2-path design follows contract §8. Every payload file is byte-identical, and the two
  provenance files differ only in their source and emitter inventory. v1 stays fully
  byte-identical. Do not add a `generationPolicies` record, and do not change `generationRuntime`.

## 2. Process shape

| Tile kind | Process | Runs |
| --- | --- | --- |
| Service, Uploads | `app-<id>`, HTTP | Fastify via `createHttpService` on `0.0.0.0:3000`, with `/healthz`, template routes and stub routes. It also runs a loop for any consumer it holds (the mixed case). |
| Worker | `app-<id>`, worker | Template worker factories and stub loops. It has no HTTP server. |
| Redirect, Billing (legacy) | as Service | The same two shapes, so every tile that holds modules runs (open question 6). |
| Notifications (legacy) | as Worker | The same as a Worker. |
| Browser, Identity, Gateway, stores | none | Identity stays Keycloak when a template binds it (`local.ts:582-608`). |

A tile with nothing to serve still runs. An empty HTTP process answers only `/healthz`. An empty
worker holds a timer until it is stopped, so Node does not exit.

| Item | Rule |
| --- | --- |
| Entry point | `src/processes/<id>.ts` (a scaffold), built to `dist/processes/<id>.js`. Compose runs `node dist/processes/<id>.js`. A Video HLS host uses the media image (`local.ts:712-715`). |
| Config | Compiled in: `src/features/application-bindings.ts`, `local-bindings.ts`, and the process file's own route, loop and stub tables. Nothing is read from disk at runtime. |
| Environment | No new variables. Keep `OIDC_*` for identity-bound hosts (`local.ts:717-722`) and `OBJECT_PUBLIC_ENDPOINT` for multipart signing (as v2's upload service did). Secrets come from `/run/secrets`, listed per service (`local.ts:653-685`). |
| HTTP settings | The tile's Request timeout and Concurrency limit when a template on it consumes them. Otherwise fixed at 1000 ms and 1000 (the derivation's initial values), which the report lists. Options are unchanged (open question 7). |
| Startup | Clients are built and their access is probed (§6), loops subscribe, HTTP listens, then `scope.ready()` writes the ready marker (`assets/src/runtime/process.ts.template:53-57`). Any failure exits 1. |
| Health | The compose healthcheck reads the marker (`local.ts:724-732`). HTTP processes also answer `GET /healthz` with 200 once ready and 503 before (`http.ts.template:25-28`). |
| Shutdown | SIGTERM or SIGINT drains in reverse order (`process.ts.template:19-31, 61-67`): HTTP stops admitting and drains, then loops cancel and drain, then publishers, clients and pools close. `stop_grace_period` stays at 6m, or 21m for media (`local.ts:725`). |
| Compose service | Profile `application`, `init: true` and **no restart policy**, so a failed process stays exited and never loops. `depends_on` is `service_healthy` on every provider it uses, never on another `app-*`. No `ports`. |
| Public edge | `app-edge`, using the nginx image already pinned in `assets/providers.json`, published at `127.0.0.1:${LOCAL_HTTP_PORT}:8080`. `infra/edge/nginx.conf` routes `/api/<id>/` to `app-<id>:3000/` for each **public** HTTP process (v2's pattern) and answers `/healthz`. It exists only when a public HTTP process exists. Exposure is public when the tile is a lane entry or its saved exposure is public; otherwise the process is reached only inside the network at `http://app-<id>:3000`. |

The foundation stays the only writer of shared files:

- `local.services` accepts the hosts in `model.processes`, including hosts with no selection.
- A new `edge` contribution carries the edge's routes.
- Process services contribute `http: false`, and the edge owns the single port.
- With the option on, the foundation substitutes `local.mjs`'s gate expression (`local.mjs:7-15`)
  so that it reads `report.processes.runnable`. It refuses if that expression isn't found exactly
  once. With the option off, the asset bytes are unchanged.
- The library writers (composition, primitives) also emit `process.ts`, `http.ts`, `admission.ts`,
  `amqp.ts` and `delivery.ts` when a process needs them. Their off conditions are unchanged.

## 3. Wiring the 7 templates

Two levels:

- **Mounted:** the template's real factory runs on generic parts. Its product hooks come from a
  generated hooks file, `src/modules/<host>/<lead>.hooks.ts` (a `generated-extension`). It exports
  one factory that takes the template's generic resources and returns the hook object; every member
  throws `NotImplemented("<hook> for <lead name>")`.
- **Placeholder:** the template's construction needs product *data*, such as a mapping or a preset.
  Its route or loop exists and answers "Not implemented" without building the factory.

`NotImplemented` lives in a new scaffold, `src/runtime/tile-process.ts`, with the 501 wrapper, the
stub loop and the rate-limited log. Its check matches a `NotImplemented`, or any error whose message
starts with `Not implemented`, so today's stub text works unchanged.

| Template (lead) | Host | Level | Mounted or started as | Real generic parts | Generated "Not implemented" hooks |
| --- | --- | --- | --- | --- | --- |
| `owned-multipart` (Multipart uploads) | Uploads, Service | Mounted | `createMultipartHttpHandlers(...).mount` (`multipart-http.ts.template:27-97`) with POST and GET at `/modules/<lead>/uploads`, `/uploads/:uploadId`, `/uploads/:uploadId/parts/:partNumber`, `/uploads/:uploadId/complete` and `/uploads/:uploadId/abort`. A sweep runs at start and every 30 s. | Upload tables from `ownedUploadPersistence` (`upload-state.ts:12-40`), S3 objects, the transaction, the jobs publisher and outbox relay | `principal`; `validate`, `metadata`, `response`, `reserve`, `complete`, `closed`; `originalKey` |
| `positive-cache-read` (Cache reader) | Service | Mounted | `createPositiveReader` at `GET /modules/<lead>/:key` | The Valkey client; TTL from the Cache tile; a source pool (login, no grants) | `key`, `codec`, `eligible`, `load`, `expiresAt` |
| `search-query` (Search query) | Service | Placeholder | `GET /modules/<lead>` | The search client | The mapping and query preset (data); the existing `search-mappings` gap (`local.ts:845-853`) |
| `asset-lifecycle` (Lifecycle writer) | Worker | Mounted | `startAssetLifecycleWorker` (`asset-worker.ts.template:18-105`) on the results subscriber queue (to be added), with the publication relay when it is bound | Tables from `assetLifecyclePersistence` (`asset-lifecycle.ts:15-62`), shared with its upload selection; the pool, the consumer (retry 10) and the publisher | `metadata`, `event`, `result`, `failure`, `job.codec`/`construct`, `response`, `publication`, `identities` |
| `video-hls` (Video encoder) | Worker | Mounted | `startMediaWorker` on the jobs work queue (concurrency 1, retry 3), after `verifyVideoRuntime()` | S3 source and results buckets, the results publisher, the FFmpeg engine | Codecs `job`, `video`, `result`, `eventId`, `event`; source and results `owns` |
| `event-counter` (Event counter) | Worker | Mounted | `startCounterWorker` on the events subscriber queue (retry 5) | Counter tables and the public totals view from `eventCounterPersistence` (`event-counter.ts:16-51`), and the pool | `event`, `aggregateKey`, `eventId`, `identity` |
| `search-projection` (Index writer) | Worker | Placeholder | A loop on its subscriber queue (`search.ts:36-45`) | The consumer | The mapping and event codec (data) |

- **Tables:** one private schema per template selection, named from the selection's ID. An asset
  lifecycle uses its upload selection's schema, because they share one owner
  (`generation.ts:332-357`). A published view sits in `<schema>_public`. These are generic names
  for the templates' own schema helpers: no product behaviour.
- **Answers:**
  - Over HTTP, a wrapper turns `NotImplemented` into `HttpError(501, "NOT_IMPLEMENTED", message)`
    before the existing 503 mapping.
  - In a loop, the hook logs a line and the template's own delivery handling decides. A codec or
    parse hook is terminal at once (`MALFORMED_MESSAGE`, `asset-worker.ts.template:74-84`). An
    effect hook retries within the template's limit, then gives `RETRY_EXHAUSTED`
    (`delivery.ts.template:119-146`). *TP09:* when the hook that failed isn't written, the
    dead letter now says `NOT_IMPLEMENTED` in both cases, like a stub's; a template's own code
    (`INVALID_MEDIA`) and its retries are kept.
- **Gaps:** with the option on, each template's `*-application-bindings` gap becomes a required
  `custom` gap naming its hooks file (`multipart.ts:43-52`, `asset-lifecycle.ts:87-96`,
  `video-hls.ts:62-71`, `positive-cache.ts:85-94`, `event-counter.ts:109-118`,
  `search.ts:104-113`).
- **What "reaches its handler" means:** no installed template has a path free of product hooks. A
  template's 501 or log names the hook its handler reached. Startup work also proves wiring: the
  migrations and sweeps, the FFmpeg check, and the subscribed consumers. *TP09:* each template
  logs one `started` line listing that work just before its process is ready.
- **Fallback:** if TP05 or TP06 finds that a mounted template can't be built or started without a
  product value, it becomes a placeholder, and the report says so (the plan's risk rule).

## 4. Wiring stubs

Each stub has one role, decided from its normalized row (`generation-resolver.ts:157-234`):

| Role | When | How it is reached | Its entry point with processes on |
| --- | --- | --- | --- |
| **loop** | A connected slot consumes a queue (`target.channel === "consume"`), in any tile | One loop per consumed link (§5) | `(dependencies, message: ModuleMessage): Promise<void>` |
| **route** | Otherwise, in an HTTP process | **Any method on `/modules/<module id>` and every path below it** | `(dependencies, request: ModuleRequest): Promise<ModuleResponse>` |
| **library** | Otherwise (a Worker stub that consumes nothing) | Compiled by `pnpm build` and imported by its process. It is called only through another module's in-process link. | `(dependencies): Promise<void>`, as today |

- **Why this route rule:** the path is the module's own ID, which is also its file name. It is
  predictable, it never collides, and with §7 it follows the typed name. Through the edge it is
  `/api/<tile id>/modules/<module id>`. A filled-in stub routes inside itself on `request.method`
  and `request.path`.
- **Requests and answers:** a route runs inside the existing admission, with its timeout,
  concurrency limit and 64 KiB JSON or text body (`http.ts.template:21`). "Not implemented" gives
  501 `{"error":"NOT_IMPLEMENTED","message":"Not implemented: <name>"}`, and an `HttpError` keeps
  its status. Anything else gives the existing 503.
- **Types:** `ModuleRequest` (`method`, `path`, `query`, `headers`, `body`), `ModuleResponse`
  (`status?`, `headers?`, `body?`) and `ModuleMessage` (`body`, `messageId?`, `headers`, `attempt`,
  `source`) live in a new scaffold, `src/modules/entry.ts`. `dependencies.ts` is unchanged.
- **Stub files with the option on:** `<module>.ts` gets its role's signature. A loop stub's consumed
  queue is its input, not a `Dependencies` property: its `.slots.ts` keeps the descriptor and turns
  the property into a comment. With the option off, both files keep today's bytes.
- **Dependencies:** the process builds each `Dependencies` value from real clients that implement
  the minimal interfaces (§6), in `src/runtime/module-clients.ts`, a scaffold. A `ModuleCall` calls
  the target module's entry point with the caller's input, typed `unknown`. The process reuses
  `module-stubs.ts`'s property naming, so the names match.
- **Filling a stub in** edits only `<module>.ts`, and filling a template edits only
  `<lead>.hooks.ts`; no scaffold changes. The exceptions are custom work beyond a stub: its own SQL
  tables (a migration and grants in `infra/local.json`) and search mappings. Re-export is unchanged:
  export into a new directory and carry your files over (module authoring contract §6).

## 5. Consume loops

| Item | Rule |
| --- | --- |
| Mechanism | Reuse `createConsumer` (`assets/src/runtime/amqp.ts.template:126-221`) and `createDeliveryRunner` (`delivery.ts.template:59-152`). They give manual ack, prefetch equal to concurrency, a bounded republish with `x-delivery-attempt`, a `<queue>.failed` queue with `x-terminal-code`, and a drain on close. |
| Queue | A topic uses `<topic>--<host>`; a work queue uses the queue itself (the `consumer` helper's rule, `service-resources.ts.template:86-103`). Both have `.failed` (`broker-init.mjs:14-17`). |
| Concurrency | 1 for stub loops. A template loop keeps its own value (`host.concurrency`, or 1 for Video HLS). |
| "Not implemented" in a stub | Thrown as `NonRetryable("NOT_IMPLEMENTED")`, so the message goes to `.failed` on its first delivery. |
| Other stub errors | Retry 5 times (the generic consumer limit, `generation-support.ts:221`). Before each retry the handler waits `min(250 ms × 2^(attempt−1), 10 s)` (about 8 s in total), and shutdown cuts the wait short. Then `RETRY_EXHAUSTED`. |
| Template loops | Their own limits (lifecycle 10, video 3, others 5) and their own handling (§3). The generated hook logs. |
| Log | One JSON line on stdout: `{"level":"warn","event":"not-implemented","tile","module","what","queue","messageId","action"}`. There is at most one line per second per module and hook, and the next line carries a `suppressed` count. HTTP 501s log the same way with `route`. |
| Stop | (1) SIGTERM: cancel the subscription and drain in-flight work. A message still waiting is left unacked and returns to its queue. Exit 0. (2) A lost broker connection is fatal (the existing rule; no reconnect): the process drains, exits 1 and stays exited until `pnpm start`. (3) "Not implemented" never stops a loop. |

## 6. Provisioning for stubs

With the option on, every store or channel a stub links to is provisioned. The same scripts run
on new rows in `infra/local.json` and `compose.yaml`; the scripts themselves don't change.

| Tile | Provisioned | Access, from the link (`studioStoreAccess`) | Setup |
| --- | --- | --- | --- |
| Database | The database, its setup-only owner, and one runtime login per stub host | CONNECT and USAGE on `public` (stubs own no tables, `local-contract.ts:9-10`). A read of a database that **another owner's** template writes also gets SELECT on its contributed views (`published-read`). | `migrate.mjs` |
| Queue | The broker; a topic exchange or a work queue; `.failed`; `<topic>--<host>` for each consuming stub host | Publish or consume, by the link's channel | `broker-init.mjs` |
| Cache | `cache-<id>` and its secret for each stub host | Read and write | none |
| Object storage | Garage, the bucket, and one `s3-<host>` key | Read, write or both. If another owner's template writes the bucket, read only. | `bootstrap.mjs` |
| Search index | `search-<id>` | As the link. If it is another owner's projection, read only. No index is created (no mapping). | none |
| Identity | Not provisioned | `TokenVerifier` answers "Not implemented", unless a template on the same host binds that Identity | — |
| CDN, External API | Nothing | `HttpTarget` answers "Not implemented" | — |
| Application tile | Nothing | `HttpTarget` to `http://app-<id>:3000`, with no `depends_on` | — |

- **Provider:** use the tile's saved local value. When the value is `unspecified`, use the
  derivation's fixed local value: PostgreSQL, Valkey, OpenSearch, Garage or RabbitMQ, self-hosted
  (module authoring contract §5). A queue keeps its saved mode; a new queue starts as a work queue
  (`studio-model.ts:522`). Any other saved value is not provisioned and gives a required
  `unsupported` gap, so `runnable` is false.
- **Ownership and grants:**
  - Nothing is written, and there are no forms. The resolver works out the facts as it reads the
    design.
  - A host's access to a store is the widest access among its stubs' links: MA05's grant rule,
    without its writes.
  - MA05's existing ownership is only read: a store with another owner's authority gives a stub
    read only and published views.
  - Toggling the option never derives, and so never refuses.
- **Probes:** at startup, each client runs one bounded check that its access allows: `SELECT 1`,
  opening the broker, `PING`, a bucket check, cluster health. A failed probe fails startup. So
  "healthy" means every connected store answered with its credentials.

## 7. IDs follow names

| Rule | Detail |
| --- | --- |
| Re-key | Renaming (`edit` with `name`, `editComponent` with `name`, `studio-operations.ts:127-160`) re-keys an ID that **follows**. A tile becomes `slug(name)`; a module becomes `<host>-<slug(name)>`, the `newModuleIdentity` form (`studio-modules.ts:81-96`). |
| Follows | The ID equals its creation form (`newTileIdentity`, `studio-lane-commands.ts:894-906`; `newModuleIdentity`), or the slug form of its current name, either with an optional `-n`. |
| Cascade | A tile's re-key also re-keys its following modules to the new host prefix. |
| References | One batch: one revision and one Undo step. It updates connection endpoints (`design.ts:32`); studio bindings and setting references (`studio-model.ts:232-233, 272, 427, 601, 631, 652`); components and module links (`studio-components.ts:268, 281-287`); ownership (`ownership.ts:25-53`); operations (`operation-contracts.ts:35-62`); scope (`design-scope.ts:57-58`); C1 nodes (`architecture.ts:17-25`); generation (`generation.ts:15-55`). Derivation then re-runs in the same batch, so selection and owner IDs follow. |
| Completeness | Afterwards, no string equal to the old ID may remain outside free text (names, descriptions, labels). If one does, refuse rather than leave a half-renamed design. |
| Collision | If the new ID, or a cascaded one, is used anywhere (`usedIds`, `studio-ids.ts:9-19`), refuse: "<name> would take the ID <id>, which <thing> already uses. Choose another name." |
| Not re-keyed | Link IDs, which never name a process or file. The stored layout is not used by the lane canvas (`layout.ts:6-16`). |
| Invalid slug | A name whose slug isn't a valid ID (empty, or starting with a digit) keeps the ID; the rename still applies. A slug over 63 characters is cut like `freshId` (`studio-ids.ts:22-30`). |

**Where IDs stay pinned.** Renaming then changes only the name and never refuses:

- a design with `architecture.studio.origin` (`studio-model.ts:696-701`): every study copy and the
  frozen v2 project. A study's origin is set at `studio-examples/study.ts:59-62`. Many study IDs
  equal their name's slug (`transcoder`, `view-counter`), so the "follows" test alone wouldn't
  protect them;
- a design with a tile-level selection or a preset (hand-made generation);
- any ID that doesn't follow: hand-written, imported, or chosen in chat's `addTile`/`addModule`.

**Chat:** its `edit` and `editComponent` go through the same command
(`buildSupportedAuthoringCommand`). The `applyStudioCommands` result lists `renamed: [{from, to}]`,
and later commands in the same turn use the new IDs. The web keeps its selection on the new ID.

**Exports:**

- Exports only go to new directories, so there is no in-place conflict (module authoring contract
  §6).
- A re-key renames the service, folders, SQL names, buckets and queues. A runtime from an earlier
  export won't start against the new one: `local.mjs` refuses a changed composition, so use a new
  project.
- Long names can exceed PostgreSQL's 63-byte names. The export then refuses with its existing
  message (`local.ts:35-43`).

## 8. Acceptance runs

**Designs**, both built by commands, with no owner database:

1. **Stub stack** (new fixture `jeeves/packages/spec/src/fixtures/stub-stack.ts`). Actions: Visit
   (download, entry Links API) and Upload (entry Upload API).

   | Tile | Kind, exposure | Modules (all stubs) |
   | --- | --- | --- |
   | Links API | Service, public (lane entry) | Link reader (Data access → Links database); Link cache (Cache reader with its loader → Link reader, no cache); Limiter (Rate limiter → Links cache); Visit publisher (Event publisher → Visits); Redirector (Redirect responder); Stats caller (External call → Stats API); Upload consumer (Event consumer ← Uploaded) |
   | Stats API | Service, internal | Stats search (Search query → Stats index) |
   | Upload API | Uploads, public | Archive upload (Multipart uploads → Archive); Upload publisher (Event publisher → Uploaded) |
   | Visit worker | Worker | Visit consumer (Event consumer ← Visits); Visit writer (Data access → Links database); Archiver (Custom → Archive) |
   | Stores | — | Links database, Links cache, Visits (topic), Uploaded (work queue), Archive (object storage), Stats index (search) |

   I checked it with the current commands, in memory: all 13 modules are stubs, there are no
   findings, and 52 files are emitted. A consumer link from a downstream queue back to Links API is
   refused as a lane loop, so the Upload lane feeds Links API's consumer.

2. **v2 module design:** `v2ModuleDesign()` (`fixtures/v2-modules.ts:150`) plus v2's 7 useful
   values. Move `moduleAuthored` from `module-templates.test.ts:55-89` into the fixture. It is the
   MA09 rebuild's graph (`v2Diff` finds 0 unexpected rows), with v2's IDs.

**Healthy:**

- `pnpm first-run` exits 0. Its application step waits for every `app-*` to be healthy
  (`local.mjs:235-238`).
- `docker compose ps` shows every `app-*` and `app-edge` running and healthy, and it still does 60 s
  after the last request, with `RestartCount` 0.
- `pnpm stop` then `pnpm start` is healthy again, with the same credentials and volumes.
- Each run uses its own project, loopback ports outside 45400–45412, and cleanup.

**Requests:**

| Design | Request | Expect |
| --- | --- | --- |
| Stub stack | `GET /healthz`, `/api/links-api/healthz`, `/api/upload-api/healthz` | 200, `application: "ready"` |
| | Any method to `/api/links-api/modules/<id>` for each of Links API's six route stubs, and `GET .../modules/redirector/abc` | 501 `Not implemented: <name>` |
| | `POST /api/upload-api/modules/archive-upload` and `/modules/upload-publisher` | 501 |
| | `/api/stats-api/…` at the edge; `http://app-stats-api:3000/modules/stats-search` from inside the network | 404 (not public); 501 |
| | `/api/links-api/modules/nope` | 404 |
| | Publish one message each to Visits and Uploaded, from a container with amqplib | One `not-implemented` line each, in `app-visit-worker` and `app-links-api`. `visits--visit-worker.failed` and `uploaded.failed` hold 1 message each, with `NOT_IMPLEMENTED`. Both stay healthy. |
| | Provisioning | `d_links_db` with logins for Links API and Visit worker. The `visits` exchange with `visits--visit-worker`, the `uploaded` queue, and their `.failed` queues. Bucket `archive` with keys `s3-upload-api` and `s3-visit-worker`. `cache-links-cache` and `search-stats-index` are healthy. |
| | After stop and start | Both `.failed` messages are still there, and every probe passes. |
| v2 module design | `/api/watch/healthz`, `/api/search/healthz`, `/api/upload/healthz` | 200 |
| | `POST /api/upload/modules/upload-multipart/uploads` | 501, naming `principal` |
| | `GET /api/watch/modules/watch-cache-reader/x` | 501, naming `key` |
| | `GET /api/search/modules/search-query?q=x` | 501, naming the search mapping (placeholder) |
| | `POST /api/watch/modules/watch-counts`, `/modules/watch-views` | 501 View count reader, View publisher |
| | Publish to `upload-queue`, `completion-events`, `view-events`, `publication-events` | Each worker logs its hook, and the message reaches `.failed` within its bound. All 8 services stay healthy. |
| | Startup | Template migrations applied in `d_metadata_db` and `d_view_counts`; each queue has 1 consumer; the media worker verified FFmpeg. |
| Both, off | Export without the option | Byte-identical to the pins TP04 records before it changes the generator (the §1 rule) |

## Open questions

All of them are **within** decisions 1–6; none needs to pause the coordinator. Each has a default.

1. **Where the option lives.** *Default:* saved in the design as `generation.processes`, as in §1.
2. **Which designs can use it.** *Default:* only designs built from modules. Tile-level and preset
   designs, frozen v2 included, refuse.
3. **The edge.** *Default:* one generated nginx edge, using the existing pin, with `/api/<tile id>/`
   for public HTTP tiles only.
4. **The stub route rule.** *Default:* any method on `/modules/<module id>` and every path below it.
   Stubs in a Worker are library stubs.
5. **Starting an incomplete app.** *Default:* with the option on, `first-run`/`start` accept
   `report.processes.runnable`. `applicationComplete` keeps its meaning. A stub-only stack can't
   start otherwise.
6. **Legacy kinds.** *Default:* Redirect and Billing run as HTTP processes and Notifications as a
   worker, so every tile that holds modules runs. This is the closest call: the plan names Service,
   Worker and Uploads. The alternative is leaving them in the gap without blocking `runnable`.
7. **Options.** *Default:* unchanged. A process uses the values a template consumes, or the
   reported fixed values, and the module authoring review's follow-up 4 stays open.
8. **Renaming in pinned designs.** *Default:* the name changes and the ID stays, with no refusal.
   This replaces the plan's earlier "refuse where pinned".

These are limits, not questions: stubs' own SQL tables and search mappings are custom work that
needs a scaffold edit; Identity isn't provisioned for stubs; the search templates are placeholders.
