# RG04 — uniform HTTP contract

**Implementation verified; awaiting coordinator acceptance.** Baseline: accepted RG03
`d3b0e3f58402f0d2192e8f206d0b8607d9569156`. Extension API is now **v4**. No later unit,
provider, generated-system checkpoint, live issuer or paid model call ran.

## Implemented behavior

- One classifier in `src/runtime/admission.ts` owns status, retryability and mandatory
  `WWW-Authenticate`, `Allow`, `Cache-Control` and retry headers. Guards, parser/admission errors,
  route tables and mounted template routes all pass through the shared HTTP adapter. Known
  Fastify parser errors preserve 400/413/415; arbitrary provider `statusCode` is not trusted.
  Authentication/claim/signature failure remains 401; transient JWKS/native key lookup failure
  is a safe 503. Unimplemented hooks remain 501 with a generic public message.
- Only privately branded, actual pre-dispatch admission refusals advertise `Retry-After: 1`.
  An explicit/returned 503, generic dependency failure, deadline or unknown outcome does not
  authorize automatic replay. Returned error/message payloads are untrusted and replaced with
  generated safe defaults. Explicit generated `HttpError` messages are the safe public boundary.
- Each HTTP process imports the same application-owned `src/http-errors.hooks.ts`. The pure,
  synchronous formatter receives only frozen public classification and request/correlation IDs.
  It cannot control status/headers. Throws, rejected/resolved promises, invalid JSON values,
  excessive depth or output above 8 KiB fall back safely. Async rejection is observed. The
  extension checker follows this globally shared policy and its imports, including helper effects.
- Generated route declarations support 1 KiB, 16 KiB, 64 KiB (default), or 1 MiB body limits.
  Fastify rejects overflow before collecting input beyond that bound, including streamed input.
  Raw routes preserve exact JSON/text/binary bytes as `body` and `rawBody` without decoding.
  The operation budget starts in `onRequest` after headers; a stalled body gets the classified
  deadline response, then unread input closes after flush. Dispatch rechecks the live context.
  A stub also rechecks its child context before writing a response, avoiding an early child-timer
  race that could otherwise return an empty success body at the parent deadline.
- `/livez` reports an HTTP process able to answer, including drain. `/readyz` and compatibility
  alias `/healthz` report successful initialization/listen, then fall to 503 during drain.
  Health bypasses guards/admission and untrusted forwarded budgets. Readiness is not a continuous
  deep dependency probe. Required failed initialization never opens admission/readiness.
- Completion/failure lines carry safe route patterns, status/code, duration and generated
  request/correlation IDs. Raw URLs/query strings, Authorization, Cookie, bodies and original
  exceptions are excluded. Not-implemented HTTP logs use a fixed handler label. Process errors
  expose only finite configuration-variable diagnostics or a safe generic message. Structured
  process/HTTP drain milestones retain RG02's final ten-second bound and RG03's uncertain effects.

API v3-to-v4 updates refuse without `--ack-extension-api=4`; the real migration refusal preserves
all target bytes. The guide documents the changed public error/retry behavior and added shared
formatter. Existing product hooks are never rewritten. No inspector setting, authoring command,
webhook verification/storage, SQL handle or authenticated Custom target was added.

## Checks

All commands use Node **24.21.0**.

| Check | Actual result |
| --- | --- |
| `pnpm check` | Exit 0: Biome, every package typecheck, **122 files / 1,103 tests passed**. `/tmp/jeeves-rg04-check-final.log`. |
| Focused HTTP/lifecycle/wiring/migration regressions | **145 passed**, nine files. `/tmp/jeeves-rg04-focused-final.log`. The subsequent final full check includes the final boundary changes. |
| Raw/stalled HTTP behavior | Six real Fastify cases pass, including a real loopback socket that sends an incomplete declared body: 503 `DEADLINE`, complete JSON body and zero handler dispatch. `/tmp/jeeves-rg04-body-read.log`; final full run includes all six. |
| Fresh scratch generation | Sign-in **80**, search **81**, Favorites **64**, video **116**, stubs **86** files; each passes the emitted extension checker and pinned TS **7.0.2** offline. [Compiler output](emitted-compile.txt), [fixture records](fixtures.json). |
| Reviewed processes-off pins | **78→79, 84→85, 59→59**. Only added file: shared formatter where HTTP is emitted. Metadata/API/checker and HTTP/classification/lifecycle changes are enumerated in [pins](pins.json). Frozen v1 unchanged. |
| `pnpm --filter @jeeves/web build` | Exit 0; existing chunk-size warning. `/tmp/jeeves-rg04-build.log`. |
| `pnpm test:e2e` and focused mouse correction | **73 passed (6.5 min)**; one exact preview-route-list assertion omitted `/readyz` and `/livez`. Strengthened it to the complete new list; affected case then **1 passed (12.3 s)**. `/tmp/jeeves-rg04-e2e.log`, `/tmp/jeeves-rg04-e2e-targeted.log`. |

The e2e app loaded TinyURL on the lane canvas, exercised preview/download/tamper handling and
both long YouTube mouse rebuilds. No normal inspector control or authoring tool description
changed, so no extra chat/parity evaluation ran. The successful browser/build checks were retained
after private runtime boundary corrections; the exact changed preview assertion was rerun alone.

Early focused failures found strip-only parameter syntax, outdated fake Jose token errors and old
public error/retry/health expectations. The first full regression had five obsolete version,
startup-milestone, 501-body and route-list assertions (1,097 passed); these were corrected to the
new explicit contracts. The fractional child-deadline empty-response race was fixed in the
adapter, preserving the complete response assertion. The extra socket body-read bound and final
privacy/dispatch changes warranted the final full check above. The first scratch command selected
root `tsx`, which is absent; the established generator workspace command then compiled all five
exports. No timeout, assertion, lint rule or runtime guarantee was weakened.

Scratch exports were removed in `finally`; installed pinned dependencies were symlinked read-only,
with no install or historical export edit. The driver is `/tmp/jeeves-rg04-compile.ts`. Root hashes
match `/tmp/jeeves-rg-resume-root-files.json`; the owner's binary diff matches
`/tmp/jeeves-rg-owner-diff.patch`, including feedback/Zone.Identifier and the three protected mode
changes. Unit-path `git diff --check` passes. Docker inventory before/after remains only
`c0fbbc2996fe jeeves-postgres-1`, PostgreSQL 17 Alpine at `127.0.0.1:54329`. No task Docker resource,
owner studio port, push or deployment was used.

Deliberate limits: raw byte declarations do not authenticate webhooks; readiness does not certify
ongoing dependency health; cancellation/HTTP timeout is not rollback or proof of a failed mutation.
RG03's actual-driver tracking and RG02's final shutdown bound remain in force. Public SQL and
new authenticated Custom target handles remain explicit gaps. This unit stops for coordinator
acceptance at one explicit-path local commit.
