# Jeeves catalog

What a design can contain. Every entry is design vocabulary: none has a template, runtime or
verification behind it. Exact fields and values are in [studio settings](docs/studio-settings.md);
the source is [`studio-definitions.ts`](packages/spec/src/studio-definitions.ts) and
[`studio-components.ts`](packages/spec/src/studio-components.ts).

## C1 context

The **system** (name and goal), **people** and **external systems**, with relationships between
them. Created from `+` handles on the C1 tab.

## Tile kinds (C2)

Fifteen kinds, each one immutable definition `studio-<kind>@1.0.0`.

| Kind | Name | Library group | Created at | What it is |
| --- | --- | --- | --- | --- |
| `service` | Microservice | Services | C2 | One independently deployed application. |
| `browser` | Browser app | Services | C2 | Browser assets, standalone or served by an application. |
| `worker` | Worker service | Services | C2 | A background application. |
| `gateway` | Gateway | Services | C2 | An entry point routing requests to internal services. |
| `billing` | Billing | Presets | C2 | One service with a payment provider choice. |
| `redirect` | Redirect | Presets | C2 | A public redirect service with lookup store and cache shortcuts. |
| `notification` | Notifications | Presets | C2 | One service with email delivery intent. |
| `identity` | Identity | Presets | C2 | One service integrating an existing identity provider. |
| `database` | Database | Resources | C2 or C3 | A logical store; engine and provider are separate choices. |
| `cache` | Cache | Resources | C2 or C3 | A logical cache with an optional TTL. |
| `queue` | Queue or topic | Resources | C3 only, owner required | One shared channel; C2 summarises producer → consumer. |
| `object-store` | Object storage | Resources | C2 or C3 | A byte store with access intent. |
| `search` | Search index | Resources | C2 or C3 | A derived search index. |
| `cdn` | CDN | Integrations | C2 or C3 | Content delivery in front of an application or object store. |
| `external-api` | External API | Integrations | C2 or C3 | An external integration boundary, named for the provider. |

Applications can also be created as members of a package. A resource created at C3 is owned by
the application or package it was created from.

A **package** groups two or more independent applications into an open frame at C2; it has no
language, provider or runtime. The **Service and worker** preset (Library → Presets) creates a
service, a worker and a package-owned work queue in one step.

## Components (C3)

Components live inside one application and reach other boxes only through an existing C2
connection.

| Kind | Name | Typical product |
| --- | --- | --- |
| `rate-limiter` | Rate limiter | Redis |
| `cache-reader` | Cache reader | Redis, Memcached |
| `id-generator` | ID generator | PostgreSQL, Redis |
| `redirect-responder` | Redirect responder | CDN |
| `event-publisher` | Event publisher | Kafka, Amazon SQS, Redis Streams |
| `event-consumer` | Event consumer | Kafka, Amazon SQS, Redis Streams |
| `data-access` | Data access | PostgreSQL |
| `auth-guard` | Auth guard | Identity service |
| `external-call` | External call | Any API |
| `custom` | Custom | none: project-specific logic described by a one-line purpose |

Browser apps host only auth guard, external call and custom components.

## Settings

Applications carry execution (Docker or managed), language, host, exposure and kind-specific
choices; resources carry engine, provider and technical options; every application and several
resources take optional performance intent (replicas, autoscaling, timeouts, concurrency,
partitions). Connections carry action, protocol, interaction, access, and timeout/retry where
applicable. All of it is listed in [studio settings](docs/studio-settings.md).

## Provider choices

Settings name providers as intent only: they create no box, credential, deployment or API call.

| Area | Choices |
| --- | --- |
| Managed hosting | Cloudflare Workers, AWS, Google Cloud, external |
| Browser hosting | Cloudflare, AWS, Google Cloud, external |
| Payments, email, identity | Stripe; Resend, Amazon SES; OIDC; or external |
| Gateway product | Envoy, Kong, NGINX, Traefik, Amazon API Gateway, external |
| Databases and caches | self-hosted, AWS, Google Cloud, Neon, Supabase, Cloudflare D1, Upstash (by engine) |
| Queues, object storage, search, CDN | self-hosted, AWS, Google Cloud, Cloudflare Queues/R2, Amazon S3/CloudFront, Google Cloud Storage/CDN, external (by kind) |

## Chat model providers

The design chat uses one provider and model chosen in Settings
([`packages/providers`](packages/providers/src/catalog.ts)):

| Provider | Credentials |
| --- | --- |
| OpenAI API | `OPENAI_API_KEY` or `openai.apiKey` in `~/.jeeves/config.json` |
| Codex | its own CLI login (`codex login`); Jeeves never sees the credentials |

## Study

**TinyURL** (`studio-tinyurl@1.0.0`) is the one study: a read-heavy URL shortener with a CDN,
cache-aside redirects, range-allocated IDs and asynchronous click analytics, using eleven
components. It is described in the [studio guide](docs/studio.md#the-tinyurl-study).
