# Click retention generator evidence

Unit 3 started from Jeeves `ffe9501fccce3f6c2ba12de54a686dd152a00a90` at 21:13:14 UTC on 2026-11-19. This work belongs to template development. Exact model version, token counters and cost were unavailable. [Usage ledger](../usage-ledger.md)

## Generated policy

The standalone Event consumer shows **Maximum replay delay (days)** and **Keep counted IDs (days)** when it has a broker input and writable owned PostgreSQL state. Selecting either setting uses seven replay days or 35 receipt days for an omitted partner. Receipt retention must cover the replay window. A checked consumer's mapper receives the selected policy in seconds. The product validates age from a trusted source when it enforces an age limit. The broker and archive must cover the declared window and preserve event identity. Both the receipt and the application's count or breakdown updates commit before the broker acknowledgement.

A Scheduled task with writable owned PostgreSQL state and a declared product DELETE grant offers **Keep daily totals (months)**. The generated timer captures an immutable UTC cutoff from database time when it admits a tick. It clips the day to the destination month, keeps the accepted cutoff through retries, and requires the validator to preserve it. Registered application SQL chooses tables and deletes days strictly before the supplied cutoff. **Interval (seconds)** controls the cadence separately.

## Reproduction

Use Node 24.21.0 and pnpm 12.16.1 from the Jeeves checkout. The native suite uses public CLI exports, a disposable PostgreSQL database, two worker containers, a RabbitMQ proxy that can hold a real acknowledgement, and checked application-owned SQL. The PostgreSQL test schema supplies a controlled clock only to that database. It leaves the generated SQL intact and sets the session time zone to Pacific/Kiritimati to distinguish UTC from the database session date. Revisions for independent settings changes use the public updater and compare the scaffold with another fresh export. [Fixture design and application files](../../../../../field-projects/generator-system/fixtures/qr-retention)

```sh
pnpm test:generated --suite=qr-retention --artifacts=/absolute/empty/retention
pnpm check
pnpm test:e2e
pnpm --filter @jeeves/web build
```

The reviewed revision-4 scratch input selected 31 days, 35 days and 13 months. Its existing 60-second interval stayed in place. CLI export produced 152 files, zero findings and 24 required integration or application gaps. `pnpm install --offline --frozen-lockfile` and `pnpm build` passed. The same input's `update:v2 --check` reported 151 unchanged files and no changes to apply. The older reviewed input without these fields also exported with zero findings. Its deployment contract has no compiled receipt or calendar policy and the Scheduled task still reports as Generated.

| Raw artifact | SHA-256 |
| --- | --- |
| Scratch source JSON | `bb663e1d92c8167f1b6a7ca050889576651d7ca29f84dc15781c14470d389cb4` |
| [Manifest](retention-only-manifest.json.gz) | `6f0432d3216195b5cde9036b4b171351fa4bc4c72c05080d49f96c9fb0baf647` |
| [Deployment contract](retention-only-deploy-contract.json.gz) | `ae5b9d4c48050d24b7f6f0e568842c56081304767f40ddb0c43c275932170cab` |

## Observed behavior

- The broker still had one unacknowledged delivery when PostgreSQL already held the completed receipt, one daily count and one breakdown. Killing the copy that sent the held acknowledgement caused redelivery to the other copy, which acknowledged it without adding a count. Restarting the old copy preserved shared state. An intentional failure in the second registered aggregate command rolled back the first command and the receipt, then reached quarantine.
- On day 31 the original event replayed with one total, and an event at the mapper's verified 31-day age was accepted. A shorter replay window alone refused that age while a 30-day event still got a 35-day receipt. Shortening only the receipt period then gave new events 30 days. The original committed 35-day deadline remained.
- At 2026-12-31 23:59 UTC, 13 months clipped to 2025-11-30. Advancing into 2027 produced 2025-12-01. The idle sweep deleted precisely the earlier totals and breakdowns while preserving the exact cutoff, recent rows and the receipt. Changing only months to 12 moved the cutoff to 2026-02-01 and removed the newly expired rows. Changing just the timer from 60 to 120 seconds kept the same cutoff and ran at the next rather than the intervening minute.
- At the original stored deadline, 2027-02-04 23:59:00 UTC, a restarted copy's sweep preserved the receipt. One microsecond after the deadline, idle maintenance removed it. The aggregate and a later receipt survived. [Native observations](native-observations.json.gz) · [Native cleanup](native-cleanup.json.gz)
- Earlier seconds declarations ran through the existing `receipt-lifecycle.test.ts` cases using 86,400 seconds of replay and 604,800 seconds of retention. Those tests cover lost COMMIT, unchanged per-row deadlines, quarantine identity and legacy void loop observations. The unconfigured scheduled tests retained the earlier tick SQL and identity check. A separate controlled calendar case recovered a pending tick across clocks and copies, retaining its first cutoff as the settings changed. Chat and blueprint covered a Pub/Sub variant, clearing and the paired-field refusal. Cloud archive retention and recovery belong to the deployment check.

## Earlier attempts

The first reviewed export exposed an unattested consumer output path. The settings now write real configuration into the module emitter's owned dependencies file. The catalog-only status projection originally marked the task Refused despite the installed resolver accepting it. Applicability and registry availability now have separate checks. Initial fixture setup used a sequence the product migration role could not grant, so the sweep fixture now uses the tick and interval as its key. The second setup proved the held acknowledgement and reached an incorrect quarantine probe. The test now uses the compiled queue's `.failed` suffix. The third run assumed receipt expiry deleted at equality. The shared predicate uses a strict less-than comparator, so the final test observes equality and one microsecond after. The first focused calendar test placed the fixture clock before its default due time and the first repository check caught the test's missing queue report field. Both checks were corrected with the underlying database behavior preserved. [Native first results](earlier-attempts.json.gz)

The first full browser run passed 90 of 91 cases. The older receipt study saved its database engine and provider as unspecified. The exporter provisions those defaults as local PostgreSQL, and the early Studio predicate hid the controls until both values were explicit. The shared authoring resolver now accepts the installed defaults. The native fixture re-export after that repair retained all 78 runtime and non-report payloads. Only report and manifest provenance changed. [Browser failure context](browser-first-context.md.gz) · [Native export comparison](native-export-comparison.json)

## Final checks

`pnpm check` passed lint, workspace type checks and all 1,446 tests in 155 files. The web build passed with its existing chunk-size advisory. The native suite passed after 162 seconds and cleaned up the isolated stack. The second full browser run passed 91/91 in 7.2 minutes. TinyURL rendered in the running Studio. The older receipt study showed the day controls after its state connection was restored by mouse. The Scheduled task study accepted 13 months on the worker with DELETE access and kept the control hidden on the service without that grant. Both mouse tests passed through ZIP download. [Receipt controls](mouse-consumer-retention.png) · [Scheduled cleanup control](mouse-calendar-retention.png)
