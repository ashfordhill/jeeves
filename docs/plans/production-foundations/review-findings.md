# Production foundations: review findings

**Review date:** 2026-11-12  
**Plan reviewed:** [PF01–PF14](units.md)  
**Verdict:** not ready to run.

PF09–PF10 need changes before regeneration is safe. PF03, PF05 and PF12 contain instructions
that will block a literal implementation. PF06–PF08 need tighter failure and recovery
specifications. The remaining corrections are listed below.

This records the review originally delivered in chat, saved at the owner's subsequent request.
The review read AGENTS.md, the plan, the 2026-11-12 feedback entry, the latest handoff, and the
referenced implementation, tests, fixtures and harness archive. No plan unit, test suite, build
or application scenario was run. Runtime outcomes remain **unverified**. D1–D8 are treated as
settled decisions. Source line references describe the repository at review time; proposed
changes below are amendments for the planner, not implemented changes.

## Findings, most serious first

### 1. PF09 — The tables can delete or take ownership of application files

The “first match wins” tables have three unsafe cases:

| Case | Specified outcome | Problem |
| --- | --- | --- |
| Previous generated file is overridden, absent from next export, and `D == V` | `remove` | Deletes an explicitly application-owned override. |
| Previous ownership is `generated-extension`, next ownership is generated, and `D == V != N` | `replace` | Overwrites a hook, stub or product SQL file because the next manifest changed its ownership. |
| No previous record, but an existing application file happens to equal `N` | `unchanged` | Silently adopts it; a later update can replace or remove it. |

**Evidence:** [next-file table, units.md:963](units.md#L963),
[obsolete-file table, units.md:975](units.md#L975). Previous ownership is available in the
proposed input, but the next-file table never considers it.

**Why it matters:** a literal implementation follows the unsafe row order and ownership
classification exactly. These are necessary D5 protections, not optional hardening.

**Replace/add this plan text:**

> Before applying the next-file table, refuse a previous `generated-extension` becoming
> generated. For a generated next file with no previous record and an existing disk file,
> return `edited` unless it is explicitly overridden, even when its bytes equal the next
> export. In both tables, an existing overridden file takes precedence over hash equality:
> use `override` when next contains it and `orphan` otherwise. Add tests for these cases,
> including equal-byte collisions and ownership transitions.

### 2. PF09–PF10 — A successful update loses information needed by the next update

Two sequences are wrong:

- An obsolete, edited override is retained as `orphan`. PF10 writes the new manifest, which
  no longer mentions it. The next run refuses it as an “unknown override.”
- A changed extension gets a shadow. PF10 records the new template hash in the manifest.
  On the next identical update, `V == N` produces `keep`, and deleting all of
  `.jeeves/generated/` removes the unresolved shadow. The application file remains outdated,
  but its review signal disappears.

**Evidence:** [unknown overrides and shadows, units.md:985](units.md#L985),
[shadow deletion and manifest replacement, units.md:1017](units.md#L1017).

**Why it matters:** the current fourteen table-row tests do not cover either sequence. A
literal agent can pass them while delivering an updater that fails or hides pending work on
its second use.

**Add:**

> Hash paths in overrides as well as paths in the two manifests. An existing override absent
> from both manifests remains an `orphan`; an absent unknown override is refused. Preserve
> unresolved extension shadows across updates. Pass existing unresolved shadow paths into
> `planUpdate`; retain `keep-changed` until disk equals next or the application explicitly
> acknowledges the shadow by deleting it. Do not clear the shadow directory wholesale. Test
> both sequences with two consecutive updates.

### 3. PF10 — Filesystem refusal happens after mutation, and removals lack the stated path protections

The plan validates only the manifest's `format`, starts by deleting shadows, checks symlinks
while writing, and then deletes obsolete files. It does not require validation of
previous-manifest paths, symlink checks for removals, or detection of file/directory conflicts
before changing anything.

For example, an old generated file `a` becoming `a/b` cannot work with “write creates, then
delete removes.” An encountered symlink can also stop an update after earlier files have
changed.

**Evidence:** [PF10 steps 1–5, units.md:1007](units.md#L1007). Existing reusable path checks are
[assertSafeOutputPath, jeeves-generator/src/files.ts:8](../../../jeeves-generator/src/files.ts#L8)
and [assertDistinctPaths, files.ts:27](../../../jeeves-generator/src/files.ts#L27).

**Why it matters:** the agent must invent validation and failure-ordering policy or implement
an update that can stop after partially changing the application.

**Insert before any mutation:**

> Validate both manifests' records and override paths. Reject unsafe, duplicate,
> case-colliding and file/directory-colliding paths. Preflight every read, write, shadow and
> removal target and its parents with `lstat`; reject symlinks and unexpected non-file targets.
> Refuse file-to-directory and directory-to-file transitions in this version. Complete this
> preflight before deleting or writing anything, including during `--check`.

Also replace “never touches a file that is in neither manifest” with an explicit exception
for generator-owned manifest/shadow metadata. The manifest excludes itself:
[jeeves-generator/src/v2/assemble.ts:410](../../../jeeves-generator/src/v2/assemble.ts#L410).

### 4. PF07 — The reconnect instructions leave the important races undecided

“Destroy the client in use” does not cover a replacement client whose `connect()` is still
pending. Nor does the plan specify what happens when an old client's error or timed-out
command completes after a new client becomes active. “Once for that change” leaves repeated
unavailable notifications ambiguous.

**Evidence:** the existing implementation closes over one immutable client, so none of these
protections already exists:
[valkey.ts.template:16](../../../jeeves-generator/templates/local-v2/assets/src/runtime/valkey.ts.template#L16).

**Why it matters:** the agent must design the lifecycle and concurrency rules itself. The
listed tests can pass without covering the races above.

**Replace the reconnect bullets with an explicit state contract:**

> Keep one active-or-connecting client generation, one retry timer and a permanent closed
> flag. Every event handler and command completion captures its generation and ignores stale
> generations. `close()` cancels retry/deadline timers and destroys both active and connecting
> clients; late connection success must destroy its client and emit no state notification.
> Emit `available` or `unavailable` only when the externally reported state changes, including
> the first connection result. Guard notification callbacks against exceptions. Retry
> failures while already unavailable do not emit another unavailable transition.

Add tests for close during connection, late connection success, old-client errors, concurrent
command failures, and repeated failed reconnects—not just advancing time after close.

The five-second reader skip also removes an existing safeguard:
[positive-cache.ts.template:31](../../../jeeves-generator/templates/local-v2/assets/src/runtime/positive-cache.ts.template#L31)
explicitly prevents accumulating calls to a permanently stalled injected adapter.
`Promise.race` does not cancel those calls.

**Add:**

> Track timed-out underlying cache operations. Do not launch another cache phase while a
> timed-out operation remains unsettled. Once it settles, retry after the five-second skip.
> Test a permanently stalled adapter across several retry intervals and update the old
> lifetime-disable comment.

### 5. PF08 — The terminal-error catch is incomplete and introduces another silent failure

`encode` returns `wire`, leaving `jsonBody(wire)` outside the protected block. Serialization
can throw for a cyclic value, `BigInt`, an invalid result or an oversized envelope:
[media-worker.ts.template:70](../../../jeeves-generator/templates/local-v2/assets/src/runtime/media-worker.ts.template#L70).
That still reaches the delivery runner's fatal path.

Further, `catch { return; }` silently discards the failure-report error. `watchHooks` logs only
“Not implemented” errors outside the message handler; it does not log arbitrary terminal-hook
errors:
[tile-loop.ts.template:195](../../../jeeves-generator/templates/local-v2/assets/src/runtime/tile-loop.ts.template#L195).

**Why it matters:** the specified fix handles a throwing hook but not all invalid hook
results, and it reverses PF06's logging goal.

**Replace PF08 step 1 with:**

> `encode` constructs and validates the identity, invokes the hooks, serializes and bounds
> the body, and returns `{ id, body }`. Catch failures from that complete preparation in
> `onTerminal`, report them through a guarded failure callback with module and message
> identity, then return. Keep publisher availability and publish failures outside that catch.
> Test throwing hooks, invalid serialization, oversized output and successful handling of the
> next delivery.

The video does **not** immediately become failed after the report is skipped. It stays
pending until its ten-minute queue deadline, or processing until its thirty-minute processing
deadline; a subsequent lifecycle sweep marks it `QUEUE_DEADLINE` or `PROCESSING_DEADLINE`.
Evidence: [pending deadline, asset-lifecycle.ts.template:319](../../../jeeves-generator/templates/local-v2/assets/src/runtime/asset-lifecycle.ts.template#L319),
[processing deadline:398](../../../jeeves-generator/templates/local-v2/assets/src/runtime/asset-lifecycle.ts.template#L398),
[sweep:437](../../../jeeves-generator/templates/local-v2/assets/src/runtime/asset-lifecycle.ts.template#L437).

Replace “if you can't tell…” with that exact explanation, qualified on the lifecycle sweep
succeeding. Its failure hook runs inside the transaction and can itself prevent that
transition:
[asset-lifecycle.ts.template:273](../../../jeeves-generator/templates/local-v2/assets/src/runtime/asset-lifecycle.ts.template#L273).

### 6. PF08 — The new sweep result can still lose its collected failures

If either per-item loop records errors and the unchanged provider-orphan phase subsequently
throws, the caller never receives `{ failed }`. Only the final exception is logged.
Evidence:
[multipart.ts.template:303](../../../jeeves-generator/templates/local-v2/assets/src/runtime/multipart.ts.template#L303).

There are also callers outside the generated process wiring:
[product-attachment/service.ts.template:74](../../../jeeves-generator/examples/product-attachment/service.ts.template#L74)
and its periodic call at line 158. Merely continuing to await the new return value silently
ignores failures.

**Why it matters:** “update every caller” leaves the error-handling decision open, and the
new result does not cover a mixed item/provider failure.

**Add:**

> Preserve sweep single-flight identity and update both `Promise<void>` annotations. If the
> provider-orphan phase throws after item failures, throw an `AggregateError` containing the
> collected errors, annotated with their upload IDs, followed by the provider error. Update
> the product-attachment startup and periodic callers to report returned failures. Test the
> mixed case: an interrupted-upload failure followed by a provider-inventory failure.

The return-shape change is otherwise compatible with callers that only await completion,
but those callers must consume it to meet the logging goal.

### 7. PF06 — “Every failure is logged” is not delivered by the listed sites

Verified omissions include:

- Lifecycle sweep and publication-relay failures share one `onSweepError` callback; the
  wiring currently supplies neither. The plan requires two different labels without
  specifying the API change:
  [asset-worker.ts.template:26](../../../jeeves-generator/templates/local-v2/assets/src/runtime/asset-worker.ts.template#L26),
  [loop-wiring.ts:184](../../../jeeves-generator/src/v2/loop-wiring.ts#L184).
- Cache decode/validation and fill failures remain swallowed even after Valkey state logging:
  [positive-cache.ts.template:65](../../../jeeves-generator/templates/local-v2/assets/src/runtime/positive-cache.ts.template#L65).
- Multipart initiation discards the original exception and silently ignores abort cleanup
  failure:
  [multipart.ts.template:227](../../../jeeves-generator/templates/local-v2/assets/src/runtime/multipart.ts.template#L227).
- `scope.fail(error)` ignores its argument, and drain failures lose their reasons:
  [process.ts.template:26](../../../jeeves-generator/templates/local-v2/assets/src/runtime/process.ts.template#L26),
  line 47.

**Why it matters:** a literal agent can complete every named wiring step while failures
continue to disappear or lose their original cause.

**Add explicit instructions:**

> Add a separate guarded lifecycle `onRelayError`; wire it to `outbox relay publication`, and
> wire `onSweepError` to `sweep <module id>`. Add guarded reporting for positive-cache
> decode/fill failures and multipart initiation/abort failures before they are converted or
> suppressed. Log the supplied fatal error and drain errors in `runProcess`. Preserve
> existing response and retry behavior.

Add the affected runtime files to PF06's export allowlist.

Existing assertions also need updates, not merely new tests:
[durability.test.ts:216](../../../jeeves-generator/src/v2/durability.test.ts#L216) expects the
old three-property relay result;
[http-wiring.test.ts:386](../../../jeeves-generator/src/v2/http-wiring.test.ts#L386) pins the
old startup and periodic sweep strings. Name both files explicitly in PF06/PF08.

### 8. PF03 — Its promised legacy repair does not follow from its changes, and three e2e tests are missed

A refused worker pair has no rule, and `designReview` immediately skips pairs with no rule:
[studio-design-review.ts:473](../../../jeeves/packages/spec/src/studio-design-review.ts#L473).
It therefore cannot produce the promised `line-style` finding and redraw commands.

Even an otherwise valid pair with an invalid async mode may have no repair commands:
removing its only incoming link strands the target, while adding a replacement is refused on
the invalid graph. The fallback currently tells the user to edit read-only Source &
diagnostics:
[studio-design-review.ts:518](../../../jeeves/packages/spec/src/studio-design-review.ts#L518).

**Why it matters:** the agent is told that these results follow automatically and to change
only a comment in the review implementation. The code does not support that expectation.

**Replace the two legacy bullets with:**

> Stored direct-worker links open unchanged with `LANE_INVALID`; no line-style repair is
> promised. Stored direct-async links between otherwise allowed endpoints also receive a
> line-style finding. Redraw commands are present only where the validated removal/redraw
> sequence succeeds. Document the unrepaired legacy case and replace the instruction to edit
> read-only diagnostics.

The test instruction also asks `planRemoveTile` to expose added links, but its public return
contains only `strands`:
[studio-lane-commands.ts:863](../../../jeeves/packages/spec/src/studio-lane-commands.ts#L863).
Specify checking `strands`, then applying the removal and inspecting the resulting
connections.

Explicitly name these missed e2e changes:

- [remove.spec.ts:30](../../../jeeves/apps/web/e2e/remove.spec.ts#L30): accept the
  queue/consumer removal confirmation; expect both removed, nine tiles and nine lines, and
  no `redirect-analytics` link.
- [relationship-tracing.spec.ts:148](../../../jeeves/apps/web/e2e/relationship-tracing.spec.ts#L148):
  accept the new confirmation before checking the surviving selection.
- [connect.spec.ts:264](../../../jeeves/apps/web/e2e/connect.spec.ts#L264): replace the
  successful Stats API → Analytics worker drag with a permitted service target, and
  separately assert worker refusal.

The plan's `kind: "worker"` search does not find these helper-based tests.

### 9. PF05 — The prescribed tests and completion command cannot work literally

Three exact blockers:

- `designSummary` is private:
  [tools.ts:423](../../../jeeves/apps/server/src/chat/tools.ts#L423). The proposed external
  test cannot call it as written.
- The surviving operation-selection test expects the exact context being removed:
  [chat.test.ts:434](../../../jeeves/apps/server/src/chat/chat.test.ts#L434). It neither calls
  a removed tool nor asserts a removed summary property, so the deletion rules leave it
  intact while “change no other test” prohibits fixing it.
- `grep -n … jeeves/apps/server/src` is nonrecursive. Adding recursion alone still conflicts
  with the required negative test containing the five names.

**Why it matters:** these are direct compile/test/completion-gate blockers, not discretionary
improvements.

**Replace those instructions with:**

> Test the summary through `JSON.parse(new Workspace(design).run("getDesign", "{}"))`, using
> the existing test helper. Update the operation-selection test to retain selection/history
> checks and assert that resolved operation-binding details are absent. Run the removed-name
> search over production TypeScript only, excluding `*.test.ts`.

Also replace blanket deletion with preservation of generic behavior tests. For example,
[chat.test.ts:1055](../../../jeeves/apps/server/src/chat/chat.test.ts#L1055) tests forced review
and review invalidation; its incidental `readReadiness` calls should become `getDesign` calls,
rather than deleting that coverage.

### 10. PF05 — Removing ten summary properties does not retire the chat surface

`reviewWithModules` spreads the complete strict review into the response:
[tools.ts:1325](../../../jeeves/apps/server/src/chat/tools.ts#L1325). That includes ownership
declarations, operation declarations and persistent scope:
[studio-review.ts:192](../../../jeeves/packages/spec/src/studio-review.ts#L192).

Other surviving channels include unfiltered `getDesign.findings`, `validateDesign`, the
selected-owner context, and prompt text telling the model it may address contracts when
asked: [tools.ts:536](../../../jeeves/apps/server/src/chat/tools.ts#L536),
[tools.ts:587](../../../jeeves/apps/server/src/chat/tools.ts#L587),
[tools.ts:798](../../../jeeves/apps/server/src/chat/tools.ts#L798),
[instructions:158](../../../jeeves/apps/server/src/chat/tools.ts#L158).

**Why it matters:** “Keep … every other tool as they are” directly conflicts with the goal.
A literal implementation removes the named properties while continuing to expose the same
declarations through reviews and context.

**Replace it with:**

> Keep the remaining tool names and supported editing behavior. At the server boundary,
> project `getDesign`, `validateDesign`, explicit reviews, automatic reviews and caller
> context onto structural/design findings plus the retained `notSpecified` count. Omit
> persistent scope, operation declarations and strict readiness details. Keep supported link
> access information and explicitly document whether read-only selected-owner context is
> retained. Do not change the spec or blueprint representations.

Name the corresponding prompt, final-review wording and tests in this unit. The existing
readiness-note assertion is at
[tools.test.ts:1017](../../../jeeves/apps/server/src/chat/tools.test.ts#L1017).

No removed-tool invocation was found in the current offline eval scripts. Recorded-request
replay nevertheless already drifts in **PF03**, because tool-visible link rules change—not
first in PF05. Correct the proposed eval-history sentence accordingly.

### 11. PF12–PF13 — The archived harness cannot be reused by changing only project and ports

Verified inside [operator-harness.tar.gz](../youtube-v3/evidence/v3-17/operator-harness.tar.gz):

- `env.sh:2` hard-codes the old scratch root.
- `incontainer.sh:3` and `snapshot.sh:4` source that absolute old `env.sh`.
- `harness/upload-run.mjs:93–94` and `harness/probe.mjs:72` write to `harness/runs/`, but the
  archive contains `runs/` at its root.
- The archive includes old scenario outputs.
- `probe.mjs:30–52` sends two distinct plays and expects a count increase of two, unlike A4.

**Why it matters:** “Write your own small script” leaves authentication, polling, output
paths and assertions to the cheaper agent. Changing the named environment values alone does
not prepare the archived scripts for this run.

**Replace setup step 3 with exact preparation instructions:**

> Set the new scratch root as well as project and ports. Make shell helpers source their
> adjacent `env.sh`. Normalize harness result paths to the scratch root's `runs/`, and create
> a fresh empty results directory without carrying over archived results. Supply named
> scripts and invocation arguments for A1–A6, B1–B4 and F1–F3; adapt the archived probe
> explicitly for A4's single event.

Add `mkdir -p <scratch>/app` before the archive extraction. The media fixture named by the
plan **does exist**.

### 12. PF12–PF13 — Several expected results or commands need exact qualification

A4 reads the count immediately after publishing, but the publisher only awaits publication,
not the counter's transaction:
[watch-api-view-publisher.ts:44](../../../field-projects/youtube/v3/app/src/modules/watch-api/watch-api-view-publisher.ts#L44).
The archived probe already polls for that reason. Search visibility is also asynchronous.

A1's “each tile's …/me” is too broad. The implementation has sign-in module routes, while
Search and workers do not each have a `/me`. The actual Watch route is documented at
[v3 README:128](../../../field-projects/youtube/v3/notes/README.md#L128).

`pnpm start` contains no explicit scale-to-one operation:
[local.mjs:235](../../../field-projects/youtube/v3/app/scripts/local.mjs#L235). Its claimed
replica reset is **unverified** and must not be an assumption.

**Why it matters:** valid asynchronous behavior can be recorded as a failure, and the agent
must infer routes, replica counts and timing policy not given by the plan.

**Change the scenario text to:**

> Name the three sign-in module routes explicitly. For count assertions, record the
> baseline, publish the specified unique IDs, poll every 250 ms for up to 10 seconds for the
> expected increase, then verify duplicates do not increase it. Poll search visibility with
> a stated deadline. Remove the scale-to-one claim from `pnpm start`; issue explicit scale
> commands wherever a replica count matters. Check recovery logs only since the recorded
> fault/recovery boundary. Give throughput requests an explicit timeout and derive their URL
> from `LOCAL_HTTP_PORT`.

For the cache command, the service, secret path and key format match the code. Add `exec -T`
for recorded noninteractive execution; the installed CLI confirms that ordinary `exec`
allocates a TTY. Live execution remains unverified.

### 13. PF12–PF13 — The sequence contradicts D7, and F3's fallback proves something different

PF12 destroys its stack, then PF13 starts another and doubles only Watch and View counter:
[PF12 cleanup, units.md:1198](units.md#L1198),
[PF13 setup, units.md:1207](units.md#L1207). That is two runs, not one run with two copies of
every process followed by faults.

Stopping a worker before completing an upload does not exercise killing a worker with an
in-flight delivery. The fallback at [PF13, units.md:1213](units.md#L1213) cannot establish the
same recovery result.

**Why it matters:** the agent can follow every step and still produce different evidence
from D7. The fallback could incorrectly be counted as a pass for in-flight recovery.

**Replace the handover instructions with:**

> PF12 leaves its isolated scratch stack running with all eight application services scaled
> to two. Record its location and environment in the handoff. PF13 reuses that stack; cleanup
> occurs after PF13. For F3, kill the identified container handling the observed processing
> job. If no in-flight execution is captured after three attempts, mark that case Unverified;
> record the stopped-before-delivery case separately.

The eight-service scaling command itself matches the Compose file: application profiles are
correct, those services have no fixed `container_name` or published host-port collision, and
the expected counts are **15 before scaling, 23 afterward**. This is static verification,
not a runtime pass.

### 14. PF11 — The preservation proof omits product SQL and leaves override merging discretionary

The prescribed `git diff … src/modules` cannot check product SQL outside that directory.
“Re-apply v3's one edit … as custom-paths describes” also asks the agent to reconstruct
changes from prose.

**Evidence:** [PF11, units.md:1118](units.md#L1118),
[custom-paths.md:55](../../../field-projects/youtube/v3/notes/custom-paths.md#L55).

**Why it matters:** the check can pass without establishing the stated SQL preservation
claim, and the override step leaves a manual merge decision open.

**Replace those checks with:**

> Compare bytes for every previous manifest record with ownership `generated-extension`,
> plus every application-owned file absent from the previous manifest. Report paths and fail
> on any difference. For each scaffold override, derive the exact patch from v3/generated to
> v3/app, check that it applies to the new generated file, then apply it; stop on a failed
> patch check.

The prescribed design SHA and the six changed scaffold paths were verified: the four
overrides plus `dependencies.ts` and `module-clients.ts`. The 19-test expectation matches the
recorded test inventory; passing those tests is unverified.

### 15. PF14 — A clean refusal list does not prove v4 uses the final templates

`--check` with an empty `refused` list can still propose replacements. PF14 may then change
templates after PF12/PF13's evidence was collected, without regenerating or retesting v4.

**Evidence:** [PF14, units.md:1286](units.md#L1286),
[permitted fixes, units.md:1292](units.md#L1292).

**Why it matters:** passing the prescribed command does not establish that the final source
and the application used for runtime evidence correspond.

**Add:**

> Final `update:v2 --check` must report no pending creates, replacements or removals, with
> only explicitly documented overrides/extension differences. If PF14 changes emitted
> runtime behavior, regenerate v4, rerun its 19 tests and the affected runtime scenarios, and
> replace the affected evidence. Otherwise leave that fix as a follow-up and state that the
> evidence covers the earlier template revision.

### 16. PF04 — Archive links break, and the stated UI goal has an undocumented exception

Moving the files one directory deeper breaks their own relative links:
[studio-contracts.md:6](../../studio-contracts.md#L6),
[studio-readiness.md:28](../../studio-readiness.md#L28), and its catalog link at line 74.
The plan only repoints incoming links.

The web also retains an operation-contract dialog on entry moves:
[Workspace.tsx:795](../../../jeeves/apps/web/src/canvas/Workspace.tsx#L795). That is more than
the explicitly retained removal previews.

**Why it matters:** the agent will leave broken archive references and cannot make “the web
app shows nothing of the strict-contract layer” true while preserving the specified code.

**Add:**

> After moving the archive files, repair their internal relative links. Retain raw saved
> source and legacy declaration cleanup confirmations for both removals and entry moves;
> these are explicit exceptions to retiring strict-contract authoring and reports.

The default-study changes otherwise name the relevant default-dependent tests and the
foundation-only diagram-export test correctly. Keeping the explicit foundation lookup while
removing its chooser entry is coherent.

### 17. PF03 and PF02 — Some prescribed documentation would be false

PF03 removes direct access to legacy Notifications from three rows, but leaves
`action → notification` allowed:
[studio-links.ts:111](../../../jeeves/packages/spec/src/studio-links.ts#L111). Notifications
is explicitly a worker process:
[generation-support.ts:74](../../../jeeves/packages/spec/src/generation-support.ts#L74).

Its “Modes cell of the three rows” refers back to application/application,
external/application and CDN/application; this leaves application/external incorrectly
documented as allowing async. The chat preamble also still describes direct async calls:
[tools.ts:139](../../../jeeves/apps/server/src/chat/tools.ts#L139).

**Why it matters:** the exact edits leave a queue-only worker reachable from an action and
leave code-facing guidance inconsistent with the new rule.

**Add to PF03:**

> Remove `notification` from action targets. Name the three mode changes explicitly:
> application/application, application/external-api, external-api/application. Update the
> server's link-table preamble to say dashed links require Queue or Topic.

PF02 twice says local-v1 is “otherwise unused,” but the web still selects it and the server
still exports it:
[GenerateProject.tsx:78](../../../jeeves/apps/web/src/canvas/GenerateProject.tsx#L78),
[generation route:82](../../../jeeves/apps/server/src/routes/generation.ts#L82).

**Replace “otherwise unused” with:**

> Retained for exact legacy snapshot exports and regression checks; new module-authored
> projects use local-v2.

### 18. Rules and PF06–PF08 — Clarify the pin and command procedures before handing them to separate agents

The pin helper names and import paths are correct. The fixtures directory is excluded from
registry source capture:
[local-v2/index.ts:24](../../../jeeves-generator/templates/local-v2/index.ts#L24). The pin
deliberately removes source-inventory changes while retaining payload hashes:
[processes-off.ts:36](../../../jeeves-generator/src/v2/fixtures/processes-off.ts#L36). Thus the
proposed initial no-change check is structurally sound, though unexecuted.

The corrections above expand emitted-file changes, so their allowlists must be updated before
execution. Otherwise rule 7 tells the agent to stop on the intended fix.

**Why it matters:** a fresh agent needs a complete path-based check before replacing the
baseline; a pin refresh must not hide unrelated assertion failures or approved changes that
the allowlist forgot.

**Add to rule 7:**

> Before replacing pins, save the complete old-versus-new path/hash diff and verify every
> changed, added and removed payload path against this unit's allowlist. Pin updates never
> excuse another failing test. Update existing result-shape and emitted-string assertions
> explicitly named by the unit.

Also amend “every pnpm command from repository root” with the explicit PF11–PF13 scratch-app
exception. Give the mouse-check command the existing Docker fallback;
[e2e-docker.sh:12](../../../jeeves/scripts/e2e-docker.sh#L12) already forwards a spec filter.

## Direct verdicts on the planner's four uncertainties

- **Worker rule:** right for the current generator. Workers have no HTTP listener;
  Notifications has the same process shape. Finish applying it to action entries.
- **Load legacy refused links with a finding:** right. Do not rewrite saved meaning silently.
  The plan must accurately describe when the resulting design cannot be repaired through
  current commands.
- **Keep strict-contract spec code and blueprint fields:** sound by itself. The concrete
  problems are the retained chat projections and inaccurately described UI exceptions, not
  passive schema/blueprint retention.
- **YouTube v4 as regeneration proof:** sound for updating generated source while preserving
  application code, once PF09–PF11 are corrected. It does not prove live data migration or an
  upgrade of an existing running deployment. The startup script explicitly checks retained
  runtime composition identity:
  [local.mjs:95](../../../field-projects/youtube/v3/app/scripts/local.mjs#L95).

## Unit verdicts

| Unit | Status | Reason |
| --- | --- | --- |
| PF01 | Ready | Named replacement text exists; no blocking mismatch found. |
| PF02 | Needs change | “Otherwise unused” contradicts the live legacy export path. |
| PF03 | Needs change | False repair expectations, missed e2e changes, Notifications entry and text omissions. |
| PF04 | Needs change | Repair archive links and state the legacy cleanup-dialog exception. |
| PF05 | Needs change | Surviving test failure, inaccessible test target, invalid grep and remaining contract exposure. |
| PF06 | Needs change | Missing failure sites and unnamed existing assertions. |
| PF07 | Needs change | Specify client generations, close races, transition notifications and stalled-operation bounds. |
| PF08 | Needs change | Catch full encoding, log skipped reports and preserve sweep errors. |
| PF09 | Needs change | Ownership transitions, override precedence and repeated-update cases are unsafe. |
| PF10 | Needs change | Complete preflight before mutation; preserve unresolved shadows. |
| PF11 | Blocked | Depends on a safe updater; strengthen ownership preservation and override application checks. |
| PF12 | Needs change | Harness preparation, asynchronous assertions and stack handover are incomplete. |
| PF13 | Needs change | Reuse the two-copy stack; make fault identification, scaling and fallback verdicts exact. |
| PF14 | Needs change | Require final generated-output freshness and evidence tied to the tested templates. |

## Questions only the owner can answer

None required. These corrections can be made within D1–D8.
