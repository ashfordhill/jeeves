# Jeeves: execution after the qrwty review

The user has asked to begin execution in a fresh chat. **P12 is the next bounded package.** This document specifies P12 only. The broader product/architecture direction remains in the review documents; it is not a request to implement the whole roadmap in one turn. P7–P11 are historical completed work, with evidence in `docs/handoff.md`.

## Product direction to preserve

- Build a polished qrwty QR Studio, management and analytics experience aligned with `https://qrwty.io/`, extracting generic Jeeves UI, behavior and deployment templates. See [the main roadmap](reviews/jeeves-qrwty-product-plan-2026-10-30.md), especially sections 1, 10 and 13.
- QR customization, visual appeal, saved artwork/export and analytics are in the first product milestone. Preserve existing QR URLs/data and distinguish link identity from artwork revision. Maps/devices come later.
- Model responsibilities using C4-informed views plus structured Screens/Data/Behavior/Deployment editors. Retain React Flow, stable IDs, generated-file ownership, protected acceptance and the existing operations API.
- Design for horizontal/vertical growth, with demonstrated multi-instance behavior and bounded resource usage. Reliability is a reusable, versioned component/policy with visual presets, adapter validation, generated runtime/deployment configuration and failure conformance. See [Studio/scaling section 7](reviews/qrwty-studio-and-scaling-2026-10-30.md#7-reliability-is-a-reusable-visual-capability).
- Standard selected behavior should require zero coding-model calls. AI implements explicit domain extensions; it should not repeatedly invent sessions, forms, retries or event durability.

## P12: browser verification correctness

**Outcome:** a correct frontend using normal fetch can pass checks while handling expected HTTP errors, and real broken requests/application failures remain detectable. Restore the full repo check gate before starting the new product work.

### Read first

Follow `AGENTS.md` and `PLAN.md §15`, including its required skim of §§1–14. Read the latest handoff entries, this P12 specification, the small product-direction references above and the initial working-tree diff. Do not reread all historical package specifications or rerun a paid qrwty proving run.

Starting implementation pointers:

- `packages/template-kit/src/browser.ts`: currently aggregates all browser console errors and uncaught exceptions into the same failure.
- `templates/web-app/test-pack/index.ts`: page-load/sample-call checks use that helper.
- `templates/web-app/conformance/web-app.conformance.ts`: actual generated-web conformance.
- `fixtures/acceptance/qrwty/browser.test.ts`: currently discards all messages matching `Failed to load resource` and broadly filters favicon messages; it also needs explicit uncaught page-error coverage.
- `fixtures/designs/qrwty.json`: inspect only the session contract and frontend notes if required to establish expected behavior.
- `docs/examples/qrwty.svg`: existing missing accessible SVG title is the recorded lint error.
- Read qrwty's `frontends/qrwty-web/src/api/{browserTransport,transport.worker}.ts` only to understand the workaround; do not edit the generated application in P12.

### Implement

1. Separate unexpected application console errors/uncaught exceptions from browser-generated HTTP resource diagnostics. Observe request/response failures at the network layer and produce useful method/URL/status or transport-error evidence.
2. Introduce explicit, scoped expectations for deliberate negative HTTP scenarios. For example, a fresh logged-out session check may return 401 from the declared session operation. Match the relevant operation/request and scenario; do not globally ignore 4xx, console errors, favicon text or every protected endpoint. A declared possible OpenAPI error alone does not mean that error is expected in every scenario.
3. Apply the policy consistently to the web-app test pack and the fixed qrwty browser acceptance. Follow the existing fixed-suite support/copy mechanism so generated tests remain self-contained. Choose a small shared implementation where appropriate; do not create a generic test framework or weaken protected behavior expectations.
4. Preserve failure detection for a wrong status/route, unexpected 401/403/404/500, broken JS/assets, transport failures, uncaught exceptions and real application `console.error`. Distinguish an intentionally cancelled request where supported from an unexpected network failure. Do not suppress an application error merely because its text resembles Chromium's resource-error message.
5. Prove the behavior in a disposable browser fixture that uses ordinary fetch, without a Worker. Include a good signed-out case, a deliberately expected validation failure and deliberately broken application/request cases. Use focused unit tests for classification and actual Chromium coverage for browser event behavior. Unit tests remain independent of Docker, Postgres and external networking.
6. Fix the missing accessible title in the existing example SVG so `pnpm check` can pass. Keep this a small documentation accessibility fix; do not redesign/export the diagram or suppress the lint rule.

### Scope boundaries

Do not implement the QR Studio, new resource schemas, C4 hierarchy, reliability runtime, cloud infrastructure or deployment in this package. Do not remove qrwty's current Worker workaround, regenerate its live project, change its database, or alter QR-01–QR-09 business invariants. The new fixture demonstrates that the workaround is unnecessary; removal belongs to a later controlled application/template adoption package.

Preserve all pre-existing uncommitted editor changes and `apps/web/e2e/editor-interactions.spec.ts`; they are separate pending work, not P12. Existing draft-review documents and prior uncommitted handoff additions must also be preserved. Do not stage whole directories or the whole handoff file blindly. Commit only P12 changes and its own appended handoff content; use an isolated checkout or scoped staging if needed. Do not reset, stash or discard unrelated work.

### Done when

- Known-good normal-fetch signed-out behavior passes; unexpected failures and uncaught/application errors fail for the correct reason. A broad text/status suppression cannot satisfy the tests.
- Tests verify that a mismatched expectation does not hide an error and that expected negative responses are actually exercised/asserted. Empty coverage is not a passing scenario.
- `pnpm check` passes. Fix P12-introduced failures; report unrelated blockers honestly rather than weakening checks.
- Run the focused actual-Chromium cases and `pnpm exec vitest run --config vitest.templates.config.ts templates/web-app/conformance/web-app.conformance.ts`. Run other targeted checks only where affected; no need to repeat all Docker suites without a relevant concern.
- Fixed-suite support is demonstrably copied/resolved in an isolated generated project if that path changed. Do not rewrite the live qrwty project to test it.
- `git diff --check` passes; review the diff for scope and preservation of prior work.
- Append a P12 entry to `docs/handoff.md` with real commands/results, limitations and exact next work. Create a local commit titled `P12: ...` under the standing authorization. Stop after P12; do not start another package.

### Subsequent work

After P12, reconcile the pending editor work and specify the first qrwty product package as bounded tasks. Preserve the branded Studio/product goal and reusable reliability policies in those tasks. Do not automatically assign every milestone a package ID or treat unresolved future release/provider settings as blockers to P12.
