# RG18 — receipt lifecycle and truthful consumer progress

Implemented on accepted RG17 `9818976eb45e2aef534fcff35b7bb97f1817b4f8`. Owner feedback parent
`a3a26fa9f18ce1e7e28c2739c24cdf4f0d6063e5` was preserved during work; its HUMAN_FEEDBACK change is
outside this unit. No later unit, native generated-system matrix, live cloud/issuer, paid call,
owner studio/database, push or deployment was used. Pending coordinator acceptance.

[The exact contract and operator commands](protocol.md) distinguish bounded delivery promises,
receipt identity, scoped effects, migration/refusal, maintenance observations and provider behavior.
Counter identity no longer includes an aggregate/date partition. Both supported counter and generic
receipt adapters commit the local effect, receipt and durable progress before ACK. Independent
cleanup honors each row's immutable database-time deadline, rather than trusting event timestamps
or current shorter configuration. Counter101 and generic053 are append-only; accepted100/052 bytes
remain unchanged. Legacy duplicate event IDs refuse explicit migration rather than silently merge.

Standalone Event consumer's optional owned state uses API8 `defineReceiptConsumer` and existing
registered product SQL/productMutation/precise roles. Its generated loop selects the opaque
receipt declaration; legacy void loops retain unknown durable progress and refuse safe requeue.
Private counter/generic status/requeue commands are actual emitted entry points. Generic status
uses read-only framework credentials, filters compiled consumer IDs, labels shared database cleanup,
and creates no heartbeat. Unknown/conflicting quarantine requeue refuses; total horizon includes
operator delay, and outside-horizon reconciliation remains necessary after receipt cleanup.

Verification receipts:

- [Final check](check-complete.txt): lint, all workspace types and **142 files /1278 tests pass**. The
  suite includes controlled PGlite/role proofs, immutable store-time deadline boundaries, policy
  reduction, date conflict, legacy duplicate refusal, duplicate/lost COMMIT, captured-handle/getter/
  async refusal, actual lifecycle cleanup without arrivals, stale idle/stopped heartbeat, attributed
  bounded status, safe correlated logs, required-schema/grant startup refusal, actual transaction
  drain after cancellation, quarantine identity and safe requeue. Existing RG15 fencing tests remain.
- [Mechanism observations](mechanisms-observations.txt):14/14. [Focused status/unchanged Board](status-focused.txt):
  30/30. [Earlier wiring](focused-wiring.txt):128/128. [Pub/Sub](pubsub-final.txt):45/45 before the
  final close race case; the final broad suite includes the native-ID copy, timed-out actual publish
  capacity/drain and late-terminal shutdown case. These are real emitted adapters with controlled
  SDK/SQL seams, not native broker/process-kill evidence. RG23 retains its assigned checkpoint.
- [Actual scratch exports](compile-source-final.txt), [runner](compile.ts): **92/75/76/71 files** for
  combined counter+generic, generic RabbitMQ, generic Pub/Sub and API-only webhook respectively.
  Every actual extension checker and pinned TypeScript7.0.2 build passes. Generic product bodies,
  registered SQL/migration and operator files compile; TypeScript refuses product ACK access.
  Pub/Sub requeue artifact explicitly refuses without RabbitMQ adapter/binding imports. Paths and
  exact dependency pins are printed. No dependency version changed; exact scratch directory is removed.
  This bounded set checks transitive assets that the combined export could otherwise mask.
- [Cumulative accepted→final off pins](pins-cumulative.txt), [bounded review/updater](pins.ts):
  **80/87/60 files**, unchanged paths/dependencies. Counter receipt/delivery libraries, guide and
  provenance change; normalized/default inputs now include the horizon, application-bindings consume
  it, and standalone Event consumer slot comments include optional state. Old saved bytes/exports
  and frozen v1 remain intact. Snapshot expectations were reviewed against those exact differences.
- [Web build](build.txt) passes. [Offline chat](offline-chat.txt) runs plain `pnpm eval:chat` with
  network-forbidden scripted arms and synthetic cases. This is deterministic control parity, not
  paid/live model-quality evidence. New chat tests prove the same finite horizon in inspector
  controls, source, blueprint, process config and export; invalid retention/ACK overrides refuse.

[Full browser run](e2e.txt): **84/85**, including TinyURL, new state/horizon mouse interaction and
one long full rebuild. The only failure was the other long rebuild's exact expected-default list:
RG18 adds Receipt and increment.deliveryHorizonSeconds=604800. The corrected test retains all
existing rows/assertions; [affected long rebuild](e2e-rebuild.txt) passes1/1 (2.0m test).
**All85 unique cases are accounted for**, not one single full-green run. [Final new mouse](mouse-source-final.txt)
passes1/1 after the source was fixed/frozen; [selected screenshot](mouse-receipt-horizon.png) was
copied explicitly from testInfo.outputPath into this unit only. Its persisted state connection,
horizon edit, blueprint and actual downloaded ZIP all pass. Every project is deleted by its test.

Failure history remains explicit. [Initial unit run](unit-initial.txt) had1253pass/17fail: exact
settings/slot/migration/path/grant expectations, the later-module SQL test seam and reviewed pins.
053 grants were narrowed to eligible database-backed delivery loops; the existing finite private
relation allowlist handles precisely the three receipt tables under write-only product access.
No public product grant was widened. [Initial mechanism cases](mechanisms-initial.txt) corrected a
Chicago/UTC text oracle and synchronous throw assertion. [Initial scratch](compile-initial.txt)
exposed operator option excess fields and header typing. [Initial check](check.txt) exposed only
new e2e helper typing; [later check](check-final.txt) had1275/1276 with the untouched Board test
observing selected chrome before its layout/mount settled. Its focused15/15 and later complete
suite retain every Board assertion/timing/source unchanged. [Pre-release](check-release.txt)
had1277/1278, only the new provider refusal expecting a general code instead of the existing exact
local-contribution refusal. The final oracle keeps both the spec NEEDS_TEMPLATE and actual export
refusal assertions. [Formatting-only failed check](check-source-final.txt) caught this unit's own
new inventory JSON formatting; it was formatted without changing values.

Two intermediate artifacts are intentionally retained: initial mouse connection assertion expected
a `slot` field absent from saved component links (the drag itself succeeded); it now checks actual
persisted from/to facts. A later evidence mouse/export attempt overlapped a transient counter-emitter
reference error introduced while conditioning Pub/Sub imports; the counter stays self-hosted and
that reference is corrected. Final independent exports and final mouse pass. New-unit data-URL
stack addresses are elided in logs with a sanitization notice; error text/assertions/locations remain.
Trailing log whitespace is trimmed; assertions and outcome text are preserved. Earlier accepted evidence was never edited.

[Preservation](preservation.txt), [reproducible read-only comparison](preservation.py) and
[container triples](docker-after.json) verify six unchanged original non-README root hashes,
continuing owner README content, the exact original34001-byte/28-path owner patch under its owner
archive remapping (34021 bytes after path substitution), frozen v1, all42 original container
IDs/names/states and unchanged accepted100/052 builders/literal. Owner changes, `.docs/`,
`.jeeves-feedback/`, historical exports/screenshots/evaluations, unrelated modes and root files
are excluded from the explicit unit commit. Cleanup/retention throughput, broker queue depth when
unsupported, indefinite replay and native simultaneous/process-kill behavior are not claimed.
