# Glossary

| Word | Means |
| --- | --- |
| Tile | A box on the canvas: a service, worker, store, queue, CDN, identity or external API. In the saved design it is an *element* with a studio *binding*. |
| Kind | What a tile is (`service`, `worker`, `database` and so on). The small grey word under a tile's name is its *label*. |
| Link | A line between two tiles (a *connection* in the saved design), or from an action to a tile (an *entry*). Solid is a direct call. Dashed goes through a Queue or Topic. |
| Action | What the user does in a lane (Watch, Publish). It generates no code. |
| Module | A part inside an application tile (a *component* in the saved design). It is the unit of generated code. |
| Logical owner | The declared authority over product state. Independent API/Worker processes may explicitly share an owner with distinct credentials and exact grants. |
| Process identity | The stable identity of one generated process role, distinct from its display name and logical owner. Copies of that role share it; a same-owner Worker does not inherit another process's remote authority. |
| Capability | An installed callable contract with bounded DTOs, version, effect and authority requirements; a link is usable only when its installed binding satisfies them. |
| Template | Generated, working code for one mechanism (sign-in, multipart upload, cache read). Its *lead* module selects it once its *parts* are connected. |
| Stub | A module with no complete template. It exports as a typed file that throws "Not implemented" until written. The file's `settings` export declares the settings it reads, which its process checks at startup. |
| Generated, Building block, You write it | The studio's words for a module that leads a template, is part of one, or is a stub. |
| Hook file | `src/modules/<tile>/<lead>.hooks.ts`: the product decisions a template asks for. The application's own. |
| Scaffold | Every generated file that is not a hook file, a stub body, a product SQL file, `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml`. Never edited by hand. |
| Selection | The saved record that a template or a stub generates a module (`generation.selections`). |
| Runnable processes | The export option that makes each application tile its own process. |
| Edge | The nginx container that publishes public tiles at `/api/<tile>/` and a CDN at `/cdn/<cdn>/`. |
| Published view | A SQL view a writing module puts in the `published` schema. Other tiles may read only these. |
| Study | A built-in example design that New project offers. |
| Field project | A real application built from a Jeeves export to test the templates (`field-projects/`). |
| Template gap | Something a template could not do, found in a field project ([list](template-gaps.md)). |
| Override | A legacy preservation record in `.jeeves/overrides.json` for a generated edit and its template gap. Same-version updates may keep it, but the API8 scaffold checker still refuses the edit and incompatible API migration refuses overrides; preservation is not guarded-contract conformance. |
| Update | Regenerating into an existing export with `update:v2`. |
| Extension API | The versioned public boundary for application hooks/operations; current API8 exposes immutable DTOs and scoped handles while generated code owns credentials, lifecycle, transactions, ACKs and recovery. |
| Durable work | Persisted accepted intent with database-time leases, fences, bounded retries and explicit terminal/unknown outcomes; a lease alone does not guarantee exactly-once effects. |
| Recovery ticket | A callee-owned opaque expiring token selected and persisted before generated remote work executes. Its stable work identity and selected ticket survive holders; expiry never permits replacement execution. |
| Unknown outcome | The effect may have happened. Recover through retained replay or reconcile explicitly; timeout/cancellation is not proof of failure. |

## Version names

| Name | What it versions |
| --- | --- |
| YouTube v1, v2, v3, v4 | Field project versions under `field-projects/youtube/` |
| `studio-youtube@2.2.0` | The built-in YouTube study |
| `local-v1`, `local-v2` | Generator template registries. `local-v1` is frozen and legacy. |
| schema 2, schema 3 | The saved design's `schemaVersion` |
| blueprint 2, blueprint 3 | The read-only blueprint API |
| extension API8 | The generated hook/operation boundary, separate from design schema and blueprint versions; incompatible old bodies require explicit migration/checks. |
| eval 1.1.0, design evals 2.0.0 | Chat evaluation suites |
| `source-loc-v2` | The backend LOC benchmark's method |
