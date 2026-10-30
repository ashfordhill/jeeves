# Jeeves → qrwty readiness: build plan (P7–P11)

Status: approved by the user on 2026-10-30 after a full code audit at commit `3405ace` (P6). This document is the ordered work list for the next five packages and supersedes the "next steps" paragraphs of earlier handoffs. Work one package per fresh agent session, in order, following AGENTS.md and PLAN.md §15. Do not re-open the architecture approvals (SRC-18).

## How to run a package from this plan (for the executing agent)

1. Read `AGENTS.md`, PLAN.md §15, the two latest entries of `docs/handoff.md`, and **only your package section below**.
2. Before changing code, open every file your section names and confirm the quoted line numbers still match; if the code moved, follow the behavior described, not the line number.
3. Implement exactly what the section lists. Anything marked "Decision:" is settled; do not redesign it.
4. Run the checks in the "Verification summary" row for your package and paste the real output into your handoff entry.
5. Append the handoff entry, then make one local commit titled `P<n>: <short title>`.

## Context

Jeeves (design canvas → deterministic template project → coding agents on extension points → Jeeves-run checks) is at P6. `pnpm check` passes (481 tests). The approved qrwty design, fixed acceptance suites and bootstrap exist, but **no real run has been attempted**. A code audit (not a doc read) found defects that would make the qrwty run fail deterministically, plus robustness holes that would waste model credits. The user also wants: coding via **Codex and/or DeepSeek through the OpenCode CLI**, the generated project to live in the existing repo **`~/github/qrwty`** (currently just a README), fixed-acceptance registration through the Generate UI, Settings simplification, the app URL after a green baseline, and a scripted proving-run step list.

Executors are cheaper models (DeepSeek V4.1 Flash first; Opus 5.5 / GPT Sol 6.1 / Astra as reviewers). Every package below is therefore written as: exact files, exact behavior, exact tests, exact commands. One package = one fresh agent session = one commit (AGENTS.md rules apply: read PLAN §15, latest handoff; append handoff; `pnpm check`; commit titled `P<n>: …`).

### Verified facts the executors can rely on

- Node 24.21, pnpm 12.16.1, Docker 29, Jeeves Postgres container running, port 5173 free, Codex CLI 0.165 logged in (`~/.codex/config.toml`: `gpt-6.1-sol`, `xhigh`). No `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`. **OpenCode is not installed** (`~/.config/opencode` and `~/.opencode/opencode.json` exist; the latter defines a custom OpenAI-compatible provider `deepai` with model `deepseek-flash`).
- `~/github/qrwty`: git repo, one commit, `README.md` + untracked `.docs/architecture-1.excalidraw` (empty). Remote `ashfordhill/qrwty`. The generator writes no root `README.md`, so generating there does not collide; because it is already a work tree the generator will **not** make the baseline commit (`packages/generator/src/generate.ts:312`).
- `~/jeeves-projects/qrwty` is a stale P6 bootstrap output (uncommitted drift). It is disposable.
- Generated qrwty contract is 13,075 chars (< `CONTRACT_CAP` 20,000); `jeeves/elements/qrwty.md` is 24,908 chars (> `BRIEF_CAP` 12,000 — notes and guide come first, the model JSON is what gets cut; acceptable).

---

## P7: qrwty harness correctness (must land before any model run)

### 7.1 Multi-operation fixed suites must be *skipped*, not failed, while partially required — BLOCKER
- File: `packages/generator/src/baseline/behavior.ts` ~lines 380–386. Today the `else if (some required)` branch pushes to `failed`. The `core` (QR-01) and `restart` (QR-08) suites in `fixtures/acceptance/qrwty/manifest.ts` list all three operations with `requires: "extensions"`, so after extension task 1 the behavior step fails on every retry.
- Change: replace the `failed.push(...)` with an `onCheck({... status: "skipped", reason: "Waiting for operations <missing ids> before running this suite.", acceptanceIds: suite.acceptanceIds})` identical in shape to the `requires === "frontend"` skip just above it. Keep the terminal gate as is (skips never count as passes, `apps/server/src/runs/service.ts` ~677–709), so QR-01/QR-08 are still required by the end of the run (the frontend task re-runs every suite: `seed.ts:175 taskRequiredExtensions`).
- Test: add a unit test next to the existing behavior/acceptance tests (`packages/generator/src/acceptance.test.ts` or a new `behavior.test.ts` using the existing fake-fixture pattern) asserting that with `required = {qrwty:["downloadQr"]}` the `core` suite yields one `skipped` check carrying `QR-01` and no thrown error, and with all three required it runs. There is currently **no** test containing the string "requires future operations".

### 7.2 Browser suite vs. web notes (QR-09)
Files: `fixtures/acceptance/qrwty/browser.test.ts`, web element `notes` in `fixtures/designs/qrwty.json`, `fixtures/designs/qrwty.layout.json` unchanged.
- Console filter (`browser.test.ts:89`): Chromium logs every 4xx fetch as a console `error` ("Failed to load resource: the server responded with a status of 401"). The notes *require* `GET /auth/session` on load, so a correct app fails. Change the filter to ignore lines matching `/Failed to load resource/` in addition to `favicon`; keep everything else.
- Row selection: add to the notes a per-row select control `data-testid="qr-select"` (a button) and change `row.click()` (`browser.test.ts:45`) to `row.getByTestId("qr-select").click()`.
- Scope per-row actions: `qr-image-download` and `qr-activity` become **per selected row**; in the suite look them up as `row.getByTestId(...)`. State in the notes: "shown only for the selected row".
- `today` (`browser.test.ts:8`, `activity.test.ts:21`, `_support/api.ts:138`): compute once per test at start (already) — add a comment that a run crossing 00:00 UTC can flake; no code change.

### 7.3 qr-image suite enforces what the notes promise
- `fixtures/acceptance/qrwty/qr-image.test.ts`: after decoding, assert PNG `width === 512 && height === 512` using the existing `pngjs` decode in `_support/qr.ts` (expose width/height from `decodeQr` or add `pngSize(buffer)`). Assert `content-disposition` matches `/^attachment/i`. Do not try to assert EC level or margin.

### 7.4 Activity range boundary, pinned
- Define: valid when `to >= from` and `(to - from)` ≤ **365 days** (i.e. at most 366 dates inclusive). Update the `activity` extension `notes` in `qrwty.json` to this exact wording and add two assertions in `fixtures/acceptance/qrwty/activity.test.ts`: `from=2025-01-01&to=2026-01-01` (365 days apart) → 200; `from=2025-01-01&to=2026-01-02` → 400.

### 7.5 Agent-guide hints that prevent predictable retries
Files: `templates/rest-api-server/agent-guide.md`, `templates/http-service/agent-guide.md` (and the fixture extension notes where noted).
- `sessionPrincipal(request.request)` returns `{ id, csrfToken }`; **`principal.id` is the owner id** compared against the resource's `owner_id` column (name via descriptor).
- Dates: `pg` returns `date`/`timestamptz` as JS `Date`; the response validator rejects that for `format: date`. Show `to_char(date_trunc('day', col AT TIME ZONE 'UTC'), 'YYYY-MM-DD')` or `::text` and aggregate with `AT TIME ZONE 'UTC'`.
- Binary responses: set `content-type: image/png` explicitly and return a `Buffer`; show the 3-line Fastify reply example.
- Fastify auto-HEAD: register the redirect route with `exposeHeadRoute: false` (or note HEAD must not count). Add to the `redirect` extension notes.
- Add `import { defineFeature } from "@jeeves/http-service"` (use the real package name from the scaffold) to the guide example that omits it.

### 7.6 Re-bootstrap fixture validity
- `node --import tsx scripts/...` is not needed: just run `pnpm check`, then `pnpm exec vitest run --config vitest.templates.config.ts packages/generator/conformance/harness.conformance.ts` (Docker; ~70 s) and extend that conformance test with the 7.1 partial-required skip case if feasible in < 1 extra minute; otherwise the unit test from 7.1 suffices.

Done when: `pnpm check` green; harness conformance green; `designSchema`/`validateDesign` on the edited `qrwty.json` report zero findings (there is an existing qrwty fixture unit test — `packages/generator/src/qrwty.test.ts` — keep it green).

---

## P8: Run robustness (timeouts, shutdown, feedback, cleanup)

### 8.1 Wall-clock limits
- `packages/generator/src/exec.ts runCommand`: spawn with `detached: true` and on timeout/abort kill the **process group** (`process.kill(-pid, "SIGTERM")`, then SIGKILL after 5 s). Today only the direct child dies and pnpm/vitest/Playwright grandchildren are orphaned.
- `packages/generator/src/baseline/index.ts`: per-step `timeoutMs`: install 15 min, typecheck 10 min, test 20 min, test packs 20 min each; compose up keeps `--wait-timeout 300`. Read overrides from `JEEVES_CHECK_TIMEOUT_MIN` (one multiplier is enough). A timeout is a failed step with message `"<step> exceeded <n> min"`.
- Coding session limit: in `packages/orchestrator/src/agent.ts` wrap `agent.run` with a timer (default 45 min, `JEEVES_AGENT_TIMEOUT_MIN`) that aborts the signal; result = failed attempt with feedback `"The coding session exceeded <n> minutes and was stopped."` (non-blocking, so a retry starts a new session with the diff).

### 8.2 Graceful shutdown aborts live work
- `apps/server/src/main.ts` `shutdown`: before `app.close()`, call a new `runs.stopAll()` on `RunService` (`apps/server/src/runs/service.ts`, the `live` map at line 126) that aborts every controller and awaits up to 10 s; the existing `recoverRuns` path already marks attempts interrupted on next start. The Codex SDK kills its child on abort; with 8.1 the check commands die with their groups.
- Resume safety: in `agent.ts` the integrity check (`assertGeneratedIntegrity`, ~line 55) runs **before** any revert, so an orphaned agent's edit to a generated-owned file turns the next attempt into `needs-attention`. Change: when the task's previous attempt is `interrupted`, first `git checkout -- <generated-owned tracked paths>` (paths from the lock) and `git clean -fd` restricted to `tests/generated tests/acceptance`, log what was restored as an intervention note, then run the integrity check.

### 8.3 Retry feedback the agent can act on
- `agent.ts` `FEEDBACK_LOG_LINES` 80 → 200, and capture the tail **per failing step** (`baseline/index.ts` already pushes `steps[]` with `message`): store the last 120 lines of each failed step's own output in `message` (truncate from the front), so the feedback shows the vitest assertion rather than `compose down` noise. Keep the behavior-step 4,000-char excerpt.
- Also: when `pnpm -r test` fails, message must include the failing package's output lines, not just "exit code 1".

### 8.4 Compose hygiene and env preflight in checks
- Before `docker compose up` in `baseline/index.ts` run `docker compose down --remove-orphans` (no `-v`) when `docker compose ps -q` is non-empty, so a crashed previous check never blocks port 5173.
- Env preflight (shared helper, used by P10 too): parse `docker-compose.yml` for `${VAR:?...}`; if a variable is in neither `.env` nor the environment, fail the `compose-up` step **before** running Docker with `Missing required environment: QRWTY_PUBLIC_ORIGIN, DB_QRWTY_PASSWORD. Add them to <dir>/.env.` Put the helper in `packages/generator/src/baseline/compose.ts`.

### 8.5 Provider error classification (Codex)
- `packages/providers/src/codex.ts:179-194`: tighten the `\b5\d\d\b` regex to HTTP-context only (`/\b(?:status|HTTP)\s*5\d\d\b/i`) and treat `rate-limit`/`unavailable` as a **60 s backoff then retry once** inside the same attempt rather than burning a retry immediately. Unit test in `codex.test.ts`.

Tests: unit tests for process-group kill (spawn `sh -c "sleep 60 & wait"` with 200 ms timeout, assert no survivor via `ps`), per-step timeout message, env preflight parsing, `stopAll` aborting a fake agent (fake coding provider exists: `fake-coding.ts`), interrupted-resume restore. `pnpm check` + `pnpm test:e2e --workers=2` (24 existing).

---

## P9: Coding providers — OpenCode adapter, Codex effort, Settings simplification

### 9.1 OpenCode as a `CodingAgentProvider`
Decision: drive the **CLI** (`opencode run`), not the SDK server, mirroring how `codex.ts` wraps a child process; sessions resume with `--session <id>`.
- Install: `npm i -g opencode-ai` (the user runs this; Jeeves only detects it). Status check: `opencode --version` succeeds → "Installed"; else help text with the install command. Provider id `opencode`, `kinds: ["coding"]`, `auth: { type: "cli-login", command: "opencode auth login" }` in `packages/providers/src/catalog.ts` (add to the `ProviderId` union; `providerEnum` in `apps/server/src/settings.ts:22` derives from the catalog). Add a `case "opencode"` in `settings.ts providerStatus` (exhaustive switch) and a branch in `apps/server/src/runs/agents.ts:71` (today hard-codes `provider === "codex"`). `apps/server/src/chat/models.ts` needs no change (coding only).
- Model field = `provider/model` as OpenCode expects (e.g. `deepseek/deepseek-v4-flash`, or the user's custom `deepai/deepseek-flash`). Empty → OpenCode's configured default. `suggestedModels` entry: the two above.
- First executor step (mandatory, record in handoff): run `opencode run --format json "Reply with the word pong"` in a scratch dir and paste 10 lines of the raw JSONL into the handoff; build the parser from that, not from memory. Expected: one JSON object per line with `type`, `sessionID`, `part` (text/tool/step events). Map: text parts → `message`, tool parts → `command`/`files` events, final assistant message → `finalMessage`. Usage: take `tokens`/`cost` from the assistant message info if present in the stream; else run `opencode session export <id>` after completion and read the last assistant message's `tokens.input/output` and `cost`; if absent, usage `null` (never zero).
- New file `packages/providers/src/opencode.ts`: `run({workingDirectory, prompt, model, resumeSessionId}, {signal, onEvent})` spawns `opencode run --format json --auto [--model m] [--session id] <prompt-via-stdin or arg>` with `cwd: workingDirectory`, `detached: true`, kills the group on abort; emits `session` as soon as a `sessionID` is seen; classifies stderr/exit for `codexError`-style mapping (`401|unauthorized|api key` → auth; `insufficient|quota|credit|balance` → quota; `429` → rate-limit). Do not rely on `--dir` (removed in OpenCode 2). Capabilities `{resume: true, usage: true, streaming: true}`.
- Sandbox note: OpenCode has no sandbox; `--auto` approves tool calls. Jeeves's owned-path revert + git branch is the guard. Write this in the README provider table.
- Tests: `opencode.test.ts` with a fake `opencode` script on PATH (shell script printing recorded JSONL lines; same technique as `codex.test.ts`'s fakes) covering: session id capture, text/tool mapping, resume flag, abort kills group, quota classification, usage null when absent.

### 9.2 Codex reasoning effort for coding
- Add optional `reasoningEffort` (`low|medium|high|xhigh`) to the coding role in `settings.ts` config schema + `PUT /settings/roles`; pass as `modelReasoningEffort` in `codex.ts` thread options; for OpenCode pass `--variant <effort>`. Default: unset (provider default). Settings UI: a small select beside the coding model. This matters because the user's Codex default is `xhigh`.

### 9.3 Settings simplification (from the approved P2 review)
`apps/web/src/settings/SettingsView.tsx`:
1. **Connections** card first: one row per provider with StatusBadge, one-line help, and the exact setup command in a copyable code span (no new server actions).
2. **Models** card: two rows labelled **Design model** (role `designChat`) and **Implementation model** (role `coding`, with the 9.2 effort select).
3. **Advanced** disclosure (Mantine `Accordion`/`details`): the **Planner** role row.
Keep all `data-testid`s / labels used by `apps/web/e2e/chat.spec.ts` settings test or update that test; everything by mouse; axe clean. `pnpm test:e2e --workers=2`.

---

## P10: Generate — acceptance packs, env preflight, app URL, bootstrap into `~/github/qrwty`

### 10.1 Acceptance packs selectable in Generate
- Server-side registry only (no source upload over HTTP): `apps/server/src/generate/acceptance-packs.ts` lists packs by scanning `fixtures/acceptance/*/manifest.ts` (today only `qrwty`; the manifest exports the `FixedAcceptance[]`). `GET /generate/acceptance-packs` → `[{id, suites: [{id, acceptanceIds}]}]`.
- `apps/server/src/routes/generate.ts` `startBody`: add `acceptancePack?: string`. `GenerationService.start/run` (`apps/server/src/generate/service.ts:112-117, 288-292`) passes the resolved pack as `fixedAcceptance` to `generateProject`. Unknown id → 422. Omitted → suites already in the lock are retained (existing behavior).
- Drawer (`apps/web/src/generate/GenerateDrawer.tsx` + `store.ts`): a `NativeSelect` "Fixed acceptance pack" (None / qrwty), shown with the suite ids and acceptance IDs it would register. After generation the drawer already lists acceptance IDs per check.
- Tests: route test (`routes/generate.test.ts`) for unknown pack 422 and pack forwarded; e2e `generate.spec.ts` selects the pack by mouse (scripted provider; generation without baseline).

### 10.2 Env preflight and app URL in the drawer
- Reuse the P8.4 helper: before baseline, if required compose variables are missing, stop with a single clear `env` step failure naming the variables and `<dir>/.env`; the drawer shows it as the first failed step (not "template bug").
- After a green baseline: compute URLs from the design — a `web-app` with `hostPort` → `http://127.0.0.1:<hostPort>`; otherwise show the `docker compose port <id> 5173` hint. Render as a link list "Open the app" in the drawer (and in `GET /projects/:id/generate` overview so Runs can show it later). `compose down` still runs after the baseline; say so next to the link ("start it with `docker compose up --wait`").

### 10.3 Bootstrap rewrite (`scripts/qrwty-bootstrap.ts`)
- Flags/env: `--output-dir` (default `~/github/qrwty`), `--api` (default `http://127.0.0.1:4310`), `--public-origin` (default `http://127.0.0.1:5173`; must equal `hostPort` in the fixture — assert and exit if they disagree).
- Flow: create/reuse project → apply design + layout through the API (keep the deep-compare guard but compare after a round-trip through `designSchema.parse` of both sides so server normalization doesn't trip it) → `PATCH /projects/:id` `outputDir` (verify the route accepts it; add if not) → write `.env` **merging** existing keys (never drop user variables) → `POST /projects/:id/generate {baseline:false, acceptancePack:"qrwty"}` through the server (not in-process), poll until done → if the directory was already a git work tree with uncommitted changes, commit `Generate qrwty template project (design revision N)` → print the next steps (P11).
- Remove the second in-process regeneration; instead assert via `jeeves/lock.json` that six suites are registered.
- Add `~/github/qrwty` facts to README "qrwty bootstrap": the repo's existing `README.md`/`.docs/` are left alone; `.env` is git-ignored by the generated `.gitignore`.

Tests: route/service unit tests for pack forwarding and the env step; e2e for the drawer select; manual: `pnpm qrwty:bootstrap` against `~/github/qrwty`, then `git -C ~/github/qrwty status` is clean and `log` shows the baseline commit. Record output in the handoff.

---

## P11: The qrwty proving run (operational step list, executed by a person + agent together)

Preconditions: P7–P10 committed; credits available on the chosen provider; `opencode` installed and `opencode auth list` shows the DeepSeek (or `deepai`) credential, or Codex logged in.

1. `pnpm dev`. Settings → Implementation model: either `codex` + model `gpt-6.1-sol` + effort `medium`, or `opencode` + `deepseek/<model id from opencode models>`. Design model stays Codex. Save.
2. `rm -rf ~/jeeves-projects/qrwty` (stale). `pnpm qrwty:bootstrap` (defaults target `~/github/qrwty`). Confirm the printed suite/case line and the baseline commit.
3. Draw → project `qrwty` → Generate → pack = qrwty (already in lock; leave None), baseline **on** → green. Confirm the drawer shows `http://127.0.0.1:5173` and the three extension operations as *deferred* application acceptance, standard behavior passing.
4. Runs → Plan a run → verify exactly 4 tasks (qr-image, redirect, activity, then `qrwty-web`), the 9 acceptance IDs listed, mode **Review after each task** → Start.
5. After each task: read the attempt's checks; expect `core`/`restart` **skipped** until task 3, `browser` skipped until task 4. Resume. If a task reaches `needs-attention`: read the feedback, **Record note** what you did (this is the human-help evidence), fix or resume. Never edit `tests/acceptance/**`.
6. When the run succeeds: `cd ~/github/qrwty && git merge --no-ff jeeves/run-<id> && docker compose up --build --wait`, open exactly `http://127.0.0.1:5173`, do the QR-09 journey by mouse yourself once, scan the downloaded PNG with a phone.
7. Evidence: append handoff entry "qrwty proving run" with: run id, design revision/hash, provider/model/effort per task, attempts/retries, usage ledger totals (tokens; cost unknown for Codex), elapsed, every intervention, and the per-case QR-01…QR-09 status from the final attempt's checks. Then update `docs/examples/qrwty.md` status and `PLAN.md` decision log (one line each). Commit `P11: qrwty proving run evidence`.
8. Only after that: pick the additive feature (candidate: campaign label + owner filter) — a separate approval, not part of this plan.

---

## Verification summary (per package)

| Package | Required checks |
| --- | --- |
| P7 | `pnpm check`; harness conformance (Docker); qrwty fixture test green |
| P8 | `pnpm check`; `pnpm test:e2e --workers=2`; one manual Ctrl+C during a fake-agent run leaves no `codex`/`sleep` survivors |
| P9 | `pnpm check`; `pnpm test:e2e --workers=2`; manual `opencode run` smoke recorded in handoff |
| P10 | `pnpm check`; e2e generate spec; manual bootstrap into `~/github/qrwty` recorded |
| P11 | QR-01–QR-09 pass in the final attempt's checks; evidence appended |

## Known non-goals (do not expand)
Anthropic adapter (needs an API key the user doesn't have), local models (S14), field-by-field resource builder, cloud deploy, benchmarks, the additive feature.
