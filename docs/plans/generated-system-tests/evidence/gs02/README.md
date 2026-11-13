# GS02 local evidence

Recorded 2026-11-12 on the implementation above `0225a0b`. Full sanitized artifacts remain at
`/tmp/gs02-resume-core`; this folder retains the observations and results needed to review B01–B04.
No generated application, runtime, credentials or provider data is checked in.

- `pass/`: fresh exports, standalone frozen installs/builds and generated `first-run`; four tests
  passed (216.01 s Vitest; 265.239 s including final cleanup). `source.json` fingerprints the
  effective source and fixture files; `identity.json` records commit, dirty paths and tools.
- `pass/1-activity/`: B02. Two copies each of Counter and both public APIs, one edge. Each Counter
  committed work while running alone, and PostgreSQL observed its distinct container address.
  Two broker consumers then received 200 confirmed HTTP publications for 50 stable identities
  (initial plus three repeats, concurrency eight). No transport/HTTP errors; ready and unacked
  deliveries drained; total and exact successful receipt identities remained 50. Stopping each
  API copy in turn gave joint publication/read recovery within the asserted 15 s bound. HTTP
  and poll observations retain the transient outcomes.
- `pass/2-activity/`: B03. Three earlier effects and five broker-confirmed queued events survived
  ordinary stop/start on the same history and volume identities; a new event raised the total
  to nine. `restart-preservation.json` records the before/after history hashes and volumes.
- `pass/3-activity/`: B04. Malformed bytes reached `events--counter.failed` with message ID
  `malformed:one`, attempt one and `MALFORMED_MESSAGE`; the next valid event committed once.
  The real reader login read the published view, while two private reads and two private writes
  failed with PostgreSQL `42501`. `reader-permissions.json` retains those results.
- `pass/4-activity/`: B01's original fresh-export HTTP zero → confirmed submission → one, with
  the exact matching durable receipt and total.
- `pass/cleanup.json`: every project has zero remaining containers, networks and volumes;
  the temporary export/runtime was removed. Each final hash check lists only the original
  three mapped owned files as changed and confirms generated scaffolds stayed unchanged.
- `first-failure/`: the first run failed B02's harness assumption that both workers must keep
  startup SQL connections open indefinitely; the original pool had reached its normal idle
  timeout. B01/B03/B04 passed and all resources were removed. The corrected test observes each
  real worker connection immediately after its own committed event, retaining distinct address
  proof without assuming an idle connection lifetime. The invariant, receipt assertions and
  generated code did not change. Full original artifacts: `/tmp/gs02-first`.

Evidence JSON is Biome-formatted; parsed values were compared with the original artifacts.
Oversized observations are gzip-compressed. These are local results, not hosted CI evidence.
No retries, skips, assertion exemptions, template fixes or scaffold overrides were introduced.
