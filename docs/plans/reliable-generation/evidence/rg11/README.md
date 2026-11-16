# RG11 — atomic cache operations and saturation

Built on accepted RG10 `897ccf45393a07986cf7d6786c00d703ad6a7ccc`. Extension API remains **v8**.
The private generated Valkey adapter gains finite `admit`, `getVersioned` and `setIfNewer`
operations. No inspector control, provider, dependency or abstraction hierarchy is added.
The public stub `CacheClient` is unchanged; RG12/13 select their exposed capabilities later.
Scripts, command dispatch, sockets and clients remain private and fail the extension checker.

`admit(key, {limit, windowMs})` executes one fixed single-key Lua script. Store `TIME` determines
the rolling window. Entries at or before `now - windowMs` are removed; fewer than `limit` entries
admits one generated UUID. The log expires at the last admission's store timestamp plus the
window; denials leave expiry unchanged. The reply supplies count and an unchanged absolute
`resetAt` for the oldest entry. A consumer must derive a nonnegative wait from that bound, not
add a full window at receipt. Limits are 1–10,000 entries and 1 ms–7 days. A fixed policy needs
its own generated key namespace. No untrusted forwarding/address policy is implemented here.
Saturation/unavailability/error never yields a successful admission or a per-copy allowance.

Versioned records contain canonical unsigned **64-bit decimal strings**, a value and absolute UTC
`validUntil`. Version ordering uses decimal length then lexical comparison, never Lua/JS numeric
conversion. One fixed script compares and writes the encoded envelope using `SET ... PXAT`.
Older versions cannot replace a retained newer version. Equal versions can extend validity only
for identical value bytes; conflicting contents return `version-conflict`. Equal/older validity
returns `not-newer`; an already expired incoming record returns `expired` without storing. The
store enforces at most seven days remaining. The client also checks the bound at delivery, so a
late read becomes a miss and a late successful write reports expired without extending it.
Returned records/results are frozen. Source adapters must establish absolute validity before
starting fills and use compatible UTC clocks. Version fencing ends with key eviction, expiry or
store data loss; it is not a durable watermark. Mutable records do not silently inherit the
existing immutable positive-cache policy.

The adapter refuses malformed UTF-16 keys/values so UTF-8 encoding cannot alias keys or poison
subsequent server JSON decoding. It caps keys at 512 UTF-8 bytes, values at 64 KiB and encoded envelopes at a finite JSON
escape bound. Replies validate exact status/count/time/version/value forms. Invalid arguments and
expired contexts refuse before dispatch. Malformed mutation replies and Lua error replies remain
**unknown** because a script can partially mutate before an error; reads classify definite failure.
No mutation retries automatically. Even a server ErrorReply spelling `The queue is full` remains
unknown; only the pinned driver's local pre-enqueue Error is saturation.

At most **32 actual command promises** stay unsettled across all connection generations. A caller
has a 150 ms bound clamped to its RG03 context. Timeout/cancellation destroys that generation as
best-effort cancellation, retaining its actual promise and slot until settlement. Queue-full
refusals preserve the healthy generation and do not report an outage. Server/malformed replies
also preserve it. Actual connection errors/end events lose it, with one 5 s reconnect timer and a
500 ms connect bound. A genuinely unresolved destroyed connect prevents accumulating attempts.
Lifecycle cancellation stops reconnects and closes the current client. Captured handles obey
RG09/10 network/effect guards, including mutations inside a read and nested local mutation scopes.
Optional cache startup/degradation remains separate from required fail-closed admission. Existing
positive-reader `skipUntil` policy is unchanged.

| Check | Actual result |
| --- | --- |
| [Final `pnpm check`](check.txt) | Node 24.21.0; Biome and all workspace type checks pass; **129 files / 1,187 tests passed**, test phase **69.04 s** after the final encoding correction. Existing `local.mjs` informational suggestion only. |
| [Full browser suite](browser.txt) | **78/78 passed** in **5.5 min**: TinyURL, both full mouse rebuilds, loader/cache preview and all existing mouse cases. 4301/4311, `jeeves_e2e`, own projects deleted by harness. |
| [Web build](build.txt) | Passed; existing chunk-size warning only. |
| [Focused suites](focused.txt) | **108 passed** across adapter, existing immutable reader, scoped module clients and reviewed off pins. |
| [Actual emitted Lua](lua.txt), [runner](lua-proof.ts), [stand-ins/oracle](lua-proof.lua) | **66 assertions passed**, **145 stand-in Redis commands**. Executes the exact JS-interpolated Lua strings under Lua 5.1.5, with independent expected counts/expiry/version outcomes. |
| [Pinned queue proof](queue.txt), [runner](queue-proof.mjs) | Installed node-redis **6.3.0** queue rejects before enqueue/wire, leaves pending count unchanged, then settles the original command and accepts PING. No socket/network needed. |
| [Scratch exports](emitted-compile.txt), [runner](compile.ts) | Five variants pass checker and TS7: video **125**, stubs **96**, frozen v2 **79**, module design off **86**, stub stack off **60** files. Negative TypeScript and import checks deny private primitives/scripts/client/socket/raw dispatch. |
| [Off-pin review](pins.json), [update](pins-update.txt), [format](pins-check.txt) | **79→79 / 86→86 / 60→60**, no paths added/removed. Only `src/runtime/valkey.ts` and its manifest hash change in the first two; stub stack off unchanged. Frozen v1 untouched. |

The offline Lua build used primary source `https://www.lua.org/ftp/lua-5.1.5.tar.gz`, SHA-256
`2640fc56a795f29d28ef15e13c34a47e223960b0240e8cb0a82d9b0738695333`, built using `make generic`
in the task-owned `/tmp/jeeves-rg11-lua.ASQKsM/`. No package/dependency change or repository binary.
The Lua harness supplies deterministic Redis command/TIME and cjson.decode doubles. It executes
real script branches, not native Valkey or real JSON-decoder behavior. Adapter unit tests supply
fake eval replies and exercise actual emitted dispatch/parsing/lifecycle/effect code; they do not
execute Lua. The pinned queue probe exercises actual installed driver internals without a socket.
Native Valkey transport, competing processes, store failure/recovery and durability proof remain
**RG14**. No generated-system/Docker checkpoint occurs here.

An initial intended focused invocation used `pnpm test -- <file>`, which Vitest treated as a full
suite: **1,167 passed / 4 failed**. Two failures were unreviewed off pins; one was the new exact
`end`-listener trace; the other exposed a fake connect that never settled on destroy. Pins were
reviewed before update, the trace was updated, and the normal fake now rejects on destroy while
a dedicated test proves the genuinely hung-connect bound. A focused rerun exposed the newly
classified startup log text plus an overbroad test-only edit to another fake's destroy method;
those were corrected. Final focused suites pass. Initial standard `pnpm check` stopped at the
new evidence pin review JSON's formatting; [failure](check-initial.txt) retained and formatting
fixed. The Lua runner initially used root `pnpm exec tsx`, which is not a root dependency; it was
rerun with Node 24's native TypeScript support. A final source review added malformed UTF-16 key/value refusal plus valid non-BMP/replacement-character
round-trip coverage. The first scratch compile caught `String.isWellFormed` requiring ES2024;
[that failure](emitted-unicode-initial.txt) is retained. Bounded Buffer round-trips implement the
check under the unchanged ES2023 target. The prior full pass is retained in
[check-before-unicode.txt](check-before-unicode.txt). No assertion, timeout or required check weakened.

Evidence logs normalize trailing whitespace only. No authoring command or chat tool description
changes, so offline chat evals are not rerun.
[Preservation](preservation.txt) confirms seven root hashes, the exact **34,001-byte** owner binary
diff/modes, prior RG01–10 evidence, frozen v1, historical exports and the accepted container
inventory. No owner studio/4300/4310 use, secret/home configuration inspection, live/paid provider
call, push or deployment. Browser/build evidence preceded the final private Unicode validation correction; their exercised
paths and rendered file lists are unchanged. Final scratch compilation, focused cases and full
check cover that correction. No browser/build rerun solely for the private encoding guard.
