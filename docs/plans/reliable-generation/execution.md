# Sequential execution protocol

The owner has approved this protocol and the [plan](README.md). Execution awaits an explicit
instruction to begin RG01. This replaces the execution queue of unfinished older plans for the
work in this packet. Their implemented
code remains the starting point. No agent resumes an old QL/QG/other pending unit on its own.

## Fresh-agent packet

The coordinator supplies the following to a new agent, with no transcript from an implementation
agent and no reused agent session:

> Execute RGnn only in /home/ash/github/jeeves on main. Read root AGENTS.md, the approved
> docs/plans/reliable-generation/README.md decisions, contract.md, execution.md, your assigned
> units/rgnn.md and the immediately preceding unit's handoff. Read only the source/evidence your
> unit names, plus necessary call sites. Do not execute another unit or spawn agents. Preserve
> owner changes and all root-level files. Complete the unit, verify it, append a short handoff,
> make one local commit containing only this unit, then stop. Do not push.

Also read the latest handoff entries as required by AGENTS; they are status, not authority to
expand this packet. The owner's current decisions supersede old active-plan pointers in the
read-only root AGENTS. The coordinator passes the last accepted commit and any owner amendment.
It does not implement fixes concurrently with the unit agent.

## Boundaries

- One primary checkout, one unit at a time; no branches, worktrees, stash, parallel lanes or
  automatically spawned remedial units. Future unit briefs are not the current agent's task.
- Run `git status --short` before work. Preserve unrelated files and mode changes. Never stage
  the entire tree, reset the checkout or remove another person's scratch files.
- Root-level files are read-only, especially `README.md`, `AGENTS.md`, `package.json` and the
  root lockfile. No unit requires editing those files. A newly discovered need returns to the
  owner; do not broaden the write scope silently. Generated export package/lock assets inside
  `jeeves-generator/templates/` may change where the assigned unit names them.
- `.docs/`, `.jeeves-feedback/`, historical evaluations, historical screenshots, old evidence,
  old YouTube exports and `templates/local-v1/` are read-only. New fixture sources are allowed
  only under the assigned new `field-projects/generator-system/fixtures/rg-*` paths.
  Existing active generator-system fixture inputs/hooks may receive the contract migration
  necessary for the assigned unit; recorded exports/evidence and frozen v1 fixtures stay intact.
- QRWTY repositories are reference-only. No deployment, cloud, Stripe, live issuer, paid model
  call, `.env` or secret inspection. Do not read prohibited home configuration directories.
- Do not touch the owner's running studio or ports 4300/4310. Browser regression checks use
  the established e2e services, ports and database. Delete only projects those checks create.
- Generated source is changed through templates and generation. A fixture's handwritten hooks
  and product SQL may be edited; its generated files must be regenerated, never patched by hand.

## Scope and stopping

Each unit lists the contract it owns, expected source areas, emitted surfaces, assertions and
non-goals. The paths are entry points, not a prohibition on necessary call-site updates for that
same behavior. A moved symbol or a small mechanical adjustment is resolved and recorded locally.

If a unit requires a new architectural choice, a new provider, an extra capability, root-file
edits, a weakened invariant or a later unit implemented early, stop dependent work and present
the concrete issue to the owner. Preserve the reviewable diff; do not automatically roll back
or create a new unit. Unrelated discoveries go in a short deferred-findings list. They are not
an implementation queue. A failing required check is not a completed unit.

Review units may fix defects in the already assigned scope. They may not grow the feature set.
If a review finds a problem too large for its bounded correction remit, it reports the blocker
and waits for the owner to amend this fixed plan. The final docs unit never hides unresolved
findings by marking them complete.

## Verification budget

The approved verification policy is D11.

**Code units** run the existing regression commands once on the final meaningful change:

1. `pnpm check` with the repository's required Node version.
2. `pnpm test:e2e` or its established Docker alternative.
3. `pnpm --filter @jeeves/web build`.
4. For user-visible behavior, a mouse check through the running e2e app: it loads, TinyURL renders,
   and the changed controls/connections/refusals work. Use the existing browser harness.
5. When authoring commands/tool descriptions change, the existing offline chat evals and focused
   mouse/chat parity tests. No paid/live evals.

Add focused tests for the unit's named invariants, using existing unit/PGlite facilities. Tests
must observe behavior, not merely repeat emitted strings. Failed checks get diagnosis and a
targeted rerun; broaden/repeat only after a meaningful change or unresolved failure. Do not run
the entire generated-system matrix after each small change.

**Integration checkpoints:** RG14, RG23 and RG24 use the existing generated-system harness.
RG25 reruns affected cases only if its review/fixes warrant it. Each checkpoint has a finite
scenario list; it records exactly what ran. This is focused evidence for reusable mechanisms,
not postponed correctness testing or a new certification framework.

Docker resources must have a unique task-owned prefix and local ports. Record the before/after
inventory and clean up exact resources through the harness, including on failure. Never prune
Docker or stop unrelated containers, particularly `jeeves-postgres-1`.

**Documentation-only RG26:** validate links, status mappings and protected-file preservation;
no new app/Docker run solely for prose. If it unexpectedly changes executable code, it is out
of scope and returns to the owner. This explicit exception is part of D11, not an inferred
exemption from AGENTS.

A review unit with no code changes similarly uses focused source/evidence validation; any code
correction restores the code-unit checks and the affected integration cases.

## Generation and update checks

For a changed emitter, regenerate the relevant new fixture into a scratch directory. Review the
changed file list and behavior. The frozen v1 output stays unchanged. Existing v2 snapshots may
change only as explained by the new contract; inspect the diff before accepting pins. Do not
mechanically update every snapshot until checks turn green.

The unit's emitted-surface list excludes provenance/report records, which may change with a
source/version change. Unexpected substantive output requires explanation within this scope or
an owner decision. New APIs do not silently rewrite old handwritten extensions. RG01 introduces
the guard; RG24 proves an actual explicit migration with preserved product data and hook bodies.

## Handoff and local commit

Append a short entry to `docs/handoff.md` and create one local commit, staging only explicit paths:

- RG ID, outcome and commit subject;
- behavior changed and relevant emitted paths;
- checks actually run and results, including failures and limits;
- contract/API decisions carried forward; any deliberate compatibility change;
- deferred findings, at most a short list, with no new assigned work;
- what the next listed unit can rely on.

Keep detailed logs under this plan's `evidence/rgNN/` when useful. Preserve earlier handoff entries.
Do not add an audit system or copy huge logs into handoff. A review unit with no code changes
commits its review evidence and handoff. Plan approval alone is not an instruction to start RG01.
