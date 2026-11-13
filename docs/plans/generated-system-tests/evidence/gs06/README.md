# GS06: one generated Media system

Implemented Media/B08 on 2026-11-13 from `59d1af3` plus this unit's recorded dirty source.
Cold, warm and the complete-suite run use source SHA-256
`0272a8086f90e0d2db7cf12072ee02881152f5222e1818ac94e060299aca8cf6`.
A review then added only Media harness/scenario observations: normal upload credentials see
the actual aborted part before abort and exactly 404 NoSuchUpload afterward. Final Media passed
from source `c13af28ffc50f75b590d4f8db852dd772519639bcbedb96db925622fc6697ab2`.
`source-boundary.json` and `abort-observation.patch.gz` show the only two changed source files.
All four original Media manifests/reports are identical; no fixture, template, application or
shared lifecycle/identity source changed after the full run. Cold/warm costs precede those two
extra provider observations.

No template, generated scaffold, historical field app, processes-off pin or studio UI changed.
Hosted CI remains pending owner publication; no push or branch-protection change occurred.

## Ownership and behavior

The separate Media fixture preserves the parsed values of PF14-reviewed v4's command-authored
backend diagram. Its provenance records the original design, inspected v4 ownership record and
owned source hashes. Eleven explicitly mapped current report/manifest extensions supply eight
hooks, two stub bodies and product SQL. The shared domain codec lives in the reported lifecycle
hook; no additional unreported file or scaffold exception was added. The fixture permits any
verified account to upload and uses its verified username as channel, omitting creator-role
product policy. Equivalent character-code filename checks replace the copied control-character
regex. No browser code, overrides, owner media, download or binary fixture is copied.

B08 runs real generated edge/processes, PostgreSQL, RabbitMQ, Garage, Keycloak, OpenSearch,
Valkey and the pinned FFmpeg image. Installed templates own multipart, lifecycle, encoding,
delivery, transactions, outbox relay, receipts, counting, search and favorites. Assertions import
no generated runtime functions and successful requests use normal account/provider credentials.
Administrative access only provisions accounts or observes durable state.

- Both cold and warm generate exactly 8,261,230 bytes of four-second 1280x720 H.264/AAC MP4:
  SHA-256 `1281fc11ef003049160761d24b5fe9aa4f09927cb9116180a80430a653689da4`.
  FFmpeg arguments/version, built image ID, OS lock hash and FFprobe output are retained.
  Invalid input is 9,216 deterministic bytes, with its own recorded hash.
- Real PKCE sign-in starts the upload. A 5,242,880-byte first part appears with its actual ETag
  in a separate provider-backed ListParts request. The remaining 3,018,350-byte final part
  resumes it without sending the first again. Another account cannot inspect it. Completion
  returns the current 200/pending contract; repeated complete is identical. The Transcoder's
  normal read-only original credential independently retrieves and hashes the complete bytes.
- Pausing the real worker establishes pending state and exclusion from details/search/favorites.
  Restarting it produces durable started/succeeded receipts, ready state and one publication
  intent. Both delivered HLS rendition playlists/segments are H.264/AAC with 4.021334-second
  FFprobe duration; the delivered JPEG is MJPEG at 1280x720. Actual delivery byte hashes and
  playlist text are retained. No human-listening or browser-playback claim is made.
- A separate first-part-uploaded abort cannot complete (410 UPLOAD_CLOSED). Final Media also
  independently observes its real part with the normal upload S3 credential before abort, then
  exactly 404 NoSuchUpload afterward. Provider upload IDs stay private; only their hashes appear
  in evidence. Invalid bytes
  complete into processing, then become INVALID_MEDIA. Exactly that job's original ID,
  asset/hash/size and terminal headers (`INVALID_MEDIA`, attempt 1) appear in the real failed
  queue. It is observed and acknowledged; all four failed queues then contain zero messages.
  Pending, failed and aborted items never become public/searchable or favorite eligible.
- The real publication outbox envelope is confirmed through RabbitMQ while its subscriber is
  stopped: zero queued → exactly one queued → consumed/acknowledged after restart. The same
  single search document and external version remain, with no terminal publication failure.
- In this same Media stack, two accepted reports of one play yield exactly one count/receipt.
  Repeated favorite PUT returns the same record; another account cannot see/remove it. Exact
  durable favorite rows and deletion are checked. The complete composition leaves exactly three
  outbox intents, four lifecycle receipts and one published video.

Multipart's 200 completion/missing creator-status UI remain known gap 1; they were not changed
or required as incidental UI work. Broker/provider faults beyond ordinary worker/subscriber
pause/start remain GS07 after BR01–BR02. No broker reconnect or UI work was taken over.

## Cold and warm cost

`measurement.py` invokes the ordinary CLI without GitHub environment variables. Cold starts
with an empty dedicated BuildKit builder (0 B) and private standalone pnpm store; repository
installation and all exact provider/base images already exist. Warm reuses only those build and
download caches. Every invocation exports afresh and uses new credentials, provider volumes and
ports. No owner cache/data was pruned. The FFmpeg apt stage took 139.1 s cold; exact OS/package
lock and FFmpeg version checks passed within the unchanged build deadline. Cold app targets
record zero cached steps; the Media target reuses seven app steps built during that same CLI.
Warm app/Media targets record nine/fifteen cached steps. The measurement helper overwrites
`cold-builder-cache.txt` with its post-cold inventory; `initial-cache-observation.json` names
that limitation and retains the initial 0-B reading observed in the tool session.

| Run | Result | CLI wall time | Harness time | Controller monotonic time | Sampled run containers | Sampled run memory | Sampled run + builder memory |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cold | 1/1 | 5:04.27 | 304.039 s | 276.815 s | 15 | 2.50 GiB | 3.20 GiB |
| Warm | 1/1 | 2:41.59 | 161.348 s | 148.144 s | 15 | 2.51 GiB | 3.48 GiB |

The machine is the owner's 12-logical-CPU, roughly 31-GiB WSL/Docker host. CLI/harness wall and
controller monotonic clocks differ, as in GS03; they are distinct raw readings, not added.
Use CLI wall time for cost. Sampling waits five seconds plus Docker command time and may miss
peaks; these are observations, not capacity or sustained-load claims. Peak combined CPU was
658.61% cold and 427.55% warm. Setup provenance, download/build history/cache inventories,
GNU time and raw samples are under `measurement-setup/`. Its final cleanup shows identical
before/after container/network/volume inventory hashes, successful removal of its dedicated
builder and private pnpm store, and no owner resource changes.

The workflow retains core for PRs and main pushes, adds manual Media and weekly scheduled all,
and calls the same serial runner. Expanded jobs allow a 30-minute step/40-minute job while the
CLI retains its 20-minute command bound; core retains its 15-minute step/20-minute job. Those
limits are reviewable local choices; hosted duration/reliability is unverified until publication.

## Failed invocations retained

All four preceding invocations remain under `failures/`; none was hidden by a test retry.
Each next invocation followed a diagnosed owned-fixture or observer correction and fresh export.

| Run | Actual failure | Correction |
| --- | --- | --- |
| `owned-sql-header` | Setup rejected a TypeScript-style comment in owned SQL | Correct SQL comment syntax |
| `owned-sql-comment` | My trimming selected CREATE text in copied guidance, leaving `<name>` syntax | Keep exactly the actual CREATE VIEW statement |
| `empty-json-post` | B08 reached real identity/input/start; empty signing POST declared JSON, so Fastify returned 400 | Set JSON content type only with a body |
| `invalid-terminal-expectation` | Full pipeline/replay/counts/favorites reached final blanket failed-queue-zero check; invalid media correctly left a terminal job | Require exactly that invalid envelope/code/attempt, then all failed queues zero; add exact outbox/receipt assertions |

These were application attachment/harness mistakes, not template defects. No timeout, retry,
skip, required behavior or generated output was weakened/repaired. Failed results, useful logs,
observations, scaffold hashes and actual cleanup inventories remain. The last failure removed
all 15 containers/five volumes; earlier setup failures each removed their five providers.

## Resource lifecycle, privacy and retained evidence

Each stack captures observations, final scaffold hashes and its behavioral result **before**
Docker deletion. Exact-label validation/removal is reused for per-stack release and final
idempotent recovery. `stack-cleanup.json` preserves the actual nonempty removal inventory;
outer `cleanup.json` correctly observes empty completed scopes. Cleanup failure changes the
result and whole run to nonzero. Private application/runtime/sibling redaction files stay alive
until global JSON/JUnit/text reporters are scrubbed, then the outer temporary directory is
removed. A signal during resource removal therefore cannot replace the captured behavioral
observations with an empty fallback capture.

The existing privacy probe passed against this source: mode-0600 transient inputs under a
mode-0700 run directory, opaque values scrubbed in failures/observations/JSON/JUnit, unreadable
input fails closed and clears stale marker, recovery scrubs before deletion. Signed multipart
URLs and sensitive signature/credential query values are registered before transfer; nonsecret
short query values (part number, expiry) are not treated as secret substrings. Existing JSON
scalar preservation, symlink refusal and upload-marker guards remain intact.

`cold/` and `warm/` retain original compressed reports/manifests, source identity, full sanitized
observations/provider logs, hashes/probes, durable pipeline observations, JUnit/JSON, results and
per-stack/final cleanup. The original reports remain incomplete with nine required custom gaps
and all thirteen expected installed selections; attaching application hooks does not rewrite
that report. Raw or oversized text/JSON is gzip-compressed; no runtime secret or binary media is
retained. Full local artifacts remain `/tmp/gs06-cold-confirmed`, `/tmp/gs06-warm-confirmed` and
`/tmp/gs06-measurements-confirmed`.


## Full-suite validation and current source boundary

`--suite=all` passed eight tests in five files: core 4, Wiring 2, Identity 1, Media 1.
Vitest reported 630.79 s; harness wall time was 706.662 s. Independent three-second-plus-command
sampling never observed two projects with containers, or resources reappearing after a stack's
cleanup completion. The eight actual per-stack removals total 73 containers, eight networks and
24 volumes. Each final scope is empty and the private run directory is removed. Separate live
boundary observations prove completed Activity runtimes and then Media's mode-0600 OAuth sibling
remain present after Docker release, before final global scrub; the final marker matches the run.

Review then added the exact provider-abort observations described above. Final fresh Media
passed 1/1 without changing the exported application or shared lifecycle source. Other suites
were not repeated for this Media-only observer addition. The full all-suite proof and exact
source boundary are retained; this is not a claim that an all invocation ran after that addition.
`all/` retains the full regression run and sequential/privacy boundary observations;
`final-media/` retains the stronger current B08 run.


## Repository checks

Current-source `pnpm check` passed lint/typechecks and 823 tests in 106 files. `pnpm test:e2e`
passed 73/73 Chromium cases (4.6 min), then `pnpm --filter @jeeves/web build` passed. All heavy
Docker/build/browser phases were serial; no studio UI changed. Actionlint syntax/context passed
(shellcheck/pyflakes disabled). Compressed standard logs, exact source/workflow hashes and
outcomes are retained here. Independent exact-label audits cover nine completed run records
and sixteen project scopes, all empty with removed private directories and matching scrub
markers. Artifact pattern scanning is explicitly limited and complements the opaque-value,
unreadable-input fail-closed privacy recovery proof. No retry, skip or timeout change was used.

Full current Media and standard logs are `/tmp/gs06-media-final`, `/tmp/gs06-check-final.log`,
`/tmp/gs06-e2e-final.log`, `/tmp/gs06-web-build-final.log`; full regression is `/tmp/gs06-all-final`.
