# YouTube v4

YouTube v4 is [YouTube v3](../../v3/notes/README.md)'s design, unchanged, on the templates after
PF06–PF08 of the [production foundations plan](../../../../docs/plans/production-foundations/units.md):
every failure a process survives is logged (PF06), the cache read recovers when its cache stalls
or goes down (PF07), and one bad item never stops a process (PF08). Its `app/` was made by
`update:v2` (PF10) from v3's completed app, so every file the application owns is v3's, byte for
byte, and every generated file is the new export's.

- **Design:** [`inputs/design.json`](../inputs/design.json) and
  [`inputs/blueprint.json`](../inputs/blueprint.json) are copies of v3's inputs: the studio
  project **YouTube v3** at saved revision 171, design SHA-256
  `9762df418108917c71f42de6190c3c756d1db62dbaeca83653b6e9b6db93813f`. Don't pretty-print or
  resave them.
- **Diagrams:** v3's ([Detailed](../../v3/diagrams/detailed.png),
  [Simple](../../v3/diagrams/simple.png)); the design is the same, so v4 has none of its own.
- **What the application wrote:** [`custom-paths.md`](custom-paths.md), v3's list with v4's
  additions at its top.

## Two outputs

| Folder | What it is | Who edits it |
| --- | --- | --- |
| [`generated/`](../generated/) | **Generated code only.** The exact export of [`inputs/design.json`](../inputs/design.json) with Runnable processes on. | Nobody, ever. |
| [`app/`](../app/) | **Generated code plus the rest of the solution.** v3's completed app, regenerated in place by `update:v2`. | The application's own files, and `update:v2` for the generated ones. |

### `generated/`

`pnpm --filter @jeeves/generator export:v2 "$PWD/field-projects/youtube/v4/inputs/design.json"
"$PWD/field-projects/youtube/v4/generated"`: 112 files (5,169,159 bytes), 0 findings, 9 required
gaps and `processes.runnable: true`; manifest SHA-256
`464e381d4ca2d0ecda5576bb14ff5f56e0056ce1ac7b7dc0c05ef97519ef0323`. Biome skips it.

Against v3's `generated/` (the V3-12 export), 21 files differ: `.jeeves/manifest.json`,
`.jeeves/report.json`, the eight `src/processes/` files, ten `src/runtime/` files (`asset-worker`,
`http`, `media-worker`, `module-clients`, `multipart`, `outbox`, `positive-cache`, `process`,
`tile-process` and `valkey`) and `src/modules/dependencies.ts`. `dependencies.ts` and
`module-clients.ts` now hold v3's gap-6 lines (fixed in the generator in V3-18), so they equal
v3's `app/` byte for byte. Every hook file, stub body and product SQL file is generated as in v3.

### `app/`

Made in three steps (PF11):

1. `git archive HEAD:field-projects/youtube/v3/app | tar -x -C field-projects/youtube/v4/app`:
   exactly v3's tracked app files (129).
2. [`app/.jeeves/overrides.json`](../app/.jeeves/overrides.json) lists v3's four scaffold edits
   for template gap 8, each with its reason (below).
3. `pnpm --filter @jeeves/generator update:v2 "$PWD/field-projects/youtube/v4/inputs/design.json"
   "$PWD/field-projects/youtube/v4/app" --check`, then the same without `--check`. Its output is
   [`update.json`](update.json):

| Result | Count | What |
| --- | --- | --- |
| `refused` | 0 | No generated file was edited by hand outside the overrides. |
| `create` | 0 | |
| `replace` | 18 | The 17 changed `src/processes/` and `src/runtime/` files, and `.jeeves/report.json`. |
| `unchanged` | 78 | Generated files already equal to the new export, `dependencies.ts` and `module-clients.ts` among them. |
| `keep` | 11 | The hook files, stub bodies and product SQL that v3 wrote. |
| `keepChanged` | 0 | No hook or stub template changed, so no new version waits beside one. |
| `override` | 4 | `.gitignore`, `compose.yaml`, `infra/edge/nginx.conf` and `package.json`. |
| `remove`, `orphan` | 0 | |

The update then wrote `.jeeves/manifest.json`, which equals `generated/`'s byte for byte. A second
`--check` reported 96 unchanged, 11 kept, the 4 overrides and nothing to replace.

Checked after the update:

- Every file the application owns is v3's, byte for byte: 31 files, the 14 `generated-extension`
  records of v3's manifest and the 17 tracked v3 app files outside it (`"differ":[]`).
- Each override's new generated version, under `app/.jeeves/generated/<path>`, equals v3's
  `generated/<path>`, so v3's edit stands as it was and no patch was needed.
- A copy outside the checkout: `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build`
  and `node --test "test/*.test.ts"` all exit 0, with 19 tests passing.

**The four overrides** are v3's V3-16 scaffold edits, so the edge can serve the browser; the
export serves no browser and has no place for one
([template gap 8](../../../../docs/template-gaps.md)):

| Path | Reason in `overrides.json` |
| --- | --- |
| `.gitignore` | Ignores the built browser (`dist-public/`). |
| `compose.yaml` | The edge mounts the built browser (`./dist-public`, read only). |
| `infra/edge/nginx.conf` | The edge serves the browser at `/`. |
| `package.json` | `first-run` and `start` build the browser first. |

`update:v2` keeps each one and writes the new generated version beside it, under
`app/.jeeves/generated/`, for review. While both equal v3's, there is nothing to carry over.

**Updating again:** run the same `update:v2` command with `--check` first. The directory must be
absolute, with no symlink in its path. A generated file edited by hand is refused by path: restore
it, or list it in `.jeeves/overrides.json` with a reason (each one is a template gap). See the
[generator README](../../../../jeeves-generator/README.md#updating-an-existing-export).

### How to run each

As v3's: Node 24.21.0, pnpm 12.16.1 and Docker. Run `generated/` from a copy outside the checkout,
so the folder stays the bare export. `app/` can run from a copy too. Its `.gitignore` keeps
`node_modules`, `dist`, `dist-public` and `.runtime` out of Git if it runs in place.

```sh
cp -a field-projects/youtube/v4/generated /somewhere/youtube-v4-generated   # or .../app
cd /somewhere/youtube-v4-generated
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
export COMPOSE_PROJECT_NAME=youtube-v4-generated \
  LOCAL_HTTP_PORT=45700 LOCAL_IDENTITY_PORT=45701 LOCAL_OBJECT_PORT=45702
pnpm first-run          # once: about 2 minutes, then 15 containers healthy (app/: builds the browser first)
node scripts/accounts.mjs   # app/ only, once: the creator role and the three local accounts
pnpm stop               # drains every process; keeps volumes and .runtime
pnpm start              # back, with the same credentials and data
```

**Ports:** pick a unique project name and three free loopback ports. Avoid the owner's v1
(4400) and v2 (45400–45402) stacks, any v3 copy, and Jeeves' own ports.

**Where things answer, credentials and the browser** are as in v3's notes
([how to run](../../v3/notes/README.md#how-to-run-each),
[the browser](../../v3/notes/README.md#app)): the browser at `http://127.0.0.1:$LOCAL_HTTP_PORT/`
in `app/`, the edge's `/healthz` and `/api/<tile>/`, Keycloak at `$LOCAL_IDENTITY_PORT` (realm
`sign-in`, client `sign-in-web`), Transcoded videos at `/cdn/video-delivery/`; the passwords from
`node scripts/accounts.mjs` are in `.runtime/secrets/`, never in Git.

**Clean up a disposable copy:**

1. `docker compose --profile '*' down --volumes --remove-orphans`, with the same environment.
2. `docker image rm "$COMPOSE_PROJECT_NAME-app" "$COMPOSE_PROJECT_NAME-media"`.
3. Delete the copy, with its `.runtime`.
