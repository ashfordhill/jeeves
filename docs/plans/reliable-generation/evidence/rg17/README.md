# RG17 — authenticated webhook inbox

Implemented on accepted RG16 `f75304e1c430cab021e75f672be68bbd2a8bfb81`. The independent owner
feedback parent `f15e5af638588a058d1ec5ab7adeb13f8e8ed7ae` is preserved. Pending coordinator
acceptance; no later unit or native generated-system matrix was run.

The Service-only receiver has finite body/window settings shared by inspector/chat/blueprint and
generated consumers, an RG08 private HMAC ring/verifier, a separate pure mapper and an opaque
scoped processing declaration. Its lifecycle-owned processor starts independently of arrivals in
every runnable Service copy. Required-user host guards refuse composition. Protected052 state,
precise product/framework credentials, recovery/fencing, attempts/backoff and completed-only cleanup
are reused unchanged. The public declaration has no unsigned acceptance method or verifier hook. Private registration
binds an inbox namespace domain plus compiled receiver module identity; generic public work and
another receiver cannot collide by copying an application-chosen work ID. Ordinary RG15/16
namespaces/configurations and accepted052 bytes stay unchanged.

[Exact protocol, key provisioning, failures and retention](protocol.md) is also generated into
`.jeeves/extensions.md`. Raw-byte identity conflicts refuse409 while retaining the first acceptance;
202 follows durable COMMIT. Re-signed unchanged retries dedupe while retained. Completed identities
expire seven days after completion, after which redelivery can create new work. Failed/unfinished/
unknown records remain. Provider-specific formats/SDKs, public replay/admin UI, independent
receiver-to-Worker handoff and forever dedupe remain unsupported. RG15 remote authority/ticket/
secret-result/process-affinity limits carry through unchanged.

## Verification

[Full pnpm check before namespace hardening](check-final.txt) passes lint/types and140 files/1259
tests. [Final pnpm check](check-namespace-final.txt) passes lint/types and **140 files /1261 tests**.
[Final namespace/mechanism checks](inbox-namespace.txt) pass **97/97**, including unsigned generic
work-ID collision and two compiled receivers with copied application work IDs.
[Final web build](build-final.txt) passes. The final changes after that broad check are guide/comment
wording and the browser test awaiting its actual module save; [focused prose/pins](prose-pins.txt)
pass4/4 and [prose lint](prose-lint.txt) passes, with final web typecheck recorded separately. The focused mechanism tests
use actual generated Fastify/raw-body parsing, RG08 key code, PGlite SQL/roles/transactions and two
work-engine instances. PGlite serializes connections: this is controlled protocol/recovery/fencing
proof, not native simultaneous-replica or process-kill proof. The later assigned checkpoint owns
that finite real-stack proof.

- [Focused initial](focused-initial.txt):4/6 pass; expected terminal-code assertion and wrong
  control-helper call were corrected. [Focused mechanisms](focused.txt):33/33 pass before the opaque
  descriptor correction. [Final boundary cases](focused-boundary.txt):7/7 pass, including normal and
  forged-source Required-user refusal, absent public acceptance, exact bytes, stale/tamper/limits,
  lost2xx, COMMIT uncertainty, recovery, conflict, competing claims, stale fences, retry/terminal
  failure and cleanup retention. The final broad suite covers the final source.
- [Actual scratch runner](compile.ts), [final result](compile-namespace.txt):67 emitted files, aliased selection
  identity, actual extension checker and TypeScript7.0.2 pass for scaffold and filled product bodies.
  Negative actual checks refuse `durableWork.accept` and mapper `globalThis`. Emitted paths and all
  dependency pins are printed; no dependency changed. The exact scratch directory is removed.
  [Initial compile](compile-initial.txt) exposed a spurious service-resources import from mounted
  report metadata; reporting now follows the existing task-stub path and no fake dependency emits.
- [Cumulative accepted-parent→final off pins](pins-cumulative.txt), [bounded updater](pins.ts):
  **80/87/60 files**, unchanged paths. [Initial review](pins-review.txt) and
  [namespace/prose follow-ups](pins-review-final.txt) describe their incremental checks; the
  cumulative receipt is authoritative for the complete unit diff.
  Only extension guide/manifest and applicable private crypto/settings/HMAC challenge bytes move.
  Normalized model/report semantics and dependency versions remain unchanged. Frozen v1 untouched.
- [Web build](build.txt) passes (existing chunk-size advice). [Offline chat](offline-chat.txt) runs
  all three scripted design arms and six synthetic cases in both arms with network forbidden.
  This is deterministic tool/control parity, not model-quality evidence.
- [Initial unit run](unit-initial.txt):1251pass/8fail; five stale catalog/menu counts and three
  reviewed off-pin digests. [Earlier check](check-initial.txt), [test typing corrections](check.txt)
  and [e2e helper typing](check-e2e-types.txt) retain failures from Buffer/row/fixture-cast types.
  No runtime/Board/timing assertion was weakened.

## Browser outcomes

[Full native run](e2e.txt): **81/84 pass**, including TinyURL and both long full mouse rebuilds.
[Three affected cases](e2e-affected.txt): **3/3 pass** after explicit Required-user refusal and
Pointer-mode corrections. The namespace-source [affected export run](e2e-final.txt) then passes
callable, but exposes a new-test race reading the receiver before its add save completed.
The test now asserts persisted addition with expect.poll. [Final receiver mouse/export](e2e-webhook-final.txt):
**1/1 pass**,8.2s, adding receiver, connecting owned state, editing both controls, checking blueprint,
refusing Required user guard and downloading ZIP. **All84 unique cases are accounted for**, not one
single fullgreen run. [Failure diagnosis](browser-failures.txt) preserves actual causes; no Board,
existing behavior assertion or timeout was weakened. [Mouse screenshot](mouse-webhook.png) shows
connected receiver and both consumed controls. [Cleanup](e2e-cleanup.txt) records exact interrupted
project deletion and a direct read of `jeeves_e2e.projects` confirming zero RG17 projects remain;
later failed API readbacks were due to the e2e server already being closed.

## Preservation

[Final receipt](preservation.txt) records six unchanged non-README original root hashes, the continuing external
owner README edits and parent, exact34001-byte protected owner diff, frozen v1 and all42 original
container IDs/names/states. Root files, `.docs/`, `.jeeves-feedback/`, historical exports/evidence,
owner4300/4310/database and unrelated modes are never edited/staged. During the run,39 additional
external `.docs/` deletions/moves appeared alongside ongoing README edits; the original28-path
owner patch remains exact34001 bytes when compared separately. Those external changes are preserved
and excluded, rather than claiming the entire owner diff stayed unchanged. No issuer/cloud/paid call,
root lock/dependency edit, unrelated Docker cleanup, push or deployment occurs.
