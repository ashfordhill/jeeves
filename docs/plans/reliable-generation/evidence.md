# Evidence map and old-plan disposition

Read only the rows needed by the assigned unit. These references motivate requirements; they
are not authority to import an old plan's execution rules or continue its queue.

## Revisions and primary material

- Jeeves planning baseline: `73266a1`. The generator/spec are unchanged from the independent
  evaluation baseline `bf36bc8`; later root README edits describe the owner's lessons.
- [Fable evaluation](../../../.docs/readme/v0/qrwty/evaluations/fable-2026-11-16.md), particularly Task 3,
  C1–C11 and the scheduler hosting caveat.
- [Codex evaluation](../../../.docs/readme/v0/qrwty/evaluations/codex-2026-11-16.md), particularly the
  reproduced refresh/replay defects, candidate mechanisms and failure invariants.
- [Original evaluation brief](../../../.docs/readme/v0/qrwty/evaluations/evaluation-prompt.md).
- QRWTY A: `/home/ash/github/qrwty`, `app/` at `0647e4a` and diagram r84. Use `git show` for pinned
  application evidence. Do not confuse earlier exports or `.scratch/` with A7.
- QRWTY B, when available: `/home/ash/github/qrwty-baseline` at `f2fb3ce`; source and historical
  architecture/reviews only. The copied evaluations and A's frozen contract make the unit packets
  usable with just Jeeves and QRWTY; the separate B checkout is not a hidden prerequisite.
- Shared acceptance cases: QRWTY `docs/benchmarks/neutral-pack/v1.6/`. Extract generic semantics;
  do not import QRWTY-specific routes, quotas, tiers, analytics gates or deployment choices.
- YouTube: `field-projects/youtube/v4/`, particularly the cache and event-counter hooks. Use
  copies for regeneration evidence; preserve recorded exports.

**Correction to the Codex report:** its description of A's bounded drain was too generous.
`admission.ts.template` waits on all pending handlers without a deadline; `process.ts.template`
orders cleanup but supplies no overall termination bound. RG02–04 address this. Keep the original
evaluation intact as historical evidence; do not copy its incorrect claim into current docs.

## Source cards

| Card | Existing Jeeves entry points | Lesson / comparison |
| --- | --- | --- |
| E1 Model and authoring | `jeeves/packages/spec/src/{generation-resolver,generation-catalog,generation-support,module-generation,supported-authoring}.ts`; `jeeves-generator/src/v2/{registry,assemble}.ts` | A has truthful template/stub provenance; strengthen executable contracts without reviving the retired review-only UI. |
| E2 Lifecycle and HTTP | `templates/local-v2/assets/src/runtime/{process,admission,http,tile-http,module-clients}.ts.template` under `jeeves-generator/`; `src/v2/{tile-processes,http-wiring,loop-wiring}.ts` | Fable C5/C6/C8; AG-23/25/26/27. B `platform/{lifecycle,http/server,errors}.ts`. |
| E3 Callable boundaries | `jeeves-generator/src/v2/{module-stubs,client-wiring,composition}.ts`; runtime `positive-cache.ts.template`; `jeeves/packages/spec/src/studio-operations.ts` | A stubs cannot call a template capability through normal wiring. B separates platform from feature code. Fable C6/C7 and shared-code findings. |
| E4 Data ownership | `jeeves/packages/spec/src/{ownership,studio-links,module-generation}.ts`; generator `client-wiring.ts`; generated script assets `products.mjs`, `migrate.mjs` | AG-11/12/24/35; B named reader views and migrations. Logical owner can include API/worker; runtime grants must enforce precise access. |
| E5 Keys and identity | runtime `settings.ts.template`, `tile-guard.ts.template`, `module-clients.ts.template`; generated identity setup assets | B `platform/auth/guard.ts`, session crypto; AG-14. Old QL06/10 are evidence, not current briefs. |
| E6 Replay and transactions | runtime `transaction.ts.template`, `idempotency.ts.template`, `module-clients.ts.template`; `src/v2/idempotency.test.ts` | A `link-operations/create.ts:157` consults reputation before replay; B `links/routes.ts:153` replays first. AG-18. Preserve transaction safeguards already implemented. |
| E7 Cache and admission | runtime `valkey.ts.template`, `positive-cache.ts.template`; `src/v2/positive-cache.ts`; spec module catalog | AG-28/31/32; B `links/admission.ts`, `redirect/route-cache.ts`. Never copy A's per-copy fallback as the reliable mechanism. |
| E8 Durable work | runtime `receipts.ts.template`, `outbox.ts.template`, `event-counter.ts.template`, `tile-loop.ts.template`; `src/v2/loop-wiring.ts` | A billing inbox/fenced reconcile; B deletion step records. AG-29/30/33/34. QL08's expiring lease alone does not guarantee once-only execution. |
| E9 Sessions | A `app/src/modules/session-api/session/{signin,sessions,oidc,forward}.ts`; B `app/src/session/{store,routes,deletion,forward}.ts`; current generated guard | A's reproduced concurrent refresh race; B's expired-cookie test-clock defect. QL12 needs stronger failure semantics before reuse. |
| E10 Verification/update | `jeeves-generator/integration/{run.ts,harness/,scenarios/}`; generator `src/update.ts`, `src/v2/update-cli.ts`, `src/source-loc.ts`; `docs/field-projects/source-loc.md` | Reuse existing fault and regeneration harnesses. Use independent expected outcomes and manual TypeScript plus SQL measurements. |

Paths in E2 onward using `templates/` or `src/v2/` are relative to `jeeves-generator` unless stated
otherwise. A/B source is reference-only. New unit filenames are explicitly identified as proposed.

## Disposition of unimplemented plans

This packet was the sole queue for the RG improvement. RG26 records the disposition in the
[plan index](../README.md) and old documentation without deleting evidence or rewriting history.
The owner separately approved [Wires and deployment](../wires-and-deployment/units.md) as next
after RG26 acceptance/commit (`95d60ac`); it is exempt from the inactive-old-queue rule below.
Do not execute an old unit just because its header still says approved or root AGENTS names it.

| Earlier work | Disposition here |
| --- | --- |
| Implemented QL02–05, QG fixes, PF/BR/SO mechanisms | Keep as the baseline; improve through the assigned RG unit. Do not replay completed work. |
| QL06 keys | Replaced by RG08 with the restricted extension boundary. |
| QL14 startup waits | Replaced by RG02–04's shared lifecycle, cancellation and health semantics. |
| QL07/08 scheduled tasks | Replaced by RG15/16; wider hosting/ownership and durable fenced work, no exactly-once lease claim. |
| QL09 callable cache | Replaced by RG05/13; common callable binding rather than a cache-only exception. |
| QL10 workload tokens | Replaced by RG09; authenticated calls are mandatory for the new contract. |
| QL11/12 browser sessions | Replaced by RG19–21 with explicit refresh/outage/forwarding behavior. |
| QL13 review | Replaced by RG14 and RG25. |
| Open QG36 configuration parity | Absorbed by RG02; templates and stubs use one lifecycle. |
| Open QG37 remnants | No new design settings dump. RG02 validates declared settings; RG26 records remaining/deferred items accurately. |
| Open QG38/39 product SQL/grants | Replaced by RG06/07. |
| Fable C1–C11 / Codex generic candidates | Covered only where named by this contract and RG units; estimates are not an obligation to implement every candidate. |
| Stripe pack / product erasure saga / provider credentials / cloud adapters | Deferred; no implicit follow-on units. |
| Other unfinished plans | Inactive unless owner-selected; the approved WD-after-RG26 queue is explicitly selected. RG26 classifies actual status from source/handoff, never from stale headers alone. |

The root README's observations of flaky sign-in and analytics motivate session/progress cases.
They do not prove the drawn Identity fan caused a live defect. This plan neither diagnoses the
live site nor modifies its deployment.
