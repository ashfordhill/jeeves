## Independent application sessions (attachment 0.2.0 / runtime 0.3.0)

Explicitly select REST API server 0.2.0 for new designs. It pins the compiled
`@jeeves/rest-server@0.3.0` archive. Attachment 0.1.0 continues to use the frozen
0.2.0 runtime and its original `jeeves_session` cookie. Existing designs, starters
and QR Studio recipes retain their selected versions and released bytes.

The new cookie is `jeeves_session_` plus the first 32 lowercase hex characters of
SHA-256 of the validated deployment `PUBLIC_ORIGIN`'s normalized `URL.origin`.
Ports distinguish local applications; equivalent default ports and trailing
slashes do not. Replicas and restarts at the same origin share this stable name.
The server uses this identity for login, registration, session lookup and logout.
It never reads or clears a legacy or another origin's cookie. Tokens, database
hashes, seven-day expiry, HttpOnly, SameSite=Strict, Path=/, HTTPS Secure, exact
Origin/CSRF checks and ownership filtering keep their existing behavior.

Adopting this release, or changing PUBLIC_ORIGIN, requires signing in once with
existing credentials. Account and resource rows remain valid; no registration,
database reset or SQL migration is required. Old session rows expire normally.
Legacy applications continue to collide with each other until separately adopted.
The live QRWTY application has not adopted this release through P35.

One session-backed application per public origin is supported. Different paths
on the same origin, shared login/SSO and custom cookie names are outside this
release. Namespacing prevents accidental replacement; it does not isolate hostile
applications on the same hostname. Mixed REST runtime versions in one generated
project or harness module set are refused before writes. Use separate projects.

This attachment is not in the behavior-preserving element `upgradeTemplate`
allowlist. Adoption into existing protected output needs separate review; the
P35 disposable old/new fixture proves storage/protocol compatibility only.
Developer auto-login, public landing pages and page flows remain future work.
