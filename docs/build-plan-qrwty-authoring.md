# QRWTY authoring: fresh-agent execution handoff

Updated 2026-10-31. **P35 is implemented and verified:** see [release evidence](evidence/p35/README.md) and the latest handoff. P12–P35 are complete. The next bounded authoring package to specify is useful QRWTY architecture, listed in the queue below. The old P35 business-action-forms idea was never implemented and is superseded; P35 now names the bounded session correction below. The [authoring review](qrwty-authoring-review-2026-10-31.md) remains the product direction and evidence, while this file is the implementation specification.

The P35 execution instruction was to implement **P35 only**, run its checks, append the handoff and create its local commit. Do not automatically proceed into the older delivery roadmap or implement all of the review at once. Later packages are queued below but are not yet implementation specifications. The specification below records that bounded release contract; completion does not authorize the queued packages.

## Read first and preserve

1. Read root `AGENTS.md`, `PLAN.md` §15 and the relevant §§1–14, then the latest `docs/handoff.md` entries.
2. Read this file and `docs/qrwty-authoring-review-2026-10-31.md`; use `docs/evidence/qrwty-authoring-review/README.md` for the reproduced problem.
3. Inspect `git status` and the initial diff. Existing unrelated work includes 52 earlier added lines in `docs/handoff.md`, an older status-paragraph edit in `docs/improvements.md`, untracked `docs/build-plan-next.md` and `docs/reviews/`, and `~/github/qrwty/business-analysis/`. Do not stage, discard or rewrite them. Use the actual status if it has changed.
4. Read only the implementation pointers below as needed. No paid coding-model calls, dependency upgrade campaign or further architecture research is needed for this package. Do not delegate to sub-agents unless separately requested.

The running source project at `~/github/qrwty` and its Jeeves saved design are reference inputs. P35 proves the new behavior in disposable applications; it does not regenerate/restart the user's application, change its accounts/data/QR URLs, or silently adopt a new recipe. The audit saw QRWTY saved revision 4 with three generated elements plus an unbound Service; re-read current state instead of assuming the revision is unchanged.

## P35: independent sessions for local generated applications

### Outcome

Two generated applications on the same loopback hostname but different ports can remain signed in in one browser profile. Login/logout in one does not replace or clear the other's session. Existing accounts continue to support ordinary login; this package does not add tester auto-login or a public landing page.

The current runtime sets `jeeves_session` with `Path=/`. Browsers share this cookie across ports. The audit reproduced cookie replacement using two disposable HTTP servers. This is a confirmed mechanism for unexpected sign-outs, not proof that the user's accounts were deleted or that repeated registration is necessary.

### Implementation contract

**Cookie identity.** In the new runtime, derive the cookie name deterministically from the already validated deployment `PUBLIC_ORIGIN`: `jeeves_session_` followed by the first 32 lowercase hexadecimal characters of SHA-256 of its normalized `URL.origin`. Use the same helper for writing, reading and clearing the cookie. Include the port through `URL.origin`; default-port/trailing-slash equivalents normalize to the same identity. Do not use a mutable display name, common element ID, request Host/Origin header, random process value, source directory or secret. The same deployed origin across API replicas/restarts must give the same name.

The current supported deployment has one session-backed application per public origin. Distinct apps behind different paths on one origin, intentional shared login/SSO and user-supplied cookie names are outside P35. Origin-derived names prevent accidental cross-port collisions; they do not provide isolation from hostile applications on the same hostname.

**Authentication behavior.** Preserve opaque random tokens, hashing in storage, seven-day lifetime, HttpOnly, SameSite=Strict, Path=/, HTTPS Secure behavior, exact trusted-origin checks, CSRF, owner filtering and existing response shapes. No resource/account schema or SQL migration is needed. Registration, login and logout must not read, overwrite or expire another application's cookie. Ignore the unscoped legacy cookie in the new runtime; never use it as a fallback and never clear it opportunistically, since a legacy app may still own it. Other unrelated cookies must be ignored.

**Session transition.** Adoption of the new runtime, or changing the configured public origin, requires signing in once again. Existing account credentials and application records remain valid; do not require registering a new account, deleting old accounts or resetting the database. Existing session rows can expire normally. Document that legacy applications still using the old shared cookie continue to collide with each other until separately upgraded. Do not claim P35 repairs the running QRWTY merely because the new release passes.

**Versioning and generation.** Publish a new `@jeeves/rest-server@0.3.0` artifact and expose it through `rest-api-server@0.2.0`, keeping the existing attachment 0.1.0/runtime 0.2.0 path available with its original behavior. These version numbers were unused at handoff; verify availability before starting and document a collision if another package has since used them. The attachment's structured resource/auth configuration and wire protocol remain the same. The new attachment is an explicit choice for new designs; existing stored references and frozen starter/recipe designs stay pinned.

Before changing runtime source, preserve a reproducible legacy 0.2.0 artifact with hash/provenance using the existing frozen-runtime mechanism. An already archived 0.2.0 may be reused only after checking it represents the pre-P35 behavior; do not replace any published archive or its checksum. New source must not be repacked under the old version. Retain old exports, register both manifests/modules and make generation select the runtime belonging to the selected template version. A version bump alone must not silently change every legacy design's runtime binding.

The current generator rejects conflicting runtime bindings by package name. Retain that bounded restriction: mixing old/new REST runtime versions in one generated project may fail before writes with a useful error. It must never choose a version based on iteration order. The two-app regression should use separate generated projects. The template harness also indexes runtime dependencies/archives by package name: keep its selected module list unambiguous and add refusal if the new registration would otherwise silently select one conflicting version. A general multi-version dependency resolver is outside this package.

Do not route this change through the existing `upgradeTemplate` compatibility list: that mechanism is for element templates and promises unchanged runtime behavior. The REST server is an attachment and this change deliberately expires the browser's effective session. New-design selection through the existing attachment machinery and a documented session transition are sufficient for P35. A polished attachment-upgrade UI and adoption into existing protected outputs are separate work.

### Implementation pointers

| Area | Read/change as needed |
| --- | --- |
| Session identity and guards | `templates/rest-api-server/runtime/src/sessions.ts`, `resources.ts`, `resources.test.ts`, `runtime/package.json` |
| Attachment versions and generation | `templates/rest-api-server/manifest.ts`, `template.ts`, `generate.ts`, `package.json`; add versioned manifest/module using existing template conventions |
| Registration | `packages/registry/src/builtin.ts`, `registry.test.ts`, `packages/generator/src/modules.ts` |
| Runtime ownership | `packages/template-kit/src/contract.ts`, `frozen-runtime.ts`, `harness/project.ts`; `packages/generator/src/plan.ts`, `generate.ts`, `recipes.ts` |
| Compatibility reference, not an upgrade shortcut | `packages/spec/src/template-upgrade.ts`, `operations.ts`, `apply.ts`; `packages/generator/src/template-upgrade.test.ts` |
| Existing tests and disposable setup | `templates/rest-api-server/conformance/rest-api-server.conformance.ts`, `resource-tests.ts`; `packages/generator/scripts/verify-resource-workspace.ts`, `verify-generated-workspace.ts`; `packages/resource-workspace/conformance/browser-proof.ts` |
| Reusable verification/logging | `scripts/lib/work.ts`, `scripts/work.ts`, `docs/developer-workflow.md`, `packages/template-kit/src/page-problems.ts` |

The generator/helper may import current runtime source for contract validation while legacy output consumes its pinned archive. Test both paths; changing those imports must not accidentally make old generated application behavior consume the new session code. Existing generated HTTP cookie tests mostly capture response cookies dynamically; update only assumptions specific to the new version, preserving legacy coverage.

### Required acceptance

1. **Offline identity/runtime checks.** Normalized equivalent origins produce equal names; different ports produce distinct names; restart/config reload retains identity. Test read/write/logout against the selected name, ignored legacy/unrelated cookies, flags/lifetime, unauthenticated behavior, Origin/CSRF rejection and owner isolation. Use injected storage/Fastify injection: unit tests must not require listening sockets, Postgres, Docker or network. Preserve the old behavior tests rather than replacing every expected cookie name with the new one.
2. **Generation and release checks.** New attachment output pins the 0.3.0 artifact and has deterministic output/ownership with zero implementation tasks for ordinary resources. Legacy designs still select 0.2.0; existing recipe/starter archive bytes/hashes and their runtime pins remain unchanged. Regeneration preserves project-owned source, private environment and generated-file refusal. A mixed-version design fails before output writes. Tests must exercise the compiled archives as well as workspace source through the integration proof.
3. **Real two-app browser proof.** Add a named `pnpm work run session-isolation` profile using existing disposable generation/Compose/browser helpers. Run two small generated owner-resource apps at different `127.0.0.1` ports, with separate application storage and their actual public origins, in the **same browser context**. Register once per app, create distinct records, and demonstrate A remains authenticated after B login, refresh and logout. Reverse the direction; prove re-login uses the existing account and preserves data. A new private browser context must still be anonymous. Use real app sessions and the browser's cookie jar, not manually injected tokens or mocked authenticated responses.
4. **Restart/transition proof.** In the focused disposable fixture, prove a service restart at the same public origin preserves a current session. Separately seed an account/resource using the legacy runtime, then run the new generated version against that same disposable storage/public origin without rebuilding the schema. Legacy-cookie access is anonymous; ordinary login with the existing credentials succeeds and the resource survives. This proves protocol/storage compatibility, not a general generated-repository upgrade. No protected-file hash bypass is allowed to construct the fixture; prepare old/new generated outputs independently and switch only the fixture runtime.
5. **Ordinary authentication remains real.** Browser/API acceptance must still cover registration, incorrect credentials, session lookup, logout, missing/wrong CSRF, wrong origin and cross-owner access. Reuse existing conformance/acceptance where it already proves these boundaries. Expected negative responses should be narrowly declared; unexpected browser/network errors stay failures. User tokens/passwords must not appear in the evidence log.
6. **Required gate and review.** Run focused checks during development, the selected existing REST conformance suite where applicable, the new `session-isolation` proof, and final `pnpm work run check` (which executes the required `pnpm check`). Run `git diff --check`, inspect output/artifact/ownership diffs, and record exact profile logs, test totals, engine/version and cleanup. Do not rerun unrelated full product/load suites without a changed boundary or failure justifying them.

Use pinned browsers. P32 documents a Chromium completed-stream false-abort issue for the frozen bounded resource client. If using that client in the new fixture, use the existing pinned Firefox route and retain strict diagnostics, as the generated-pool proof does. Do not suppress the diagnostic, weaken cache/stream limits, or upgrade browsers as part of this fix. A small cookie-only probe is supporting evidence; it does not replace the real application proof. All disposable services bind to loopback and teardown removes only their own containers/volumes, including failure/cancellation paths.

### Not in P35

- Developer auto-login, tester accounts/scenario controls or a persistent sandbox product UI.
- Public landing pages, routing/page-flow contracts, architecture grouping or editor redesign.
- Themes, page layout tools, new authentication providers, SSO, password reset or session-lifetime changes.
- Rewriting published recipes/starters, live QRWTY adoption, account/data deletion, changing public QR origins, cloud deployment or general multi-version runtime resolution.

### Done when and handoff

P35 is complete when the selected new template version passes the same-browser two-app and legacy-account transition proofs, old releases retain their behavior, and the required checks pass. Append the actual implementation/verification/limits to `docs/handoff.md`, add evidence under `docs/evidence/p35/`, and create a scoped local commit titled `P35: isolate generated application sessions` (or a similarly specific P35 title). Preserve all unrelated staged/unstaged/untracked work. Local commits have standing authorization.

The final report must say whether the live QRWTY app has adopted the release; under this specification it has **not**. Identify the next authoring package and any actual blockers, then stop. Do not silently mark the developer mode, public landing or page-flow work complete.

## Queued work after P35 — specify before coding

The next agent must retain this direction without implementing these broader items in P35:

| Order | Intended package | Completion evidence to specify |
| --- | --- | --- |
| 1 | Useful QRWTY architecture | Explicit responsibility descriptions and operation/resource/dependency bindings; concise cards; direct selected-object configuration; populated context and readable fit. Mouse Save/Cancel/undo/reload; no invented dependencies or loss of endpoint detail. |
| 2 | Persistent developer testing | Open test app with reusable tester/visitor, isolated persistent data, empty/sample scenarios and scoped reset. Real sessions and cross-owner tests remain active. No repeated registration or interference with normal QRWTY. |
| 3 | Page flow and public entry | One finite page/transition model drives the graph and generated router/screens. Public landing, separate login/register, guarded workspace, valid return targets, Back/refresh and content configuration. Preserve `/q/:id`. |
| 4 | Composable QR product and reviewed adoption | QR/Studio/analytics capabilities generate an editable QRWTY-equivalent product without implementation-model calls. Prove content/navigation/behavior edits and safe adoption in a disposable copy before applying to the existing application. |

Keep page purpose/access/data/actions/content in Jeeves. Keep theme/font/color/pixel-layout authoring in a future companion; retain functional default presentation and QR artwork controls. A recipe that reproduces a snapshot is useful but does not by itself satisfy editable capability composition. Business-action forms can be considered within these needs later; the superseded standalone P35 proposal is not next work.
