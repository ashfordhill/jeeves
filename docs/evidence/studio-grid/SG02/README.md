# SG02 evidence: component catalog and performance settings (model only)

Unit: [SG02](../../../plans/studio-grid/execution-units.md#sg02--component-catalog-and-service-performance-settings-spec-only).
Base commit `1b650df`. No UI, server, generation or runtime change, so there are no screenshots.
The TinyURL study does not exist until SG04.

## Files

- `observe.mts`: one-off scratch observation script. Run it with
  `apps/server/node_modules/.bin/tsx observe.mts <path>/packages/spec/src/index.ts [head]` (tsx is
  needed because Node's type stripping rejects parameter properties in `apply.ts`).
- `observations.json`: output against the SG02 working tree.
- `observations-head.json`: output against `git archive HEAD packages/spec` (base `1b650df`), for
  the compatibility sections only.

## What the observations show

1. **Old documents read unchanged.** All 14 existing studies, and the 4 owner projects read with
   `GET /projects/:id/design` (read-only, no writes), parse with the SG02 schema to a semantically
   identical document. Studio findings, design finding counts and the generation guard are
   identical to HEAD (`studies` and `ownerProjects` sections compare equal). Byte order differs
   only because Zod emits keys in schema order; that is unchanged from HEAD.
2. **Commands round-trip.** On a TinyURL-shaped design built through `buildStudioCommand` and
   `applyOperations`: create (with service/worker replicas, autoscale, timeout, concurrency limit;
   database replicas and partition key; cache cluster/LRU; 12 queue partitions; CDN redirect
   caching), `createComponent` (seven components, including an external call that creates its
   traced C2 connection in the same batch), `connectComponent` (element and same-host component
   links), `editComponent` (purpose and settings) all apply. The final document re-parses
   semantically identical. Its only studio findings are the existing design-only `NEEDS_TEMPLATE`,
   and generation stays unsupported.
3. **Readiness gaps are saved, not rejected.** An unlinked cache reader, a publisher with outbox
   but no database link, and a custom component without a purpose each give `CONFIG_REQUIRED`.
   The gap clears once the link or purpose is added.
4. **Structural errors reject the batch** and leave the design unchanged: a resource host, a
   component link across hosts, a `via` connection that does not join host and target, a disallowed
   target kind, a consumer tracing a publish connection, an ID collision with an element, a
   dead-letter queue that is not a queue or equals the source queue. Changing a component's kind
   throws in the command builder.
5. **Schema rejections:** block size outside range allocation, L1 TTL without L1 size, unknown
   keys, status 308, min replicas above max, autoscaling without a max, request timeout on a worker,
   a dotted partition key, 16 read replicas, studio version 2.
6. **Remapping:** `mapStudioModel` remaps component IDs, hosts, links, targets and `via`.
7. **Removal:** `disconnectComponent` and `removeComponent` keep C2 connections. Deleting a traced
   C2 connection drops its links, and so does a raw `disconnect` op. Deleting a host element removes
   its components and their links.
8. Every component settings key has a field descriptor (`componentDescriptorGaps: []`).

## Checks

Node 24.21.0. `pnpm lint` exit 0 (2,797 warnings, 88 infos, unchanged); `pnpm typecheck` exit 0;
`pnpm --filter @jeeves/web build` exit 0 (existing chunk-size advisory). Unit/E2E suites and
`pnpm check` are owner-deferred and were not run.
