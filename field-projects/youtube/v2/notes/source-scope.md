# YV2-22 backend/UI scope review

The YV2-20 [scope](benchmarks/backend-scope.json) remains unchanged: backend `src/runtime`,
`src/features`, `src/adapters`, `src/services`; UI `browser`; exactly four dedicated pure-data
binding files excluded from both backend totals. No UI exists under `src/`.

All generated backend source files remain byte-identical to the93-file baseline commit
`695addeb3ac4a77c3a6fbfd2f68d901fced3619f`. No custom backend adapter/hook or generated backend
repair was necessary in YV2-22. All five browser TS files are reused custom UI, including auth,
API clients, upload state, search and playback qualification; none earns template/backend credit.
Public HTML/CSS and compiled browser assets are UI too. Dedicated build config/scripts, Docker,
Compose, nginx and docs are essential integration changes outside the existing LOC measure,
recorded in provenance rather than hidden as backend logic in an excluded path.

`browser/auth.ts` only reads the public issuer/client/callback emitted by the runtime script.
`scripts/browser-config.mjs` only serializes those three public binding strings; it contains no
business/authentication policy, token validation, counter/upload behavior or service handler.
The real backend JWT/audience validation is the unchanged generated source. Client/realm names
follow the generated identity selection, callback/issuer ports follow the same environment as
provider setup/backend. No secret is public. `scripts/build-browser.mjs` compiles DOM TS and copies
presentation plus pinned hls.js. Package/lock pins are unchanged.

YV2-23 owns the independent reviewed report, final commit pin and strictly>5.53 comparison. Keep
[source-loc-v2](../../../../docs/field-projects/source-loc.md), its parser/LCS, denominator policy,
and historical v1 evidence unchanged. No UI or newly written template is retroactively credited.
