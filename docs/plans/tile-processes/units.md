# Tile processes: every application tile runs

**Status:** planned 2026-11-10 from owner decisions. TP01 is done: the [contract](contract.md)
revises TP03–TP08 below. TP02 is done (usable connection dots). TP03 is done (IDs follow names).
TP04 is done (the option and the process skeleton). TP05–TP09 have not started.
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-10 — A runnable process per tile](../../HUMAN_FEEDBACK.md)
· Follows [module authoring](../module-authoring/units.md) and its [review](../module-authoring/review.md),
including contract question 6.

There are nine units, run in order: TP01 → TP09. A coordinator gives each unit to a fresh agent.
That agent does only its own unit on `main` in the primary checkout, commits it and stops.

## Goal

An exported design starts. Each application tile (Service, Worker, Uploads) becomes a runnable
process in the local Docker stack. Its templates and stubs are wired in, and its connected stores
are provisioned. A design built only of stubs comes up healthy: requests reach the stubs, and the
stubs answer "Not implemented" without crashing the process. The owner wants this to test how
robust tiles and modules are from here on.

## Owner decisions (2026-11-10)

1. **IDs follow names.** Fix this first, so generated process and file names come from the names
   the owner types, not from the kind at creation (`worker-service-3`, `app-microservice-2`).
2. **Opt-in.** "Runnable processes" is an export option, **off by default**. With it off, exports
   are exactly as today, so the frozen v2 rule (contract §8: 70 of 72 files byte-identical) still
   holds.
3. **Provisioning.** With processes on, every store or channel a stub is connected to is
   provisioned: database, queue, cache, object storage, search. A stub-only design then runs end
   to end.
4. **Consumer loops.** A consumer stub starts a consume loop that calls the stub. The stub throws
   "Not implemented" until filled in; the loop must survive that (bounded retry or nack, plus a
   log) and never crash-loop.
5. **Connection dots.** Make them usable at the fit zoom (module authoring review, follow-up 1).
   A connect drag pans near the canvas edge.
6. **The owner's own UI edits** in the running app are play. They are not incidents.

## What exists (commit `f84a27c`)

**Runnable services**

- `jeeves-generator/src/v2/local.ts` already accepts `local.services` contributions: a runnable
  service named `app-<host>`, with an explicit command, for a selected host (around lines
  637–748).
- No installed emitter contributes one. Every selected host lands in the required
  `application-services` gap (around lines 834–844).

**Templates**

- Templates emit libraries and factories: the multipart HTTP handler factory, worker and
  consumer factories, and the cache, query and counter factories.
- They also leave required product hooks, such as codecs, metadata and principal adapters, as
  custom gaps.

**Stubs (MA07)**

- Each stub emits `src/modules/<host>/<module>.slots.ts` and `<module>.ts`, and stubs share
  `src/modules/dependencies.ts`.
- A stub's entry point throws `Not implemented: <kind>`.
- Stubs provision nothing.

**Provisioning**

Infrastructure is provisioned only when a template binds it (`local.ts` around 114–206). A tile
linked only to stubs is not provisioned.

**IDs**

`newTileIdentity` and `newModuleIdentity` take the ID from the kind's name when the tile or
module is created (`studio-lane-commands.ts:894`, `studio-modules.ts`). Renaming doesn't change
the ID.

**Test data**

- The MA09 rebuild ("YouTube v2 rebuild (MA09)", `9dcb10a3…`) is the large example.
- `spec/src/fixtures/v2-modules.ts` and `v2-diff.ts` build and compare it.

## Fixed constraints

- **Off means unchanged.** With processes off, every export is byte-identical to today's. That
  covers v1 frozen, v2 frozen (§8), the MA09 rebuild and stub-only designs. Overview layout and
  export stay unchanged: the YouTube Overview PNG hash is `472a4c8c…dc9f`.
- **Standalone and deterministic:**
  - Generated apps are standalone: no imports from this checkout and no `workspace:` packages.
  - No network or model calls at render time.
  - No secrets in source. Secrets are provisioned at first run, as the existing local runtime
    does.
- **Product policy stays custom.** Required product hooks with processes on become generated
  hooks that answer "Not implemented". They must not invent product behaviour.
- **Docker hygiene:**
  - Use your own compose project names and loopback ports.
  - Never touch the owner's v1/v2 stacks, ports 45400–45412, their volumes or image tags.
  - Remove your own containers, volumes, networks and image tags afterwards.
- **Shared commands and UI rules:** mouse, chat and generation share commands. Every action
  works by mouse. `jeeves/packages/board` imports no Jeeves code. Add no Advanced forms or
  explanatory paragraphs.

## Rules for every unit

- **Read first:**
  - `AGENTS.md`;
  - the latest `docs/handoff.md` entries;
  - this plan and the HUMAN_FEEDBACK entry;
  - the module authoring contract and review;
  - from TP02 on, `docs/plans/tile-processes/contract.md`.

  Do only your unit and stop at its end.
- **Before editing:**
  - Run `git status`. The owner may have uncommitted work (`README.md`, `.docs/`,
    `.jeeves-feedback/`, the mode of `e2e-docker.sh`). Leave it unstaged and untouched.
  - If a file you must change has uncommitted edits you did not make, stop and report.
- **Environment:**
  - Use Node 24 (`~/.nvm/versions/node/v24.21.0/bin` first in `PATH`).
  - Run Biome or format only from the repo root.
  - Never stop or restart the owner's dev servers on 4300/4310. Use your own ports and scratch
    databases.
  - Don't edit `field-projects/` or any owner project, including the MA09 rebuild. Read it only.
- **Checks:**
  - `pnpm check`;
  - `pnpm test:e2e` (or `:docker`);
  - `pnpm --filter @jeeves/web build`;
  - a mouse check in the browser at 1440×900 and 1280×800: the TinyURL study renders, with no
    page errors.

  If an e2e test fails, rerun it alone and report both results. If something times out under
  heavy machine load, say so.
- **Gates:**
  - v1 export byte-identical;
  - v2 frozen export per contract §8;
  - processes-off exports unchanged;
  - YouTube Overview PNG unchanged.

  If a gate fails, stop and report.
- **Docs:** keep current `docs/studio.md`, `jeeves-generator/README.md`, `jeeves/CATALOG.md` and
  `docs/studio-settings.md` where affected. Add a dated playbook lesson when you learn something.
- **Finish:** append a short handoff entry and make one local commit named `TPnn: <summary>`.
  Don't push.

---

## TP01 — Process contract (docs only)

**Goal:** settle what a tile process is before anyone builds it.

Write `docs/plans/tile-processes/contract.md`, concise, with tables and file:line citations. It
answers:

1. **The option.** Is it saved in the design (for example `generation.processes`) or chosen only
   at export? Recommend one by reproducibility and the off-means-unchanged rule. How do the
   manifest and report record it? How do chat and the blueprint see it?
2. **Process shape per application kind:**
   - Service and Uploads: an HTTP server.
   - Worker: consume loops.
   - A Service that also holds consumer modules.

   Also cover the entry point path, config and environment, the health endpoint, graceful
   shutdown, and the compose service with its `depends_on`, healthcheck and ports (only a public
   edge is exposed).
3. **Wiring templates.** How each of the 7 templates' factories is mounted or started inside its
   host's process. Which required product hooks become generated "Not implemented" hooks with
   processes on. What each one answers: 501 over HTTP, nack or retry in a loop.
4. **Wiring stubs:**
   - How a stub's entry point is reached.
   - HTTP: a route per stub? Which method and path? Recommend a minimal, predictable rule.
   - Consumer slot: a loop.
   - Neither: called nowhere, but imported so it type-checks.
   - What a filled-in stub needs to change. Ideally nothing in generated scaffold files.
5. **Consume loops:** the queue worker mechanism to reuse (from the durable worker/consumer
   templates), retry and backoff bounds, how the "Not implemented" error is handled and logged,
   and the stop condition.
6. **Provisioning for stubs:** which tile kinds are provisioned when only stubs connect to them,
   with what access, and the setup scripts. How ownership and grants are derived without new
   forms, reusing MA05's derivation where possible.
7. **IDs follow names (decision 1):**
   - The rule: re-key a tile's or module's ID on rename, updating every reference in one Undo
     step and refusing on collision.
   - When the rule does not apply: designs with a pinned or frozen origin, the studies, imported
     source.
   - Chat parity.
   - Effect on existing exports: exports go only to new directories, so there is no in-place
     conflict.
8. **Acceptance runs.**
   - Exactly which designs are exported with processes on and run in Docker: a stub-only design
     and the MA09 rebuild (read from the owner's database, or rebuilt from the fixture).
   - What "healthy" means.
   - Which requests prove templates and stubs are wired.

Add an **Owner summary** of at most 12 lines at the top, and **Open questions**, each with a
recommended default. Revise TP02–TP08 if the contract changes their scope.

**Checkpoint:** if the open questions stay within the owner decisions above, the coordinator
relays the summary and continues. If they go beyond them, the coordinator pauses for the owner
before TP04.

**Commit:** `TP01: tile process contract`.

## TP02 — Usable connection dots

**Goal:** module connection dots are easy to hit at the fit zoom (decision 5).

- The dot's hit area has a minimum on-screen size, for example 16px, at any zoom. Its visual
  marker stays small and grid-true.
- While Connect mode is on, dots on rows that can connect grow slightly when you hover their
  container.
- A connect drag near the canvas edge pans the canvas. Releasing still works after the pan.
- No layout or Overview change. Keep the board generic.

**Tests**

- E2E: at the fit zoom, connect a module by dragging from its dot (MA09 found this awkward).
- E2E: a drag past the edge pans.
- A board unit test for the edge pan.

**Commit:** `TP02: usable connection dots`.

## TP03 — IDs follow names

**Goal:** implement TP01 §7 (decision 1).

- **Re-keying (contract §7):** renaming a tile or module re-keys an ID that still *follows* (its
  creation form or its current name's slug). A tile becomes `slug(name)` and a module
  `<host>-<slug(name)>`. A tile's re-key also re-keys its following modules.
  - Every reference is updated in one batch and one Undo step: connections, studio bindings and
    setting references, modules, module links, ownership, generation, operations, scope and entries.
    Derivation re-runs in the same batch.
  - Afterwards no string equal to the old ID may remain outside free text; otherwise refuse.
  - It refuses with a plain reason on a collision, including a cascaded module.
  - **Pinned:** designs with `architecture.studio.origin` (the studies, frozen v2), designs with a
    tile-level selection or a preset, and IDs that don't follow. There, the rename changes only the
    name and never refuses.
  - Link IDs are not re-keyed.
- **Chat:** the same command. The `applyStudioCommands` result lists `renamed: [{from, to}]`. The web
  keeps its selection on the new ID.
- **Tests**
  - Unit tests: re-key every reference kind; the cascade; the completeness walk; refusals; Undo.
  - A re-keyed design equals one built with the final IDs from the start.
  - Old designs and the studies keep their IDs unless renamed. Pinned designs rename without
    re-keying.
  - The MA09 diff helper still passes on a rebuild that renames as it goes.
- **E2E:** add a Worker, rename it "Video lifecycle worker", and its ID becomes
  `video-lifecycle-worker`.

**Commit:** `TP03: ids follow names`.

## TP04 — The option and the process skeleton

**Goal:** with processes on, each application tile becomes a compose service that starts and
reports healthy. Features and stubs are not wired yet.

- **First, pin off:** before changing the generator, add the stub stack fixture
  (`spec/src/fixtures/stub-stack.ts`, contract §8). Move `moduleAuthored` into `v2-modules.ts`. Pin
  the processes-off payloads of frozen v2, the v2 module design with its values and the stub stack
  in a unit test.
- **The option (contract §1):**
  - `generation.processes: true` (absent means off), and the `setRunnableProcesses` command. The
    unticked "Runnable processes" checkbox in Generate project sends it, and so does chat. It
    refuses on designs that aren't built from modules.
  - `GenerationInstalledSupport.processes`, and the resolver's `model.processes`, which exists only
    when on.
  - Chat's getDesign, the manifest's `processes: true`, the report's `processes` and `runnable`,
    and blueprint v2's refusal.
  - Add no `generationPolicies` record.
- **The emitter:** a new trusted emitter, `local.tile-processes`, registered in
  `loadLocalV2Registry`. It contributes `local.services` for every Service, Uploads and Worker tile
  (and the legacy kinds, open question 6), including empty tiles:
  - an entry point at `src/processes/<id>.ts`;
  - compiled config;
  - `/healthz` on HTTP processes and the ready marker on all of them;
  - graceful shutdown, with idle workers kept alive;
  - a compose service with `depends_on`, a healthcheck and no restart policy.
- **Foundation changes:**
  - It accepts process hosts that have no selection.
  - With the option on, `scripts/local.mjs`'s gate reads `report.processes.runnable`.
  - The existing writers also emit `process.ts`, `http.ts` and `admission.ts` when a process needs
    them.
  - The `application-services` gap closes for those hosts. Off, nothing changes.
- **Gates:**
  - the standard gates;
  - a stub-only design exported with processes on installs, builds, runs `first-run` on your own
    compose project and ports, all `app-*` services report healthy, and stop and start keep them
    healthy;
  - clean up afterwards.

**Commit:** `TP04: process option and skeleton`.

## TP05 — HTTP wiring: templates and stub routes

**Goal:** implement TP01 §3–4 for Service and Uploads hosts.

- **The public edge:** `app-edge` (the pinned nginx), with `/api/<id>/` for public HTTP processes,
  as a new `edge` contribution.
- **Templates (contract §3):**
  - Multipart is mounted with its tables (`ownedUploadPersistence`, the generic schema rule) and a
    sweep.
  - The cache read is mounted with a source login.
  - Search query is a placeholder.
  - Each lead gets `src/modules/<host>/<lead>.hooks.ts`, whose hooks throw "Not implemented" (HTTP
    501). Its `*-application-bindings` gap becomes `custom` and names that file.
- **Stubs (contract §4):**
  - A route stub answers any method on `/modules/<module id>` and below.
  - Add `src/modules/entry.ts`, and give route stubs the request signature.
  - Not implemented gives 501 and a rate-limited log line.
  - Stub `Dependencies` whose stores aren't provisioned yet answer "Not implemented" until TP07.
- **Tests**
  - Generator unit tests for the route table, the edge config, the hooks files, and the stub files
    with the option on and off.
  - A Docker run of the stub stack plus a Service with a Cache reader and Data access. Edge health
    is OK. The stub routes answer 501 "Not implemented", and an unknown route answers 404. The cache
    route answers 501 naming its `key` hook.

**Commit:** `TP05: http wiring`.

## TP06 — Consume loops

**Goal:** implement TP01 §5 (decision 4).

- **Stub loops (contract §4–§5):**
  - Consumer stubs in any tile start loops through `createConsumer` and the delivery runner.
  - Give loop stubs the message signature; a consumed queue is no longer a `Dependencies` property.
  - "Not implemented" is terminal (`NOT_IMPLEMENTED`) and logged. Other errors retry 5 times with
    backoff of at most 10 s.
- **Templates (contract §3):** the asset lifecycle, Video HLS and the event counter are mounted
  with their tables and hooks files; the search projection is a placeholder.
- **Provisioning for loops:** the subscriber queues that stub loops consume, and the asset
  lifecycle's results subscriber, which is missing today.
- The process stays healthy and never crash-loops. Graceful shutdown drains the loops.
- **Tests:**
  - Unit tests for the terminal, retry and backoff handling and for the drain.
  - A Docker run of the stub stack: a message published to Visits and to Uploaded is received,
    logged as "Not implemented" and lands in `.failed`, while both processes stay healthy.

**Commit:** `TP06: consume loops`.

## TP07 — Provisioning for stubs

**Goal:** implement TP01 §6 (decision 3).

- With processes on, every store or channel a stub connects to is provisioned with the access the
  contract works out from its links (§6):
  - Postgres logins with CONNECT and USAGE, plus `published-read` views from another owner;
  - the queues it publishes to;
  - caches;
  - buckets with per-host keys;
  - search services.
- Unspecified providers get the local fixed values, and other saved providers become
  `unsupported` gaps. Nothing is written to ownership, and Identity isn't provisioned.
- Add `src/runtime/module-clients.ts`: real clients behind the stub interfaces, with one startup
  probe each.
- Off, nothing changes.
- **Tests**
  - Generator unit tests.
  - A Docker run of a stub-only design: all provisioned resources exist and every `app-*` is
    healthy.
  - Stop and start keep credentials and volumes.

**Commit:** `TP07: provisioning for stubs`.

## TP08 — Acceptance: run the rebuild

**Goal:** prove the goal on real designs.

- **The designs, the "healthy" checks and the requests are exactly those in contract §8.**
- **The stub stack (stub-only):** export it with processes on, then `first-run`. Every `app-*` is
  healthy, stub routes answer 501, a consumer stub logs and survives, and stop and start retain
  state.
- **The MA09 rebuild:** the v2 module design (`v2ModuleDesign()` with v2's 7 useful values), built
  from the fixture. Don't read the owner's database.
  - Export it with processes on and run it.
  - Every `app-*` is healthy and every provisioned resource exists.
  - Each of the 7 templates' processes starts. Where a product hook is missing, its routes or
    loops answer "Not implemented", naming the hook its handler reached. The two search templates
    are placeholders (contract §3).
  - Record per tile and module what runs, what answers 501 and what is still custom.
- **Off:** with processes off, the same designs export byte-identically to before TP04.
- **Evidence:** `docs/plans/tile-processes/evidence/tp08/README.md`, with commands, health
  output, request results and timings, plus at most 4 screenshots (Generate dialog, compose
  status).
- Clean up every container, volume, network and image tag you created.

**Commit:** `TP08: run the rebuild`.

## TP09 — Independent review

A fresh agent checks decisions 1–6 against the evidence and a fresh run of its own. It adds no
features and fixes small defects with tests. It writes `docs/plans/tile-processes/review.md`
with ranked follow-ups: owner decisions, the YouTube v3 readiness, and the later
Marketplace/TinyURL revisit.

**Commit:** `TP09: review tile processes`.

## Risks and stop conditions

- **Off must mean unchanged:** if any processes-off export changes, stop and report.
- **No invented product behaviour:** if the contract can't wire a template without inventing
  product behaviour, mark that template "process starts, feature answers Not implemented". Do
  not invent behaviour.
- **Docker:**
  - If Docker or provider images are unavailable, report it.
  - Do not substitute mocks for the acceptance runs.
  - Never touch the owner's stacks.
- **Re-keying (TP03):** if re-keying can't update every reference safely, refuse the rename
  rather than leave a half-renamed design.

## Not in this plan

These follow-ups from the module authoring review stay open:

- on the studies, the Cache reader shows Refused, and no control can change the values that
  block it;
- settings appear only after a template derives (processes may settle this; TP09 checks);
- chat can still add the legacy tile kinds;
- the fan panel covers its own tile in a narrow canvas;
- ownership clean-up matches facts by key.

Also out of scope: the layout follow-ups from the UI overhaul, YouTube v3, and the
Marketplace/TinyURL revisit.

## Coordinator prompt

> You are a fresh agent in `/home/ash/github/jeeves`. Do unit **TPnn** of
> `docs/plans/tile-processes/units.md`, and only that unit. First read `AGENTS.md`, the latest
> `docs/handoff.md` entries, this plan's Owner decisions, Fixed constraints and Rules, the
> HUMAN_FEEDBACK entry, the module authoring contract and review, and (from TP02)
> `docs/plans/tile-processes/contract.md`. Follow the unit, run every check and gate, append a
> handoff entry, make one local commit named as the unit says, and stop. If a stop condition
> applies, or a file you must change has someone else's uncommitted edits, report and stop
> without committing.
