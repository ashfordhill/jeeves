# UX04b — Relationship aggregation and queued provenance

Complete on primary `main`, following UX04a commit `0db7607c07e6542844e6ba9a57197052925bb2e6`.
This extends the pure [studio projection](../../../../packages/spec/src/studio-view.ts) with
[relationship members, source accounting and compatible trunk data](../../../../packages/spec/src/studio-relationships.ts).
It changes no saved graph, existing editor, routing, application runtime or template availability.
CATALOG now records this implemented presentation boundary.

Directed endpoint groups retain every connection/member, original source/target identity, queue,
component, capability, binding, interface and exact contract reference. Mixed protocols/interactions
remain member data; the aggregate supplies no shared editable setting. C3 includes only connections
incident to its real service/package members. Internal package relationships remain there and in
explicit suppression records rather than becoming C2 self-arrows. C1 actions retain context IDs;
legacy component relationships retain source summaries without invented child cards.

Queue roles come from a studio `channelUse` or unambiguous existing relationship binding. Names,
labels, asynchronous intent and arrow orientation alone never establish a role. New studio roles
must match the message-flow convention. A legacy consume binding on a service→queue dependency
can provide a C2 producer→consumer summary while its original C3 arrow remains intact. Missing,
conflicting or invalid roles/endpoints remain explicit unresolved source. No source document is
converted. Trunks group only compatible protocol/interaction members from one displayed source,
with exact branch and member IDs; geometry and interaction rendering belong to later units.

[One-off observations](relationship-observations.json) record 24 scenarios and 27 checked properties.
Each row links its [exact scope/aggregate/member/trunk/source map](relationship-maps/).
The seven UX01 inputs stay byte-identical. Additional public [inspection inputs](derived-inputs.json)
are evidence only, including a defensive invalid-direction case; they register no template.

| Case | Exact observed accounting |
| --- | --- |
| Shared queue fan-out | Producer→one retains links `1,2`; producer→two retains `1,3`, all named `shared-channel-link-*`, with `shared-queue` and each explicit publish/consume pair. One compatible trunk retains both branches. |
| Two consumers in a package | One producer→`consumer-package` group has two queued members and all three canonical connections. Package C3 retains both consumes. |
| Repeated store reads | `data-one`→`shared-db` groups `repeated-store-read` and `shared-data-link-1`; the second application's dependency remains separate. |
| Grouped shared store | `data-apps`→`shared-db` retains both `group-reader-*` and both `shared-data-link-1/2` connections in one displayed group. |
| Mixed protocols | `https-one` and `stream-one` share directed endpoints but retain HTTPS/JSON request/response versus WebSocket streaming members. Only eligible HTTPS members join the fan-out trunk. |
| Reverse/cycle | `reverse`, `cycle-next`, `cycle-back`, `https-two` and the mixed group remain five distinct directed groups. No cycle suppression occurs. |
| Internal package queue | No C2 edge/self-arrow; three internal summary records retain both queue legs and two resource dependencies. Package C3 displays all four canonical connections. |
| Incomplete channels | Producer-only reports missing consumer; consumer-only reports missing producer; disconnected queue reports both. No other endpoint is fabricated. |
| Unspecified/conflicting roles | Three unlabeled-role links retain three ambiguous-role results plus missing producer/consumer; conflicting explicit legacy roles also remain unresolved. |
| Queue protocol/publish variants | Different leg protocols remain two values on the queued member and do not produce a false compatible trunk. Two publish connections × two consumes retain all four pair members. |
| Legacy dependency direction | Explicit consume bindings resolve the C2 message flow while C3 retains service→queue dependencies. QRWTY/video legacy factories resolve without semantic rewrites. |

All scenarios use deeply frozen designs and supplied projections. Exact reorder, rename-identity
and portable export/import comparisons pass. Every source connection has verified appearances,
internal suppression and/or unresolved references; all aggregate/trunk unions and branch memberships
are checked against their members. No `source-not-projected` fallback is needed for these inputs
or the nine historical factories. All factory design/layout hashes match UX01. Every factory binding,
interface, exact contract and component relationship remains represented by original identity.

[Browser observations](browser-observations.json) cover 1440×900 and 1280×800. The existing QRWTY
C2/API-C3 diagrams retain 16/22 cards and 21/39 labels. A labeled disposable data preview imports
the actual exported functions and exercises mouse selection of aggregates/members/trunks, service
scope changes, package detail, shared reads, incomplete channels and legacy dependency direction.
Screenshots include [fan-out](screenshots/fanout-trunk-1440x900.png),
[mixed protocols](screenshots/mixed-protocols-1280x800.png),
[package C3](screenshots/package-c3-1280x800.png) and
[legacy consume direction](screenshots/legacy-role-dependency-c3-1280x800.png).
The preview is inspection evidence, not a shipped studio interface or geometry implementation.

The browser write guard was installed before page creation. Zero project writes, blocked requests,
page errors, console errors or HTTP errors occurred. Three instances of the pre-existing React Flow
attribution warning remain; the previous saved-camera clipping remains. All 13 existing projects
retain exact semantic/layout hashes and revisions before/after inspection. No disposable API project
or semantic mutation was needed. Existing servers remained on 127.0.0.1:4300/4310.
[Preservation](preservation.json) records source feedback, frozen benchmarks, original fixtures and
the unchanged earlier handoff prefix.

Final required checks pass with Node 24.21.0 / pnpm 12.16.1, with the Node path prepended:
`pnpm lint` (existing 2,797 warnings / 88 infos, no errors), `pnpm typecheck` and
`pnpm --filter @jeeves/web build` (existing large-chunk advisory). Logs and exact outcomes are in
[checks/results.json](checks/results.json). No existing fixture typing adaptation was necessary.
An initial scoped typecheck exposed a callback-narrowing error, corrected before full verification.
Generated evidence JSON needed formatting; its original combined capture later exceeded Biome's
file-size bound and was split into individually formatted maps. No lint configuration was relaxed.
Logs retain those outcomes, with trailing whitespace removed for the staged whitespace check.

Unit/E2E/template suites, snapshots, their maintenance and `pnpm check` remain deferred by the
owner. No provider/external-agent execution, application generation, sibling edit, old factory or
benchmark change, backend resumption, branch/worktree or further UX assignment occurred. UX04 is
complete with UX04a; UX05 owns the opt-in shell and is outside this assignment.
