# TinyURL studio study

Since SG04 (2026-11-04) the studio ships **one** study, TinyURL, as decided in the
[studio grid plan](../build-plan-studio-grid.md) (O6, §7). It is the fresh-install default, the
only entry under **New project → Architecture study**, and the only entry in
**Library → Examples**. Creating it makes a separate, editable project.

The fourteen earlier studies (Mattermost, Enterprise, Streamly, QRWTY target and original,
Links & QR, Community, Social, the Discourse/Vendure/Zammad references, Dropshipping, Inventory and
Grocery) were removed from the product. Git history keeps their factories and goal manifests, and
the [UX14a–UX14d evidence](../evidence/studio-ux/UX14a/README.md) keeps their records. Projects
already created from them stay in the database and still open; their saved origin now resolves
as an unavailable source rather than an error. The Resource workspace and QR Studio starters and
Blank architecture remain (plan decision D2).

| Level | Content |
| --- | --- |
| C1 | Link creator and Visitor use the TinyURL system, which checks destinations with the external URL reputation API. |
| C2 | Web app (web client), Shorten API, Redirect service, Analytics worker, CDN, Links database (PostgreSQL, two read replicas, partitioned by `short_code`), Link cache (Redis cluster, LRU), Analytics store (ClickHouse) and the URL reputation API. A **Link platform** group holds Shorten API and Redirect service. Click events is a topic queue, shown at C3 only (decision D3). |
| C3 | Shorten API: rate limiter (token bucket, 100 per minute per API key, Redis), reputation check (external call with a circuit breaker), ID generator (range allocation in blocks of 1,000, base62, at least 7 characters) and a link writer. Redirect service: link cache reader (cache-aside, in-process L1 plus Redis, negative caching, single-flight), a replica link reader on a miss, a redirect responder (302, 60-second edge max-age) and a batched click publisher. Analytics worker: click consumer (batches of 1,000, bounded retries), custom aggregation and an aggregate writer. |

It is also the read-heavy, low-latency example: about 100 reads per write, the CDN caches redirects
briefly, the Redirect service scales on requests per second, and clicks leave the request path
through the queue. A 302 rather than a 301 keeps every click reaching analytics once the edge
entry expires.

Sources: the [factory](../../packages/spec/src/studio-examples/tinyurl.ts), its
[goal manifest](../../packages/spec/src/studio-examples/tinyurl.goal.json) (pinned to the plan
file's SHA-256). The study stores no layout: the studio derives every position (SG06).
`architecture.studio.origin` records `studio-tinyurl@1.0.0` and the manifest hash. Its
[blueprint](../studio-blueprint.md) contains every service, resource, external, the group and
all eleven components, with nothing omitted.

This is a design study. Settings and components are design intent: no template, runtime resolver,
provisioning or verified behavior is supplied, and application generation stays rejected with
`STUDIO_DESIGN_ONLY`. Code generation is a separate future service that reads the blueprint.

Evidence: [SG04](../evidence/studio-grid/SG04/README.md).
