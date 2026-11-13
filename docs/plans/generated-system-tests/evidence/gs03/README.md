# GS03: portable core CI and local cost

The workflow adapter is `.github/workflows/generated-system.yml`. It uses the same
`pnpm test:generated --suite=core --artifacts=<new-directory>` CLI on PRs/pushes and manual
`core`/`all` runs. Node/pnpm and all action revisions reuse existing repository pins. Existing
studio CI is unchanged. pnpm downloads are lock-keyed across jobs; one content-addressed Buildx
cache is reused within a job. BuildKit layers are not exported between jobs.

Hosted execution is **pending publication**. No hosted result or branch-protection change is
claimed. The owner must publish the commits and verify the first hosted run before requiring
its status.

## Measurement boundary

The cold/warm measurements below precede the subsequent artifact-recovery privacy fix. That
fix changes only harness scrubbing/cleanup, with no emitted template or behavior assertion
change; `final-core/` and the final repository checks validate the final source separately.

The local measurement helper invokes the normal CLI after removing GitHub/ACTIONS/RUNNER
environment variables. Cold means a new empty dedicated BuildKit builder and private pnpm
download store; warm uses the same caches. Every scenario still gets a fresh export, private
runtime and provider volumes. The repository's installation and the pinned provider images
were already present. This does not measure an empty machine's image-download cost.

The machine is a Ryzen 5 7600X under WSL2, 12 logical CPUs and about 31 GiB RAM. Docker reports
12 CPUs and 33,188,683,776 bytes. Resource samples select only project labels recorded by the
runner, plus the helper's own uniquely named BuildKit container. Samples are five seconds apart
plus command time, so reported peaks are observations, not a capacity limit or sustained load
result. GNU time records the largest process RSS, not total process-tree memory.

| Run | Core | CLI wall time | Controller monotonic time | Sampled run containers | Sampled run + builder memory | GNU time largest-process RSS |
| --- | --- | --- | --- | --- | --- | --- |
| Cold | 4/4 passed | 357.67 s | 325.508 s | 27 | 1,617,010,101 bytes (1.51 GiB) | 973,880 KiB |
| Warm | 4/4 passed | 314.30 s | 282.892 s | 26 | 1,633,784,167 bytes (1.52 GiB) | 978,588 KiB |

Runner summaries independently record 357.410 s and 314.045 s. The controller's monotonic clock
differs from the two wall-clock measurements on this host; both raw readings are retained, and
the wall readings determine the reported cost. Sampling can miss brief peaks (both runs removed
27 containers during cleanup). Peak sampled run + builder CPU was 459.68% cold and 506.39% warm,
where 100% represents one logical CPU. Memory/RSS columns are different scopes, not quantities
to add into a measured whole-host peak.

The dedicated builder imported no cache; history records zero cached steps for all five targets
of the first build, versus nine cached steps each on the final warm build. It held 733.5 MB after cold. It and the
private pnpm store were removed after warm; the complete Docker container/network/volume
inventory hashes matched their baseline. The workflow's 20-minute job bound allows over three
times this machine's six-minute cold CLI time for a slower runner, repository installation and
uncached downloads. Hosted cost and reliability still need observation.
The generated step stops after 15 minutes, reserving headroom inside that job bound for the
three-minute recovery step and one-minute artifact upload; the harness's own deadlines remain
unchanged. A forcibly terminated host can still prevent final steps.

`cold-builder-cache.txt` is the post-cold inventory: the helper reused that filename for its
initial and post-cold `du` calls. The retained first-build log/history establishes the cold
boundary without treating the overwritten initial inventory as evidence.

## Initial failed setup and diagnosis

The first empty-builder run (`/tmp/gs03-cold`) failed in setup before application assertions.
Its unchanged generated Dockerfile stalled at `npm install --global pnpm@12.16.1`; the existing
240 s Compose build deadline expired. The failure was retained. After that recorded failure,
the runner received handled SIGTERM rather than repeating the same prerequisite across later
cases. Run resources, the helper's builder and its private pnpm store were removed; the complete
Docker container/network/volume inventory hashes before and after were identical.

Bounded diagnostics then established:

- Registry DNS and Node fetch succeeded from bridge and host networks; the same default npm
  install succeeded in a disposable container.
- Empty BuildKit minimal probes succeeded with both bridge and host networking. This does not
  identify a network configuration correction.
- A fresh default-registry Activity export with the same owned map and its unchanged multi-target
  Compose build succeeded in 37.890 s on another empty builder. BuildKit history recorded zero
  cached steps, scaffold hashes stayed unchanged, and the export/builder were removed.

The original npm stall remains **unexplained**, rather than fixed or hidden as a passing run.
One instrumented cold/warm validation follows the successful exact setup probe; no test retry,
assertion exemption, generated output edit, timeout increase or cache workaround was added.
Raw first-failure artifacts remain in `/tmp/gs03-cold` and `/tmp/gs03-measurements`; diagnostic
logs are in `/tmp/gs03-build-probe`, `/tmp/gs03-build-reproduction` and `/tmp/gs03-probe-*.log`.

## Workflow validation

Local syntax/context validation uses [actionlint 1.7.7](https://github.com/rhysd/actionlint/releases/tag/v1.7.7),
downloaded outside the repository and checked against its official release checksum
(`023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757`). It adds no repository
dependency. Shellcheck is unavailable and explicitly disabled for this syntax/context check.
This validation does not stand in for hosted execution.

## Controlled failure and cleanup adapter

`controlled-failure/` predates the recovery correction and retains a plain-shell core invocation with only B01's final HTTP expected
total temporarily changed from `1` to `2`; the preceding poll still required the real total
`1`. B02–B04 passed, B01 failed the assertion, and the command exited 1. All four stacks' 27
containers, four networks, eight volumes and the temporary export/runtime were removed.
`expectation.patch.gz` shows the sole change; `expectation.json` records the original, altered and
restored hashes. The restored file is byte-identical to the source used by both passing runs.
No generated file was changed and no retry setting was added.

`adapter-check/` retains the pre-correction adapter shell probe against a copied failed
run record outside GitHub. The original cleanup inventory is preserved as `runner-cleanup.json`;
the second cleanup confirms empty project inventories. `adapter.json` correctly reports the
failed test and successful install/builder/recovery steps. The guarded current adapter is
exercised separately in `workflow-recovery/` below. Actual artifact upload remains part of the
pending hosted proof.

## Retained files

- `cold/`, `warm/`: CLI summaries, identities, source hashes, JUnit, each stack's result and
  final scaffold hashes, sampled metrics and GNU time output. Their source fingerprints match.
- `measurement-setup/`, `measurement.py`: actual measurement helper, builder provenance,
  post-run cache/history/logs and matching before/after resource inventory hashes. The helper
  is evidence only and supplies no application mechanism or behavior assertion.
- `first-failed-setup/`, `diagnostics/`: the unsuccessful initial setup and bounded diagnostic
  results, including the successful exact export/build and removal of its diagnostic image.
- `controlled-failure/`, `adapter-check/`, `workflow-validation.txt`: deliberate failure,
  restored expectation, scoped recovery and static workflow validation.

Complete local artifacts remain at `/tmp/gs03-cold-confirmed`, `/tmp/gs03-warm-confirmed`,
`/tmp/gs03-controlled-failure` and `/tmp/gs03-measurements-confirmed`. Copied JSON was formatted
with Biome and checked for parsed-value equality; build logs and the exact assertion patch use gzip.
No application export, runtime credentials, binary media or provider data is checked in.

## Recovery privacy correction

Review found that the existing recovery CLI deleted runtime secrets without first scrubbing
possibly unfinished raw reporter output. `recovery-probes/before/result.json` retains the
failing sentinel observation: the old CLI exited 0 and removed runtime while the fake reporter
operand stayed raw. Only the disposable sentinel's SHA256 is retained, never its value.

The fix preflights every recorded scope before touching artifacts/resources, removes a stale
completion marker, scrubs with live runtime secrets, and writes a matching completion marker
before existing resource cleanup. Missing startup secret directories are allowed; other
secret-read errors propagate. Symlink artifacts are refused. A scrub failure leaves runtime
available for repair and no fresh completion marker.

`recovery-probes/after/` demonstrates redaction before runtime deletion. `io-failure/` uses an
unreadable existing secret: EACCES fails closed, removes the stale marker and preserves runtime;
restoring permission then permits redaction and cleanup. `workflow-recovery/` runs the exact
current YAML shell steps in a local shell for both paths. Successful matching-marker recovery
copies a redacted run to the upload folder; failed recovery copies only safe enum metadata,
with no raw run or sentinel. Actual upload remains unobserved pending publication.

## Final verification (2026-11-13)

| Check | Result |
| --- | --- |
| Current-source fresh core | 4/4 passed; 271.540 s including cleanup; 27 containers, four networks, eight volumes and private runtime removed; matching completion marker |
| `pnpm check` | Lint/typechecks and 820 tests in 105 files passed; 52.36 s |
| `pnpm test:e2e` | 73/73 passed, 4.7 min; no concurrent generated stacks/network changes |
| `pnpm --filter @jeeves/web build` | Passed |
| Current workflow validation | Actionlint syntax/context check and exact local recovery/adapter shell probes passed |
| Evidence copies | 68/68 parsed JSON values preserved through formatting; no file over 100 KB |

Final logs: `/tmp/gs03-final-core-command.log`, `/tmp/gs03-check-final.log`,
`/tmp/gs03-e2e-final.log`, `/tmp/gs03-web-build-final.log`. Prior checks also passed before the
recovery correction and were repeated afterward; those earlier results are not substituted for
the final source checks. The first npm setup stall remains open as described above.
