# Glossary

| Word | Means |
| --- | --- |
| Tile | A box on the canvas: a service, worker, store, queue, CDN, identity or external API. In the saved design it is an *element* with a studio *binding*. |
| Kind | What a tile is (`service`, `worker`, `database` and so on). The small grey word under a tile's name is its *label*. |
| Link | A line between two tiles (a *connection* in the saved design), or from an action to a tile (an *entry*). Solid is a direct call. Dashed goes through a Queue or Topic. |
| Action | What the user does in a lane (Watch, Publish). It generates no code. |
| Module | A part inside an application tile (a *component* in the saved design). It is the unit of generated code. |
| Template | Generated, working code for one mechanism (sign-in, multipart upload, cache read). Its *lead* module selects it once its *parts* are connected. |
| Stub | A module with no complete template. It exports as a typed file that throws "Not implemented" until written. |
| Hook file | `src/modules/<tile>/<lead>.hooks.ts`: the product decisions a template asks for. The application's own. |
| Scaffold | Every generated file that is not a hook file, a stub body or a product SQL file. Never edited by hand. |
| Selection | The saved record that a template or a stub generates a module (`generation.selections`). |
| Runnable processes | The export option that makes each application tile its own process. |
| Edge | The nginx container that publishes public tiles at `/api/<tile>/` and a CDN at `/cdn/<cdn>/`. |
| Published view | A SQL view a writing module puts in the `published` schema. Other tiles may read only these. |
| Study | A built-in example design that New project offers. |
| Field project | A real application built from a Jeeves export to test the templates (`field-projects/`). |
| Template gap | Something a template could not do, found in a field project ([list](template-gaps.md)). |
| Override | A generated file the application keeps as its own, listed in `.jeeves/overrides.json` with a reason. Each one is a template gap. |
| Update | Regenerating into an existing export with `update:v2`. |

## Version names

| Name | What it versions |
| --- | --- |
| YouTube v1, v2, v3, v4 | Field project versions under `field-projects/youtube/` |
| `studio-youtube@2.2.0` | The built-in YouTube study |
| `local-v1`, `local-v2` | Generator template registries. `local-v1` is frozen and legacy. |
| schema 2, schema 3 | The saved design's `schemaVersion` |
| blueprint 2, blueprint 3 | The read-only blueprint API |
| eval 1.1.0, design evals 2.0.0 | Chat evaluation suites |
| `source-loc-v2` | The backend LOC benchmark's method |
