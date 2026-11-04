# C2/C3 architecture studio

The finite studio is the default interface as of UX15 (2026-11-04). No URL flag is needed.
The [combined acceptance record](evidence/studio-ux/UX15/README.md) covers the 25-unit
[studio plan](build-plan-studio-ux.md), including the preserved
[owner decisions](../.docs/visual-improvements/2026-11-03-ux-review/DECISIONS-FINAL.md).
This is design/configuration capability. Studio definitions have no application runtime resolver;
existing supported legacy template/recipe designs retain their generation eligibility.

## Everyday workflow

- Open **New project** from the project menu. Architecture study offers fourteen source-mapped
  studio examples; a fresh installation starts with the Mattermost studio study. Blank architecture
  starts an empty design. Existing resource-workspace and QR Studio recipe starting points remain
  available with their original bounded configuration and support.
- Use **C1** for the system, people and external systems; **C2** for applications, resources and
  packages. Click a card to inspect. Double-click the system to reach C2, or a package/service with
  useful dependencies to open C3. Breadcrumb/back restores the parent scope and its camera.
  Zoom changes text density; it never changes structural depth or invents empty children.
- Choose a finite tool, then click blank canvas to place it. **Select** cancels placement.
  **Library** groups compatible Services, Resources, Integrations, Presets and Examples.
  Previews require **Add**. Examples create separate projects; they never replace a live diagram.
- Choose **Connection**, click source and target, review Action, Protocol, Interaction and Access,
  then **Connect**. Invalid choices remain correctable. A package requires actual application
  endpoints. Resources are reused by explicit identity, never by a matching name.
- Use the selected object's compact General/Options/Connections sections. Empty sections are hidden.
  Technical settings follow the [finite configuration matrix](plans/studio-ux/configuration-matrix.md).
  Provider selections express intent; they provision nothing and supply no implementation.
- Open **Generate** for Review, Activity and conditional Outputs. Opening it starts no execution.
  Review separates structural checks, unresolved choices, implementation availability, C4b work
  and recorded verification. Source/contract detail is read-only and available on demand.
  Activity retains existing supported generation and orchestration flows. Outputs distinguishes
  application artifacts from portable source, handoff and selected-view SVG exports.

Chat opens on the left in a fresh project. It uses the same finite command vocabulary, validation
and history as manual edits. It cannot open raw business/backend editing tools through the studio
profile. Available token counts and provider-reported USD costs appear only when complete data
exists; missing usage is omitted. Live model conversation quality is a later evaluation.
Chat and the right inspector collapse and resize independently, with per-project local preferences.
All normal actions work by mouse at 1440×900 and 1280×800.

Valid text autosaves after 500ms or blur; select changes commit promptly. Selection, navigation,
Generate and export flush pending valid edits. Invalid unsent drafts are discarded on leave.
A rejected write stays visible with Retry/Discard; a conflict adopts the fresh design with
“Changed elsewhere; reopen to edit.” Success stays quiet. Browser termination can interrupt an
unacknowledged write; an unload flush is an attempt, not a durability guarantee.

The header **Undo/Redo** pair follows chronological semantic and layout actions. Each accepted
inspector batch, creation, connection, grouping, move or Tidy is one action. Selection and camera
changes add none. Local layout history resets on browser reload; server semantic history remains.

## Reading a dense design

Names and capability symbols stay on fixed-size cards. Solid outlines do not imply runtime support.
Selection adds a halo and keeps unrelated cards/edges at full opacity. Full names/settings remain
in the inspector and source; low zoom omits relationship labels, and higher zoom adds bounded
purpose/provider/protocol text without changing world geometry.

Compatible relationships can share a trunk. Each directed branch retains its canonical members;
clicking a multi-member line opens a chooser before editing one actual relationship. Opposite
arrows and cycles remain distinct. Crowded labels may disappear while their selectable lines remain.

Drag the whole card to preview a free 24-unit grid landing; mouse multi-selection moves a group
without changing its relative offsets. Movement changes layout only. Unrelated geometry remains
captured during drag; incident paths settle once after an acknowledged drop. **Tidy and fit**
arranges only the current scope and records positions/camera as one undoable action. Wheel/pan
remain available. Very large cyclic graphs can need pan/zoom and scoped inspection; fitting the
whole graph does not promise readable text at every scale. Temporary incident paths may cross
other geometry during movement. Existing manual overlaps are preserved until deliberately moved.

## Options, reuse and limits

A service is one application deployment boundary. A **package** groups independent applications;
it has no language, provider or runtime of its own. Select multiple C2 applications and choose
**Group as package**. The package inspector provides Add/Remove member, Ungroup and separately
confirmed Delete members. Losing an owner requires explicit resource reassignment; shared resources
and other consumers are preserved.

Queues/topics appear only in C3 with one resource identity and required owner. Application → queue
publishes; queue → application consumes. C2 summarizes producer-to-consumer communication with both
underlying connections. Queue retention does not implement business retention, reliable delivery,
transactional outbox, deduplication or provisioning. Database/cache/object-storage/search/CDN and
external API settings similarly stop at the finite technical intent.

**Library → Presets → Saved architecture templates** retains local draft/save/version/publish/retire
management. Compatible published studio compositions insert through Presets with exact versions,
hashes and explicit dependency identities. Historical component options are preserved as source,
without their old editing forms. Existing QR Studio projects also expose **Product configuration**
here for their bounded name/tagline/analytics settings; saving changes a design, not a running app.

Existing projects open through a read-only technical compatibility projection. Safe canonical text
edits remain available. Opening, depth navigation, zoom or layout saves do not add studio metadata,
change semantic revision or migrate templates. Old annotations, focused views, scenarios, contracts,
backend declarations and deployment records remain in lossless source export and Generate details.
The old Explorer, focused-view selector, freeform board, deep business/API/schema editors and duplicate
Generate drawer are absent from normal navigation.

The [fourteen studies](examples/studio-studies.md) retain exact source manifests and explicit future
C4a/C4b obligations. Inventory and grocery remain limited concepts with unresolved requirements;
the Zammad reference does not complete P73a/P73b. No tidy diagram earns backend benchmark points.
See [CATALOG](../CATALOG.md) and [modeling guidance](c4-modeling.md) for conceptual boundaries.

Later separately requested runtime work must choose template/language priorities, establish exact
extension and regeneration contracts, and verify reproducible builds, integration failures and
actual application behavior. The UX milestone neither resumes the paused backend batch nor decides
whether the generator should be a separate application. Historical authoring evidence remains in
Git and the append-only [handoff](handoff.md); it does not describe current navigation.
