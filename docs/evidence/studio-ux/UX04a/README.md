# UX04a — node and scope projections

Complete on primary `main` from `9aeccb2076708468bff7d94b2f5e5097a3f29d1f`.
The normal interface is unchanged. This unit supplies pure projection data; relationship aggregates
and provenance are UX04b, and the temporary studio surface starts in UX05.

[studio-view.ts](../../../../packages/spec/src/studio-view.ts) exports `studioViews(design,
studioDefinitions, projectName)` and canonical key helpers. It returns C1, C2 and useful detail
scopes with original semantic references, deterministic IDs, explicit parent/breadcrumb keys and
eligible drill targets. A package replaces its members at C2, summarizes the actual applications
and has no execution settings. Its C3 scope contains members and relevant resources/dependencies.
A service detail has a selectable owner anchor and one-hop dependencies, with shared resources
referencing their original element IDs. Ownership alone leaves ordinary stores visible at C2;
only package-owned resources with entirely internal connections collapse with the package. Queues
appear only in C3. A disconnected owned queue remains reachable through its owner's detail.

Bundled browsers retain a browser execution boundary and the exact serving-application reference;
no Docker deployment or connection is inferred. Scalar settings produce no child nodes. Exact
unknown definitions stay unresolved with neutral visuals. Legacy families use the existing explicit
mapping and original classification. An external identity provider cannot acquire a service scope
from its visual family. Existing components are summarized by original IDs/owners for source review,
without rendering backend/library/adapter/business internals as configurable children. Disconnected
unowned legacy queues retain explicit source references rather than an invented owner. Backend
contracts, obligations, templates, annotations and old focused layouts remain in the unchanged design
and portable export. The existing identity-based layout pruning already supports these keys; its
implementation needed no change.

Actual evidence:

- [Projection observations](projection-observations.json) cover all seven UX01 public fixtures.
  C2/detail counts are single service 1/0; package 1/3; shared data 6/2; shared channel 3/3;
  dense graph 24/24; legacy supported 3/2; legacy rich 10/2. Each detail count is a count of useful
  scopes, with exact per-scope node IDs/counts recorded. Frozen-input calls are mutation-free.
  Full projection output is identical after array reorder and portable round-trip. Rename preserves
  node/scope/navigation identities. Checks include owner anchors, no duplicate resource per scope,
  one shared queue identity, no package runtime, no C2 queues, package membership without empty child
  scopes, outside consumers exposing package-owned stores, browser serving references, neutral
  unknown definitions/families and a linked external context object without a duplicate integration.
  All nine historical factories still match their UX01 design/layout hashes.
- [API observations](api-observations.json) use one owned disposable project to save the package,
  save layout, delete a member with explicit resource-owner reassignment, prune through the same
  pure function used by `draw/store.ts`, persist the separate layout and reload. Dead member/package
  scopes and dead positions disappear; a living resource position remains even while hidden at C2.
  Surviving legacy focused positions and cameras remain exact. Layout writes do not change the
  semantic revision. The [cleanup](api-cleanup.json) records deletion with 204 and subsequent 404.
- [Browser observations](browser-observations.json) record QRWTY C2/API-C3 at 1440×900 and 1280×800,
  retaining 16/22 cards and 21/39 relationship labels. Saved legacy cameras retain previously
  observed clipping. A disposable in-browser preview imports the actual pure projection and
  definitions; mouse double-click opens package/member scopes, breadcrumb buttons return,
  the owner anchor selects its canonical element, and a single service without dependencies
  stays in C2. Shared-data and bundled-browser fixtures are inspected at both sizes. Screenshots
  include [package C2](screenshots/package-c2-1440x900.png),
  [package C3](screenshots/package-c3-1280x800.png),
  [service owner](screenshots/service-owner-1440x900.png) and
  [shared data](screenshots/shared-data-1280x800.png). This labeled verification overlay is not
  the later product shell, inspector, styling or edge rendering. A write guard was installed before
  page creation; no write or blocked request occurred. There were no page, HTTP or console errors;
  two existing React Flow attribution warnings remain.
- All 13 pre-existing projects retain exact semantic/layout hashes and revisions in both API and
  browser observations. [Preservation](preservation.json) records source feedback, original fixtures,
  frozen benchmark bytes and the append-only handoff prefix. `.jeeves-feedback/` stays unrelated.

Required verification uses Node 24.21.0 / pnpm 12.16.1 with Node PATH prepended. Command results and
logs are in [checks](checks/results.json): repository lint, repository typecheck and web production
build pass. Lint retains the existing 2,797 warnings / 88 infos with no errors; build retains its
existing large-chunk advisory. Final scoped formatting and staged whitespace, including new logs,
pass. No fixture typing adaptation was needed.

Routine inspection corrections included the workspace working directory, the existing shared
command's `type`/`elements`/`resource` field names and generated JSON formatting. An API setup attempt
hit a transient development-server restart before creating any project; retry passed. Initial logs
are retained. A trial comparison against an unsupported library role was removed during compilation;
legacy classification and the existing explicit mapping remain authoritative. No product decision
changed. Unit/E2E/template maintenance, snapshots, all such suites and `pnpm check` remain deferred.
No provider/external agent, generation, application runtime, sibling repository or paused backend
work ran. Stop after UX04a; this evidence does not complete UX04b or the combined UX04 milestone.
