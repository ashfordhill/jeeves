# Production foundations: independent review (PF14)

Reviewed 2026-11-12 at `34198be` by an agent that wrote none of PF01–PF13. Each unit was read
against [the plan](units.md) and its [handoff](../../handoff.md) entry, its greps were rerun (also
with `command grep`), and the four checks were run again.

## Owner summary

- All thirteen units did what the plan asked. Every grep, count and check they report reproduces
  today, and none edited a file the rules protect.
- v4 is on the final templates: `update:v2 --check` finds nothing to create, replace or remove,
  only the four browser files v4's notes list as overrides.
- Delivered: no dashed line without a queue or topic and no direct call to a worker (D2); the
  strict-contract surface gone from the web app and chat (D3); TinyURL as the default study (D4);
  `update:v2`, which moved v3's app onto the new templates keeping every file v3 wrote (D5).
- The Docker run showed the code holds with two copies, a cache outage and a Transcoder killed
  mid-encode. A broker outage stops every process that uses it, Watch's reads too, until
  `pnpm start`, which also drops to one copy. So D1 is only partly met; no database outage ran.
- One doc fix (the studio guide's chat tool table); no code defect met PF14's bar for a fix.
- For you to decide: broker loss, the next plan or field project, and schemas on links (below).

## Decisions

| # | Verdict | What I saw |
| --- | --- | --- |
| D1 | **Partly** | No scale setting was added, and no form offers replicas. Two copies of all eight processes passed every acceptance step (PF12 B1–B4) and either Watch copy could stop. The cache read survived its cache stopping and came back by itself (F1a/F1b). A killed Transcoder's job was redelivered to the other copy (F3). But a broker outage made all 12 broker-using containers exit, and they stay exited (F2a); recovery is `pnpm start`. No database, object storage, search or identity outage was run. |
| D2 | **Delivered** | `studio-links.ts` has no `either`: application ↔ application and ↔ external API are sync only, and `callableKinds` keeps Worker and Notifications reachable only from a queue or topic. The refusal sentences, the TinyURL removal plans (Click events → 2 tiles, Redirect service → 4) and the stored-design findings match the plan; the docs say so. |
| D3 | **Delivered**, with leftovers | The forms, Source & diagnostics' reports and five chat tools are gone; chat has the eleven tools its test pins; spec code and ownership stay. Leftovers: unused `.readiness-*` CSS, unreachable `onTarget` branches in `Workspace.tsx`, `service.ts` still accepting an `operation:` selection, and `docs/chat-tool-schemas.md` describing the configure tools in the present tense. |
| D4 | **Delivered** | `DEFAULT_STUDIO_EXAMPLE_ID` is `studio-tinyurl`; New project lists three studies; the foundation still opens by its ID. |
| D5 | **Delivered** | `planUpdate` follows the eighteen rows exactly; `updateDirectory` preflights before writing and writes the manifest last. On v4 it kept all 31 files v3 wrote byte for byte, and it reports v4 current now. The four overrides are template gap 8. |
| D6 | **Partly** | This plan's part, removing the two links that generate nothing, is delivered (PF03). That two templates that can't work together are refused when connected was neither changed nor checked by any unit. |
| D7 | **Delivered** | One run of v4 (PF12 then PF13 on the same stack): two copies of each process, then cache, broker and Transcoder faults and a read sample, then a clean teardown. Every step is Observed, and the raw evidence matches the notes. |
| D8 | **Delivered** | Nothing was added that only reviews or analyses designs; the plan removed surface (four forms, two reports, five chat tools). |

## Units

Every unit's commit name is the plan's, each handoff entry was appended without editing an
earlier one, and no unit touched the root README, v1–v3's `generated/`, `app/`, `inputs/` or
`diagrams/`, `local-v1` or `docs/evals/`.

| Unit | Verdict | Checked |
| --- | --- | --- |
| PF01 | As planned | The glossary and gap list equal the plan's blocks (later units added rows and statuses as their units say); the playbook, studio guide and review-pack edits are in place; the grep prints nothing. |
| PF02 | As planned | The three greps print nothing; the Components table and `studioComponentKinds` both have 19 rows. |
| PF03 | As planned | The grep prints nothing; the code matches steps 1–8; the five new tests exist and the named tests and e2e specs changed as listed. Leftover: `linkRuleText`'s two-mode branch is unreachable. |
| PF04 | As planned | Both greps print nothing; `operations.ts` has no importer; nine e2e tests went (82 → 73). Leftovers: the CSS, the `onTarget` branches and `create-example.ts`'s header comment. |
| PF05 | As planned | The grep prints nothing; the new test and the 11-tool assertions exist; the two route tests are gone. The studio guide's table named six of the eleven tools (fixed here). |
| PF06 | As planned | The failure log, `onFailure` options and guarded callbacks match steps 2–8; all eight of v4's process files create the log and wire it. `service-resources.ts`'s `positiveReader` passes no `onFailure`, but no generated process calls it. |
| PF07 | As planned | The reader's skip and stall count and the Valkey client generations, timer, report-on-change and `close()` match the plan; F1a/F1b showed them live. |
| PF08 | As planned | `encode`/`emit`, `onSkippedReport`, the sweep's `failed` list and `AggregateError`, and both wirings are in place and in v4. |
| PF09 | As planned | `planUpdate` read against the G, E, R and U tables: each row and the ownership rule as written; 28 tests (18 table rows). |
| PF10 | As planned | Steps 1–8 in order, with the recorded extras (real-path root, refusing `.jeeves/` paths in the manifest, pruning empty shadow folders); 12 tests. |
| PF11 | As planned | Design SHA-256 `9762df41…3813f`; the byte check prints `{"checked":31,"differ":[]}`; the four override `cmp`s are equal; a fresh `export:v2` equals `v4/generated/` (112 files); the app's manifest equals the export's. |
| PF12 | As planned | The notes match the evidence. No code changed. |
| PF13 | As planned | The notes match the evidence (F2a's `ps -a`, F2b's `pnpm start` output and images, F3's `docker top` and kill, T1's JSON); the teardown is recorded. No code changed. |

No template changed after PF08 (only `src/v2/update-cli.ts` was added), so PF12's and PF13's
evidence covers the final templates.

## What failed in PF12 and PF13

No step was marked Failed: each met the plan's expectation, and F2a and F2b only asked for a
record. Measured against D1 these went wrong, most serious first:

1. **F2a: a broker outage stops 12 of 16 application containers, and they stay stopped.** Within
   0.11 s both copies of Watch, Upload, Video lifecycle and Transcoder exited (`AMQP publisher
   unavailable`) and both of Search indexer and View counter (`AMQP consumer unavailable`).
   Watch's details read needs only the cache and the database, yet answered 503 from the edge,
   because its view publisher's loss ends the process. Search (no broker) kept answering.
   *Template:* the AMQP runtime (`src/runtime/amqp.ts`: `onFatal` → `scope.fail` in `process.ts`),
   as `local.tile-processes` wires it for Event counter's publisher, Multipart's jobs relay,
   Upload lifecycle, Video encoding, Search indexing and Event counter; and `app-*` services with
   no restart policy. It is the known limit "A process that loses its broker exits and is not
   restarted".
2. **F2b: recovery is `pnpm start`, which returns the stack to one copy.** It removed all eight
   `-2` copies, rebuilt both images, reran `setup-migrate` and `setup-broker`, and left
   Transcoder `-1` on its earlier media image. *Template:* the local runtime foundation's
   `scripts/local.mjs` (`start` runs `docker compose up -d --wait` on the application services
   at their default scale).
3. **Complete answers 200 with `pending`** (A2, B4, F3). *Template:* Multipart upload; gap 1.
4. **Not shown by the evidence.** A2's and B4's 404s before ready weren't kept (`pf.mjs`'s `poll`
   keeps only its last read). In PF12 both encodes ran on Transcoder copy 1; F3 later showed
   copy 2 taking a redelivered job. T1's three samples are 2,000 reads in about 0.5 s each, a
   burst rather than a sustained rate. `docker top` showed the Transcoder's `node` and `ffmpeg`
   as root: the generated `Dockerfile` (`templates/local-v2/assets/Dockerfile`) sets no `USER`.

## Follow-ups

Most important first. **Owner** marks one that needs your decision.

| # | Follow-up | Owner? |
| --- | --- | --- |
| 1 | **Whether a broker loss should keep stopping processes.** Now any process holding a publisher or consumer exits, Watch's read path with it, and a deployment's restart policy is expected to bring it back. The alternative is that `amqp.ts` reconnects, and only the work that needs the broker waits. The [generated system tests plan](../generated-system-tests/units.md)'s GS07 tests broker recovery with an explicit restart and says not to add a restart policy. | **Owner** |
| 2 | **Marketplace as the next field project, with the template set frozen first** (and your buyer/seller revisit). | **Owner** |
| 3 | **Which plan is next.** `AGENTS.md` and `jeeves/PLAN.md` still name production foundations as the active plan; the generated system tests plan says it starts after this review. | **Owner** |
| 4 | **Schemas on links** (message and record schemas), deferred to the next plan. | **Owner** |
| 5 | **Open template gaps:** 1 (Complete can't carry the video's state and answers 200), 4 (no key prefix for Lifecycle and Transcoder hooks), 7 (the cache read's 404 can't be shaped). Template work, kept out of this plan. | No |
| 6 | **Gap 3:** the outbox relay still retries a failing codec for ever (now logged). Needs a policy: how many attempts before a row is set aside. | **Owner** |
| 7 | **Gap 8:** the export serves no browser, so v4 keeps four overrides. UI is outside Jeeves for now. | **Owner** |
| 8 | **Known limits:** the event counter keeps one receipt per event for ever (needs a retention period); the outbox relay sends at most 10 rows about once a second (no decision unless a field project needs more); host names compiled for local Compose (deployment, outside Jeeves). | **Owner** (retention) |
| 9 | **Faults not yet run:** PostgreSQL, Garage, OpenSearch and Keycloak outages, and queued work across a broker restart. GS07 covers PostgreSQL and the broker case. | No |
| 10 | **`pnpm start` after a fault drops extra copies** and left one container on an older image. Copies are deployment (D1): keep the behaviour and say so in the generated README, or make `start` keep the running scale. | **Owner** |
| 11 | **Containers run as root:** add a `USER` to the generated `Dockerfile` (emitted code: regenerate v4 and rerun its tests). | No |
| 12 | **The failure log's once-a-second limit per `what`** logs only the first failed upload's ID in one sweep (the rest are counted as `suppressed`). Key it per upload, or list the IDs in one line. | No |
| 13 | **D6's other half:** check that every pair of templates that can't share a tile is refused when connected, with the reason. | No |
| 14 | **Cleanups:** PF04's `.readiness-*` CSS, `onTarget`'s connection and element branches and `create-example.ts`'s header; `service.ts`'s `operation:` selection; `docs/chat-tool-schemas.md`'s configure-tool sentences and the chat-tool text in the bodies of `studio-contracts.md` and `studio-readiness.md`; `linkRuleText`'s two-mode branch; the unused `positiveReader` (or give it `onFailure`); `update:v2` leaving an empty folder after removing a file, and a `.jeeves-update` temporary file if killed mid-write; the `useTemplate` lint info in `local.mjs`. | No |
| 15 | **Harness and evidence:** `pf.mjs`'s `poll` keeps only its last read, upload titles still read "V3-17", and a read sample should run longer than half a second. GS07 and GS09 cover the same ground. | No |
| 16 | **A sweep lists the 50 oldest interrupted uploads**, so uploads that fail every time stay first until they expire. Low risk. | No |

## Docs fixed

- `docs/studio.md`, Chat: the tool table listed six of chat's eleven tools after "chat now has
  eleven:", so `jeeves/PLAN.md`'s "listed in the studio guide" was false. It now lists all
  eleven, with `describeStudioDefinition`, `describeStudioPattern`, `validateDesign`,
  `declareReviewScope` and `askUser` described from `chat/tools.ts`.

Nothing else in `AGENTS.md`, `jeeves/README.md`, `jeeves/PLAN.md`, `jeeves/CATALOG.md`, the
touched sections of `docs/studio.md`, `jeeves-generator/README.md`, `docs/glossary.md` or
`docs/template-gaps.md` was proved false by the code. Counts checked: sixteen kinds, nineteen
module kinds, the 16-round limit, the link table rows, both TinyURL removals, the outbox's 10-row
batch and one-second tick, and the Failure lines list against the wiring.

## Checks

| Check | Result |
| --- | --- |
| `update:v2 … field-projects/youtube/v4/app --check` | Exit 0. `refused` [], `counts` create 0, replace 0, unchanged 96, keep 11; `keepChanged` []; `override` `.gitignore`, `compose.yaml`, `infra/edge/nginx.conf`, `package.json` (v4's notes list these four); `remove` []; `orphan` []. |
| check (`pnpm check`) | Passed before and after the doc fix: Biome 733 files (one `useTemplate` info in `local.mjs`), type checks, 105 files, 820 tests. |
| e2e (`pnpm test:e2e`) | 73 passed before (4.8 min) and after (5.7 min) the doc fix, no reruns. |
| build (`pnpm --filter @jeeves/web build`) | Passed, both times. |
| evals (`pnpm eval:chat`, offline) | Exit 0, both times; scripted-good 100/100/100, review 100; patterns 86.3/98.2/98.2; bad 1.7/18.5/18.5, review 5 (as after PF03 and PF05). |
| Unit greps | PF01, PF02 (three), PF03, PF04 (both) and PF05 print nothing, also with `command grep`. |
| PF11 reruns | Design hash, the 31-file byte check, the four `cmp`s and a fresh export against `v4/generated/`: all equal. |

No Docker stack ran; `jeeves_e2e` holds only its two older projects.
