# BR02 evidence: v4 on BR01 through a broker outage

2026-11-13. [Plan](../../units.md#br02--v4-takes-br01-and-survives-a-broker-outage) ·
[scenarios](../../../../../field-projects/youtube/v4/notes/scenarios.md#broker-outage-after-br01),
which hold the verdicts.

**Regenerate.** `export:v2` of `field-projects/youtube/v4/inputs/design.json` (SHA-256
`9762df41…3813f`) into the scratchpad: 112 files, 0 findings, 9 required gaps. It replaced
`v4/generated`; Git then listed BR01's 12 exported files and `.jeeves/manifest.json` and
`.jeeves/report.json`, nothing else. `update:v2 --check` and then `update:v2` on `v4/app`:
`refused`, `create`, `keepChanged`, `remove` and `orphan` empty, 13 replaced (the same 12 files
and `.jeeves/report.json`; worked out by comparing each manifest path, since the output gives
only counts), 83 unchanged, 11 kept, the four PF11 overrides. Git then listed only those 13
paths (ownership `generated-scaffold` or `generator-metadata`) and `.jeeves/manifest.json`. A
second `--check`: 96 unchanged, nothing to replace. A copy built and passed 19 of 19 tests.

**Setup.** `cp -a field-projects/youtube/v4/app` (134 files, the updated working tree) in the
session scratchpad, with V3-17's [operator harness](../../../youtube-v3/evidence/v3-17/operator-harness.tar.gz)
beside it (`lib.mjs` and `upload.mjs` unchanged), PF12's [`pf.mjs`](../../../production-foundations/evidence/pf12/pf.mjs)
(byte for byte) and [`env.sh`](env.sh) as PF12's four lines with this unit's project and ports.
Node 24.21.0, pnpm 12.16.1; Compose project `jeeves-br02` on 45820–45822, all free before. Media:
v1's fixture (15,584,953 bytes, SHA-256 `16587281…aebf9`), copied read only.

**Video IDs.** A `047f8e56-cd99-4437-b5b4-fa0c6049cbf9` (title word `narwhalcrimson`), B
`ea3be0f6-326e-4916-ac02-fb5a0c28545f` (`quetzalamber`). The play's event ID `<E>` is
`a6b8f000-5f93-4277-b2d2-dd6954ba612e`.

## Files

The JSON files are Biome-formatted (whitespace only). No file is over 100 KB, so none is
gzipped. No token, password, secret or signed URL signature is in them: `grep -rniE
'bearer|eyJ|password|secret|signature='` finds only `setup-accounts.log`'s three `passwordPath`
names, and the upload files keep each signed URL as `…?<signature>`. Log files come from
`docker logs --timestamps --since <boundary>`; an empty file means the container wrote nothing
in that window.

| File | What it is |
| --- | --- |
| [`docker-before-*.txt`](docker-before-containers.txt), [`docker-after-*.txt`](docker-after-containers.txt) | Containers, volumes, network IDs and images before the run and after the cleanup: equal, each of the four |
| `runs/regen-export.log`, `regen-update-check.json`, `regen-update-recheck.json`, `regen-check-*.log` | The export, the `--check` before and after the update, and the copy's install, build and tests (19 pass). The update's own output is [`update-br02.json`](../../../../../field-projects/youtube/v4/notes/update-br02.json) |
| `runs/setup-install.log`, `setup-build.log`, `setup-first-run-start`, `setup-first-run.log`, `setup-accounts.log`, `setup-ps.txt`, `setup-ps-raw.txt` | Setup: first-run 20:13:32 → 20:15:40 UTC; 15 healthy |
| `runs/r-a-upload.json`, `r-a-ids`, `r-a-ready.json`, `r-a-asset.txt` | Video A: the upload, its ID, the ready poll's last read, its asset row |
| `runs/part-b-scale-start`, `part-b-scale.log`, `part-b-ps.txt` | PF12's Part B scale command and 23 healthy |
| `runs/app-containers.txt`, `pre-count.json`, `pre-queues.txt` | The 17 `app-*` containers; A's count and the broker's queues before O1 |
| `runs/o1-boundary`, `o1-steps.txt`, `o1-ps-a.txt`, `o1-inspect.txt`, `o1-logs/` | O1: the stop, `ps -a` 20 s later, each container's state, exit code and restarts, every `app-*` log since the boundary |
| `runs/o2-boundary`, `o2-steps.txt`, `o2.json`, `o2-search.json` | O2: 10 details reads and the search |
| `runs/o3-boundary`, `o3-event-id`, `o3-command.txt`, `o3-steps.txt`, `o3-body.json`, `o2o3-logs/` | O3: the play's command, its status and time, the answer, every `app-*` log since O2's boundary |
| `runs/o4-boundary`, `o4-steps.txt`, `o4-expected.txt`, `o4-ps.txt`, `o4-inspect.txt`, `o4-queues.txt`, `o4-logs/` | O4: the start, the 16 container and `what` pairs waited for, `ps`, restarts, the queues' consumers, every `app-*` log since the boundary |
| `runs/o5-boundary`, `o5-steps.txt`, `o5-resend-body.json`, `o5.json`, `o5-db.txt` | O5: the same play again, the count, the 20 plays and the receipts and total in the database |
| `runs/o6-boundary`, `o6-steps.txt`, `o6-upload.json`, `o6-ids`, `o6-ready.json`, `o6-search.json`, `o6-published.txt`, `o6-assets.txt`, `o5o6-logs/` | O6: video B to ready, search, the `published.videos` count, both asset rows, every `app-*` log since O5's boundary |
| `runs/end-ps.txt`, `end-inspect.txt`, `end-log-counts.txt`, `end-queues.txt` | At the end: 23 healthy, 0 restarts, each `app-*` log's error, failure and `process-failed` lines, the queues |
| `runs/run-images.txt`, `run-volumes.txt`, `run-networks.txt`, `cleanup.txt`, `cleanup-down.log` | The stack's images, volumes and network; the cleanup (`down --volumes --remove-orphans`, the two image removals, the app copy's deletion) and the check that nothing `jeeves-br02` is left and 45820–45822 are free |
| [`env.sh`](env.sh) | The environment used |
