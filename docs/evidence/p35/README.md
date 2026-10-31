# P35 — independent local application sessions

Completed 2026-10-31 against the [P35 specification](../../build-plan-qrwty-authoring.md).
The live QRWTY app, its saved design, accounts, records, QR URLs and generated output
were not modified, regenerated or restarted. It has **not** adopted this release.

`rest-api-server@0.2.0` explicitly selects frozen `@jeeves/rest-server@0.3.0`.
The cookie name is `jeeves_session_` plus the first 32 lowercase SHA-256 hex
characters of normalized validated `PUBLIC_ORIGIN`'s `URL.origin`. Read, write and
logout use one helper. Legacy/unrelated/other-origin cookies are ignored and never
cleared. Opaque token/storage hashes, lifetime, flags, exact Origin/CSRF guards,
owner filtering, schemas and response bodies are unchanged. New OpenAPI metadata
explains its deployment-dependent cookie-name placeholder; old contract output is
unchanged. See [session transition and limits](../../../templates/rest-api-server/session-transition.md).

The original attachment 0.1.0 keeps runtime 0.2.0. It was packed before source
changes and matched the existing QR Studio recipe archive byte-for-byte. Runtime
source remains separate from old generated runtime binding. Both modules/manifests
are registered; no compatible element-upgrade allowlist changed. The generator's
one-runtime-per-package restriction remains; the harness now refuses conflicting
selected module sets before any writes, in either order. Frozen backend dependencies
also receive existing archive/production-pin protection; a missing package manifest
now gives a restore instruction. The legacy golden lock changed only to record
that protection and checksum, with no application-source or runtime-pin changes.

| Archive | SHA-256 |
| --- | --- |
| REST 0.2.0 | `33c6fcc3890335dfa39d659a029244ead363c17e65777079470c23c15f5381c6` |
| REST 0.3.0 | `a1dace57d6381a93e07201fa5d64ea887488216a6399298b14ef82b111869fc6` |

Both [release manifests](../../../artifacts/rest-server/README.md) and every recorded
source hash were verified. A second 0.3.0 `pnpm pack` reproduced the same archive.
Only compiled session code, the new helper export/declarations and package version
differ between archives. Published recipe/starter trees, prior artifact files and
fixture designs remain unchanged. No SQL migration or dependency upgrade was added.

## Actual checks

All listed passing profiles reported unchanged source fingerprints. Full stdout and
JSON metadata are under `.jeeves-work/runs/<id>.log` and `<id>.json`.

| Command/profile | Result | Evidence ID |
| --- | --- | --- |
| `pnpm work run unit` with session/runtime/command/generation/workspace/pool/catalog files | 28 tests / 7 files, 2.9s | `2026-10-31T15-49-18-000Z-unit-76de7a3e` |
| `pnpm work run templates templates/rest-api-server/conformance/rest-api-server.conformance.ts` | 22 tests, both releases, 109.7s | `2026-10-31T15-46-07-052Z-templates-a964a312` |
| `pnpm work run session-isolation` | Complete generated-app proof and cleanup, 127.2s | `2026-10-31T15-49-55-986Z-session-isolation-08107936` |
| `pnpm work run check` → `pnpm check` | Lint, all workspace/script types, 656 tests / 98 files, 44.3s | `2026-10-31T15-50-15-935Z-check-25fef5ad` |

Focused unit selections were `packages/generator/src/{session-isolation,workspace,http-pools}.test.ts`,
`templates/rest-api-server/runtime/src/{sessions,resources}.test.ts`,
`templates/rest-api-server/commands.test.ts`, and `apps/server/src/routes/templates.test.ts`.
An earlier passing focused profile (`2026-10-31T15-42-46-158Z-unit-d8dd2ccd`) also covered
registry and unchanged recipe artifacts: 45 tests / 6 files. Unit storage is injected;
legacy compiled archive tests use installed dependencies and Fastify injection,
without listening sockets, Docker, Postgres or network access.

The full proof generated A and B as independent projects with actual loopback origins
and separate databases. It generated legacy/current transition outputs independently,
with identical immutable resource migration hashes. All four consumers built and
typechecked from compiled archives with zero implementation tasks. Regeneration kept
project-owned extras, private `.env` and protected files.

Pinned Playwright **1.63.0 / Firefox 155.0**, Node **24.21.0**, pnpm **12.16.1**:

- A, B and the legacy app used pages in **one browser context**. Ordinary UI registration
  created one primary account in each app and distinct warehouse records. The real cookie
  jar held two origin-derived cookies plus the unchanged legacy cookie; no cookies or
  authenticated responses were injected/mocked.
- Two-way login/refresh/logout checks retained the other app's authentication and data.
  Returning login used the same primary account IDs. An incorrect password failed visibly.
- A new private context was anonymous in both apps. Its second owner could neither read
  nor update A's first owner's record (404). Missing/wrong CSRF and wrong/missing Origin
  were rejected (403); session lookup and ordinary logout remained real.
- Restarting A's API at the same origin retained its cookie, account and record.
- The legacy fixture changed only its API build source to the separately generated current
  output. Database volume/credentials, public origin and frontend stayed in place. Every
  public table OID survived; no schema rebuild/reset occurred. The legacy cookie alone got
  401, ordinary login retained the original account/resource IDs, and new logout left the
  legacy cookie untouched. This is storage/protocol compatibility, not a protected-repository
  adoption mechanism.
- Six existing passive REST checks verified served contracts and handler coverage across
  A, B and legacy. The separate selected conformance suite ran the full stateless REST/HTTP
  packs on both releases. Strict browser collectors accepted only exact expected negative
  HTTP responses; unexpected page, console and network errors remained failures.
- Final screenshots [A](application-a.png) and [B](application-b.png), captured from the
  shared context after the transition, were visually inspected. Both show their own record
  and working signed-in workspace. Screenshots support the executable journey, not replace it.
- Teardown removed each named fixture's containers, volumes, networks, local images and
  temporary generated output. Docker inventory checks confirmed no fixture containers,
  volumes or networks remained. The failed initial browser run also cleaned up. No blanket
  prune, live data reset, paid model call or public deployment occurred.

Initial failures were fixture/expectation issues: missing error responses in the injected
unit contract, stale catalog/archive-count/golden-lock expectations, the newly earlier
frozen-dependency missing-manifest refusal, and browser assertion wording (`Invalid credentials`
instead of the existing UI's `Email or password was not recognized.`). The failed browser
profile is `2026-10-31T15-46-07-049Z-session-isolation-1556c016`; the initial gate is
`2026-10-31T15-46-07-048Z-check-fedd2d1b`. Neither is represented as passing evidence.
No runtime authentication or browser-diagnostic weakening was used to resolve them.

Final source/artifact/ownership diff review and `git diff --check` passed. Biome's required
gate checked 671 files: 462 nonblocking warnings, 74 infos, no errors. The existing Chromium
completed-stream defect remains; this proof follows P32's pinned Firefox route without
changing the frozen client, cache/stream limits or diagnostics. There is no broad browser,
load, chaos or multi-region certification claim.

One session-backed application per public origin remains the supported boundary; distinct
paths, SSO and hostile same-host isolation are outside P35. Adoption or an origin change
requires one ordinary sign-in with existing credentials. Legacy applications still collide
with each other until separately adopted. Live QRWTY adoption, polished attachment upgrades,
developer testing mode and page flow remain queued.

Next bounded authoring package to specify: **useful QRWTY architecture** (explicit
responsibilities and operation/resource/dependency bindings, concise cards, direct scoped
configuration, context and fit). Persistent developer testing, page flow/public entry and
composable QR adoption follow in separately specified packages. P35 stops here.
