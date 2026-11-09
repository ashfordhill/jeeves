# YV2-22 retained local runtime

Allocation selected before first start: **2026-11-08**, Compose **jeeves-youtube-v2**,
HTTP **45400**, identity **45401**, objects **45402**, all bound to 127.0.0.1.
All three ports and the exact Docker project namespace were checked free immediately before
first initialization. Private runtime: `../app/.runtime` (0700), secrets parent 0700.
The initial allocation-note write used an incorrect relative cwd and failed; the shell then
started first-run. This note corrects that record; ports/namespace checks had passed before
runtime creation. Preserve this runtime, credentials, fixture, databases, objects, index and volumes.

From `field-projects/youtube/v2/app` with Node24.21.0 / pnpm12.16.1:

```sh
export COMPOSE_PROJECT_NAME=jeeves-youtube-v2
export LOCAL_HTTP_PORT=45400 LOCAL_IDENTITY_PORT=45401 LOCAL_OBJECT_PORT=45402
pnpm start
# Stop normally, retaining all data:
pnpm stop
```

The first initialization uses `pnpm first-run`, only once for a genuinely new runtime after
`pnpm install --frozen-lockfile --ignore-scripts`. Never replay setup or delete volumes over this
retained stack. Start builds backend/browser using the app's own frozen dependencies.
Public `runtime-config.js` is emitted from the same selected ports and generated identity
binding used by provider setup/backend: realm `identity`, client/audience `identity-web`, exact
loopback HTTP callback `/`. Alternate fresh runs select their own free three ports/project via
those environment variables; no source edit or hardcoded45401 asset is needed. Realm/client are
fixed by the generated identity selection, rather than independent overrides.

Owner entry: <http://127.0.0.1:45400/>. Username `creator`; read its password locally from
`../app/.runtime/secrets/creator_password` without copying it into logs or feedback. The second
owned test account is `other-creator`, password file `other_creator_password`. These admin-managed
local accounts are not an account-creation product feature.


Ready retained demo: **9abde227-6abb-4ee0-817e-3d94d90911ea**, title **YV2-22 tourmalineazure public fixture**,
description keyword **zirconcerulean**, channel **creator**. Search any complete keyword or open
<http://127.0.0.1:45400/?watch=9abde227-6abb-4ee0-817e-3d94d90911ea>. Final observed count **2**; legitimate later owner playback
can increase it. Mouse play/seek and automatic counts are functional. Human listening remains open.

Normal stop/start in YV2-22 retained the credential-set digest and all five exact volume identities,
all14 services healthy; mouse search/Watch decoded retained media and creator login still worked.
The ready record, invalid-media failure and aborted upload remain. No bootstrap/credential rotation,
volume reset, media/index/database cleanup or owner v1 stop occurred. Review password files are0600;
provider-created mount files retain generated permissions under the0700 runtime parent.
