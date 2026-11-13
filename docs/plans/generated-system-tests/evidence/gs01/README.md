# GS01 local evidence

Recorded 2026-11-12 on the dirty implementation above `24c9abb`, before its unit commit.
These are sanitized excerpts of the runner's complete temporary artifact directories; no
runtime files or generated application scaffold is checked in.

- `pass/`: current runner, fresh Activity export, independent frozen install/build, generated
  first-run, B01 (edge zero → confirmed submission → one, exact receipt and total), 1/1 passed.
  Total including cleanup 61.890 s while E2E/offline checks also ran. All six run containers,
  its network and two volumes were removed; temporary runtime/export deleted. Generated
  scaffolds and manifest stayed unchanged; only the three mapped extensions differ.
- `deliberate-failure/`: the same scenario with its final HTTP assertion deliberately changed
  from total `1` to `2` (the poll still observed `1`). It failed, exited nonzero, retained its
  assertion and observations, and removed all six containers/network/two volumes/runtime.
  The correct assertion was restored before the passing export above. No generated code was
  changed and no test retries were enabled.
- `signal/`: SIGTERM sent to the runner PID after observing six project containers. The runner
  exited nonzero; all descendants were gone, all six containers/network/two volumes and runtime
  removed. This first signal check predates the added fallback container/log capture for an
  interrupted Vitest process; it demonstrates the same final command-tree/cleanup mechanism.

Complete artifacts remain locally at `/tmp/gs01-final`, `/tmp/gs01-deliberate-failure` and
`/tmp/gs01-signal`. The passing source hashes and original gzip manifest/report are in the full
artifacts; each run recorded its unique Compose project before export/startup. An initial
receipt assertion incorrectly expected a bare `true` rather than the runtime's documented
`{value:true}` result wrapper; `/tmp/gs01-first-run` retains that failure and successful cleanup.
The corrected projection still checks the exact receipt identity and true result.

An earlier correct invocation, `/tmp/gs01-correct-a`, passed in 43.474 s total. These are local
results, not hosted CI evidence. GS03 measures the portable core job separately.
