# Studio grid, C3 components and TinyURL build plan

**Status: complete 2026-11-04 (SG01–SG10).** Combined acceptance, known limits and owner follow-ups:
[SG10 acceptance record](evidence/studio-grid/SG10/README.md). No further unit is authorized.
Execution queue: [studio-grid execution units](plans/studio-grid/execution-units.md).

This plan follows the completed [studio UX plan](build-plan-studio-ux.md). Where the two conflict,
this plan wins once a unit is assigned. It does not start code generation, runtime templates,
P73a/P73b or the backend benchmark batch.

## 1. Why

After UX15 the owner reviewed the default studio (Mattermost and Streamly studies) and found it
hard to read. The diagnosis, from the studio source:

- The Mattermost study has only 14 connections. The studio draws one path per relationship, so
  parallel relationships between the same pair become stacked lines. Paths that cannot route
  directly are pushed into detour lanes above the whole diagram (`routing.ts` fallback lanes).
- The studio uses a custom strongly-connected-component layering (`studio/layout.ts`) and a custom
  router. The automation-illustrator repo (`~/github/automation-pitch`) gets compact, aligned boards
  from ELK layered layout on a 32px grid with merged edges and fixed ports. Jeeves already pins
  `elkjs` 0.12.0, but only the retired architecture workspace uses it.
- Free placement lets cards land anywhere on a 24px grid, so diagrams sprawl.
- Relationship labels are full sentences, truncated with an ellipsis.
- C3 is reachable only by double-clicking a service, by design (model contract §3).

## 2. Owner decisions (2026-11-04)

| # | Decision |
| --- | --- |
| O1 | C1, C2 and C3 are three equal tabs. C3 shows the whole system, not one service. Double-click drill-down goes away. |
| O2 | Layout is fully automatic, like automation-illustrator. No saved free positions. |
| O3 | Free placement is removed. New boxes are created by dragging from an existing box's handle, as in automation-illustrator. |
| O4 | Parallel relationships merge into one line per box pair and direction, with a count. |
| O5 | Generic services: API service, worker, web client, gateway, identity, notification, plus existing resource kinds. Settings must cover low-latency/high-throughput needs, preferring third-party or predefined components. |
| O6 | A TinyURL clone replaces Mattermost as the default study. All fourteen existing studies are removed from the product. |
| O7 | Diagrams expose a read-only API of the parts code generation needs. Code generation is a separate backend service, not built in this plan. |
| O8 | Lines are thicker; labels are shorter but keep intent. Disconnected islands are allowed. |
| O9 | V/H tool shortcuts restored (done, commit `4927583`). |

## 3. What each level means (recommendation, confirm D1)

The owner asked how C3 should relate to code generation. Recommendation: make each level map to
one kind of generated artifact, so the diagram and the generator never disagree.

| Level | Shows | Generator meaning |
| --- | --- | --- |
| C1 | People, the system, external systems | Project scope and external integrations |
| C2 | Each deployable service, browser client and resource. Related services sit in a labelled **group frame** | One C2 service = one generated service (folder, Dockerfile, config) |
| C3 | The same services as frames, each containing its **components**; queues; resources around them | One C3 component = one prebuilt template module with typed settings, or one stub slot |

Rules:

- **C3 components come from a finite catalog** (§5). Every component has settings or an extension
  stub. There are still no name-only boxes, routes, tables or business-rule editors.
- **A C2 box is one deployable.** A service is not "made of microservices at C3". A set of related
  microservices is a group frame at C2 (today's package, shown open instead of collapsed). This
  keeps "C2 box = deployable, C3 box = module inside it" true everywhere.
- **Custom logic** is a `custom` component: a name, a one-line purpose and its connections. The
  generator later emits an interface and stub for it (C4b). This is where project-specific code goes.
- Scalar service settings (language, replicas, timeouts) stay in the service inspector, not boxes.

This replaces the collapsed-package card and the per-service detail scopes of the model contract §3.

## 4. Canvas behaviour

**Layout.** ELK `layered`, direction RIGHT, orthogonal routing, `mergeEdges`, fixed WEST/EAST ports,
32px grid, node gap 32, layer gap 64, matching automation-illustrator's `elkGraph.ts`. C3 uses ELK
compound nodes (`hierarchyHandling: INCLUDE_CHILDREN`) so components lay out inside their service
frame. Disconnected islands lay out separately and pack left-to-right, top-to-bottom. Layout runs in
the existing worker. It is deterministic for the same design. Coordinates are derived, not stored.
The only stored layout data is optional ordering hints (which row a box sits in within its column),
which the user changes by dragging a box up or down inside its column. Tidy and free drag go away.

**Creation.** Hovering a box shows a `+` handle on each side, as in automation-illustrator. Dragging
it out opens a small picker of the kinds valid for that level and side. The new box and its
connection are created in one undoable action. The connection form opens with defaults filled.
Dropping a handle on an existing box connects the two instead. An empty canvas, and a **New island**
toolbar button, place one unconnected first box. Nothing else places boxes.

**Lines.** One line per ordered pair of boxes. Opposite directions are two lines, each one-way,
following [C4 notation](https://c4model.com/diagrams/notation). A merged line shows its count
(`3 calls`) and opens a chooser on click. Stroke width rises from today's hairline to 2px (3px when
selected). Labels use a derived short form: verb plus protocol, at most about 24 characters
(`reads · SQL`, `publishes · Kafka`). The full text stays in the inspector and export.

**Navigation.** Tabs C1, C2, C3. Selection persists across tabs by identity. The breadcrumb and
back button go away. Zoom changes text density only.

## 5. Component catalog and performance settings

Settings are finite unions, like the existing [configuration matrix](plans/studio-ux/configuration-matrix.md).
Third-party products are the primary implementation; Jeeves code only wires them.

**Service-level settings** (all application kinds): language, execution, `replicas` (min/max),
`autoscaleOn` (cpu, requests per second, queue lag), request timeout, concurrency limit.

| Component | Key settings | Typical third-party |
| --- | --- | --- |
| Rate limiter | algorithm (token bucket, sliding window), limit per window, key (IP, API key, user), store (memory, Redis) | Redis |
| Cache reader | pattern (cache-aside, read-through), L1 in-process size and TTL, L2 TTL, negative caching, stampede protection (single-flight) | Redis, Memcached |
| ID generator | strategy (DB sequence, Redis counter, range allocation with block size, Snowflake, random with collision check), encoding (base62), minimum length | Postgres, Redis |
| Redirect responder | status (301, 302, 307), edge `Cache-Control` max-age | CDN |
| Event publisher | target queue, batch size, linger ms, outbox (requires a database) | Kafka, SQS, Redis Streams |
| Event consumer | source queue, concurrency, batch size, retry limit, dead-letter queue | same |
| Data access | pool size, read routing (primary, replica), statement timeout | Postgres |
| Auth guard | identity provider, credential (JWT, API key, session) | identity service |
| External call | target external system, timeout, retries, circuit breaker | any API |
| Custom | name, purpose; generates a stub | none |

**Resource additions:** database read replicas and partition key; cache topology (standalone,
cluster) and eviction policy; queue partitions or shards and retention; CDN cache of redirects.

These are design intent. Nothing here claims a template exists (keep intent, availability and
verification separate, per [C4 modeling guidance](c4-modeling.md)).

## 6. Blueprint API (code generation boundary)

Add `GET /projects/:id/blueprint`. It returns a versioned, read-only JSON document
(`blueprint: 1`) holding only generation-relevant parts: system, services with settings, components
with settings, resources, external systems, and resolved connections (from/to identity, action,
protocol, interaction, channel use, timeout/retry). It omits layout, presentation, history and
studio UI state. A Zod schema in `packages/spec` defines it and exports JSON Schema. The future
generator service reads only this. The studio keeps writing through existing operations.

## 7. TinyURL study

Replaces every existing study. Target roughly 8 C2 boxes and under 12 C2 lines.

- **C1:** Link creator, Visitor, TinyURL system, URL reputation API (external).
- **C2:** Web app (web client), Shorten API, Redirect service, Analytics worker (worker), CDN,
  Links database (Postgres), Link cache (Redis), Analytics store (ClickHouse). Group frame
  "Link platform" around Shorten API and Redirect service.
- **C3:**
  - Shorten API: rate limiter, external call to the URL reputation API, ID generator (range
    allocation), and data access to the Links database.
  - Redirect service: cache reader (L1 plus Redis, single-flight), data access on a miss, redirect
    responder (302, short edge max-age), and an event publisher to the Click events queue.
  - Analytics worker: event consumer, custom aggregation and data access to the Analytics store.

It doubles as the read-heavy / low-latency example: about 100 reads per write, cache-aside, edge
caching and asynchronous click tracking, as in common write-ups
([oneuptime](https://oneuptime.com/blog/post/2026-03-31-redis-how-to-design-a-url-shortener-using-redis-i/markdown),
[tautik](https://tautik.bearblog.dev/url-shortener/),
[enjoyalgorithms](https://enjoyalgorithms.com/blog/design-a-url-shortening-service-like-tiny-url)).

## 8. Removals

- The fourteen studies under `packages/spec/src/studio-examples/` and their chooser entries.
  Git history keeps them. Existing projects already created from them stay in the database and
  still open; they are not deleted or migrated.
- Free placement tools, Tidy and fit, free drag, the 24px landing search and saved positions.
- Double-click drill, detail scopes, breadcrumb and back.
- The collapsed package card (replaced by an open group frame).
- The custom router fallback lanes, once ELK routing replaces them.

## 9. Open decisions

| # | Question | Default if unanswered |
| --- | --- | --- |
| D1 | Adopt §3: C2 box = deployable, related services in an open group frame, C3 = components inside. | Adopt |
| D2 | Do the Resource workspace and QR Studio starters go too? They are older, generation-capable starters, not studies. | Keep them; remove only the fourteen studies |
| D3 | Queues stay C3-only, as decided in UX. With merged lines they could also show at C2. | Keep C3-only |

## 10. Verification profile

Same as the UX cleanup: `pnpm lint`, `pnpm typecheck`, `pnpm --filter @jeeves/web build` and direct
browser inspection at 1440×900 and 1280×800. Unit/E2E suites stay owner-deferred. Each unit saves
before/after screenshots of the TinyURL study under `docs/evidence/studio-grid/<unit>/`.
