# Assignment packet: Jeeves improvement planning from QRWTY (JP00), attempt 1

**Role:** planner and analyst (Fable, xhigh). This is not a QRWTY unit, so no ledger entry. The
coordinator records your usage separately.
**Owner request (2026-11-14):** "I would like to get design decisions from qrwty and its code
analyzed to see if we need to modify Jeeves templates and modules or add new ones that could save
code in other project generation strategies." Jeeves is the owner's main focus. QRWTY is a test
subject that needs production-ready, high-traffic software, and it is unlikely to become a business.

## What to produce

Write only in `/tmp/claude-1000/-home-ash-github-jeeves/25a62ed6-cc60-4bd9-b2cf-35664f59d9c5/scratchpad/jeeves-plan/`.
The coordinator commits the result to Jeeves as `docs/plans/qrwty-lessons/` later.

1. **`analysis.md`: the evidence.**
   - **Inventory the hand-written backend.** Cover arm B's whole backend (`app/src/`, about 8–10k
     nonblank lines) and arm A's planned hand-written work: Q02's as-found export classification,
     Q03's capability audit and the QG briefs. Classify each concern as **generic** (a production web
     backend of another app would need it too) or **product policy** (QRWTY only).
   - **Detail each generic concern:**
     - the nonblank lines in B (count them, and give the method);
     - what Jeeves does today (an installed template, a stub, an open gap or deferred QG unit, or
       nothing);
     - how it would be expressed on the canvas (tile kind, link, module, setting), keeping to Jeeves's
       rules: only what generates is offered, settings are a finite allowlist, and there is no
       Advanced dumping ground;
     - what it would generate, and what stays a stub or hook;
     - which other apps would reuse it. Check the YouTube field project; also judge an ordinary SaaS
       backend.
   - **Rank the concerns** by expected backend lines saved across apps × reuse ÷ complexity and risk.
     Estimate what the top items would do to a QRWTY-like app's template share. Today's estimate is
     about 30–35%; the owner's target is 60% or more of backend source.
   - **Also say what Jeeves should not take on,** and why: product policy, UI, deployment.
2. **`units.md`: a Jeeves build plan for the top items.**
   - Follow the conventions of the existing plans in `docs/plans/qrwty-gaps/units.md` and
     `docs/plans/production-foundations/units.md`: shared rules, a regeneration proof, pins by Rule 7,
     exact Files, Goal, Invariants, Emitted output, offline tests, Docker proof, required regressions,
     and the commit name.
   - Modest executors run the units, one fresh agent per unit, so each unit must be exact and
     deterministic. Name real files and functions; don't leave design choices open inside a unit.
   - Prefer generic mechanisms and reusable feature packs, with product policy kept in narrow
     adapters.
   - The plan ends with a review unit.
   - Unit prefix `QL`. Number the units in dependency order.
   - Put anything that needs an owner decision in a "Decisions" section, each with a recommended
     option. Mark each unit that depends on a decision.
3. **`owner-summary.md`: one or two pages for the owner.**
   - What you found, in plain words.
   - The top items, each with its expected effect.
   - The plan's units, one line each.
   - A numbered list of the decisions and clarifications the owner must give, each with your
     recommendation.
   - Write it for a reader who knows Jeeves well but hasn't read the QRWTY evidence.

## Read

- **Jeeves** (`/home/ash/github/jeeves`, read only):
  - `AGENTS.md` (goals and scope), `docs/glossary.md`, `docs/design-playbook.md`,
    `docs/template-gaps.md`, `jeeves/CATALOG.md` and `jeeves-generator/README.md`;
  - `jeeves-generator/templates/local-v2/` and `jeeves-generator/src/v2/`;
  - `docs/plans/qrwty-gaps/` (`units.md`, `review-batch1.md`): batch 2 and the deferred QG13–QG16, plus
    QG10, QG18, QG21–QG23 and QG25, which the owner moved to the post-QRWTY backlog today;
  - `docs/plans/production-foundations/`, `docs/field-projects/source-loc.md` and the YouTube field
    project (`field-projects/`).

  Recent handoff entries (`docs/handoff.md`, last 15) say what changed this week. A worker is
  committing QG07 (Pub/Sub publishers) in that checkout right now. Read only; never write there.
- **QRWTY arm A** (`/home/ash/github/qrwty`, read only):
  - `docs/plans/production-build/` (`architecture.md`, `product-contract.md`, `durable-clicks.md`,
    `billing-contract.md`, `jeeves-gaps.md`, `comparison.md`, `units.md`);
  - `docs/evidence/q01/`, `q02/` and `q03/` (the capability audit and its review);
  - the frozen contract in `docs/benchmarks/neutral-pack/v1.3/frozen/`.
- **QRWTY arm B** (`/home/ash/github/qrwty-baseline`, read only; the owner allows it for this plan):
  `app/src/`, `app/migrations/`, `docs/architecture/` (ADRs and specs), `docs/reviews/`, and the B
  entries of `docs/handoff.md`. B is an independent implementation of the same frozen contract, with
  no Jeeves, so it is the best evidence of what a production backend for this product needs. Learn
  patterns from it. Don't copy its code into the plan.

## Rules

- **No writes anywhere except your output folder.** Not in any repository, not even a scratch file.
  Run no Docker, tests, installs or generators; reading and counting lines is enough. Don't contact
  or message any other agent.
- **Never read secrets:** `~/.config/qrwty/`, `~/.jeeves/`, `~/.codex/`, or any `.env`.
- **Isolation:** nothing you write goes to arm B. The plan is Jeeves's own; the coordinator keeps it
  out of A's and B's workers' reading.
- **Keep design intent, template availability and verification evidence distinct.** Say which of the
  three each claim is.
- **Be honest about uncertainty.** A line estimate gives its method. A guess is labelled as a guess.

## Return

A short report:
- the top items with their expected effect;
- the plan's unit list;
- the owner decisions with your recommendations;
- the three file paths;
- the elapsed time.
