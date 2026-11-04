# SG03 evidence: blueprint API (code-generation boundary)

Unit: [SG03](../../../plans/studio-grid/execution-units.md#sg03--blueprint-api), plus the
coordinator-added `gateway` application kind (owner decision O5). Base commit `46a7676`.
No UI change beyond the Gateway entry the existing Services library picks up automatically, so
there are no screenshots. Boundary doc: [studio blueprint](../../../studio-blueprint.md).

## Files

- `observe.mts`: one-off observation script. Run from this folder with
  `apps/server/node_modules/.bin/tsx observe.mts <repo>/packages/spec/src/index.ts .` while the
  dev API runs on 4310.
- `observations.json`: its output.
- `tinyurl-probe-blueprint.json`: the blueprint returned by the real endpoint for the disposable
  TinyURL-shaped probe project (deleted afterwards).
- `blueprint.schema.json`: `designBlueprintJsonSchema()` output (JSON Schema draft 2020-12).

## What the observations show

1. **Gateway kind.** `studio-gateway@1.0.0` resolves, is an application kind, appears in the C2
   creation catalog, defaults to public / path-prefix / unspecified product, carries the common
   and performance fields, and rejects an unknown routing value or an unknown key.
2. **All 14 studies** give a blueprint that parses with `designBlueprintSchema`, is identical on a
   second call, and leaves the design byte-identical.
3. **Owner projects (GET only).** All 4 return 200 with `Cache-Control: no-store`; the body parses,
   is identical across two requests, equals `designBlueprint()` of `GET /design` (semantically; key
   order follows the stored document), and contains no layout/history keys. Project revisions and
   `updatedAt` are identical before and after. These projects are pre-studio designs, so their
   elements appear in `omitted` (`no-studio-binding`) and only C1 external systems are listed.
4. **Errors.** Unknown project 404; malformed ID 400.
5. **End to end with components.** A disposable project built through `POST /operations` with
   studio commands (gateway, two services, a worker, database, cache, queue, external API, eight
   connections, ten components, one internal link) returns 4 services with 0/3/4/2 components,
   3 resources, 1 external, 8 resolved connections (timeouts, retries, channel use) and 7
   component links; only finding `NEEDS_TEMPLATE`. Reading it did not change the revision. The
   project was deleted (204) and then gave 404.
