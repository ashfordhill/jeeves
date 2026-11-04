# UX03 — finite definitions and provider compatibility

Complete on primary `main`, from `1989eb1a874e4474cd21e03c4314974b5721861a`.
This unit implements catalog/model metadata only. Studio projections, product Library/forms,
new runtimes, application generation and provider execution remain outside its scope.

[studio-definitions.ts](../../../../packages/spec/src/studio-definitions.ts) supplies all 14
exact `studio-<kind>@1.0.0` definitions. Each has a creation name, scope, library group, role,
existing Tabler symbol/theme color, classification default, exact existing settings validator,
typed creation defaults, explicit field descriptors, real-reference selectors and C4b obligations.
The runtime-support property is absent. Exact lookup never substitutes another version or registers
an executable template. Old planning definitions and the UX02c legacy-family mapping stay intact;
unknown legacy families use the neutral box symbol without acquiring settings.

Descriptors name the single canonical destination: element name/purpose, binding settings/owner,
package membership or canonical planned relationship fields. They reuse UX02 enums, numeric limits
and engine/provider tables. `studioFieldGroups` applies conditions and compatibility before forms
consume them, omitting empty groups and inapplicable controls. Relationship descriptors include
eligible timeout/retry policies and explicit channel roles; context relationships have only action.
Optional numbers/references stay absent. Typed new relationship defaults leave retry unspecified.
`changeStudioSetting` is a pure pending-settings helper: an engine change clears an incompatible
provider; Docker removes Host; browser delivery changes remove inapplicable fields. No helper edits
another object, calls a provider or invents graph structure. Provider identity distinguishes a
named product, ecosystem, integration, self-hosting or unspecified/external intent. Missing artwork
uses the capability symbol; generic clouds imply no unnamed product or compatibility certification.

[studio-presets.ts](../../../../packages/spec/src/studio-presets.ts) supplies the immutable
`studio-service-worker@1.0.0` preset. The caller allocates six distinct IDs. One shared command creates
two independent applications, a package-owned queue and explicit publish/consume connections.
Member settings remain on the applications; the package has no execution/language/provider setting.
Known preset provenance resolves locally; unsupported versions remain explicit readiness gaps.
Creation/validation use the catalog's classification defaults. Generation remains design-only.

Evidence and actual observations:

- [Serialized catalog](catalog.json) records every descriptor, provider identity/compatibility row,
  typed default, scope and the preset expansion. [Model observations](model-observations.json)
  compare every settings-schema property against its one descriptor and check 34 applicable
  variants, 365 select values, 50 numeric boundary/decimal cases and 83 engine/provider combinations.
  Hidden-field cleanup, idempotent variant selection, exact versions, neutral fallback, frozen
  metadata, atomic preset application, portable round-trip and absent runtime registrations pass.
- [API observations](api-observations.json) record 21 successful saves to one owned disposable project.
  All 14 settings kinds, canonical names/purposes, logical owners, reference selectors, connection
  timeout/fixed-retry/channel fields and package provenance persist and reload. Provider selection
  leaves element/connection/package structure unchanged. Engine, Docker and browser variant changes
  remove inapplicable values. An incompatible provider returns 422 and preserves revision/state.
  Undo/redo and portable export preserve values. All 13 pre-existing projects retain their exact
  design/layout hashes and revisions. The disposable project was [deleted and verified 404](api-cleanup.json).
- [Browser observations](browser-observations.json) cover existing QRWTY C2/API-C3 at 1440×900 and
  1280×800: four views retain 16/22 cards and 21/39 labels. Existing saved cameras still clip some
  content, as in the UX01 baseline. A disposable browser overlay imports the actual definitions
  and existing Tabler component and displays all 14 defaults at both sizes; every card/icon fits.
  [1440×900 preview](screenshots/catalog-preview-1440x900.png) and
  [1280×800 preview](screenshots/catalog-preview-1280x800.png) were visually inspected. This is a
  verification preview, not an implementation of the later product catalog UI. A guard installed
  before page creation allowed only reads. No write, blocked request, page error, HTTP error or
  console error occurred. Two existing React Flow attribution warnings are recorded. All 13 existing
  projects retain their hashes/revisions after browser inspection.
- [Compatibility observations](compatibility-observations.json) prove all nine old factories still
  emit their UX01 design/layout hashes. Legacy v1 round-trips retain schema version and studio absence;
  unknown studio definition versions remain stored, unsupported and unsubstituted.
- [Preservation](preservation.json) checks the starting tracked files, all seven UX01 fixtures,
  21 original/copied feedback pairs, 48 frozen benchmark files and the append-only handoff prefix.
  `.jeeves-feedback/` remains unrelated/untracked. No sibling repository was edited.

Required commands used Node 24.21.0 / pnpm 12.16.1 with the Node directory prepended to PATH:

| Check | Result |
| --- | --- |
| `pnpm lint` | Exit 0; unchanged 2,797 warnings / 88 infos, no errors |
| `pnpm typecheck` | Exit 0 across workspaces/scripts, including existing source/test types |
| `pnpm --filter @jeeves/web build` | Exit 0; existing >500 kB chunk advisory |
| One-off model/API/compatibility/browser inspections | Passed as recorded above |
| Scoped formatting, preservation and staged Git whitespace | Passed |

Actual CLI logs/results are under [checks](checks/results.json). Browser setup initially needed the
Vite CommonJS module's default export for React DOM, then a more compact verification-only grid to
fit the smaller viewport. Failed setup logs are retained; neither change touched the product UI or
any project. No test fixture adaptation, maintained unit/E2E/template test, snapshot or suite was
created/modified/run. `pnpm check` and all such suites remain explicitly deferred. No provider,
external agent, application generation or backend work ran. UX04a owns the next projection boundary;
this worker stops after UX03's scoped local commit.
