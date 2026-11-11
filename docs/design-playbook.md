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

The canvas's own rules are in [CATALOG](../jeeves/CATALOG.md#lanes-and-links); this page assumes them. The
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
from the download or upload action. "(owner)" marks a store's one writer. On the canvas a direct
call, where the caller waits (HTTP, a database, storage or cache read or write), is a solid line,
and a message sent through a queue or topic, where nobody waits, a dashed one. A worker's store
requests after its queue stay solid. Each tile's kind label (Database, Queue, Topic…) is under its
name, so names leave the kind out.

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

## 2026-11-07 tracing follow-up: relationship focus

Superseded on 2026-11-09: the owner asked for focus to be removed (see the UI01 lesson below).
The overlap chooser and crossing gaps described here remain.

RF02 keeps relationship identity separate from the view: a tile's incoming/outgoing list names
endpoints, saved verbs and interactions; choosing a row isolates that exact relationship while
retaining the tile as the focus anchor. Hidden relationship counts and Show all stay on the
canvas. Fit focus includes the full route and both endpoint tiles. View filters never remove
relationships from the saved design or blueprint.

A wide line hit band is not evidence of which overlapping route the reader intended. Resolve
clicks by distance to the visible routes and ask the reader to choose when several are equally
close; keep direct list selection available. Distinguish proper crossings with a visual gap,
while retaining the shared port stem as a junction. A bounded pass can separate vertical stems
inside an existing gap without moving tiles or increasing crossings. When no safe grid slot is
free, keep the topology and offer focus instead of inventing a service or dropping a dependency.

Mouse review of the three studies confirms that focused returns are traceable, including
Transcoder's originals read and transcoded write, Watch's metadata read, and the independent
Completion handler and Search indexer writes. The complete fitted overview still has small names,
shared stems and U-shaped returns that resemble frames. Focus improves inspection; it does not
establish that the whole architecture is immediately readable or resolve logical ownership and
asynchronous lifecycle modeling.

## 2026-11-07 chat follow-up: reviewed patterns with explicit limits

RF03 exposes a curated [local pattern catalog](studio-patterns.md) through Jeeves chat's actual
tool loop. Repository prose alone does not reach the assistant. Keep the discovery index bounded,
retrieve only the records relevant to the use case, and identify versions and stable checklist/
obligation IDs so later review can name the requirement precisely. Retrieval does not make a
pattern applicable to every design.

Keep a generic pattern's core requirements separate from domain variants. Publication-to-search
requires an authoritative publish/update/unpublish decision, entity versions, visibility and a
freshness policy. A media variant additionally needs processing attempts and results; a Shop
listing publisher should not inherit transcode states. Even publication after commit leaves
replica and negative-cache read races to resolve.

Examples that pass canvas commands prove representable topology, not implemented cache behavior,
transactional outbox delivery or workflow recovery. An unsupported result returning to the same
logical owner should yield its precise state/correlation/reconciliation obligation. Extra
independent completion services do not repair that missing model contract. Keep design intent,
template availability and exact-runtime verification separate, and label scripted transcript
tests as plumbing evidence rather than measured live-model architecture quality.


## 2026-11-07 chat follow-up: review proposed and actual saved state

Review the working copy before committing a turn, through the same tool loop the model uses.
A fresh diagnostic must reach a subsequent model request; ending a response cannot bypass review
of staged commands or explicit scope. Further edits invalidate the review. Bound repair batches
inside the ordinary round budget, while keeping warnings saveable and structural errors atomic.
A focused question can still end immediately, with deterministic review and an honest summary.

Scope must be declared rather than inferred from pattern retrieval, tile names or module prose.
Choose variant checklist IDs deliberately; not every shopping design includes finite stock or
every publication flow transcodes media. Turn-only scope/assumptions are conversation metadata,
not capability contracts or saved requirements. Unknown payload/state/side-effect guarantees
remain **not specified**. A worker's outgoing dependency represents topology; it does not prove
its intended output or business effects. An Uploads transfer setting alone supplies no storage.

Distinguish proposed edits, the exact chat commit and the latest saved state. On provider failure
or a revision conflict, discard proposals and review storage. A mouse edit after the chat commit
must not be credited to its Undo step. Show a compact saved/unresolved result and expose precise
targeted requirements in a mouse disclosure. Review-only and semantic no-op turns need no design
revision; a deleted project has no saved state to certify. Scripted transcripts and browser
checks prove these boundaries, not improved live-model design judgment or runtime correctness.

## 2026-11-07 chat follow-up: strict arguments preserve intent

RF05 adds an audited [OpenAI wire schema](chat-tool-schemas.md), preserving the shared server
commands. Missing information and an explicit clearing action are different design intents:
renaming a store must not erase its owner because a provider requires every field. Nullable
optional inputs need a separate presence representation; ordinary omission sentinels must still
leave defaults to the server. Reject extra/malformed inputs before normalization, and retain
canonical arguments when replaying tool history across requests.

Strict generation constrains argument shape. It cannot establish lifecycle completeness,
ownership/access correctness, business semantics or live-model design quality. Continue to use
command/graph validation and explicit review obligations. Report provider support precisely:
Codex's structured outer answer contains argument JSON strings whose inner values are not
constrained by that output schema. Mocked HTTP acceptance proves transport/codec behavior, not
live API acceptance, model judgment or a runtime template.

## 2026-11-07 evaluation follow-up: evidence needs an external rubric

RF06's [paired evaluation](evals/rf06/README.md) separates represented topology, unresolved
requirements and implemented behavior. A queue/worker/source path can be checked deterministically;
its labels cannot prove pending state, idempotency, publication, reservation or payment recovery.
Both ordinary prose and structured review can disclose a requirement honestly. Exact-word
matching misses legitimate equivalents, while a disclaimer elsewhere can hide an affirmative
claim. Keep these signals reviewable and record independent adjudication, never self-grading.

Freeze prompts, synthetic seeds, budget and provider configuration before comparing arms; retain
all refusals, outputs and failed attempts. Label a guidance/tools ablation precisely instead of
calling it complete legacy execution. A correct alternative may change ownership or add a status
API without deleting durable data. Judge the user's actual preservation constraint, not one exact
node count or an overbroad protected-identity fixture. Still disclose ownership restructures that
make an initiating owner disappear from the lifecycle just to satisfy the drawing's cycle rule.

The live fallback showed both arms can state obligations accurately. Current's targeted review
also emitted irrelevant job lifecycle requirements when the broad job pattern was selected only
for click duplication. More obligations do not imply a more complete or precise architecture.
The long publication alternative shrank to unreadable overview labels; mouse focus made endpoint
lists useful. Count that readability cost alongside topology validity and preserve all hidden
relationships. Agent inspection supports a bounded observation; it is not owner/human acceptance.

The intended Mini run had no credits and produced no response. Access failure is neither model
quality evidence nor proof a live strict schema was accepted. A stronger Codex Sol/medium fallback
cannot answer the Mini question. Record the actual effort and enforced bounds: Codex's existing
adapter does not forward an output-token cap. Tokens are reported usage; API list-price estimates
are not ChatGPT billing. One paired sample per case cannot establish a general quality gain,
particularly when current uses more input and calls. Runtime support and human review remain
separate milestones even when replay, canvas checks and all tests pass.

## 2026-11-07 milestone review: scope the next contract before extending the graph

RF07's [Milestone 1 ledger](plans/reliable-foundations/milestone1-review.md) rechecks the owner's
actual saved documents, not only current presets. Preserve source identities/settings and custom
edits when making disposable review copies. A readable focused dependency proves that a reader
can find it; it does not prove lifecycle, ownership, failure recovery or runtime behavior. The
small fitted YouTube/Marketplace views still have small names and frame-like returns even with
rails closed. Keep that limitation visible alongside the useful endpoint lists.

A first foundation should choose one narrow workload before adding more modeling vocabulary.
The proposed [next plan](plans/reliable-foundations/next-contract-plan.md) starts with immutable
TinyURL create/resolve, one logical owner with API roles, explicit operation access and versioned
finite contracts. Roles, deployables and owners are separate; a same-owner result journey repeats
a reference to one identity. A new blueprint meaning needs an explicit version/migration path;
legacy inferred access and absent requirements must not silently become declared contracts.

Persistent included/excluded requirements and unresolved custom obligations should travel with
the design. A chat turn's scope is only conversation metadata. Profile selection must be precise:
click duplication does not by itself introduce an upload/job lifecycle. More warnings or tokens
are not evidence of better architecture; compare applicability and request effort as well as
correctness. Extend bounded references/tools deliberately, with strict-schema headroom and
omitted/null/history checks, rather than expanding a deeply nested command union unchecked.

Capability intent, compatible-template availability and exact-runtime verification remain three
separate claims. Unknown critical contracts and required custom behavior block generation;
clean graph checks cannot waive them. Review the small foundation before expanding to video and
finite-stock checkout. New presets never authorize replacing the owner's older saved diagrams.

## 2026-11-07 scope follow-up: an explicit upgrade preserves uncertainty

A profile selection records intended included/excluded behavior. It must not manufacture owner,
API, failure or cache guarantees from familiar tiles. Keep finite conflicts and targeted custom
requirements visible and saveable; a required behavior outside the selected profile blocks that
profile. Preserve the original obligation if its target disappears, with a separate diagnostic.
Namespace profile/contract/finite/custom findings so equal display IDs cannot hide each other.

Preview a document-version change explicitly, keep legacy reads pure and allow one Undo across
the schema boundary. An older blueprint must refuse each semantic field it would lose; a newer
projection should expose unknown requirements without migrating storage. Scope-only chat changes
need the same review invalidation/repair budget as graph edits. Read-only preview remains useful
after repairs are exhausted. Persisted requirements and a chat turn's assumptions remain separate.
Measure additional prompt/tool/context bytes honestly; added declarations are no model-quality or
runtime proof. Preserve old as-run records when a deliberate context change invalidates replay.

## 2026-11-07 ownership and API-action follow-up

NC02 distinguishes a logical owner, its canonical API/worker roles and an optional deployable
assignment. Co-deployment supplies no permission. Resource authority, role grants and dependency
requests are separate declarations: an owner's read stays read, cache read and fill needs both,
and a foreign read must use a deliberate published contract or owned projection. Legacy inferred
writer metadata is retained and labeled separately. Missing operation/freshness/failure contracts
remain unresolved; these document checks do not establish runtime authorization.

An owner card is a view of canonical roles/relationships, not a stored duplicate or independent
service. Unsafe collapsed graphs expand roles rather than split the owner or weaken graph
validation. Review a permission transfer with named before/after, revoke and clear summaries;
put raw identities/JSON in optional details so a small dialog exposes the actual consequences.
Overview zoom still limits the old full studies; selected inspector/focus readability is a
bounded improvement, not owner usability acceptance.

The owner's [API action sketch](HUMAN_FEEDBACK.md#2026-11-07--api-readpublish-action-views)
suggests attached **Read counts** and **Publish view** operation views for the same Watch API.
Operations should explain responsibilities without inventing consume/produce services or
processes. Keep these distinct from the actor's lane actions. The sketch uses a data-return
arrow from counts toward its reader; the current canvas uses caller → target requests. A future
operation/data-flow view must state its convention and preserve canonical identity explicitly.
This is recorded NC03+ design input, not an NC02 operation feature or YouTube semantic rewrite.


## 2026-11-07 finite operation follow-up

An operation is a named responsibility of a canonical API, not another service/process. Give each
receiver/caller binding its own stable identity so one API and one relationship can support several
operations. Parent selection must not ambiguously select all operations; an explicit operation
selection travels to chat/history separately and survives role rename. Keep unknown refs honest:
validate their canonical graph references without applying the only known operation's semantics.
Known schema/auth/idempotency/deadline contradictions refuse; unknown exact versions/hashes stay
retained and unresolved. Contract identity hashes the actual schemas and behavior; changing
implementation availability does not change the contract.

A timeout or retry already represented elsewhere can contradict a new contract. Show that conflict
and let the person edit it explicitly; do not quietly upgrade old study settings. Idempotent replay
after expiry needs retained-result lookup before new-request freshness validation. Concurrent
transaction fingerprints may be invisible until commit: describe bounded serialization and unknown
outcomes, not an immediate pending-payload conflict or an invented lease machine. Static contract
checks prove none of this future runtime behavior.

The first Create link card/inspector/preview is a bounded application of the owner's API-action
sketch. It preserves caller → target arrows and canonical IDs, with the same logical owner. It
does not implement separate read/publish ports, returned-data arrows or change old YouTube names
into executable contracts. Full fitted overviews still need zoom and human usability review.


## 2026-11-07 resolve/cache contract follow-up

Treat internal positive-record caching separately from HTTP response caching. A no-store redirect
profile needs no-store on errors too: confirmed absence, expired records and dependency failure
must not become stale browser/CDN answers. Stable410 requires durable expiry evidence after
cleanup and forbids code reuse. Immediate create-to-resolve visibility needs a fresh primary,
not a replica promise hidden in an old module. Clamp each cache write to the immutable record's
remaining life and recheck expiry before answering, including after optional fill.

Bound fallback as part of the contract: one total deadline, phase caps and actual in-flight
primary admission. A timeout must not free a still-running query slot; cache read and optional
fill failures differ from primary failure. Static declarations do not prove cancellation, clocks,
TTL precision or adapter behavior. Validate relevant typed module intent through actual resource
and component links; an unrelated module on the same API must not force a new service. Several
operations need a truthful compact count, individual inspector selection and optional unspecified
global timeout when exact per-operation deadlines differ. Retain unknown siblings visibly.

## 2026-11-07 exact snapshot readiness

Show structural validity, complete declarations, implementation availability and exact output
verification separately. First-generation eligibility cannot require output evidence that exists
only after generation. A known authentication requirement is different from a concrete available
verifier. Exact known operations do not cover unrelated APIs/modules/resources or prose. Retained
idempotency results require explicit reads as well as writes; ownership/co-deployment supplies
no hidden permission. Preserve old write-only declarations as targeted incomplete intent.

Bind evidence conservatively to the entire semantic composition, including source names/prose
until a template input contract proves they are ignored. Pin the actual profile definition and
all artifact contents; a self-reported matching hash or verified flag is insufficient. A future
trusted registry must independently establish expected output and acceptance policy. Static
fixture checks of that boundary are not runtime proof. Keep the mouse report in the existing
inspector, with exact target buttons, rather than turning this distinction into a broad badge.

## 2026-11-07 narrow study and construction review

A new precise foundation needs its own ID/version and goal identity; changing the fresh default
must preserve old studies, saved selections and owner projects. Seed the entire versioned design
through one ordinary atomic edit, including explicit upgrade/scope/authority/operations, so the
chooser cannot silently drop semantics introduced after graph storage. Test failure, disk reload,
loss-refusal and one Undo at that boundary; reuse the complete seed in eval plumbing too.

A small owner card can make two responsibilities readable without extra services: Create/Follow,
Links, authoritative database and positive cache; expansion reveals the canonical API roles.
Actual blank mouse construction plus scripted ChatService with the same deliberately chosen
identities can verify exact semantic blueprint/report parity. This is not model design-quality or
runtime evidence. Visible exclusions and unresolved required extras remain necessary.

When explicit authority and access exist, topology warnings must use the valid declaration facts.
Do not add fake legacy writer metadata to silence a false warning or turn a read into a write.
Legacy fallback is useful for old designs, but presenting its “no owner” and “Other readers” as
an unqualified second explanation below explicit authority is confusing. NC14 should review a
labeled disclosure; an explicit API responsibility's generic “Microservice” kind label is another
bounded clarity issue. Coordinator review of readable views is not owner usability acceptance.

## 2026-11-07 independent narrow-contract review

When explicit authority, grants and dependency requests exist, make those facts primary throughout
the inspector. Keep preserved legacy writer inference and its editor together in a clearly labeled,
closed disclosure; unqualified “no owner” or “other readers” below an explicit owner is a conflicting
explanation. A declared API/worker role is a responsibility within one owner, even when its tile
kind is Microservice and it shares a deployable. Qualify legacy relationship inference too. Keep
schema2 inspection and canonical identities intact; demonstrate mouse edit, Undo and reload rather
than hiding or fabricating legacy metadata.

A pinned verification descriptor containing case names identifies only those names. Separately
pin and hash-resolve actual self-contained executable test/runner/fixture/config/dependency bytes;
fail old weaker formats closed. A trusted publisher/runner must independently establish bundle
completeness, expected output and provenance. Opaque positive fixtures prove only trust plumbing.
Exact templates must consume only the semantic subject, not excluded project/UI metadata. Source
validator row indexes are not sorted export indexes: preserve canonical targets and document the
basis. Exported mutable objects must not alias saved declarations and bypass revision/history.

The [NC14 ledger](plans/reliable-foundations/nc14-review.md) keeps remaining owner usability,
YouTube/Marketplace domain questions and intended-model evidence open. The separate
[backend proof plan](plans/reliable-foundations/backend-first-proof-plan.md) is deferred: reviewed
finite templates/assembly, real auth/HTTP/PostgreSQL/Redis and exact-output fault evidence first.
Regeneration must preserve custom-owned files and refuse edits to generated-owned files; reserved
extension space cannot silently acquire the narrow profile's verification.

## 2026-11-07 field-project learning before template certification

The owner selected [iterative YouTube field projects](plans/reliable-foundations/youtube-field-project-plan.md):
start with today's diagram, commit real generator output, then complete and record the custom
application work. Preserve that baseline before extracting improvements into Jeeves and generating
a fresh later version. Avoid making every possible reusable abstraction a prerequisite for v1.

Treat new tiles as one possible answer to observed friction. The right change may instead be an
operation view, module, contract, configuration field or template. Record the problem, source
diagram/code, another plausible use, decision and later result. Proposed reuse is a hypothesis
until a field project supplies evidence; a handler is not automatically a new service/tile.

Compare the same observable features and remaining custom effort. Generated scaffolding, copied
dependencies and renamed custom code must not inflate functional coverage. Record generated
repairs and investment in Jeeves separately, along with model/environment/scope changes that can
affect the comparison. Keep failed approaches and rejected ideas in the decision trail.

Heavy template certification is deferred while interfaces iterate. Lightweight build/start/flow
checks establish only observed smoke results. Experimental partial output needs an explicit gap
list and cannot weaken the strict compatibility report or become verified runtime evidence.
Promote concise, applicable field lessons into actual chat context/tools and evaluation cases;
archiving a retrospective does not by itself change assistant behavior.

## 2026-11-07 diagram snapshots as field-project evidence

Pair each intentional architecture or adopted presentation change with an immutable diagram
image, editable source and renderer identity. Retain the original before changing a field
baseline. A clean full-diagram export supports architecture comparison; a standard-size studio
screenshot additionally shows controls, layout and readability. Preserve both when UI changes.

Source equality does not establish visual equality: layout hints, fonts, owner expansion and
renderer changes can alter the picture. Record these capture inputs and retain earlier renders.
Image export must not mutate the project or the user's camera, focus and selection, and a focus
filter must not silently omit relationships from a purported full-diagram export. Treat images
as review evidence alongside the machine-readable source, not as substitute generator contracts.


## 2026-11-07 diagram export implementation lesson

Freeze the live resolved board rather than rerunning layout for a snapshot: previous positions
are stability hints, so equal source alone need not reproduce placement. A full logical view can
preserve owner collapse if it says so explicitly and retains every projected relationship. Keep
focus and editing chrome out of the capture without changing the user's interactive view.

Inspect the downloaded raster itself. SVG route DOM can exist while rasterization loses every
stroke: deep SVG cloning must retain the board's CSS variables and usable SVG viewport extents.
Font embedding and light-theme overrides also need to survive serialization and dark root styles.
A small route-ink regression plus source/view checks addresses this observed failure without
turning experimental diagram capture into broad pixel certification.

## 2026-11-07 local field-source consistency

When adapting a saved design to a small local deployment, preserve the original cloud/scale
intent first and use a separate named copy. Change unsupported capacity/provider settings
explicitly or report the exact source paths; a local proxy/cache is not a global CDN, and
resource credentials do not implement a declared workload identity or TLS boundary.

Review structured settings and assistant-facing prose together. The YouTube local copy changed
SQL read routing to primary while two module descriptions still said replica; snapshot 005
corrects those descriptions and names the Local video edge. Equal PNGs can hide real settings
changes: preserve source hashes and inspector evidence as well as clean diagram images.
These are source/provenance lessons, not runtime validation or measured chat-quality gains.

## 2026-11-07 partial export source and draft boundaries

A frozen experimental profile must check the selected saved source before offering its output.
Keep an exact copy's selected project separate from the archive's frozen origin, and refuse a
changed or unsupported canvas rather than silently substituting historical inputs. Present useful
foundations, unfinished behavior and unsupported intent separately from strict compatibility.
Local provider normalization does not erase remaining language, TLS or service-identity gaps.

Generation guards must consider every dirty/pending draft, including invalid values. Jeeves'
general toolbar draft flag deliberately excludes validation errors for its existing history
behavior; reusing it alone left the new export trigger enabled. Use an export-specific guard,
then recheck source/current project after asynchronous work. Preserve the failed mouse result
and the corrected presentation; this observation adds no application-runtime or chat-quality credit.

## 2026-11-07 custom field ownership and role-title observation

The first custom YouTube authority edit exposed an existing finite outbox check: a publisher
module needs its own explicit database module link, even when its host already has a metadata
relationship. Preserve the intermediate finding and add the concrete link; host membership is
not a substitute for the declared dependency. No new outbox capability or template was inferred.

A native export/studio review of the expanded Video roles found “Upload & status API” clipped
beside the role subtitle. “Upload API” fits better; its Purpose retains status responsibility.
Use concise tile names and keep detailed responsibilities in the inspector. The fitted overview
still has small text, and the collapsed workflow cycle still uses the existing expanded fallback;
this naming correction does not establish full owner usability or require split authority.

## 2026-11-08 derived publication and observed playback

A derived search index should consume committed public lifecycle facts. Processing completion
alone cannot establish public visibility: the YouTube field app's indexer has no metadata grant,
consumes only committed publication, and repeats the same versioned document. Keep public search
fields explicit and refuse incompatible existing mappings without resetting data.

Engagement events need an observed interaction policy separate from reads. Video details, search
and segment delivery do not prove playback. The field app counts short advancing media samples,
retains one event ID across retries, and commits a receipt with the increment. Cached metadata
must not hide fresh totals. A test harness also needs observable timing: Chromium's lifecycle
freeze command did not suspend active-media callbacks; a measured main-thread block did.
[Bounded evidence and limitations](../field-projects/youtube/v1/notes/evidence/fp07a/README.md)
support these app-specific lessons, without promoting a general template or capacity claim.

## 2026-11-08 independent field walkthrough and regeneration boundary

Run the final tracked field app outside the checkout with its own frozen dependencies and a
fresh named runtime before calling the local flow independent. Browser operator tooling can
come from the repository if that boundary is explicit; the application must not depend on the
studio/server. Prove normal restart with unchanged credential and volume identities and retained
ready/search/count data. Isolate resource cleanup by exact project and include application
profiles: default-profile Compose down can leave profile containers behind.

Map a successful processing fact through authoritative lifecycle commit to a public projection;
review that flow separately from transport arrows. Shared orthogonal trunks, long return paths
and small fitted text can obscure read/write direction even when the topology is correct. A
focused operation view or concise relationship labels may help; new service tiles/renderer work
need an observed design reason. [FP07b review](../field-projects/youtube/v1/notes/review-pack.md)
keeps these candidates separate from shipped changes.

A deterministic frozen-profile export and a separately completed custom app prove different
things. Generated-helper edits, owned extensions, migrations and custom files need an explicit
preserve/regenerate/conflict strategy before diagram-to-app repeatability across iterations can
be claimed. Classify baseline foundations, custom business implementations, integration and
helper repairs separately. File counts and completed-scenario counts do not measure effort saved.
Retain failed harness assumptions; decoded PCM is not human listening, and a controlled hidden
signal is not an actual OS background-tab observation.

## 2026-11-08 template controls and field extraction review

The [YouTube v2 review](plans/reliable-foundations/youtube-v2-review.md) traces the 5.53%
backend baseline to working behavior missing from generated shells, especially owned upload,
lifecycle/publication and media processing. Extract concrete behavior with its persistence,
contracts and resource wiring. Another field use is a hypothesis to exercise through the same
typed input path; repackaging one exact application does not demonstrate configurable reuse.

Before adding a normal inspector control, identify its template consumer, affected emitted
behavior and why an existing default/setting is insufficient. Copying a value into JSON is
not enough. Keep unsupported old intent readable without silently substituting an implementation.
The owner's requested generation-focused normal UI needs matching mouse/chat support rules;
React-only hiding leaves unsupported choices available through chat. Detailed v2 UI policy is
pending the owner's answers in the review.

Logical ownership can be useful generation input without repeated role/deployable explanations
on tile faces and above every settings form. Keep committed-publication ordering and explicit
access; simplify presentation separately. A collapse action that immediately falls back to
expanded roles should not remain an apparently effective action. Preserve canonical graph
identity rather than splitting owners to satisfy a view.

## 2026-11-08 owner decision: reuse and necessary controls

The owner accepted generic foundations plus video templates: a product page, social app or
existing service may need video without becoming YouTube. The [v2 plan](plans/reliable-foundations/youtube-v2-plan.md)
requires the same implementations to support a small attachment composition without YouTube
search/count dependencies. Keep product associations, eligibility and other business policy in
narrow adapters. Other use cases motivate an interface; they do not justify building those
products or a universal workflow language now.

A normal control must both affect an implemented template and express a useful user decision.
Necessary internal schemas/identities/grants/policies stay in typed source/template data;
their existence does not justify displaying or configuring them. Do not move removed clutter
into an Advanced editor. The 60% template-share goal is eventual across field projects; v2 must
improve on its actual v1 backend baseline of 5.53% without padding or changing scope.

## 2026-11-08 process-first authoring and read-only source diagnostics

The YV2-18 normal-viewport review found that the selected cache's TTL followed an owner banner,
strict report, authority/grant narration, manual ownership/operation actions and focus control.
The same useful field now follows its name/kind/tabs directly. Canonical service/worker tiles
also retain recognizable icons and names when an owner has one role or cannot safely collapse.
Do not replace a process with an owner card merely because ownership data exists.

Keep internal permission/deployment facts and strict source reports in explicit read-only export
diagnostics. Removing normal forms must preserve every source declaration, validation refusal,
precise removal preview and Undo/reload behavior. In this review, whole-document comparisons,
exact source downloads and native capture hashes preserved that distinction at both 1280×800
and 1440×900; mouse TTL/HTTP/SQL/worker edits stayed usable. This proves the reviewed controls
and snapshots, not owner acceptance or strict runtime certification.
[Evidence](plans/reliable-foundations/evidence/youtube-v2/yv2-18-clarity.md).

## 2026-11-08 compiled consumer reuse evidence

Exercise shared mechanisms through an unrelated small consumer with its own resource authority,
SQL relations, namespaces and metadata codecs. A renamed full application does not establish that
boundary. In YV2-20, the same upload/job outbox/media/result receipt engines produced a ready product
attachment without YouTube/search/count source or runtime grants. Keep product association and
wire mapping in the narrow compiled adapter; preserve the unbound base pack's required hooks.

Keep a proof runner's transport failure separate from the mechanism it already exercised. The
attachment's transfer/encode/ready commit passed before Node fetch ignored an explicit website
Host header. Correcting the adapter and re-reading the retained result was enough to verify that
failure; repeating an unchanged provider/media run would add no evidence. [Bounded evidence](plans/reliable-foundations/evidence/youtube-v2/yv2-20-reuse-and-freeze.md).

## 2026-11-08 standalone browser identity allocation

A copied app must derive the public browser issuer/client/callback from the same generated identity
and port allocation as provider setup and backend validation. In YV2-23 the exact completed source
ran on fresh ports45410–45412, signed in with real PKCE and restarted with retained credentials/data
without source edits. Public binding serialization stayed separate from backend authentication
policy. [Independent evidence](plans/reliable-foundations/evidence/youtube-v2/yv2-23-independent.md).

## 2026-11-08 generated provenance and runtime visibility

Report generated provenance separately from generic reuse. A complete product recipe can emit
all measured backend source while including product-specific policy; scripts, SQL and edge
integration may sit outside that measure. Demonstrate reuse with changed metadata, resource
bindings and a second consumer, and state what that consumer still requires. The
[completed v2 review](plans/reliable-foundations/youtube-v2-provenance-review.md) confirms exact
generation while identifying 1,139 explicitly YouTube-specific measured lines and custom
integration outside the denominator.

An optional developer view should report observed backend facts, with component and operation
identities, instead of inferring execution from a browser request or drawing. Separate attempted
work, transaction commit, message delivery and downstream visibility; show unknown states honestly.
Keep it off by default, read-only and bounded. Prefer shared diagnostic hooks over per-product
instrumentation, and preserve business behavior if diagnostics fail. This is a proposal from
the review, not an implemented diagnostics feature.

## 2026-11-08 reusable baseline precedes application completion

For the owner's field-project measure, generate and freeze reusable mechanisms/domain features
before implementing product policy, API adapters and service wiring. A template containing one
finished product does not establish reusable credit merely because it emits that code. Keep
Docker, edge configuration, UI and tests excluded as requested; the correction is baseline
eligibility, not a broader denominator. The v2 plan scheduled YouTube implementation before the
baseline and therefore measured unchanged product code as generated.

Preserve historical reports when correcting this ordering. Re-export the same saved diagram with
product implementations removed, record exact output/manifest hashes, and label comparison with
an already-completed app as retrospective. Do not call it newly observed post-generation work.
Known historical product declarations can remain readable as explicit custom gaps without being
offered as installed features. [Correction and evidence](plans/reliable-foundations/youtube-v2-generic-baseline.md).

## 2026-11-08 owner review: show modules where their arrows attach

The owner sketched YouTube v2's Video lifecycle worker as a container of its modules:

- Processing consumer, fed by Processing events;
- Lifecycle writer, writing to the Metadata database;
- Publication outbox publisher, writing to the Metadata database and publishing to Publication
  events.

The saved module links already record exactly these attachments, so a view-only Detailed mode can
draw them without changing the design. Inspector lists that repeat the arrows in words (Connections
tabs, focus lists) make the reader do more work and go stale when the drawing changes. Keep the
detail on the selected line instead. A mode the reader must remember to leave, such as Focus
relationships, is worse than a highlight that ends when the selection ends. Avoid tabs when the
rail has room for one page. [Plan](plans/ui-overhaul/units.md).

## 2026-11-09 UI01: trace by selection, not by a focus mode

At the owner's request, Focus relationships is gone: the inspector's button and list, and the
canvas strip with its counts, Fit focus and Show all. Tracing now uses selection only. A selected
tile's lines turn blue and are drawn over the rest; a selected line is drawn on top with its
label in the inspector and its X; **Choose relationship** still resolves overlapping routes.
Nothing is hidden or dimmed, so the reader never has to find a control to get the full drawing
back: the highlight ends when the selection ends, and clicking empty paper restores the plain
view. A filter that outlasts the selection that made it leaves the reader looking for a way back
(the owner found focus hard to turn off); tie emphasis to the current selection instead.

## 2026-11-09 UI02: one inspector page, with the name as its title

The tile and system inspectors are one scrolling page in the owner's sketch order: a header (kind
icon, Name, kind, the tile's warnings), Description, Options only when it has fields, then
Modules only when there are any. Without tabs, nothing waits behind a label the reader has to
guess, and the rail's empty space holds the fields. The Name is an input styled as the title, so
the name appears once and edits in place; a heading above a Name field said the same thing twice.
Leave out a section that would be empty instead of printing "none". The description box grows
with its text to half the rail and then scrolls, so a long description reads without dragging
and still leaves room for Options and Modules. A word shown to the reader may differ from a
definition's label when that label is also chat tool text: the page says Description, while chat's
`describeStudioDefinition` keeps "Purpose" unchanged.

## 2026-11-09 UI03: modules are cards you open and leave with Back

A tile's modules sit at the bottom of its page as a stack of cards: the module's icon in its
family colour, its name, its kind and two lines of its Description, so the reader can tell the
modules apart without opening each one. The whole card is one button. Opening it replaces the
tile page with the module's own page, laid out like the tile's (header, Description, Options) with
a **Back to <tile>** row above it and **Remove module** last; it lists no links, because the
drawn lines carry them. Two details make drill-in feel cheap: each page starts at its own top (a
page that inherits the previous page's scroll opens halfway down), and Back lands on the Modules
section rather than the top of the tile page, so the reader picks the next card where they left
off. The open module belongs to the workspace's selection, not to the rail, so any other selection
closes it and the canvas can show it later.

## 2026-11-09 UI05: module rows draw their own lines, but one band still shares a bus

When two rows of one tile link to the same store, ELK would bundle both lines into one bus at the
store's port, so the reader sees one line leave two rows and cannot tell which row goes where.
In a banded layout the board now gives each named source port its own ELK port into a store's
default port, so the two lines turn in their own slots and meet only in the last 32px before it. It does not make that a rule
between every pair of lines: a store several rows and tiles write (YouTube v2's metadata database
takes five module lines) cannot have every pair meet only in its last 32px, so lines of one band
may still share a run, as in Overview. Two rows of one tile that both come back to an earlier
store currently cross each other's U (see the [UI05 handoff](handoff.md)); check it on the
detailed view before tuning anything else.

## 2026-11-09 UI07: a second view of one design keeps the reader's place

The Detailed view redraws the same design with containers and module lines, so it must never
feel like another document. Four things keep the reader's place. The toggle is a view preference,
saved in the browser per project and never in the design, so toggling adds no history step. The
selection carries across: one relationship drawn as several module lines is still one selection,
and all its lines turn blue (the clicked one carries the X), whichever view or panel selected it.
Each view is laid out from its own last positions; hinting the Overview with Detailed's positions
changed the Overview of all four test designs (UI06), so switching back after an edit would not
have found it as it was. The switch keeps the old picture until the new one is laid out, then moves every tile
however far (a jump would lose the reader), lets lines that only the new view draws follow their
moving tiles, and fits last. At the fit, module names are too small to read (YouTube at 0.34,
v2 at 0.30); the view is for zooming into a part, and the [UI07 handoff](handoff.md) lists what
still reads badly there.

## 2026-11-09 UI08: an open module shows its own lines, not its tile's

A module's row and its inspector card are one thing, so opening either marks the same place on the
canvas. Marking the module's row alone was not enough: the host stays selected (its pull tabs and
X still work), and a selected tile turns all of its lines blue, which hid which ones the module
uses. The board now keeps the tile selected but leaves its lines plain and colours only the lines
drawn from or into the module's row, so the Packager shows one line where the Transcoder shows
five, and not the Thumbnailer's line of the same relationship. Links between modules of one tile
have no arrows; marking the partners' rows with a lighter border shows them without drawing
inside a 32px row. The open row needs a fill and bold text, not just a border: a blue border alone
read the same as its partners' in dark mode. Marks are live view state, so they come from the
canvas, never from the tile face an export draws.

## 2026-11-09 UI09: modules read when their lines reach them, not when they are bigger

The readability pass changed only faces and CSS; every layout, and the Overview export, stayed
byte-identical. What made a container read at 100%: rows framed as clear boxes (a 50% line-colour
border, not 30%), a neutral header divider in the line colour rather than a faint family-colour
rule, 14px row names like a tile's, and **port marks**. A line ends at the container's frame, 10px
from its row's box, so it looked as if it hit the container at about that row; a short stub in the
line's colour from the frame to the row makes the attachment explicit, as the owner's sketch draws
it. Marks must hold in both themes: a partner row needs a tint as well as its border, and the
dark paper needs a stronger open-row fill (55% against 32% on light). Chrome must stay off the
content it serves: a selected container's pull tabs now sit outside its frame, beside the rows
instead of over their ends. Bigger geometry does not buy readability at the fit: a 64px row pitch
(with a 32px header) made YouTube 1,920×1,984 instead of 1,920×1,600, so the fit drops by about a
fifth and every other tile reads smaller, while 224px containers saved only 96px of YouTube's width
and cut "Publication outbox publisher" short. The fit is for the shape; reading the rows takes
about 0.6. What still reads badly is layout, not faces: a row's line to a store upstream loops
round its container (v2's Video lifecycle worker to the Metadata database, 1,280px and 1,312px,
where the sketch has two short lines to a database on the right), two rows into one store can
cross, and **Choose relationship** lists one relationship once per drawn line. A form inside the
inspector should look like its other sections: the system page's feature fieldset now has the
Options/Modules heading, field and button styles instead of the browser's.

## 2026-11-09 UI10: a choice offers distinct outcomes, and a mark follows what it marks

The independent review of the UI overhaul found three small faults, all in places where a view
detail stood for something else. **Choose relationship** listed one relationship twice, once per
drawn line, and both entries did the same thing. A chooser should group by what each entry selects
and ask only when the outcomes differ, so a click where only one relationship's lines meet now
selects it directly. **Port marks** turned blue only when their own container or module was
selected, so they stayed dark beside a line that another tile's selection had turned blue. A mark
that continues a line must take the line's state from any cause. The **toolbar** gained one
switch and wrapped onto two rows at common window sizes: centred with `left: 50%`, it could use
only half the canvas. Give a centred floating bar its own width (`max-content`). The review also
found that a scripted click can read a line while the layout is still animating after `ready`.
Positions are final only once they stop moving. [Review](plans/ui-overhaul/review.md).

## 2026-11-09 MA02: a mark shows only what was opened

UI08 gave the rows an open module links with inside its tile (its in-process partners) a lighter
border. The owner found that confusing: other rows lit up for a reason the canvas never shows,
since links inside a tile have no arrows. Opening a module now marks only its own row and its own
drawn lines. A relationship with no drawn form should not appear as a highlight; if one matters,
draw it first (MA06's Cache reader loader arrow) and let it take the selection with its line. Kind
descriptions follow the same restraint: one short sentence of purpose ("Reads and writes one
database."), with no mechanics such as pools, tiers or resilience settings.

## 2026-11-09 MA03: a gesture's direction is the link's, and a refusal must be seen

Linking moved from a tile's attach tab into **Connect** mode: drag from one tile to another. The
attach tab tried both directions and silently made whichever the rules allowed, so dropping a
store on a service quietly drew service → store. With a drag the hand already says which way the
arrow points, so the line runs from where the drag started and a refused direction is refused
with its reason, never reversed: the user learns the rule ("A database can't link onward")
instead of getting a line they did not draw. Show the reason where the eye is (a tip at the
pointer over the faded tile) and again where it stays (the notice on release). That notice must
sit above the canvas's own overlays: the line legend hid the start of every notice, so a short
refusal and its dismiss button were invisible. A mode is view state, like the view toggle: it
never reaches the design, history or blueprint. And a mode for one job removes the controls of
another: in Connect mode tiles show no pull tabs or X, a press-and-drag on a tile links it, a
click still selects, and the line under the pointer offers its own X, so removing a link needs no
selection first.

## 2026-11-09 MA04: offer kinds, not types with hidden defaults

The old fan offered seven tile types and picked each type's kind for you: a Service after a queue
quietly became a worker, and a Worker, Search index, CDN, Identity or Uploads could not be chosen
at all. The link fan now offers the eleven kinds themselves, each with its own icon and name, so
what you pick is what appears and no rule has to guess. Eleven icons on one arc grew to a 640px
sweep, so the fan became a grid on one panel, a row per group (application, data, messaging,
edge), with every item captioned and greyed in its own slot where the rules refuse it. A panel
under the items matters: without it the translucent items let the tiles below show through and
the captions blurred into the diagram. In a narrow canvas the panel moves aside as one block and
may cover its own tile; rows stay rows and every item stays reachable, which matters more than
keeping the source in view. Removing insert-before also freed the tile's left side for modules.

## 2026-11-10 MA06: say what a choice will become where it is made

The module fan could have captioned each kind with its catalog label (a Cache reader "leads a
template"), but in a Worker that template is not allowed and the module could only ever be a
stub. A caption is a promise about this tile, so the fan works it out per host: Template, Part of
a template or Stub, a row each, with the one-line purpose in the tip. The module's page then says
what it generates now (the template's name, or Stub with what is missing) in one short line, so
an unconnected module reads as a normal, unfinished state rather than an error. Connections start
at the thing being connected: a module's dot, not its whole row, so a drag from the rest of the
row still links the tile and both gestures keep working; a module that can't connect simply has
no dot. The provisional line leaves the dot the hand is on. Only one link between modules of a
tile is drawn, the Cache reader's loader, as a short gutter arrow: one visible link that decides
generation beats several hidden ones that might.

## 2026-11-10 MA09: rebuilding by mouse finds what single-feature tests miss

Rebuilding YouTube v2 from a blank project by mouse took 262 gestures and worked, but only after
a fix no single-feature test had needed: a greyed kind's tip hung over the kind below it and took
the pointer, so moving straight down from Queue or topic onto CDN picked nothing. Anything that
only informs (a tip, a reason, a label over the board) must let the pointer through. Three more
lessons the whole build shows: a drag handle needs a size that survives zoom, because a connect
drag doesn't pan, so both ends must fit on screen, and at v2's fit a module's dot is 2.5–4.5px;
names typed after creation should reach what is generated, since IDs fixed at creation from the
kind (`worker-service-3`) otherwise name the code and stubs; and a control that appears only once
its template derives (a tile's Options) makes the order of steps matter without saying so. Most of
the effort is typing (74 of 262 gestures are names, descriptions and values), so the fewer fields a
new box needs, the faster a design is rebuilt. An acceptance test that rebuilds a real design end
to end, then diffs it by name against the original, is worth its length: it caught the fan defect
and proves equivalence where per-feature tests can only sample.

## 2026-11-10 MA10: a reason says what is, in the reader's words

A status reason is read as advice. "Needs Multipart uploads in its tile." on a View publisher in
a watch service told the reader to add an upload module that had nothing to do with it; the
truth was only that no template there uses it, which is a normal state for a stub. Say what is
("No template in Watch API uses it."), and say "needs" only for what the module itself is
missing. A refusal or block should name the thing and the value the reader can find on the
canvas ("The link from Watch API to Metadata database uses Service identity, which its template
can't use"), and say when there is more than one, rather than pass on a checker's sentence
about presets and declarations. And every route that changes a derived state must re-derive it:
two older commands chat could still send removed a module without re-deriving, leaving a
template selected that the canvas could never produce. Where a command can't derive, normal
authoring should refuse it and name the one that does.

## 2026-11-10 TP02: a handle is sized on screen, and bounded by its neighbours

A drag handle drawn in board pixels shrinks with the zoom, so at a large design's fit it is a
speck (a module's dot was 2.5–4.9px). Size its hit area in screen pixels instead (at least 16px)
and leave the drawn mark small, so the canvas doesn't change. Where handles sit closer together
than that on screen (rows 32px apart are 7–12px apart at the fit), cap the area at the spacing so
neighbours meet halfway: a press then always takes the nearer handle, never the other one. A
drag whose end may be off screen needs the canvas to follow it: pan when the drag is held near the
edge, slowly at first, only as far as there is something to show, and keep the line's end under
the pointer, so a release lands where the user is looking.

## 2026-11-10 TP03: an identity follows the name the user gave it, until someone chose it

Generated names (processes, folders, SQL schemas, queues) come from IDs, so an ID taken from the
kind at creation (`worker-service-3`) outlives the name the user typed and leaks into the code.
Let an ID follow its name while it still has a form the tool made, its creation form or its
name's slug, and re-key it, with everything it names, in the same step as the rename: one Undo
step, every reference, derived facts re-derived. Never re-key what a person or a fixed example
chose (a study, a frozen design, a hand-written ID); there the rename changes only the name. A
re-key must be complete or not happen: walk the whole document afterwards for the old ID, and
refuse rather than leave half of it renamed. In an autosaving field, a clash is a field error
that waits for the next keystroke, not a failed save to retry, and the selection, the open page
and the field being typed in move to the new ID without remounting.

## 2026-11-10 TP06: a consumer that isn't written yet must still drain its queue

A runnable stub stack shows whether every tile and its queues are wired before any product code
exists, so a consumer whose handler is missing must not crash, block or loop. "Not implemented"
is a terminal answer: send the message to `<queue>.failed` on its first delivery, with the
reason in a header and one rate-limited log line, and keep consuming. Only real errors earn
retries, bounded and backed off, so one bad message can't pin a loop. A consumer's queue is its
input, not a dependency: draw it as the module's one consume link, and give each tile that must
see every event on a topic its own consumer tile, because consumers of one topic inside one tile
share that tile's subscriber queue and each event reaches only one of them.

## 2026-11-10 TP07: a link is a grant, and healthy means every store answered

Each link a module draws to a store already says what the tile may do there: read, write, both,
publish or consume. Provision exactly that, per tile and from the widest of its modules' links,
without asking again in a form: a login with no table rights for a database it only connects
to, a bucket key that reads or writes, the queue or the topic's subscriber. Ownership narrows it:
a store another owner's template writes is read only, through the views that owner publishes. A
store on a provider the local stack can't run is a visible gap, not a silent substitute. Then
make "healthy" mean "reached": one bounded startup check per client, with what its access
allows (a write-only bucket key can't list or head the bucket), so a process that is up has
answered every store it uses with its own credentials, and a wrong grant fails at start, not on
the first request.

## 2026-11-10 TP08: a running stack proves wiring up to the first unwritten hook

Running every tile of a design built from modules shows that each process starts, reaches its
stores and answers, but each request or message stops at the first product hook its handler
reaches: every upload route at `principal`, every cache read at `key`, each worker at its codec.
Five of 37 hooks were reached; what lies behind them has never run in a process. So read a green
stack as "wired", not "works": fill hooks in the order a request reaches them and run again after
each, because each run then reaches one hook further. Make that order visible: name the hook in
every answer, and give the dead letter the same reason as the log line ("not implemented", not
"malformed" for a codec nobody has written). Make startup say what it checked, too: stub clients
log one probe line each, but template processes only said "ready", so their migrations, sweeps,
FFmpeg check and subscriptions had to be confirmed from the database, the broker and the source.

## 2026-11-10 V3-01: a key is its button's twin, and a check names its view

Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y, call the header's Undo and Redo under the same enabled state,
computed once for both, so a key can never do what its button would refuse (history busy, a
failed draft, Redo while an edit is pending). They leave fields to the browser's own text undo,
do nothing under any dialog, and stop the browser's default only when they act. The Hand tool
only repeated what dragging empty paper already did, so the tools are Pointer and Connect.
Detailed became the default view because it is where modules are seen and connected (the old
Overview is now Simple). That broke 19 end-to-end specs that had silently assumed one plain tile
per element: a click at a container's centre opens a module row instead of selecting the tile,
and Detailed draws more lines. Each now opens the Simple view by mouse first; a check should say
which view it was written for.

## 2026-11-10 V3-02: a line style means one thing, and the label says the kind

The owner read the legend's "Request" for every solid line and asked what a "topic" was. A style
in a legend is a promise about every line drawn in it, so define it by what the reader can check:
**solid** is a direct call where the caller waits (HTTP, or a database, storage or cache read or
write); **dashed** is a message through a queue or topic, where nobody waits. Name it by the
mechanism, not the protocol: a store read is not a "request" to most readers, and a worker's write
after its queue is still a direct call, so it stays solid. Then audit the drawings against the
promise (every line of the four studies now is, by test) and say where the rules still allow a
line that breaks it: the link table's direct async calls between applications would draw dashed
with no channel. Show only the style that needs explaining (Async); solid is the default reading.
A small grey kind label under each tile's name answers "what is this?" on the canvas, so a name
can say what the tile holds ("Metadata", not "Metadata database"); keep names unique even when
two tiles hold the same thing (Metadata the database, Hot metadata its cache). A channel's label
is its mode, Queue (each message to one consumer) or Topic (a copy to every subscriber), because
that difference, not "channel", is what changes the design.

## 2026-11-10 V3-03: put an add button where the thing goes, and never open over it

A drag-out tab for adding modules sat outside the tile, on the side its lines come in, and had to
be pulled to show anything. The owner's sketch put a **+** inside the frame, under the rows it
adds to: the button reads as "one more of these", in place, and a click toggles a menu instead of
asking for a gesture. Show it on every container in Detailed (an empty Service becomes a
container holding just the +, so where modules go is visible before there are any), only on the
selected tile in Simple (a 128px face has no free bottom; its top-left corner is clear of the
icon, name, label and warning), and in the inspector's Modules section, with the same menu and the
same command, so no path can offer a different list. A menu or fan opened from a tile must sit
**beside** that tile, never over it: try the natural side, then left, below and above, and only a
canvas too small on every side may cover it, as little as it can. Group the menu by what each
kind will become in that tile (Template, Part of a template, Stub), as the owner reads it, and
give each kind its one-line description in full: a menu at screen size has room a fan's caption
did not. Click-away, a second click, the wheel and Escape all close it, and none of them changes
the design.

## 2026-11-11 V3-05: a writer owns its tables, and readers see only what it publishes

Give each module that writes a database its own schema and its own SQL file, and let the others
on that database read only the views it puts in a shared `published` schema. The writer's tile
alone uses its tables; every other login gets SELECT on `published` and nothing else of the
writer, so a reader can't come to depend on a private column, and the cache read's loader reads a
view, not a table (a Docker run showed `permission denied for schema m_item_writer` for the
reader and the record through its filled `load`). Template tables stay their templates': the
product file reads them, never creates them. Because completion edits the file between runs, the
file runs at every start rather than once, so it must be re-runnable, and that has a trap: `CREATE
OR REPLACE VIEW` may only add columns at the end, so an edit appended below an older, narrower
definition of the same view applies once and then fails the next start. Keep one definition per
view and edit it in place. A failing file must roll the whole database back and name itself, so
nothing half-applies. Who writes comes from the links and ownership, not a form: a store another
owner holds is read only, even when its link draws a write.

## 2026-11-11 V3-06: sign-in is one template per tile, and what needs it says so

Who may call a tile is a decision about the whole tile, so make it one module with one setting:
an Auth guard connected to an Identity leads its own sign-in template, and its **Sign-in** is
Required or Optional. Every module route of the tile passes through it, so a stub written later
can't forget to check, and it hands each route its caller (signed in, or anonymous). Optional
still refuses a token that fails verification: an expired session must be noticed, never counted
as anonymous. A template that needs signed-in callers (Multipart uploads, Favorites next) doesn't
bring its own verifier; it needs the tile's guard set to Required and says so in plain words while
it isn't ("Needs an Auth guard set to Required in Upload API."), and flipping the setting
re-derives the tile in the same Undo step. Templates that share tables share hooks the same way:
an upload's `reserve`, `complete` and `closed` are the lifecycle's that names it, built from the
lifecycle's own hooks file, so nothing is written twice. On the canvas, `ready` holds when the
layout lands, but tiles still animate and the camera may move; at a fit a tile can be 28px across,
so a scripted drag must wait for a still board and release only once the board marks the target
under the pointer.

## 2026-11-11 V3-07: a generic capability keeps product policy in one hook

An account capability that more than one product needs (favorite videos, saved listings) is a
template with no product words in it: the table, the bounds, the routes and the paging are the
template's, and the one product decision, which items may be kept, is a single hook. Give that
hook its data through a link the user draws, not a setting: Favorites' **items** is a row-to-row
drag onto a Data access, like the cache's loader, and the hook reads that Data access's database
through what its writer publishes, so the product's tables stay private. Put the bounds in a
policy record (200-character IDs, 1,000 per account, 50 to a page) and compile them into both the
runtime and the table's checks, so the two can't disagree; serialize one account's adds, or two
racing requests pass the bound. Ask the hook only where it decides something (adding), never on
check, list or remove, so an unwritten hook still leaves the rest usable. Watch the framework's
own limits: Fastify refuses a route parameter over 100 characters, so a 200-character ID needs a
wildcard route.

## 2026-11-11 V3-08: a running tile shows what it runs, and every subscriber gets every message

A control belongs wherever the generated code reads it. With Runnable processes on, a stub-only
Service still has a request deadline and an admission limit, and a Worker still has a loop
concurrency, so those tiles show Request timeout, Concurrency limit and Concurrency, empty but with
the value the process runs as the placeholder; a template that consumes them keeps its own
control, and turning the option on writes nothing. Search fed by events puts the product data in
one place: the Index writer's hooks hold the mapping, the document codec and the event, and the
Search query imports them, so the two can't drift; both processes create and check the index at
start, and until the mapping is written they stay healthy and answer "Not implemented". A
versioned upsert must treat an older version as done (OpenSearch answers 409), or out-of-order
events retry and pile up in `.failed`. Two modules in one tile on one topic each need their own
subscriber queue; sharing the tile's splits the events between them, which no reader of the
canvas expects. A reached unwritten hook is terminal at once: a retry can't write it. A CDN in front
of public storage is an edge route serving that bucket read only, typed by extension, sandboxed,
with the edge's own errors (missing key, a stopped process) answered as JSON whatever the path's
extension says.

## 2026-11-11 V3-09: put the knowledge in the tools, and let every change answer what is left

A long prompt asked the model to remember the lane rules, the link table, the module slots and
which parts make a template, and a cheap model still drew gibberish. The knowledge belongs where
the model reaches for it: a catalog that says what a module becomes in each tile (Template, Part
of a template or Stub), a compact design with each module's status and why, patterns that build a
playbook shape from a few names as one checked batch, a dry run, and a review returned with every
change. Patterns must send only what the mouse could send, step by step through the same builder,
so nothing a pattern saves is something the canvas couldn't make; reusing a tile by its name lets
patterns applied in turn compose (the seven give v3's 21 tiles and 26 modules). A review finding
is only useful if it names the tile or module and the fix, and a fix offered as commands must be
checked against the design first: a design that already breaks a lane rule refuses every new
link until the bad line is gone, so a fix that redraws a line must remove it first, and only when
that strands nothing. Separate what must be fixed from advice: a long line to a store written at
the end of a pipeline is worth a look, never a tile to shorten it. Measure the cost honestly: a
dry-run tool that repeats the whole command union doubles every request, so it takes only the
commands that change structure and statuses.
