# qrwty (prototype project brief)

Status: stub for the user to fill in. Not part of the Jeeves v1 build. When Jeeves and Draw Jeeves work, this file is given to the Draw Jeeves chat as a prompt, and the user reviews the design Jeeves proposes.

Repository: `~/github/qrwty` (new implementation). Prototype/behavior reference: `~/github/qr-code-tracking`. Product URL: https://qrwty.io/ (currently a broken sales page, per the user).

## To fill in

- Goal in one paragraph
- Users and the main journeys
- Must-have features for a first version
- Hardware: terminal, printer, location source (see [inventory-labeling.md](inventory-labeling.md) for the shared device platform)
- Scale targets (redirects/day, peak rps, latency, availability), if known
- Elements you expect on the board (services, frontends, databases, attachments)

## Notes carried over from the earlier plan

These were written during architecture planning. They are background, not decisions.

### qrwty: physical placement, redirect tracking, and analytics

The archived QR idea describes creating location-associated labels during field work, printing them on the spot, and comparing engagement by placement. Its Pi diagram identifies a Raspberry Pi, GPS coordinates, server-side URL/QR generation, a database, and a USB label printer. Sources: [brainstorm QR idea](<../../../brainstorm/archives/QR Code Tracking/README.md>), [tracker diagram](../../../qr-code-tracking/docs/pi-to-server.png), [qrwty README](../../../qrwty/README.md).

The inspected local tracker implements `PUT /api/qr`, `GET /q/{qr_id}`, and `GET /api/qr/{qr_id}/stats`, plus health checking. It creates an ID and redirect URL, stores optional coordinates, records scan events, increments a counter, and issues a 302 redirect. Its local source does not contain the complete printer/GPS/dashboard product or generate a QR image. Sources: [API](../../../qr-code-tracking/api/main.py), [schema](../../../qr-code-tracking/init.sql), [Docker setup](../../../qr-code-tracking/docker-compose.yml).

The local checkout ends at `eb65ee1` dated 2026-02-17. The fetched GitHub README includes later May/July updates: phone location, hotspot connectivity, a Pi and Zebra printer, a metrics map/timeline, and label replacement after weather damage. These are documented prototype outcomes, not independently verified live behavior. The user also identifies `qr.trees4berwyn.org` and `metrics.trees4berwyn.org` as the prototype services. [GitHub prototype documentation](https://github.com/ashfordhill/qr-code-tracking).

Confirmed product loop: at a physical placement, the operator uses a custom printing device to create a user-owned QR instance, capture its location, and print a label pointing to qrwty.io. The operator sees that placement and its scan activity on a map. The user selected a new implementation and enterprise-scale ambition. General-purpose short links, custom domains, broad team administration, and billing are not implied by the comparison to Bitly.

Candidate logical components are an owner/account boundary, device enrollment and credentials, a QR/placement registry, location-provider adapter, print-job coordinator and printer driver, public redirect handler, event store and analytics queries, and map dashboard. Several can initially live in one deployable service; device components run on or near the hardware. Record placement coordinates separately from any scan-location estimate; a scan does not establish the scanner's precise location. Record `latitude`, `longitude`, `accuracyMeters`, `capturedAt`, and `source`, plus any later operator correction.

First acceptance journey: obtain a location with known accuracy/freshness; create one owned QR instance and print job; render the label payload; decode the generated or physically printed QR; open its qrwty.io link; assert the configured destination; verify a persisted event and updated count on the placement map. Repeat after device/service restart. Cover unknown codes, cross-owner access, stale/no location, printer disconnection, repeated button presses, and simultaneous scans. Simulation makes CI repeatable; physical print/decode and field-location checks remain distinct acceptance evidence.

A useful additive-feature example is changing a destination while keeping the printed URL stable, or adding campaign metadata and map filters. Placement identity, QR/link identity, label versions, and print attempts should be separate records so replacement labels can retain history. Keep a device operation ID across retries. A lost printer acknowledgement can leave physical output uncertain: report that state and offer an explicit reprint, rather than claiming exactly-once physical printing. Protocol-specific feedback determines what can be confirmed automatically.

Location acquisition is a replaceable capability. A phone-assisted version can use the phone's platform location service; a standalone device can use appropriate GNSS hardware and/or a Wi-Fi/cell positioning provider. Google's geolocation service accepts nearby access-point/cell information and returns an accuracy radius; its Android fused location API combines available signals. This does not guarantee instant or accurate fixes in every setting. Retain location age and quality in the protocol, and measure time to an acceptable fix in field tests. [Geolocation service](https://developers.google.com/maps/documentation/geolocation/overview), [fused location provider](https://developers.google.com/location-context/fused-location-provider).

The user clarified that the shared device should operate through its own small screen and buttons, using Wi-Fi to reach a configured server. A phone is not required for its normal interface; an optional phone-assisted location adapter can remain available. Standalone user interaction does not determine the location hardware or imply disconnected operation. Do not infer location transfer merely from connecting to a phone hotspot: a location protocol must transmit the position explicitly. Define printer language, transport, label dimensions, location source, and feedback capabilities before implementing a physical driver. Choose server-connected creation first as a proposal; if offline printing is required, reserve resolvable link identities before disconnection and explicitly model delayed placement synchronization. A label printed while offline must not be presented as a confirmed live redirect if it cannot yet resolve.

The exact product URL is confirmed as `https://qrwty.io/`. The user describes its current state as a broken sales page. The web reader still failed to fetch it; sandboxed curl failed hostname resolution, and an outside-sandbox fetch was automatically rejected because sandbox approvals are disabled. The two trees4berwyn sites also could not be retrieved through the web reader. These are inspection limits, not findings that the sites are offline. Do not request the already-confirmed URL again or infer sales-page features without its contents.

### qrwty: capacity, reliability, and reusable Slice contracts

Enterprise scale is a design and verification goal, not an automatic consequence of choosing microservices. Preserve the fast field workflow and a small initial footprint while establishing separable scaling and failure boundaries:

| Slice or capability | Responsibility | Reusable verification |
| --- | --- | --- |
| Device/location adapter | Capture timestamped location with quality information | Simulator fixtures; timeout, stale-fix, and explicit transfer cases; field measurements |
| Print coordinator/driver | Persist jobs, render valid labels, report progress and uncertain output | Duplicate request, restart, disconnect, payload decoding, physical print checks |
| Placement management API | Own QR instances, destinations, devices, placements, and lifecycle history | Ownership isolation, stable IDs, retries, replacement, correction history |
| Public redirect service | Resolve published IDs with bounded latency and defined disabled/unknown behavior | Concurrent traffic, popular-link skew, cache freshness, dependency failures |
| Event ingestion/processing | Accept scan events, deduplicate delivery, produce aggregates | Replay, duplicate delivery, late events, backlog recovery, freshness reporting |
| Placement-map UI/API | Query owned placements and display activity | Geographic filtering, clustering/pagination, corrected positions, isolation, stale analytics indicators |

Recommended deployment direction: separate management and redirect workloads when their load or availability requirements diverge; process analytics asynchronously after durable event acceptance. PostgreSQL is the initial authoritative store for owners, devices, links, and placements. Introduce a cache and separate analytics storage when measured access patterns justify them. Map queries should be geographically bounded and indexed, with aggregation for dense areas; do not send every placement to every browser.

The event acceptance point must be explicit. A process-local task started after returning the redirect is not durable delivery. Define bounded publication, retry/reconciliation, and a measurable degradation policy when ingestion is unavailable. Proposed priority: preserve redirect availability and make any analytics loss or delay observable; if lossless capture is required, choose a durable acceptance mechanism and account for its latency and availability cost. Do not promise both zero event loss and unconditional redirects through every dependency failure.

For a Google Cloud event-stream adapter, assume redelivery and implement event-ID-based deduplication and idempotent aggregates. Pub/Sub defaults to at-least-once delivery without ordering guarantees. Its exactly-once option is limited to pull subscriptions and still does not make the entire redirect-to-database workflow exactly once. [Subscription semantics](https://docs.cloud.google.com/pubsub/docs/subscription-overview), [exactly-once scope](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery).

Separate metrics for raw requests, test/device-verification scans, filtered scans, and any estimated unique visitors; a redirect count is not a verified person count. Define cache update/invalidation behavior for changed destinations and disabled labels. If edge/browser caching bypasses the collector, describe the effect on counts and update propagation instead of silently presenting incomplete analytics as exact.

Capacity parameters remain undecided: active owners/devices, labels created per day, redirect requests per day and peak second, geographic distribution, event retention, map-query load, location accuracy/freshness, and time from button press to printed label. Record redirect latency/availability, analytics freshness/completeness, restore objectives, and spend limits as separate targets. Use staged ramp, burst, soak, hot-link, and failure tests, with independently verified event totals and infrastructure costs. Autoscaling settings, database connections, queue capacity, and regional limits must be measured together. [Cloud Run load-testing guidance](https://docs.cloud.google.com/run/docs/about-load-testing).

Regional redundancy, stronger organization controls, fleet management, and additional storage tiers can be added against defined requirements. Validate restore/failover with actual evidence before publishing service commitments. The old tracker is a source of product behavior, not a capacity benchmark for the new platform.
