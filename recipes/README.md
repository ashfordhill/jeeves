# Versioned product recipes

A recipe binds an executable diagram to reviewed product implementation, immutable package archives and independent acceptance. Templates still generate contracts, wiring, migrations and infrastructure. The recipe supplies the declared domain behavior, so Runs does not create implementation tasks for it or select an implementation model. Additional work remains explicit.

The first catalog entry is **QR Studio 0.1.0**, experimental: owner accounts and QR links, stable redirects, legacy PNG downloads, saved artwork revisions and bounded owner analytics. In the project menu choose **New from recipe**, configure the product name/tagline/default analytics range, then **Create diagram** and **Generate** with baseline verification. This creates a separate project. The baseline stops the app afterwards; use the generated README's local Compose command to run it. A successful generation is evidence for that configuration, not production certification.

## Configuration and ownership

- `design.recipe` selects a server-owned catalog ID/version and finite configuration. `setRecipe` is a semantic operation with normal revision/undo behavior. Old documents omit it and retain their prior serialization.
- The frontend template's title supplies the product name. Recipe configuration supplies a 1–120 character tagline and a 7/30/90-day initial analytics range. The selected loopback frontend port fixes the local public origin. Core element/capability/resource/operation/connection contracts are checked before generation; unsupported changes appear in Findings.
- Recipe implementations, generated configuration, fixed acceptance and binary artifacts are protected in `jeeves/lock.json`. The lock records the exact recipe manifest SHA-256. Regeneration rejects changed protected files, dependency drift, recipe detachment/version changes and adoption of existing applications.
- `frontends/qrwty-web/src/ProjectExtras.tsx` is project-owned and receives `signedIn`. Add independent UI there. Additional resources, operations, elements and dependencies can be declared without replacing required contracts. Existing operation notes cannot redefine supplied behavior; changed frontend notes or additional operations remain implementation tasks.
- Fresh outputs receive a private mode-0600 ignored `.env` with a random database password and stable loopback public origin. Existing values are retained. Conflicting public origins or ambient database-password overrides stop generation. Changing an origin after printing links needs an explicit migration, not a port edit.

## Provenance and release boundary

`qr-studio/0.1.0/manifest.json` pins source and artifact hashes, required dependency/runtime versions, provided operations and fixed acceptance. Its consumer implementation comes from qrwty commit `9bc54675f607ce05c22f86ec33c704ce1d322f1d`; component/generator context is Jeeves `9e03c55c32bfb382a6c7abb034cae7905930f682`. P19 adapts that snapshot for configurable branding/date range and the project-owned UI seam, adds explicit non-submit button types, formats source and documents intentional effect triggers. No upstream enterprise-reference runtime code is included.

Once committed, do not edit a released snapshot or repack its artifacts under the same version. Publish a new recipe version with reviewed compatibility/migration and ownership changes. The catalog is trusted repository code; requests cannot upload implementation source or select filesystem paths. This first recipe supports new outputs only; it does not take ownership of the existing qrwty app.

## Repeatable evidence

`pnpm work run qr-studio-recipe` generates into an empty temporary directory, installs its frozen lockfile, builds the frontend, runs template packs and all protected QR-01–QR-16 acceptance through the normal generation baseline, and removes its disposable databases/containers. It reads only the registered recipe and Jeeves templates, never a live consumer checkout. Cancellation still runs cleanup; cleanup failures retain the disposable directory and are reported as failures. Full logs and repository fingerprints go to `.jeeves-work/runs/`.

Focused offline checks cover deterministic regeneration, old documents, protected source/artifacts, dependency pins, compatibility, environment preservation, API creation/undo and zero implementation-model calls. The browser creation journey preserves the previous project. Exhaustive configuration, security, load/soak, disaster recovery, upgrades between recipe versions and distributed deployment are deferred; neither a recipe nor these checks guarantees a bug-free application.
