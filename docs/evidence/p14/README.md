# P14 product evidence

The screenshots show disposable test records, captured in Chromium at 1440×1000 and 390×844. No real account data is pictured. The mobile library image includes an expanded row and server-provided test QR preview. Screenshot capture resets scroll to the top: a full-page capture while scrolled can paint fixed offscreen skip-link chrome inside the image, although it is outside the user's viewport.

- [Account entry, desktop](auth-desktop.png) and [phone](auth-mobile.png).
- [Library, desktop](library-desktop.png) and [phone with details](library-mobile.png).

Visual inspection confirmed readable hierarchy, coherent blue palette, responsive navigation, reachable controls and no horizontal clipping. Axe found no violations in the tested signed-out, empty, selected-detail and mobile states. This does not yet constitute the final comparison against Excalidraw/automation-pitch or completion of QR Studio.

Reproduce browser evidence in qrwty with `QRWTY_SCREENSHOT_DIR=/tmp/qrwty-visual pnpm --filter qrwty-web test`. It serves an actual disposable loopback HTTP API, uses ordinary generated-client fetch, scopes all expected negative responses and requires zero Workers. The preview fixture contains an example.test URL and is never used by the application.

Reproduce composed verification from Jeeves:

```sh
pnpm --filter @jeeves/server exec tsx ../../packages/generator/scripts/verify-qrwty-product.ts /path/to/qrwty
```

The verifier checks ownership hashes, copies the consumer without environment credentials, installs its locked packages, builds an isolated stack, runs the four current web test-pack checks and current strict QR-09 journey, removes that database, and runs the eight protected suites in the existing independent behavior verifier's separate stack. The earlier consumer-generated acceptance files remain unchanged; the updated strict journey is supplemental. Both fixtures and their volumes/images are removed. No live Compose project is restarted by this command.

P14 results: Jeeves `pnpm check` passed 536 tests in 73 files (27.58 s; 137 warning and 57 informational lint diagnostics, no errors). The subsequently added adoption script passed its scoped lint/type checks and actual composed execution. qrwty passed install, recursive type checks, 29 service tests and 11 Chromium workflows (9.72 s frontend run), plus production build. Composed checks: four web template checks, one current strict browser journey and eight protected suites passed. Visual recapture selected two browser tests; both passed, with nine intentionally unselected cases already covered by the full run.

The local `:5173` frontend was then rebuilt alone with `docker compose up -d --no-deps --build --wait qrwty-web`. The API/database container IDs were unchanged; a strict read-only anonymous session check passed with zero Workers. All 32 protected generated files retained their hashes. No paid model invocation, live migration or public deployment occurred.
