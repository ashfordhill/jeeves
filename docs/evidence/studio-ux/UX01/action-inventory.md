# Current actions and their studio destination

Baseline: `feff820`, before the studio UI. Destinations are the accepted future scope, not claims
that controls have moved. This accounts for static actions and data-dependent menu families;
repeated instances use the same destination. Source anchors refer to the frozen baseline, so later
line changes do not alter this inventory. The interaction contract §1 governs the mapping.

| Current source / surface | Exact action(s) / dynamic family | Accepted destination / disposition |
| --- | --- | --- |
| shell/ViewTabs.tsx, views.ts | Design; Runs; Settings | Design remains studio; Runs becomes Generate; Settings remains application settings. |
| shell/StatusBar.tsx | Dark mode | Retain theme toggle in application chrome; local UI preference. Health remains read-only. |
| draw/ProjectMenu.tsx | Project menu; Rename project; recent project entries; All projects… | Project selector/browser in slim header. Existing rename/open/search/delete remain mouse accessible there. |
| draw/ProjectBrowser.tsx | Search projects; open project; Delete [project]; Delete confirmation; Cancel; close | Retain project browser; no deletion of active diagrams during inspection. |
| draw/ProjectMenu.tsx | Create target from this design | Project selector's explicit create/copy workflow, preserving baseline/provenance. Not a second diagram. |
| draw/ProjectMenu.tsx | New from recipe; New project | Project chooser; supported recipes remain reachable as Presets in Library/creation. |
| draw/ProjectChooser.tsx | Choose Architecture study / Resource workspace / QR Studio / Blank canvas; Study selector; Retry catalog; Create project; Cancel | Project creation/Library Examples and Presets; preserve real supported legacy paths. Excluded route/schema forms do not return as creation defaults. |
| architecture/ArchitectureTargets.tsx | Create target; Cancel; recipe handling choice; Current baseline; Proposed target; Changes; Refresh comparison; Close comparison | Explicit project creation plus read-only baseline/source comparison in Generate Review. Preserve target restrictions and declarations. |
| ArchitectureWorkspace.tsx header | Editor actions (ellipsis) | Remove this launcher; account for every child below. |
| workspace menu | Freeform board & annotations; Architecture diagram | Remove freeform navigation. Studio is the normal diagram; preserve old annotations in export. |
| workspace menu / Find object dialog | Find object; query and choose result | Remove separate Find/Explorer surface. Card/relationship mouse selection and depth navigation are the retained discovery path; no replacement search/map requirement. |
| workspace menu | Undo layout; Redo layout | One chronological header Undo/Redo with semantic changes. |
| workspace menu | Hide inspector; Show inspector | Independent right rail toggle in slim header/rail. |
| workspace menu | Edit context | C1 object click opens compact inspector. |
| workspace menu | Add component | Scope-aware finite toolbar/Library; arbitrary component/module authoring removed. |
| workspace menu | Show implementation adapters | Removed from studio. Preserve declarations and expose source details in Generate when requested. |
| workspace menu | Connect components; Connect dependency | Scope-aware Connection tool and compatible existing-resource picker, using actual identities. No arbitrary backend dependency editor. |
| workspace menu (QR Studio only) | Product configuration | Preserve bounded supported recipe configuration under Library Presets/project recipe detail; exclude API/business schema editing. |
| workspace menu | API contracts | Generate Review source/contract detail and portable Outputs. Read-only schemas remain inspectable; old operation/resource editors removed. |
| workspace menu / toolbar | Data responsibilities and objectives; Data & objectives | Generate Review read-only source/readiness details. Deep data/objective editors removed from normal studio. |
| workspace menu / AnnotationDraft | Suggest responsibility annotations; Add selected annotations; Cancel | Remove authoring entry. Existing suggestions/annotations survive source export; no substitute annotation tool. |
| workspace menu / Review button | Architecture review ([count]); Review | Generate Review. Findings link back to applicable card/scope, never removed deep editors. |
| workspace menu | Findings ([count]); select finding; dismiss notice | Generate Review actionable list and concise local errors. Dismiss notice retained. |
| workspace menu | Inspect evidence | Generate Review exact revision-bound evidence detail; do not imply current verification. |
| workspace menu | Implementation handoff | Generate Review/Outputs retain scope/ownership/review/export capability and stale-revision behavior. |
| workspace menu | Local deployment; Deployment plans | Remove normal editor entry; declarations remain inspectable in Generate/source export. Small execution setting remains in application inspector. |
| workspace menu | Type colors | Remove separate legend launcher; recognizable capability icons/colors on cards and Library. No essential model mutation lost. |
| workspace menu | Generate code | Generate unified destination; opening does not start work; preserve supported legacy generation and target restrictions. |
| workspace menu / toolbar | Saved revision [n]; Saved | Remove persistent success chrome; pending/error feedback only. These are status labels, not commands. |
| ArchitectureWorkspace header | Undo; Redo | One chronological mouse-accessible pair, including layout. |
| ArchitectureWorkspace header | C1 Context; C2 Containers; C3 Components | Explicit C1/C2 navigation; C3 only for selected expandable scope with breadcrumb/back. No global C3 empty view. |
| ArchitectureWorkspace header | Deployment | Remove normal studio tab; retain stored source/obligations in Generate. |
| ArchitectureWorkspace header | Component container selector | Remove flat parent selector; double-click meaningful children and breadcrumb/back. |
| ArchitectureWorkspace header | Library | One Library with compatible Services/Resources/Integrations/Presets/Examples. |
| studio-toolbar | Explorer; Close explorer; Search design; outline choose/open child | Remove Explorer/map. Mouse card selection and double-click/breadcrumb replace outline navigation. |
| studio-toolbar C1 | Edit people & systems | C1 Person/External system/Connection tools and selected context inspector. |
| studio-toolbar C2 | + Add container; Connect containers | Finite C2 creation palette; Connection tool with explicit source/target/form. |
| studio-toolbar C3 | ← C2; + Add component; Connect components; Connect dependency | Breadcrumb/back plus finite package/service C3 tools. C3 queues/resources meaningful; no arbitrary component editor. |
| studio-toolbar | Patterns | Library Presets/reusable compositions; no separate Patterns entry. |
| FocusedViews.tsx | C2 view (Whole system and each saved view); New focused view; Edit view; Save view; Delete view; Cancel; hidden connections link and member selection | Remove named/focused-view editing/navigation. Preserve exact records and hidden relationships in portable source; whole architecture uses C1/C2/C3. |
| workspace rail | Open chat; Collapse chat | Independent left rail toggle; chat initially open. |
| workspace rail | Close inspector; card inspect; relationship inspect | Independent right inspector rail with finite eligible forms; no empty report. |
| workspace errors/empty states | Refresh architecture; Describe this system; Browse building blocks; Add component; start example/project actions | Refresh/retry remain concise on relevant error; creation uses finite Library/toolbar/chooser. No placeholder empty C3. |
| ArchitectureGraph.tsx cards | Inspect [name]; responsibility-row [name] ›; Design components →; Open components | Click inspects; double-click only actual expandable scopes. Remove inline responsibility lists and redundant open-child buttons. |
| ArchitectureGraph.tsx relationships | Inspect relationship: [description]; line click | Individual selectable branch/settings; multi-member trunk chooser preserves identities. |
| ArchitectureGraph.tsx Controls | Zoom in; Zoom out; Fit view | Wheel/pan remain; one visible Tidy and fit replaces fit controls. No separate Fit menu. |
| diagram bottom | Fit diagram; Focus selection; Auto-arrange | One visible Tidy and fit. Selection remains inspect, without forcing a camera change. |
| diagram menu | Diagram options (ellipsis) | Remove launcher; children mapped below. |
| diagram menu | Flow right; Flow down | Remove direction choice; deterministic left-to-right arrangement. Existing layout records preserved. |
| diagram menu | Fit selected; Focus selected object | Remove duplicate focus actions. Tidy and fit and pan/zoom remain. |
| diagram menu | Nudge left; Nudge right; Nudge up; Nudge down | Remove nudge menu; whole-card mouse drag with grid landing handles movement. |
| diagram menu | Undo layout; Redo layout; Auto-arrange diagram | Unified Undo/Redo and Tidy and fit. |
| diagram error | Retry layout | Keep concise error/retry with last valid graph visible. |
| Scenarios.tsx both menus | Hide scenario; each scoped scenario name; Add scenario; Edit scenario | Remove scenario toolbar/editor/playback; retain data in Generate source/obligation detail/export. |
| Scenarios.tsx panel | Path selector; previous/next step; select step; clear | Same removal; no scenario authoring or playback in studio. |
| draw/Toolbar.tsx | Select; Hand | Always present in floating toolbar. |
| draw/Toolbar.tsx | Service; Elements; each registry palette template | Finite C2/compatible C3 base types and Library; actual supported templates retained under Presets detail. |
| draw/Toolbar.tsx | Attachments; each compatible attachment template | No arbitrary attachment palette; retain fixed supported-template configuration in Presets, meaningful resources through scope-aware forms. |
| draw/Toolbar.tsx | Connector | Explicit two-click compatible Connection tool/form. |
| draw/Toolbar.tsx | Text; Sticky note; Frame | Removed from normal palette/navigation; old data exported without rewriting. |
| draw/Toolbar.tsx | Delete selection | Retain mouse deletion in contextual selection/inspector controls with shared-owner/reference validation. |
| draw/SubtypeControl.tsx | each compatible template subtype; Needs a template | New studio definition/provider choices; supported old templates stay Presets. No silent legacy conversion or template substitution. |
| draw/inspector/Inspector.tsx | Add attachment; each compatible attachment; remove attachment; remove connection; delete element/connection | Fixed-template details remain in Presets; finite studio inspector Connections/deletion preserves validation. Old business/attachment authoring does not reappear. |
| PlannedInspector / ComponentDetails / ComponentEditor | Configure container/component; Edit relationship; Delete; Save; Cancel; API operation links; Data/Access/Behavior/Effects/Settings editors | Replace only allowed technical fields with compact autosave inspector. Remove route/type/entity/policy/state/effect/hook/business editors; exact stored data still informs Generate and exports. |
| InterfaceEditor / RelationshipBindings | Edit/add/remove interfaces/contracts/bindings; review requirements | Remove normal authoring surfaces; Generate retains read-only exact source/obligation details. |
| ArchitectureDeployments.tsx menus | Add placement / each deployment placement choice; Custom placement; Add infrastructure / each infrastructure choice; Custom infrastructure | Remove deployment authoring (including Kubernetes/Helm). All historical declarations preserved. |
| ArchitectureDeployments / LocalDeployment | environment selection; add/edit/delete environment, node, instance, connector; Save/Cancel; local view/instance selection | Same removal; read-only declared arrangement/source in Generate, no new deployment editor or runtime action. |
| CapabilityCatalog.tsx | Containers / Components / Examples / Patterns tabs; search; scope picker; choose catalog capability; New project from starter; Create [example]; Saved architecture templates; Reference compositions | Single scope-compatible Library with finite groups/presets/examples; old definitions do not imply runtime support. |
| PatternComposer.tsx | role/resource/relationship binding pickers; variant/options; Apply pattern / Insert template; Cancel | Compatible reusable-composition preview and explicit Add in Library; no business authoring/guarantee claims. |
| ArchitectureLibrary.tsx | Save as architecture template; Save draft; Delete draft; Publish version; Preview insertion; New version; Retire version; search/select template; Cancel/back | Preserve reusable-library lifecycle under Library Presets; no extra toolbar. Public local library publishing is distinct from provider/runtime execution. |
| ArchitectureProofWorkshop.tsx | Study; create/reference composition; Cancel | Library reference presets/examples; preserve design-only status and provenance. |
| ArchitectureReview.tsx | finding navigation; accepted decision/review detail; pattern suggestions; Close | Generate Review; deep editor destinations replaced by card/source context, preserve acceptance provenance. |
| ArchitectureHandoff.tsx | Download Markdown; Download JSON; Download SVG; save review scope/ownership; approve review; Close handoff | Generate Review/Outputs with same revision/fingerprint binding; portable source remains available even for design-only studio. |
| api-reference/ApiWorkspace.tsx | API selector; operation selection; Full API reference; Response schemas and examples; Retry; close | Read-only Generate Review contract/source detail and Outputs. |
| api-reference/ApiWorkspace.tsx | Edit operation; resource configuration; extension Save/Cancel | Excluded manual API/data/business editors removed, stored declarations preserved. |
| GenerateDrawer.tsx | Hide generate output | Close/back within unified Generate; no duplicate drawer. |
| GenerateDrawer.tsx | Output folder; Run baseline check; Fixed acceptance pack | Existing supported generation settings in Generate Activity; no changes to fixed acceptance/runtime capability. |
| GenerateDrawer.tsx | Show findings; Generate / Regenerate; Cancel; app/output links; logs/file-list disclosure | Generate Review, Activity and Outputs. Explicit start only; unsupported studio generation guarded separately. |
| runs/RunsView.tsx | Plan a run; New run settings; Git strategy; Retries after failed attempt; Execution mode | Generate Activity for existing supported flow, preserving restrictions; opening Generate performs no write. |
| runs/RunsView.tsx | each run selection; Start; Resume; Pause; Plan again; Cancel run; confirmation/cancel | Generate Activity run history/controls; keep generation IDs distinct from run IDs. |
| runs/RunsView.tsx | Move task up/down; Edit task; Remove task; confirm remove; Save/Cancel task | Generate Activity supported existing orchestration details. No provider invocation during UX01 inspection. |
| runs/RunsView.tsx | attempts/events/output/diff/usage/ledger/human-help disclosures; Add note; Dismiss error | Generate Activity/Outputs with actual available units and precise errors. |
| chat/ChatPanel.tsx | send; file attach/remove; ask-user choice; per-turn Undo; conversation controls | Existing chat rail; shared studio commands/tools in UX13; display available usage only. No broad chat redesign. |
| settings/SettingsView.tsx | Copy provider setup command; role/provider/model selection; Save settings | Retain Settings. Distinguish model providers from runtime catalog providers. No cloud onboarding. |
| ConfigurationDialog.tsx and standard modals | Close; Cancel; Save/Apply; confirmation/error Retry/Discard | Creation confirms Add; existing-object valid edits autosave via shared controller; preserve explicit reusable-library/recipe/review lifecycle and concise failures. Excluded editors removed rather than hidden. |

No essential retained action is left without a mouse destination. Removed optional surfaces are
explicitly removed, not relocated wholesale. This inventory does not authorize implementing an
extra search, map, deployment editor, raw business editor, or runtime. Later UX15 must compare its
actual surfaces against this record; lifecycle names above must preserve their original restrictions.
