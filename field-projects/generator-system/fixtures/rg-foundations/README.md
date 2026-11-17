# Native foundation checkpoint

Application-owned inputs for RG14, built with the existing studio commands in `design.ts`.
`design.json` is that saved input. The uploads gateway calls a separate internal service through
generated workload transport and independently verified end-user identity. Two gateway and two
service containers run; the independently running worker shares the service's logical owner but
has a distinct login and UPDATE permission. Its source supplies a registered product operation;
there is no scheduled/durable-work mechanism in this fixture. The unused Jobs link places the
worker on a valid lane; it selects no broker template.

The service composes sealed local replay, a two-per-minute principal admission policy and an
in-process versioned reader behind an authenticated route. Admission uses a separate no-eviction,
AOF/fsync-always Valkey resource from the reader's LRU cache. Product hooks import only their own
slots, the public extension API and the application contract. SQL and declarations are product
inputs, never template scaffold. `products-next.json` appends the unapplied 0002 migration for
the concurrent native migrators; setup sees those inputs through the application-owned override.

The existing harness writes a disposable replay ring outside the Docker build context, remembers
it for reporter redaction and removes it with the run. No fixture key or password is committed.

Run from the repository with Node 24.21.0:

```sh
pnpm test:generated --suite=rg-foundations --artifacts=/absolute/empty/artifact-directory
```

The runner records the exact `--cleanup /absolute/run.json` recovery command. Cleanup authorizes
only resources with that run's exact Compose project label. See the scenario's named assertions
and [independent review](../../../../docs/plans/reliable-generation/evidence/rg14/review.md).
