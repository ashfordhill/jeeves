# Frozen REST server releases

| Attachment | Runtime archive | Session identity |
| --- | --- | --- |
| `rest-api-server@0.1.0` | `@jeeves/rest-server@0.2.0` | `jeeves_session` (legacy) |
| `rest-api-server@0.2.0` | `@jeeves/rest-server@0.3.0` | Hash of normalized deployment public origin |

Each directory contains the compiled, dependency-declared npm archive and a
SHA-256/provenance manifest. Generation and the template harness verify and copy
these bytes, never repack mutable workspace source under an old version.
The current workspace source is 0.3.0. Both attachment exports remain registered.

Before changing session source for P35, 0.2.0 was built from clean runtime source
at `cadf0b874e0759619d72f8eb2b0f6dc22470d57e`, using the manifest's recorded tool
versions and pack command. Its archive is byte-identical to the already published
QR Studio 0.1.0 recipe archive (SHA-256
`33c6fcc3890335dfa39d659a029244ead363c17e65777079470c23c15f5381c6`).
The recipe's original archive and checksum were not replaced. The legacy manifest
records the original source hashes, including its tests; use the source revision
to reproduce it in a disposable checkout with the frozen workspace lockfile.

0.3.0 records the hashes of its compilation inputs; tests are excluded from the
archive. Reproduce it with the manifest's pack command in a disposable destination
and compare hashes, rather than overwriting a released archive. It retains the
old exports and adds the pure `sessionCookieName(publicOrigin)` helper. Its only
runtime behavior change is the cookie identity used by sessions.

See [transition and deployment limits](../../templates/rest-api-server/session-transition.md)
and [P35 verification evidence](../../docs/evidence/p35/README.md). Selecting the
new attachment is deliberate; existing stored references, starters and recipes
remain pinned. No live QRWTY adoption is included.
