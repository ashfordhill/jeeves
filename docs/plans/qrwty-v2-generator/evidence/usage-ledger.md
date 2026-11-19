# QRWTY v2 template-development usage ledger

Run started 2026-11-19 at 20:05 UTC on Jeeves `b908cf1be340446553eacb31f722f0215052f86d`. This ledger covers generator work through the handoff. The field build has separate accounting. All five sessions reported `gpt-6.2-sol` at `xhigh`. Prompt hashes cover the UTF-8 text with a final line feed.

| Phase | Attempt | Started UTC | Prompt SHA-256 |
| --- | --- | --- | --- |
| Coordination | 1 | 20:05 | Repository coordinator prompt `205a37345532e8213e27eecbb84a45deb7c813560f67dd511efa2297e7bc76ef`, units `5079376ad5bb755e88948c8750aaf7340b95c45af7000abd1884522b652efa3b` |
| Auth0 implementation | 1 | 20:07:02 | `89a59373131be720f6fe1c49747f9668a115beae898ff88ca2343fa2a200a553` |
| Stripe implementation | 1 | 20:39:12 | `e17607d6df1ef2679ed1298f1c7767ceb3791b27e4384afa343946e469e787f4` |
| Click-retention implementation | 1 | 21:13:14 | `a8c4ad0dc237179401bfafba1acbda4353dca6ce11a12a4e0c147d32d6525c02` |
| Independent combined review | 1 | 21:52:55 | `f0017c7f570b2d799937b786e53a6e204349d9ab9f42d3454c3e0df78f7dec16` |
| Pub/Sub repair | 1 | 22:04:50 | `dc4e6602f30e7c573c8317a040b6473f322cf7220598fd73d22ef1333c9518ae` |
| Independent combined review | 2 | 22:21:38 | `5e398fa769c8413f23cd356f8cd1c8c7d6cc96df71dbe2f093109f64b82824f6` |

The user directed the execution order, authorized fresh agents and pinned the reviewed diagram. The user also checked the live source revision and asked for a status update during review. Human minutes, active agent minutes and provider charges were unavailable.

- Auth0 implementation and repair completed at 20:38:37 UTC (31m35s elapsed). Start `b908cf1be340446553eacb31f722f0215052f86d`, end `ae0b8ff70d221ca3becc3e470012197e05f2d4de`. The coordinator reproduced the missing-provider export failure, asked the implementer to repair it and independently re-exported the repaired Auth0 and default-Keycloak inputs. [Auth0 work and test attempts](auth0/README.md)
- Stripe implementation and repairs completed at 21:12:42 UTC (33m30s elapsed). Start `ae0b8ff70d221ca3becc3e470012197e05f2d4de`, end `ffe9501fccce3f6c2ba12de54a686dd152a00a90`. The coordinator checked the package/secret split, old migration bytes, and combined Auth0 and Stripe export. [Stripe work and test attempts](stripe/README.md)
- Retention implementation and repairs completed at 21:52:20 UTC (39m06s elapsed). Start `ffe9501fccce3f6c2ba12de54a686dd152a00a90`, end `0a88c3a15e9559e9f343abd6336bf11ef6a46b0d`. The coordinator independently exported both full and partial day settings, built the full scratch export and checked the compiled retention and calendar deployment inventory. [Retention work and test attempts](retention/README.md)
- Independent combined review found a generated Pub/Sub worker probe crash after readiness. The reviewer preserved the first failure and released the writer slot for a scoped repair. The reviewer then verified the repair and regenerated the handoff export at the repaired pin.
- Pub/Sub repair completed at 22:21:10 UTC. Start `0a88c3a15e9559e9f343abd6336bf11ef6a46b0d`, end `cbb8f5ed72d5e37f323a27b12f863761611f8a5c`. The isolated emitted Pub/Sub fixture passed repeated metadata probes, replay and restart using two worker copies, and terminal quarantine. [Pub/Sub repair evidence](pubsub-repair/README.md)
- Independent review completed at 22:38:15 UTC (45m20s elapsed, including the repair interval). The first review stopped at the reproducible Pub/Sub crash. The second passed the combined fixture, repository checks and the fresh r10 export comparison. [Combined review](combined/README.md)

## Observed model accounting

| Work | Counter snapshot UTC | Input | Cached input within input | Output | Reasoning within output |
| --- | --- | ---: | ---: | ---: | ---: |
| Coordinator, through the final accounting snapshot | 22:38:43.389 | 58,251,854 | 57,920,640 | 77,342 | 37,701 |
| Auth0 implementation, including its local repairs | 20:38:51.223 | 26,543,416 | 26,258,304 | 68,495 | 24,990 |
| Stripe implementation, including its local repairs | 21:12:56.974 | 33,679,714 | 33,303,296 | 68,054 | 29,603 |
| Click retention implementation, including its local repairs | 21:52:38.658 | 56,155,061 | 55,928,576 | 70,688 | 25,048 |
| Pub/Sub repair in the click-retention session | 22:21:22.715 | 8,922,517 | 8,783,488 | 32,446 | 9,160 |
| Independent review, first attempt | 22:04:30.225 | 4,788,297 | 4,607,360 | 29,461 | 5,612 |
| Independent review, repair interval and verification preparation | 22:20:54.325 | 6,506,297 | 6,472,576 | 15,919 | 8,332 |
| Independent review, repaired-export verification | 22:37:58.844 | 12,833,823 | 12,761,600 | 27,666 | 11,579 |

These are session-reported cumulative counters and differences between observed events. They include repeated cached context, tool and wait turns. The cached and reasoning columns are subsets. The retention and review rows split their respective sessions at the recorded snapshots to avoid charging cumulative counts twice. The final reviewer snapshot contains 24,201,463 total tokens. Coordinator and reviewer tokens after their final snapshots are outside this ledger. The sessions do not distinguish active time from elapsed time. Cost is unknown.
