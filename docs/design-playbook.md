# Design playbook

What agents know about designing a Jeeves study or diagram: the patterns real systems use, how each
maps to Jeeves tiles, kinds, settings and templates, the shapes that read wrong on the canvas, and
what Jeeves can't draw yet. Read it before you design a study or change one. When a study, research
or an owner review teaches something new, add it here (AGENTS.md).

The goal behind every rule is "Why this matters" in the
[design-polish plan](plans/design-polish/units.md#why-this-matters):

- **Every tile maps to a template**: a ready-made backend a generator deploys and configures (a
  database engine, a CDN, a search engine, a resumable upload server), or a generated service
  skeleton whose modules say what it does.
- **Readable at a glance** by someone who didn't draw it.
- **Diagram level.** Algorithms, retries, hashing, DAG scheduling and cleanup jobs are module
  purposes or the developer's work after generation, not tiles.

The canvas's own rules are in [CATALOG](../CATALOG.md#lanes-and-links); this page assumes them. The
ones that shape every pattern below:

- The user reaches only its actions, and an action reaches only a service, an API or the CDN. **A
  user never reaches a store.**
- Stores (database, search index, cache, object storage) are end tiles: nothing links out of a
  store.
- A queue sits between applications and needs an owner, its publisher. Use `work-queue` for jobs
  (each done once) and `topic` for events (each consumer gets every event).
- **One writer per store**: the store's owner writes, every other link into it reads
  (`studioStoreAccess`). The canvas derives this, so it can't show a second writer: a second
  writer is drawn as a reader.
- No loops: a line never runs back to an earlier tile.
- Caps (`laneLimits`): 4 links out of a tile, 4 entries per action.

Notation, as in the [studio guide](studio.md): `→` a request, `⇢` asynchronous, `⇣`/`⇡` an entry
from the download or upload action. "(owner)" marks a store's one writer. On the canvas a request
is a solid line and an asynchronous link a dashed one, and so is every link that continues after
an asynchronous link: a worker's requests after its queue are dashed too.

## Real-world boxes in Jeeves

| What a source draws | Jeeves tile (kind) | Notes |
| --- | --- | --- |
| API servers, web servers, an app service | Service (`service`) | One per responsibility the reader should see (Watch API, Search API). |
| An upload API that signs URLs, a resumable upload server (tusd) | Service (`uploads`) | Its **Transfer** says how the bytes travel: `signed-url` or `tus` (pattern 1). |
| Workers, a worker pool, task workers, consumers | Service (`worker`), after a queue | A worker is never an entry; it hangs after a queue. |
| Load balancer | none | Implied by a service's replicas and autoscaling. See the gateway smell. |
| API gateway | API (`gateway`) | Only when the reader needs to see it (smells). |
| Message queue for jobs | Queue (`queue`, `work-queue`) | Owned by the publisher. |
| Event stream, completion queue, Kafka topic | Queue (`queue`, `topic`) | Owned by the publisher; several consumers. |
| Blob storage, S3, original or transcoded storage | Storage (`object-store`) | `access` private or public is intent. |
| CDN | API (`cdn`) | `origin` names the store or application it pulls from. |
| Metadata DB, SQL or NoSQL database | Database (`database`) | `engine`, `readReplicas`, `partitionKey`. |
| Search cluster (Elasticsearch, OpenSearch) | Database (`search`) | A derived index, never the source of truth. |
| Cache (Redis, Memcached) | Cache (`cache`) | Its owner is whoever writes it (pattern 4). |
| Sign-in, OAuth, user service | Service (`identity`) | Other services verify its tokens (`auth-guard` module); no line to it. |
| Payment provider | Service (`billing`) | Stripe is its provider, not an External tile. |
| Email | Service (`notification`) | Resend or SES as its provider. |
| Any other third party | External (`external-api`) | Named for the provider. |
| DAG scheduler, resource manager, preprocessor, orchestrator | modules of the worker | Inside the worker that runs the work (gaps). |

---

## Patterns

Each pattern: the problem, the shape, how it maps to Jeeves, the template it implies, where
sources differ, and the sources (full list at the end).

### 1. Uploading large files through an upload service

**Problem.** A creator sends a file of hundreds of megabytes or more over an unreliable link. A
dropped connection must not restart it, and the bytes should not cost more than they need to.

**Shape.** The client always asks a service first: to sign in, check the user may upload, and
start the upload. The bytes then travel one of two ways, and the diagram is the same for both:

```text
UPLOAD  User → Publish ⇡ Upload service → Original videos (owner)
                                        ⇢ Upload jobs
```

- **Proxied:** the client sends the bytes to the Upload service, which streams them into storage.
  Resumable with a protocol such as tus (the server records the offset; the client resumes from
  it).
- **Signed URL:** the Upload service starts a multipart upload, signs a URL for each part, and the
  client sends the parts straight to storage. Storage checks the signature, so the storage endpoint
  is itself a service checking the request. The Upload service then verifies the parts and
  completes the upload ("trust but verify": the client reports each part's ETag, the service checks
  them with ListParts, then calls CompleteMultipartUpload).

Either way the Upload service is the one writer of Original videos and the one that knows the
upload finished, so it publishes the job.

**In Jeeves.**

- Publish ⇡ Upload service (`uploads`, public), its entry.
- Upload service → Original videos (`object-store`, `access: private`, owner Upload service).
- Upload service ⇢ Upload jobs (`queue`, `work-queue`, owner Upload service).
- Modules: `auth-guard` (`jwt`, the creator check against Identity's token), a `custom` module
  for the transfer ("Multipart uploads: start, sign each part, list the parts that arrived,
  complete", or "Resumable uploads: tus"), and an `event-publisher` for the job.
- **How the bytes travel is a choice on the Upload service, never a user → store line.** It is
  the Uploads kind's **Transfer** ([studio settings](studio-settings.md#uploads)): `signed-url`
  (the default, what the sources draw) or `tus`. SD02 added the kind at ladder step 2 rather than a
  setting on `service` (step 3): a setting would show on every microservice, while an Uploads kind
  is a preset like Identity or Billing, with its two languages and a template for each transfer.
  The module's purpose still says what the service does ("start, sign each part, list, complete").
- The upload's progress: with multipart, the upload itself is the state (resuming asks storage
  which parts arrived), so the service needs no database. If it keeps per-part status
  (HelloInterview), that is its own Uploads database, owned by the Upload service, not the
  video's metadata store (pattern 7, "split the store").

**Templates.** Proxied (`tus`): a ready-made resumable upload server (tusd in Go: S3, Google Cloud
Storage, Azure or disk storage; a blocking `pre-create` hook authenticates the user, a
`post-finish` hook tells the application the upload is done, which is where the job is published;
`@tus/server` is the TypeScript one, with the same two hooks). Signed URL (`signed-url`): a
generated service skeleton with the storage SDK's multipart calls. The two imply different
templates, which is why the choice is recorded on the tile.

**Where sources differ.**

- ByteByteGo (Xu) draws the client uploading straight into original storage with a pre-signed URL,
  and the API servers only signing. HelloInterview's YouTube and Dropbox prefer pre-signed URLs to
  avoid uploading the file twice. The owner's rule: the diagram keeps Publish → Upload service →
  Original videos, and the signed URL is how the bytes travel inside that service's job.
- Who notices the upload finished: the service that completes it (AWS's pattern, HelloInterview's
  trust-but-verify), or storage's own event notification (S3 event notifications fire on
  `CompleteMultipartUpload`, at least once, into SQS, SNS, Lambda or EventBridge; HelloInterview's
  YouTube starts processing from it). Jeeves can't draw storage publishing an event (gaps), so the
  Upload service publishes the job.
- Xu splits files into GOP-aligned chunks on the client for resumable uploads; that is client and
  module detail, not a tile.

**Sources.** ByteByteGo *Design YouTube*; HelloInterview *YouTube* and *Dropbox*; AWS presigned
uploads, multipart upload, and the presigned multipart blog; S3 event notifications; tus and tusd
(hooks).

### 2. A media pipeline: jobs, workers, a completion event and a completion handler

**Problem.** Transcoding takes minutes and fails sometimes. The upload must not wait for it, and
the video's record must change only once the outputs exist.

**Shape.**

```text
Upload service ⇢ Upload jobs ⇢ Transcoder → Original videos       (reads)
                                          → Transcoded videos     (owner)
                                          ⇢ Completion events ⇢ Completion handler → Metadata DB (owner)
```

The worker that does the heavy work writes only its own output. It then announces the result on a
topic. A separate completion handler records it in the store that readers use.

**In Jeeves.**

- Upload jobs: `queue`, `work-queue` (each job done once), owner the Upload service.
- Transcoder: `worker`, `autoscaleOn: queue-lag`, low `concurrency` (one heavy job per replica).
  Modules: `event-consumer` (with `retryLimit`), `custom` modules for the stages (segment and
  encode, package playlists, thumbnails), `event-publisher` for the completion event.
- Transcoded videos: `object-store`, owner the Transcoder.
- Completion events: `queue`, `topic`, owner the Transcoder, so the search indexer (pattern 3) can
  consume the same events.
- Completion handler: `worker`, modules `event-consumer` and `data-access`; owner of the Metadata
  DB (and of a metadata cache if the owner writes it, pattern 4).
- The Transcoder uses 3 of its 4 links; the handler 1–2. YouTube 2.0 is this pattern.

**Why a completion handler, and not the transcoder writing the record.**

- **One concern per worker, one template each.** The transcoder is a media worker (ffmpeg stages);
  the handler is a generic consumer with a data-access module. A transcoder that also writes the
  record and the index is the smell "a worker writing a store for an unrelated concern".
- **One writer for the video's record.** The handler owns the Metadata DB; everything that changes
  a video's record arrives as an event it consumes (pattern 7).
- **No loops.** The service that started the job can't receive its completion (Upload service ⇢
  Upload jobs ⇢ Transcoder ⇢ … → Upload service is a loop), so the completion goes to a tile after
  the transcoder.

**Templates.** Queues and topics: the chosen provider's product, configured. The transcoder: a
generated worker skeleton with media modules. The completion handler: a generated consumer and
writer skeleton, close to the TinyURL analytics worker and the marketplace's Order recorder.

**Where sources differ.**

- ByteByteGo (Xu): transcoding servers, a completion queue and a completion handler that "updates
  the metadata database and cache"; inside the transcoding servers a preprocessor, DAG scheduler,
  resource manager and task workers. In Jeeves the DAG machinery is the transcoder's modules, not
  tiles.
- HelloInterview: one video processing service runs a DAG (an orchestrator such as Temporal) whose
  last step marks the upload complete and writes the segment URLs into the metadata. That is the
  transcoder writing the record; the YouTube study 1.x followed it and the owner found it unclear.
- Xu pushes transcoded files to the CDN; Jeeves draws the CDN pulling (pattern 6).

**Sources.** ByteByteGo *Design YouTube*; HelloInterview *YouTube*; the YouTube study's sources.

### 3. Search fed by events through an indexer

**Problem.** Search needs its own index, kept in step with the source data, without the code that
writes the data also writing the index.

**Shape.**

```text
(writer of the data) ⇢ <topic> ⇢ Search indexer → Search index (owner)
User → Watch ⇣ Search API → Search index (reads)
```

Two ways to place the indexer:

- **Sibling consumer** of the event that already exists: Completion events ⇢ Completion handler and
  ⇢ Search indexer. Both derive their store from the same ordered events (Kleppmann: "each
  datastore that needs to be kept in sync is an independent consumer of the log"). Use it when the
  event carries everything the index needs.
- **After the record's owner:** the owner writes the record and publishes a "changed" event
  (marketplace: Shop service ⇢ Listing events ⇢ Search indexer). Use it when the index needs data
  only the record's owner has, or when several kinds of change (create, edit, delete) must reach
  the index. Turn on the publisher's `outbox` so the event is sent if and only if the write
  commits.

Either way the indexer is the index's only writer, and the search API only reads it. The indexer
may also read the database to fill the document (a read link), as Netflix enriches events before
indexing, but only after the record's owner: a sibling consumer that reads the database can run
before the record is written and find nothing.

Siblings update the record and the index independently, so for a moment search can find a video
whose record isn't written yet (the watch page then misses). That is the eventual consistency
every derived index has; if a search hit must always open, use "after the record's owner".
YouTube 2.0 uses the sibling shape: the completion event carries the title, description and
channel the index needs, and nothing edits a video afterwards.

**In Jeeves.** Topic (`queue`, `topic`), owner the publisher; Search indexer (`worker`, modules
`event-consumer` and a `custom` index writer); Search index (`search`, `engine: opensearch`, owner
the indexer); Search API (`service`) with a read link.

**Templates.** The search engine: a ready-made backend (OpenSearch, Elasticsearch, Meilisearch)
configured. The indexer: a generated consumer skeleton. The API: a generated service with a query
module.

**Where sources differ.** Netflix's Studio Search streams both application events and change data
capture (CDC) events from databases into Kafka, enriches them, and an Elasticsearch sink writes the
index. Kleppmann suggests CDC from one database as the practical route. Jeeves can draw only
application events, because a store can't publish (gaps). The marketplace study's sources
(Educative, System Design Handbook) feed search asynchronously from the catalog. ByteByteGo and
HelloInterview's YouTube leave search out; the DesignGurus crash course fills it when a video
becomes playable.

**Sources.** Kleppmann, *why dual writes are a bad idea*; InfoQ on Netflix Studio Search;
microservices.io transactional outbox; Debezium on the outbox and dual writes; the marketplace
study's sources.

### 4. The read path: an API, a cache, a database, and who writes the cache

**Problem.** Reads outnumber writes by orders of magnitude, and the read API must answer fast.

**Shape.**

```text
User → Watch ⇣ Watch API → Metadata cache
                         → Metadata DB (reads, from replicas)
```

The question every design must answer: **who writes the cache?** There are two shapes, and Jeeves
draws each differently.

- **Reader owns the cache (cache-aside, lazy loading).** The read API looks in the cache, on a miss
  reads the database and fills the cache. The cache is the reader's own copy; the database's writer
  never touches it. Staleness is bounded by the TTL. In Jeeves the cache's owner is the reader
  (TinyURL: URL cache owned by the Redirect service; its `cache-reader` module is `cache-aside`
  with `single-flight`). Best when the data rarely changes after it is written (a short link, a
  published video's title).
- **The writer owns the cache (write-through).** Whoever writes the database also writes the cache,
  so it is never stale; the reader only reads, and on a miss reads the database without filling.
  In Jeeves the cache's owner is the database's writer (Xu's completion handler writes both). It
  costs a cache miss for anything evicted or never written.

Never both: a reader that fills a cache another tile writes is two writers, and the canvas will
show the reader as "Reads". Pick one and say which in the cache's purpose and the reader's module.

**How to pick.** Write-through alone never puts back an entry the cache evicted, so for a record
written once and then only read (a published video, a short link) an evicted entry stays a miss
forever. Such data wants the reader's own cache-aside with a TTL; nothing goes stale because nothing
changes. Write-through pays off when the data changes often and readers must see each change at
once. YouTube 2.0 follows Xu's metadata cache but gives it to the Watch API (cache-aside, an hour),
and its Completion handler writes only the database: a video's record never changes after it is
written. A reader-owned cache also sits in its reader's band, beside it, instead of between the
lanes.

Database replicas carry most reads: `readReplicas` on the database, `readRouting: replica` on the
reader's `data-access` module.

**Reading another service's database.** Jeeves allows read links into a store another tile owns
(TinyURL's Redirect reads the URL database Shorten writes). microservices.io's "database per
service" says a service's data should be reached only through its API. Allow the read when the
reader is the same feature's read side (create and redirect of one link); otherwise prefer a call
to the owner (application → application) or a read model fed by its events (pattern 3). Record
which and why.

**Templates.** Cache and database: ready-made backends (Redis-compatible, PostgreSQL, MySQL)
configured. The API: a generated service with `cache-reader` and `data-access` modules.

**Where sources differ.** AWS describes lazy loading and write-through and recommends a TTL with
either. The System Design Primer's write-through has the cache write the store, which Jeeves can't
draw (stores are end tiles); in Jeeves write-through means the application writes both.
HelloInterview's YouTube adds an LRU metadata cache partitioned by video ID as an enhancement; the
YouTube study 1.x left the cache out, serving reads from replicas.

**Sources.** AWS ElastiCache caching strategies; System Design Primer (cache); microservices.io
database per service; ByteByteGo *Design YouTube*; HelloInterview *YouTube*; the TinyURL study.

### 5. Counting from events

**Problem.** Counting views or clicks by writing a row per event overloads the hot row and slows
the request.

**Shape.**

```text
User → Watch ⇣ Watch API ⇢ View events ⇢ View counter → View counts (owner)
                         → View counts (reads)
```

The API publishes each event and returns. A counter worker sums events per key (and per period)
and writes the totals in batches. The API reads the totals.

**In Jeeves.** View events: `queue`, `topic` (other consumers may come), owner the API, with
`partitions` and `retentionSeconds`. The API's `event-publisher` batches (`batchSize`,
`lingerMs`). View counter: `worker` on `queue-lag`, modules `event-consumer`, a `custom` summer,
`data-access`. View counts: `database` (ClickHouse for TinyURL's analytics, MySQL for YouTube's
totals), owner the counter. Filtering bots or repeat views is a module of the counter, not a tile,
unless the reader must see it.

**Templates.** Topic and database: ready-made. The counter: a generated consumer skeleton with an
aggregation module (TinyURL's analytics worker is the same shape).

**Where sources differ.** Reddit counts unique views with two Kafka consumers: one (Nazar) decides
whether a view counts, the other (Abacus) keeps a HyperLogLog per post in Redis and writes it to
Cassandra periodically. One writer still owns both stores. DesignGurus' Grokking puts click
analytics behind a queue, consumers and a store read by a stats API (TinyURL). The crash course
keeps view counts in their own eventually consistent store. Jeeves has no wide-column engine
(gaps).

**Sources.** Reddit, *View counting at Reddit*; DesignGurus (Grokking) TinyURL; DesignGurus crash
course *Design YouTube*; the TinyURL and YouTube studies.

### 6. A CDN pulling from object storage

**Problem.** Video segments, images and other large files should be served near viewers, not by
the application.

**Shape.**

```text
User → Watch ⇣ Video CDN → Transcoded videos (reads)
```

The CDN is the download action's entry. On a miss it fetches from its origin, the store the
pipeline wrote, and caches it. The pipeline never writes to the CDN.

**In Jeeves.** Video CDN: `cdn`, `provider` (Cloudflare first, or CloudFront, Google Cloud CDN),
`origin` = the store, `imageResizing: on-request` when it also serves images at several sizes
(thumbnails, product photos). The store: `object-store`, owner the worker that writes it; `access`
public when the CDN reads it through the bucket's public domain (an R2 custom domain), private when
the CDN signs its requests (CloudFront's origin access control). Signed playback URLs for private
videos are a module of the API that hands them out.

**Templates.** The CDN product and the bucket, both ready-made and configured; nothing generated.

**Where sources differ.** Xu distributes transcoded videos to the CDN (push). The System Design
Primer describes both: a push CDN receives content from you; a pull CDN fetches it on the first
request and keeps it for a TTL. HelloInterview's Dropbox uses a pull CDN with signed URLs. Jeeves
draws pull (`cdn → object-store`). Push would be a write from the pipeline into the CDN
(application → `cdn`), which hides where the file lives; don't draw it.

**Sources.** System Design Primer (CDN); HelloInterview *Dropbox*; ByteByteGo *Design YouTube*;
AWS CloudFront origin access control; Cloudflare R2 public buckets; the YouTube and marketplace
studies.

### 7. One writer per store

**Problem.** Two services writing one store race each other, fail halfway, and leave no one
responsible for the data's shape. Jeeves makes the store's owner its only writer.

**How to turn two writers into one.** Choose the owner: the tile whose job the data describes, or
the last step that knows the data is final. Then route every other write to it:

1. **Carry the data in the job.** The first writer's data rides in the message that already flows
   to the owner. Example: the title and description ride in the upload job and the completion
   event, and the completion handler writes the video's record once.
2. **Route the write through the owner by an event.** The other writer publishes a "changed" event
   on a topic it owns and the store's owner consumes. Example: a later edit of a video's title (not
   in the studies) would be an event the Metadata DB's owner consumes, not a second writer.
3. **Call the owner.** When the caller needs the result now, it calls the owner's API
   (application → application, sync) instead of writing its store.
4. **Split the store.** If the two writers write different things, they are two stores. Example:
   upload progress (owned by the Upload service) is not the published video's record (owned by
   the completion handler).

When the owner both writes its database and publishes an event, enable the publisher's `outbox`, so
the event goes out if and only if the write commits (microservices.io). Never let one service write
the database and the index or cache of another's data directly (Kleppmann's dual writes).

**Worked example: Xu's YouTube.** ByteByteGo has two writers of the metadata DB and the metadata
cache: the API servers (flow b, the file name, size and format while the upload runs) and the
completion handler (when transcoding completes).

| Xu | Jeeves, one writer |
| --- | --- |
| API servers write metadata during the upload | The Upload service puts the title and description in the upload job (1). It writes no metadata. |
| Completion handler writes the metadata DB and cache | The completion handler is their only writer, from the completion event that carries the job's data and the transcoder's output. |
| Upload status while the upload runs | The multipart upload is the state; or the Upload service's own Uploads database (4). |

The video is in the record only once it is playable, which is also when search should see it.

**Sources.** microservices.io database per service and transactional outbox; Kleppmann; ByteByteGo
*Design YouTube*; the three studies' design decisions.

---

## Smells

Shapes that read wrong on the canvas, each with its fix. The first five are checked in every study.

### The user reaches a store

**Looks like:** a line from the user (or an action) into storage or a database. YouTube 1.0 had
Produce ⇡ Original videos for the signed-URL parts.
**Why wrong:** a user never reaches a database; a service checks every request, and the canvas
already has an upload flow through that service.
**Fix:** action → service → store (pattern 1); how the bytes travel is a choice on the service. The
link table now refuses it.

### A worker writes a store for an unrelated concern

**Looks like:** a pipeline worker with lines into stores its name doesn't describe. YouTube 1.2's
Video processor wrote Encoded videos, the Metadata database and the Search index, at the 4-link
cap.
**Why wrong:** the reader can't tell what the worker is for; the search index follows the
transcoder's code instead of the video's data; one template does three jobs.
**Fix:** the worker writes only its own output and publishes a completion event; a completion
handler writes the record and an indexer writes the index (patterns 2 and 3). A worker near the
4-link cap is a hint. YouTube 2.0 does this: the Transcoder writes Transcoded videos and publishes
Completion events; the Completion handler and the Search indexer write the rest.

### A fork that reads as a second lane

**Looks like:** a tile with a request into its own store and an asynchronous branch into a
pipeline, where the store line runs beside the pipeline as if a second flow left the tile. YouTube
1.2's Upload service → Original videos ran under Upload jobs and the Video processor; the Watch
API's reads and its View events looked the same.
**Why wrong:** one service seems to split into two lanes, when every request goes through it.
**Fix:** design: keep a tile's own store links few, and its asynchronous continuation dashed (the
link mode, never a second tile). Layout: a store sits beside the tile that uses it, so the fork is
two short branches, and a later user's line comes back to it
([guide](studio.md#layout-and-navigation)). In YouTube 2.1 the Upload service's fork is Upload jobs
and Original videos side by side, and the Watch API's cache, View counts and View events sit right
after it; its fourth link, the Metadata database read, is still long (next smell).

### A long line to a far store

**Looks like:** a reader's line running the board's width to a store in the last column. YouTube
1.2's Video CDN → Encoded videos; TinyURL's Stats API → Analytics store.
**Why wrong:** the eye follows the long line and reads it as part of the flows it passes.
**Fix:** layout first: a store sits beside its users, at most one column before its last user
([guide](studio.md#layout-and-navigation)). In design, check the reader belongs to the lane it is
in and reads that store directly; never add a tile just to shorten a line. A store read at the
start of one lane and written at the end of the other keeps one long line, whichever side it
sits: the longer the writer's pipeline, the further the reader stretches. YouTube 2.1's Video CDN
line spans one column gap (256px) now that Transcoded videos sit right after the CDN, but the
Search API's line to the Search index (1,056px) and the Watch API's to the Metadata database
(1,024px), both written at the end of the pipeline, still cross the board (they were 1,408px and
1,472px with the stores in the last column).

### A store nobody reads

**Looks like:** a store with only its writer's line (the `output-unread` warning). TinyURL v2's
analytics store had no reader.
**Fix:** draw the reader (the stats API) or drop the store. A service's own private database or
cache (a cart, payment records) is read by its owner and is not this smell.

### Two writers

**Looks like:** two tiles that both change a store's data. The canvas can't draw it: the
non-owner's line says "Reads". Look instead at what the non-owner's link label and modules say it
does: a module whose purpose writes the store (a writer, an index writer, a cache fill) or a label
renamed to say it writes. (A new link's default label "Reads & writes" alone proves nothing; it is
the link table's default for any link into a database or cache.)
**Fix:** pattern 7.

### A gateway that does nothing a reader needs to see

**Looks like:** a Gateway as an action's only entry, in front of services the reader then can't
see from the action. Xu's load balancer in front of the API servers.
**Why wrong:** on the lanes a gateway hides which services handle the action; load balancing is
implied by a service's replicas.
**Fix:** leave it out and record why (the marketplace and YouTube studies do). Add a Gateway only
when the reader must see what it does (one public host routing to several services with an edge
concern such as rate limiting), accepting that it becomes the action's one entry.

### An entry its action's word doesn't cover

**Looks like:** an action named for one flow with an entry from another (TinyURL's Open link
reaches the Stats API, which serves the link's creator their counts).
**Fix:** rename the action (24 characters) so its word covers its entries, or move the entry to
the other lane if it produces rather than consumes.

### A line that comes back reads as a box

**Looks like:** a store's later user, drawn as a U ([guide](studio.md#layout-and-navigation)),
wraps the tiles between it and the store in a rectangle. Lines have no arrowheads and a pipeline's
lines are all dashed, so a dashed U reads as a group outline. YouTube 2.1 (SD04, at 100%): the
View counter's write wraps View events and the View counter; the Transcoder's read and write wrap
Upload jobs and the Transcoder; the Completion handler's and the Search indexer's writes nest
round the Search index.
**Why wrong:** the reader sees a group, not a line from a worker to its store, and can't tell
which tile the U leaves from without selecting it.
**Fix:** none in design yet; don't add tiles or reorder links just to avoid a U. It is a layout
question for the owner (SD04's HUMAN_FEEDBACK entry). Until then, check a study at 100% and say
in the handoff which U's read as boxes.

---

## Gaps

Patterns Jeeves can't draw today, with the [extension
ladder](plans/design-polish/units.md#rules-for-the-studies-dp08-dp09) step each would need. None is
built; step 5 means asking the owner first.

| Pattern | Today | Step it would need |
| --- | --- | --- |
| A store publishes its changes: a database's change stream (CDC, Debezium) or storage's event notifications (S3, R2) feeding a queue | Stores are end tiles. The service that writes publishes the event, with an `outbox`. | 5: a link-table row `store → queue` (a lane-rule change). |
| The server tells the user something (the video is ready; Xu's step 4) | No line runs to the user. The client polls a read API; email through a Notifications service. | 5: a line into the actor. |
| Scheduled work (expiry cleanup, re-indexing, backfills) | A worker needs a queue in front of it and can't be an entry. Left to the developer (owner, 2026-11-05). | 5: a trigger tile or entry rule. |
| A workflow orchestrator (Temporal; Xu's DAG scheduler and resource manager) | Modules inside the worker. | 2: a kind of Service (a workflow engine with its template) if a reader needs to see it. |
| A reader that fills a cache another tile writes (write-through plus lazy fill) | Two writers; pick one shape (pattern 4). The `cache-reader` module has no "read only, no fill" pattern. | 3: a `cache-reader` pattern value, if a study needs write-through with readers that don't fill. |
| A wide-column store for counters (Cassandra) | `database` engines: PostgreSQL, MySQL, SQLite, MongoDB, ClickHouse. | 3: an engine value. |
| A CDN the pipeline pushes to | Drawable (application → `cdn`) but hides the origin. | None: draw pull (pattern 6). |

---

## Before you hand off a design

- Every tile traces to a source or a stated decision, and maps to a template (ready-made or
  generated). Name it in the handoff.
- The user's lines go only to actions; every action's entries are services, APIs or the CDN.
- Each store has one writer, its owner, and at least one reader unless it is its owner's private
  state. No non-owner writes in disguise.
- Each worker writes only what its name describes; results go on as events.
- Search and caches are derived: say who writes each and from what. A cache of data written once
  is its reader's own (pattern 4).
- No gateway unless the reader needs it; no load balancer tile.
- Action words cover their entries.
- Within `laneLimits`; the study validates with no findings and no warnings.
- Every difference from the sources is recorded, with the reason.

## Sources

Read for this playbook (2026-11-06):

- ByteByteGo (Alex Xu), *System Design Interview*, Design YouTube:
  https://bytebytego.com/courses/system-design-interview/design-youtube
- HelloInterview, YouTube:
  https://www.hellointerview.com/learn/system-design/problem-breakdowns/youtube
- HelloInterview, Dropbox:
  https://www.hellointerview.com/learn/system-design/problem-breakdowns/dropbox
- AWS, Uploading objects with presigned URLs:
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- AWS, Amazon S3 Event Notifications:
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html
- tus, resumable upload protocol: https://tus.io/; tusd: https://tus.github.io/tusd/; tusd hooks:
  https://tus.github.io/tusd/advanced-topics/hooks/
- Martin Kleppmann, Using logs to build a solid data infrastructure (or: why dual writes are a bad
  idea), Confluent, 2015:
  https://www.confluent.io/blog/using-logs-to-build-a-solid-data-infrastructure-or-why-dual-writes-are-a-bad-idea/
- InfoQ, Netflix Studio Search (Eran Stiller, 2022), on the Netflix Tech Blog's "How Netflix
  Content Engineering makes a federated graph searchable":
  https://www.infoq.com/news/2022/04/netflix-studio-search/
- Debezium, Event sourcing vs CDC (the outbox and dual writes):
  https://debezium.io/blog/2020/02/10/event-sourcing-vs-cdc/
- microservices.io (Chris Richardson): Transactional outbox
  https://microservices.io/patterns/data/transactional-outbox.html; Database per service
  https://microservices.io/patterns/data/database-per-service.html; API gateway
  https://microservices.io/patterns/apigateway.html
- AWS, ElastiCache caching strategies (lazy loading, write-through, TTL):
  https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
- System Design Primer (CDN push and pull; cache-aside and write-through):
  https://github.com/donnemartin/system-design-primer
- Reddit, View counting at Reddit (Krishnan Chandra, 2017):
  https://www.redditinc.com/blog/view-counting-at-reddit/ (Reddit's site refuses automated
  fetches; read through search summaries quoting it), and the QCon talk listing
  https://www.infoq.com/presentations/algorithms-counting-reddit/
- AWS, Restrict access to an Amazon S3 origin (CloudFront origin access control):
  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- Cloudflare, R2 public buckets (custom domains and cache):
  https://developers.cloudflare.com/r2/buckets/public-buckets/

Used through the studies, which cite them in their doc comments and the [studio guide](studio.md):
DesignGurus' Grokking (TinyURL; YouTube or Netflix) and crash course (YouTube), System Design
Primer (Bit.ly), ByteByteGo (URL shortener, payment system), Dub, Educative and System Design
Handbook (e-commerce), Google's Online Boutique, Microsoft's eShop, Stripe Connect, Cloudflare's
and AWS's image delivery, AWS multipart uploads, Vitess and Cloudflare R2 pricing.

## 2026-11-06 review addendum: reliable foundations

The owner's next [three-study review](HUMAN_FEEDBACK.md#2026-11-06--three-study-review-and-reliable-code-foundations)
exposed limits in the earlier guidance. This addendum qualifies those recommendations without
rewriting their history. See the [full review and sources](plans/reliable-foundations/review.md)
and [proposed units](plans/reliable-foundations/units.md). These lessons do not change the current
schema, lane rules or runtime capabilities.

### Preserve the architecture when simplifying its picture

- A dependency graph, a user journey and deployment units describe different things. Keep stable
  service/resource identities; let views select or repeat references to them. Do not invent a
  second independent service simply to prevent a return path in the drawing.
- A long-running workflow can return a result to the service that initiated it. Distinguish
  asynchronous completion from accidental recursive execution. The current no-cycle rule is a
  modeling restriction, not a universal software-architecture rule.
- Own data at a logical business-service boundary. APIs and background consumers inside that
  boundary can share its schema and deployment contract. Existing package ownership is a partial
  mechanism. Multiple instances of a service are not competing business owners.
- Other services should use the owner's contract or a deliberate projection. “One writer and
  everyone else reads its tables” alone does not establish independently deployable services.
  Physical database infrastructure can still be shared with separate owned schemas.
- Treat store ownership, permitted access and a particular operation's read/write behavior as
  separate concepts. Today's derived access is an approximation; do not interpret it as proof
  that a free-text module respects ownership.

### Model state and recovery, not just the successful path

- Work queues distribute work among competing consumers; they do **not** generally guarantee a
  job executes only once. Topics need independently defined subscriptions/consumer groups.
  Both require an explicit duplicate-delivery and recovery policy.
- An outbox atomically records a database change and the intent to publish within that database
  transaction. Delivery can be retried/duplicated and consumers must handle it. It does not
  make object storage, a remote payment and a local database one transaction.
- A resumable upload's list of parts is transport state. It does not replace the application's
  durable upload/video record, permission state, processing attempts, cancellation or failure.
- A TranscodeSucceeded event says outputs exist. A VideoPublished event says the authoritative
  owner committed a publication decision. Those are different events. Prefer downstream search
  updates after that decision; define replica/cache freshness as well.
- Pending orders/checkout attempts precede payment in the proposed retail foundation.
  Price/availability, duplicate notifications, unknown payment outcomes and compensation need
  contracts. A successful-payment-to-order projection alone is a narrower demo.
- Every proposed foundation states its scope. Finite-stock checkout, public-only media or
  approximate analytics can be valid profiles; they do not silently imply all enterprise needs.

### Make relationship meaning visible

- The screenshots show that a reader can miss a dependency that exists: the Transcoder reads
  Original videos, but the route obscures it. Verify both the model and the drawing before
  deleting a resource that appears unused.
- Recommend solid/dashed style based on each relationship's interaction, with direction and
  read/write/publish/consume labels. The current inheritance of dashes after a queue is a drawing
  convention, not a claim that all worker dependencies are asynchronous.
- A storage access and a job publication leaving one service are different responsibilities,
  not necessarily two user journeys. Label/focus them instead of deleting one.
- Signed upload control and byte transfer differ. The service-first overview can remain, but
  inspectors/contracts must disclose that a signed URL authorizes direct client-to-storage bytes.
- Measure whether a newcomer can trace the named flow, alongside line length and crossings.
  Return lines that look like frames and unrelated lines that look like a bus fail that check.
- A focused view must make hidden relationships discoverable. Do not improve apparent simplicity
  by silently omitting dependencies from the source of truth.

### Separate guidance, support and evidence

- A pattern or a component's “template” paragraph describes a possible implementation. It is not
  proof that a compatible template exists. A catalog definition marked known is not verified code.
- A generic service shell supplies infrastructure behavior; domain behavior needs a narrower
  capability contract or an explicit custom extension. Prose cannot be compiled deterministically.
- Tested components do not imply every composition is tested. Evidence must identify the exact
  contracts, templates, versions, settings, output and scenarios that were exercised.
- Prefer one narrow end-to-end foundation before many languages/providers. Measure supported
  behaviors and recovery cases, rather than a promised percentage of generated source lines.
- Repository playbooks are not automatically input to the in-app chat model. Supply curated
  pattern records through its real context/tools, mark unrepresentable variants, and evaluate
  the resulting designs. Structured arguments and deterministic review complement the model;
  they do not prove that its architectural judgment is correct.

## 2026-11-07 notation follow-up: relationship direction

RF01 implements the review addendum's relationship notation. A worker's store read or write is
a solid request even when the worker consumes a queue; only asynchronous relationships are
dashed. Target arrowheads follow caller → target for requests, including reads, and
publisher → channel → consumer for messaging. The canvas legend discloses this convention;
selected connections show their saved action label, interaction, arrow convention and inferred
store access. This changes no design semantics or blueprint fields.

Mouse review of the three studies at 1440×900 and 1280×800 showed that a selected solid return
with its target arrowhead is easier to recognize at 0.95 zoom, while overview tile names still
need zoom and shared segments still hide route identity. Direction markers improve notation;
they do not solve overlapping routes. Keep those concerns for focus/tracing rather than moving
stores or inventing services. A saved label such as “Reads originals” explains intent; access
still follows ownership, and the current model cannot distinguish an owner's individual read
from a write.
