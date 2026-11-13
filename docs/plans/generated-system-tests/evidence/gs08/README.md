# GS08: TTL changes and in-place regeneration

Implemented B10 on 2026-11-13 from `3f4be47` plus this unit's recorded dirty source.
The executable suite is `pnpm test:generated --suite=regeneration`; manual CI offers it and
weekly `all` includes it. No template, generated scaffold, historical field app, pin or studio
UI changed. Hosted execution remains pending owner publication; no push occurred.

## Inputs and ownership

`integration/author-regeneration.ts` authors the Wiring catalog-only graph using studio commands.
The saved A/B diagrams are the sole export inputs. Their only differences are the revision and
cache TTL (4 → 16 seconds), checked explicitly by the scenario. The same three Wiring owned
files supply the immutable-record hooks, catalog stub and re-runnable product SQL; provenance
saves the commands, paths and original hashes. Current manifests/reports independently validate
every attachment as the named module's generated extension. Required custom work stays in the
honest original reports. No provider topology or application mechanism is supplied by the test.

Each fresh standalone export uses the default registry, frozen installation/build, PostgreSQL,
Valkey, generated API and edge. Successful reads use normal application credentials. Administrative
SQL only seeds/observes durable state. Source snapshots include the uncommitted inputs and refuse
changes during setup; input/output manifest/report hashes remain with each stack.

## B10 observations

Fresh B runs independently before fresh A. Each proves exact cached value, one INFO-measured API
hit without an authoritative load, actual expiry/refill and repeated missing/draft reads remaining
uncached. Scenario bounds are independent of generated binding/runtime code: A starts within
2–4 seconds PTTL and is absent by 7 seconds; B starts within 13–16 seconds PTTL, stays live beyond
7 seconds with more than 4 seconds left, and expires between 13 and 19 seconds. Polls retain their
last observations. GET/PTTL observers stay outside the INFO-only hit bracket.

Running A is stopped using `pnpm stop`. Public `update:v2 --check` changes no export/runtime bytes;
public apply performs six replacements, keeps the three completed owned files and refuses nothing.
The intentional replaced paths are:

- `.jeeves/inputs/design.json`
- `.jeeves/normalized.json`
- `.jeeves/report.json`
- `diagnostics/generation.json`
- `src/features/application-bindings.ts`
- `src/features/positive-cache-bindings.ts`

The new manifest and every non-owned file must equal the separate fresh B export **before** the
harness adopts B's scaffold oracle. `baseline-transition.json` preserves the before/after hashes;
both original manifests/reports remain frozen. No current bytes are accepted as their own oracle.

Unmodified `pnpm start` resumes the same project, three ports, original history/runtime/secret
hashes and both volumes' names/creation times/labels. No history or composition guard is bypassed.
All three owned files match exactly. The original database/relation OIDs, all row identities,
values, count and PostgreSQL row transaction IDs remain equal. A random published sentinel absent
from the seed SQL proves retained data beyond re-running initialization. It is also read through
the generated API after resume. The updated A then proves B's expiry/hit/refill/absence behavior.
Final public `--check` changes no bytes and requires zero creates/replacements, no refusals,
overrides, pending changes, removals or orphans. Final scaffold checks remain active against B.

## Failure and source boundary

The first run at `/tmp/gs08-regeneration-first` failed honestly during export: the B edit supplied
`provider: unspecified`, resetting A's selected local provider. It created no containers and
cleaned successfully. `failures/author-provider` retains its failure, result, cleanup, source and
reporters. The exact failed B design and author helper bytes were reconstructed and verified
against that run's original recorded SHA-256 values before archival. This was an authoring error,
not a template defect; the correction retains `self-hosted` while changing TTL.

The corrected pilot at `/tmp/gs08-regeneration-corrected` passed 1/1 in 137.26 seconds in Vitest
(149.962 seconds for the CLI including final scrub/cleanup). Its fresh
B filled at PTTL 15,713 ms, remained live at 7,025 ms/PTTL 8,720 ms and expired at 16,085 ms;
A filled at 3,716 ms and expired at 3,751 ms (elapsed observations precede their bounded provider
query). Exact runtime/owned/volume/data comparisons and the final update check passed. Pilot
evidence is retained. Before final verification, only the harness/scenario were tightened:
explicit revision/TTL-only diagram comparison, correct OID observation types, compact transition
hash records and removal of a premature unconditional preservation label. No invariant, deadline
or assertion was relaxed. Final verification uses one unchanged source snapshot.

The final full run's B10 stacks passed from source
`6be301d0515b9985b762080858ad304e67e133a454b37bd43c2496f182cb2bc8`.
`source-boundary.json` records the two changed files and both source hashes.

| Export / phase | Initial PTTL | Beyond A's 7-second bound | Actual expiry observation |
| --- | --- | --- | --- |
| Fresh A | 3,703 ms | — | 3,743 ms |
| Independent fresh B | 15,713 ms | 7,210 ms elapsed, 8,530 ms PTTL | 16,251 ms |
| Updated A running B | 15,724 ms | 7,517 ms elapsed, 8,207 ms PTTL | 15,939 ms |

Final plan/apply: 6 replacements, 37 unchanged, 3 kept; final check: 0 replacements,
43 unchanged, 3 kept. Both comparisons include zero creates/refusals/overrides/pending changes,
removals or orphans. Original A/B manifest/report bytes are identical to their pilot counterparts.

## Checks and remaining boundaries

Final `all` passed **9/9 tests in 6 files**, from ten fresh stacks: core 4, Wiring 2, Identity 1,
Media 1 and Regeneration 1 (two independent exports). Vitest took 757.73 seconds; the CLI took
833.227 seconds including final scrub/cleanup. B10 itself took 127.892 seconds. This fits the
unchanged 20-minute inner orchestration, 30-minute expanded workflow step and 40-minute job
budgets; no timeout increase was needed. `all/` retains the JSON/JUnit, source/identity, original
exports, behavioral/update/preservation results, sanitized logs, final hashes and cleanup.

`pnpm check` passed lint, typechecks and **823 tests / 106 files**. `pnpm test:e2e` passed **73/73**
in 4.7 minutes, including TinyURL rendering and the v2/v3 mouse rebuilds. Web production build
passed. Actionlint 1.7.7 syntax/context validation passed. `checks.json` and compressed check logs
record these outcomes. Heavy Docker, offline, browser and build phases were serial. There was
one invocation of each standard check, no failed check or rerun.

Independent exact-label audits cover **four records / fourteen scopes**, all empty with matching
scrub markers and deleted private temporary directories. The final run's per-stack inventories
record removal of **81 containers, 10 networks and 28 volumes**; original removal evidence remains
in `stack-cleanup.json`. Public record-based recovery passed again, preserving the original outer
cleanup as `runner-cleanup.json`. The privacy probe passed opaque-value redaction in failure,
request/JSON/JUnit/interrupted reporters, private file/directory modes, fail-closed unreadable
inputs, stale-marker removal and scrub-before-deletion. Private inputs survive per-stack release
until global sanitization and outer deletion. Evidence JSON formatting preserved parsed values.

Full local runs: `/tmp/gs08-all-final`, `/tmp/gs08-regeneration-corrected`,
`/tmp/gs08-regeneration-first`, `/tmp/gs08-privacy-final`; standard logs:
`/tmp/gs08-{check,e2e,web-build}-final.log`. No template gap was exposed by B10.

This proves the supported TTL-only change with the compatible current composition, not arbitrary
topology changes, schema/data migration, other providers or hosted CI. GS07 awaits BR01–BR02
completion and ownership; GS09's final review is pending. None is assigned by this unit.
No template fix, generated-output repair, retry, green skip or
weakened assertion was introduced.
