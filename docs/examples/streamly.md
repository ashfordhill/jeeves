# Streamly · video platform

An editable YouTube-style architecture study for high-traffic video discovery, playback,
creator publishing and moderation. It is the preselected study in **New project** and appears
under **Library → Examples**. Creating it produces a separate ordinary Jeeves project.

The [source model](../../packages/spec/src/video-platform-example.ts) owns the example.
This is our proposed architecture, not a reconstruction of YouTube's internal systems.
The public product inspiration is [creator upload/publish workflows](https://support.google.com/youtube/answer/57407)
and [video/channel discovery](https://support.google.com/youtube/answer/58097).

## Walk through the design

| View | What to inspect |
| --- | --- |
| C1 Context | Viewer, creator and trust/safety staff; external identity, media delivery and email |
| C2 Whole system | Six applications, seven logical stores/channels and three external providers |
| 01 · Watch & delivery | Independent playback API, bounded-age metadata, authoritative fallback and direct edge delivery |
| 02 · Upload & processing | Direct private upload, atomic catalog/outbox persistence, durable job intent, validation and rendition processing |
| 03 · Discovery & events | Rebuildable search, retained catalog events and idempotent projections |
| 04 · Moderation & revocation | Audited restriction, cache invalidation, media purge and explicit revocation limits |
| 05 · Identity & providers | Viewer/staff sign-in and provider boundaries |
| 06 · Data ownership | Authoritative metadata, quarantined originals, immutable derived media and rebuildable search |
| C3 Playback API | Admission, authorization, grants and cache freshness; two external stores and a calling client |
| C3 Platform API | Request/access boundaries, catalog, upload workflow, moderation, transactions and outbox publisher |
| C3 Media processor | Idempotent coordinator, source validation, rendition pipeline and completion reporting |

C2 application cards expose their internal responsibilities. Clicking a child opens the same
identity in C3. **Explorer** finds a responsibility by name; **Focus selection** makes it readable
without trying to fit the entire system. All 26 C3 responsibilities can be configured, connected,
reused and assigned exact interfaces with the existing editors.

The model has 26 C2 connections, 22 local C3 relationships and 51 v1 contract definitions
(including three data contracts). Provided/required interfaces trace to the same relationships.
There is no endpoint-per-component or table-per-component expansion.

## Design choices to examine

The catalog stays a modular application. Playback is separated because a popular video creates
read pressure independent of creator commands; heavy media processing is a different workload.
Clients transfer originals and media bytes directly through their respective storage/delivery
boundaries. The platform API is not in the segment request path.

A database transaction records domain state and outbox intent together. Relaying may deliver a
message more than once; consumers use event/source-version identity and durable progress.
The job queue and catalog event topic are different logical channels. Broker clusters and
replica placement are deployment decisions, not extra C2 boxes.

Playback checks permission independently of discovery. Cache misses coalesce and use a bounded
source read; unknown authority fails closed. Visibility metadata has a 15-second age bound.
Restriction events invalidate it and trigger a CDN purge; existing grants can survive for up to
60 seconds. Already downloaded media cannot be recalled. These limits are explicit tradeoffs.

The five objectives are **unverified assumptions**: 5,000 grant requests/second, a 150 ms p95
grant response, 50,000 edge segment requests/second, a five-minute catalog recovery point,
and 30-second search freshness. Their measurement boundaries and windows are recorded in
**Data & objectives**. Provider quotas, cost, geography, cold-cache pressure and restore drills
remain unresolved decisions. The study contains no capacity proof or production approval.

## Scenarios and editing

Editor actions → Dynamic scenarios includes watching a popular video; uploading, processing and
publishing; restricting a reported video; and discovering new content. Watching includes cache
fallback and authority failure. Publishing includes retained intent during queue outage and
idempotent duplicate handling. Outcomes are authored expectations, not recorded test results.

To adapt the study, choose a smaller workload, rename responsibilities, change technologies,
edit policies and add or remove focused views. Use Save/Cancel and Undo/Redo. The stock study is
unchanged by edits to its project copy. Code generation, C4 implementation and load verification
are deliberately outside this package.
