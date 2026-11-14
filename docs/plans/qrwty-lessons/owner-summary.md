# QRWTY lessons for Jeeves: owner summary (JP00)

2026-11-14. Read only: Jeeves `0a2ee22`, QRWTY arm A `074d9e8`, arm B `26e8997`. The evidence is in
[analysis.md](analysis.md); the build plan in [units.md](units.md). Nothing is implemented.

## What I found

**Arm B is 68 files and 8,881 nonblank lines for the parts it has finished** (platform, links,
sessions, redirect; abuse, analytics and billing are still to come). About **68% of it is generic
plumbing** a production backend of any product needs, 27% is QRWTY policy, 5% test tooling. Of the
generic part, Jeeves already generates an equivalent of roughly 1,900 lines (process lifecycle,
HTTP admission, pool, migrations and grants, the Pub/Sub work in QG07–QG09, the Valkey client,
token verification). **About 4,000 generic lines are things a Jeeves stub author must still write
by hand today**, and arm A's plan confirms it: Q06–Q10b write their own transactions (as PL/pgSQL
functions), idempotency tables, route cache, scheduler, cookie sessions and workload tokens.

**The two arms designed the same mechanisms independently:** a reserved-connection transaction
API, insert-first idempotency records, a route cache with an absolute validity deadline that
copying never extends, a bounded awaited publisher, a cookie-session BFF with CSRF, workload tokens
on internal calls with the diagram's callers as the allowlist, leased scheduled jobs, and a
production profile that refuses emulators and placeholders by name. That convergence is the
strongest signal that these belong in templates.

**Share estimate for a QRWTY-like app:** about 35% today (consistent with the 30–35% you have).
With the plan's library units (transaction, idempotency, settings, keys, route table, scheduled
task, cache reader as a dependency): about 49%. Adding workload identity and the browser session
template: about 64%. These come from arm B's line counts, with the method stated, not from a
measurement of A; Q17 can check them. For YouTube the share barely moves (it is 91.75% already);
the gain there is correctness and fewer scaffold edits.

## The top items and their expected effect

1. **Pub/Sub client bounds (QL01).** Two constructor options B measured: after a 60 s outage every
   replica is back in about 2 s instead of up to 2 minutes, and the first local publish no longer
   waits 3 s for a credential lookup. No lines saved; a real outage tail removed.
2. **A scoped transaction for stubs (QL03).** `transaction(fn)` on every database stub, with retry
   on serialization failure and an honest "outcome unknown". Saves about 130 lines per app and
   removes the reason to write invariants as PL/pgSQL functions.
3. **Idempotency records (QL04).** One call makes a create or payment request replay-safe for 24
   hours; Jeeves owns the table. About 130 lines plus DDL and cleanup per app.
4. **Declared settings (QL05).** A stub declares the settings it reads; the process refuses to
   start, naming the setting, when one is missing or invalid. B spends 1,700 lines on this; a
   Jeeves app would spend about 60–100 declaration lines (a guess).
5. **A route table and a deadline signal for route stubs (QL02).** 404 and 405 with `Allow` for
   free, and a signal to bound downstream work to the Request timeout. About 150 lines per app.
6. **Keys library (QL06).** Key rings, HMAC, AES-GCM sealing and account-bound cursors. About 150
   lines per app; the session template needs it.
7. **Scheduled task (QL07, QL08).** A new module kind in a Worker with one setting, Every
   (seconds), running under a shared lease so copies run a tick once. Replaces A's scheduler
   service and B's job routes: about 230 lines per app.
8. **The Cache reader as an in-process dependency (QL09).** A Custom module calls the cache read
   template instead of mounting its route; QRWTY would stop rewriting the cache (about 350 lines).
9. **Workload identity on Service identity links (QL10, decision).** The link field that is
   "intent only" today starts to generate tokens and checks. About 220 lines per app.
10. **Browser session template (QL11, QL12, decision).** Cookie sessions, CSRF, token refresh and
    forwarding. About 1,000 lines per app that needs it; the only item that reaches 60% for a
    QRWTY-like app; also the riskiest (new dependency, crypto, Keycloak setup).

**Not taken on:** QRWTY's edge route map and pages, erasure journal and restore gate, account
deletion, destination rules, click events, billing policy, test clock and fault points, logging,
TLS (QG10 is already in the backlog), anything UI or deployment.

## The plan, one line per unit (after QGR2; one fresh agent each)

- **QL01** Pub/Sub clients reconnect within two seconds and skip the credential lookup locally.
- **QL02** Route stubs get a deadline signal and a route table.
- **QL03** Database stubs get a scoped transaction.
- **QL04** Route stubs get idempotency records (D4).
- **QL05** Stubs declare their settings and startup refuses an invalid one (D6).
- **QL06** A keys library for stubs: rings, signatures, sealed values and cursors.
- **QL07** A Scheduled task module kind with its interval (D2).
- **QL08** Scheduled tasks run every N seconds under a shared lease (D2, D4).
- **QL09** A Custom module can call its tile's Cache reader (D5).
- **QL10** Service identity links carry workload tokens between tiles (D1).
- **QL11** A Browser session module kind and its template contract (D3).
- **QL12** Browser session generates sign-in, cookie sessions, CSRF and token forwarding (D3).
- **QL13** QLR1: a fresh Fable reviewer checks the units, the pins and the regeneration proof.

## Decisions and clarifications I need from you

1. **Workload identity between tiles (QL10).** Consume the link's Security field: `Service
   identity` (today's default) makes the callee require a token from the tiles that link to it;
   `Private network` keeps the open call. Needs an Identity in the design; otherwise it stays
   intent only. Production foundations D1 called host names deployment, but QG06 settled that
   reading values is generic. **Recommend yes.**
2. **A Scheduled task module kind (QL07, QL08)** hosted in a Worker, setting "Every (seconds)"
   1–86,400, default 60, needing a database it writes for its lease. QG14 waited for this.
   **Recommend yes.**
3. **A Browser session template (QL11, QL12).** Two units, `openid-client@6.8.8` in every
   export's lock, a confidential Keycloak client per tile, fixed lifetimes (7 days, 24 hours idle).
   **Recommend yes, as the last two build units;** "after Q17's report" is also reasonable.
4. **Jeeves-owned tables for stubs (QL04, QL08):** `jeeves.idempotency_records` and
   `jeeves.schedule_leases` on the database the stub writes, created by a generated migration and
   granted to the tile's login. **Recommend yes.**
5. **Cache reader linked by a Custom module (QL09):** library only (no HTTP route) while linked,
   route as today otherwise. **Recommend yes.**
6. **Stub files export a `settings` declaration (QL05):** two generated lines in every stub body;
   older stubs without them still build and run. **Recommend yes.**
7. **Clarification:** should QL01's two options be folded into QG07/QG08 now, if their agents
   have not finished? It is a four-line change. **Recommend yes if QG08 has not started; else
   QL01 runs after QGR2.**
8. **Clarification:** QG16 (a process that waits for a missing dependency instead of exiting) is
   still your call; arm B chose waiting with capped backoff, which is the production behaviour for
   a worker pool without an orchestrator restart. Not in this plan; the review will note it.

The three files are in this folder: `analysis.md`, `units.md`, `owner-summary.md`.
