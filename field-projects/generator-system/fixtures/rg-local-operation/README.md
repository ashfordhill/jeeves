# RG10 local operation input

The diagram wires one API, its local database and a same-process caller. It is a backend
mechanism fixture, with no frontend scope. Export it to scratch and copy `create-item.ts` into
`src/modules/items-api/`, `item.ts` into `src/contracts/`, and the declaration/migration/command
into their declared paths. Only application-owned input files are recorded here.

The operation is secret-bearing, retains replay for one day and receives only its registered
same-database command. Call the generated caller dependency `dependencies.createItem({key,input})` or the
operation's HTTP root with `Idempotency-Key`. Runtime authentication must supply an account
subject; this minimal design does not install an end-user identity provider. Tests inject
trusted caller facts through the generated HTTP guard seam; no live issuer is contacted.

A private replay ring must be supplied externally through
`JEEVES_SECRET_JEEVES_REPLAY_KEYS_FILE` (or `SECRET_DIR/jeeves-replay-keys`). No ring or credential
is checked in. The tests generate ephemeral keys in memory and preserve prior template SQL.
