# Product attachment reuse proof

A trusted compiled consumer of the default local-v2 registry. It binds the base video pack's
three selections to productId/caption metadata, attachment/rendition namespaces, independent SQL
relations and three initialized processes. It contains no upload, lifecycle, durability or
encoding algorithm. Saved names cannot install this recipe; the explicit exporter registers it.
It adds no product catalog, authorization, HTTP API, browser, search or counting feature.

From the repository root, export into a new disposable directory:

```sh
pnpm --filter @jeeves/generator exec tsx examples/product-attachment/export.ts /absolute/new-directory
```

Use that directory's own frozen install/build. Allocate a unique Compose project, private runtime
and three free loopback ports before `pnpm first-run`; preserve owner ports/services. The internal
fixture runner uses an operator-supplied trusted principal, not an authentication demonstration:

```sh
docker compose --profile '*' run --rm --no-deps \
  -v /absolute/retained-fixture.mp4:/fixture.mp4:ro \
  app-fitting-upload node dist/examples/attachment-service.js prove
```

Run with the same recorded COMPOSE_PROJECT_NAME/LOCAL_HTTP_PORT/LOCAL_IDENTITY_PORT/
LOCAL_OBJECT_PORT environment as first-run. `inspect <asset-id>` only rechecks a retained ready
association and its real HLS manifest. The proof uses the same signed multipart, transaction,
job outbox/confirmed relay, result receipts, lifecycle worker and CPU HLS implementations as
YouTube. Product linkage and event/result envelopes stay in the typed example adapter.

The fixed project envelope retains existing exact dependency pins, including provider libraries
that this recipe never imports. No search/count provider, process, resource, credential or module
is selected or required. Base video exports without this recipe remain explicitly incomplete.

[YV2-20 evidence](../../../docs/plans/reliable-foundations/evidence/youtube-v2/yv2-20-reuse-and-freeze.md)
records the single actual transfer/encode, the corrected website Host transport, final deterministic
exports/builds and exact cleanup. It is a bounded attachment example, not a Marketplace app or
broad template certification.
