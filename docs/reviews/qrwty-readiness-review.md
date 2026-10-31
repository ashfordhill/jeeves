# qrwty readiness review: P5 → the proving application

**Date:** 2026-10-29
**Reviewer:** DeepSeek V4.1 Flash (first DeepSeek review of this repository)
**Scope:** Review only. No code, fixture, dependency, migration, or configuration changes were made.
**Baseline reviewed:** commit `1a8a136` (`P5: Simplify Runs and persist review modes and implementation evidence`), clean working tree on entry.

This document is written for the next implementation agent as much as for the person. It separates:

1. what is already on-point,
2. what will block the qrwty proving run,
3. a concrete qrwty design that fits the approved architecture,
4. the structural changes needed to make that design runnable, and
5. a proposed order of work.

The three qrwty decisions taken for this review are:

| Decision | Choice |
| --- | --- |
| qrwty design source | Committed design fixture plus a bootstrap script; the UI/chat remains available for inspection and adjustment. |
| QR-08/QR-09 verification | Extend the fixed-acceptance harness so restart, fixture data, and browser checks are real checks rather than an afterthought. |
| QR public origin | The web app's origin on a fixed local port; QR links go through the web proxy, and browser CSRF/session origins match. |

---

## 1. Executive summary

### The good news

P5 is green on the checks that do not need Docker, a browser, or a model:

```text
pnpm check
  biome check .                   390 files, 108 warnings, 55 infos, no errors
  pnpm -r --no-bail typecheck     all workspace packages: Done
  vitest run                      64 test files, 469 tests passed
```

The P3–P5 architecture is still pointed at the original goal. Jeeves is a local design → generate → orchestrate → run tool. Templates provide the standard, tested behavior. Agents fill explicit extension points. Jeeves owns the plan, verification, git state, and evidence. qrwty is a good first proving application because it is small, real, and exercises exactly the parts that matter: generated CRUD and sessions, three custom extensions, a frontend, a public redirect, persistence, ownership, and evidence.

The resource model, immutable resource migrations, generated standard tests, fixed acceptance suites, extension-derived tasks, and the implementation-usage ledger are the right building blocks. The work is not drifting toward ticket mode, cloud deployment, multi-user editing, or a general workflow engine. That is important; keep it that way.

### The blocker

**qrwty cannot yet be run end to end through Jeeves as the specification requires.** The current structure can generate qrwty's standard behavior and scaffold its three extensions, but the qrwty proof depends on things the current harness cannot register, express, or gate:

1. **Fixed acceptance cannot enter Jeeves through the server or UI.** `generateProject` accepts `fixedAcceptance`, but the Generate route and service never pass it. The orchestrator then refuses to start because required extension acceptance is missing.
2. **QR-05, QR-08, and QR-09 cannot be expressed by the current fixed-suite contract.** Fixed suites receive only a service URL, a public origin, and operation IDs. They cannot seed fixture data, control time, restart Compose services, or open a browser.
3. **There is no qrwty design fixture, acceptance source, QR encoder, or independent QR decoder in the repository.** `fixtures/designs/resources.json` is explicitly a technical example, not qrwty.
4. **`PUBLIC_ORIGIN` currently does double duty.** It is both the browser/CSRF origin and the QR payload origin. With the web app on an ephemeral host port, those cannot both be correct for a browser journey.
5. **The generated documentation and agent guides actively contradict generated resource ownership.** A coding agent is told that API contracts are project-owned and should be edited; with a resource model the contract is generated-owned. This will cost retries and credits.
6. **Extension code has no documented, supported data-access or public-origin API.** The guides point at `database.db` (Drizzle) while generated resource tables exist only as raw-SQL descriptors. qrwty's three extensions all need exactly that path.
7. **A qrwty run can be marked successful without QR-08 and QR-09.** The terminal guard checks unverified extension operations, not every declared acceptance case, and check records do not carry acceptance IDs.

### The recommendation

Do **not** start qrwty coding-model tasks yet. First land a small qrwty-enablement package (call it `P6` only if you want a package ID; it is a prerequisite, not a new architecture). It should:

- add `fixtures/designs/qrwty.json` and a reviewed bootstrap script,
- add the fixed acceptance sources and the test-only QR decoder,
- extend the fixed-suite contract and fixture harness for data seeding, restart, and browser checks,
- fix the generated ownership/agent-guide contradictions,
- expose a small, documented extension data-access path and the validated public origin,
- add acceptance-ID traceability and a final acceptance gate,
- fix the local web origin / `.env` bootstrap.

Then generate qrwty, run its four tasks (three extensions plus the frontend), and record QR-01–QR-09 as evidence. The qrwty design itself is in §6.

---

## 2. What I verified, and what I did not

### Verified

- `git log` ends at the P5 commit; `git status` was clean.
- `pnpm check` passed as summarized above. The 108 warnings are pre-existing style warnings (mostly non-null assertions and template-literal suggestions in tests), not errors. P5's handoff predicted this noise.
- The P5 schema migration `0005_runs_evidence` is present, and the unit tests cover the persisted review mode, usage ledger, provenance, and restart behavior that P5 claims.
- The resource, acceptance, orchestrator, generator, and Runs code paths were read directly. The findings below cite those paths rather than relying on the handoff prose.

### Not verified

- `pnpm test:e2e` was not run. It needs the Jeeves Postgres and browser; P5 reports 24 passing with scripted providers. This review did not re-run it.
- `pnpm test:templates` was not run. It needs Docker, Chromium, and several minutes. P4 reported focused suites passing but no final all-green full-suite invocation; do not treat this review as changing that evidence.
- No model provider was called. No paid inference, qrwty build, QR decoding, deployment, or benchmark was performed.
- The qrwty design in §6 has not been generated or run. It is a reviewed proposal, not acceptance evidence.

---

## 3. Where the project is on-point

This section matters because a review that only lists problems can accidentally encourage a rewrite. The current direction is correct.

### 3.1 The original goal is still visible in the code

| Goal | Current evidence | Assessment |
| --- | --- | --- |
| Design on a typed canvas | `packages/spec` design/layout/operations, `apps/web/src/draw` | On-point; service/subtype/component hierarchy and outer-only connections are implemented. |
| Deterministic generation | `packages/generator`, templates, lock hashes, scaffold-once ownership | On-point; deterministic files, generated-owned hashes, and drift refusal. |
| Template standard behavior | `templates/*`, runtime packages, generated CRUD/session descriptors | On-point; the standard 80% is real, not prose. |
| Agent extension points | `defineFeature`, extension scaffolds, narrow owned paths | On-point; extensions are project-owned and fixed tests are outside agent paths. |
| Orchestration | seed/planner, run/task/attempt state, checks, git strategies | On-point; sequential task execution, Jeeves-run checks, retry, review pause. |
| Local Docker run | generated `docker-compose.yml`, isolated consumer DB/role | On-point; local-only credentials and loopback bindings are deliberate. |
| Evidence | P5 usage ledger, provenance, interventions, protected tests | On-point and unusually specific; do not weaken it to make qrwty easier. |

### 3.2 qrwty is the right proving application

The approved qrwty scope is small enough to finish and broad enough to prove the pipeline:

- one API service, one web frontend, one Postgres element;
- generated accounts/sessions and owner-scoped QR CRUD;
- three fixed extensions: QR image, public redirect, activity;
- a real browser journey and restart persistence;
- a later additive feature that exercises regeneration and preserved extension code.

That is a much better first proof than a larger prototype. It tests the template boundary, the accepted resource pattern, public versus owner routes, binary responses, redirects, ownership, migrations, and UI work. It does **not** require hardware, maps, printers, billing, custom domains, or cloud deployment, all of which are correctly out of scope.

### 3.3 The small resource schema is appropriately small

The approved schema supports only `text`, `http-url`, and generated `timestamp`; only `owner` and `internal` access; only create/read/list/update; and only required `belongsTo` relationships. qrwty needs exactly these. Do not expand the schema for qrwty. The pressure to add arbitrary fields, queries, joins, workflows, or a generic relationship language should be resisted until a second application demonstrates the need.

### 3.4 The P5 Runs work is the right shape for qrwty evidence

Continuous/review mode, persisted mode changes, the leaf usage ledger, provenance, human-note records, and the separation of design chat from implementation usage all directly support the qrwty acceptance requirement to record real-provider failures, retries, human help, and cumulative usage. The qrwty work should consume that evidence, not build a parallel reporting system.

---

## 4. Findings, ordered by qrwty impact

Severity here means "impact on completing the qrwty proof truthfully", not general code quality.

| ID | Severity | Finding |
| --- | --- | --- |
| F1 | **Blocker** | Fixed acceptance suites cannot be registered through the Generate API/UI. |
| F2 | **Blocker** | The fixed-suite contract cannot express QR-05 data/clock, QR-08 restart, or QR-09 browser checks. |
| F3 | **High** | No qrwty design fixture, acceptance source, QR encoder, or independent QR decoder exists. |
| F4 | **High** | `PUBLIC_ORIGIN` conflates QR payload origin and browser/CSRF origin; the web port is ephemeral. |
| F5 | **High** | Generated `AGENTS.md` and template agent guides contradict generated resource ownership. |
| F6 | **High** | Extension code has no documented, supported data-access or public-origin path. |
| F7 | **High** | The element brief's ordering and 12k cap can hide the agent guide and preserve stale notes. |
| F8 | **High** | Acceptance cases are not traceable to checks, and the terminal guard does not require all cases. |
| F9 | Medium | Generated update behaves like a full replacement under a PATCH label; omitted optional fields are cleared. |
| F10 | Medium | Extension error responses are not auto-documented; a JSON 404/400 can become a 500. |
| F11 | Medium | Adding a generated timestamp field is blocked as destructive despite its default. |
| F12 | Medium | The structured seed gives the whole qrwty UI one task, with no split path. |
| F13 | Medium | Design-chat instructions still describe attachment endpoints and v1 connection advice. |
| F14 | Medium | Template docs and parts of the improvement spec are stale relative to P3/P4. |
| F15 | Low | Binary image responses are not documented for the generated client/UI download. |
| F16 | Low | Runs shows resource capabilities but not extensions or fixed acceptance cases. |
| F17 | Low | `resourceStores` uses a non-null assertion where a clear generation error is safer. |
| F18 | Low | The lint baseline is noisy; not a qrwty blocker. |

---

### F1 (Blocker): fixed acceptance cannot enter Jeeves through Generate

**What happens now**

- `apps/server/src/routes/generate.ts:11-14` accepts only `outputDir` and `baseline`.
- `apps/server/src/generate/service.ts:301-306` calls the generator with `{ dir, design, projectName, log }`; it never passes `fixedAcceptance`.
- `packages/generator/src/generate.ts:22-38` does support `fixedAcceptance`, and the P4 handoff documents it as a generator-library API.
- `packages/orchestrator/src/agent.ts:50-75` calls `acceptanceCoverageProblems` before the first coding-agent call. If a required extension has no registered fixed suite, the task fails immediately with "Fixed acceptance must be supplied before coding."

So the UI can generate a qrwty project and show green standard behavior, but the first qrwty extension task cannot start through Runs. The README's instruction — "supply reviewed fixed suites via `generateProject({ fixedAcceptance: [...] })`" — is a library call, not a Jeeves workflow.

**Why it matters**

The qrwty specification says the three extension contracts and QR-01–QR-09 suites must be completed and reviewed **before any coding-model implementation**. The current product path cannot satisfy that precondition. A user following the UI will hit a hard stop that looks like a bug.

**Recommendation (matches the chosen fixture + bootstrap approach)**

1. Add a committed `fixtures/designs/qrwty.json` and the fixed-suite sources.
2. Add `scripts/qrwty-bootstrap.ts` (or `pnpm qrwty:bootstrap`) that:
   - creates the Jeeves project if it does not exist,
   - applies the fixture through the validated operations API,
   - reads the resulting design,
   - calls `generateProject` with `fixedAcceptance` and the chosen output directory,
   - writes the generated project's `.env`,
   - optionally runs the baseline.
3. Ensure the UI's later Generate uses the **same output directory**. `generateProject` already reads the previous lock and re-emits prior fixed suites when `fixedAcceptance` is omitted (`packages/generator/src/generate.ts:84-125`). That is the bridge that lets Runs use the bootstrap-registered suites without a new server route.
4. Add a unit/integration test that a second generation **without** `fixedAcceptance` preserves the suites and that `acceptanceCoverageProblems` then passes.
5. Run the script with the server's existing `tsx` (for example, `pnpm --filter @jeeves/server exec tsx ../../scripts/qrwty-bootstrap.ts`) or add a root script that uses it. Do not add a second TypeScript runner to the repository.

A server route/UI for fixed acceptance is a reasonable later feature, but it is not required for the first qrwty proof. The bootstrap script is the smaller, reviewable path and matches the chosen design source.

**Do not** make the bootstrap script bypass `applyOperations` or write design revisions directly. The fixture must enter through the same validated operations path as the UI, so revision history, findings, and undo remain truthful.

---

### F2 (Blocker): the fixed-suite contract cannot express QR-05, QR-08, or QR-09

**What happens now**

`FixedAcceptance` is `{ id, service, operationIds, acceptanceIds, source }` (`packages/generator/src/acceptance.ts:7-14`). The suite is a Node `node:test` source. `verifyBehavior` runs it with a deliberately minimal environment (`packages/generator/src/baseline/behavior.ts:160-181`):

```text
PATH, TZ, JEEVES_TEST_ISOLATED, JEEVES_TEST_URL,
JEEVES_TEST_PUBLIC_ORIGIN, JEEVES_TEST_OPERATION_IDS
```

That environment is good for safety — it does not inherit ambient credentials — but it is not enough for qrwty:

| Case | What it needs | Available now |
| --- | --- | --- |
| QR-05 | Insert scans at fixed UTC timestamps, test zero days and range bounds | No DB access, no fixture SQL, no clock control |
| QR-08 | Restart the service and Postgres with the same volumes, re-login, verify persistence | No Compose project name/file, no restart control |
| QR-09 | Open the web app in a browser, drive it by mouse, compare visible totals | No web URL, no Playwright runner |

`packages/generator/src/baseline/behavior.ts:84-101` also sets the fixture `PUBLIC_ORIGIN` to `http://127.0.0.1:1`, which is fine for generated session/CRUD tests but cannot be the real public origin used by a decoded QR URL or a browser journey.

**Why it matters**

The qrwty specification is explicit: QR-05 uses fixed test-only clock/data fixtures, QR-08 restarts the service and database, and QR-09 drives the browser by mouse. Treating these as manual afterthoughts would contradict the "fixed acceptance outside agent-owned paths" requirement and would let a run claim success without the hardest cases.

There is a second, subtler problem: `apps/server/src/runs/service.ts:666-681` only guards **unverified extension operations**. A run can complete with every declared extension task done even if a suite covering QR-08 or QR-09 was never registered. The run would show `succeeded` while the proving cases are missing. That is a truthfulness failure, not just a convenience gap.

**Recommendation (matches the chosen harness extension)**

Extend `FixedAcceptance` and `verifyBehavior` with a small, explicit fixture context. Keep it narrow and reviewed; do not hand arbitrary host credentials to test source.

Minimum additions:

1. **Fixture identity**
   - `JEEVES_TEST_COMPOSE_PROJECT`
   - `JEEVES_TEST_COMPOSE_FILE`
   - `JEEVES_TEST_PROJECT_DIR`
   - `JEEVES_TEST_SERVICE_URLS` (JSON map of element ID → base URL)
   - `JEEVES_TEST_WEB_URL` (the web app base URL; qrwty needs exactly one)
   - A **fixture public origin** that actually reaches the web app. The current `fixtureCompose` sets every resource service's `PUBLIC_ORIGIN` to `http://127.0.0.1:1` and rewrites published ports to ephemeral. That is fine for generated session/CRUD tests but wrong for QR-02/03/04/08/09: the decoded QR URL must be fetchable, and the browser must share the service's CSRF/cookie origin.
   - The simplest correct approach is to reserve one free host port for the fixture web app before `compose up`, publish it as `127.0.0.1:<free>:5173`, set every resource service's `PUBLIC_ORIGIN` to `http://127.0.0.1:<free>`, and pass the same value as `JEEVES_TEST_PUBLIC_ORIGIN` and `JEEVES_TEST_WEB_URL`. This keeps fixtures isolated (not a hard-coded 5173) while making the QR/browser origin truthful. It also means the current dummy `http://127.0.0.1:1` fixture origin must become conditional.
2. **Controlled data/restart**
   - A documented way for a fixed suite to run `docker compose -p <project> -f <file> restart <service>` and `docker compose ... exec -T <db> psql ...` against the **disposable fixture**.
   - The suite can read the generated resource descriptor (`services/qrwty/src/generated/resources/scan.ts`) to get the physical table/column names.
   - Do not add a clock or seed endpoint to the production app. The fixture control belongs to the test process, not qrwty.
3. **Runner type**
   - `runner: "node" | "playwright"` (default `node`).
   - Node suites continue to use `node --test`.
   - Playwright suites run with the generated project's `@playwright/test` dependency and `JEEVES_TEST_WEB_URL`.
   - Add a `testDependencies` generator option (or a fixed-suite `dependencies` field) so `jsqr`, `pngjs`, and `@playwright/test` can be installed in the generated project at exact versions without agents editing the root manifest.
4. **Support files**
   - `FixedAcceptance.files` or equivalent for shared helpers (`_support/qr.ts`, `_support/destinations.ts`, `_support/db.ts`). These files are generated-owned, hashed, and protected just like the suite source. Without this, the QR decode and local-destination-server code is duplicated across suites.
5. **Result identity and phase**
   - Add `acceptanceIds` to `CheckOutcome` and `CheckRecord`.
   - Show them in Generate, Runs, and attempt details.
   - Add `requires?: "extensions" | "frontend"` (default `"extensions"`) so end-to-end suites are not run too early. This matters because the activity task already has all three extension operations required; without a phase, a browser suite whose only gate is "all extensions required" would run before the frontend exists.
   - Pass the current task/phase into `runBaseline`/`verifyBehavior`; skip a frontend-phase suite with a visible "waiting for frontend" reason until the frontend task.
6. **Terminal gate**
   - Add `unverifiedAcceptanceCases(design, completedTaskKeys)` or equivalent.
   - At the end of a run, every `model.acceptanceCases` entry must be matched by a suite that ran and passed, or the run stops `needs-attention` with the missing IDs.
   - For QR-01, either register a `core` suite or declare a generated-test mapping. A suite is simpler and gives a uniform evidence record.

This is more than a qrwty-specific hack; it is the minimum general harness needed for any application with persistence/restart or browser acceptance. It is also a natural extension of P4, not a new product direction.

---

### F3 (High): there is no qrwty design fixture, acceptance source, or QR library

**Evidence**

- `fixtures/designs/resources.json` already contains `qr` and `scan` resources and an activity extension, but it is explicitly "a complete technical example, not the qrwty acceptance application" (`docs/improvements.md:188`). It has one extension, one acceptance case (`ACT-01`), and stale link-shortener notes.
- There is no `fixtures/designs/qrwty.json`, no layout, no fixed-suite source, and no QR encoder/decoder dependency anywhere in the repository (`grep` for `qrcode`, `jsqr`, `zxing` finds only prose).
- The design authoring path for a resource model is the inspector's JSON textarea (`apps/web/src/draw/inspector/ConfigForm.tsx:164-175`). That is acceptable as a fallback, but it is not a reviewable way to pin three exact contracts and nine acceptance cases.
- There is no design import route (`apps/server/src/routes/projects.ts` only exposes project CRUD, operations, undo/redo, layout, findings).

**Why it matters**

Without a fixture, qrwty starts from an ad hoc chat/UI design. The contracts are long, the acceptance suite registration depends on exact operation IDs, and reproducibility is the point of the proof. Without a decoder, QR-02 cannot be tested honestly. Without an encoder, the image extension has to invent one under a coding agent.

**Recommendation**

Add, before qrwty coding:

- `fixtures/designs/qrwty.json` (design v2; see §6) and an optional layout file.
- `fixtures/acceptance/qrwty/*.test.ts` (or `.spec.ts` for the browser suite) plus shared helpers.
- A manifest or bootstrap table mapping each QR case to a suite and runner.
- An exact `qrcode` dependency for the service extension (the agent may add it through `services/qrwty/package.json`; pin it).
- Test-only `jsqr` + `pngjs` (or an equivalent independent decoder) for the acceptance harness. These must not become production dependencies.
- A `scripts/qrwty-bootstrap.ts` that reads the fixture and suites. The script is a development tool, not a second design format.

Choose stable versions at least two weeks old, as the repository requires. Do not add a QR library to the app and then use the same library to verify its output; the decoder must be independent.

---

### F4 (High): `PUBLIC_ORIGIN` conflates two origins, and the web port is ephemeral

**Evidence**

- The generated rest server requires `PUBLIC_ORIGIN` for every resource model (`templates/rest-api-server/generate.ts:80-92`).
- `resourceServer` validates it as an absolute HTTP/HTTPS origin and uses it for cookies/CSRF (`templates/rest-api-server/runtime/src/resources.ts:204-220`).
- `sessions.ts:39-41` requires `request.headers.origin === publicOrigin` for register/login and for CSRF mutations. `sessions.ts:20-26` uses the same origin to decide `Secure`.
- The web app publishes an **ephemeral** host port: `127.0.0.1::${port}` (`templates/web-app/generate.ts:182-193`). The service is also ephemeral.
- The web app proxies public extension paths (`/q/...`) to the service (`templates/web-app/generate.ts:73-92`). That is the correct path for QR links when `PUBLIC_ORIGIN` is the web origin.
- `GenerateDrawer` has no environment input; a first Generate will run `docker compose up` with whatever environment the Jeeves server inherited. The README tells the user to create a generated project `.env`, but the output folder does not exist until Generate creates it.

**Why it matters**

There are three distinct origins in a local Docker run:

1. the **browser origin** (web app),
2. the **API service origin** (loopback ephemeral port),
3. the **public QR origin** written into downloaded images.

The current code has one `PUBLIC_ORIGIN`. If it is set to the API origin, browser mutations through the web proxy send a different `Origin` and fail CSRF. If it is set to the web origin, QR links work only if the web app proxies `/q` (it does) and the web port is known and stable. The ephemeral port makes it unknown at service startup.

**Recommendation (matches the chosen web-origin option)**

- Add an optional `hostPort` to the web-app template (or a qrwty-specific compose fragment) and publish `127.0.0.1:5173:5173`. Use a dedicated qrwty port if 5173 conflicts; the value must be fixed for the proof.
- Set `QRWTY_PUBLIC_ORIGIN=http://127.0.0.1:5173`.
- Set the same value in the generated project's `.env` **before** the first baseline. The bootstrap script can create the folder and `.env`; the Generate drawer should eventually show required template environment values or a `.env.example`.
- Keep `PUBLIC_ORIGIN` as the browser/public origin for qrwty. The service's `sameOrigin` then matches, the cookie is set for the browser origin, and the QR image encodes `http://127.0.0.1:5173/q/{id}`.
- For the **disposable fixture**, do not hard-code 5173 and do not use `http://127.0.0.1:1`. Reserve a free host port, publish the fixture web app on it, set every resource service's `PUBLIC_ORIGIN` to that origin, and pass the same origin as `JEEVES_TEST_PUBLIC_ORIGIN`/`JEEVES_TEST_WEB_URL`. This is the only way QR-02/03/04/08/09 can use the decoded URL and browser truthfully while keeping fixtures isolated.
- Make the run instructions say to open the app at the **exact** configured origin. `http://127.0.0.1:5173` and `http://localhost:5173` are different origins for `Origin`/CSRF; the browser journey must use the one in `PUBLIC_ORIGIN`.
- In a later deployment, if the API and web origins diverge, split `PUBLIC_ORIGIN` into `PUBLIC_BASE_URL` (QR payload) and `APP_ORIGIN` (session/CSRF). Do not do that speculatively for qrwty; document the assumption.

**Do not** set `PUBLIC_ORIGIN` to the API service's ephemeral origin while testing the browser. It will produce QR links that bypass the proxy and CSRF failures that look like application bugs.

---

### F5 (High): generated ownership docs and agent guides contradict structured resources

This is the highest-probability way to waste qrwty coding credits. The agent is told three different things.

**Evidence**

`packages/generator/src/documents.ts:64-70` generates this in every project's `AGENTS.md`:

```text
Generated-owned files ... `docker-compose.yml`, every `*.generated.ts`, `jeeves/`, and `AGENTS.md` ...
Everything else is project-owned: feature code, tests, `package.json` files, Dockerfiles,
and API contracts in `contracts/`. Change it freely ...
```

With a resource model, these are generated-owned and **not** project-owned:

- `contracts/<service>.openapi.yaml` (`templates/rest-api-server/resources.ts:296-326`, and the lock test `packages/generator/src/resources.test.ts:42`)
- `services/<service>/src/generated/routes.ts`
- `services/<service>/src/generated/resources/*.ts`
- `services/<service>/resource-migrations/*.sql` and `manifest.json`
- `tests/generated/<service>/*.test.ts`
- `tests/acceptance/<service>/*.test.ts`

`templates/rest-api-server/agent-guide.md` is the legacy guide. It says the contract is "project-owned" and "Change the contract first" (lines 3–6 and 10). `templates/rest-api-client/agent-guide.md` tells the agent to add an operation to the contract when it is missing. Both are exactly wrong for a resource model, where the contract is generated from `config.model`.

`templates/http-service/agent-guide.md` says to query generated resource behavior through `database.db` (Drizzle). The generated resource tables are raw SQL; they are not in the project-owned `src/db/schema.ts`. The guide does not mention `database.pool` or the generated descriptors.

`packages/orchestrator/src/brief.ts:73` reinforces the incomplete example list: "generated-owned files (listed in `jeeves/lock.json`, e.g. `*.generated.ts`)". A careful agent can read the lock, but the summary says the wrong thing.

`docs/templates/rest-api-server.md:12-20` still describes `auth` as `none | bearer` and the scaffold contract as project-owned. That is the pre-P3 template.

**Why it matters**

The qrwty extension tasks are explicitly told the contract is fixed (`packages/orchestrator/src/seed.ts:118-131`). If the agent also reads the template guide and `AGENTS.md`, it will try to change the contract or migration to add a handler. Jeeves will revert those paths (`packages/orchestrator/src/agent.ts:178-218`), the attempt will fail, and the retry will spend more credits. The same confusion can cause an agent to edit `src/generated/**`, which is also reverted.

**Recommendation**

Generate ownership text from the actual plan/lock, not from a static paragraph:

- List the generated-owned paths for this project, grouped by element, with the contract and resource-migration warnings when a model exists.
- Say explicitly: "For a structured resource service, the contract, generated routes, generated resource descriptors, resource migrations, generated tests, and fixed acceptance tests are generated-owned. Implement only the declared extension in `src/features/<extension-id>/`."
- Make `rest-api-server/agent-guide.md` conditional: when `config.model` is present, replace the legacy "change the contract first" section with the extension-only path and the generated data-access path.
- Update `rest-api-client/agent-guide.md` the same way: do not add operations to a generated contract.
- Update `docs/templates/rest-api-server.md`, `docs/templates/postgres.md`, and the relevant `docs/improvements.md` paragraphs, or mark them clearly historical.

Add a generator test that a structured project's `AGENTS.md` contains every generated-owned path and does **not** call `contracts/<service>.openapi.yaml` project-owned.

---

### F6 (High): extension code has no supported data-access or public-origin API

**Evidence**

- `FeatureContext` (`templates/http-service/runtime/src/feature.ts:31-37`) has `service`, `config`, `env`, and `log`. It has no database handle and no public origin.
- The http-service guide tells agents to use `database.db` (Drizzle) from `../../jeeves.generated.ts`. That object is typed by the project-owned `src/db/schema.ts`; generated resource tables are created by raw SQL and are not in that schema.
- `@jeeves/rest-server` exports `sessionPrincipal` (`templates/rest-api-server/runtime/src/resources.ts:43-46`) and the resource server validates `PUBLIC_ORIGIN` internally (`:204-220`), but it does not expose the origin to features.
- The generated descriptors (`resourceDescriptor`, `templates/rest-api-server/resources.ts:106-118`) contain the physical `table`, field `column`s, and relationship `column`s. They are the only stable way for a project-owned extension to query a generated table.
- The extension scaffold (`templates/rest-api-server/resources.ts:314-319`) is an empty `defineFeature` with a comment; it does not show a database query, a transaction, or an owner check.

**Why it matters**

All three qrwty extensions need this:

- **QR image:** owner lookup by QR ID, then encode the public URL. It needs the owner principal and the validated public origin.
- **Redirect:** read the destination by ID, insert a scan row, and commit in one transaction. It needs the scan table/columns and a pool/transaction.
- **Activity:** owner-check the QR, then aggregate scan rows by UTC day. It needs the scan table/columns and SQL date handling.

Without a supported path, the agent will improvise. Likely failure modes are: using `database.db` with a schema that does not include the generated tables; using the API resource name as a SQL identifier (wrong: physical names are hashed); reading `process.env.PUBLIC_ORIGIN` instead of the validated value; or writing non-parameterized SQL. This is exactly the kind of work the template is supposed to make cheap and safe.

**Recommendation**

Pick one of these, or both:

1. **Generate a small data-access facade** for project-owned extensions, per resource:
   - `find<Resource>ByIdForOwner(id, ownerId)`
   - `create<Resource>(input)`
   - `withTransaction(fn)`
   - for internal children such as `scan`: `insertScan({ qrId })`, `countScansByDay({ qrId, from, to })`
   The facade uses the descriptors and parameterized SQL; extensions cannot accidentally use the wrong column.
2. **Document and support raw `database.pool` + descriptors**:
   - Add `database.pool` and `import qr from "../../generated/resources/qr.ts"` examples to the structured-service agent guide.
   - Add `withTransaction` and a note that physical table/column names come from the descriptor, never from the API name.
   - Export a validated `publicOrigin()` (or add it to `FeatureContext`) instead of reading `process.env`.
   - Export `sessionPrincipal` usage in the guide (already available).

For the first qrwty proof, the second path is enough if the qrwty extension notes and the generated guide are precise. The first path is the better long-term structure and would make the qrwty agent tasks much more likely to succeed on the first attempt. At minimum, the qrwty fixture should put the exact access pattern in each extension's `notes`; those notes become the task description (`packages/orchestrator/src/seed.ts:118-125`).

---

### F7 (High): the brief can truncate the agent guide and preserve stale notes

**Evidence**

`packages/orchestrator/src/documents.ts:196-240` builds `jeeves/elements/<id>.md` in this order:

1. implementation notes,
2. config JSON,
3. attachment config JSON (including the full `model`),
4. connections,
5. template agent guides.

For a structured service, the attachment config is the full resource model with all resources, acceptance cases, and extension contracts. qrwty's model will be large. `packages/orchestrator/src/brief.ts:11` caps the whole brief at 12,000 characters, and `:86-94` inserts that capped text after the task description. The agent guide is at the **end** of the note file, so it is the first thing lost when the model is large. The separate contract JSON in the task description adds more pressure.

At the same time, `seedPlan` deliberately skips the element task when a rest-api-server has a model (`packages/orchestrator/src/seed.ts:145-156`), but `elementNotesFile` still includes the element and attachment notes. A stale note such as "POST /links creates a short link" can therefore appear in the brief even though generated CRUD already exists. The `fixtures/designs/resources.json` example has exactly this problem.

**Why it matters**

The qrwty service element is supposed to have no hand-written CRUD work; the three extension tasks are the only service tasks. If the brief is dominated by the full model and stale prose, the agent may either not see the extension guidance or may implement generated behavior again. Both outcomes waste attempts.

**Recommendation**

- Put the **agent guide and the extension-specific instructions before** the full config JSON, or generate a separate concise "extension brief" per task.
- Summarize the model in the element note (resource names, access, operations, extension IDs) rather than dumping every contract; keep the full contract in the task description or a linked section.
- For structured services, emit an explicit "Generated standard behavior (do not reimplement)" section and treat element/attachment notes as extension-only.
- Keep qrwty's `qrwty` element notes and `qrwty-api` attachment notes **empty**. Put all service behavior in the three extension `notes`.
- Add a test that a structured model's generated brief still contains the guide text and does not contain stale CRUD instructions.

---

### F8 (High): acceptance cases are not traceable, and the run can finish without them

**Evidence**

- `FixedAcceptance` carries `acceptanceIds`, but `CheckOutcome` (`packages/generator/src/baseline/index.ts:30-44`) and `CheckRecord` (`packages/orchestrator/src/execute.ts`) do not. The UI shows the suite `id` and title, not QR-02/QR-06.
- `acceptanceCoverageProblems` (`packages/generator/src/acceptance.ts:31-53`) only checks that each **extension acceptance reference** is covered by a suite whose operations are all required. It does not require every `model.acceptanceCases` entry to be covered.
- The terminal guard (`apps/server/src/runs/service.ts:666-681`) calls `unverifiedExtensionOperations`, which only looks at extension operation IDs. QR-08 and QR-09 can be absent and the run still marks itself `succeeded`.
- `RunsView` shows generated capabilities from the resource model, but not the acceptance case list or suite mapping (`apps/server/src/runs/service.ts:1217-1226`, `apps/web/src/runs/RunsView.tsx:524-542`).

**Why it matters**

The qrwty milestone is defined by QR-01–QR-09, not by "the extension tasks ran." Evidence has to be per case. A green run that silently omits restart and browser acceptance is worse than a red run because it creates false confidence.

**Recommendation**

- Add `acceptanceIds` to fixed-suite check outcomes and persist them with attempts.
- Add a plan-time validation: every `acceptanceCases` entry must be covered by at least one fixed suite (or an explicit generated-test mapping, if you add one).
- Add a terminal check: for every acceptance case, a matching suite must have run and passed in this run. If not, stop `needs-attention` with the missing IDs.
- Show an acceptance matrix in Runs before Start and after completion: case, suite, runner, status, evidence location.
- Keep the distinction between "deferred", "skipped with reason", "failed", and "passed". Do not count a deferred case as passed.

For qrwty, a `core` suite covering QR-01 and all-extension suites for QR-08/QR-09 is the simplest way to give every case a uniform check record.

---

### F9 (Medium): update behaves like a full replacement under a PATCH label

**Evidence**

`templates/rest-api-server/runtime/src/resources.ts:175-185` builds the update as:

```text
UPDATE ... SET <every writable field> = <input value or null> WHERE owner_id = $1 AND id = ...
```

`resourceInputSchema` (`packages/spec/src/resources.ts:204-224`) makes optional text fields nullable/optional. A request that omits `title` is valid, but the runtime writes `NULL` for it. The generated contract calls the operation `PATCH` (`templates/rest-api-server/resources.ts:214-218`), which normally implies partial update.

**Why it matters**

qrwty's edit-destination journey can silently clear the title. A UI agent following normal PATCH expectations may send only `destination` and see the title disappear. That is a user-visible correctness bug and a confusing API contract. It also complicates QR-04, which edits destination without changing identity.

**Recommendation**

- Either make update truly partial (only set keys present in the validated body), or call it `PUT` and document full replacement.
- For the first qrwty proof, the UI can always send both `destination` and `title` (including `null` for an empty title), but the runtime should still be fixed or explicitly documented.
- Add a test: create with a title, PATCH only the destination, assert the title is preserved.

---

### F10 (Medium): extension error responses are not auto-documented, so JSON errors can become 500s

**Evidence**

- `responseSchema` (`packages/spec/src/resources.ts:47-55`) makes `content` optional and does not require error bodies.
- `resourceContract` spreads the extension contract directly into the path (`templates/rest-api-server/resources.ts:277-285`); it does not inject the generated CRUD's `error` body helper.
- The runtime validates every handler response (`templates/rest-api-server/runtime/src/plugin.ts:171-183`). A handler that returns `{ error, message }` for a 404, while the contract documents only a description for 404, triggers `RESPONSE_INVALID` and the client sees 500.

**Why it matters**

qrwty's QR-07 requires documented 400/404 behavior, and its image/activity handlers must return 404 for missing or other-owner resources. If the extension contracts omit error bodies, the handlers will appear broken during task checks. The qrwty design in `docs/improvements.md` shows only short extension notes, not full contracts, so this trap is easy to hit.

**Recommendation**

- In the qrwty fixture, give every 400/401/404 (and 500, if used) an explicit `application/json` error schema. Use the same `{ error, message, details? }` shape as the generated API.
- Improve `resourceContract` to inject a default error body for standard error statuses when the extension supplies only a description. This is a small, general fix.
- Add a test: an extension handler returns a JSON 404 and the response validator accepts it.

---

### F11 (Medium): adding a generated timestamp field is blocked as destructive

**Evidence**

`templates/rest-api-server/resources.ts:23` treats every timestamp field as required. The new-field loop at `:69-72` flags any required new field as "needs a backfill", even though `fieldSql` gives a timestamp `DEFAULT now()`. So adding a timestamp field to an existing resource (for example, an audit or `updatedAt` column in the later additive feature) throws `DestructiveModelError` instead of emitting an additive `ALTER TABLE ... ADD COLUMN ... DEFAULT now()`.

**Why it matters**

The approved migration policy says nullable additions are additive and never silently destructive. A generated timestamp with a default is also additive. Blocking it is over-conservative and will force a reviewed SQL detour for a safe change. This is not a qrwty initial-build blocker, but it will bite the additive-feature proof.

**Recommendation**

- Treat a timestamp field with `generated: "created-at"` (and a default) as additive when added to an existing resource.
- Keep required **text/http-url** additions blocked unless a backfill is supplied.
- Add a migration test for adding a timestamp field.

---

### F12 (Medium): the qrwty UI is one large task with no split path

**Evidence**

`seedPlan` creates one task per element with notes (`packages/orchestrator/src/seed.ts:145-156`). For structured designs, `refinePlan` returns the seed without calling the planner (`packages/orchestrator/src/planner.ts:132-140`), and `checkSubmittedPlan` refuses to redefine structured tasks. The Runs UI supports edit, remove, and reorder, but not split or duplicate (`RunsView` task editing).

The qrwty frontend needs auth, session restore, QR list/create/edit, image download, activity range, and error states. That is a lot for one budget-model task.

**Why it matters**

A failed frontend task at the end of the run is the most expensive place to fail: all three extensions are already merged, and the run pauses with a large diff. The qrwty UI is also the only task that proves QR-09.

**Recommendation**

- Keep the first qrwty UI deliberately minimal: one page, no router, no chart library, a table for activity, native `<dialog>`/simple sections, no extra state library.
- Put the exact UI checklist in the `qrwty-web` notes and acceptance; see §6.6.
- For the first proof, one task is acceptable if the notes are precise. If you want a safer plan, add a small **manual split** capability or a seed convention (for example, `##` headings in the element notes become tasks). Do not add a full planner path for structured designs just for qrwty.
- Consider running the first qrwty run in **Review after each task** mode so the frontend task is inspected before it becomes the final gate.

---

### F13 (Medium): design-chat instructions still describe v1 attachment endpoints

**Evidence**

- `apps/server/src/chat/context.ts:13` says connections are "typed arrows between elements **or attachments**".
- `apps/server/src/chat/tools.ts:89` explains `PORT_INCOMPATIBLE` with "Connect from or to the attachment that has the port".
- The approved v2 format is outer-only; capability selection lives in `connection.config.fromCapability/toCapability` (`packages/spec/src/design.ts:107-113`), and v2 validation rejects attachment endpoints (`packages/spec/src/validate.ts:432-439`).

**Why it matters**

The chat model may produce v1-style connection edits or explain failures incorrectly. `applyOperations` normalizes a `connect` op through `upgradeDesign`, so some v1 shapes still work, but the model's mental model is wrong. qrwty has one capability pair, so inference usually hides this; a design with multiple REST capabilities will expose it. Fix it before the fixture/chat is used to review qrwty.

**Recommendation**

- Update the chat instructions to "outer elements only; the inspector selects the capability when ambiguous".
- Include `fromCapability`/`toCapability` in the design summary for connections.
- Update the `PORT_INCOMPATIBLE` explanation.
- Add a chat test that a v2 connection with a capability is described correctly and that an attachment endpoint is refused with the right explanation.

---

### F14 (Medium): template docs and parts of the improvement spec are stale

**Evidence**

- `docs/templates/rest-api-server.md:12-20` still says `auth` is `none | bearer` and the contract is project-owned. The manifest now supports `session`, and structured contracts are generated-owned.
- `docs/templates/postgres.md:14-18` does not mention `resource-migrations/` or the generated service descriptors.
- `docs/improvements.md:91` says "The current REST runtime only extracts JSON body schemas; image content and redirect-header verification must be added explicitly." P4 added PNG and redirect-header verification; the sentence is now historical but not marked as such.
- `docs/improvements.md:161` says "The current notes-based seed and unconstrained planner are compatibility behavior until this is implemented." P4 implemented extension-derived tasks; the sentence reads as current.
- `docs/improvements.md:98-107` shows flat `src/features/qr-image.ts` files and `tests/acceptance/qrwty.test.ts`, while the implementation emits `src/features/<id>/index.ts` and `tests/acceptance/<service>/<id>.test.ts`.
- `packages/orchestrator/src/seed.ts:127-131` grants extension tasks `${dir}/tests/` (plural), while `templates/http-service/agent-guide.md:21` tells agents to put tests in `test/` (singular). Vitest finds both by default, but the inconsistency can scatter qrwty extension tests. Pick one directory and use it in the seed, the guide, and the task description.

**Why it matters**

This is less dangerous than F5 because coding agents receive generated guides, not `docs/templates`, but humans and fresh agents will read these docs. Several review questions in this repository already stem from stale docs. qrwty is the first time the generated contract is not project-owned, so the old wording is actively misleading.

**Recommendation**

- Update the five template docs to describe both legacy and structured-resource behavior.
- Mark implementation-note sections in `docs/improvements.md` as historical once superseded, or fold the updated behavior into the main section.
- Keep the illustrative qrwty JSON in `docs/improvements.md` as intent, but link to the real fixture once it exists.

---

### F15 (Low): binary image responses need a documented client path

**Evidence**

`contractTypes` maps a `{ type: "string", format: "binary" }` schema to a TypeScript `string` (`templates/rest-api-client/runtime/src/types.ts`). `openapi-fetch` needs `parseAs: "blob"` (or a raw fetch) for a binary body. The web-app agent guide says to use the generated client and does not mention `parseAs`; the qrwty UI needs to download a PNG.

**Why it matters**

The UI agent may call the image endpoint through the generated client, receive text, and fail to create a download. This is a small but likely friction point in the frontend task.

**Recommendation**

- Document the `parseAs: "blob"` call in the rest-api-client guide for binary responses.
- Consider a generated helper or a typed `download` wrapper for `image/png` responses.
- Add a test that the generated client can request the image endpoint and receive a Blob/ArrayBuffer.

---

### F16 (Low): Runs does not show extensions or acceptance cases before Start

**Evidence**

`capabilities(run)` (`apps/server/src/runs/service.ts:1217-1226`) lists accounts/sessions and resources only. It does not list extension IDs, operation IDs, or acceptance cases. `RunsView` shows "remaining extension or frontend tasks" but not the qrwty acceptance matrix.

**Why it matters**

The pre-Start panel is supposed to show generated capabilities and remaining work. For qrwty, the user should see the three extensions and QR-01–QR-09 before spending model credits.

**Recommendation**

- Include extensions, fixed suites, and acceptance cases in the run detail.
- Add the acceptance matrix described in F8.

---

### F17 (Low): `resourceStores` uses a non-null assertion

**Evidence**

`packages/generator/src/plan.ts:254-260`:

```ts
const connection = design.connections.find((c) => c.id === model.storeConnection)!;
return [id, { connection: connection.id, database: connection.to.element }];
```

`validateDesign` currently blocks a missing store connection, so this is defended in practice. But a generator should fail with a clear `GenerationError`, not a TypeError, if validation and planning ever diverge.

**Recommendation**

Replace the assertion with a check that throws a named generation error explaining the missing `storeConnection`.

---

### F18 (Low): lint noise

`pnpm check` reports 108 warnings and 55 infos, mostly non-null assertions and template-literal suggestions in tests. They are not errors and do not block qrwty. If you want a clean baseline before a large run, fix the few test warnings; otherwise leave them and keep the signal-to-noise ratio in mind when reading future handoffs.

---

## 5. What this means for the original goal

### Still on-point

- Jeeves is still the orchestrator, not a wrapper around an agent session.
- The generated project is still the source of truth; model "done" never counts.
- Templates still provide standard behavior; agents still implement narrow extensions.
- Local Docker is still the only v1 target.
- qrwty is still a proving application, not a product pivot.

### At risk of drift

1. **The acceptance harness is becoming a second product.** P4's fixed-suite API, disposable fixtures, binary verification, and protected expectations are justified, but qrwty needs them to be usable without a library-only bootstrap. Keep the harness small and explicit; do not build a general test-authoring UI yet.
2. **The generated docs are not derived from the generated project.** This is the clearest drift: static prose has not followed the resource model. Fixing it is more valuable than adding new features.
3. **The resource model is a mini-framework.** It is appropriately small now. Do not add arbitrary queries, joins, inheritance, or workflows for qrwty. The three extension points are the intended escape hatch.
4. **The UI for structured resources is a JSON textarea.** That is acceptable for the first proof, especially with a committed fixture. Do not build a full resource builder before qrwty; the fixture is the review artifact.
5. **The qrwty frontend is the largest task.** Keep it minimal. The goal is to prove the pipeline, not to build a polished analytics product.

### Do not do

- Do not start qrwty coding tasks before the fixed suites are in the lock and the harness can run them.
- Do not let an agent edit `contracts/qrwty.openapi.yaml`, `resource-migrations/`, `src/generated/`, `tests/generated/`, or `tests/acceptance/`.
- Do not add a seed/clock endpoint to the production qrwty app. Fixture control belongs to the harness.
- Do not use the destination URL in the QR image. The image encodes the stable `/q/{id}` URL only.
- Do not count unique visitors. Scans are requests.
- Do not add cloud deployment, hardware, maps, billing, custom domains, or team accounts.
- Do not turn the resource model into a general application framework.
- Do not make the fixed acceptance suite depend on public websites. Use local destination servers in the fixture.

---

## 6. Proposed qrwty design

This design fits the approved boundaries: one `http-service`, one `web-app`, one `postgres`, email/password with opaque server sessions, and three fixed extensions. It assumes the chosen fixture + bootstrap path and the fixed local web origin.

### 6.1 Board shape

| Element / attachment | Template | Config | Notes |
| --- | --- | --- | --- |
| `qrwty` | `http-service` | `port: 8080`, `logLevel: info` | No implementation notes. Standard sessions and CRUD are generated. |
| `qrwty-api` (attachment) | `rest-api-server` | `auth: session`, `basePath: /api`, `model: ...` | No implementation notes. The three extensions carry the behavior. |
| `qrwty-db` | `postgres` | default version | No notes. |
| `qrwty-web` | `web-app` | `title: qrwty`, `port: 5173`, `hostPort: 5173` (proposed) | The UI notes in §6.6. |
| `qrwty-client` (attachment) | `rest-api-client` | defaults | No notes. |

Connections:

- `qrwty-uses-db`: `uses-database` from `qrwty` to `qrwty-db`.
- `qrwty-web-calls-api`: `calls` from `qrwty-web` to `qrwty`, with `fromCapability: "qrwty-client"` and `toCapability: "qrwty-api"`.

A layout file is optional; the UI's fallback grid is readable enough for a three-element board, but a saved layout makes the fixture screenshot stable.

### 6.2 Resource model

The following is the proposed `rest-api-server.config.model`. It is intentionally the approved small schema; no new field types or operations. I parsed this exact object against the current `resourceConfigSchema` in a read-only check; it is valid. The full design still needs to be assembled as a fixture and validated with `designSchema`/`validateDesign`.

```json
{
  "storeConnection": "qrwty-uses-db",
  "resources": [
    {
      "id": "qr",
      "name": "qr",
      "access": "owner",
      "fields": [
        {
          "id": "destination",
          "name": "destination",
          "type": "http-url",
          "required": true
        },
        {
          "id": "title",
          "name": "title",
          "type": "text",
          "required": false,
          "maxLength": 120
        }
      ],
      "belongsTo": [],
      "operations": ["create", "read", "list", "update"]
    },
    {
      "id": "scan",
      "name": "scan",
      "access": "internal",
      "fields": [
        {
          "id": "occurred-at",
          "name": "occurredAt",
          "type": "timestamp",
          "generated": "created-at"
        }
      ],
      "belongsTo": [
        {
          "id": "scan-qr",
          "resource": "qr",
          "required": true
        }
      ],
      "operations": []
    }
  ],
  "acceptanceCases": [
    "QR-01",
    "QR-02",
    "QR-03",
    "QR-04",
    "QR-05",
    "QR-06",
    "QR-07",
    "QR-08",
    "QR-09"
  ],
  "extensions": [
    {
      "id": "qr-image",
      "operationId": "downloadQr",
      "method": "GET",
      "path": "/api/qr/{id}/image",
      "access": "owner",
      "acceptance": ["QR-02", "QR-06"],
      "notes": "Implement the owner-scoped PNG download. Use sessionPrincipal(request.request) and the validated PUBLIC_ORIGIN. Read the QR from the generated qr descriptor's table by id and the fixed owner_id column; return 404 if absent or another owner's. Encode PUBLIC_ORIGIN + '/q/' + id, never destination. Use a deterministic PNG (fixed size, margin, error-correction level; no timestamp/random metadata) so the bytes stay identical after destination edits and restarts. Set Content-Type: image/png and a Content-Disposition attachment header. Do not generate the QR in the browser.",
      "contract": {
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string", "format": "uuid" }
          }
        ],
        "responses": {
          "200": {
            "description": "PNG QR code containing the stable public redirect URL",
            "headers": {
              "Content-Disposition": {
                "required": true,
                "schema": { "type": "string" }
              }
            },
            "content": {
              "image/png": {
                "schema": { "type": "string", "format": "binary" }
              }
            }
          },
          "400": {
            "description": "Invalid id",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" },
                    "details": { "type": "array", "items": { "type": "object" } }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthenticated",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" }
                  }
                }
              }
            }
          },
          "404": {
            "description": "QR not found",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      "id": "redirect",
      "operationId": "followQr",
      "method": "GET",
      "path": "/q/{id}",
      "access": "public",
      "acceptance": ["QR-03", "QR-04", "QR-07"],
      "notes": "Implement the public redirect. Query the current destination by id; if missing, return 404 and insert nothing. In one transaction, insert one scan row for the qr and commit, then return 302 with the destination in Location and Cache-Control: no-store. Every request counts, including repeated requests from the same client. Do not follow the destination from the server; do not cache it. Use the generated qr and scan descriptors for physical table/column names. Public access means no session lookup.",
      "contract": {
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string", "format": "uuid" }
          }
        ],
        "responses": {
          "302": {
            "description": "Redirect to the current destination",
            "headers": {
              "Location": {
                "required": true,
                "schema": { "type": "string", "format": "uri" }
              },
              "Cache-Control": {
                "required": true,
                "schema": { "type": "string", "const": "no-store" }
              }
            }
          },
          "400": {
            "description": "Invalid id",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" }
                  }
                }
              }
            }
          },
          "404": {
            "description": "Unknown redirect",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      "id": "activity",
      "operationId": "qrActivity",
      "method": "GET",
      "path": "/api/qr/{id}/activity",
      "access": "owner",
      "acceptance": ["QR-05", "QR-06"],
      "notes": "Implement the owner-scoped activity query. Use sessionPrincipal(request.request); check the QR belongs to the authenticated principal and return 404 for absent or another owner's id. Require from and to as inclusive UTC dates, reject from > to and ranges longer than 366 days with 400. Return {total, days:[{date,count}]}; include every UTC day in the range, including zero-count days. Aggregate scan rows by UTC day. Use parameterized SQL and the generated qr/scan descriptors. Do not expose fixture or clock controls.",
      "contract": {
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string", "format": "uuid" }
          },
          {
            "name": "from",
            "in": "query",
            "required": true,
            "schema": { "type": "string", "format": "date" }
          },
          {
            "name": "to",
            "in": "query",
            "required": true,
            "schema": { "type": "string", "format": "date" }
          }
        ],
        "responses": {
          "200": {
            "description": "Activity over the requested UTC date range",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["total", "days"],
                  "additionalProperties": false,
                  "properties": {
                    "total": { "type": "integer", "minimum": 0 },
                    "days": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": ["date", "count"],
                        "additionalProperties": false,
                        "properties": {
                          "date": { "type": "string", "format": "date" },
                          "count": { "type": "integer", "minimum": 0 }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid date range",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthenticated",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" }
                  }
                }
              }
            }
          },
          "404": {
            "description": "QR not found",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["error", "message"],
                  "additionalProperties": false,
                  "properties": {
                    "error": { "type": "string" },
                    "message": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

Notes on the model:

- `qr` is the only public CRUD resource. `scan` is internal and has no routes; its only writer is the redirect extension.
- The resource names are API names; physical storage is hashed from stable IDs. Renaming `qr` later preserves storage, but extension paths such as `/api/qr/{id}/image` are hardcoded strings. If a resource rename is ever allowed, the extension paths must be reviewed separately. Do not rename `qr` during the proof.
- Every error response that a handler can actually return has a JSON body schema. This is deliberate; see F10. Statuses sent by the framework before the handler (401/403/400 path validation) are included for client typing even though they are not response-validated.
- The `Cache-Control` header schema uses `const: "no-store"` so the response validator enforces the requirement, not just the handler.
- The image content schema is required by `responseSchema`; the runtime recognizes `image/png` without a JSON schema and performs PNG framing/decompression checks (`templates/rest-api-server/runtime/src/validation.ts:198-281`).

### 6.3 Design JSON skeleton

The full design document wraps the model above. Use `schemaVersion: 2` and revision 0/1; the bootstrap applies it through operations and gets revision 1. The skeleton below is illustrative: replace the placeholder strings with the complete model from §6.2 and the complete web notes from §6.6 before applying it. It is not directly parseable as shown.

```json
{
  "schemaVersion": 2,
  "revision": 0,
  "elements": [
    {
      "id": "qrwty",
      "name": "qrwty API",
      "template": { "id": "http-service", "version": "0.1.0" },
      "config": { "port": 8080, "logLevel": "info" },
      "attachments": [
        {
          "id": "qrwty-api",
          "template": { "id": "rest-api-server", "version": "0.1.0" },
          "config": {
            "auth": "session",
            "basePath": "/api",
            "model": "COPY_THE_COMPLETE_OBJECT_FROM_6.2"
          },
          "notes": ""
        }
      ],
      "notes": ""
    },
    {
      "id": "qrwty-db",
      "name": "qrwty DB",
      "template": { "id": "postgres", "version": "0.1.0" },
      "config": {},
      "attachments": [],
      "notes": ""
    },
    {
      "id": "qrwty-web",
      "name": "qrwty web",
      "template": { "id": "web-app", "version": "0.1.0" },
      "config": { "title": "qrwty", "port": 5173, "hostPort": 5173 },
      "attachments": [
        {
          "id": "qrwty-client",
          "template": { "id": "rest-api-client", "version": "0.1.0" },
          "config": {},
          "notes": ""
        }
      ],
      "notes": "COPY_THE_COMPLETE_NOTES_FROM_6.6"
    }
  ],
  "connections": [
    {
      "id": "qrwty-uses-db",
      "kind": "uses-database",
      "from": { "element": "qrwty" },
      "to": { "element": "qrwty-db" }
    },
    {
      "id": "qrwty-web-calls-api",
      "kind": "calls",
      "from": { "element": "qrwty-web" },
      "to": { "element": "qrwty" },
      "config": {
        "fromCapability": "qrwty-client",
        "toCapability": "qrwty-api"
      }
    }
  ],
  "annotations": []
}
```

The `hostPort` field is a proposed web-app config addition; see F4. If you do not want to change the template, the qrwty compose fragment or a fixed-port override must provide the same result. Do not leave the web port ephemeral and hope the service guesses it. Apply the fixture only after the `hostPort` schema/compose change lands; otherwise `hostPort` is an unknown config key and the design will have a structural finding.

### 6.4 Fixed acceptance suites

Register these through the bootstrap. The IDs and acceptance references are chosen so P4's coverage rules pass.

| Suite ID | Runner | Required operations | Requires | Acceptance IDs | Purpose |
| --- | --- | --- | --- | --- | --- |
| `core` | node | all three | extensions | QR-01 | Auth/CRUD/session/401/logout baseline with a uniform check record. |
| `qr-image` | node | `downloadQr` | extensions | QR-02, QR-06 | Download, decode, stable URL, byte identity, owner isolation. |
| `redirect` | node | `followQr` | extensions | QR-03, QR-04, QR-07 | 302/no-store, destination edit, one scan per request, invalid/unknown cases. |
| `activity` | node | `qrActivity` | extensions | QR-05, QR-06 | Repeated requests, UTC buckets, zero days, bounded range, owner isolation. |
| `restart` | node + fixture control | all three | extensions | QR-08 | Restart service/DB, re-login, image decode, redirect, persisted history. |
| `browser` | playwright | all three | frontend | QR-09 | Mouse-driven account/create/edit/download/activity journey; totals agree. |

The all-operation suites need a **phase**, not just "all operations required":

- `core` and `restart` can run as soon as all three extension operations are required (the activity task, or the final task if the frontend task is removed).
- `browser` must wait for the frontend task. Without a phase, it would run at the activity task, because activity completes the third extension and therefore makes every extension operation "required". The browser would fail because the qrwty UI does not exist yet.

Add `requires?: "extensions" | "frontend"` (default `"extensions"`) to `FixedAcceptance`, pass the current task/phase into `runBaseline`/`verifyBehavior`, and give a frontend-phase suite a visible "waiting for frontend" skip reason until the frontend task. The terminal acceptance gate (F8) ensures QR-09 is not silently omitted.

`verifyBehavior` currently only runs a fixed suite when **all** of its `operationIds` are required (`packages/generator/src/baseline/behavior.ts:205-220`). That is correct for extension-phase suites but insufficient for frontend-phase suites. Keep the per-extension suites narrow; keep the end-to-end suites broad and phase-gated.

### 6.5 What each suite should do

**`core` (QR-01)**

- Register Alice and Bob with unique emails; assert 201 and identity.
- Create a QR as Alice; record the ID and destination.
- Read/list as Alice; assert the row.
- Attempt create/read/update/image/activity without a session; assert 401.
- Logout Alice; assert the session is invalid and a subsequent read is 401.
- This duplicates some generated standard tests on purpose: QR-01 gets a named acceptance record, not just a green standard suite.

**`qr-image` (QR-02, QR-06)**

- Register Alice and Bob.
- Create a QR as Alice with a destination on a local destination server.
- Download `/api/qr/{id}/image`; assert 200, `image/png`, `Content-Disposition`, nonempty bytes.
- Decode the PNG with `jsqr` + `pngjs`; assert the decoded URL is exactly `PUBLIC_ORIGIN + "/q/" + id`; assert it is not the destination.
- Record the SHA-256.
- Update the destination as Alice; download again; assert byte-identical bytes and the same decoded URL.
- Attempt the image as Bob and anonymously; assert 404 and 401.
- Attempt an unknown UUID; assert 404; a malformed ID; assert 400.

**`redirect` (QR-03, QR-04, QR-07)**

- Start two local HTTP destination servers (A and B) on ephemeral loopback ports; count requests.
- Create a QR as Alice with destination A.
- Request `PUBLIC_ORIGIN + "/q/" + id` with `redirect: "manual"`; assert 302, `Location` = A, `Cache-Control: no-store`.
- Fetch the `Location`; assert A received exactly one request.
- Repeat the redirect request; assert A received two and the scan count (via fixture DB or the activity endpoint once available) increased by one per redirect.
- Edit the destination to B as Alice; request the original `/q/{id}`; assert B is reached and A's count does not increase; assert the QR image bytes and ID are unchanged.
- Request an unknown `/q/{unknown}`; assert 404 and no new scan row.
- Request `/q/not-a-uuid`; assert 400.
- Try a failed unauthorized update; assert the destination is unchanged.
- If the activity endpoint is not implemented at this task, query the fixture DB directly for the scan count; do not skip the count assertion.

**`activity` (QR-05, QR-06)**

- Create a QR as Alice.
- Use the fixture DB to insert scan rows at fixed UTC timestamps:
  - `2026-01-01T23:59:59Z` (day 1),
  - `2026-01-02T00:00:00Z` (day 2),
  - two rows on day 2 to prove counting,
  - a range with a zero day.
- Call `/api/qr/{id}/activity?from=2026-01-01&to=2026-01-04`; assert total, day counts, zero day, and date strings.
- Repeat the same redirect request without deduplication; assert the total increases for each request.
- Assert `from > to` and a range over 366 days return 400; malformed dates return 400.
- As Bob and anonymously, assert 404 and 401.
- Assert an unknown ID returns 404 and does not create scans.

**`restart` (QR-08)**

- Create a QR, capture the image bytes, fetch the redirect once, record the activity total.
- Use `docker compose -p <fixture> -f <file> restart qrwty qrwty-db` (or stop/start in dependency order); wait for `/ready`.
- Log in again; read the resource; decode the image again; follow the original `/q/{id}`; assert the destination is still B.
- Assert the activity total increased by exactly one and prior scans remain.
- Assert the service did not lose its migrations or session table.

**`browser` (QR-09)**

- Playwright against `JEEVES_TEST_WEB_URL` (`http://127.0.0.1:5173` in the proof).
- Register a unique user, log in, create a QR, edit its destination, download the image, open the activity view, and compare the visible total with the API/persisted total.
- Use mouse-driven clicks for actions; typing into fields is fine, but do not rely on keyboard shortcuts.
- Assert no console errors for expected flows.
- This suite must run only after all extensions **and** the frontend are implemented; mark it `requires: "frontend"` so the activity task does not trigger it.

### 6.6 qrwty web task notes

Embed this in `qrwty-web.notes`. Keep it under the 20,000-character limit. The frontend agent may add a router or library, but the first proof should be deliberately small.

```markdown
Build the qrwty user interface in this web app. Use the generated `qrwtyClient` from
`useApis()` and the existing runtime config. Do not generate QR codes in the browser and do not
edit generated clients, contracts, or server code.

Auth
- On load, call GET /auth/session. If 401, show a register/login form; if 200, show the app.
- Register and login with email + password. Store the returned csrfToken in memory (not localStorage).
- Logout calls POST /auth/logout with the csrf token and clears the local state.
- Every mutation sends `x-csrf-token` and uses the same-origin client. Handle 401 by returning to auth.

QR list
- GET /api/qr?limit=25, newest first. Show title (or "Untitled"), destination, created time, and
  the public link `window.location.origin + "/q/" + id`.
- Support the next cursor with a Load more button; empty state; loading and error states.

Create
- Form: destination (required, absolute HTTP/HTTPS, no credentials) and optional title (max 120).
- POST /api/qr; on 201 clear the form, refresh the list, and show the public link.
- Inline 400 errors; 401 returns to auth.

Edit
- Select a QR, edit destination and title, PATCH /api/qr/{id}. Send both fields (send null for an
  empty title) until the server's partial-update behavior is fixed.
- On success refresh the row; 400/404 inline; 401 returns to auth.

Image
- Download GET /api/qr/{id}/image through the same-origin client with `parseAs: "blob"` (or an
  authenticated same-origin fetch if the generated client cannot type it).
- Trigger a browser download with the returned blob; do not build the image from the destination.
- Show the stable public link beside the download action.

Activity
- Activity view: from/to date controls defaulting to the last 30 UTC days, a total, and a table of
  every returned day including zero-count days.
- GET /api/qr/{id}/activity?from=...&to=...; handle 400 for an invalid or too-wide range.
- Do not claim unique visitors; label the number as requests.

Quality
- Every action works by mouse. No keyboard-only controls.
- No console.error for expected 400/401/404 flows.
- Keep tests in the app's test folder: auth gate, list/create, image download, activity rendering.
- Do not add a chart library for the first proof; a table is enough.
```

The UI task should be inspected in **Review after each task** mode. If the agent struggles, split the task manually into "auth + list/create" and "edit + image + activity" before spending more retries; do not weaken the acceptance suite.

### 6.7 Bootstrap and run sequence

Operational prerequisites: Docker Compose, Chromium for Playwright, a coding provider with usable credits/quota, and the local ports `5173` (generated qrwty web), `4300` (Jeeves web), `4310` (Jeeves API), and `54329` (Jeeves Postgres). If `5173` is occupied, choose a dedicated qrwty host port and update `QRWTY_PUBLIC_ORIGIN` and the QR/browser tests together. Do not change the origin between image generation and browser verification.

1. **Enablement package**
   - Add the qrwty fixture, layout, fixed suites, support files, and bootstrap script.
   - Add the harness additions from F2/F8.
   - Add `hostPort` and the public-origin/`.env` bootstrap.
   - Fix the generated ownership/agent guides and the extension data-access/public-origin path.
   - Add acceptance IDs and the terminal gate.
   - Run `pnpm check`, focused generator conformance, and a browser check of the harness.
2. **Bootstrap qrwty**
   - Run `pnpm qrwty:bootstrap` (proposed) or the equivalent script.
   - It creates/uses the Jeeves project, applies the fixture, writes `~/jeeves-projects/qrwty/.env`, and generates with the six fixed suites.
   - Confirm the lock has `resourceModels.qrwty` and `fixedAcceptance` entries.
3. **Generate in the UI**
   - Open the project, press Generate. The baseline should be green: install, typecheck, Compose up, template packs, generated standard tests; extension acceptance is visibly deferred.
   - Confirm `.env` has `DB_QRWTY_PASSWORD` and `QRWTY_PUBLIC_ORIGIN`; open the app at exactly that origin (`http://127.0.0.1:5173`, not `localhost`).
4. **Plan**
   - Runs → Plan. Expect four tasks: qr-image, redirect, activity, qrwty-web. In that order.
   - Confirm the pre-Start panel shows the extensions and QR-01–QR-09.
5. **Run**
   - Use **Review after each task** for the first proof. Start.
   - After each extension, inspect the fixed-suite result and the acceptance ID(s).
   - After the frontend task, inspect QR-09 and the full matrix.
6. **Evidence**
   - Record design revision/hash, template versions, starting git revision, provider/model, prompts, retries, checks, usage, elapsed time, human interventions, and the QR case matrix. P5 already stores most of this; add the acceptance-ID view.
7. **Additive feature**
   - After QR-01–QR-09 pass, agree one additive feature (candidate: campaign label + owner filter). Change the design, regenerate, and prove preserved extension code, existing acceptance still green, a new migration, and cumulative usage. Do not select the feature now.

### 6.8 Suggested qrwty acceptance matrix

| Case | Primary evidence | Also verified by |
| --- | --- | --- |
| QR-01 | `core` fixed suite | generated `_session` + `qr` standard tests |
| QR-02 | `qr-image` fixed suite | browser download in QR-09 |
| QR-03 | `redirect` fixed suite | `activity` totals |
| QR-04 | `redirect` fixed suite | `qr-image` byte identity |
| QR-05 | `activity` fixed suite with fixture DB | `redirect` repeated requests |
| QR-06 | `qr-image` + `activity` + generated CRUD | `core` |
| QR-07 | `redirect` + generated CRUD + error contracts | `activity` range validation |
| QR-08 | `restart` fixed suite with Compose control | — |
| QR-09 | `browser` Playwright suite | manual inspection of the screenshot |

---

## 7. Recommended work order

### Must land before qrwty model coding

1. **qrwty fixture and bootstrap** (F1, F3)
   - `fixtures/designs/qrwty.json`, optional layout.
   - `fixtures/acceptance/qrwty/*` and shared helpers.
   - `scripts/qrwty-bootstrap.ts`; writes `.env`; calls `generateProject` with fixed suites.
2. **Fixed-suite harness extension** (F2, F8)
   - Fixture identity, service/web URLs, Compose control, DB seed path.
   - Node + Playwright runners; support files; test dependencies.
   - A `requires: "extensions" | "frontend"` phase so the browser suite waits for the UI.
   - Acceptance IDs on checks; plan-time coverage; terminal gate.
3. **Public origin and web port** (F4)
   - `hostPort` for the web app or an equivalent fixed-port qrwty compose fragment.
   - `PUBLIC_ORIGIN` = web origin; `.env` bootstrap; Generate/baseline error if missing.
4. **Generated docs and extension access** (F5, F6, F7)
   - Ownership text from the plan; conditional structured-service guides.
   - `database.pool`/descriptors/transaction/publicOrigin/sessionPrincipal guidance.
   - Concise extension brief; avoid stale service notes.
5. **Acceptance error contracts and update semantics** (F9, F10)
   - Error bodies in qrwty extension contracts; optional runtime injection.
   - Partial update or explicit full-replacement semantics.
6. **Chat/docs cleanup** (F13, F14)
   - Outer-only language; update stale template docs or mark them historical.

### Should land with the qrwty enablement or immediately after

7. **Frontend task split or minimal UI confirmation** (F12)
   - Prefer the minimal UI in §6.6. Add a manual split only if the first attempt struggles.
8. **Capability display and acceptance matrix in Runs** (F16)
9. **Binary client guidance** (F15)
10. **Timestamp additive fix** (F11)
11. **`resourceStores` hardening** (F17)

### Explicitly later

- Server/UI fixed-acceptance authoring (after the bootstrap proves the flow).
- A field-by-field resource builder.
- More field types, queries, joins, or workflows.
- Local models, model comparisons, benchmarks.
- Cloud deployment, hardware, maps, billing, custom domains, teams.
- Additive feature selection.

---

## 8. Proposed follow-up agent prompt

Use or adapt this when starting the enablement package. It is intentionally explicit about the no-coding-before-acceptance boundary.

```text
You are implementing the qrwty enablement package in /home/ash/github/jeeves.
Read AGENTS.md, PLAN.md §15, docs/improvements.md, docs/examples/qrwty.md,
docs/reviews/qrwty-readiness-review.md, and the latest two handoff entries first.
Do not ask for the resource/editor/qrwty architecture approvals again; they are already approved.
Do not start qrwty coding-model tasks in this package.

Goal: make the approved qrwty design and QR-01–QR-09 acceptance runnable through Jeeves,
using a committed design fixture and bootstrap script, and an extended fixed-acceptance harness.

Scope:
1. Add fixtures/designs/qrwty.json (schema v2) and an optional layout. Use the design in
   docs/reviews/qrwty-readiness-review.md §6. Keep the service/attachment notes empty; put
   extension behavior in each extension's notes and UI behavior in qrwty-web.notes.
2. Add fixtures/acceptance/qrwty/ suites for core, qr-image, redirect, activity, restart, browser,
   plus shared support files. Add an independent QR decoder (jsqr + pngjs or equivalent) as a
   test-only dependency. Add qrcode as the service extension dependency, pinned.
3. Add scripts/qrwty-bootstrap.ts (or a pnpm script) that creates/uses the Jeeves project, applies
   the fixture through POST /projects/:id/operations, reads the design, writes the generated
   project's .env, and calls generateProject({ fixedAcceptance }). Verify that a later UI/API
   Generate without fixedAcceptance preserves the suites from the lock.
4. Extend fixed acceptance with a fixture context: Compose project/file, project dir, service/web
   URLs, a fixture public origin that matches the fixture web port, a controlled DB seed path,
   and a Playwright runner. Add support files and exact test dependencies. Add a
   requires: "extensions" | "frontend" phase so the browser suite waits for
   the UI; activity completing the third extension must not trigger the browser suite. Add
   acceptanceIds to CheckOutcome/CheckRecord. Add a terminal gate that requires every
   model.acceptanceCases entry to have a passing suite (or an explicit skip reason).
5. Add an optional hostPort to web-app (or an equivalent fixed-port qrwty compose fragment) and
   set PUBLIC_ORIGIN to the web origin (http://127.0.0.1:5173) for the local proof. Make the
   first Generate fail with a clear message if required template env is missing, or have the
   bootstrap create .env first.
6. Fix generated ownership documentation and agent guides for structured resources:
   contracts, src/generated/**, resource-migrations/**, tests/generated/**, tests/acceptance/**
   are generated-owned. Implement only the declared extension. Update the rest-api-server and
   rest-api-client guides conditionally. Add a test that AGENTS.md lists the real generated paths
   and does not call the resource contract project-owned.
7. Document/support extension data access: database.pool, generated descriptors, a transaction
   helper, sessionPrincipal, and the validated public origin. Prefer a small generated facade if
   it keeps the qrwty extensions simple. Update the http-service guide.
8. Make extension error contracts safe: ensure qrwty 400/401/404 responses document JSON bodies,
   and consider injecting a default error body in resourceContract. Fix PATCH/full-replacement
   behavior or document it. Add tests.
9. Update stale docs: docs/templates/rest-api-server.md, postgres.md, rest-api-client.md,
   chat instructions/explainFinding, and superseded implementation-note paragraphs.
10. Run pnpm check, focused generator conformance, the browser suite, and the qrwty bootstrap on a
    disposable fixture. Record exact results. Do not claim a run is green unless QR-01–QR-09 ran.

Do not edit earlier handoff entries. Append a new handoff entry and create a local commit with
the package ID (the user has standing authorization). Preserve unrelated changes.
```

---

## 9. Open decisions for the follow-up

These are deliberately left open; they are implementation choices, not new architecture approvals.

| Decision | Recommendation | Why it matters |
| --- | --- | --- |
| Fixed acceptance registration | Bootstrap script now; server route later | Matches the chosen fixture path and avoids product scope creep. |
| Browser runner | Generated project `@playwright/test` dependency + Playwright suites | Reuses the installed Chromium and keeps the suite in the project's protected artifacts. |
| Fixture DB seeding | `docker compose exec` in the disposable fixture, using descriptors | Avoids a production clock/seed endpoint and keeps test control outside the app. |
| Activity range | Required `from`/`to`, inclusive UTC dates, max 366 days | Matches the qrwty brief and gives QR-05 something concrete to validate. |
| QR image | 512×512, margin 4, error correction M, deterministic PNG | Independent decode in QR-02; byte identity in QR-04. |
| Title update | Preserve on omitted title (true PATCH) or always send both | Prevents silent data loss. |
| UI scope | Single page, no router, table for activity | Keeps the frontend task buildable by one budget model. |
| QR public origin | `http://127.0.0.1:5173` for the local proof | Browser, CSRF, proxy, and QR payload agree. |
| Fixed suite support files | Generated-owned helpers | Avoids duplicated decode/server code and keeps it protected. |
| Acceptance gate | Require every QR case, not just extension operations | Prevents a false green run. |

---

## 10. Final assessment

The project is still solving the right problem, and P3–P5 produced the right foundations. qrwty is a good next proof. The danger is not architectural drift; it is **procedural false readiness**: the UI can generate a green project, and Runs can show a polished plan, while the fixed acceptance that makes qrwty meaningful is not registered, cannot express restart/browser/clock cases, and is not required by the terminal gate. The generated agent documentation then tells the coding agent to edit files that Jeeves will revert.

Fix those before spending model credits on qrwty. The result will be a much stronger proof: a committed design, reviewed contracts, independent acceptance, real restart and browser evidence, and a run that cannot claim success without QR-01–QR-09. That is worth one small enablement package.
