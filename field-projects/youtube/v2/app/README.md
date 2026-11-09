# YouTube v2 local field app

The untouched generated backend is commit `695addeb3ac4a77c3a6fbfd2f68d901fced3619f`.
YV2-22 reuses the v1 browser as custom UI and adds build/runtime integration. Historical
`.jeeves` output remains unchanged; its runtimeVerification:none and strictReadiness:not-assessed
are generation-time facts. Actual observations and provenance live in `../notes/`.

Use Node **24.21.0**, pnpm **12.16.1**, Docker with Compose, and this directory's frozen lock:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
export COMPOSE_PROJECT_NAME=my-unique-youtube-v2
export LOCAL_HTTP_PORT=45500 LOCAL_IDENTITY_PORT=45501 LOCAL_OBJECT_PORT=45502
pnpm first-run
```

Choose a new project and three free loopback ports together before first-run. Never use those
example values against existing resources. The retained owner stack is `jeeves-youtube-v2` on
45400/45401/45402, with private `.runtime`0700 and five volumes. Preserve it. For its normal restart,
use exactly that project/port allocation with `pnpm stop` and `pnpm start`; keep credentials and
volumes. First-run initializes a genuinely new runtime only; interrupted single-use storage
bootstrap requires inspection, not blind replay. Normal start rebuilds server/browser and checks
the recorded runtime identities. Dependencies must remain installed from this app's own lock.

Open `http://127.0.0.1:<LOCAL_HTTP_PORT>/`. Public search/Watch need no login. For uploads, an
administrator provisions a local Keycloak user with realm role `creator` (no signup UI). The
identity console is at `http://127.0.0.1:<LOCAL_IDENTITY_PORT>/`; admin username is `admin`, password
is read locally from `.runtime/secrets/identity-admin-identity`. Realm is the generated `identity`,
public PKCE client and backend audience `identity-web`, exact callback is the selected HTTP
origin plus `/`. Runtime public config derives from these same bindings and ports; copy/start
with different free ports without editing sources. No independent realm/client override is offered.
Do not put passwords/tokens into logs or source. A frozen review operator harness is linked from
`../notes/scenarios.md`; it provisions two review users privately without adding an app feature.

Retained owner username `creator` uses `.runtime/secrets/creator_password`; `other-creator` uses
`other_creator_password` (0600). The retained fixture is `.runtime/media/youtube-v1-fixture.mp4`.
Its title/description, upload controls, pause/reselect/resume, abort, status, public search and
standard HLS player are the reused v1 interface. Read `../notes/runtime.md` for the ready demo.

Migration owners/admin are setup-only. Media/indexer have no SQL credential; originals are private.
This local HTTP/single-instance demo has no production-security, HA, arbitrary-codec, fraud, crash-
recovery or template certification claim. Public output keys can expose guessed partial/orphan
objects; Watch/search return only committed ready records. Human listening remains unobserved.

Only an explicitly disposable owned copy may be removed using its recorded project/ports and
`docker compose --profile '*' down --volumes --remove-orphans`. Never clean the retained runtime.
