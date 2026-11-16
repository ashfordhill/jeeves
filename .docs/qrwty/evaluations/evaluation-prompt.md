# Evaluation prompt: QRWTY's two implementations, and what they say about Jeeves

You are an independent reviewer. Another model receives the same prompt. Work alone: don't read or wait
for anything the other reviewer writes. Everything is read-only for you except your own report file.

## Background

**Jeeves** (`/home/ash/github/jeeves`) is a single-user studio. A person designs a web application's
backend as a diagram of tiles, links and modules. Jeeves then generates the deterministic part of the
backend from templates. People or agents write the rest in stub and hook files that the export leaves
to the application. The owner's goal is for templates to generate **60% or more of backend source**,
across different applications. Read `AGENTS.md` ("Goals and scope") for the scope rules:
- only what generates is offered;
- the diagram is the source of truth;
- production architecture, not deployment;
- UI and deployment are outside Jeeves.

**QRWTY** is a short-link and QR SaaS: guest links, sign-in, my links, redirect with durable click
counting, analytics, abuse controls and Stripe billing. It was built twice against the same frozen
product contract:
- **Arm A, built with Jeeves:** `/home/ash/github/qrwty`.
- **Arm B, built without Jeeves:** `/home/ash/github/qrwty-baseline`, an independent hand-written
  implementation.

The business plan is on pause. This evaluation is about **Jeeves**.

## Exactly what to evaluate (don't get confused)

### Arm A, the latest version

- **Code:** repository `/home/ash/github/qrwty`, commit **`0647e4a`** (unit A7). Use the `app/` tree
  at that commit; later commits only add the README tables.
- **What generated it:** Jeeves commit **`0aea8e7`**, from diagram **revision 84**. The diagram is in
  `docs/evidence/q05/jeeves/`:
  - `QRWTY-production-candidate-v1-r84-source.json`;
  - `blueprint-v3-r84.json`;
  - `…-r84-detailed.png`.
- **Which file is generated:** `app/.jeeves/manifest.json`. Status `generated` means template-owned.
  `generated-extension` (stub bodies, product SQL, package files) and application files are
  hand-written.
- **Outside `app/`:**
  - `web/` is the UI. Exclude it from code metrics; you may comment on its quality briefly.
  - `deploy/cloudflare/` is the edge Worker.
  - `infra/` is GCP IaC and scripts.
- **Ignore these stale versions:**
  - "A v1": commit `33d50e9`, the frozen `4e87f97` baseline, and Q06 at `ee186c1`;
  - the Q02 as-found export;
  - anything under `.scratch/`;
  - the demo and record pages under `docs/evidence/*/demo/` and `deploy/cloudflare/public/versions/`.
- **Line counts already measured** (source-loc-v2, backend only) are in the README section "Results
  after finishing A":
  - G0 3,572; R 3,548 generated; C 4,998 hand-written; template share **41.52%**;
  - per area: sessions 1,385, links 1,286, billing 1,129, abuse 494, analytics 380, redirect 324
    hand-written lines.
- **Gaps A already reported:** `docs/evidence/{q04,q06,q13,a1,a3,a4,a6,a7}/a-found-gaps.md`
  (AG-01 to AG-35).

### Arm B, the latest version

- **Code:** repository `/home/ash/github/qrwty-baseline`, `main` HEAD **`f2fb3ce`**. Its last code
  unit is B07 (`0143ec0`); B-final only added teardown scripts and records.
- **Where to look:**
  - code in `app/src/`;
  - design in `docs/architecture/` (ADRs and specs);
  - its own reviews in `docs/reviews/`.
- **What B built:** platform, links, sessions and accounts, redirect with durable clicks, abuse
  controls and analytics. **B has no billing and no UI.** It wrote 9,361 backend lines, or 11,113
  counting its `config/` settings registry, which source-loc-v2's name rule drops. Ignore its demo
  records.

### The shared contract both arms implemented

`/home/ash/github/qrwty/docs/benchmarks/neutral-pack/v1.6/`, in particular:
- `frozen/decisions.md`;
- `frozen/http-contract.md`;
- `frozen/acceptance-oracle.md`;
- `files/docs/plans/production-build/product-contract.md`;
- `files/.../durable-clicks.md`;
- `files/.../billing-contract.md`.

### Jeeves today

`/home/ash/github/jeeves` `main`. Look in particular at:
- `jeeves-generator/templates/local-v2/` and `jeeves-generator/src/v2/`;
- `jeeves/CATALOG.md`;
- `docs/template-gaps.md`.

**Already planned and not to be re-proposed as new:** the plan `docs/plans/qrwty-lessons/units.md`.
QL02–QL05 are implemented (route tables and deadline, `transaction`, `idempotent`,
`declareSettings`). QL06–QL14 are only planned:
- keys library;
- startup waits for stores;
- Scheduled task module kind;
- cache reader as a dependency;
- workload tokens on Service identity links;
- Browser session template.

Also check:
- `docs/plans/qrwty-gaps/review-batch3.md`, whose proposals QG36–QG39 are open;
- another app built with Jeeves, the YouTube field project in `field-projects/youtube/`. Use it to
  judge whether something is generic across apps.

## Task 1: raise the template share

Go through A's hand-written backend code (C, in `app/`), area by area. For each piece, decide whether
it is:
- **generic**: another production web backend would need the same thing. Either Jeeves could
  generate it from a tile, link, module kind or setting, or a reusable feature pack could provide it;
- **product policy**: QRWTY-specific rules that should stay hand-written.

For every generic candidate, give:
1. **Where it is:** the files and line ranges in A, and B's equivalent if it has one.
2. **How it would appear on the canvas:** a new module kind, a setting on an existing tile, a new
   link behaviour, a new tile or microservice, or a library helper. Respect Jeeves's rules:
   - settings are a finite allowlist;
   - nothing is offered that doesn't generate;
   - no Advanced dumping ground.
3. **The split:** what the template would generate, and what would stay a stub or hook.
4. **Lines saved in A,** with the method, labelled as an estimate. Also give the new template share
   if it were done.
5. **Reuse:** which other apps would use it. Say whether YouTube would.
6. **Overlap:** whether it overlaps an existing plan unit (QL06–QL14, QG36–QG39) or a reported gap
   (AG-xx). If so, say what your view adds.
7. **Risk and complexity.**

Then rank the candidates by lines saved × reuse ÷ complexity. Estimate the template share A would
reach:
- with the already-planned QL units;
- with your top candidates added.

Say plainly whether 60% is reachable for an app like QRWTY, and what it would take.

## Task 2: compare A's and B's design quality

Evaluate both implementations as enterprise software. For each dimension below:
- give a score from 1 to 5 for each arm;
- cite evidence from both arms, with file and line references;
- say which arm is better and why.

**Dimensions:**
- **Service boundaries and microservice cohesion:** does each service own its data and one
  responsibility? How chatty are the cross-service calls, and where are they coupled?
- **Separation of concerns and layering:** transport, domain logic, persistence and integration
  inside a service.
- **Coupling and "spaghetti":** cross-module imports, cycles, god files and functions, file and
  function size, duplication, and global state. You may compute simple metrics such as file sizes,
  import graphs, duplicate blocks and function lengths. Use only tools already on the machine or
  short scripts, and install nothing.
- **Consistency of contracts and error handling** against the frozen HTTP contract.
- **Correctness under concurrency and failure:**
  - transactions, idempotency and version preconditions;
  - durable click handling (ACK before 302, dedup before ACK);
  - timeouts, retries and degradation.
- **Security practices:** sessions, CSRF, token handling, secrets, input validation, and SQL
  privileges and least privilege.
- **Data design:** schemas, migrations, retention and erasure.
- **Testability and the tests themselves:** A's late units were deliberately tested lightly, because
  the owner deprioritized testing. Judge test quality separately from code quality.
- **Operability:** configuration validation, startup checks, logging, health, and drain.
- **Readability and maintainability:** how hard is it to change one feature, for example adding a
  plan limit or a new redirect rule?

**Overall verdict:** which arm has the better architecture and code, and where each one is stronger.
Separate what A owes to **Jeeves-generated code** from what it owes to its **hand-written code**:
- Did the generated scaffolding force a better structure?
- Did it force awkward workarounds? See A's gaps, such as AG-14, AG-18, AG-26 and AG-31.

**Keep the comparison fair:**
- A also built billing and a UI. Compare like-for-like areas first, then comment on billing on its
  own.
- B was tested heavily against the shared acceptance oracle, while A's later units had light checks.
- Don't reward fewer lines by themselves.

## Task 3: what this says about Jeeves

Write half a page to a page:
- Jeeves's real strengths and weaknesses as shown by this experiment;
- the three to five most valuable improvements to make next, with reasons, beyond what is already
  planned or confirming it;
- anything in the current templates that pushes applications towards poor design.

## Rules

- **Read-only:**
  - Don't modify, commit, push or stash anything in any of the three repositories, apart from your
    own report file.
  - Don't run cloud, deploy or Stripe commands.
  - Don't read `~/.config/qrwty/`, `~/.jeeves/` or `~/.codex/`, or any `.env` file.
- **Local tools:** you may run local, offline commands in a scratch folder outside the repositories,
  for example `/tmp/qrwty-eval-<you>/`:
  - `git show` and `git grep`;
  - type checks and unit tests that need no network;
  - simple metrics scripts.

  Don't start Docker stacks. Don't touch the owner's running Jeeves studio (ports 4300 and 4310).
- **Facts are cited, estimates are labelled:** every claim cites files. Every estimate states its
  method. Keep design intent, implemented behaviour and verified behaviour distinct.

## Output

Write one Markdown report to
`/home/ash/github/qrwty/docs/evaluations/<your model name>-2026-11-16.md`, for example `astra-…` or
`fable-…`. Don't commit it. The report contains:
1. **Executive summary,** at most one page: the template-share answer, the design verdict, and the
   top Jeeves recommendations.
2. **Task 1:** the candidate table and the ranked list, with the template-share estimates.
3. **Task 2:** the scored dimension table with evidence, then the verdict.
4. **Task 3.**
5. **Method and limitations:** what you ran and what you didn't verify.
