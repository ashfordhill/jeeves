# RG12 — atomic callable rate limiter

Built on accepted RG11 `a97c776ca0008a9fe61ef82fb597284a5d8a8ec9`. Extension API remains **v8**.
The existing Rate limiter becomes an installed callable lead on Service/Uploads, requiring a
supported shared cache and its own host's Required Auth guard. Custom and Data access have an
optional **admission** slot; the generated handle exposes only `admit({})` and a stable target.
There is no new HTTP endpoint, public cache primitive, provider, dependency or effect class.

The pure key hook receives only a validated immutable verified subject. It returns a nonempty
well-formed UTF-8 key of at most 256 bytes, without control characters. It gets no input body,
header, address, token, client or operation/transaction handle. Runtime validation refuses missing
or malformed identity before dispatch; static policy checks and runtime pure/local scopes deny
captured admission/cache/network calls. Address trust is unavailable, and `X-Forwarded-For` is
never trusted. Legacy algorithm/store/key choices remain schema-readable and unmodified, with
useful generation refusals. New defaults are sliding-window, shared Redis-compatible store and
product key policy, with **100 / 60 seconds**. Only limit (**1–10,000**) and window seconds
(**1–604,800**) are ordinary editable settings, consumed by the emitted mechanism.

One fixed RG11 single-key TIME/ZSET rolling log removes entries at or before store `now-window`,
admits only below the configured limit and expires at the last admission plus the window.
Denials never renew expiry. Each response carries count/remaining and absolute store-clock
`resetAt`; successful wait is zero. A denial's wait is computed at delivery, clamped to
`[0, windowMs]`, and HTTP `Retry-After` rounds that remainder up to seconds. Denial throws protected
429; unavailable, saturated and unknown checks throw typed 503 without a per-copy allowance or
blind retry. Unknown dispatched admission remains unknown even after a local transaction rolls
back. Product error formatters may shape the body but cannot change status or protected headers.

The generated namespace hashes stable process/module IDs, callable contract/version and fixed
limit/window; a second digest bounds and hides the product key. Copies enforcing one policy must
share the same IDs, limit/window, contract and key policy. Changing IDs/configuration/contract
starts a separate rolling log; changing key policy can change which log a request uses. Mixed
old/new policies have no combined bound. Display renames preserve IDs and namespaces. The local
Valkey binding uses **noeviction + AOF + appendfsync always**, without a new inspector knob.
Bounds assume compatible UTC clocks and retention of acknowledged store state. Disk/data loss,
deliberate reset and policy migration cannot preserve a lost log. Native persistence/crash,
transport, competing processes and store outage/recovery remain **RG14**.

Application completion stays explicit. The lead emits a throwing pure key-policy hook; connection
only supplies the typed handle. The product operation must call `dependencies.<limiter>.admit({})`
inside `defineLocalOperation.admit`. RG10 recovers a committed replay before this callback. The
new handwritten `rg-rate-limiter` fixture supplies that call and a subject key, while its generated
files are exported from the diagram into scratch. No unfinished product stub is labelled complete.
Public product `CacheClient.get/set/delete` refuse the reserved literal **`jeeves:`** prefix before
any driver call. Names/hashes are not authority: a shared product handle cannot inspect, overwrite
or delete an admission log even when it guesses the exact key and shares the physical client.
Ordinary product keys are unchanged. Existing application-owned keys under the reserved prefix
require an explicit application migration; regeneration never remaps/deletes keys or rewrites hook
bodies. No general cache ACL/provider system is added. Immutable positive readers and admission
need separate caches because their LRU/no-eviction contracts differ; connecting two otherwise valid
leads to one cache now refuses immediately with that exact reason.

The private cache command keeps mutation outcome semantics while allowing only generated admission
coordination under read-like authority; arbitrary cache writes still fail in read effects, and
pure/local mutation scopes still deny all network.

| Check | Actual result |
| --- | --- |
| [Final `pnpm check`](check.txt) | Node 24.21.0; Biome and every workspace type check pass; **130 files / 1,196 tests passed**, test phase **70.12 s**. Existing informational `local.mjs` suggestion only. |
| [Full frozen-source browser suite](browser.txt), [corrected case](browser-targeted.txt) | **78 passed / 1 test-expectation failure** in **4.8 min**, then corrected new limiter case **1 passed** in **9.2 s**. All **79 unique scenarios** accounted for, including TinyURL, both full mouse rebuilds and changed controls/connection/blueprint/Preview. Initial full run: [74 passed / 5 failed](browser-initial.txt). |
| [Offline plain `pnpm eval:chat`](chat.txt) | Passed existing scripted design arms and synthetic replays under the fetch-disabled harness; no positional report argument, paid model or network call. New tools test checks actual Workspace command parity and refusal. |
| [Web build](build.txt) | Passed; existing chunk-size warning only. |
| [Focused mechanisms/contracts](focused.txt), [protected namespace/composition](namespace-focused.txt) | **87 passed** in six affected suites, then **118 passed** across public clients, limiter and module derivation. Shared generated client proof verifies reserved get/set/delete refusal with zero driver calls, ordinary keys and unchanged admission bound; fully valid separate leads prove the exact LRU/no-eviction connection refusal. |
| [Scratch export checker/TS7](emitted-compile.txt), [runner](compile.ts) | Seven variants pass: limiter **71**, limiter processes off **49**, video **125**, stubs **96**, frozen v2 **79**, module design off **86**, stub stack off **60** files. Limiter fixture installs handwritten local operation/key policy and existing product SQL. Negative TypeScript/import proofs deny constructors, private cache/refusal authority, caller-chosen keys/address facts, lifecycle access and policy `.admit` effects. |
| [Exact emitted Lua](lua.txt) | Unchanged RG11 runner executes current emitted scripts under existing task-owned Lua 5.1.5: **66 independent assertions / 145 stand-in commands** pass. Deterministic Redis/TIME/cjson doubles, not native Valkey. |
| [Off-pin review](pins.json), [pin check](pins-check.txt), [final lint](lint.txt) | **79→79 / 86→86 / 60→60**, no added/removed paths. Shared runtime/checker and generated guide changes, explicit new optional slots/metadata, and new constructor defaults in newly built stub fixture are reviewed. Frozen v1 unchanged. A final wording-only guide correction was followed by regeneration and focused pin/lint checks. |

The runtime tests execute the emitted Valkey adapter and limiter with two independently created
clients and an independent rolling-window store oracle. A ten-call burst admits exactly two;
denial wait decreases, expiry admits again, namespaces remain distinct, saturation preserves the
healthy client, unknown replies never retry, disconnect refuses and the same limiter resumes
after the bounded reconnect. This is offline binding/algorithm-contract evidence, not a real
cross-process/store proof. The existing exact Lua harness separately executes the actual script.
PGlite executes actual limiter admission inside RG10, verifies one product row, protected refusal,
replay skipping admission and unknown classification after rollback. A guarded real Fastify
injection test verifies no-subject/no-dispatch, actual limiter 429/Retry-After, unknown 503/header
and a formatter attempting success/header replacement.

Initial focused runs exposed stale exact descriptions/counts/slot traces, plus the existing mouse
selector's single in-process-slot assumption. The selector now chooses by target kind while
preserving the existing Favorites fallback reason; both Custom and Data access options are
checked. Strict test-oracle indexing/narrowing errors stopped the [first full check](check-initial.txt)
and were fixed. The [second check](check-second.txt) reached **1,191 passed / 4 failed** on stale
registry/menu/callable/optional-slot expectations, all diagnosed without weakening assertions.
[Initial focused failures](focused-initial.txt), [intermediate](focused-second.txt) are retained.
The scratch runner initially used Node strip-only mode, which cannot lower an existing TypeScript
parameter property; [failure](emitted-compile-initial.txt). The recorded successful command is
`node --experimental-transform-types docs/plans/reliable-generation/evidence/rg12/compile.ts`.

The first full browser run had an old exact callable-refusal reason, an old limiter status reason,
and the new test wrongly asserting normalized contracts inside the read-only blueprint. The new
assertions instead check blueprint v3 settings/component links plus Preview's normalized callable
contract. Two existing Favorites/cache-reader mouse failures occurred while source/HMR was active;
that timing does not establish the cause. The frozen-source rerun passed the four existing cases. The new case repeated the blueprint
assertion failure because an earlier scripted edit missed its formatted multiline block; the
exact block is now corrected, with the substantive settings/link/Preview assertions retained.
The corrected case then passed on its targeted rerun; no runtime source changed for that test
correction. After the protected-key correction, [the same mouse case](browser-protected.txt) also
verified the exact cache-sharing refusal and unchanged revision: **1 passed / 15.9 s**. Browser
checks use only 4301/4311, `jeeves_e2e` and their own deleted projects.

No generated-system/Docker checkpoint, new provider/dependency, live issuer/paid model, owner port,
push, deployment or later unit. Root files, owner changes, historical exports/evidence/screenshots,
local-v1 templates and historical stopped containers are preserved. [Preservation receipt](preservation.txt) verifies seven root hashes, the exact **34,001-byte** owner
diff/modes and identical **42-row** [before](docker-before.txt)/[after](docker-after.txt) container
inventories, including the running studio Postgres and every historical stopped container.

Final review found the public cache wrapper could still address the generated admission namespace.
The runtime guard and shared-client proof above close that RG12 seam. The first new harness run
retrieved a cached client Promise without awaiting it, unlike the actual generated mount; the
[diagnostic failure](namespace-initial.txt) is retained and the harness now awaits that exact shared
client. No product guarantee/assertion was weakened. Before adding the explicit compatibility
refusal, a sharing probe was already blocked by authority/TTL findings; the final test instead
starts from two fully valid separate-cache leads and checks the exact LRU/no-eviction refusal.

The first post-correction [standard check](check-protected-initial.txt) passed **1,195 tests** and
failed one unchanged Board drag test at its immediate `is-drop-target is-drop-over` class assertion.
The Board source and assertions were preserved. Its unchanged [focused suite](board-rerun.txt)
passed **15/15**. The cause is unestablished; a standard rerun after concurrent browser/eval
completion passed **130 files / 1,196 tests** in **69.83 s** with no Board source/assertion change.
The prior all-pass check is retained in
[check-before-protected-keys.txt](check-before-protected-keys.txt).

The final staged-diff review also found that reading/binding `hooks.key` could execute a product
accessor before the key function's guarded invocation. Its one-time property snapshot, function
check and bind now run inside the existing `withLocalPolicy`; invocation stays guarded too. A
constructor accessor attempting an actual captured public cache read receives `EFFECT_NOT_ALLOWED`
with zero driver calls on the shared generated client. [Affected suites](policy-focused.txt) pass
**78 tests**; all seven scratch variants pass checker/TS7 again. The prior standard pass is retained
in [check-before-policy-snapshot.txt](check-before-policy-snapshot.txt); the final standard run
passed **130 files / 1,196 tests** in **69.91 s** with these added assertions. Browser, build and chat behavior are unchanged by this private
policy snapshot correction.

The introduced Data access admission slot must also have a generated consumer. Data access used
as another template's part emits no standalone product operation/dependency object. Authoring and
raw resolution now refuse such an admission link, without injecting a capability into part hooks.
The [focused suites](part-focused.txt) pass **144 tests**, including otherwise-valid separate-cache
leads, normal/raw part refusal, and continued standalone Data access/Custom callable support. All
seven scratch variants still pass. This is the finite current slot boundary, not a general
composition matrix. The preceding standard run is retained in
[check-before-part-refusal.txt](check-before-part-refusal.txt).

Only this unit's text logs normalize trailing whitespace and excess final blank lines; original
command output remains in the task's `/tmp/jeeves-rg12-*.txt` logs. Results and diagnostic content
are unchanged. Historical evidence and owner files were not normalized or edited.

Final standard check after the part-consumer correction: **130 files / 1,196 tests passed, 70.12 s**.
