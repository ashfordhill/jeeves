# RG08 — purpose-bound keys and sealed values

Built on accepted RG07 `102da20db4c6b9f6192fef7f24a56d3707546b8e` for coordinator acceptance.
Extension API remains **v7**: signing/sealing declarations are additive. There is no new ordinary
setting, provider, dependency, identity feature or deployment behavior.

`src/runtime/keys.ts` uses Node HKDF-SHA256 to derive separate keys for each purpose and mode,
HMAC-SHA256 for signed values, and AES-256-GCM for sealed values. Derivation and authenticated
fields use structured JSON arrays of validated strings. Version, key ID, fixed purpose, explicit
trusted scope and operation context are authenticated. Sealing uses random 96-bit nonces and
128-bit tags. Envelopes identify the key; the first configured key writes, retained keys read,
and removed/unknown keys refuse. `jks1` and `jke1` identify fixed protocols without algorithm
negotiation. Cross-purpose, cross-scope, cross-context and cross-mode reuse fails.

Product operations declare `signingKeys(purpose)` or `sealingKeys(purpose)` through the public
API and receive only nominal, frozen method handles. Raw ring/secret constructors, file readers
and internal crypto constructors remain private. Policies receive no handle. `jeeves` and the
`jeeves.` prefix are reserved for private generated mechanisms; public declarations refuse them
with the sanitized setting-name error. Subsequent generated mechanisms must use this namespace.
Only built-in setting descriptor identities and their registered `optional()` derivatives are
accepted. Fabricated/copied descriptors and custom parser callbacks refuse before file access.
This closes the existing structural-descriptor escape hatch without offering a custom-parser API.
The checker refuses private settings/keys and filesystem imports. These are cooperative public
API/runtime/import checks, not a hostile JavaScript sandbox.

The process configuration pass now captures settings once and passes those exact frozen values
to setup, replacing the previous second read during dependency construction. Its reader shares
file snapshots by configured pathname across module declarations. An actual emitted process test
changes the file after its first close: both distinct-purpose operations still use the original
snapshot, with one file open and one client construction. Missing/malformed/oversized settings and
invalid/reserved purposes fail before client construction/readiness, naming only `VALUE_KEYS`.
A forged public parser fails during actual module startup with **zero file reads, zero parser
calls, zero clients, no readiness and no content logging**.

Values are UTF-8 strings up to 16 KiB; scope and context are each nonempty and at most 512 UTF-8
bytes; accepted envelopes are canonical unpadded base64url and at most 24 KiB. Unpaired surrogates,
invalid/padded/alternate-pad-bit encodings, tampering and truncation refuse. Bounds precede
untrusted component decoding. Invalid reads return `undefined` without logging; invalid writes
throw a fixed value-free error. Empty and maximum-size values round-trip. The private ring parser
now bounds files to 64 KiB and keys to 32–4096 bytes, retaining 1–8 unique 1–32-character safe IDs.
Ring file reads buffer at most 65,537 bytes to detect an oversized ring. These upper bounds are
a deliberate private-runtime compatibility limit; former unrestricted direct-runtime users must
migrate to supported public declarations. Normal text/integer/URL/optional behavior is preserved.

[Fixed vectors](vectors.json) are independently produced by [the Python oracle](vectors.py):
Python 3.12.3 `hashlib`/`hmac` for RFC 5869 extract/expand and HMAC, plus `cryptography` 41.0.7
`AESGCM`. [Captured oracle output](vector-oracle.txt) matches emitted signing and verification,
fixed-nonce sealing and opening. Production sealing uses platform random nonces. Tests prove
alternate pad-bit aliases decode to the original bytes before asserting their refusal. Rotation,
key-ID substitution with identical key bytes, all context fields, method-only handles, copied key
material, maximum bounds and malformed configuration have behavioral assertions.

| Check | Actual result |
| --- | --- |
| [Final `pnpm check`](check.txt) | Node 24.21.0; Biome, workspace type checks, **126 files / 1,133 tests passed**. No skipped suites; existing `local.mjs` informational style suggestion only. |
| [Focused mechanisms and boundary](focused.txt) | **55 passed** across crypto, actual startup, existing settings and lifecycle/import suites. |
| [Affected regression cases](regression.txt) | **96 passed** across eight suites after updating exact emitted expectations. Final full check includes these again after descriptor validation. |
| [Full browser suite](browser.txt) and [targeted Preview](browser-targeted.txt) | **75 passed**, then the one failed exact Preview file-list expectation corrected and **1 passed**. TinyURL, both complete v2/v3 mouse rebuilds and existing authoring paths passed. |
| [Web build](build.txt) | Passed; existing chunk-size warning only. Retained through later internal parser corrections, which do not alter the exercised UI/build behavior. |
| [Scratch exports](emitted-compile.txt) | Eight variants pass emitted checker and TS 7.0.2 offline: RG08 keys **53**, zero-stub process **74**, Favorites **73**, video **124**, runnable stubs **92**, frozen v2 **79**, module design off **86**, stub stack off **60** files. |
| [Processes-off pins](pins.json) | Reviewed **79→79 / 85→86 / 59→60**. Only `src/runtime/keys.ts` is added where stubs exist. Other changes are public declarations, settings runtime, generated stub comments, guide and metadata. Frozen v1 is untouched. |

The scratch fixture uses its actual handwritten cursor/receipt operations. Negative TypeScript
proof rejects raw `keyRing`/`secret`/`readSettings` imports, raw key/file properties and a binding
without context. A separate no-stub process compiles without a settings reader. Existing API
migration, updater directory/symlink refusal and byte-preservation tests remain intact. The old
runtime-directory count was replaced with the exact four-file assertion; no path safety check was
removed. Historical exports and handwritten bodies were not rewritten.

The first broad check stopped on the new evidence JSON's formatting. After formatting, regression
failures were stale exact comments/file lists, old twice-read settings expectations and a callable
assignment harness needing captured settings. The browser failure likewise omitted the newly
emitted `keys.ts` from its exact list. Focused diagnosis preserves and updates those assertions.
Initial fixture link-ID and startup fake-export mistakes were corrected against the actual
emission. Review then reserved internal purposes and fixed descriptor identity validation; affected
focused/scratch/full checks were refreshed. No assertion or timeout was weakened. Successful
browser/build evidence was retained for the internal parser changes. No authoring command or tool
description changed, so offline chat evals were not rerun; there was no paid/live model call.

Rotation is file replacement plus process restart, with retained keys present on readers; there
is no file watcher, KMS, cloud secret provisioning or key UI. Signatures do not provide expiry,
product-schema validation or authorization. Callers must supply trusted scope/context and validate
the verified value. Replay, workload credentials, HMAC ingress and browser sessions remain future
mechanism consumers; none is implemented here. Native concurrent migrator/login proof remains
RG14. This is not a generated-system/Docker checkpoint, and no later unit began.

Seven root-file hashes match `/tmp/jeeves-rg-resume-root-files.json`. The owner's exact 34,001-byte
binary diff/modes match `/tmp/jeeves-rg-owner-diff.patch`. Frozen v1, historical evidence/exports,
`.docs/` and feedback are preserved. Scratch exports use read-only installed-dependency symlinks
and are removed in `finally`; no install occurs. Docker inventory before/after is only
`c0fbbc2996fe jeeves-postgres-1` at `127.0.0.1:54329`. No task Docker resource, owner studio port,
secret inspection, push or deployment occurred. E2e uses 4301/4311 and `jeeves_e2e`, deleting its own
projects.
